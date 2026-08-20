/**
 * Real-world irregular history adversarial probe for buildPredictionResult.
 *
 * Focuses on scenarios NOT covered by prior probes:
 * - PCOS-like highly variable cycle lengths (19–60 day swings)
 * - Long logging gaps (months of no data, then resumption)
 * - Sparse single-day logs
 * - Back-to-back contiguous bleeding days (should collapse to one period start)
 * - Double-logged same dates
 * - Very long histories (2+ years)
 * - supportsIrregularCycles=true vs false
 * - Rolling-forward past a 200-day gap
 */

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return {
    id: logDate,
    logDate,
    bleeding,
    symptoms: [],
  };
}

const BASE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { ...BASE_PROFILE, ...overrides };
}

// ---------------------------------------------------------------------------
// Invariant helpers
// ---------------------------------------------------------------------------

function assertInvariants(result: ReturnType<typeof buildPredictionResult>) {
  const { cycleLengthDays, nextPeriod, fertileWindow, current } = result;

  // cycleLengthDays is finite integer >= 20
  expect(Number.isFinite(cycleLengthDays)).toBe(true);
  expect(Number.isInteger(cycleLengthDays)).toBe(true);
  expect(cycleLengthDays).toBeGreaterThanOrEqual(20);

  // nextPeriod.startDate is strictly after current.cycleStartDate by cycleLengthDays
  const expectedNextStart = addDays(current.cycleStartDate, cycleLengthDays);
  expect(nextPeriod.startDate).toBe(expectedNextStart);

  // fertileWindow is exactly 6 days wide (endDate - startDate == 5)
  const windowWidth = diffDays(fertileWindow.startDate, fertileWindow.endDate);
  expect(windowWidth).toBe(5); // [start, end] inclusive => 6 days; diff = 5

  // fertileWindow ends exactly 14 days before nextPeriod
  const daysToNextFromFertileEnd = diffDays(fertileWindow.endDate, nextPeriod.startDate);
  expect(daysToNextFromFertileEnd).toBe(14);

  // fertileWindow starts exactly 19 days before nextPeriod
  const daysToNextFromFertileStart = diffDays(fertileWindow.startDate, nextPeriod.startDate);
  expect(daysToNextFromFertileStart).toBe(19);

  // cycleDay >= 1
  expect(current.cycleDay).toBeGreaterThanOrEqual(1);
}

// ---------------------------------------------------------------------------
// Section 1 — Contiguous bleeding days collapse to ONE period start
// ---------------------------------------------------------------------------

describe('contiguous bleeding days collapse', () => {
  test('5 consecutive heavy days produce only one period start', () => {
    const result = buildPredictionResult({
      todayIso: '2024-04-30',
      profile: profile(),
      logEntries: [
        log('2024-04-01', 'heavy'),
        log('2024-04-02', 'heavy'),
        log('2024-04-03', 'medium'),
        log('2024-04-04', 'light'),
        log('2024-04-05', 'light'),
      ],
    });

    // Only one start should be extracted, not five
    expect(result.history.startDates).toEqual(['2024-04-01']);
    expect(result.history.startDates.length).toBe(1);
    assertInvariants(result);
  });

  test('two periods separated by 28 days, each with 5 contiguous days → 2 starts, not 10', () => {
    const buildDays = (start: string, count: number): DailyLogEntry[] =>
      Array.from({ length: count }, (_, i) => log(addDays(start, i), 'medium'));

    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile(),
      logEntries: [
        ...buildDays('2024-04-01', 5),
        ...buildDays('2024-04-29', 5),
      ],
    });

    expect(result.history.startDates.length).toBe(2);
    expect(result.history.startDates[0]).toBe('2024-04-01');
    expect(result.history.startDates[1]).toBe('2024-04-29');
    assertInvariants(result);
  });

  test('three periods with contiguous days → 3 starts, high confidence', () => {
    const buildDays = (start: string, count: number): DailyLogEntry[] =>
      Array.from({ length: count }, (_, i) => log(addDays(start, i), 'medium'));

    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: [
        ...buildDays('2024-04-01', 5),
        ...buildDays('2024-04-29', 5),
        ...buildDays('2024-05-27', 5),
      ],
    });

    expect(result.history.startDates.length).toBe(3);
    expect(result.confidence.level).toBe('high');
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 2 — PCOS-like highly variable cycles (19–60 day swings)
// ---------------------------------------------------------------------------

describe('PCOS-like highly variable cycles', () => {
  test('wide-swinging cycles (20, 45, 60, 19) still produce finite integer cycleLengthDays >= 20', () => {
    // Gaps: 20, 45, 60, 19 days
    const starts = ['2023-01-01', '2023-01-21', '2023-03-07', '2023-05-06', '2023-05-25'];
    const entries = starts.map((d) => log(d, 'heavy'));
    const result = buildPredictionResult({
      todayIso: '2023-06-20',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: entries,
    });

    assertInvariants(result);
    // A2: robust cycle statistics replace the plain average for >=3 starts.
    // Intervals [20, 45, 60, 19], chronological weights [1, 2, 3, 4]. Bounds
    // filter: all four are within [15, 90]. MAD: median 32.5, deviations
    // [12.5, 12.5, 27.5, 13.5], MAD 13, threshold max(7, 2.5*13) = 32.5 -- all
    // four survive (none exceed 32.5 from the median).
    // Weighted median: sorted by value [(19,w4),(20,w1),(45,w2),(60,w3)],
    // total weight 10, half 5. Cumulative: 4, then 4+1=5 (lands EXACTLY on
    // half) -> per the documented tie rule, average the straddling values (20
    // and 45): (20 + 45) / 2 = 32.5, rounded to 33. This replaces the old
    // plain average of 36.
    expect(result.cycleLengthDays).toBe(33);
    // With supportsIrregularCycles and >=2 starts, should be medium (not high)
    expect(result.confidence.level).toBe('medium');
  });

  test('supportsIrregularCycles=true with 3 starts never yields high confidence', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: [
        log('2024-01-01', 'heavy'),
        log('2024-02-15', 'heavy'), // 45 days
        log('2024-03-20', 'heavy'), // 34 days
      ],
    });

    expect(result.confidence.level).not.toBe('high');
    assertInvariants(result);
  });

  test('supportsIrregularCycles=false with same 3 starts yields medium confidence (LT-04: this fixture is stale)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ supportsIrregularCycles: false }),
      logEntries: [
        log('2024-01-01', 'heavy'),
        log('2024-02-15', 'heavy'),
        log('2024-03-20', 'heavy'),
      ],
    });

    // LT-04: todayIso (2024-06-01) is 73 days after the last logged start
    // (2024-03-20) -- with intervals of 45/34 days feeding the cycle-length
    // estimate, that is well past the calendar expectation (>30 days
    // overdue) and rolls the anchor forward >= 1 whole cycle, so
    // isHistoryStale is true. This fixture would have reached the terminal
    // "high / consistent-recent-bleeding-history" branch pre-LT-04, but
    // 73 days of silence is exactly the dishonest-"recent" case the fix
    // targets -- it degrades to medium with the new `stale-history` code.
    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasonCodes).toContain('stale-history');
    assertInvariants(result);
  });

  test('irregular limitation surfaced when supportsIrregularCycles=true', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: [
        log('2024-01-01', 'heavy'),
        log('2024-03-01', 'heavy'),
        log('2024-04-15', 'heavy'),
      ],
    });

    expect(result.limitationCodes).toContain('irregular-cycle-broader');
    assertInvariants(result);
  });

  test('sub-20-day average cycle is floored at 20', () => {
    // Three periods with 18 and 17 day gaps → avg = 17.5, floor to 20
    const result = buildPredictionResult({
      todayIso: '2024-03-01',
      profile: profile(),
      logEntries: [
        log('2024-01-01', 'heavy'),
        log('2024-01-19', 'heavy'), // 18 days
        log('2024-02-05', 'heavy'), // 17 days
      ],
    });

    expect(result.cycleLengthDays).toBe(20);
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Long logging gaps (200 days)
// ---------------------------------------------------------------------------

describe('long logging gaps / roll-forward', () => {
  test('200-day gap from last period start rolls forward, no crash', () => {
    const lastPeriod = '2024-01-01';
    const today = addDays(lastPeriod, 200);

    const result = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [log(lastPeriod, 'heavy')],
    });

    // Should not crash; cycleLengthDays still valid
    assertInvariants(result);
    // nextPeriod should be in the future
    expect(result.nextPeriod.startDate > today).toBe(true);
    // With a gap > 1 cycle, projected-forward limitation should surface
    expect(result.limitationCodes).toContain('projected-forward');
  });

  test('200-day gap with 3 regular starts before gap still produces sane cycleLengthDays', () => {
    // Regular 28-day cycles Jan–March 2023, then silence until today (2024)
    const today = '2024-07-01';
    const result = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [
        log('2023-01-01', 'heavy'),
        log('2023-01-29', 'heavy'),
        log('2023-02-26', 'heavy'),
      ],
    });

    expect(result.cycleLengthDays).toBe(28);
    assertInvariants(result);
    // Should roll forward so nextPeriod is after today
    expect(result.nextPeriod.startDate > today).toBe(true);
    expect(result.limitationCodes).toContain('projected-forward');
  });

  test('resumption after 6-month gap: new period start after gap contributes to avg correctly', () => {
    // 3 regular ~28-day cycles, 6-month gap, then one more period
    // The gap interval is huge: Nov 1 to May 1 = ~181 days
    // avg of [28, 27, 181] ≈ 79 days
    const result = buildPredictionResult({
      todayIso: '2024-05-25',
      profile: profile(),
      logEntries: [
        log('2023-10-01', 'heavy'),
        log('2023-10-29', 'heavy'), // 28 days
        log('2023-11-25', 'heavy'), // 27 days
        log('2024-05-01', 'heavy'), // 157 days gap (Nov 25 -> May 1)
      ],
    });

    // A2: robust cycle statistics replace the plain average for >=3 starts.
    // Intervals (chronological) [28, 27, 157] with weights [1, 2, 3]. The
    // 157-day gap is a data artifact (a genuine 6-month non-logging gap, not
    // a real cycle length) and is discarded by the HARD BOUNDS filter
    // ([15, 90]) before MAD or weighting ever run. Only [28 (w1), 27 (w2)]
    // survive; the recency-weighted median of two values picks the newer one
    // (27, weight 2 > weight 1), which also happens to match the un-weighted
    // plain average of the two survivors. This replaces the old plain average
    // over ALL THREE intervals (~71, including the huge outlier gap), which
    // was itself a symptom of the bug this task fixes: a single missed
    // 6-month logging gap should not blow up the estimated cycle length.
    expect(result.cycleLengthDays).toBe(27);
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Single sparse log per period
// ---------------------------------------------------------------------------

describe('single sparse log per period', () => {
  test('single-day logs (no contiguous runs) work correctly', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'medium'),
        log('2024-03-29', 'medium'),
        log('2024-04-26', 'medium'),
      ],
    });

    expect(result.history.startDates.length).toBe(3);
    expect(result.confidence.level).toBe('high');
    assertInvariants(result);
  });

  test('single log entry → confidence low', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [log('2024-06-01', 'medium')],
    });

    expect(result.confidence.level).toBe('low');
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Double-logged same date (duplicate entries)
// ---------------------------------------------------------------------------

describe('duplicate / double-logged same date', () => {
  test('two identical log entries for same date → treated as one period start', () => {
    const result = buildPredictionResult({
      todayIso: '2024-05-01',
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'heavy'),
        log('2024-03-01', 'medium'), // duplicate same date
        log('2024-03-29', 'heavy'),
      ],
    });

    // 2024-03-01 appears twice but is contiguous-day collapsed (same date = 0 day diff, not 1)
    // The second entry on 2024-03-01 has diffDays(2024-03-01, 2024-03-01) === 0, not 1
    // so isContiguousDay is false; isPlausibleNewCycle: 0 days from lastStart (2024-03-01) < 15 → false
    // So the second entry should NOT add a second period start
    expect(result.history.startDates.filter((d) => d === '2024-03-01').length).toBe(1);
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Very long 2+ year daily history
// ---------------------------------------------------------------------------

describe('2-year history with regular ~28 day cycles', () => {
  function buildTwoYearHistory(startDate: string, cycleLen: number): DailyLogEntry[] {
    const entries: DailyLogEntry[] = [];
    let current = startDate;
    // ~26 cycles over 2 years
    for (let i = 0; i < 26; i++) {
      // 5-day bleed
      for (let d = 0; d < 5; d++) {
        entries.push(log(addDays(current, d), d === 0 ? 'heavy' : d < 3 ? 'medium' : 'light'));
      }
      current = addDays(current, cycleLen);
    }
    return entries;
  }

  test('2-year regular history: invariants hold, medium confidence, sane cycleLengthDays (LT-04: this fixture is stale)', () => {
    const history = buildTwoYearHistory('2022-01-01', 28);
    const result = buildPredictionResult({
      todayIso: '2024-04-01',
      profile: profile(),
      logEntries: history,
    });

    // LT-04: 26 cycles of exactly 28 days starting 2022-01-01 puts the LAST
    // logged start at 2023-12-02 -- but todayIso is fixed at 2024-04-01,
    // 121 days (~4 cycles) later. That is a fixture-authoring artifact (a
    // fixed todayIso outliving a bounded history loop), not an actively
    // logging user -- it is exactly the "silent for 4 cycles" case
    // isHistoryStale exists to catch, so confidence now degrades to medium
    // with the honest `stale-history` code instead of the old
    // "high / consistent-recent-bleeding-history".
    expect(result.cycleLengthDays).toBe(28);
    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasonCodes).toContain('stale-history');
    assertInvariants(result);
  });

  test('2-year history is deterministic (same input → same output)', () => {
    const history = buildTwoYearHistory('2022-01-01', 30);
    const todayIso = '2024-04-01';
    const r1 = buildPredictionResult({ todayIso, profile: profile(), logEntries: history });
    const r2 = buildPredictionResult({ todayIso, profile: profile(), logEntries: [...history].reverse() });

    expect(r1.cycleLengthDays).toBe(r2.cycleLengthDays);
    expect(r1.nextPeriod.startDate).toBe(r2.nextPeriod.startDate);
    expect(r1.current.cycleStartDate).toBe(r2.current.cycleStartDate);
    assertInvariants(r1);
    assertInvariants(r2);
  });

  test('2-year irregular (PCOS-like) history with mixed cycle lengths still passes invariants', () => {
    const entries: DailyLogEntry[] = [];
    // Mix of 21, 35, 45, 19, 60 day cycles repeated
    const cycleLens = [21, 35, 45, 19, 60, 28, 32, 25, 50, 22];
    let current = '2022-01-01';
    for (const len of cycleLens) {
      entries.push(log(current, 'heavy'));
      current = addDays(current, len);
    }

    const result = buildPredictionResult({
      todayIso: current,
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: entries,
    });

    assertInvariants(result);
    expect(result.confidence.level).toBe('medium'); // supportsIrregularCycles prevents high
  });
});

// ---------------------------------------------------------------------------
// Section 7 — MIN_CYCLE_SEPARATION guard (intermenstrual spotting)
// ---------------------------------------------------------------------------

describe('MIN_CYCLE_SEPARATION_DAYS guard (15 days)', () => {
  test('spotting 5 days after period start is ignored (< 15 day separation)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-04-30',
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'heavy'),
        log('2024-03-06', 'light'), // only 5 days later — intermenstrual, ignored
        log('2024-03-29', 'heavy'), // genuine new period
      ],
    });

    // Should only have 2 starts: March 1 and March 29 (not March 6)
    expect(result.history.startDates).toEqual(['2024-03-01', '2024-03-29']);
    assertInvariants(result);
  });

  test('bleeding exactly 15 days after previous start IS accepted as new period', () => {
    const result = buildPredictionResult({
      todayIso: '2024-04-30',
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'heavy'),
        log('2024-03-16', 'heavy'), // exactly 15 days — plausible new cycle
      ],
    });

    expect(result.history.startDates.length).toBe(2);
    expect(result.history.startDates[1]).toBe('2024-03-16');
    assertInvariants(result);
  });

  test('bleeding 14 days after previous start is rejected (< 15 day separation)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-04-30',
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'heavy'),
        log('2024-03-15', 'heavy'), // 14 days — NOT accepted
      ],
    });

    expect(result.history.startDates.length).toBe(1);
    expect(result.history.startDates[0]).toBe('2024-03-01');
    assertInvariants(result);
  });
});

// ---------------------------------------------------------------------------
// Section 8 — Confidence degrades with sparsity / irregularity
// ---------------------------------------------------------------------------

describe('confidence ordering invariants', () => {
  test('confidence does NOT increase from medium when supportsIrregularCycles=true', () => {
    // Even with 10 period starts, supportsIrregularCycles caps at medium
    const entries = Array.from({ length: 10 }, (_, i) =>
      log(addDays('2023-01-01', i * 28), 'heavy'),
    );
    const result = buildPredictionResult({
      todayIso: '2025-01-01',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: entries,
    });

    expect(result.confidence.level).not.toBe('high');
  });

  test('1 start → low; 2 starts → medium; 3+ starts (regular) → high', () => {
    const today = '2024-06-10';

    const r1 = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [log('2024-05-01', 'heavy')],
    });
    expect(r1.confidence.level).toBe('low');

    const r2 = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [log('2024-04-01', 'heavy'), log('2024-04-29', 'heavy')],
    });
    expect(r2.confidence.level).toBe('medium');

    const r3 = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [
        log('2024-03-01', 'heavy'),
        log('2024-03-29', 'heavy'),
        log('2024-04-26', 'heavy'),
      ],
    });
    expect(r3.confidence.level).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Section 9 — nextPeriod always in the future relative to today
// ---------------------------------------------------------------------------

describe('nextPeriod.startDate always strictly after today', () => {
  test('nextPeriod is always after today after roll-forward', () => {
    // Last period was 100 days ago with a 28-day cycle
    const lastPeriod = '2024-01-01';
    const today = addDays(lastPeriod, 100); // ~3.5 cycles later

    const result = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [log(lastPeriod, 'heavy')],
    });

    expect(result.nextPeriod.startDate > today).toBe(true);
    assertInvariants(result);
  });
});
