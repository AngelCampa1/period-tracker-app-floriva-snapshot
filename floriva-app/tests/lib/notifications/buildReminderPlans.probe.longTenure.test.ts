/**
 * Long-tenure probes for reminder planning (workstream E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment; resolution probes pin behavior that already holds. Deterministic
 * except where noted (the DST probe asserts timezone-robust invariants).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import {
  buildReminderPlans,
  REMINDER_OCCURRENCE_HORIZON,
  type ReminderPlan,
} from '@/src/lib/notifications/buildReminderPlans';
import type { ReminderPreference } from '@/src/types/domain';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';

const TODAY = '2026-07-06';

function getDateTrigger(plan: ReminderPlan): Date {
  if (plan.trigger.type !== 'date') throw new Error('Expected date trigger');
  return plan.trigger.date;
}

function toLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cycleEventPref(
  kind: 'period-start' | 'fertile-window',
  overrides: Partial<ReminderPreference> = {},
): ReminderPreference {
  return {
    kind,
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: { cadence: 'cycle-event', daysBefore: 0 },
    ...overrides,
  };
}

describe('RESOLVED LT-05 — cycle-event reminders pre-schedule a horizon of future occurrences, so a lapsed user is nudged across multiple cycles before silence', () => {
  it('the lapsed dataset yields REMINDER_OCCURRENCE_HORIZON date-triggered plans per cycle-event kind, strictly increasing and all in the future', () => {
    const dataset = buildTenureDataset('tenure-lapsed', TODAY);
    const plans = buildReminderPlans({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      preferences: dataset.reminderPreferences,
    });

    const datePlans = plans.filter((plan) => plan.trigger.type === 'date');
    const periodStartPlans = datePlans.filter((plan) => plan.kind === 'period-start');
    const fertileWindowPlans = datePlans.filter((plan) => plan.kind === 'fertile-window');

    // FIXED: a lapsed user (one who never reopens the app to trigger a
    // reconcile) is now nudged across REMINDER_OCCURRENCE_HORIZON future
    // cycles per cycle-event kind, not just one. Each occurrence after the
    // first carries a `#n` suffixed identifier (see buildReminderPlans.ts);
    // resolveNotificationRoute and the daily-log/period-start quick-log
    // category attachment both tolerate the suffix (see their own tests).
    expect(periodStartPlans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(fertileWindowPlans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(datePlans).toHaveLength(REMINDER_OCCURRENCE_HORIZON * 2);

    for (const occurrences of [periodStartPlans, fertileWindowPlans]) {
      const dates = occurrences.map((plan) => toLocalIso(getDateTrigger(plan)));
      for (const date of dates) {
        expect(date >= TODAY).toBe(true);
      }
      // Strictly increasing: each occurrence is a later projected cycle than
      // the last, never a duplicate or out-of-order date.
      for (let i = 1; i < dates.length; i += 1) {
        expect(dates[i]! > dates[i - 1]!).toBe(true);
      }
    }

    // First occurrence keeps the bare identifier (back-compat with routing
    // and the OS notification the user has already seen fire once);
    // occurrences 2..N are suffixed.
    expect(periodStartPlans[0]!.identifier).toBe('reminder-period-start');
    expect(periodStartPlans[1]!.identifier).toBe('reminder-period-start#2');
    expect(fertileWindowPlans[0]!.identifier).toBe('reminder-fertile-window');
    expect(fertileWindowPlans[1]!.identifier).toBe('reminder-fertile-window#2');
  });
});

describe('RESOLVED — daysBefore larger than the cycle length terminates and lands in the future', () => {
  it('daysBefore=45 with a 27-day cycle produces one plan with a future trigger', () => {
    const dataset = buildTenureDataset('tenure-3mo-regular', TODAY);
    const plans = buildReminderPlans({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      preferences: [
        cycleEventPref('period-start', {
          schedule: { cadence: 'cycle-event', daysBefore: 45 },
        }),
      ],
    });

    // Original suspect: the roll-forward loop could mis-handle
    // daysBefore > cycleLength. It advances reminder and event dates in
    // lockstep by whole cycles and terminates promptly. LT-05 now schedules
    // a full horizon of occurrences rather than one.
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(toLocalIso(getDateTrigger(plans[0]!)) >= TODAY).toBe(true);
  });

  it('an extreme daysBefore (400) still terminates with a valid future trigger', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);
    const plans = buildReminderPlans({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      preferences: [
        cycleEventPref('period-start', {
          schedule: { cadence: 'cycle-event', daysBefore: 400 },
        }),
      ],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const trigger = getDateTrigger(plans[0]!);
    expect(Number.isNaN(trigger.getTime())).toBe(false);
    expect(toLocalIso(trigger) >= TODAY).toBe(true);
  });
});

describe('DOCUMENTED LT-12 — DST spring-forward: a trigger inside the skipped hour normalizes forward within the same day', () => {
  it('a 02:30 local trigger on 2026-03-08 keeps its calendar day; the hour may shift to 03:30 in DST zones', () => {
    // buildLocalTriggerDate constructs `new Date(y, m, d, hour, minute)`. In
    // US timezones 02:00–03:00 does not exist on 2026-03-08; JS engines
    // normalize the wall-clock time forward (02:30 -> 03:30) WITHOUT
    // changing the calendar day. Current behavior: the reminder silently
    // fires up to an hour later than configured on that one day — accepted,
    // documented; no day skip and no invalid Date.
    //
    // Assertions are timezone-robust: in zones without a transition at this
    // instant the hour stays 2; in transitioning zones it becomes 3.
    const trigger = new Date(2026, 2, 8, 2, 30, 0, 0);

    expect(trigger.getFullYear()).toBe(2026);
    expect(trigger.getMonth()).toBe(2);
    expect(trigger.getDate()).toBe(8);
    expect([2, 3]).toContain(trigger.getHours());
    expect(Number.isNaN(trigger.getTime())).toBe(false);
  });

  it('a period-start reminder whose computed date falls on the DST day produces a valid same-day trigger', () => {
    // Anchor a 28-day cycle so nextPeriod lands exactly on 2026-03-08, with
    // an early-hour preference that sits inside the skipped DST hour.
    const plans = buildReminderPlans({
      todayIso: '2026-03-01',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-02-08',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [
        { id: '2026-02-08', logDate: '2026-02-08', bleeding: 'heavy', symptoms: [] },
      ],
      preferences: [cycleEventPref('period-start', { hour: 2, minute: 30 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const trigger = getDateTrigger(plans[0]!);
    expect(toLocalIso(trigger)).toBe('2026-03-08');
    expect([2, 3]).toContain(trigger.getHours());
  });
});

describe('RESOLVED LT-26 — a birth-control reminder cannot outlive its method: no method selected means no scheduled reminder, regardless of the stored enabled flag', () => {
  it('the tenure-12mo-irregular fixture has no birthControlMethod and its birth-control reminder preference is disabled (fixture fixed: this combination is not a reachable app state)', () => {
    // Originally the shared enabledReminderPreferences() fixture helper
    // enabled every reminder kind unconditionally, including birth-control,
    // regardless of whether the profile had a method -- an unreachable
    // combination no real user flow can produce (SettingsScreen.tsx's
    // persistBirthControlMethod turns the reminder off the moment its
    // method is cleared). Fixed at the fixture level in tenureFixtures.ts:
    // enabledReminderPreferences() now only enables birth-control when the
    // caller says the profile has a method (tenure-12mo-regular is the only
    // variant that does).
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY);
    const birthControlPreference = dataset.reminderPreferences.find(
      (reminder) => reminder.kind === 'birth-control',
    );

    expect(dataset.profile.birthControlMethod).toBeUndefined();
    expect(birthControlPreference?.enabled).toBe(false);
  });

  it('buildReminderPlans schedules no birth-control plan when a preference is enabled but the profile has no method, regardless of the stored enabled flag', () => {
    // Demonstrated with synthetic data (rather than a tenure fixture) since
    // no fixture variant encodes this combination anymore -- it is exactly
    // the orphaned-data shape LT-26 guards against at the production-code
    // level (a restored backup, or any future mutation path other than
    // SettingsScreen's own clear-method flow, could still produce it).
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY);
    const orphanedPreferences = dataset.reminderPreferences.map((reminder) =>
      reminder.kind === 'birth-control' ? { ...reminder, enabled: true } : reminder,
    );

    const plans = buildReminderPlans({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      preferences: orphanedPreferences,
    });

    expect(plans.filter((plan) => plan.kind === 'birth-control')).toHaveLength(0);
  });

  it('a profile WITH a method still gets its enabled birth-control reminder scheduled (the guard is method-presence, not a blanket suppression)', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);
    const plans = buildReminderPlans({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      preferences: dataset.reminderPreferences,
    });

    expect(dataset.profile.birthControlMethod).toBe('pill');
    expect(plans.filter((plan) => plan.kind === 'birth-control')).toHaveLength(1);
  });
});
