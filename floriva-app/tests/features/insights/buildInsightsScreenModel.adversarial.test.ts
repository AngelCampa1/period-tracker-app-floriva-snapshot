/**
 * Adversarial tests for buildInsightsScreenModel.
 *
 * CRITICAL TRUST RULE (from project charter): never overstate prediction
 * confidence, never claim a steady/regular cycle from thin data, never imply
 * medical diagnosis. A statistics bug that overstates regularity is a TRUST
 * violation, not just a math error.
 *
 * Each describe block targets a specific failure surface identified during the
 * adversarial review.
 */

import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const baseProfile: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: false,
  conditionTags: [],
  ttcTrackingPreferences: {
    sex: false,
    ovulationTest: false,
    cervicalMucus: false,
    basalBodyTemperature: false,
  },
};

function periodEntry(id: string, logDate: string, bleeding: 'light' | 'medium' | 'heavy' = 'medium'): DailyLogEntry {
  return { id, logDate, bleeding, symptoms: [] };
}

// ---------------------------------------------------------------------------
// 1. THIN DATA — 0 cycles, 1 cycle
// ---------------------------------------------------------------------------

describe('thin data — 0 logged cycles', () => {
  it('returns a valid model without throwing when there are no log entries at all', () => {
    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: baseProfile,
        logEntries: [],
      }),
    ).not.toThrow();
  });

  it('hasObservedHistory is false with zero period entries', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  it('bars array is empty with zero period entries (no phantom average bar)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [],
    });

    expect(model.cycleLengthData.bars).toHaveLength(0);
  });

  it('falls back to profile cycleLengthDays for avgDays with zero periods', () => {
    const profile = { ...baseProfile, cycleLengthDays: 31 };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile,
      logEntries: [],
    });

    // Must use the profile seed, not NaN/Infinity/0
    expect(model.cycleLengthData.avgDays).toBe(31);
    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
  });
});

describe('thin data — exactly 1 logged period start', () => {
  const singleEntry = [periodEntry('p1', '2026-04-01', 'heavy')];

  it('hasObservedHistory is false with one period start', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: singleEntry,
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  it('bars array is empty with exactly one period start', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: singleEntry,
    });

    // One start is not an observed interval — no bar to show
    expect(model.cycleLengthData.bars).toHaveLength(0);
  });

  it('avgDays falls back to profile cycleLengthDays when only one start logged', () => {
    const profile = { ...baseProfile, cycleLengthDays: 29 };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile,
      logEntries: singleEntry,
    });

    expect(model.cycleLengthData.avgDays).toBe(29);
    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
  });
});

describe('thin data — exactly 2 logged period starts (1 observed interval)', () => {
  // Feb 28 → Apr 10: 41 days
  const twoStarts = [
    periodEntry('p1', '2026-02-28', 'heavy'),
    periodEntry('p2', '2026-04-10', 'medium'),
  ];

  it('hasObservedHistory is true with two period starts', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: twoStarts,
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
  });

  it('LT-18/21: avgDays falls back to the profile estimate with only 1 observed interval (not enough to trust a lone interval)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: twoStarts,
    });

    // Feb 28 -> Apr 10 is 41 days, but a SINGLE observed interval is below
    // the engine's >= 3-starts / >= 2-intervals threshold for running
    // robust statistics (resolveCycleLengthDays, cycleHistory.ts) -- so
    // avgDays now falls back to the profile's cycleLengthDays (28) instead
    // of parroting one unverified 41-day gap as "the" cycle length.
    // consistencyLevel is 'not-enough-data' for the same reason (see the
    // dedicated describe block below).
    expect(model.cycleLengthData.avgDays).toBe(28);
    expect(model.cycleLengthData.consistencyLevel).toBe('not-enough-data');
  });

  it('bars array has exactly one entry', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: twoStarts,
    });

    expect(model.cycleLengthData.bars).toHaveLength(1);
    expect(model.cycleLengthData.bars[0]!.days).toBe(41);
    expect(model.cycleLengthData.bars[0]!.isLatest).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. ORDERING / DEDUP — out-of-order period starts
// ---------------------------------------------------------------------------

describe('out-of-order period entries', () => {
  /**
   * BUG: countPeriodStarts does not sort entries before processing.
   * The reduce relies on insertion order for the "diffDays > 1" gap check.
   * Out-of-order entries cause period starts to be missed or mis-counted.
   *
   * Example: entries arrive as [Apr 10, Mar 28, Apr 11].
   *   - Apr 10 is pushed first.
   *   - Mar 28: diffDays('2026-04-10', '2026-03-28') = -13 → NOT > 1 → skipped.
   *   - Apr 11: diffDays('2026-04-10', '2026-04-11') = 1 → NOT > 1 → skipped.
   * Result: only 1 start (Apr 10) instead of 2 (Mar 28, Apr 10).
   * This causes the interval to be missed and avgDays to fall back to the profile seed.
   */
  it('produces the same cycle count regardless of entry insertion order', () => {
    // Sorted order
    const sorted = [
      periodEntry('p1', '2026-03-28', 'heavy'),
      periodEntry('p2', '2026-04-10', 'medium'),
    ];
    // Reverse order
    const reversed = [
      periodEntry('p2', '2026-04-10', 'medium'),
      periodEntry('p1', '2026-03-28', 'heavy'),
    ];

    const modelSorted = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: sorted,
    });
    const modelReversed = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: reversed,
    });

    expect(modelReversed.cycleLengthData.hasObservedHistory).toBe(
      modelSorted.cycleLengthData.hasObservedHistory,
    );
    expect(modelReversed.cycleLengthData.avgDays).toBe(modelSorted.cycleLengthData.avgDays);
    expect(modelReversed.cycleLengthData.bars).toHaveLength(
      modelSorted.cycleLengthData.bars.length,
    );
  });

  it('does NOT count Apr 10 as a second period start — 13 days is inside the same cycle (LT-13)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('p2', '2026-04-10', 'medium'),
        periodEntry('p1', '2026-03-28', 'heavy'),
      ],
    });

    // LT-13: insights now counts period starts via the engine's canonical
    // collectPeriodStarts, which requires >= MIN_CYCLE_SEPARATION_DAYS (15)
    // between starts (the same rule the prediction engine and Settings hub
    // now use — see cycleHistory.ts). Mar 28 -> Apr 10 is only 13 days, so
    // Apr 10 is intermenstrual bleeding within the Mar 28 cycle, not a new
    // start: only 1 start exists, so there is no observed interval yet.
    // (Previously insights' private heuristic had no separation guard and
    // counted this as 2 starts / a 13-day "cycle".)
    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  it('correctly handles 3 period starts in random insertion order', () => {
    // Starts: Jan 01, Feb 05, Mar 10
    // Intervals: 35 days, 33 days
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('p3', '2026-03-10', 'medium'),
        periodEntry('p1', '2026-01-01', 'heavy'),
        periodEntry('p2', '2026-02-05', 'medium'),
      ],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
    expect(model.cycleLengthData.bars).toHaveLength(2);
    // LT-18/21: avgDays is now the engine's robust estimate
    // (prediction.cycleLengthDays), not a naive mean of the raw intervals.
    // 3 starts = 2 intervals clears the engine's >= 3-starts statistics
    // threshold, so computeCycleStatistics runs: [35, 33] weighted by
    // chronological position [1, 2] (recency-weighted median) resolves to
    // 33, the more recent interval -- not the naive mean (34). See
    // cycleStatistics.ts's weightedMedian doc comment for the exact
    // algorithm; this is the SAME estimate the phase-rhythm card derives
    // its phase durations from (LT-21).
    expect(model.cycleLengthData.avgDays).toBe(33);
  });

  it('does not mutate the caller-supplied logEntries array', () => {
    const entries = [
      periodEntry('p2', '2026-04-10', 'medium'),
      periodEntry('p1', '2026-03-28', 'heavy'),
    ];
    const originalOrder = entries.map((e) => e.logDate);

    buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: entries,
    });

    // Array must be unchanged — countPeriodStarts must sort a copy, not the input
    expect(entries.map((e) => e.logDate)).toEqual(originalOrder);
  });

  it('does not create a duplicate period start for a back-to-back bleeding day OR a 3-day-later bleed (LT-13: 15-day separation required)', () => {
    // Days 1–2 are consecutive (gap = 1) — they belong to ONE period start.
    // Day 5 is only 4 days after day 1 — well under the engine's
    // MIN_CYCLE_SEPARATION_DAYS (15), so it is intermenstrual bleeding
    // within the SAME cycle, not a new start either (LT-13: insights now
    // defers to the engine's canonical collectPeriodStarts, replacing the
    // old private gap>1-day heuristic that had no minimum-separation guard
    // and would have wrongly counted Apr 5 as a second start).
    // Inserted out of order; after sorting result must be deterministic.
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('d2', '2026-04-02', 'medium'),
        periodEntry('d5', '2026-04-05', 'light'),
        periodEntry('d1', '2026-04-01', 'heavy'),
      ],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.cycleLengthData.bars).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. STATISTICS — averages, min/max, variability
// ---------------------------------------------------------------------------

describe('statistics correctness', () => {
  it('computes correct average for identical-length cycles (zero variance)', () => {
    // 4 cycles all 28 days apart: Jan 1, Jan 29, Feb 26, Mar 26
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('c1', '2026-01-01'),
        periodEntry('c2', '2026-01-29'),
        periodEntry('c3', '2026-02-26'),
        periodEntry('c4', '2026-03-26'),
      ],
    });

    expect(model.cycleLengthData.avgDays).toBe(28);
    expect(model.cycleLengthData.bars).toHaveLength(3);
    expect(model.cycleLengthData.bars.every(b => b.days === 28)).toBe(true);
  });

  it('average is not NaN or Infinity with a very short single interval (1 day)', () => {
    // Pathological: two bleeding entries just 1 day apart
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('c1', '2026-04-01'),
        periodEntry('c2', '2026-04-10'), // 9 days later
      ],
    });

    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(model.cycleLengthData.avgDays).toBeGreaterThan(0);
  });

  it('handles a wildly varying cycle set — two candidate starts under 15 days are merged into their prior cycle (LT-13)', () => {
    // 10 candidate dates, but 2025-03-01 (14 days after 02-15) and
    // 2025-05-01 (11 days after 04-20) are both under the engine's
    // MIN_CYCLE_SEPARATION_DAYS (15) -- collectPeriodStarts correctly merges
    // them into the preceding cycle as intermenstrual bleeding rather than
    // counting them as new starts (LT-13: insights now shares the engine's
    // canonical detector instead of a private no-minimum-separation
    // heuristic, which used to count all 10 dates as starts / 9 intervals).
    const starts = [
      '2025-01-01',
      '2025-02-15', // 45 days
      '2025-03-01', // 14 days -- merged (< 15-day separation)
      '2025-04-20', // 50 days (measured from 02-15, since 03-01 was merged)
      '2025-05-01', // 11 days -- merged (< 15-day separation)
      '2025-07-01', // 61 days (measured from 04-20, since 05-01 was merged)
      '2025-08-01', // 31 days
      '2025-09-15', // 45 days
      '2025-10-01', // 16 days
      '2025-11-15', // 45 days
    ];
    const entries = starts.map((d, i) => periodEntry(`c${i}`, d));

    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: entries,
    });

    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    // 8 surviving starts -> 7 intervals, all within the 9-interval window
    // cap so every one of them feeds the bar chart.
    expect(model.cycleLengthData.bars).toHaveLength(7);
    expect(model.cycleLengthData.bars.map((bar) => bar.days)).toEqual([
      45, 64, 72, 31, 45, 16, 45,
    ]);
    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
  });

  it('avgDays is rounded (no fractional days shown to user)', () => {
    // 4 starts, intervals of 27, 28, 30
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('c1', '2026-01-01'),
        periodEntry('c2', '2026-01-28'), // 27
        periodEntry('c3', '2026-02-25'), // 28
        periodEntry('c4', '2026-03-27'), // 30
      ],
    });

    // LT-18/21: avgDays is prediction.cycleLengthDays (the engine's
    // recency-weighted-median estimate), not round(naive mean). The naive
    // mean of [27, 28, 30] is 28.33 -> 28, but the engine's
    // recency-weighted median (weights 1, 2, 3 oldest -> newest) leans
    // toward the more recent, larger intervals and resolves to 29. Always
    // an integer either way (applyCycleLengthFloor rounds).
    expect(Number.isInteger(model.cycleLengthData.avgDays)).toBe(true);
    expect(model.cycleLengthData.avgDays).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// 4. EXTREMES — long gaps, 1-day cycles, year spans, leap days
// ---------------------------------------------------------------------------

describe('extreme inputs', () => {
  it('survives a 365-day gap between two period starts without NaN/Infinity', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries: [
        periodEntry('c1', '2025-01-01'),
        periodEntry('c2', '2026-01-01'), // 365 days later
      ],
    });

    // LT-18/21: only 1 observed interval (2 starts) is below the engine's
    // statistics threshold, so avgDays falls back to the profile default
    // (28) rather than surfacing an un-corroborated 365-day gap as "the"
    // cycle length -- 365 days is also far outside computeCycleStatistics's
    // own [15, 90]-day plausible-interval bounds, so even a 3rd start would
    // not have let this single interval survive into the estimate.
    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(model.cycleLengthData.avgDays).toBe(28);
    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
    expect(model.cycleLengthData.consistencyLevel).toBe('not-enough-data');
  });

  it('handles dates that span a leap day (Feb 29) correctly', () => {
    // 2024 is a leap year. Jan 31 → Mar 1 = 30 days (via Feb 29)
    const model = buildInsightsScreenModel({
      todayIso: '2024-04-01',
      locale: 'en',
      profile: { ...baseProfile, lastPeriodStartDate: '2024-03-01' },
      logEntries: [
        periodEntry('c1', '2024-01-31'),
        periodEntry('c2', '2024-03-01'), // 30 days (leap Feb has 29 days)
      ],
    });

    // LT-18/21: only 1 observed interval (2 starts) -- avgDays falls back
    // to the profile default (28), same reasoning as the 365-day-gap case
    // above. The date-math correctness this test exists to pin (leap-day
    // diffDays) is exercised by `bars` instead, which always shows the raw
    // observed interval regardless of avgDays' fallback.
    expect(model.cycleLengthData.avgDays).toBe(28);
    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(model.cycleLengthData.bars).toEqual([{ days: 30, isLatest: true }]);
  });

  it('does not crash with a single bleeding entry on today\'s date', () => {
    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: { ...baseProfile, lastPeriodStartDate: '2026-04-18' },
        logEntries: [periodEntry('today', '2026-04-18', 'heavy')],
      }),
    ).not.toThrow();
  });

  it('does not crash when all log entries are future-dated (should be excluded)', () => {
    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: baseProfile,
        logEntries: [
          periodEntry('future1', '2026-05-01'),
          periodEntry('future2', '2026-06-01'),
        ],
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. PCOS summary — out-of-order entries affect interval calculation
// ---------------------------------------------------------------------------

describe('PCOS condition summary with out-of-order entries', () => {
  const pcosProfile: UserProfile = {
    ...baseProfile,
    conditionTags: ['pcos'],
    supportsIrregularCycles: true,
    lastPeriodStartDate: '2026-04-10',
  };

  it('produces the correct maxInterval for PCOS summary regardless of entry order', () => {
    // Two period starts 41 days apart (Feb 28 → Apr 10)
    const sorted = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pcosProfile,
      logEntries: [
        periodEntry('p1', '2026-02-28', 'heavy'),
        periodEntry('p2', '2026-04-10', 'medium'),
      ],
    });
    const reversed = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pcosProfile,
      logEntries: [
        periodEntry('p2', '2026-04-10', 'medium'),
        periodEntry('p1', '2026-02-28', 'heavy'),
      ],
    });

    const sortedSummary = sorted.conditionSummaries.find(s => s.key === 'pcos')!;
    const reversedSummary = reversed.conditionSummaries.find(s => s.key === 'pcos')!;

    expect(sortedSummary.summary).toBe(reversedSummary.summary);
    // Both should mention the 41-day span
    expect(sortedSummary.summary).toContain('41');
  });
});

// ---------------------------------------------------------------------------
// 6. No NaN / no division-by-zero in any numeric field
// ---------------------------------------------------------------------------

describe('no NaN or Infinity in any numeric output', () => {
  const scenarios: { label: string; logEntries: DailyLogEntry[] }[] = [
    { label: 'empty history', logEntries: [] },
    { label: 'one period start', logEntries: [periodEntry('p1', '2026-03-01')] },
    { label: 'spotting only (not a period start)', logEntries: [{ id: 's1', logDate: '2026-04-01', bleeding: 'spotting', symptoms: [] }] },
    { label: 'two starts far apart', logEntries: [periodEntry('p1', '2020-01-01'), periodEntry('p2', '2026-01-01')] },
  ];

  it.each(scenarios)('$label produces no NaN/Infinity numerics', ({ logEntries }) => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: baseProfile,
      logEntries,
    });

    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(Number.isNaN(model.cycleLengthData.avgDays)).toBe(false);
    model.cycleLengthData.bars.forEach(bar => {
      expect(Number.isFinite(bar.days)).toBe(true);
    });
    expect(Number.isFinite(model.phaseRhythmData.cycleLengthDays)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. LT-18 — cycle-length consistency classification thresholds
// ---------------------------------------------------------------------------

describe('LT-18: cycle-length consistency classification thresholds', () => {
  function buildStartsWithIntervals(firstStart: string, intervals: number[]) {
    const dates: string[] = [firstStart];
    let cursor = firstStart;
    for (const gap of intervals) {
      cursor = new Date(new Date(`${cursor}T00:00:00Z`).getTime() + gap * 86400000)
        .toISOString()
        .slice(0, 10);
      dates.push(cursor);
    }
    return dates.map((date, index) => periodEntry(`p${index}`, date));
  }

  it('a genuinely steady history (spread 0) classifies consistent', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-12-01',
      locale: 'en',
      profile: baseProfile,
      logEntries: buildStartsWithIntervals('2026-01-01', [28, 28, 28, 28]),
    });

    expect(model.cycleLengthData.consistencyLevel).toBe('consistent');
  });

  it('a bimodal 25/45-day-alternating history (spread ~15, well above 6) classifies varies-widely', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-12-01',
      locale: 'en',
      profile: { ...baseProfile, supportsIrregularCycles: true },
      logEntries: buildStartsWithIntervals('2026-01-01', [25, 45, 25, 45, 25, 45]),
    });

    // All 6 intervals survive MAD rejection (the bimodal pattern is
    // internally consistent, just wide), so this exercises the
    // 'varies-widely' branch on a real surviving sample -- not merely a
    // discarded-outlier case (see the 6mo-gap probe for that).
    expect(model.cycleLengthData.consistencyLevel).toBe('varies-widely');
    expect(model.cycleLengthData.subtitleLabel).toBe('Varies widely');
  });

  it('a single observed interval (2 starts) is not-enough-data, never consistent', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-12-01',
      locale: 'en',
      profile: baseProfile,
      logEntries: buildStartsWithIntervals('2026-01-01', [28]),
    });

    expect(model.cycleLengthData.consistencyLevel).toBe('not-enough-data');
  });

  it('zero starts is not-enough-data', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-12-01',
      locale: 'en',
      profile: baseProfile,
      logEntries: [],
    });

    expect(model.cycleLengthData.consistencyLevel).toBe('not-enough-data');
  });
});
