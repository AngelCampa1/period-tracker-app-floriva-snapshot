/**
 * PROBE — adversarial tests for buildReminderCenterModel.
 *
 * Scope: edge cases NOT covered by the existing test files:
 *  - period-start/fertile-window reminders when there is NO prediction (no
 *    logs, no profile dates) — these rely on buildReminderPlans resolving an
 *    event date; without a usable prediction the plan may be absent, which
 *    must not inflate inactiveCount incorrectly.
 *  - cycle-event reminder where today IS the event day (daysBefore=0) —
 *    the reminder date equals the event date; off-by-one in the "advance
 *    past-due reminders" loop could skip a same-day trigger.
 *  - cycle-event reminder where the computed reminder date has already passed
 *    (today > reminderDate) — the loop must advance it; if it advances by
 *    cycleLengthDays instead of advancing the event first, the reminder date
 *    may land in the wrong cycle.
 *  - locale time formatting for the 'de', 'fr', 'ja', 'zh-Hans' locales —
 *    daily reminders must produce non-empty detail strings.
 *  - mixed enabled/disabled across all four kinds — counts must always sum to
 *    preferences.length with no pref vanishing from both buckets.
 *  - fertile-window reminder when today is inside the fertile window —
 *    the "advance" loop should still produce a future reminder.
 *  - period-start reminder where daysBefore puts the reminder BEFORE today
 *    but the event is after today — loop must advance correctly.
 *  - no-prediction path: profile without lastPeriodStartDate, no log entries,
 *    cycle-event pref — must not throw and totals must be consistent.
 */

import { buildReminderCenterModel } from '@/src/features/settings/buildReminderCenterModel';
import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLog(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'heavy'): DailyLogEntry {
  return { id: logDate, logDate, bleeding, symptoms: [] };
}

const BASE_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-03-28',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
  // LT-26: birth-control reminders only schedule when a method is on file;
  // several tests in this file exercise that reminder kind as enabled.
  birthControlMethod: 'pill',
};

const SPARSE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
  // No lastPeriodStartDate, no cycleLengthDays, no periodLengthDays
};

// ---------------------------------------------------------------------------
// 1. No-prediction path: sparse profile + no log entries + cycle-event pref
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – no usable history (sparse profile, empty logs)', () => {
  const prefs: ReminderPreference[] = [
    {
      kind: 'period-start',
      enabled: true,
      hour: 9,
      minute: 0,
      schedule: { cadence: 'cycle-event', daysBefore: 1 },
    },
  ];

  it('does not throw', () => {
    expect(() =>
      buildReminderCenterModel({
        todayIso: '2026-04-20',
        profile: SPARSE_PROFILE,
        logEntries: [],
        preferences: prefs,
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('active + inactive always equals preferences.length', () => {
    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: SPARSE_PROFILE,
      logEntries: [],
      preferences: prefs,
      locale: 'en',
    });

    expect(model.activeCount + model.inactiveCount).toBe(prefs.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Mixed enabled/disabled across all four kinds — counts must always sum
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – mixed enabled/disabled across all kinds', () => {
  it('activeCount + inactiveCount === preferences.length for every combination', () => {
    const allKinds: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 10,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 7,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      preferences: allKinds,
      locale: 'en',
    });

    expect(model.activeCount + model.inactiveCount).toBe(allKinds.length);
    expect(model.inactiveCount).toBe(2); // period-start + birth-control disabled
  });

  it('single disabled preference: activeCount=0, inactiveCount=1', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 10,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [],
      preferences: prefs,
      locale: 'en',
    });

    expect(model.activeCount).toBe(0);
    expect(model.inactiveCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. cycle-event reminder where daysBefore=0 (same-day trigger)
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – daysBefore=0 (same-day trigger)', () => {
  it('schedules the reminder on the event day itself', () => {
    // Next period start expected ~2026-04-25 (28d from 2026-03-28)
    // With daysBefore=0 the reminder date = event date
    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 0 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      preferences: prefs,
      locale: 'en',
    });

    // Must produce exactly one active plan (not silently dropped)
    expect(model.activeCount).toBe(1);
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].kind).toBe('period-start');
    // Detail must contain 'Apr 25' (the reminder day = event day)
    expect(model.rows[0].detail).toContain('Apr 25');
  });
});

// ---------------------------------------------------------------------------
// 4. cycle-event pref: reminder date already passed — must advance to future
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – reminder date already in the past (must advance)', () => {
  /**
   * Scenario: lastPeriodStartDate = 2026-03-28, cycleLength = 28.
   * nextPeriod = 2026-04-25. daysBefore = 7 → reminderDate = 2026-04-18.
   * today = 2026-04-20 → reminderDate (Apr 18) < today → loop must advance.
   * After advancing one cycle: eventDate = 2026-05-23, reminderDate = 2026-05-16.
   * The detail must reflect May, not April.
   */
  it('advances the reminder when computed date is before today', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 7 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      preferences: prefs,
      locale: 'en',
    });

    expect(model.activeCount).toBe(1);
    // Reminder must be in the future; detail should NOT contain a past April date
    // It should land in May (advanced one cycle)
    expect(model.rows[0].detail).toContain('May');
    expect(model.rows[0].detail).not.toContain('Apr 18');
  });
});

// ---------------------------------------------------------------------------
// 5. Fertile-window reminder when today is INSIDE the fertile window
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – fertile-window reminder when today is in the window', () => {
  /**
   * For a 28-day cycle starting 2026-03-28:
   *   nextPeriod = 2026-04-25
   *   fertileWindow = [2026-04-06, 2026-04-11]  (nextPeriod-19 to nextPeriod-14)
   *   today = 2026-04-08 is INSIDE the window.
   *   With daysBefore=2: reminderDate = 2026-04-04 < today.
   *   Loop must advance by one cycle → reminder in May.
   */
  it('advances to the next cycle when today is inside the fertile window', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 10,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-08',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      preferences: prefs,
      locale: 'en',
    });

    expect(model.activeCount).toBe(1);
    // Reminder must be in the future — detail should NOT be a past date
    const detail = model.rows[0]?.detail ?? '';
    // The reminder day should be in May (one cycle out from April fertile window)
    expect(detail).toContain('May');
  });
});

// ---------------------------------------------------------------------------
// 6. Locale time formatting — daily reminders must produce non-empty detail
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – daily reminder locale formatting', () => {
  const dailyPref: ReminderPreference = {
    kind: 'daily-log',
    enabled: true,
    hour: 14,
    minute: 30,
    schedule: { cadence: 'daily' },
  };

  const locales = ['de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'] as const;

  for (const locale of locales) {
    it(`produces a non-empty detail string for locale '${locale}'`, () => {
      const model = buildReminderCenterModel({
        todayIso: '2026-04-20',
        profile: BASE_PROFILE,
        logEntries: [],
        preferences: [dailyPref],
        locale,
      });

      expect(model.rows).toHaveLength(1);
      expect(model.rows[0].detail.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. cycle-event reminder with large daysBefore (reminder before cycle start)
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – daysBefore larger than cycle gap', () => {
  /**
   * daysBefore = 30 on a 28-day cycle: reminderDate = nextPeriod - 30 which
   * is 2 days BEFORE the previous cycle start. The advance loop must keep
   * bumping until reminderDate >= today.
   */
  it('does not crash and produces a consistent count when daysBefore > cycleLengthDays', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 30 },
      },
    ];

    expect(() => {
      const model = buildReminderCenterModel({
        todayIso: '2026-04-20',
        profile: BASE_PROFILE,
        logEntries: [makeLog('2026-03-28')],
        preferences: prefs,
        locale: 'en',
      });

      expect(model.activeCount + model.inactiveCount).toBe(prefs.length);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. Fertile-window reminder when no log entries exist (seed-only prediction)
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – fertile-window with onboarding-seed prediction only', () => {
  it('either schedules the plan OR counts the pref as inactive — never loses it', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 10,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [], // no logs — uses onboarding seed
      preferences: prefs,
      locale: 'en',
    });

    // Contract: every preference must appear in exactly one bucket
    expect(model.activeCount + model.inactiveCount).toBe(prefs.length);
  });
});

// ---------------------------------------------------------------------------
// 9. Exactly one pref of each kind, all enabled — rows order matches input
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – all four kinds enabled, order preserved', () => {
  it('rows appear in the same order as the preferences array', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 10,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
      { kind: 'daily-log', enabled: true, hour: 20, minute: 0, schedule: { cadence: 'daily' } },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 7,
        minute: 15,
        schedule: { cadence: 'daily' },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      preferences: prefs,
      locale: 'en',
    });

    const kinds = model.rows.map((r) => r.kind);
    expect(kinds).toEqual(['fertile-window', 'daily-log', 'period-start', 'birth-control']);
  });
});
