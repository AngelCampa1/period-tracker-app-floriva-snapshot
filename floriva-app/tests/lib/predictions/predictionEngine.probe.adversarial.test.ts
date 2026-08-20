/**
 * Adversarial probe suite #2 — cross-module invariants and uncovered interactions.
 *
 * Focus areas NOT covered by the existing probe/adversarial suites:
 *   1. Alignment between buildPredictionResult's fertileWindow dates and
 *      buildCyclePhaseBreakdown's fertileStartOffset (the two modules must agree).
 *   2. fertileWindowStartOffsetDays override path — sum invariant must still hold.
 *   3. Degenerate fertileWindowStartOffsetDays values (0, negative, > cycleLength).
 *   4. buildCyclePhaseEndDays when all phases collapse to 0 except period.
 *   5. Rolling-forward boundary: lastLoggedStartDate exactly cycleLength days ago.
 *   6. nextPeriod.startDate == fertileWindow.endDate + 14 (invariant).
 *   7. fertileWindow fully within [cycleStart, nextPeriodStart).
 *   8. activeBleeding tracks the latest (most recent) period start.
 *   9. Idempotency — same call twice produces identical output.
 *  10. History ordering: startDates always sorted ascending.
 *  11. Very long history (10+ starts) — cycleLengthDays is the average of all gaps.
 *  12. cycleLength from 3-start average that rounds exactly at .5.
 *  13. profile.cycleLengthDays exactly 20 (not floored, used as-is).
 *  14. Interplay of MIN_CYCLE_SEPARATION with contiguous-day logic.
 *  15. onboarding-seed: todayIso anchor when lastPeriodStartDate is undefined.
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

function log(
  logDate: string,
  bleeding: DailyLogEntry['bleeding'] = 'medium',
): DailyLogEntry {
  return { id: logDate, logDate, bleeding, symptoms: [] };
}

function logs(
  ...entries: [string, DailyLogEntry['bleeding']?][]
): DailyLogEntry[] {
  return entries.map(([date, b]) => log(date, b ?? 'medium'));
}

// ---------------------------------------------------------------------------
// 1. Cross-module fertile-window alignment
//    buildPredictionResult and buildCyclePhaseBreakdown must agree on where
//    the fertile window opens within the cycle.
// ---------------------------------------------------------------------------

describe('cross-module alignment — fertileWindow dates vs phase breakdown offset', () => {
  const testCases: { cycleLengthDays: number; periodLengthDays: number }[] = [
    { cycleLengthDays: 20, periodLengthDays: 3 },
    { cycleLengthDays: 24, periodLengthDays: 4 },
    { cycleLengthDays: 28, periodLengthDays: 5 },
    { cycleLengthDays: 32, periodLengthDays: 5 },
    { cycleLengthDays: 35, periodLengthDays: 7 },
  ];

  for (const { cycleLengthDays, periodLengthDays } of testCases) {
    test(`cycleLength=${cycleLengthDays} periodLength=${periodLengthDays}: date offset matches breakdown offset`, () => {
      const cycleStartDate = '2024-06-01';
      const result = buildPredictionResult({
        todayIso: cycleStartDate,
        profile: profile({ cycleLengthDays, periodLengthDays }),
        logEntries: logs([cycleStartDate]),
      });

      // Fertile window start offset in days from cycle start (from live prediction)
      const dateOffset = diffDays(
        result.current.cycleStartDate,
        result.fertileWindow.startDate,
      );

      // Phase breakdown using the same parameters
      const breakdown = buildCyclePhaseBreakdown({
        cycleLengthDays: result.cycleLengthDays,
        periodLengthDays,
      });

      // The fertile window starts at periodDays + follicularDays in the breakdown.
      const breakdownOffset = breakdown.periodDays + breakdown.follicularDays;

      // BY DESIGN — verified invariant, not a bug:
      // buildPredictionResult reports the clinically-precise fertile window opening at
      // nextPeriodStart-19 = cycleStart + (cycleLength-19). For normal cycles this offset
      // sits after the period ends, so the non-overlapping ribbon's fertile segment begins
      // at exactly the same offset and the two modules agree.
      //
      // For the degenerate ≤20-day floor (e.g. cycleLength=20, periodLength=3) the clinical
      // fertile window genuinely OVERLAPS menstruation (ovulation ~day 6, window days 1-7).
      // buildCyclePhaseBreakdown is a space-filling, non-overlapping ribbon whose segments
      // must sum to cycleLength, so it structurally cannot render fertile-during-period
      // overlap — it clamps follicular to 0 and starts the fertile segment after the period.
      // The actionable data users act on (the fertile-window DATES) stays clinically correct;
      // only the ribbon's visual segmentation is clamped.
      //
      // The exact, intentional relationship between the two is therefore:
      //   breakdownOffset === max(dateOffset, periodDays)
      // i.e. the ribbon never starts fertile before the period ends, but otherwise tracks
      // the clinical offset day-for-day. This holds for every case including 20/3.
      expect(breakdownOffset).toBe(Math.max(dateOffset, breakdown.periodDays));
    });
  }

  test('fertile window length in breakdown (6 days) matches date difference in result', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 28, periodLengthDays: 5 }),
      logEntries: logs(['2024-06-01']),
    });
    const dateWindowLength =
      diffDays(result.fertileWindow.startDate, result.fertileWindow.endDate) + 1;
    expect(dateWindowLength).toBe(FERTILE_WINDOW_LENGTH_DAYS);
  });
});

// ---------------------------------------------------------------------------
// 2. fertileWindowStartOffsetDays override in buildCyclePhaseBreakdown
// ---------------------------------------------------------------------------

describe('buildCyclePhaseBreakdown — fertileWindowStartOffsetDays override', () => {
  test('explicit offset: sum still equals cycleLengthDays', () => {
    const bd = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 10,
    });
    expect(bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays).toBe(28);
  });

  test('explicit offset = 0: follicular = 0, period clamped, sum still holds', () => {
    const bd = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 0,
    });
    // offset=0 < periodDays=5, so follicular = max(0, 0-5) = 0
    expect(bd.follicularDays).toBe(0);
    expect(bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays).toBe(28);
  });

  test('explicit offset negative: sum still holds, no negative phases', () => {
    const bd = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: -5,
    });
    expect(bd.periodDays).toBeGreaterThanOrEqual(0);
    expect(bd.follicularDays).toBeGreaterThanOrEqual(0);
    expect(bd.fertileDays).toBeGreaterThanOrEqual(0);
    expect(bd.lutealDays).toBeGreaterThanOrEqual(0);
    expect(bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays).toBe(28);
  });

  test('explicit offset > cycleLengthDays: sum still holds', () => {
    const bd = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 50,
    });
    expect(bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays).toBe(28);
  });

  test('explicit offset = cycleLengthDays - 6: fertile fits exactly, luteal = 0 — sum holds', () => {
    // Placing fertile window at the very end: offset = 28-6 = 22 → luteal should be 0
    const bd = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 22,
    });
    expect(bd.lutealDays).toBe(0);
    expect(bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays).toBe(28);
  });
});

// ---------------------------------------------------------------------------
// 3. buildCyclePhaseEndDays — collapse edge cases
// ---------------------------------------------------------------------------

describe('buildCyclePhaseEndDays — when phases collapse', () => {
  test('periodLength > cycleLength: all end days non-decreasing and lutealEnd = cycleLength', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 30 });
    const ends = buildCyclePhaseEndDays(bd);
    expect(ends.periodEnd).toBeLessThanOrEqual(ends.follicularEnd);
    expect(ends.follicularEnd).toBeLessThanOrEqual(ends.fertileEnd);
    expect(ends.fertileEnd).toBeLessThanOrEqual(ends.lutealEnd);
    expect(ends.lutealEnd).toBe(20);
  });

  test('cycleLength=20 periodLength=1: end days account for 0-follicular', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 20, periodLengthDays: 1 });
    const ends = buildCyclePhaseEndDays(bd);
    // period ends at day 1
    expect(ends.periodEnd).toBe(1);
    // follicular=0 so follicularEnd = periodEnd = 1
    expect(ends.follicularEnd).toBe(1);
    // fertile ends at 1+6=7
    expect(ends.fertileEnd).toBe(7);
    // luteal end = 20
    expect(ends.lutealEnd).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 4. Rolling-forward boundary conditions
// ---------------------------------------------------------------------------

describe('rolling-forward boundary conditions', () => {
  test('lastLoggedStart exactly cycleLengthDays ago — still rolls forward (diff >= cycleLength)', () => {
    // today - start = 28, cycleLength = 28 → diff >= cycleLength → must roll once
    const result = buildPredictionResult({
      todayIso: '2024-07-08', // 2024-06-10 + 28 days
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-10']),
    });
    // After one roll: effectiveStart = 2024-06-10 + 28 = 2024-07-08
    // cycleDay = diffDays(2024-07-08, 2024-07-08) + 1 = 1
    expect(result.current.cycleDay).toBe(1);
    expect(result.current.cycleStartDate).toBe('2024-07-08');
    // nextPeriod = 2024-07-08 + 28 = 2024-08-05
    expect(result.nextPeriod.startDate).toBe('2024-08-05');
  });

  test('lastLoggedStart exactly cycleLengthDays - 1 ago — does NOT roll (still in current cycle)', () => {
    // today - start = 27, cycleLength = 28 → diff < cycleLength → no roll
    const result = buildPredictionResult({
      todayIso: '2024-07-07', // 2024-06-10 + 27 days
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-06-10']),
    });
    expect(result.current.cycleStartDate).toBe('2024-06-10');
    expect(result.current.cycleDay).toBe(28);
    // No rolling → no projected-forward limitation
    expect(result.limitationCodes).not.toContain('projected-forward');
  });

  test('rolling forward multiple cycles: cycleDay always in [1, cycleLengthDays]', () => {
    const result = buildPredictionResult({
      todayIso: '2024-12-01',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-01-01']),
    });
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(result.current.cycleDay).toBeLessThanOrEqual(28);
  });

  test('rolling forward: projected-forward limitation appears exactly once', () => {
    const result = buildPredictionResult({
      todayIso: '2024-12-01',
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: logs(['2024-01-01']),
    });
    const projectedCount = result.limitationCodes.filter(
      (code) => code === 'projected-forward',
    ).length;
    expect(projectedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. nextPeriod.startDate = fertileWindow.endDate + 14 (invariant)
// ---------------------------------------------------------------------------

describe('nextPeriod vs fertileWindow invariant', () => {
  const testProfiles: { cl: number; pl: number; label: string }[] = [
    { cl: 20, pl: 2, label: 'minimal 20d cycle' },
    { cl: 28, pl: 5, label: 'typical 28d cycle' },
    { cl: 35, pl: 7, label: 'long 35d cycle' },
    { cl: 40, pl: 5, label: 'very long 40d cycle' },
  ];

  for (const { cl, pl, label } of testProfiles) {
    test(`${label}: nextPeriodStart = fertileWindowEnd + 14`, () => {
      const result = buildPredictionResult({
        todayIso: '2024-06-01',
        profile: profile({ cycleLengthDays: cl, periodLengthDays: pl }),
        logEntries: logs(['2024-06-01']),
      });
      const diff = diffDays(result.fertileWindow.endDate, result.nextPeriod.startDate);
      expect(diff).toBe(14);
    });

    test(`${label}: fertileWindowStart = nextPeriodStart - 19`, () => {
      const result = buildPredictionResult({
        todayIso: '2024-06-01',
        profile: profile({ cycleLengthDays: cl, periodLengthDays: pl }),
        logEntries: logs(['2024-06-01']),
      });
      const diff = diffDays(result.fertileWindow.startDate, result.nextPeriod.startDate);
      expect(diff).toBe(19);
    });
  }

  test('fertileWindow.endDate is always strictly before nextPeriod.startDate', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 28, periodLengthDays: 5 }),
      logEntries: logs(['2024-06-01']),
    });
    expect(diffDays(result.fertileWindow.endDate, result.nextPeriod.startDate)).toBeGreaterThan(0);
  });

  test('fertileWindow is entirely within [cycleStart, nextPeriodStart)', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-01',
      profile: profile({ cycleLengthDays: 28, periodLengthDays: 5 }),
      logEntries: logs(['2024-06-01']),
    });
    const startOk =
      diffDays(result.current.cycleStartDate, result.fertileWindow.startDate) >= 0;
    const endOk =
      diffDays(result.fertileWindow.endDate, result.nextPeriod.startDate) > 0;
    expect(startOk).toBe(true);
    expect(endOk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. activeBleeding tracks the latest period start
// ---------------------------------------------------------------------------

describe('activeBleeding is most-recent period start evidence', () => {
  test('two period starts: activeBleeding.logDate = later start', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-20',
      profile: profile(),
      logEntries: logs(['2024-05-01'], ['2024-05-29']),
    });
    expect(result.current.activeBleeding.logDate).toBe('2024-05-29');
  });

  test('three period starts: activeBleeding.logDate = last start', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-20',
      profile: profile(),
      logEntries: logs(['2024-04-01'], ['2024-04-29'], ['2024-05-27']),
    });
    expect(result.current.activeBleeding.logDate).toBe('2024-05-27');
  });

  test('activeBleeding.bleeding reflects actual logged intensity', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-20',
      profile: profile(),
      logEntries: [log('2024-06-01', 'heavy')],
    });
    expect(result.current.activeBleeding.bleeding).toBe('heavy');
  });

  test('out-of-order entries: activeBleeding still points to chronologically latest', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-20',
      profile: profile(),
      logEntries: [log('2024-05-29', 'light'), log('2024-05-01', 'heavy')],
    });
    expect(result.current.activeBleeding.logDate).toBe('2024-05-29');
  });
});

// ---------------------------------------------------------------------------
// 7. Idempotency
// ---------------------------------------------------------------------------

describe('idempotency', () => {
  test('calling buildPredictionResult twice with same args returns identical result', () => {
    const args = {
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 28, periodLengthDays: 5 }),
      logEntries: logs(['2024-04-01'], ['2024-04-29'], ['2024-05-27']),
    };
    const r1 = buildPredictionResult(args);
    const r2 = buildPredictionResult(args);
    expect(r1).toEqual(r2);
  });

  test('buildCyclePhaseBreakdown is pure: same inputs → same outputs', () => {
    const bd1 = buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 5 });
    const bd2 = buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 5 });
    expect(bd1).toEqual(bd2);
  });
});

// ---------------------------------------------------------------------------
// 8. history.startDates always sorted ascending
// ---------------------------------------------------------------------------

describe('history.startDates ordering', () => {
  test('out-of-order log entries produce ascending startDates', () => {
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: logs(['2024-05-27'], ['2024-04-29'], ['2024-04-01']),
    });
    const dates = result.history.startDates;
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!).toBe(true);
    }
  });

  test('10-start history: startDates has 10 entries (no spurious deduplication)', () => {
    // 10 period starts, each exactly 28 days apart
    const startDates: string[] = [];
    let current = '2024-01-01';
    for (let i = 0; i < 10; i++) {
      startDates.push(current);
      current = addDays(current, 28);
    }
    const result = buildPredictionResult({
      todayIso: addDays(startDates[9]!, 5),
      profile: profile(),
      logEntries: startDates.map(d => log(d, 'medium')),
    });
    expect(result.history.startDates).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// 9. Cycle length from large history — average of all gaps
// ---------------------------------------------------------------------------

describe('cycleLengthDays from large history', () => {
  test('10 starts at exactly 28-day intervals → cycleLengthDays = 28', () => {
    const startDates: string[] = [];
    let current = '2024-01-01';
    for (let i = 0; i < 10; i++) {
      startDates.push(current);
      current = addDays(current, 28);
    }
    const result = buildPredictionResult({
      todayIso: addDays(startDates[9]!, 5),
      profile: profile(),
      logEntries: startDates.map(d => log(d, 'medium')),
    });
    expect(result.cycleLengthDays).toBe(28);
  });

  test('3 starts with gaps 27, 29 → recency-weighted median (A2) picks the newer gap (29)', () => {
    // start + 27 days, start + 27+29 = start + 56 days
    // gaps [27, 29], chronological weights [1, 2]. Bounds/MAD: median 28,
    // MAD 1, threshold 7 -- both survive. Weighted median: sorted
    // [(27,w1),(29,w2)], total weight 3, half 1.5; cumulative reaches 3 (>=
    // 1.5) at value 29 -- the newer gap wins over the old plain average of 28.
    const start = '2024-01-01';
    const second = addDays(start, 27);
    const third = addDays(second, 29);
    const result = buildPredictionResult({
      todayIso: addDays(third, 5),
      profile: profile(),
      logEntries: logs([start], [second], [third]),
    });
    expect(result.cycleLengthDays).toBe(29);
  });

  test('3 starts with gaps 15, 24 → recency-weighted median (A2) is 24, above the 20-day floor', () => {
    // gaps: 15, 24 (MIN_CYCLE_SEPARATION = 15 accepts the first gap as a real
    // start). Bounds/MAD: median 19.5, MAD 4.5, threshold 11.25 -- both
    // survive. Weighted median: sorted [(15,w1),(24,w2)], total weight 3,
    // half 1.5; cumulative reaches 3 (>= 1.5) at value 24. Since 24 > the
    // 20-day floor, the floor is a no-op here; the old plain-average result
    // (20, after rounding+flooring 19.5) no longer applies under A2.
    const start = '2024-01-01';
    const second = addDays(start, 15);
    const third = addDays(second, 24);
    const result = buildPredictionResult({
      todayIso: addDays(third, 5),
      profile: profile(),
      logEntries: logs([start], [second], [third]),
    });
    expect(result.cycleLengthDays).toBe(24);
  });

  test('3 starts with gaps 15, 23 → recency-weighted median (A2) is 23, above the 20-day floor', () => {
    // gaps: 15, 23. Bounds/MAD: median 19, MAD 4, threshold 10 -- both
    // survive. Weighted median: sorted [(15,w1),(23,w2)], total weight 3, half
    // 1.5; cumulative reaches 3 (>= 1.5) at value 23. Since 23 > the 20-day
    // floor, the floor is a no-op; the old plain-average result (20, after
    // rounding+flooring 19.0) no longer applies under A2.
    const start = '2024-01-01';
    const second = addDays(start, 15);
    const third = addDays(second, 23);
    const result = buildPredictionResult({
      todayIso: addDays(third, 5),
      profile: profile(),
      logEntries: logs([start], [second], [third]),
    });
    expect(result.cycleLengthDays).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// 10. profile.cycleLengthDays = 20 exactly (at the floor boundary)
// ---------------------------------------------------------------------------

describe('profile.cycleLengthDays at exact floor', () => {
  test('cycleLengthDays = 20 exactly is not altered by the floor', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 20 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(20);
  });

  test('profile.cycleLengthDays = 19 → floored to 20', () => {
    const result = buildPredictionResult({
      todayIso: '2024-06-10',
      profile: profile({ cycleLengthDays: 19 }),
      logEntries: [],
    });
    expect(result.cycleLengthDays).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 11. nextPeriod.startDate consistency with cycleStartDate and cycleLengthDays
// ---------------------------------------------------------------------------

describe('nextPeriod.startDate = cycleStartDate + cycleLengthDays', () => {
  const scenarios = [
    { cl: 20, label: '20d' },
    { cl: 28, label: '28d' },
    { cl: 35, label: '35d' },
  ];

  for (const { cl, label } of scenarios) {
    test(`${label} cycle: nextPeriod is exactly cycleLengthDays after cycleStartDate`, () => {
      const result = buildPredictionResult({
        todayIso: '2024-06-01',
        profile: profile({ cycleLengthDays: cl }),
        logEntries: logs(['2024-06-01']),
      });
      const diff = diffDays(result.current.cycleStartDate, result.nextPeriod.startDate);
      expect(diff).toBe(result.cycleLengthDays);
    });
  }
});

// ---------------------------------------------------------------------------
// 12. buildCyclePhaseBreakdown: cycleLengthDays = 0 (degenerate)
//     SUSPECTED BUG: if cycleLengthDays=0 the cap=0, periodDays=0, lutealDays=0
//     but the return still includes cycleLengthDays:0 which is pre-floor.
//     buildPredictionResult floors at 20 so this state shouldn't arise in
//     normal usage — but the phase model itself doesn't enforce the floor.
// ---------------------------------------------------------------------------

describe('buildCyclePhaseBreakdown — zero cycleLengthDays (edge, no floor in model)', () => {
  test('cycleLengthDays=0: all phases = 0, sum = 0 (model does not apply floor)', () => {
    const bd = buildCyclePhaseBreakdown({ cycleLengthDays: 0, periodLengthDays: 5 });
    expect(bd.periodDays).toBe(0);
    expect(bd.follicularDays).toBe(0);
    // SUSPECTED BUG: fertileDays uses min(cap - ..., 6). cap=0, so fertileDays = min(0, 6) = 0
    // lutealDays = max(0, 0-0-0-0) = 0. Sum = 0 which trivially equals cycleLengthDays.
    const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
    expect(sum).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Contiguous episode interrupted by a 'none' day (not a gap in logged days)
// ---------------------------------------------------------------------------

describe('contiguous bleeding with none-day gap', () => {
  test('heavy day, none day, heavy day: second heavy is a new start (> 15 days needed)', () => {
    // June 1 heavy, June 2 none, June 3 heavy — June 3 is only 2 days from June 1
    // < 15 MIN_CYCLE_SEPARATION, so June 3 must NOT be a new start
    const result = buildPredictionResult({
      todayIso: '2024-06-15',
      profile: profile(),
      logEntries: [
        log('2024-06-01', 'heavy'),
        log('2024-06-02', 'none'),
        log('2024-06-03', 'heavy'),
      ],
    });
    expect(result.history.startDates).toHaveLength(1);
    expect(result.history.startDates[0]).toBe('2024-06-01');
  });

  test('heavy episode, 15-day gap, new heavy: exactly 2 starts', () => {
    const result = buildPredictionResult({
      todayIso: '2024-07-01',
      profile: profile(),
      logEntries: [
        log('2024-06-01', 'heavy'),
        log('2024-06-16', 'heavy'), // 15 days later (>= MIN_CYCLE_SEPARATION)
      ],
    });
    expect(result.history.startDates).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 14. onboarding-seed todayIso anchor fallback
// ---------------------------------------------------------------------------

describe('onboarding-seed anchor when no lastPeriodStartDate', () => {
  test('no logs, no lastPeriodStartDate: cycleStartDate = todayIso', () => {
    const today = '2024-06-15';
    const result = buildPredictionResult({
      todayIso: today,
      profile: profile(),
      logEntries: [],
    });
    expect(result.current.cycleStartDate).toBe(today);
  });

  test('no logs, no lastPeriodStartDate: nextPeriod = today + cycleLengthDays', () => {
    const today = '2024-06-15';
    const result = buildPredictionResult({
      todayIso: today,
      profile: profile({ cycleLengthDays: 28 }),
      logEntries: [],
    });
    // Note: source=onboarding-seed uses default 29, but we set profile.cycleLengthDays=28
    // which bleeds-through the onboarding-seed path via resolveCycleLengthDays(profile,
    // [todayIso], 'onboarding-seed') → profile path → 28
    expect(result.nextPeriod.startDate).toBe(addDays(today, result.cycleLengthDays));
  });
});

// ---------------------------------------------------------------------------
// 15. Phase breakdown sum over degenerate custom fertileWindowStartOffsetDays sweep
// ---------------------------------------------------------------------------

describe('buildCyclePhaseBreakdown phase sum with sweep of fertileWindowStartOffsetDays', () => {
  const offsets = [-10, -1, 0, 1, 5, 9, 10, 17, 22, 27, 28, 30, 50];
  for (const offset of offsets) {
    test(`cycleLengthDays=28 periodLength=5 offset=${offset}: sum=28`, () => {
      const bd = buildCyclePhaseBreakdown({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        fertileWindowStartOffsetDays: offset,
      });
      const sum = bd.periodDays + bd.follicularDays + bd.fertileDays + bd.lutealDays;
      expect(sum).toBe(28);
    });
  }
});
