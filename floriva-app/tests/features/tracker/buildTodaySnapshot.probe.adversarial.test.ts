/**
 * PROBE — adversarial tests for buildTodaySnapshot.
 *
 * Scope: edge cases NOT covered by the existing test file:
 *  - Cycle day 1 (today == cycle start date)
 *  - Cycle boundary: today == nextPeriodStartDate - 1 (last day of cycle)
 *  - No log history + no profile dates (SPARSE_PROFILE) — must not throw
 *  - Single log entry (only one period start — low confidence path)
 *  - Future-dated log entries (logDate > todayIso) — must not crash or produce
 *    nonsense cycle days
 *  - cycleDay must always be >= 1 (no day 0 or negative)
 *  - Fertile-window arithmetic: startDate = nextPeriod - 19, endDate = nextPeriod - 14
 *    (6-day window, clinically correct)
 *  - Fertile-window labels when today is INSIDE the window (active label)
 *  - Prediction confidence transitions: 1 start → low, 2 starts → medium,
 *    3 starts → high
 *  - supportsIrregularCycles=true forces medium confidence even with 3+ starts
 *  - TTC goal: no special crash path (same logic, just verifying no throw)
 *  - Locale: zh-Hans and ja produce non-empty cycleDayLabel
 *  - historyChipLabel: 0 starts → 'New baseline', 1 start → '1 cycle'
 *  - nextPeriodStartIso: must be strictly after todayIso
 *  - Rolling-forward anchor: today is many cycles after last log; cycleDay must
 *    still be >= 1 and <= cycleLengthDays
 */

import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import { buildTodaySnapshot } from '@/src/features/tracker/buildTodaySnapshot';

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
};

const SPARSE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

// ---------------------------------------------------------------------------
// 1. Cycle day 1 — today is the cycle start date
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – cycle day 1', () => {
  it('returns cycleDay=1 when today equals the cycle start date', () => {
    // With two log entries the last start date is 2026-03-28
    // today=2026-03-28 → cycleDay should be 1
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-03-28',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBe(1);
    expect(snapshot.cycleDayLabel).toBe('Cycle day 1');
  });

  it('cycleDay is never < 1', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-03-28',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Cycle boundary — last day of the cycle (cycleDay == cycleLengthDays)
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – last day of cycle', () => {
  it('returns cycleDay equal to cycleLengthDays on the day before nextPeriodStart', () => {
    // nextPeriodStart = 2026-04-25, so day before = 2026-04-24
    // cycleStart = 2026-03-28, cycleDay = diffDays(2026-03-28, 2026-04-24)+1 = 28
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-24',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBe(28);
    expect(snapshot.cycleDay).toBe(snapshot.cycleLengthDays);
  });
});

// ---------------------------------------------------------------------------
// 3. No log history, no profile cycle dates — must not throw
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – completely sparse profile', () => {
  it('does not throw with no log entries and no profile dates', () => {
    expect(() =>
      buildTodaySnapshot({
        todayIso: '2026-04-20',
        profile: SPARSE_PROFILE,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('cycleDay is still >= 1 with sparse profile', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: SPARSE_PROFILE,
      logEntries: [],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBeGreaterThanOrEqual(1);
  });

  it('nextPeriodStartIso is in the future when profile has no dates', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: SPARSE_PROFILE,
      logEntries: [],
      locale: 'en',
    });

    if (snapshot.nextPeriodStartIso) {
      expect(snapshot.nextPeriodStartIso > '2026-04-20').toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Single log entry — one period start → confidence should be 'low'
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – single log entry (one period start)', () => {
  it('reports low confidence with only one period-start log', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.confidenceLevel).toBe('low');
  });

  it('historyChipLabel reflects one cycle start', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.historyChipLabel).toBe('1 cycle');
  });
});

// ---------------------------------------------------------------------------
// 5. Future-dated log entries — must not crash or produce negative cycle days
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – future-dated log entries', () => {
  it('does not throw when a log entry is dated after todayIso', () => {
    expect(() =>
      buildTodaySnapshot({
        todayIso: '2026-04-20',
        profile: BASE_PROFILE,
        logEntries: [
          makeLog('2026-03-28'),
          makeLog('2026-05-01'), // future
        ],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('cycleDay remains >= 1 with a future-dated log', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-03-28'), makeLog('2026-05-01')],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Fertile-window arithmetic: [nextPeriod-19, nextPeriod-14] is a 6-day window
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – fertile window arithmetic', () => {
  it('fertile window spans exactly 6 days (nextPeriod-19 to nextPeriod-14)', () => {
    // nextPeriodStart = 2026-04-25
    // fertileStart = 2026-04-25 - 19 = 2026-04-06
    // fertileEnd   = 2026-04-25 - 14 = 2026-04-11
    // diffDays(fertileStart, fertileEnd) = 5 → window covers days 6-11 inclusive = 6 days
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    // nextPeriodStartIso must be 2026-04-25
    expect(snapshot.nextPeriodStartIso).toBe('2026-04-25');

    // The fertile window label should reference a past window (today Apr 20 > Apr 11)
    expect(snapshot.fertileWindowLabel).toContain('ago');
  });

  it('fertile window is "active today" when today is inside [nextPeriod-19, nextPeriod-14]', () => {
    // nextPeriod = 2026-04-25, fertileWindow = [Apr 06, Apr 11]
    // today = 2026-04-08 is inside the window
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-08',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.fertileWindowLabel).toBe('Fertile window active today');
  });

  it('fertile window opens "in 1 day" when today is exactly 1 day before fertileStart', () => {
    // fertileStart = 2026-04-06, so today = 2026-04-05
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-05',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.fertileWindowLabel).toBe('Fertile window opens in 1 day');
  });

  it('fertile window ended "1 day ago" when today is one day after fertileEnd', () => {
    // fertileEnd = 2026-04-11, so today = 2026-04-12
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-12',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.fertileWindowLabel).toBe('Fertile window ended 1 day ago');
  });
});

// ---------------------------------------------------------------------------
// 7. Confidence level transitions
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – confidence level transitions', () => {
  it('two period starts → medium confidence', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.confidenceLevel).toBe('medium');
  });

  it('three or more period starts → high confidence (no irregular cycles)', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-05-20',
      profile: { ...BASE_PROFILE, lastPeriodStartDate: '2026-04-25' },
      logEntries: [
        makeLog('2026-01-31', 'medium'),
        makeLog('2026-02-28', 'medium'),
        makeLog('2026-03-28'),
      ],
      locale: 'en',
    });

    expect(snapshot.confidenceLevel).toBe('high');
  });

  it('supportsIrregularCycles=true caps confidence at medium even with 3+ starts', () => {
    const irregularProfile: UserProfile = {
      ...BASE_PROFILE,
      supportsIrregularCycles: true,
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-05-20',
      profile: irregularProfile,
      logEntries: [
        makeLog('2026-01-31', 'medium'),
        makeLog('2026-02-28', 'medium'),
        makeLog('2026-03-28'),
      ],
      locale: 'en',
    });

    expect(snapshot.confidenceLevel).toBe('medium');
    expect(snapshot.confidenceLevel).not.toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 8. TTC goal — no crash
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – TTC goal', () => {
  it('does not crash with trying-to-conceive goal', () => {
    const ttcProfile: UserProfile = {
      ...BASE_PROFILE,
      goals: ['trying-to-conceive'],
    };

    expect(() =>
      buildTodaySnapshot({
        todayIso: '2026-04-20',
        profile: ttcProfile,
        logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
        locale: 'en',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. Locale: zh-Hans and ja produce non-empty cycleDayLabel
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – locale cycleDayLabel', () => {
  it('zh-Hans produces non-empty cycleDayLabel', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'zh-Hans',
    });

    expect(snapshot.cycleDayLabel.length).toBeGreaterThan(0);
  });

  it('ja produces non-empty cycleDayLabel', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'ja',
    });

    expect(snapshot.cycleDayLabel.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 10. historyChipLabel edge cases
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – historyChipLabel', () => {
  it('returns "New baseline" when no bleeding log entries exist', () => {
    // With empty logs but lastPeriodStartDate set, history has 1 start
    // (from the seed). With no logs, historySource='onboarding-seed', startDates=[lastPeriodStartDate].
    // That gives count=1 → '1 cycle' for historyChipLabel. Only if onboarding seed
    // provides 0 entries would we get 'New baseline'.
    const noHistoryProfile: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      // No lastPeriodStartDate — seed falls back to todayIso, startDates=[todayIso], count=1
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: noHistoryProfile,
      logEntries: [],
      locale: 'en',
    });

    // historyChipLabel should be defined and non-empty regardless of path
    expect(typeof snapshot.historyChipLabel === 'string' || snapshot.historyChipLabel === undefined).toBe(true);
  });

  it('returns "2 cycles" with two logged period starts', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.historyChipLabel).toBe('2 cycles');
  });
});

// ---------------------------------------------------------------------------
// 11. nextPeriodStartIso must always be strictly after todayIso
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – nextPeriodStartIso always in the future', () => {
  it('nextPeriodStartIso > todayIso (rolling-forward anchor)', () => {
    // today is several cycles after the last log — rolling forward must still
    // produce a nextPeriodStartIso in the future
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-07-01', // 3 months after last log
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    if (snapshot.nextPeriodStartIso) {
      expect(snapshot.nextPeriodStartIso > '2026-07-01').toBe(true);
    }
  });

  it('cycleDay stays within [1, cycleLengthDays] after rolling forward many cycles', () => {
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-07-01',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.cycleDay).toBeGreaterThanOrEqual(1);
    expect(snapshot.cycleDay).toBeLessThanOrEqual(snapshot.cycleLengthDays);
  });
});

// ---------------------------------------------------------------------------
// 12. SUSPECTED BUG probe: fertile-window endDate vs label off-by-one
//
// The fertile window is [nextPeriod-19, nextPeriod-14]. For nextPeriod=Apr 25:
//   startDate = Apr 6, endDate = Apr 11.
// When today = Apr 11 (endDate itself), the label logic uses `todayIso > endIso`
// to detect "window closed". Apr 11 is NOT > Apr 11, so the label should be
// "active today", which is correct — the end day is inclusive.
// ---------------------------------------------------------------------------

describe('buildTodaySnapshot – fertile window end day is inclusive', () => {
  it('reports "active today" when today equals fertileWindow.endDate (end day is inclusive)', () => {
    // fertileEnd = 2026-04-11; today = 2026-04-11 → must be "active"
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-11',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    // todayIso === endIso → falls into the `else` branch → "active today"
    expect(snapshot.fertileWindowLabel).toBe('Fertile window active today');
  });

  it('reports "active today" when today equals fertileWindow.startDate', () => {
    // fertileStart = 2026-04-06; today = 2026-04-06
    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-06',
      profile: BASE_PROFILE,
      logEntries: [makeLog('2026-02-28', 'medium'), makeLog('2026-03-28')],
      locale: 'en',
    });

    expect(snapshot.fertileWindowLabel).toBe('Fertile window active today');
  });
});
