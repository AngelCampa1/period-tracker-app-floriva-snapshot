/**
 * Fuses the (up to three) per-signal ovulation estimates -- BBT, OPK, mucus
 * -- into a single estimate, or defers to a calendar-based fallback when the
 * inputs can't be trusted.
 *
 * Pipeline:
 * 1. Collect whichever of {bbt, opk, mucus} are present as dated estimates.
 *    None present -> `calendar-fallback` (nothing to fuse).
 * 2. Determine agreement: the WIDEST pairwise gap (in days) among all
 *    present estimates must be STRICTLY LESS THAN 2 days (i.e. 0 or 1 day)
 *    to count as "agreeing" -- a gap of exactly 2 days (the product spec's
 *    own worked example: OPK says day 14, BBT says day 16) is a CONFLICT,
 *    not agreement. This is a single threshold applied to the full set, not
 *    a chain of pairwise checks, so 3 signals spanning exactly 1 day total
 *    still agree even though no single pair is identical.
 * 3a. Agreement: weighted median of the estimate dates (weights: BBT 3,
 *     OPK-peak 3, OPK-positive 2, mucus 1 -- see WEIGHTS below). Result
 *     `uncertaintyDays` = max(span of estimates, largest individual
 *     signal's own uncertaintyDays) -- whichever is larger dominates,
 *     because a tight cluster of low-uncertainty signals shouldn't inherit
 *     mucus's wide +/-2 band, but a genuinely wide (though still
 *     "agreeing") spread shouldn't be UNDER-reported either.
 * 3b. Conflict (gap >= 2 days): if a confirmed BBT signal is present, anchor
 *     the fused date on IT (BBT is the only retrospectively-confirmed
 *     signal, so it is the most trustworthy tie-breaker); widen
 *     `uncertaintyDays` to the full span across all estimates; set
 *     `signalsDisagree: true`. This is a strictly worse outcome than
 *     agreement -- callers (A4) must never read a conflict result as
 *     confidence-boosting.
 *     If no BBT is present, there is no principled anchor to prefer OPK
 *     over mucus or vice versa, so fusion declines to guess and returns
 *     `calendar-fallback` instead.
 * 4. Plausibility clamp: whatever date fusion (3a or 3b) produced must land
 *    within cycle day [8, cycleLengthDays - 7] -- a fertile-window day
 *    range that leaves room for both a minimum follicular phase (period +
 *    ~a few days) and a minimum luteal phase (>=7 days) on either side.
 *    Outside that band the estimate is presumed to be a data/logging error
 *    rather than a real physiological outlier, so the caller (A4's
 *    orchestrator) should fall back to the plain calendar method instead of
 *    trusting it.
 *
 * CALLER CONTRACT: pass one cycle's signals (each detector fed a single
 * cycle's entries). Behavior on signals derived from multi-cycle input is
 * unspecified -- feeding a two-cycle slice can make the per-detector
 * direction asymmetry (see mucusPeak.ts) surface as a purely structural
 * "conflict" here.
 *
 * The result/input types live in signals/types.ts alongside the per-signal
 * shapes.
 */

import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type {
  FuseOvulationEstimateInput,
  FuseOvulationEstimateResult,
  OvulationSignal,
} from '@/src/lib/predictions/signals/types';

// Re-export the fusion result/input types from their new home in types.ts so
// existing `from '.../fuseOvulationEstimate'` type imports keep resolving.
export type {
  CalendarFallbackMarker,
  FusedOvulationEstimate,
  FuseOvulationEstimateInput,
  FuseOvulationEstimateResult,
} from '@/src/lib/predictions/signals/types';

const AGREEMENT_THRESHOLD_DAYS = 2;

// Plausibility clamp bounds, as cycle-day offsets (1-indexed, inclusive).
const MIN_PLAUSIBLE_CYCLE_DAY = 8;
const CEILING_MARGIN_DAYS = 7;

type SignalWeightKey = 'bbt-shift' | 'opk-peak' | 'opk-positive' | 'mucus-peak';

// Weights per the product spec: BBT and OPK-peak are the strongest (most
// specific / most clinically validated) signals; OPK-positive is slightly
// weaker (a plain positive read, not the strongest confirmatory peak read);
// mucus is the weakest/most subjective signal.
const WEIGHTS: Record<SignalWeightKey, number> = {
  'bbt-shift': 3,
  'opk-peak': 3,
  'opk-positive': 2,
  'mucus-peak': 1,
};

type WeightedEstimate = {
  signal: OvulationSignal;
  weightKey: SignalWeightKey;
  date: string;
  offsetDays: number;
};

function weightKeyFor(signal: OvulationSignal): SignalWeightKey {
  if (signal.kind === 'bbt-shift') return 'bbt-shift';
  if (signal.kind === 'mucus-peak') return 'mucus-peak';
  // opk-surge: distinguish by trigger result.
  return signal.triggerResult === 'peak' ? 'opk-peak' : 'opk-positive';
}

function weightedMedianOffset(estimates: { offsetDays: number; weight: number }[]): number {
  if (estimates.length === 1) return estimates[0]!.offsetDays;

  const sorted = [...estimates].sort((a, b) => a.offsetDays - b.offsetDays);
  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  const halfWeight = totalWeight / 2;

  let cumulative = 0;
  const cumulativeWeights = sorted.map((e) => {
    cumulative += e.weight;
    return cumulative;
  });
  const targetIndex = cumulativeWeights.findIndex((w) => w >= halfWeight);

  if (cumulativeWeights[targetIndex] === halfWeight) {
    // Invariant: this tie-break can never land on the LAST sorted entry.
    // The final cumulative weight always equals `totalWeight` (the sum of
    // every entry), which only equals `halfWeight` if `totalWeight` is 0 --
    // impossible here since every fixed signal weight (see WEIGHTS above:
    // 1, 2, or 3) is positive and there are 1-3 estimates. So whenever the
    // exact-half tie fires, a `next` entry always exists to average with.
    const next = sorted[targetIndex + 1]!;
    return (sorted[targetIndex]!.offsetDays + next.offsetDays) / 2;
  }
  return sorted[targetIndex]!.offsetDays;
}

export function fuseOvulationEstimate(
  input: FuseOvulationEstimateInput,
): FuseOvulationEstimateResult {
  const { cycleStartIso, cycleLengthDays, bbt, opk, mucus } = input;

  const presentSignals = [bbt, opk, mucus].filter(
    (signal): signal is OvulationSignal => signal != null,
  );
  if (presentSignals.length === 0) {
    return { kind: 'calendar-fallback' };
  }

  const weighted: WeightedEstimate[] = presentSignals.map((signal) => ({
    signal,
    weightKey: weightKeyFor(signal),
    date: signal.ovulationDateIso,
    offsetDays: diffDays(cycleStartIso, signal.ovulationDateIso),
  }));

  const offsets = weighted.map((w) => w.offsetDays);
  const span = Math.max(...offsets) - Math.min(...offsets);
  const agree = span < AGREEMENT_THRESHOLD_DAYS;

  let fusedOffsetDays: number;
  let uncertaintyDays: number;
  let signalsDisagree: boolean;

  if (agree) {
    fusedOffsetDays = weightedMedianOffset(
      weighted.map((w) => ({ offsetDays: w.offsetDays, weight: WEIGHTS[w.weightKey] })),
    );
    const maxIndividualUncertainty = Math.max(...weighted.map((w) => w.signal.uncertaintyDays));
    uncertaintyDays = Math.max(span, maxIndividualUncertainty);
    signalsDisagree = false;
  } else {
    const confirmedBbt = weighted.find((w) => w.signal.kind === 'bbt-shift');
    if (!confirmedBbt) {
      // No principled anchor to prefer one non-BBT signal over another --
      // decline to guess.
      return { kind: 'calendar-fallback' };
    }
    fusedOffsetDays = confirmedBbt.offsetDays;
    uncertaintyDays = span;
    signalsDisagree = true;
  }

  // Plausibility clamp, expressed in 1-indexed cycle-day terms: offsetDays
  // is 0-indexed from cycleStartIso, so cycle day = offsetDays + 1.
  const fusedCycleDay = fusedOffsetDays + 1;
  const ceilingCycleDay = cycleLengthDays - CEILING_MARGIN_DAYS;
  if (fusedCycleDay < MIN_PLAUSIBLE_CYCLE_DAY || fusedCycleDay > ceilingCycleDay) {
    return { kind: 'calendar-fallback' };
  }

  const ovulationDateIso = addDays(cycleStartIso, fusedOffsetDays);

  return {
    kind: 'fused',
    ovulationDateIso,
    uncertaintyDays,
    signalsDisagree,
    contributingSignals: presentSignals.map((s) => s.kind),
  };
}
