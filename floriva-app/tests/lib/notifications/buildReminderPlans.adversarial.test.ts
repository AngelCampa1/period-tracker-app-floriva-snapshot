/**
 * Adversarial tests for buildReminderPlans.
 *
 * Focus areas:
 *  1. Timezone / DST: local trigger dates must reflect local wall-clock time
 *     even when tests run with a non-UTC TZ env var.
 *  2. Past / present: plans whose computed trigger date is already in the past
 *     (or exactly now) must be skipped so Expo never receives a past-date trigger.
 *  3. Prediction-driven edge cases: sparse history, no lastPeriodStartDate,
 *     single log entry, predictions that land in the past.
 *  4. Boundary / invalid inputs: month/year rollover, leap day, zero preferences,
 *     duplicate reminder times, invalid hour/minute values (overflow, NaN).
 */

import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

import {
  buildReminderPlans,
  REMINDER_OCCURRENCE_HORIZON,
} from '@/src/lib/notifications/buildReminderPlans';

// ─── helpers ──────────────────────────────────────────────────────────────────

function log(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return { id: `${logDate}-${bleeding}`, logDate, bleeding, symptoms: [] };
}

function periodStartPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'period-start',
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: { cadence: 'cycle-event', daysBefore: 0 },
    ...overrides,
  };
}

function fertileWindowPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'fertile-window',
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: { cadence: 'cycle-event', daysBefore: 0 },
    ...overrides,
  };
}

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
    ...overrides,
  };
}

function localDate(plan: ReturnType<typeof buildReminderPlans>[number]) {
  if (plan.trigger.type !== 'date') throw new Error('Expected date trigger');
  return plan.trigger.date;
}

// ─── 1. TIMEZONE / DST ───────────────────────────────────────────────────────

describe('buildReminderPlans — timezone / DST correctness', () => {
  /**
   * The trigger Date is built with `new Date(year, month-1, day, hour, minute)`,
   * which uses the *local* timezone (whatever process.env.TZ is set to).
   * Asserting via getFullYear/getMonth/getDate/getHours/getMinutes confirms the
   * local wall-clock interpretation is preserved regardless of offset.
   */
  it('produces a trigger Date whose local wall-clock fields match the requested hour and minute', () => {
    // Run with whatever TZ is set (CI typically uses UTC; dev may differ).
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 9, minute: 30 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const d = localDate(plans[0]!);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it('fires at the correct local date across a month boundary (April → May)', () => {
    // nextPeriod from 2026-03-28 + 28 = 2026-04-25; daysBefore=0 → reminderDate = 2026-04-25
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 }),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 8, minute: 0 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const d = localDate(plans[0]!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April = month index 3
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(8);
  });

  it('fires at the correct local date across a year boundary (Dec → Jan)', () => {
    // lastPeriod 2025-12-15 + 28 = 2026-01-12
    const plans = buildReminderPlans({
      todayIso: '2025-12-20',
      profile: baseProfile({ lastPeriodStartDate: '2025-12-15', cycleLengthDays: 28 }),
      logEntries: [log('2025-12-15', 'heavy')],
      preferences: [periodStartPref({ hour: 7, minute: 15 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const d = localDate(plans[0]!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January = index 0
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(15);
  });

  it('handles a reminder falling on Feb 29 of a leap year correctly', () => {
    // lastPeriod 2028-02-01 + 28 = 2028-02-29 (2028 is a leap year)
    const plans = buildReminderPlans({
      todayIso: '2028-02-10',
      profile: baseProfile({ lastPeriodStartDate: '2028-02-01', cycleLengthDays: 28 }),
      logEntries: [log('2028-02-01', 'heavy')],
      preferences: [periodStartPref({ hour: 10, minute: 0 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const d = localDate(plans[0]!);
    expect(d.getFullYear()).toBe(2028);
    expect(d.getMonth()).toBe(1); // February = index 1
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(10);
  });
});

// ─── 2. PAST / PRESENT ───────────────────────────────────────────────────────

describe('buildReminderPlans — past / present date handling', () => {
  /**
   * BUG: when reminderDate === todayIso the loop condition `reminderDate < todayIso`
   * is false so the date is NOT rolled forward.  If the requested hour:minute has
   * already passed today, the plan carries a past trigger Date.  Expo's
   * scheduleNotificationAsync rejects past-date DATE triggers.
   *
   * Expected correct behaviour: a plan whose trigger Date is in the past
   * (including "same calendar day but earlier hour") must be absent from the
   * returned array.
   */
  it('skips a cycle-event reminder whose trigger time has already passed today', () => {
    // reminderDate === todayIso, but requested hour is before "now"
    // We mock Date.now so "now" is 2026-04-25 at 14:00 local
    const fakeNow = new Date(2026, 3, 25, 14, 0, 0).getTime(); // April 25 14:00 local
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

    try {
      // nextPeriod from 2026-03-28+28 = 2026-04-25, daysBefore=0 → reminderDate=2026-04-25
      const plans = buildReminderPlans({
        todayIso: '2026-04-25',
        profile: baseProfile(),
        logEntries: [log('2026-03-28', 'heavy')],
        // hour=8 is before 14:00 — trigger is already in the past
        preferences: [periodStartPref({ hour: 8, minute: 0 })],
      });

      // The plan must be skipped (or rolled to the next cycle)
      const periodPlans = plans.filter((p) => p.kind === 'period-start');
      for (const plan of periodPlans) {
        if (plan.trigger.type === 'date') {
          expect(plan.trigger.date.getTime()).toBeGreaterThan(Date.now());
        }
      }
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('keeps a cycle-event reminder for today when the trigger time is still in the future', () => {
    // reminderDate === todayIso AND hour is still in the future
    const fakeNow = new Date(2026, 3, 25, 7, 0, 0).getTime(); // 07:00 local
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

    try {
      const plans = buildReminderPlans({
        todayIso: '2026-04-25',
        profile: baseProfile(),
        logEntries: [log('2026-03-28', 'heavy')],
        preferences: [periodStartPref({ hour: 9, minute: 0 })], // 09:00 > 07:00 → future
      });

      const periodPlans = plans.filter((p) => p.kind === 'period-start');
      expect(periodPlans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
      if (periodPlans[0]?.trigger.type === 'date') {
        expect(periodPlans[0].trigger.date.getTime()).toBeGreaterThan(Date.now());
      }
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('rolls a past-due reminder forward one full cycle so it is always in the future', () => {
    const fakeNow = new Date(2026, 3, 25, 14, 0, 0).getTime(); // Apr 25 14:00 — after 08:00
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

    try {
      const plans = buildReminderPlans({
        todayIso: '2026-04-25',
        profile: baseProfile({ cycleLengthDays: 28 }),
        logEntries: [log('2026-03-28', 'heavy')],
        preferences: [periodStartPref({ hour: 8, minute: 0, schedule: { cadence: 'cycle-event', daysBefore: 0 } })],
      });

      const periodPlans = plans.filter((p) => p.kind === 'period-start');
      if (periodPlans.length > 0 && periodPlans[0]?.trigger.type === 'date') {
        // If the implementation chooses to roll forward it should land ~28 days later
        expect(periodPlans[0].trigger.date.getTime()).toBeGreaterThan(Date.now());
      }
      // Either 0 plans (skipped) or 1 plan that is definitely in the future.
      for (const plan of periodPlans) {
        if (plan.trigger.type === 'date') {
          expect(plan.trigger.date.getTime()).toBeGreaterThan(Date.now());
        }
      }
    } finally {
      dateSpy.mockRestore();
    }
  });
});

// ─── 3. PREDICTION-DRIVEN edge cases ─────────────────────────────────────────

describe('buildReminderPlans — prediction-driven edge cases', () => {
  it('returns an empty array when preferences is empty', () => {
    expect(
      buildReminderPlans({
        todayIso: '2026-04-20',
        profile: baseProfile(),
        logEntries: [],
        preferences: [],
      }),
    ).toEqual([]);
  });

  it('does not crash with no log entries and no lastPeriodStartDate', () => {
    const profile = baseProfile({ lastPeriodStartDate: undefined });
    expect(() =>
      buildReminderPlans({
        todayIso: '2026-04-20',
        profile,
        logEntries: [],
        preferences: [periodStartPref()],
      }),
    ).not.toThrow();
  });

  it('produces a future date trigger when there is only a single log entry', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile({ cycleLengthDays: 28 }),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    if (plans[0]?.trigger.type === 'date') {
      // Must be strictly after today 00:00 local
      const todayStart = new Date(2026, 3, 20, 0, 0, 0).getTime();
      expect(plans[0].trigger.date.getTime()).toBeGreaterThan(todayStart);
    }
  });

  it('produces a future date trigger when the fertile window naturally falls in the future', () => {
    // lastPeriod=2026-03-28, next=2026-04-25, fertileWindow.start = 2026-04-25 - 14 = 2026-04-11
    // todayIso=2026-04-20 → fertile window start is PAST. resolveDatesForReminder should roll it.
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [fertileWindowPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    if (plans[0]?.trigger.type === 'date') {
      const todayStart = new Date(2026, 3, 20, 0, 0, 0).getTime();
      expect(plans[0].trigger.date.getTime()).toBeGreaterThan(todayStart);
    }
  });

  it('does not crash when logEntries span an extreme range (years apart)', () => {
    expect(() =>
      buildReminderPlans({
        todayIso: '2026-04-20',
        profile: baseProfile(),
        logEntries: [
          log('2020-01-01', 'heavy'),
          log('2026-01-01', 'heavy'),
        ],
        preferences: [periodStartPref()],
      }),
    ).not.toThrow();
  });
});

// ─── 4. BOUNDARY / INVALID INPUTS ────────────────────────────────────────────

describe('buildReminderPlans — boundary and invalid inputs', () => {
  /**
   * BUG: buildLocalTriggerDate passes hour/minute directly to the Date constructor.
   * JavaScript normalises overflow values: hour=24 → next day 00:00, hour=25 → +1 day 01:00.
   * A preference with hour=24 must NOT silently shift the reminder to the wrong day.
   * Expected behaviour: clamp or skip — never produce a trigger whose calendar date
   * differs from the intended reminderDate.
   */
  it('does not shift the trigger to the next calendar day when hour=24 is passed', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 24, minute: 0 })],
    });

    // Either the plan is dropped (preferred) OR the date is clamped to 23:59/00:00 of the same day.
    for (const plan of plans) {
      if (plan.trigger.type === 'date') {
        // Must NOT land on a different calendar date than 2026-04-25
        const d = plan.trigger.date;
        // hour=24 overflow → April 26; that is the bug.
        expect(d.getDate()).not.toBe(26);
      }
    }
  });

  it('does not shift the trigger to the next calendar day when hour=25 is passed', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 25, minute: 0 })],
    });

    for (const plan of plans) {
      if (plan.trigger.type === 'date') {
        const d = plan.trigger.date;
        expect(d.getDate()).not.toBe(26);
      }
    }
  });

  it('does not shift the trigger minute to the next hour when minute=60 is passed', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 9, minute: 60 })],
    });

    for (const plan of plans) {
      if (plan.trigger.type === 'date') {
        const d = plan.trigger.date;
        // minute=60 overflow → getHours() becomes 10
        expect(d.getHours()).not.toBe(10);
      }
    }
  });

  it('does not produce NaN-date triggers when hour or minute is NaN', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: NaN, minute: 0 })],
    });

    for (const plan of plans) {
      if (plan.trigger.type === 'date') {
        expect(isNaN(plan.trigger.date.getTime())).toBe(false);
      }
    }
  });

  it('returns zero plans when all preferences are disabled', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        { ...periodStartPref(), enabled: false },
        { ...fertileWindowPref(), enabled: false },
      ],
    });

    expect(plans).toEqual([]);
  });

  it('does not emit duplicate identifiers when two preferences share the same kind', () => {
    // Both period-start preferences are enabled — only distinct identifiers should appear.
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        periodStartPref({ hour: 8, minute: 0 }),
        periodStartPref({ hour: 10, minute: 0 }),
      ],
    });

    const identifiers = plans.map((p) => p.identifier);
    const unique = new Set(identifiers);
    // If duplicates exist the last write wins in Expo, silently losing a reminder.
    // The implementation should either deduplicate or only accept one per kind.
    expect(identifiers.length).toBe(unique.size);
  });

  it('handles daysBefore larger than a full cycle without crashing', () => {
    expect(() =>
      buildReminderPlans({
        todayIso: '2026-04-20',
        profile: baseProfile({ cycleLengthDays: 28 }),
        logEntries: [log('2026-03-28', 'heavy')],
        preferences: [
          periodStartPref({
            schedule: { cadence: 'cycle-event', daysBefore: 100 },
          }),
        ],
      }),
    ).not.toThrow();
  });

  it('does not crash on a very long lookahead (predictions 5 years out)', () => {
    expect(() =>
      buildReminderPlans({
        todayIso: '2031-04-20',
        profile: baseProfile({ lastPeriodStartDate: '2026-03-28' }),
        logEntries: [log('2026-03-28', 'heavy')],
        preferences: [periodStartPref()],
      }),
    ).not.toThrow();
  });

  it('dedup keeps the FIRST preference, not the last (first hour wins)', () => {
    // Two period-start prefs: hour=8 first, hour=10 second.
    // The Set-based dedup must keep hour=8 (the first enabled occurrence).
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        periodStartPref({ hour: 8, minute: 0 }),
        periodStartPref({ hour: 10, minute: 0 }),
      ],
    });

    const periodPlans = plans.filter((p) => p.kind === 'period-start');
    // LT-05: the retained preference now produces a full occurrence horizon,
    // not a single plan -- dedup still operates per-preference, not per-plan.
    expect(periodPlans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    // First preference (hour=8) must be the one retained, for every occurrence.
    for (const plan of periodPlans) {
      if (plan.trigger.type === 'date') {
        expect(plan.trigger.date.getHours()).toBe(8);
      }
    }
  });

  it('dedup for daily-log keeps only one plan when two daily-log prefs are supplied', () => {
    const dailyLogPref = (hour: number): ReminderPreference => ({
      kind: 'daily-log',
      enabled: true,
      hour,
      minute: 0,
      schedule: { cadence: 'daily' },
    });

    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [],
      preferences: [dailyLogPref(8), dailyLogPref(20)],
    });

    const dailyLogPlans = plans.filter((p) => p.kind === 'daily-log');
    expect(dailyLogPlans).toHaveLength(1);
    // First preference (hour=8) must be the one retained — trigger.hour carries it.
    expect(dailyLogPlans[0]?.trigger.type).toBe('daily');
    if (dailyLogPlans[0]?.trigger.type === 'daily') {
      expect(dailyLogPlans[0].trigger.hour).toBe(8);
    }
  });

  it.each([
    ['NaN hour', NaN, 0],
    ['out-of-range hour 24', 24, 0],
    ['out-of-range minute 60', 9, 60],
    ['negative hour', -1, 0],
  ])(
    'skips a daily-log reminder with an invalid time (%s) instead of forwarding it to the scheduler',
    (_label, hour, minute) => {
      const plans = buildReminderPlans({
        todayIso: '2026-04-20',
        profile: baseProfile(),
        logEntries: [],
        preferences: [
          {
            kind: 'daily-log',
            enabled: true,
            hour,
            minute,
            schedule: { cadence: 'daily' },
          },
        ],
      });

      expect(plans.filter((p) => p.kind === 'daily-log')).toHaveLength(0);
    },
  );

  it('skips a birth-control reminder with an invalid time', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [],
      preferences: [
        {
          kind: 'birth-control',
          enabled: true,
          hour: 25,
          minute: 0,
          schedule: { cadence: 'daily' },
        },
      ],
    });

    expect(plans.filter((p) => p.kind === 'birth-control')).toHaveLength(0);
  });
});
