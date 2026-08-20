/**
 * Adversarial tests for buildReminderCenterModel.
 *
 * Contract under test:
 *  - activeCount  = number of plans actually scheduled
 *  - inactiveCount = number of preferences that are disabled
 *  - Every enabled preference must appear in exactly one of those buckets;
 *    none may silently vanish from both.
 *  - detail strings must match the underlying preference data (time/date).
 *  - No crash on any input shape.
 */

import { buildReminderCenterModel } from '@/src/features/settings/buildReminderCenterModel';
import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

const BASE_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-03-28',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
  // LT-26: birth-control reminders only schedule when a method is on file;
  // several tests in this file exercise that reminder kind.
  birthControlMethod: 'pill',
};

const LOG_ENTRIES: DailyLogEntry[] = [
  { id: 'a', logDate: '2026-02-28', bleeding: 'medium', symptoms: [] },
  { id: 'b', logDate: '2026-03-28', bleeding: 'heavy', symptoms: [] },
];

const TODAY = '2026-04-20';

// ---------------------------------------------------------------------------
// Empty / minimal inputs
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – empty / minimal inputs', () => {
  it('returns zero counts and empty rows for an empty preferences array', () => {
    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: [],
      preferences: [],
      locale: 'en',
    });

    expect(model.activeCount).toBe(0);
    expect(model.inactiveCount).toBe(0);
    expect(model.rows).toHaveLength(0);
  });

  it('does not crash when logEntries is empty', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
    ];

    expect(() =>
      buildReminderCenterModel({
        todayIso: TODAY,
        profile: BASE_PROFILE,
        logEntries: [],
        preferences: prefs,
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash when profile has no optional cycle fields', () => {
    const sparseProfile: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
    ];

    expect(() =>
      buildReminderCenterModel({
        todayIso: TODAY,
        profile: sparseProfile,
        logEntries: [],
        preferences: prefs,
        locale: 'en',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// All disabled
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – all disabled preferences', () => {
  it('reports zero activeCount and inactiveCount equal to array length', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: false, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'fertile-window',
        enabled: false,
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
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.activeCount).toBe(0);
    expect(model.inactiveCount).toBe(4);
    expect(model.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invalid hour/minute on enabled preferences
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – invalid time on enabled preference', () => {
  /**
   * BUG: an enabled preference with an invalid hour/minute is silently skipped
   * by buildReminderPlans (correctly not scheduled), but inactiveCount is
   * computed only from !enabled, so it also misses the pref. The result is
   * that activeCount + inactiveCount < preferences.length — the pref vanishes
   * from both buckets and the UI under-reports the count.
   *
   * Fix: inactiveCount should include enabled prefs that produced no plan, OR
   * the model should expose them separately. The contract is: every preference
   * must appear in exactly one bucket.
   */
  it('BUG – enabled pref with hour=NaN should not vanish from both counts', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: Number.NaN,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    // An enabled preference with invalid time cannot be scheduled, so it
    // should not appear as active. It must appear as inactive so the total
    // count is preserved and the UI can show "1 reminder needs attention" or
    // similar rather than silently dropping it.
    const total = model.activeCount + model.inactiveCount;
    expect(total).toBe(prefs.length);
    // Specifically: not scheduled (invalid time) so not active
    expect(model.activeCount).toBe(0);
  });

  it('BUG – enabled pref with hour=24 (out of range) should not vanish from both counts', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'birth-control', enabled: true, hour: 24, minute: 0, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    const total = model.activeCount + model.inactiveCount;
    expect(total).toBe(prefs.length);
    expect(model.activeCount).toBe(0);
  });

  it('BUG – enabled period-start pref with minute=60 (out of range) should not vanish', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 60,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    const total = model.activeCount + model.inactiveCount;
    expect(total).toBe(prefs.length);
    expect(model.activeCount).toBe(0);
  });

  it('does not crash with Infinity as hour', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: Infinity,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    expect(() =>
      buildReminderCenterModel({
        todayIso: TODAY,
        profile: BASE_PROFILE,
        logEntries: LOG_ENTRIES,
        preferences: prefs,
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash with negative hour', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: -1,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    expect(() =>
      buildReminderCenterModel({
        todayIso: TODAY,
        profile: BASE_PROFILE,
        logEntries: LOG_ENTRIES,
        preferences: prefs,
        locale: 'en',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Duplicate kinds (same kind twice)
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – duplicate kinds', () => {
  it('only schedules the first enabled preference when two have the same kind', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
      { kind: 'daily-log', enabled: true, hour: 20, minute: 0, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    // Only one plan should be scheduled (dedup by identifier)
    expect(model.activeCount).toBe(1);
    // The scheduled one should use the first preference's hour
    expect(model.rows[0].detail).toContain('8:00');
  });

  it('counts the deduped-out preference in inactiveCount so totals are preserved', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'birth-control', enabled: true, hour: 7, minute: 15, schedule: { cadence: 'daily' } },
      { kind: 'birth-control', enabled: true, hour: 19, minute: 0, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    // Total must equal number of preferences
    const total = model.activeCount + model.inactiveCount;
    expect(total).toBe(prefs.length);
  });
});

// ---------------------------------------------------------------------------
// Label / time accuracy
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – label accuracy', () => {
  it('daily-log detail reflects actual preference hour:minute', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 21, minute: 45, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.rows[0].detail).toContain('45');
  });

  it('birth-control detail reflects actual preference hour:minute', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'birth-control', enabled: true, hour: 6, minute: 30, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.rows[0].detail).toContain('30');
  });

  it('period-start detail contains a date not a raw ISO string', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.rows).toHaveLength(1);
    // Should not be a raw ISO date like '2026-04-24'
    expect(model.rows[0].detail).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    // Should be a human-readable label with a month name
    expect(model.rows[0].detail).toMatch(/[A-Z][a-z]+/);
  });

  it('rows only contain enabled plans, not disabled ones', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 7,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].kind).toBe('daily-log');
    expect(model.inactiveCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Large / ordering determinism
// ---------------------------------------------------------------------------

describe('buildReminderCenterModel – determinism', () => {
  it('produces the same model when called twice with identical inputs', () => {
    const prefs: ReminderPreference[] = [
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
    ];

    const opts = {
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en' as const,
    };

    const m1 = buildReminderCenterModel(opts);
    const m2 = buildReminderCenterModel(opts);

    expect(m1).toEqual(m2);
  });

  it('row order follows the preference array order', () => {
    const prefs: ReminderPreference[] = [
      {
        kind: 'birth-control',
        enabled: true,
        hour: 7,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
      { kind: 'daily-log', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
    ];

    const model = buildReminderCenterModel({
      todayIso: TODAY,
      profile: BASE_PROFILE,
      logEntries: LOG_ENTRIES,
      preferences: prefs,
      locale: 'en',
    });

    expect(model.rows[0].kind).toBe('birth-control');
    expect(model.rows[1].kind).toBe('daily-log');
  });
});
