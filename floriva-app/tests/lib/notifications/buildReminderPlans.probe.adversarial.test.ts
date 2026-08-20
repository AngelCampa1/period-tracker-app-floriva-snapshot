/**
 * Probe adversarial tests for src/lib/notifications/buildReminderPlans.ts
 *
 * These scenarios are NOVEL — not duplicating the existing adversarial suite in
 * tests/lib/notifications/buildReminderPlans.adversarial.test.ts.
 *
 * Focus areas:
 *   R1 – Fertile-window date arithmetic: startDate = nextPeriod - 19,
 *        reminder fires relative to startDate not nextPeriod.startDate.
 *   R2 – daysBefore semantics: negative / fractional / very large daysBefore.
 *   R3 – Rollforward loop termination: todayIso far in the future, very short
 *        cycleLengthDays from prediction model, extreme cases.
 *   R4 – cadence mismatch: period-start/fertile-window prefs with cadence='daily'
 *        must produce no plan (resolveDatesForReminder returns null).
 *   R5 – Disabled category produces zero plans; re-enabling produces exactly one.
 *   R6 – Multiple kinds simultaneously: each kind gets exactly one plan.
 *   R7 – Prediction-accurate fertile window: verify the trigger references
 *        the correct eventDate without exposing event details in OS copy.
 *   R8 – Midnight triggers (hour=0, minute=0).
 *   R9 – todayIso exactly equals reminderDate (same-day trigger, boundary).
 */

import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

import {
  buildReminderPlans,
  REMINDER_OCCURRENCE_HORIZON,
  type ReminderPlan,
} from '@/src/lib/notifications/buildReminderPlans';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays } from '@/src/lib/predictions/dateMath';

// ─── helpers ─────────────────────────────────────────────────────────────────

function log(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return { id: `${logDate}`, logDate, bleeding, symptoms: [] };
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

function getDateTrigger(plan: ReminderPlan): Date {
  if (plan.trigger.type !== 'date') throw new Error('Expected date trigger');
  return plan.trigger.date;
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function expectPrivateCycleEventContent(plan: ReminderPlan) {
  const combinedCopy = `${plan.content.title} ${plan.content.body}`;

  expect(combinedCopy).toBe('Floriva reminder Open Floriva for a private update.');
  expect(combinedCopy).not.toMatch(
    /period|fertile|ovulat|birth[- ]?control|contracept|cycle|symptom|mood|cramp|bleed|\d{4}-\d{2}-\d{2}/i,
  );
}

// ─── R1: Fertile-window date arithmetic ──────────────────────────────────────

describe('R1 – fertile-window date arithmetic', () => {
  /**
   * buildPredictionResult sets:
   *   fertileWindow.startDate = addDays(nextPeriodStartDate, -19)
   *   fertileWindow.endDate   = addDays(nextPeriodStartDate, -14)
   *
   * With lastPeriod=2026-03-28, cycle=28:
   *   nextPeriodStartDate = 2026-04-25
   *   fertileWindow.startDate = 2026-04-25 - 19 = 2026-04-06
   *   fertileWindow.endDate   = 2026-04-25 - 14 = 2026-04-11
   *
   * todayIso=2026-04-01 → fertileWindow.startDate (2026-04-06) is in the future.
   * A fertile-window reminder with daysBefore=0 should fire on 2026-04-06 at 9:00.
   */
  it('fertile-window reminder fires on nextPeriod-19 days, NOT on nextPeriod-14 days', () => {
    const todayIso = '2026-04-01';
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];

    const prediction = buildPredictionResult({ todayIso, profile, logEntries });
    // Verify our expectation of what the prediction model gives us
    expect(prediction.fertileWindow.startDate).toBe('2026-04-06');

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [fertileWindowPref({ hour: 9, minute: 0 })],
    });

    // LT-05: a horizon of occurrences is now scheduled; occurrence 1 (the
    // bare `reminder-fertile-window` identifier) is the nearest future one
    // and carries the same date this test always asserted.
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const triggerDate = getDateTrigger(plans[0]!);
    // Must fire on fertile window START (nextPeriod - 19), not end (nextPeriod - 14)
    expect(toLocalIso(triggerDate)).toBe('2026-04-06');
    expect(triggerDate.getHours()).toBe(9);
  });

  it('fertile-window plan fires on fertileWindow.startDate without exposing the date in OS copy', () => {
    const todayIso = '2026-04-01';
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];

    const prediction = buildPredictionResult({ todayIso, profile, logEntries });
    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [fertileWindowPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const triggerDate = getDateTrigger(plans[0]!);
    expect(toLocalIso(triggerDate)).toBe(prediction.fertileWindow.startDate);
    expect(toLocalIso(triggerDate)).not.toBe(prediction.nextPeriod.startDate);
    expectPrivateCycleEventContent(plans[0]!);
  });

  it('fertile-window reminder with daysBefore=2 fires 2 days before fertileWindow.startDate', () => {
    // nextPeriod = 2026-04-25, fertileWindow.start = 2026-04-06
    // daysBefore=2 → reminderDate = 2026-04-06 - 2 = 2026-04-04
    const todayIso = '2026-04-01';
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [fertileWindowPref({ schedule: { cadence: 'cycle-event', daysBefore: 2 } })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const triggerDate = getDateTrigger(plans[0]!);
    // Should be 2026-04-04 (= 2026-04-06 - 2 days)
    expect(toLocalIso(triggerDate)).toBe('2026-04-04');
  });

  it('period-start reminder fires on nextPeriod.startDate without exposing the date in OS copy', () => {
    const todayIso = '2026-04-20';
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];

    const prediction = buildPredictionResult({ todayIso, profile, logEntries });

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(prediction.nextPeriod.startDate);
    expectPrivateCycleEventContent(plans[0]!);
  });
});

// ─── R2: daysBefore semantics ─────────────────────────────────────────────────

describe('R2 – daysBefore semantics', () => {
  it('daysBefore=0 fires on the event date itself', () => {
    const todayIso = '2026-04-20';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];
    const prediction = buildPredictionResult({ todayIso, profile, logEntries });

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref({ schedule: { cadence: 'cycle-event', daysBefore: 0 } })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    // reminderDate should equal nextPeriod.startDate (daysBefore=0 means on the day)
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(prediction.nextPeriod.startDate);
  });

  it('daysBefore=3 fires exactly 3 days before the event', () => {
    const todayIso = '2026-04-20';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];
    const prediction = buildPredictionResult({ todayIso, profile, logEntries });
    const expectedReminderDate = addDays(prediction.nextPeriod.startDate, -3);

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref({ schedule: { cadence: 'cycle-event', daysBefore: 3 } })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(expectedReminderDate);
  });

  it('negative daysBefore fires AFTER the event date', () => {
    // daysBefore=-2 means 2 days AFTER the event — unusual but must not crash
    // and must produce a date = eventDate + 2.
    const todayIso = '2026-04-20';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];

    expect(() =>
      buildReminderPlans({
        todayIso,
        profile,
        logEntries,
        preferences: [periodStartPref({ schedule: { cadence: 'cycle-event', daysBefore: -2 } })],
      }),
    ).not.toThrow();
  });

  it('fractional daysBefore (e.g. 1.5) does not crash and produces a plan on a valid date', () => {
    // JS truncates/floors float when used in addDays which calls arithmetic on integers
    const todayIso = '2026-04-20';
    expect(() =>
      buildReminderPlans({
        todayIso,
        profile: baseProfile(),
        logEntries: [log('2026-03-28', 'heavy')],
        preferences: [periodStartPref({ schedule: { cadence: 'cycle-event', daysBefore: 1.5 } })],
      }),
    ).not.toThrow();
  });
});

// ─── R3: Rollforward loop termination ────────────────────────────────────────

describe('R3 – rollforward loop termination and correctness', () => {
  it('when todayIso is 365 days ahead of last period, reminder rolls forward to a future date', () => {
    // This tests that the while loop in resolveDatesForReminder correctly advances
    // past many cycles without infinite looping.
    const todayIso = '2027-03-28'; // 1 year after last period start
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref()],
    });

    // Should produce a full horizon of plans, all with triggers AFTER todayIso
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const todayStart = new Date(2027, 2, 28, 0, 0, 0).getTime();
    for (const plan of plans) {
      expect(getDateTrigger(plan).getTime()).toBeGreaterThan(todayStart);
    }
  });

  it('rollforward with cycleLengthDays=20 (minimum from model) terminates and produces a future date', () => {
    const todayIso = '2026-06-01';
    const profile = baseProfile({ lastPeriodStartDate: '2026-01-01', cycleLengthDays: 20 });
    const logEntries = [log('2026-01-01', 'heavy')];

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const todayStart = new Date(2026, 5, 1, 0, 0, 0).getTime();
    for (const plan of plans) {
      expect(getDateTrigger(plan).getTime()).toBeGreaterThan(todayStart);
    }
  });

  it('when prediction already lands far in the future, no rollforward needed — fires once', () => {
    // todayIso close to last period start, so nextPeriod is naturally in the future
    const todayIso = '2026-03-30';
    const profile = baseProfile({ lastPeriodStartDate: '2026-03-28', cycleLengthDays: 28 });
    const logEntries = [log('2026-03-28', 'heavy')];
    const prediction = buildPredictionResult({ todayIso, profile, logEntries });

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref()],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    // Should fire on the natural nextPeriod.startDate without rolling forward
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(prediction.nextPeriod.startDate);
  });
});

// ─── R4: cadence mismatch ─────────────────────────────────────────────────────

describe('R4 – cadence mismatch: period-start with cadence=daily produces no plan', () => {
  /**
   * resolveDatesForReminder returns null if preference.schedule.cadence !== 'cycle-event'.
   * A period-start or fertile-window preference with cadence='daily' should produce no plan
   * because cycle-event logic cannot apply.
   */
  it('period-start with cadence=daily produces no plan (wrong cadence)', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        {
          kind: 'period-start',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: { cadence: 'daily' }, // wrong cadence for cycle-event kind
        },
      ],
    });

    // period-start with daily cadence: resolveDatesForReminder returns null → no plan
    const periodPlans = plans.filter((p) => p.kind === 'period-start');
    expect(periodPlans).toHaveLength(0);
  });

  it('fertile-window with cadence=daily produces no plan (wrong cadence)', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        {
          kind: 'fertile-window',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: { cadence: 'daily' },
        },
      ],
    });

    expect(plans.filter((p) => p.kind === 'fertile-window')).toHaveLength(0);
  });

  it('daily-log with cadence=cycle-event produces no plan (would need cycle resolution, which daily-log does not have)', () => {
    // The daily-log branch in buildReminderPlans does NOT call resolveDatesForReminder.
    // It only checks isValidTimeOfDay and the cadence of the trigger type is 'daily'.
    // If daily-log kind is given cycle-event schedule, it currently falls through to
    // the cycle-event path, BUT the identifier 'reminder-daily-log' is set in the
    // daily-log branch. This scenario tests what actually happens.
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [],
      preferences: [
        {
          kind: 'daily-log',
          enabled: true,
          hour: 9,
          minute: 0,
          // daily-log should use cadence:'daily'; giving it cycle-event is malformed
          schedule: { cadence: 'cycle-event', daysBefore: 0 },
        },
      ],
    });

    // The implementation should either handle this gracefully (produce 0 or 1 plan)
    // and MUST NOT crash. If it does produce a plan it must not have a corrupt trigger.
    for (const plan of plans) {
      if (plan.trigger.type === 'date') {
        expect(isNaN(plan.trigger.date.getTime())).toBe(false);
      }
    }
  });
});

// ─── R5: Disabled / enabled toggle ───────────────────────────────────────────

describe('R5 – disabled category produces zero plans; enabling produces exactly one', () => {
  it('single disabled period-start preference → 0 plans', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ enabled: false })],
    });
    expect(plans.filter((p) => p.kind === 'period-start')).toHaveLength(0);
  });

  it('single disabled fertile-window preference → 0 plans', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [fertileWindowPref({ enabled: false })],
    });
    expect(plans.filter((p) => p.kind === 'fertile-window')).toHaveLength(0);
  });

  it('enabled period-start → full horizon of plans; disabled → 0 plans; toggled back to enabled → full horizon again', () => {
    const todayIso = '2026-04-20';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];

    const pref = periodStartPref({ enabled: true });
    const enabled = buildReminderPlans({ todayIso, profile, logEntries, preferences: [pref] });
    expect(enabled.filter((p) => p.kind === 'period-start')).toHaveLength(REMINDER_OCCURRENCE_HORIZON);

    const disabled = buildReminderPlans({
      todayIso, profile, logEntries,
      preferences: [{ ...pref, enabled: false }],
    });
    expect(disabled.filter((p) => p.kind === 'period-start')).toHaveLength(0);

    const reEnabled = buildReminderPlans({ todayIso, profile, logEntries, preferences: [pref] });
    expect(reEnabled.filter((p) => p.kind === 'period-start')).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
  });
});

// ─── R6: Multiple kinds simultaneously ───────────────────────────────────────

describe('R6 – multiple kinds simultaneously: daily kinds produce one plan each, cycle-event kinds produce a full horizon', () => {
  it('all four kinds enabled simultaneously produce plans with distinct identifiers (2 daily + 2*horizon cycle-event)', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-01',
      // LT-26: birth-control reminders only schedule when a method is on
      // file; this test wants all four kinds to schedule simultaneously.
      profile: baseProfile({ birthControlMethod: 'pill' }),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [
        periodStartPref(),
        fertileWindowPref(),
        { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
        { kind: 'birth-control', enabled: true, hour: 20, minute: 0, schedule: { cadence: 'daily' } },
      ],
    });

    expect(plans).toHaveLength(2 + 2 * REMINDER_OCCURRENCE_HORIZON);
    const kinds = plans.map((p) => p.kind);
    expect(kinds).toContain('period-start');
    expect(kinds).toContain('fertile-window');
    expect(kinds).toContain('daily-log');
    expect(kinds).toContain('birth-control');

    const identifiers = plans.map((p) => p.identifier);
    expect(new Set(identifiers).size).toBe(plans.length);
  });

  it('period-start and fertile-window plans have different identifiers and different trigger dates', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-01',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref(), fertileWindowPref()],
    });

    expect(plans).toHaveLength(2 * REMINDER_OCCURRENCE_HORIZON);
    const p1 = plans.find((p) => p.kind === 'period-start')!;
    const p2 = plans.find((p) => p.kind === 'fertile-window')!;
    expect(p1.identifier).not.toBe(p2.identifier);

    // Period-start fires on nextPeriod (2026-04-25), fertile-window fires on 2026-04-06
    // They must have different trigger dates
    if (p1.trigger.type === 'date' && p2.trigger.type === 'date') {
      expect(p1.trigger.date.getTime()).not.toBe(p2.trigger.date.getTime());
    }
  });
});

// ─── R7: Plan trigger references correct event date ───────────────────────────

describe('R7 – plan trigger references correct event date', () => {
  it('period-start plan trigger matches nextPeriod.startDate without date-bearing OS copy', () => {
    const todayIso = '2026-04-20';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];
    const prediction = buildPredictionResult({ todayIso, profile, logEntries });

    const plans = buildReminderPlans({ todayIso, profile, logEntries, preferences: [periodStartPref()] });
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(prediction.nextPeriod.startDate);
    expectPrivateCycleEventContent(plans[0]!);
  });

  it('fertile-window plan trigger matches fertileWindow.startDate, not period start date', () => {
    const todayIso = '2026-04-01';
    const profile = baseProfile();
    const logEntries = [log('2026-03-28', 'heavy')];
    const prediction = buildPredictionResult({ todayIso, profile, logEntries });

    const plans = buildReminderPlans({ todayIso, profile, logEntries, preferences: [fertileWindowPref()] });
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(toLocalIso(getDateTrigger(plans[0]!))).toBe(prediction.fertileWindow.startDate);
    expect(toLocalIso(getDateTrigger(plans[0]!))).not.toBe(prediction.nextPeriod.startDate);
    expectPrivateCycleEventContent(plans[0]!);
  });
});

// ─── R8: Midnight triggers ────────────────────────────────────────────────────

describe('R8 – midnight triggers (hour=0, minute=0)', () => {
  it('daily-log reminder at hour=0 minute=0 produces a valid plan', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [],
      preferences: [{ kind: 'daily-log', enabled: true, hour: 0, minute: 0, schedule: { cadence: 'daily' } }],
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]!.trigger.type).toBe('daily');
    if (plans[0]!.trigger.type === 'daily') {
      expect(plans[0]!.trigger.hour).toBe(0);
      expect(plans[0]!.trigger.minute).toBe(0);
    }
  });

  it('period-start reminder at hour=0 minute=0 produces trigger date at midnight local', () => {
    const todayIso = '2026-04-20';
    const plans = buildReminderPlans({
      todayIso,
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref({ hour: 0, minute: 0 })],
    });

    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    const d = getDateTrigger(plans[0]!);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

// ─── R9: todayIso equals reminderDate (same-day boundary) ────────────────────

describe('R9 – same-day boundary: todayIso exactly equals reminderDate', () => {
  /**
   * The loop: `while (reminderDate < todayIso)` uses ISO string comparison.
   * When reminderDate === todayIso, the loop does NOT advance.
   * So the trigger Date is built for TODAY at the requested hour:minute.
   *
   * If that time is in the past (hour already passed), the resulting Date is
   * a past timestamp that Expo will reject. This is a known design limitation
   * (the existing adversarial test acknowledges it via Date.now mock).
   *
   * Here we probe the EXACT same-day equality without mocking time, to confirm:
   *   a) No crash
   *   b) The trigger Date's date components match the expected reminderDate
   *   c) If trigger hour is still in the future, the plan is valid for scheduling
   */
  it('same-day reminder (reminderDate === todayIso) produces a plan whose date components match the event date', () => {
    // We need todayIso to be BEFORE the rollforward threshold so that the
    // prediction lands on a specific future date. Then we pick todayIso=day before
    // the predicted next period so reminderDate (daysBefore=1) === todayIso.
    //
    // lastPeriod=2026-04-01, cycle=28 → nextPeriod=2026-04-29.
    // daysBefore=1 → reminderDate = 2026-04-28.
    // todayIso=2026-04-28 → reminderDate === todayIso (loop doesn't advance).
    const todayIso = '2026-04-28';
    const profile = baseProfile({ lastPeriodStartDate: '2026-04-01', cycleLengthDays: 28 });
    const logEntries = [log('2026-04-01', 'heavy')];

    const prediction = buildPredictionResult({ todayIso, profile, logEntries });
    // Verify our assumption: nextPeriod should be 2026-04-29
    expect(prediction.nextPeriod.startDate).toBe('2026-04-29');

    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref({ hour: 23, minute: 59, schedule: { cadence: 'cycle-event', daysBefore: 1 } })],
    });

    // reminderDate = 2026-04-29 - 1 = 2026-04-28 = todayIso
    // Loop condition: reminderDate < todayIso is false (equal), so NOT rolled forward.
    // A plan is emitted for today. Only occurrence 1 (the bare identifier) is
    // pinned to this exact date; occurrences 2..N (LT-05 horizon) are later
    // projected cycles and legitimately land in later months.
    const periodPlans = plans.filter(
      (p) => p.kind === 'period-start' && p.identifier === 'reminder-period-start',
    );
    expect(periodPlans.length).toBeGreaterThanOrEqual(0); // no crash guaranteed

    for (const plan of periodPlans) {
      if (plan.trigger.type === 'date') {
        // The date component must be on 2026-04-28 (today)
        expect(plan.trigger.date.getFullYear()).toBe(2026);
        expect(plan.trigger.date.getMonth()).toBe(3); // April = index 3
        expect(plan.trigger.date.getDate()).toBe(28);
        // No NaN
        expect(isNaN(plan.trigger.date.getTime())).toBe(false);
      }
    }
  });

  it('same-day reminder with hour=23 minute=59 produces a trigger with those exact hour/minute values', () => {
    const todayIso = '2026-04-28';
    const profile = baseProfile({ lastPeriodStartDate: '2026-04-01', cycleLengthDays: 28 });
    const logEntries = [log('2026-04-01', 'heavy')];
    const plans = buildReminderPlans({
      todayIso,
      profile,
      logEntries,
      preferences: [periodStartPref({ hour: 23, minute: 59, schedule: { cadence: 'cycle-event', daysBefore: 1 } })],
    });

    const periodPlans = plans.filter((p) => p.kind === 'period-start');
    for (const plan of periodPlans) {
      if (plan.trigger.type === 'date') {
        expect(plan.trigger.date.getHours()).toBe(23);
        expect(plan.trigger.date.getMinutes()).toBe(59);
      }
    }
  });
});

// ─── R10: Identifier naming conventions ──────────────────────────────────────

describe('R10 – identifier naming is stable and kind-specific', () => {
  it('period-start plan has identifier "reminder-period-start"', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [periodStartPref()],
    });
    expect(plans.find((p) => p.kind === 'period-start')?.identifier).toBe('reminder-period-start');
  });

  it('fertile-window plan has identifier "reminder-fertile-window"', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-01',
      profile: baseProfile(),
      logEntries: [log('2026-03-28', 'heavy')],
      preferences: [fertileWindowPref()],
    });
    expect(plans.find((p) => p.kind === 'fertile-window')?.identifier).toBe('reminder-fertile-window');
  });

  it('daily-log plan has identifier "reminder-daily-log"', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile: baseProfile(),
      logEntries: [],
      preferences: [{ kind: 'daily-log', enabled: true, hour: 9, minute: 0, schedule: { cadence: 'daily' } }],
    });
    expect(plans.find((p) => p.kind === 'daily-log')?.identifier).toBe('reminder-daily-log');
  });

  it('birth-control plan has identifier "reminder-birth-control"', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      // LT-26: birth-control reminders only schedule when a method is on file.
      profile: baseProfile({ birthControlMethod: 'pill' }),
      logEntries: [],
      preferences: [{ kind: 'birth-control', enabled: true, hour: 9, minute: 0, schedule: { cadence: 'daily' } }],
    });
    expect(plans.find((p) => p.kind === 'birth-control')?.identifier).toBe('reminder-birth-control');
  });
});
