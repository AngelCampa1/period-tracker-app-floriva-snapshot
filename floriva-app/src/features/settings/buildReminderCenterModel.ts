import { buildReminderPlans, type ReminderPlan } from '@/src/lib/notifications/buildReminderPlans';
import { formatMonthDayLabel } from '@/src/lib/predictions/presentation';
import type {
  DailyLogEntry,
  ReminderPreference,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

type BuildReminderCenterModelOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  preferences: ReminderPreference[];
  locale: SupportedLocale;
};

export type ReminderCenterModel = {
  activeCount: number;
  inactiveCount: number;
  rows: {
    identifier: string;
    kind: ReminderPreference['kind'];
    detail: string;
  }[];
};

function formatReminderTime(date: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatPlanDetail(plan: ReminderPlan, locale: SupportedLocale) {
  if (plan.trigger.type === 'daily') {
    const date = new Date(2026, 0, 1, plan.trigger.hour, plan.trigger.minute, 0, 0);
    return formatReminderTime(date, locale);
  }

  const dateIso = formatLocalDateIso(plan.trigger.date);
  return `${formatMonthDayLabel(dateIso, locale)} · ${formatReminderTime(plan.trigger.date, locale)}`;
}

export function buildReminderCenterModel({
  todayIso,
  profile,
  logEntries,
  preferences,
  locale,
}: BuildReminderCenterModelOptions): ReminderCenterModel {
  const allPlans = buildReminderPlans({
    todayIso,
    profile,
    logEntries,
    preferences,
  });

  // LT-05: cycle-event kinds (period-start, fertile-window) now schedule a
  // horizon of REMINDER_OCCURRENCE_HORIZON future occurrences per
  // contributing preference (see buildReminderPlans.ts), identified as the
  // bare identifier (occurrence 1) plus `#2`, `#3`, ... suffixes. The
  // Reminder Center is a per-preference summary ("your period-start
  // reminder is on"), not a per-occurrence schedule dump, so it only
  // surfaces occurrence 1 -- the nearest upcoming instance -- per
  // preference. Daily-cadence kinds only ever produce the bare identifier,
  // so this filter is a no-op for them.
  const plans = allPlans.filter((plan) => !plan.identifier.includes('#'));

  // Count every preference that did not produce a scheduled plan as inactive.
  // This covers three cases:
  //  1. Explicitly disabled preferences (!preference.enabled).
  //  2. Enabled preferences with an invalid hour/minute (skipped by buildReminderPlans).
  //  3. Duplicate kinds: the second (and further) enabled preference for the same
  //     kind is silently deduped by buildReminderPlans because the Expo notification
  //     identifier would be overwritten. The UI must not lose track of these.
  //
  // Because buildReminderPlans emits exactly one occurrence-1 plan per
  // contributing preference, and each occurrence-1 plan identifier is
  // unique, the number of preferences that produced no plan is simply
  // preferences.length minus the number of (occurrence-1) scheduled plans.
  const inactiveCount = preferences.length - plans.length;

  return {
    activeCount: plans.length,
    inactiveCount,
    rows: plans.map((plan) => ({
      identifier: plan.identifier,
      kind: plan.kind,
      detail: formatPlanDetail(plan, locale),
    })),
  };
}
