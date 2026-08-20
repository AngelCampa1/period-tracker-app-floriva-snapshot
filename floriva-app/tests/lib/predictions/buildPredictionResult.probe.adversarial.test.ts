/**
 * Adversarial probe suite for buildPredictionResult + cyclePhaseModel.
 *
 * Strategy: run real functions against edge cases; derive expected values from
 * the documented clinical math; leave assertions FAILING when the implementation
 * diverges — those are bug candidates.
 *
 * Clinical math reference (from source comments):
 *   fertileWindow.start  = nextPeriodStart - 19 days
 *   fertileWindow.end    = nextPeriodStart - 14 days
 *   fertile window = 6 days (end - start + 1 = 6, i.e. [−19, −14] inclusive)
 *   cycleLength floor    = 20 days
 *   periodLength default = 5 days (floor 1)
 *   MIN_CYCLE_SEPARATION = 15 days
 */

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import {
  buildCyclePhaseBreakdown,
  buildCyclePhaseEndDays,
  FERTILE_WINDOW_LENGTH_DAYS,
} from '@/src/lib/predictions/cyclePhaseModel';
import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { ...BASE_PROFILE, ...overrides };
}

function log(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return {
    id: logDate,
    logDate,
    bleeding,
    symptoms: [],
  };
}

function logs(...entries: [string, DailyLogEntry['bleeding']?][]): DailyLogEntry[] {
  return entries.map(([date, b]) => log(date, b ?? 'medium'));
}

// ---------------------------------------------------------------------------
// Section 1 — Date math / boundary correctness
// ---------------------------------------------------------------------------

describe('dateMath — leap year and year-rollover', () => {
  test('addDays across Feb 28 → Feb 29 in leap year', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  test('addDays Feb 29 → Mar 1 in leap year', () => {
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  test('addDays Feb 28 → Mar 1 in non-leap year', () => {
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });

  test('addDays Dec 31 → Jan 1 (year rollover)', () => {
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
  });

  test('diffDays across leap-year Feb 29', () => {
    // 2024-02-28 to 2024-03-01 should be 2 days (goes through Feb 29)
    expect(diffDays('2024-02-28', '2024-03-01')).toBe(2);
  });

  test('diffDays across year boundary', () => {
    expect(diffDays('2023-12-31', '2024-01-01')).toBe(1);
  });

  test('diffDays same date = 0', () => {
    expect(diffDays('2024-06-01', '2024-06-01')).toBe(0);
  });

  test('addDays negative delta', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
});

// ---------------------------------------------------------------------------
// Section 2 — buildPredictionResult: zero/one/two/three starts
// ---------------------------------------------------------------------------

describe('buildPredictionResult — thin history', () => {
  test('0 log entries → falls back to onboarding-seed, confidence medium', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ lastPeriodStartDate: '2024-06-01' }),
      logEntries: [],
    });
    expect(result.history.source).toBe('onboarding-seed');
    expect(result.confidence.level).toBe('medium');
  });

  test('0 log entries, no lastPeriodStartDate → todayIso used as anchor', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [],
    });
    // Cycle day should be 1 (today == start)
    expect(result.current.cycleDay).toBe(1);
    expect(result.current.cycleStartDate).toBe('2024-06-10');
  });

  test('1 period start → confidence low', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: logs(['2024-06-01']),
    });
    expect(result.history.source).toBe('bleeding-history');
    expect(result.confidence.level).toBe('low');
  });

  test('2 period starts → confidence medium (one interval observed)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: logs(['2024-05-01'], ['2024-05-29']),
    });
    expect(result.confidence.level).toBe('medium');
  });

  test('3 period starts → confidence high (no irregular flag)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: logs(['2024-04-01'], ['2024-04-29'], ['2024-05-27']),
    });
    expect(result.confidence.level).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Cycle length resolution
// ---------------------------------------------------------------------------

describe('resolveCycleLengthDays', () => {
  test('3 starts with 20/40 alternating gaps → recency-weighted median (A2), not the old plain average', () => {
    // gaps: 20, 40 (chronological weights 1, 2). Both survive bounds/MAD
    // (median 30, MAD 10, threshold 25). Recency-weighted median: sorted by
    // value [(20,w1),(40,w2)], total weight 3, half 1.5; cumulative reaches
    // 3 (>= 1.5) at value 40, so the weighted median is 40 -- the NEWER gap
    // dominates, unlike the old plain average of 30. This is an intentional
    // behavior change from A2 (see src/lib/predictions/cycleStatistics.ts).
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: logs(['2024-01-01'], ['2024-01-21'], ['2024-03-01']),
    });
    expect(result.cycleLengthDays).toBe(40);
  });

  test('very short history cycle of 10 days (2 starts) → falls back to profile floor', () => {
    // With 2 starts the function uses the profile path, not history average.
    // profile has no cycleLengthDays → default 28.
    const result = buildPredictionResult({
      todayIso: '2024-06-15',
      profile: profile(),
      logEntries: logs(['2024-06-01'], ['2024-06-11']),
    });
    // 2 starts → uses profile default 28
    expect(result.cycleLengthDays).toBe(28);
  });

  test('3 starts with very short 8-day gaps — only 2 are counted (MIN_CYCLE_SEPARATION guard)', () => {
    // June 1 → June 9 = 8 days < 15 (MIN_CYCLE_SEPARATION) → June 9 is NOT a new start
    // lastStartDate stays June 1. June 17 = 16 days from June 1 >= 15 → IS a new start.
    // Result: 2 starts (June 1, June 17) → profile default 28
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: logs(['2024-06-01'], ['2024-06-09'], ['2024-06-17']),
    });
    expect(result.history.startDates).toHaveLength(2);
    expect(result.cycleLengthDays).toBe(28); // 2 starts → profile default
  });

  test('3 starts with extremely long 365-day gaps — avg rounds to 366 (leap year gap)', () => {
    // Jan 1 2024 → Jan 1 2025 = 366 days (2024 is leap year)
    // Jan 1 2025 → Jan 1 2026 = 365 days
    // avg = 365.5 → Math.round = 366
    const result = buildPredictionResult({
      todayIso: '2026-06-10',
      profile: profile(),
      logEntries: logs(['2024-01-01'], ['2025-01-01'], ['2026-01-01']),
    });
    expect(result.cycleLengthDays).toBe(366);
  });

  test('profile.cycleLengthDays = NaN → default 29 (onboarding-seed path)', () => {
    // No log entries → source = 'onboarding-seed' → defaultCycleLength = 29
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: NaN }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(29);
  });

  test('profile.cycleLengthDays = Infinity → default 29 (onboarding-seed path)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: Infinity }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(29);
  });

  test('profile.cycleLengthDays = -5 → default 29 (onboarding-seed path)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: -5 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(29);
  });

  test('profile.cycleLengthDays = 0 → default 29 (onboarding-seed path)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 0 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(29);
  });

  test('profile.cycleLengthDays = 10 (below floor) → 20', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 10 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(20);
  });

  test('profile.cycleLengthDays = 21.7 (fractional) → rounded to 22', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 21.7 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Period length resolution
// ---------------------------------------------------------------------------

describe('resolvePeriodLengthDays', () => {
  test('undefined periodLengthDays → 5', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [],
    });
    expect(result.nextPeriod.lengthDays).toBe(5);
  });

  test('periodLengthDays = 0 → 5 (default)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ periodLengthDays: 0 }),
      logEntries: [],
    });
    expect(result.nextPeriod.lengthDays).toBe(5);
  });

  test('periodLengthDays = -2 → 5 (default)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ periodLengthDays: -2 }),
      logEntries: [],
    });
    expect(result.nextPeriod.lengthDays).toBe(5);
  });

  test('periodLengthDays = 0.4 clamps to a 1-day minimum (by design, not the 5-day default)', () => {
    // A positive sub-1 fractional value (0.4) passes the `v <= 0` guard, rounds
    // to 0, and is then clamped to the 1-day floor by Math.max(1, ...). This is
    // intentional: any positive period length yields at least a 1-day period
    // rather than fabricating the 5-day default reserved for missing/invalid
    // (null/NaN/<=0) input. A 1-day minimum is a safe, non-misleading floor.
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ periodLengthDays: 0.4 }),
      logEntries: [],
    });
    expect(result.nextPeriod.lengthDays).toBe(1);
  });

  test('periodLengthDays = 0.6 (rounds to 1 → floor 1)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ periodLengthDays: 0.6 }),
      logEntries: [],
    });
    // Math.round(0.6) = 1 → max(1,1) = 1
    expect(result.nextPeriod.lengthDays).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Fertile window math
// ---------------------------------------------------------------------------

describe('fertileWindow correctness', () => {
  test('fertile window = nextPeriodStart - 19 to - 14 (6 days inclusive)', () => {
    const today = '2024-06-01';
    const result = buildPredictionResult({
      todayIso: today,
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-01']),
    });
    const next = result.nextPeriod.startDate;
    const expectedStart = addDays(next, -19);
    const expectedEnd = addDays(next, -14);
    expect(result.fertileWindow.startDate).toBe(expectedStart);
    expect(result.fertileWindow.endDate).toBe(expectedEnd);
    // Window must be exactly 6 days inclusive
    expect(diffDays(result.fertileWindow.startDate, result.fertileWindow.endDate)).toBe(5); // 5-day diff = 6-day inclusive window
  });

  test('fertile window start must not be before cycleStartDate for cycleLength=20', () => {
    // cycleLength=20: fertileStart = next - 19 = (start+20) - 19 = start + 1
    // So fertileStart is 1 day after cycle start — barely OK.
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 20 }),
      logEntries: logs(['2024-06-01']),
    });
    const fertileStartOffset = diffDays(result.current.cycleStartDate, result.fertileWindow.startDate);
    // Negative would mean fertile window starts BEFORE the cycle start — degenerate
    expect(fertileStartOffset).toBeGreaterThanOrEqual(0);
  });

  test('fertile window 6-day inclusive length is consistent with FERTILE_WINDOW_LENGTH_DAYS', () => {
    expect(FERTILE_WINDOW_LENGTH_DAYS).toBe(6);
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-01']),
    });
    const actualLength = diffDays(result.fertileWindow.startDate, result.fertileWindow.endDate) + 1;
    expect(actualLength).toBe(FERTILE_WINDOW_LENGTH_DAYS);
  });

  test('leap year Feb 29 cycle start — fertile window does not skip days', () => {
    const result = buildPredictionResult({
      todayIso: '2024-02-29',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-02-29']),
    });
    // nextPeriodStart = 2024-02-29 + 28 = 2024-03-28
    expect(result.nextPeriod.startDate).toBe('2024-03-28');
    // fertileStart = 2024-03-28 - 19 = 2024-03-09
    expect(result.fertileWindow.startDate).toBe('2024-03-09');
    // fertileEnd   = 2024-03-28 - 14 = 2024-03-14
    expect(result.fertileWindow.endDate).toBe('2024-03-14');
  });

  test('Dec 31 cycle start — fertile window rolls into next year correctly', () => {
    const result = buildPredictionResult({
      todayIso: '2023-12-31',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2023-12-31']),
    });
    // nextPeriod = 2024-01-28
    expect(result.nextPeriod.startDate).toBe('2024-01-28');
    // fertileStart = 2024-01-28 - 19 = 2024-01-09
    expect(result.fertileWindow.startDate).toBe('2024-01-09');
    // fertileEnd   = 2024-01-28 - 14 = 2024-01-14
    expect(result.fertileWindow.endDate).toBe('2024-01-14');
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Duplicate / out-of-order / same-day entries
// ---------------------------------------------------------------------------

describe('collectPeriodStarts — deduplication and ordering', () => {
  test('out-of-order entries produce same result as sorted entries', () => {
    const orderedResult = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: logs(['2024-05-01'], ['2024-05-29']),
    });
    const unorderedResult = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: logs(['2024-05-29'], ['2024-05-01']),
    });
    expect(unorderedResult.cycleLengthDays).toBe(orderedResult.cycleLengthDays);
    expect(unorderedResult.current.cycleStartDate).toBe(orderedResult.current.cycleStartDate);
  });

  test('duplicate period start dates are treated as same start, not two cycles', () => {
    // Two identical entries on the same day: should count as 1 start
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [
        log('2024-06-01', 'medium'),
        log('2024-06-01', 'heavy'), // duplicate date
      ],
    });
    // Only 1 distinct start → confidence low
    expect(result.confidence.level).toBe('low');
    expect(result.history.startDates).toHaveLength(1);
  });

  test('same-day spotting entry does not create a new cycle (spotting not period evidence)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [
        log('2024-06-01', 'medium'),
        log('2024-06-03', 'spotting'), // spotting not counted
      ],
    });
    expect(result.history.startDates).toHaveLength(1);
  });

  test('mid-cycle bleed closer than 15 days does not create new period start', () => {
    // Start June 1, another bleed June 10 (9 days gap < MIN_CYCLE_SEPARATION=15)
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: logs(['2024-06-01'], ['2024-06-10']),
    });
    // Should only count 1 period start
    expect(result.history.startDates).toHaveLength(1);
  });

  test('two bleeds exactly 15 days apart ARE counted as 2 starts', () => {
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: logs(['2024-06-01'], ['2024-06-16']),
    });
    expect(result.history.startDates).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Section 7 — Cycle rollover (forward projection)
// ---------------------------------------------------------------------------

describe('cycle rollover projection', () => {
  test('last period was many cycles ago — cycleDay stays <= cycleLengthDays', () => {
    // Period was 100 days ago, cycle = 28 → should have rolled forward
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-03-01']),
    });
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(result.current.cycleDay).toBeLessThanOrEqual(result.cycleLengthDays);
  });

  test('rolled-forward limitation is added to result', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-03-01']),
    });
    expect(result.limitationCodes).toContain('projected-forward');
  });

  test('nextPeriod is always in the future relative to today', () => {
    const today = '2024-06-10';
    const result = buildPredictionResult({
      todayIso: today,
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-03-01']),
    });
    expect(diffDays(today, result.nextPeriod.startDate)).toBeGreaterThan(0);
  });

  test('extremely old start (365-day cycle, 1 year ago) — nextPeriod still in future', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 365 }),
      logEntries: logs(['2023-06-10']),
    });
    expect(diffDays('2024-06-10', result.nextPeriod.startDate)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Section 8 — Phase decomposition invariants (cyclePhaseModel)
// ---------------------------------------------------------------------------

describe('cyclePhaseModel — invariants over wide sweep', () => {
  const cycleLengths = [20, 21, 24, 28, 30, 32, 35, 40, 45, 60, 90, 365];
  const periodLengths = [1, 2, 3, 5, 7, 10, 14];

  for (const cl of cycleLengths) {
    for (const pl of periodLengths) {
      test(`cycleLength=${cl} periodLength=${pl}: phases sum = cycleLength`, () => {
        const bd = buildCyclePhaseBreakdown({ cycleLengthDays: cl, periodLengthDays: pl });
        const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
        // INVARIANT: sum should equal cycleLengthDays
        expect(sum).toBe(cl);
      });

      test(`cycleLength=${cl} periodLength=${pl}: no phase is negative`, () => {
        const bd = buildCyclePhaseBreakdown({ cycleLengthDays: cl, periodLengthDays: pl });
        expect(bd.periodDays).toBeGreaterThanOrEqual(0);
        expect(bd.follicularDays).toBeGreaterThanOrEqual(0);
        expect(bd.fertileDays).toBeGreaterThanOrEqual(0);
        expect(bd.lutealDays).toBeGreaterThanOrEqual(0);
      });

      test(`cycleLength=${cl} periodLength=${pl}: fertileDays = FERTILE_WINDOW_LENGTH_DAYS (6)`, () => {
        const bd = buildCyclePhaseBreakdown({ cycleLengthDays: cl, periodLengthDays: pl });
        // fertileDays is a hard constant in the model; it must always be 6
        expect(bd.fertileDays).toBe(FERTILE_WINDOW_LENGTH_DAYS);
      });
    }
  }

  test('periodLength > cycleLength: phases still sum to cycleLength', () => {
    // periodLength=30 > cycleLength=20
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 30 });
    const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
    expect(sum).toBe(20);
  });

  test('cycleLength=20, periodLength=1: fertileStart offset = 1, follicular = 0', () => {
    // fertileStartOffset = 20 - 19 = 1; periodDays = 1; follicular = max(0, 1-1) = 0
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 1 });
    expect(bd.follicularDays).toBe(0);
    expect(bd.fertileDays).toBe(6);
    // luteal = 20 - 1 - 0 - 6 = 13
    expect(bd.lutealDays).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Section 9 — buildCyclePhaseEndDays invariants
// ---------------------------------------------------------------------------

describe('buildCyclePhaseEndDays invariants', () => {
  test('lutealEnd always equals cycleLengthDays', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 5 });
    const ends = buildCyclePhaseEndDays(bd);
    expect(ends.lutealEnd).toBe(28);
  });

  test('end days are non-decreasing', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 5 });
    const ends = buildCyclePhaseEndDays(bd);
    expect(ends.periodEnd).toBeLessThanOrEqual(ends.follicularEnd);
    expect(ends.follicularEnd).toBeLessThanOrEqual(ends.fertileEnd);
    expect(ends.fertileEnd).toBeLessThanOrEqual(ends.lutealEnd);
  });

  test('periodLength > cycleLength: periodEnd capped at cycleLengthDays', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 30 });
    const ends = buildCyclePhaseEndDays(bd);
    expect(ends.periodEnd).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Section 10 — Irregular / supportsIrregularCycles
// ---------------------------------------------------------------------------

describe('supportsIrregularCycles confidence', () => {
  test('3 starts + irregular flag → medium (not high)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: logs(['2024-04-01'], ['2024-04-29'], ['2024-05-27']),
    });
    expect(result.confidence.level).toBe('medium');
  });

  test('2 starts + irregular flag → medium', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ supportsIrregularCycles: true }),
      logEntries: logs(['2024-05-01'], ['2024-05-29']),
    });
    expect(result.confidence.level).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// Section 11 — onboarding-seed path
// ---------------------------------------------------------------------------

describe('onboarding-seed path', () => {
  test('no log entries, lastPeriodStartDate set → onboarding-seed, cycle=29', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ lastPeriodStartDate: '2024-06-01', cycleLengthDays: 29 }),
      logEntries: [],
    });
    expect(result.history.source).toBe('onboarding-seed');
    // cycleLengthDays from profile for seed path
    expect(result.cycleLengthDays).toBe(29);
  });

  test('onboarding-seed adds correct limitation code', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ lastPeriodStartDate: '2024-06-01' }),
      logEntries: [],
    });
    expect(result.limitationCodes).toContain('onboarding-seed-active');
  });

  test('no log entries, no lastPeriodStartDate, source=onboarding-seed, default cycle=29', () => {
    // source is 'onboarding-seed' → defaultCycleLength = 29
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// Section 12 — Specific degenerate cycle: periodLength longer than cycleLength
// ---------------------------------------------------------------------------

describe('periodLength > cycleLength degenerate cases', () => {
  test('cycleLength=20 periodLength=25: buildCyclePhaseBreakdown fertileStart offset = 1, period clamped to 20', () => {
    // fertileStartOffset = 20 - 19 = 1
    // periodDays = max(0, 25) = 25 (no clamp in buildCyclePhaseBreakdown itself)
    // follicular = max(0, 1 - 25) = 0
    // fertile = 6
    // luteal = max(0, 20 - 25 - 0 - 6) = max(0, -11) = 0
    // sum = 25 + 0 + 6 + 0 = 31 ≠ 20 → BUG CANDIDATE
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 25 });
    const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
    // Document expected vs actual:
    // Clinical expectation: sum should equal cycleLength (20)
    // If this fails, it's a confirmed bug.
    expect(sum).toBe(20);
  });

  test('cycleLength=28 periodLength=30: phases sum to 28', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 30 });
    const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
    expect(sum).toBe(28);
  });

  test('cycleLength=20 periodLength=20: sum = 20', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 20 });
    const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
    expect(sum).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Section 13 — fertileWindow vs cycleStartDate degenerate check
// ---------------------------------------------------------------------------

describe('fertileWindow relative to cycleStartDate for edge cycle lengths', () => {
  // For any supported cycleLength, fertileWindow.startDate must be >= cycleStartDate
  const cycleLengths = [20, 21, 22, 25, 28, 30];
  for (const cl of cycleLengths) {
    test(`cycleLength=${cl}: fertileWindow.startDate >= cycleStartDate`, () => {
      const result = buildPredictionResult({
        todayIso: '2024-06-01',
        profile: profile({ cycleLengthDays: cl }),
        logEntries: logs(['2024-06-01']),
      });
      const offset = diffDays(result.current.cycleStartDate, result.fertileWindow.startDate);
      // A negative offset means the fertile window starts before the cycle — degenerate
      expect(offset).toBeGreaterThanOrEqual(0);
    });
  }

  // The theoretical minimum: cycleLength=20 → fertileStart = cycleStart + 1 (barely OK)
  test('cycleLength=20: fertileStart offset from cycleStart = 1', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 20 }),
      logEntries: logs(['2024-06-01']),
    });
    const offset = diffDays(result.current.cycleStartDate, result.fertileWindow.startDate);
    expect(offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 14 — Cycle day accuracy
// ---------------------------------------------------------------------------

describe('cycleDay accuracy', () => {
  test('today = cycleStartDate → cycleDay = 1', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-10']),
    });
    expect(result.current.cycleDay).toBe(1);
  });

  test('today = cycleStartDate + 27 → cycleDay = 28', () => {
    const result = buildPredictionResult({
      todayIso: '2024-07-07', // 2024-06-10 + 27 days
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-10']),
    });
    expect(result.current.cycleDay).toBe(28);
  });

  test('cycleDay never < 1', () => {
    // today is before the period start (shouldn't happen in practice but guard it)
    const result = buildPredictionResult({
      todayIso: '2024-06-05',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-10']),
    });
    // cycleStartDate will be rolled to something, cycleDay >= 1
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Section 15 — Spotting / 'none' bleeding not counted as period evidence
// ---------------------------------------------------------------------------

describe('bleeding intensity filtering', () => {
  test('only spotting logged → no period starts detected, falls to onboarding-seed', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [
        log('2024-06-01', 'spotting'),
        log('2024-06-02', 'spotting'),
      ],
    });
    expect(result.history.source).toBe('onboarding-seed');
  });

  test('none bleeding → not evidence', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile(),
      logEntries: [log('2024-06-01', 'none')],
    });
    expect(result.history.source).toBe('onboarding-seed');
  });
});

// ---------------------------------------------------------------------------
// Section 16 — Contiguous bleeding episode: only first day is "start"
// ---------------------------------------------------------------------------

describe('contiguous bleeding episodes', () => {
  test('5 consecutive days of medium bleeding = 1 period start', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-15',
      profile: profile(),
      logEntries: logs(
        ['2024-06-01'],
        ['2024-06-02'],
        ['2024-06-03'],
        ['2024-06-04'],
        ['2024-06-05'],
      ),
    });
    expect(result.history.startDates).toHaveLength(1);
    expect(result.history.startDates[0]).toBe('2024-06-01');
  });

  test('gap of 1 day mid-bleed creates a second start (>= 15 days apart from previous)', () => {
    // Start June 1, skip June 3, resume June 4 → but June 4 is only 3 days from June 1
    // < 15 MIN_CYCLE_SEPARATION, so June 4 should NOT create a new start
    const result = buildPredictionResult({
      todayIso: '2024-06-15',
      profile: profile(),
      logEntries: logs(['2024-06-01'], ['2024-06-02'], ['2024-06-04']),
    });
    // June 4 is only 3 days from June 1 → still 1 start
    expect(result.history.startDates).toHaveLength(1);
  });
});
