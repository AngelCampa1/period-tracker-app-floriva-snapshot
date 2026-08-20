/**
 * Robust cycle-length statistics.
 *
 * Pure, I/O-free module: it operates only on numeric day intervals (already
 * computed by the caller via `diffDays` between consecutive observed period
 * starts). It knows nothing about dates, profiles, or the wider prediction
 * engine.
 *
 * Pipeline (see individual steps below for rationale):
 * 1. Keep only the most recent <= 12 intervals.
 * 2. Hard bounds filter: discard anything outside [15, 90] days.
 * 3. MAD-based outlier rejection on the bounds-filtered set.
 * 4. Recency-weighted median of the survivors -> estimatedCycleLengthDays.
 * 5. MAD-based robust spread of the survivors -> spreadDays.
 *
 * The 20-day floor applied elsewhere in the engine (see cycleHistory.ts) is
 * intentionally NOT applied here -- this module reports the raw statistical
 * estimate; flooring is a presentation/product decision made by the caller.
 */

import { median } from '@/src/lib/predictions/stats';

// Exported (UL-36) so presentation windows that claim to describe "recent
// cycles" (e.g. the Insights cycle-length bar chart) can share the EXACT
// window this module classifies, instead of hardcoding a different slice.
export const MAX_INTERVAL_WINDOW = 12;
const MIN_PLAUSIBLE_INTERVAL_DAYS = 15;
const MAX_PLAUSIBLE_INTERVAL_DAYS = 90;
// Floor for the MAD-based rejection threshold. When the survivors are nearly
// identical, MAD collapses to (or near) 0, which would otherwise reject any
// tiny, clinically-meaningless deviation. A 7-day floor keeps single-day or
// few-day noise from being flagged as an outlier.
const MIN_REJECTION_THRESHOLD_DAYS = 7;
const MAD_REJECTION_MULTIPLIER = 2.5;
// Consistent estimator constant that scales MAD to be comparable to a
// standard deviation under a normal distribution assumption. Widely used
// convention (e.g. same constant used by scipy.stats and R's `mad()`).
const MAD_TO_STD_DEV_SCALE = 1.4826;

export type CycleStatistics = {
  estimatedCycleLengthDays: number;
  /** MAD-scaled spread of the post-rejection SURVIVORS (see step 5). */
  spreadDays: number;
  /**
   * UL-02: MAD-scaled spread of the bounds-filtered set BEFORE MAD outlier
   * rejection (0 when fewer than 2 bounds-filtered values). `spreadDays` is
   * the right statistic for prediction windows (outliers must not widen the
   * expected-date range), but a CONSISTENCY CLASSIFICATION shown against
   * the user's raw history must not first discard the very cycles that make
   * that history irregular. Because this is still a median-based (robust)
   * statistic, a single anomalous interval in an otherwise steady history
   * leaves it at ~0 -- so calm "consistent" messaging survives one lapse.
   */
  rawSpreadDays: number;
  sampleSize: number;
  /** Count of intervals inside the [15, 90] hard bounds (pre-MAD-rejection). */
  boundsSampleSize: number;
  /**
   * UL-02: how many bounds-plausible intervals the MAD step rejected as
   * outliers. A large share of "outliers" is itself evidence of
   * irregularity, not noise -- callers classifying consistency escalate on
   * it (see resolveCycleLengthConsistencyLevel, buildInsightsScreenModel.ts).
   */
  madOutlierCount: number;
  discardedCount: number;
};

function medianAbsoluteDeviation(values: number[], center: number): number {
  const deviations = values.map((value) => Math.abs(value - center));
  return median(deviations);
}

/**
 * Recency-weighted median.
 *
 * Weights are assigned 1..n by ORIGINAL CHRONOLOGICAL POSITION (oldest = 1,
 * newest = n) -- not by sorted value order -- so more recent intervals pull
 * the estimate harder. Survivors are then sorted by value (carrying their
 * chronological weight along) and we walk cumulative weight looking for the
 * point where it first reaches half of the total weight.
 *
 * Tie-breaking convention: if the cumulative weight lands EXACTLY on half of
 * the total weight at some point in the sorted walk, the estimate is the
 * average of the value at that point and the next value in sorted order
 * (mirrors the even-count-average convention of a plain median). Otherwise,
 * the estimate is simply the value at the first point where cumulative
 * weight reaches or exceeds the half-weight threshold.
 */
function weightedMedian(weightedValues: { value: number; weight: number }[]): number {
  if (weightedValues.length === 0) return 0;
  if (weightedValues.length === 1) return weightedValues[0]!.value;

  const sorted = [...weightedValues].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, entry) => sum + entry.weight, 0);
  const halfWeight = totalWeight / 2;

  // Find the first sorted position where cumulative weight reaches or
  // exceeds half of the total weight. Cumulative weight is monotonically
  // increasing and reaches totalWeight (>= halfWeight) by the last element,
  // so this is guaranteed to find a match given the length>=2 guard above.
  let cumulative = 0;
  const cumulativeWeights = sorted.map((entry) => {
    cumulative += entry.weight;
    return cumulative;
  });
  const targetIndex = cumulativeWeights.findIndex((weight) => weight >= halfWeight);

  if (cumulativeWeights[targetIndex] === halfWeight) {
    const next = sorted[targetIndex + 1];
    // `next` is unreachable-false in practice: cumulativeWeights[last] always
    // equals totalWeight, so an exact tie (cumulativeWeights[i] === halfWeight
    // === totalWeight / 2) at the LAST index would require totalWeight === 0,
    // which cannot happen with the positive chronological-position weights
    // (>= 1) this function is always called with. Kept as a defensive
    // fallback rather than a non-null assertion.
    return next ? (sorted[targetIndex]!.value + next.value) / 2 : sorted[targetIndex]!.value;
  }
  return sorted[targetIndex]!.value;
}

export function computeCycleStatistics(intervalsChronological: number[]): CycleStatistics {
  // Step 1: most recent <= 12 intervals, still in chronological order.
  const windowed =
    intervalsChronological.length > MAX_INTERVAL_WINDOW
      ? intervalsChronological.slice(-MAX_INTERVAL_WINDOW)
      : [...intervalsChronological];

  // Track original chronological position (for recency weighting) alongside
  // each value before any filtering, so weights survive filtering intact.
  const withPosition = windowed.map((value, index) => ({ value, position: index + 1 }));

  // Step 2: hard bounds filter.
  const boundsFiltered = withPosition.filter(
    (entry) =>
      entry.value >= MIN_PLAUSIBLE_INTERVAL_DAYS && entry.value <= MAX_PLAUSIBLE_INTERVAL_DAYS,
  );

  if (boundsFiltered.length === 0) {
    return {
      estimatedCycleLengthDays: 0,
      spreadDays: 0,
      rawSpreadDays: 0,
      sampleSize: 0,
      boundsSampleSize: 0,
      madOutlierCount: 0,
      discardedCount: windowed.length,
    };
  }

  // Step 3: MAD outlier rejection relative to the bounds-filtered set.
  const boundsFilteredValues = boundsFiltered.map((entry) => entry.value);
  const boundsMedian = median(boundsFilteredValues);
  const mad = medianAbsoluteDeviation(boundsFilteredValues, boundsMedian);
  const rejectionThreshold = Math.max(
    MIN_REJECTION_THRESHOLD_DAYS,
    MAD_REJECTION_MULTIPLIER * mad,
  );
  const survivors = boundsFiltered.filter(
    (entry) => Math.abs(entry.value - boundsMedian) <= rejectionThreshold,
  );

  const discardedCount = windowed.length - survivors.length;
  const madOutlierCount = boundsFiltered.length - survivors.length;

  // UL-02: raw (pre-rejection) spread of the bounds-filtered set -- same
  // MAD * 1.4826 construction and rounding as the survivor spread below, but
  // computed BEFORE outliers are discarded, so a consistency classification
  // can see the variability the rejection step deliberately hides from the
  // prediction-window estimate.
  const rawSpreadDays =
    boundsFilteredValues.length >= 2
      ? Math.round(mad * MAD_TO_STD_DEV_SCALE * 100) / 100
      : 0;

  // Invariant: `survivors` is never empty here. `boundsMedian` is the median
  // of `boundsFilteredValues` (a non-empty array, guarded above), so its
  // deviation from itself is 0, which is always <= rejectionThreshold
  // (>= MIN_REJECTION_THRESHOLD_DAYS, a positive constant). At least the
  // element(s) equal to the median therefore always survive the filter.

  // Step 4: recency-weighted median of survivors (weights = original
  // chronological position, oldest -> newest = 1..n of the WINDOWED set).
  const estimatedCycleLengthDays = weightedMedian(
    survivors.map((entry) => ({ value: entry.value, weight: entry.position })),
  );

  // Step 5: robust spread. MAD-based (rather than IQR-based) because it is
  // cheap to compute from the same median we already have, is well-defined
  // for small n, and the 1.4826 scale keeps it interpretable as an
  // approximate standard deviation. Undefined (degenerate) for n < 2, so we
  // define spread as 0 in that case rather than dividing by an empty set.
  let spreadDays = 0;
  if (survivors.length >= 2) {
    const survivorValues = survivors.map((entry) => entry.value);
    const survivorMedian = median(survivorValues);
    const survivorMad = medianAbsoluteDeviation(survivorValues, survivorMedian);
    // Round to 2 decimal places: a stable, human-legible precision. Raw
    // floating point (e.g. 1.4826000000000002) is not a meaningful gain in
    // accuracy and is harder to assert on / display.
    spreadDays = Math.round(survivorMad * MAD_TO_STD_DEV_SCALE * 100) / 100;
  }

  return {
    estimatedCycleLengthDays,
    spreadDays,
    rawSpreadDays,
    sampleSize: survivors.length,
    boundsSampleSize: boundsFiltered.length,
    madOutlierCount,
    discardedCount,
  };
}
