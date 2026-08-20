import * as Notifications from 'expo-notifications';

import { buildFirstChargeReminderDate } from '@/src/features/billing/model';
import {
  buildReminderPlans,
  REMINDER_OCCURRENCE_HORIZON,
} from '@/src/lib/notifications/buildReminderPlans';
import type {
  BillingSnapshot,
  DailyLogEntry,
  ReminderPreference,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

export const REMINDER_NOTIFICATION_CHANNEL_ID = 'floriva-reminders';
export const BILLING_REMINDER_NOTIFICATION_IDENTIFIER = 'reminder-first-charge';

const KNOWN_REMINDER_BASE_IDENTIFIERS = [
  'reminder-daily-log',
  'reminder-period-start',
  'reminder-fertile-window',
  'reminder-birth-control',
] as const;

// LT-05: cycle-event kinds (period-start, fertile-window) now schedule up to
// REMINDER_OCCURRENCE_HORIZON occurrences, identified as the bare base
// identifier (occurrence 1) plus `#2`, `#3`, ... suffixes (see
// buildReminderPlans.ts). Every occurrence identifier within the CURRENT
// horizon is cancelled on every reconcile, for every known base identifier
// -- this covers a kind getting disabled or its occurrence list shrinking
// between reconciles. Daily-cadence kinds only ever produce the bare
// identifier, so the extra cancel calls for those are harmless no-ops.
//
// KNOWN LIMITATION: this list derives from the CURRENT value of
// REMINDER_OCCURRENCE_HORIZON. If a future code change SHRINKS that
// constant, occurrences scheduled by a previous app version beyond the new
// horizon (e.g. `#4` when the horizon drops from 4 to 3) would not be in
// this cancellation list and would fire once as orphans. If the horizon is
// ever reduced, either bump this derivation to a MAX_EVER_HORIZON constant
// covering the largest value ever shipped, or add a one-time
// cancel-all-scheduled migration alongside the change.
const KNOWN_REMINDER_IDENTIFIERS = KNOWN_REMINDER_BASE_IDENTIFIERS.flatMap((baseIdentifier) => [
  baseIdentifier,
  ...Array.from({ length: REMINDER_OCCURRENCE_HORIZON - 1 }, (_, index) =>
    `${baseIdentifier}#${index + 2}`,
  ),
]);

type ReconcileReminderNotificationsOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  preferences: ReminderPreference[];
  // Optional: buildReminderPlans defaults to English when omitted, so every
  // existing caller keeps working unchanged.
  locale?: SupportedLocale;
};

// buildReminderPlans constructs DATE triggers with the local-time Date
// constructor, so the trigger's calendar day must be read back in local time to
// compare it against todayIso (which is also a local calendar date).
function localDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureReminderChannel() {
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_NOTIFICATION_CHANNEL_ID, {
      name: 'Floriva reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Notification channels are Android-specific. iOS and test environments can ignore this.
  }
}

export async function cancelBillingReminderNotification() {
  await Notifications.cancelScheduledNotificationAsync(
    BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
  );
}

export async function ensureReminderPermissions() {
  const existingPermission = await Notifications.getPermissionsAsync();

  if (existingPermission.status === 'granted') {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return requestedPermission.status === 'granted';
}

export async function cancelAllReminderNotifications() {
  await Promise.all(
    KNOWN_REMINDER_IDENTIFIERS.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier),
    ),
  );
}

export async function cancelAllLocalNotifications() {
  await Promise.all([
    cancelAllReminderNotifications(),
    cancelBillingReminderNotification(),
  ]);
}

export async function reconcileBillingReminderNotification({
  snapshot,
}: {
  snapshot: BillingSnapshot;
}) {
  const reminderDate = buildFirstChargeReminderDate(snapshot, {
    reminderLeadDays: 3,
    reminderHour: 9,
    reminderMinute: 0,
  });

  await cancelBillingReminderNotification();

  if (!reminderDate) {
    return null;
  }

  await ensureReminderChannel();

  return Notifications.scheduleNotificationAsync({
    identifier: BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    content: {
      title: 'Billing reminder',
      body: 'Your Floriva free trial ends in 3 days unless you cancel first.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
      date: reminderDate,
    },
  });
}

export async function reconcileReminderNotifications({
  todayIso,
  profile,
  logEntries,
  preferences,
  locale,
}: ReconcileReminderNotificationsOptions) {
  const plans = buildReminderPlans({
    todayIso,
    profile,
    logEntries,
    preferences,
    locale,
  });

  await cancelAllReminderNotifications();
  await ensureReminderChannel();

  // buildReminderPlans rolls reminders forward by whole days, but cannot know
  // the wall-clock time of day. A reminder whose day is today but whose hour has
  // already elapsed produces a DATE trigger in the past. Expo rejects or fires
  // such triggers immediately, so drop those here — the next reconcile (once
  // todayIso advances past the event) rolls the reminder to the following cycle.
  // The guard is scoped to triggers landing on todayIso itself: a trigger on a
  // future calendar day is always kept (only its time-of-day on *today* can be
  // "already past"), which also keeps the function independent of the real clock
  // for any future-dated plan.
  const now = Date.now();
  const schedulablePlans = plans.filter((plan) => {
    if (plan.trigger.type !== 'date') {
      return true;
    }

    const triggerDayIso = localDateIso(plan.trigger.date);
    return triggerDayIso !== todayIso || plan.trigger.date.getTime() > now;
  });

  return Promise.all(
    schedulablePlans.map((plan) =>
      Notifications.scheduleNotificationAsync({
        identifier: plan.identifier,
        content: plan.content,
        trigger:
          plan.trigger.type === 'daily'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
                hour: plan.trigger.hour,
                minute: plan.trigger.minute,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
                date: plan.trigger.date,
              },
      }),
    ),
  );
}
