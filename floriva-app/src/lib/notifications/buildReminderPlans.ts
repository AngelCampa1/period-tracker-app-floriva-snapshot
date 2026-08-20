import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays } from '@/src/lib/predictions/dateMath';
import { fallbackLocale } from '@/src/localization/config';
import { translate } from '@/src/localization/translations';
import type {
  DailyLogEntry,
  ReminderKind,
  ReminderPreference,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

// Notification category registered at app startup (see
// registerNotificationCategories.ts) with the discreet "Quick log" / "Open"
// actions. Only reminder kinds where a quick log genuinely makes sense
// (daily-log, period-start) carry it — attaching it to every reminder kind
// would put a period-flavored quick action on notifications that have
// nothing to do with logging a day (e.g. birth-control, fertile-window).
// No hyphens/colons: Expo's setNotificationCategoryAsync docs warn that a
// category identifier containing `:` or `-` "might not work as expected" on
// at least one platform, so this deliberately uses camelCase instead of the
// hyphenated style used for notification *request* identifiers elsewhere in
// this module (that's a different, unaffected namespace).
export const FLORIVA_LOG_NOTIFICATION_CATEGORY = 'florivaLog';

const QUICK_LOG_CATEGORY_KINDS = new Set<ReminderKind>(['daily-log', 'period-start']);

// LT-05: cycle-event reminders (period-start, fertile-window) are DATE
// triggers, not OS-repeating triggers, because their date depends on the
// prediction engine and shifts as the user logs. A single scheduled
// occurrence fires once and then goes silent for a user who never reopens
// the app to trigger reconcileReminderNotifications -- exactly the user a
// re-engagement reminder exists to reach. Pre-scheduling a horizon of
// future occurrences means a lapsed user still gets nudged across multiple
// projected cycles before silence, without requiring any backend or
// OS-side recurring-DATE-trigger primitive (expo-notifications has none).
//
// Budget arithmetic (iOS caps pending local notifications at 64, see
// https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app):
//   - 2 daily-cadence kinds (daily-log, birth-control) -> 1 pending
//     notification each (OS DAILY trigger repeats without rescheduling) = 2
//   - 2 cycle-event kinds (period-start, fertile-window) -> up to
//     REMINDER_OCCURRENCE_HORIZON pending DATE triggers each
//   - 1 optional billing reminder (reminder-first-charge, scheduled
//     separately by reconcileBillingReminderNotification) = 1
//   Total with horizon=3: 2 + 2*3 + 1 = 9, far under the 64-notification
//   cap even before accounting for the fact that not every kind is enabled
//   simultaneously. Horizon could grow to ~30 per cycle-event kind before
//   approaching the cap, so 3 has generous headroom for a future increase.
export const REMINDER_OCCURRENCE_HORIZON = 3;

type ReminderPlanContent = {
  title: string;
  body: string;
  categoryIdentifier?: string;
};

type DailyReminderPlan = {
  identifier: string;
  kind: ReminderKind;
  content: ReminderPlanContent;
  trigger: {
    type: 'daily';
    hour: number;
    minute: number;
  };
};

type DateReminderPlan = {
  identifier: string;
  kind: ReminderKind;
  content: ReminderPlanContent;
  trigger: {
    type: 'date';
    date: Date;
  };
};

export type ReminderPlan = DailyReminderPlan | DateReminderPlan;

type BuildReminderPlansOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  preferences: ReminderPreference[];
  // Defaults to English so every existing caller (and every prior test) that
  // doesn't pass a locale keeps working unchanged.
  locale?: SupportedLocale;
};

function resolveReminderContent(
  kind: 'daily-log' | 'birth-control' | 'cycle-event',
  locale: SupportedLocale,
): { title: string; body: string } {
  if (kind === 'daily-log') {
    return {
      title: translate(locale, 'notifications.dailyLog.title'),
      body: translate(locale, 'notifications.dailyLog.body'),
    };
  }

  if (kind === 'birth-control') {
    return {
      title: translate(locale, 'notifications.birthControl.title'),
      body: translate(locale, 'notifications.birthControl.body'),
    };
  }

  return {
    title: translate(locale, 'notifications.cycleEvent.title'),
    body: translate(locale, 'notifications.cycleEvent.body'),
  };
}

function buildReminderContent(
  kind: ReminderKind,
  contentKind: 'daily-log' | 'birth-control' | 'cycle-event',
  locale: SupportedLocale,
): ReminderPlanContent {
  const content = resolveReminderContent(contentKind, locale);

  if (!QUICK_LOG_CATEGORY_KINDS.has(kind)) {
    return content;
  }

  return {
    ...content,
    categoryIdentifier: FLORIVA_LOG_NOTIFICATION_CATEGORY,
  };
}

function isValidTimeOfDay(hour: number, minute: number): boolean {
  return (
    Number.isFinite(hour) &&
    Number.isFinite(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function buildLocalTriggerDate(
  dateIso: string,
  hour: number,
  minute: number,
): Date | null {
  const [year = 0, month = 1, day = 1] = dateIso.split('-').map(Number);

  // Guard against NaN or out-of-range values that would cause the Date
  // constructor to silently overflow into a different calendar day/hour.
  if (!isValidTimeOfDay(hour, minute)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

type ReminderOccurrenceDates = {
  eventDate: string;
  reminderDate: string;
};

/**
 * Resolves the next `REMINDER_OCCURRENCE_HORIZON` projected occurrences of a
 * cycle-event reminder, starting from the first one that lands today or
 * later. Each subsequent occurrence is exactly one projected cycle length
 * after the previous, matching the roll-forward convention the single-shot
 * version of this function used to apply just once.
 */
function resolveDatesForReminder(
  kind: ReminderKind,
  preference: ReminderPreference,
  todayIso: string,
  cycleLengthDays: number,
  prediction: ReturnType<typeof buildPredictionResult>,
): ReminderOccurrenceDates[] | null {
  if (preference.schedule.cadence !== 'cycle-event') {
    return null;
  }

  let eventDate: string | null = null;

  if (kind === 'period-start') {
    eventDate = prediction.nextPeriod.startDate;
  }

  if (kind === 'fertile-window') {
    eventDate = prediction.fertileWindow.startDate;
  }

  if (!eventDate) {
    return null;
  }

  let reminderDate = addDays(eventDate, -preference.schedule.daysBefore);

  while (reminderDate < todayIso) {
    eventDate = addDays(eventDate, cycleLengthDays);
    reminderDate = addDays(reminderDate, cycleLengthDays);
  }

  const occurrences: ReminderOccurrenceDates[] = [{ eventDate, reminderDate }];

  for (let i = 1; i < REMINDER_OCCURRENCE_HORIZON; i += 1) {
    eventDate = addDays(eventDate, cycleLengthDays);
    reminderDate = addDays(reminderDate, cycleLengthDays);
    occurrences.push({ eventDate, reminderDate });
  }

  return occurrences;
}

export function buildReminderPlans({
  todayIso,
  profile,
  logEntries,
  preferences,
  locale = fallbackLocale,
}: BuildReminderPlansOptions): ReminderPlan[] {
  const plans: ReminderPlan[] = [];
  // Guard against duplicate identifiers: only the first enabled preference per
  // identifier is scheduled. A second preference of the same kind would share
  // the same Expo notification identifier, causing the second
  // scheduleNotificationAsync call to silently overwrite the first.
  const scheduledIdentifiers = new Set<string>();
  const prediction = buildPredictionResult({
    todayIso,
    profile,
    logEntries,
  });

  for (const preference of preferences) {
    if (!preference.enabled) {
      continue;
    }

    if (preference.kind === 'daily-log') {
      const identifier = 'reminder-daily-log';
      if (scheduledIdentifiers.has(identifier)) continue;
      // Skip invalid times rather than forwarding NaN/out-of-range hour or
      // minute straight to the OS scheduler.
      if (!isValidTimeOfDay(preference.hour, preference.minute)) continue;
      scheduledIdentifiers.add(identifier);
      plans.push({
        identifier,
        kind: preference.kind,
        content: buildReminderContent(preference.kind, 'daily-log', locale),
        trigger: {
          type: 'daily',
          hour: preference.hour,
          minute: preference.minute,
        },
      });
      continue;
    }

    if (preference.kind === 'birth-control') {
      const identifier = 'reminder-birth-control';
      if (scheduledIdentifiers.has(identifier)) continue;
      // LT-26: a birth-control reminder is meaningless (and self-contradictory
      // -- "Time to take your birth control" with no method on file) once its
      // method has been cleared. The Settings BC-detail screen's own
      // `persistBirthControlMethod` turns the reminder off when the method is
      // cleared THROUGH that screen, but that is only one write path -- a
      // restored backup, an in-progress migration, or any future mutation of
      // `profile`/`reminderPreferences` outside that screen can still leave
      // `enabled: true` with no `birthControlMethod` on the stored data. This
      // guard is the single choke point both `reconcileReminderNotifications`
      // (actual OS scheduling) and `buildReminderCenterModel` (Settings
      // reminder-center summary) run through, so it self-heals any such
      // orphaned state on the next reconcile without needing a dedicated
      // migration.
      if (!profile.birthControlMethod) continue;
      if (!isValidTimeOfDay(preference.hour, preference.minute)) continue;
      scheduledIdentifiers.add(identifier);
      plans.push({
        identifier,
        kind: preference.kind,
        content: buildReminderContent(preference.kind, 'birth-control', locale),
        trigger: {
          type: 'daily',
          hour: preference.hour,
          minute: preference.minute,
        },
      });
      continue;
    }

    const baseIdentifier = `reminder-${preference.kind}`;
    if (scheduledIdentifiers.has(baseIdentifier)) continue;

    const occurrences = resolveDatesForReminder(
      preference.kind,
      preference,
      todayIso,
      prediction.cycleLengthDays,
      prediction,
    );

    if (!occurrences) {
      continue;
    }

    let scheduledAny = false;

    // Occurrence 1 keeps the bare identifier (`reminder-period-start`) so
    // existing consumers (resolveNotificationRoute, the OS notification the
    // user has already seen fire once, cancellation lists) keep working
    // unchanged; occurrences 2..N get a `#n` suffix (see
    // REMINDER_OCCURRENCE_HORIZON above for why -- they are the LT-05 fix).
    occurrences.forEach((occurrence, index) => {
      const identifier = index === 0 ? baseIdentifier : `${baseIdentifier}#${index + 1}`;

      const triggerDate = buildLocalTriggerDate(
        occurrence.reminderDate,
        preference.hour,
        preference.minute,
      );

      // Skip plans with invalid trigger times (e.g. NaN or out-of-range
      // hour/minute) rather than forwarding an Invalid Date to the
      // notification scheduler. An invalid time is invalid for every
      // occurrence, so this effectively skips the whole horizon -- correct,
      // since resolveDatesForReminder already validated the *dates*, and
      // isValidTimeOfDay only depends on the preference, not the occurrence.
      if (triggerDate === null) {
        return;
      }

      scheduledAny = true;
      plans.push({
        identifier,
        kind: preference.kind,
        content: buildReminderContent(preference.kind, 'cycle-event', locale),
        trigger: {
          type: 'date',
          date: triggerDate,
        },
      });
    });

    if (scheduledAny) {
      scheduledIdentifiers.add(baseIdentifier);
    }
  }

  return plans;
}
