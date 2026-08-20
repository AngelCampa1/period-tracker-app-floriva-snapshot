import type { PredictionResult, UserProfile } from '@/src/types/domain';

import type { CycleStatistics } from '@/src/lib/predictions/cycleStatistics';
import { addDays } from '@/src/lib/predictions/dateMath';

/**
 * Derived earliest/latest bounds for the next predicted period start, plus
 * the statistics summary that justifies them. Produced only when the engine
 * has a real observed-interval sample to back the window (see
 * `resolveNextPeriodWindow`).
 */
export type NextPeriodWindow = {
  earliestStartDate: string;
  latestStartDate: string;
  statistics: NonNullable<PredictionResult['statistics']>;
};

/**
 * Derive the earliest/latest window around a predicted period-start anchor
 * from the robust cycle statistics.
 *
 * Kept as a standalone pure helper (rather than inline in the orchestrator)
 * so that when a later slice re-anchors the prediction (e.g. to ovulation +
 * learned luteal length), the window derivation moves with a single argument
 * swap of `anchorDate` instead of orchestrator surgery.
 *
 * API contract: returns `undefined` unless the statistics module produced a
 * real surviving sample (`sampleSize > 0`). Callers must translate that into
 * fully ABSENT keys on `PredictionResult` — the additive-fields contract for
 * `statistics` / `earliestStartDate` / `latestStartDate` is "absent when not
 * derived from observed intervals", not "present with an undefined value", so
 * serialized results (JSON round-trips, backups) and strict deep-equality
 * consumers see shapes identical to the pre-statistics engine whenever the
 * seed/fallback path runs. The golden characterization tests enforce this
 * contract via `toStrictEqual`; they follow from it rather than define it.
 */
export function resolveNextPeriodWindow(
  anchorDate: string,
  statistics: CycleStatistics | undefined,
  profile: UserProfile,
): NextPeriodWindow | undefined {
  if (!statistics || statistics.sampleSize <= 0) {
    return undefined;
  }

  // Cap how far the earliest/latest bounds can stray from the point
  // estimate: a tighter +/-5 day cap normally, widened to +/-7 days when
  // the user has opted into irregular-cycle support (they've told us their
  // cycles vary more, so a wider window is less likely to be misleading).
  const maxSpreadCapDays = profile.supportsIrregularCycles ? 7 : 5;
  const halfSpreadDays = Math.min(maxSpreadCapDays, Math.ceil(statistics.spreadDays / 2));

  return {
    earliestStartDate: addDays(anchorDate, -halfSpreadDays),
    latestStartDate: addDays(anchorDate, halfSpreadDays),
    statistics: {
      spreadDays: statistics.spreadDays,
      sampleSize: statistics.sampleSize,
      discardedCount: statistics.discardedCount,
    },
  };
}
