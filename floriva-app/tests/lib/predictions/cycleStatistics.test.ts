/**
 * Tests for the robust cycle-length statistics module.
 *
 * `computeCycleStatistics` takes a chronological (oldest -> newest) array of
 * observed interval lengths in days and produces a recency-weighted, outlier-
 * resistant estimate of the "true" cycle length, plus a robust spread.
 *
 * Algorithm under test (see src/lib/predictions/cycleStatistics.ts for the
 * authoritative in-code documentation):
 * 1. Keep only the last <= 12 intervals (most recent window).
 * 2. Hard bounds filter: discard any interval outside [15, 90] days.
 * 3. MAD outlier rejection: compute median of the bounds-filtered set, then
 *    MAD (median absolute deviation) from that median. Reject any value x
 *    where |x - median| > max(7, 2.5 * MAD).
 * 4. Recency-weighted median of the survivors: weights 1..n assigned by
 *    original chronological position (oldest = 1, newest = n), NOT by value
 *    order. Ties in the weighted-median walk (cumulative weight lands exactly
 *    on half of total weight) are resolved by averaging the two straddling
 *    values.
 * 5. Spread: 1.4826 * MAD of the survivors (relative to the survivors'
 *    unweighted median), a standard consistent estimator of the standard
 *    deviation for normally-distributed data under MAD. 0 when fewer than 2
 *    survivors.
 */

import { computeCycleStatistics } from '@/src/lib/predictions/cycleStatistics';

describe('computeCycleStatistics', () => {
  it('returns a zero-sample result for an empty interval list', () => {
    const result = computeCycleStatistics([]);

    expect(result).toStrictEqual({
      estimatedCycleLengthDays: 0,
      spreadDays: 0,
      rawSpreadDays: 0,
      sampleSize: 0,
      boundsSampleSize: 0,
      madOutlierCount: 0,
      discardedCount: 0,
    });
  });

  it('handles a single interval with zero spread', () => {
    const result = computeCycleStatistics([28]);

    expect(result).toStrictEqual({
      estimatedCycleLengthDays: 28,
      spreadDays: 0,
      rawSpreadDays: 0,
      sampleSize: 1,
      boundsSampleSize: 1,
      madOutlierCount: 0,
      discardedCount: 0,
    });
  });

  it('handles two identical intervals with zero spread', () => {
    const result = computeCycleStatistics([28, 28]);

    expect(result).toStrictEqual({
      estimatedCycleLengthDays: 28,
      spreadDays: 0,
      rawSpreadDays: 0,
      sampleSize: 2,
      boundsSampleSize: 2,
      madOutlierCount: 0,
      discardedCount: 0,
    });
  });

  it('handles two different intervals: the weighted-median walk picks the heavier newer value (no exact tie)', () => {
    // Weights are 1 (oldest, value 28) and 2 (newest, value 32). Sorted by
    // value: [(28, w=1), (32, w=2)]. Total weight = 3, half = 1.5. Cumulative
    // after the first point is 1, which has NOT reached 1.5, so we continue;
    // cumulative after the second point is 3, which reaches/exceeds 1.5. Since
    // the running cumulative never lands EXACTLY on the half-weight boundary
    // in this case, the walk simply picks the value where the threshold is
    // first met/exceeded: 32.
    const result = computeCycleStatistics([28, 32]);

    expect(result.estimatedCycleLengthDays).toBe(32);
    expect(result.sampleSize).toBe(2);
    expect(result.discardedCount).toBe(0);
  });

  it('produces an exact tie in the weighted-median cumulative walk and averages the straddling values', () => {
    // Three intervals, chronological weights 1, 2, 3 (total weight 6, half = 3).
    // Values in chronological order: 20 (w=1), 30 (w=2), 40 (w=3).
    // Sorted by value: (20, w=1), (30, w=2), (40, w=3).
    // Cumulative weights while walking sorted order: 1, then 1+2=3 (lands
    // EXACTLY on half=3), then 6. Per the documented tie rule, when the
    // cumulative weight lands exactly on the half-weight boundary we average
    // the value at that point (30) with the next value in sorted order (40):
    // (30 + 40) / 2 = 35.
    const result = computeCycleStatistics([20, 30, 40]);

    expect(result.estimatedCycleLengthDays).toBe(35);
    expect(result.sampleSize).toBe(3);
    expect(result.discardedCount).toBe(0);
  });

  it('weights recent intervals more heavily than older ones (recency-weighted median differs from plain median)', () => {
    // Chronological (oldest -> newest): 25, 25, 30, 32, 34 -> weights 1,2,3,4,5.
    // Bounds/MAD check: unweighted median of [25,25,30,32,34] is 30;
    // deviations from 30 are [5,5,0,2,4], MAD = median of those = 4, effective
    // threshold = max(7, 2.5*4) = 10 -- every value is within 10 of 30, so
    // nothing is rejected and all 5 intervals survive.
    // Plain (unweighted) median of the survivors is 30 (the middle value).
    // Weighted: sorted by value (already ascending here) with chronological
    // weights -> (25,w1),(25,w2),(30,w3),(32,w4),(34,w5). Total weight = 15,
    // half = 7.5. Cumulative weights while walking: 1, 3, 6, 10, 15. The first
    // point where cumulative >= 7.5 is 10, at value 32. So the recency-
    // weighted median is 32 -- higher than the plain median of 30, because
    // the two newest, largest intervals (32, 34) carry more combined weight
    // (4 + 5 = 9) than their sorted position alone would suggest under an
    // unweighted median. This demonstrates recency actually changes the
    // result relative to a naive median.
    const result = computeCycleStatistics([25, 25, 30, 32, 34]);

    expect(result.estimatedCycleLengthDays).toBe(32);
    expect(result.sampleSize).toBe(5);
    expect(result.discardedCount).toBe(0);
  });

  it('only considers the most recent 12 intervals when more are provided', () => {
    // 13 intervals: a single old 90-day value that would pull an all-history
    // average UP (and is within hard bounds, so only the window can exclude
    // it), followed by 12 stable 28s. Only the last 12 (all 28s) should be
    // considered, so the old value must have zero influence on the result.
    const intervals = [90, ...Array(12).fill(28)];

    const result = computeCycleStatistics(intervals);

    expect(result.estimatedCycleLengthDays).toBe(28);
    expect(result.spreadDays).toBe(0);
    expect(result.sampleSize).toBe(12);
    expect(result.discardedCount).toBe(0);
  });

  it('discards intervals outside the [15, 90] hard bounds before any statistics run', () => {
    // A 200-day gap is a data artifact (e.g. a missed logging period), not a
    // real long cycle -- it must be discarded by the HARD BOUNDS filter, not
    // rely on MAD (whose threshold could in principle let a large enough
    // spread through). 10 is also out of bounds (below 15).
    const result = computeCycleStatistics([28, 28, 200, 10, 28]);

    expect(result.estimatedCycleLengthDays).toBe(28);
    expect(result.spreadDays).toBe(0);
    expect(result.sampleSize).toBe(3);
    expect(result.discardedCount).toBe(2);
  });

  it('rejects a single extreme outlier via MAD after bounds-filtering, even though it is within [15, 90]', () => {
    // Chronological: 28, 28, 28, 28, 85 -- 85 is within hard bounds but is a
    // clear MAD outlier relative to a tight cluster of 28s.
    // Bounds-filtered median = 28. Deviations: [0,0,0,0,57]. MAD = median of
    // deviations = 0. Effective threshold = max(7, 2.5*0) = 7. |85-28|=57 > 7,
    // so 85 is rejected.
    const result = computeCycleStatistics([28, 28, 28, 28, 85]);

    expect(result.estimatedCycleLengthDays).toBe(28);
    expect(result.spreadDays).toBe(0);
    expect(result.sampleSize).toBe(4);
    expect(result.discardedCount).toBe(1);
  });

  it('documents the MAD=0 effective threshold: a value exactly 7 days off survives, 8 days off is rejected', () => {
    // Cluster of identical 28s (MAD = 0, effective threshold = 7).
    const surviving = computeCycleStatistics([28, 28, 28, 28, 35]); // |35-28| = 7, survives
    const rejected = computeCycleStatistics([28, 28, 28, 28, 36]); // |36-28| = 8, rejected

    expect(surviving.sampleSize).toBe(5);
    expect(surviving.discardedCount).toBe(0);

    expect(rejected.sampleSize).toBe(4);
    expect(rejected.discardedCount).toBe(1);
  });

  it('computes a non-zero MAD-based spread for a moderately dispersed, all-surviving set', () => {
    // Intervals: 26, 28, 28, 30 (chronological). All within bounds. Median of
    // [26,28,28,30] (unweighted, for MAD purposes) = (28+28)/2 = 28.
    // Absolute deviations from 28: [2, 0, 0, 2] -> MAD = median([0,0,2,2]) = 1.
    // Effective rejection threshold = max(7, 2.5*1) = 7 -- nothing rejected.
    // spreadDays = 1.4826 * MAD = 1.4826 * 1 = 1.4826, rounded to 2 decimals
    // for a stable, human-legible value: 1.48.
    const result = computeCycleStatistics([26, 28, 28, 30]);

    expect(result.sampleSize).toBe(4);
    expect(result.discardedCount).toBe(0);
    expect(result.spreadDays).toBeCloseTo(1.48, 2);
  });

  it('reports zero survivors (not a throw) when every interval is discarded by hard bounds', () => {
    const result = computeCycleStatistics([5, 200, 300]);

    expect(result).toStrictEqual({
      estimatedCycleLengthDays: 0,
      spreadDays: 0,
      rawSpreadDays: 0,
      sampleSize: 0,
      boundsSampleSize: 0,
      madOutlierCount: 0,
      discardedCount: 3,
    });
  });

  // UL-02 (docs/qa/2026-07-22-ui-lift/phase-1/findings.md): the survivor
  // spread (spreadDays) is the right statistic for prediction WINDOWS, but a
  // consistency CLASSIFICATION must see the observed history before outlier
  // rejection -- otherwise discarding 38/45/64-day cycles as "outliers"
  // collapses real irregularity into a tight cluster that reads "consistent".
  describe('rawSpreadDays / madOutlierCount (pre-rejection variability, UL-02)', () => {
    it('reports the raw MAD-scaled spread of the bounds-filtered set alongside the survivor spread', () => {
      // The exact ledger scenario: bars 27,38,26,27,45,26,31,64,21.
      // Bounds median = 27, MAD = 4 -> rawSpreadDays = 4 * 1.4826 = 5.93.
      // MAD rejection (threshold max(7, 10) = 10) discards 38, 45, 64,
      // leaving a tight survivor cluster whose spread is only 0.74.
      const result = computeCycleStatistics([27, 38, 26, 27, 45, 26, 31, 64, 21]);

      expect(result.rawSpreadDays).toBeCloseTo(5.93, 2);
      expect(result.spreadDays).toBeCloseTo(0.74, 2);
      expect(result.madOutlierCount).toBe(3);
      expect(result.boundsSampleSize).toBe(9);
      expect(result.sampleSize).toBe(6);
    });

    it('raw and survivor spreads agree when nothing is rejected', () => {
      const result = computeCycleStatistics([26, 28, 28, 30]);

      expect(result.rawSpreadDays).toBeCloseTo(1.48, 2);
      expect(result.rawSpreadDays).toBe(result.spreadDays);
      expect(result.madOutlierCount).toBe(0);
    });

    it('bounds-discarded artifacts (outside [15, 90]) do not count as MAD outliers and do not inflate the raw spread', () => {
      const result = computeCycleStatistics([28, 28, 200, 10, 28]);

      expect(result.rawSpreadDays).toBe(0);
      expect(result.madOutlierCount).toBe(0);
      expect(result.boundsSampleSize).toBe(3);
      expect(result.discardedCount).toBe(2);
    });

    it('a single MAD-rejected lapse in a steady history keeps the raw spread at zero (calm classification survives)', () => {
      const result = computeCycleStatistics([28, 28, 28, 28, 60, 28, 28, 28, 28]);

      // Median 28, deviations [0 x8, 32] -> raw MAD 0: one anomaly cannot
      // move a median-based spread, which is exactly why a single lapse must
      // not flip an otherwise steady history to "irregular".
      expect(result.rawSpreadDays).toBe(0);
      expect(result.madOutlierCount).toBe(1);
      expect(result.boundsSampleSize).toBe(9);
    });
  });

  it('does not throw, NaN, or return Infinity for degenerate inputs', () => {
    const cases: number[][] = [[], [28], [15, 90], [0], [-5, 28, 28, 28]];

    for (const intervals of cases) {
      const result = computeCycleStatistics(intervals);

      expect(Number.isFinite(result.estimatedCycleLengthDays)).toBe(true);
      expect(Number.isFinite(result.spreadDays)).toBe(true);
      expect(Number.isNaN(result.sampleSize)).toBe(false);
      expect(Number.isNaN(result.discardedCount)).toBe(false);
    }
  });
});
