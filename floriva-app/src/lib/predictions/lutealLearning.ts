/**
 * Luteal-phase-length learning.
 *
 * The luteal phase (ovulation -> next period start) is far more consistent
 * per-individual than the follicular phase, which is why fertility-awareness
 * methods anchor predictions on a learned luteal length rather than half the
 * cycle length. This module turns a set of CONFIRMED ovulation dates (i.e.
 * the output of a retrospective signal like `detectBbtShift`, or a fused
 * estimate tight enough to trust) into a single learned luteal length the
 * A4 orchestrator can use to re-anchor next-period predictions.
 *
 * Pipeline:
 * 1. For each confirmed ovulation, compute
 *    lutealLengthDays = nextPeriodStartIso - ovulationDateIso.
 * 2. Guard: only trust confirmations whose OWN uncertaintyDays <= 1. A wider
 *    uncertainty (e.g. mucus-only estimates, or a wide-span fused conflict
 *    result) is too noisy to teach the model anything reliable -- this also
 *    protects against noisy imported data (Clue/Flo exports) that may carry
 *    coarse or approximate ovulation markers.
 * 3. Plausibility bounds: discard any computed length outside [9, 17] days
 *    (the physiologically accepted range for a luteal phase -- shorter is
 *    associated with luteal phase defect / anovulatory noise, longer is
 *    exceedingly rare and more likely a data error, e.g. a missed period
 *    start or an incorrectly confirmed ovulation).
 * 4. Learned length = median of the surviving lengths, but ONLY once there
 *    are at least 2 -- a single confirmed cycle is not enough to trust over
 *    the clinical default, and 0 obviously cannot inform anything.
 * 5. Default: 14 days (the standard textbook luteal-phase length) whenever
 *    fewer than 2 lengths survive steps 2-3.
 */

import { diffDays } from '@/src/lib/predictions/dateMath';
import { median } from '@/src/lib/predictions/stats';

// Plausibility bounds for an individual confirmed luteal length, in days.
const MIN_PLAUSIBLE_LUTEAL_DAYS = 9;
const MAX_PLAUSIBLE_LUTEAL_DAYS = 17;
// Ovulation confirmations with wider uncertainty than this are considered
// too noisy to learn from.
const MAX_TRUSTED_UNCERTAINTY_DAYS = 1;
// Minimum number of plausible confirmed lengths required before the learned
// estimate is trusted over the clinical default.
const MIN_SAMPLE_SIZE = 2;
// Standard textbook luteal-phase length, used whenever there isn't enough
// learned data yet.
const DEFAULT_LUTEAL_LENGTH_DAYS = 14;

export type ConfirmedOvulation = {
  ovulationDateIso: string;
  nextPeriodStartIso: string;
  /** The confirming signal's own uncertaintyDays (see signals/types.ts). */
  uncertaintyDays: number;
};

export type LearnedLutealLength = {
  lutealLengthDays: number;
  /**
   * Number of confirmations that actually INFORMED the learned value. On the
   * learned path this is the count that survived both guards (steps 2-3
   * above), which is always >= MIN_SAMPLE_SIZE. On the default-fallback path
   * (isDefault: true) it is deliberately 0 -- the returned length is the
   * clinical default, informed by no confirmations, even if exactly one
   * survived the guards. Consumers can therefore treat sampleSize === 0 and
   * isDefault === true as equivalent "we have not learned anything" signals.
   */
  sampleSize: number;
  /** True whenever fewer than MIN_SAMPLE_SIZE confirmations survived the guards and the clinical default was used. */
  isDefault: boolean;
};

export function learnLutealLength(confirmations: ConfirmedOvulation[]): LearnedLutealLength {
  const plausibleLengths: number[] = [];

  for (const confirmation of confirmations) {
    if (confirmation.uncertaintyDays > MAX_TRUSTED_UNCERTAINTY_DAYS) continue;

    const lengthDays = diffDays(confirmation.ovulationDateIso, confirmation.nextPeriodStartIso);
    if (lengthDays < MIN_PLAUSIBLE_LUTEAL_DAYS || lengthDays > MAX_PLAUSIBLE_LUTEAL_DAYS) continue;

    plausibleLengths.push(lengthDays);
  }

  if (plausibleLengths.length < MIN_SAMPLE_SIZE) {
    return {
      lutealLengthDays: DEFAULT_LUTEAL_LENGTH_DAYS,
      sampleSize: 0,
      isDefault: true,
    };
  }

  return {
    lutealLengthDays: median(plausibleLengths),
    sampleSize: plausibleLengths.length,
    isDefault: false,
  };
}
