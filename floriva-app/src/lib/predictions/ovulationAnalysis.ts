/**
 * A4: per-cycle ovulation-signal orchestration.
 *
 * Wires the A3 signal-detector library (src/lib/predictions/signals/*,
 * lutealLearning.ts) into buildPredictionResult.ts. This module owns
 * everything the detectors' single-cycle caller contract requires --
 * slicing history into per-cycle entry lists, running detection + fusion per
 * slice, pairing historical confirmed ovulations with the following cycle's
 * period start for luteal learning, and applying the hormonal-birth-control
 * gate and the retrospective-signal discipline for the CURRENT (open) cycle.
 * buildPredictionResult.ts stays a thin composition of these pieces.
 *
 * ---
 * RETROSPECTIVE DISCIPLINE (read this before touching analyzeCurrentCycleOvulation):
 *
 * A BBT coverline shift can only ever be detected after 3 days of
 * post-ovulatory temperatures exist (see signals/bbtShift.ts) -- by the time
 * it fires, ovulation is already in the past. It is therefore always sound
 * to use a BBT-anchored estimate to CONFIRM that a fertile window already
 * happened (re-anchoring nextPeriod, feeding luteal learning), but it must
 * NEVER be used to open a fertile window that has not started yet from the
 * user's point of view "today" -- that would fabricate a forward-looking
 * fertile-window claim from a signal that is definitionally retrospective.
 *
 * Concretely: a signal whose ONLY contributing evidence is retrospective
 * (bbt-shift alone, or a fused estimate that anchored on BBT during a
 * signals-disagree conflict -- see fuseOvulationEstimate.ts step 3b) is
 * suppressed entirely (treated as "no confirmed ovulation yet", i.e.
 * calendar-fallback) whenever `todayIso` is still BEFORE the fertile window
 * the estimate implies (`ovulationDateIso - 5`). Once today reaches that
 * window-open date (inclusive) -- even if the window hasn't fully elapsed --
 * the confirmation is allowed to stand, because at that point the window
 * it's confirming is not a claim about the future.
 *
 * Prospective signals (OPK positive/peak, mucus-peak, or a fusion result
 * that did NOT need to fall back to a BBT anchor) carry no such
 * restriction: they may open or adjust the current/forward fertile window
 * immediately.
 * ---
 *
 * HORMONAL BIRTH CONTROL GATE:
 *
 * `UserProfile.birthControlMethod` is `Exclude<BirthControlMethod, 'none'>`
 * = 'pill' | 'iud' | 'implant' | 'ring' | 'patch' | 'other' (see
 * src/types/domain.ts). Pill, implant, ring, and patch are unambiguously
 * hormonal and always gate.
 *
 * 'iud' is resolved by the optional `UserProfile.iudType` sub-type
 * ('hormonal' | 'copper'). Copper IUDs do not suppress ovulation, so a
 * `'copper'` selection does NOT gate -- those users are eligible for the same
 * ovulation-signal refinement as an unmedicated cycle. A `'hormonal'` IUD
 * gates like any other hormonal method. When the sub-type is UNSPECIFIED
 * (undefined -- e.g. a user who set up their IUD before this field existed, or
 * skipped the optional sub-choice) we DELIBERATELY default to gating: the
 * failure mode of gating a copper user who never specified is a mild loss of
 * signal refinement (the engine falls back to the calendar method it already
 * uses today), whereas the failure mode of NOT gating a hormonal-IUD user is a
 * confidently-presented ovulation-signal prediction for someone whose method
 * pharmacologically suppresses ovulation -- a materially worse and more
 * misleading outcome. This safe-default is a product/safety judgment call, not
 * a mechanical rule.
 *
 * 'other' does NOT gate, since it is not confirmed to be hormonal at all.
 */

import type { DailyLogEntry, PredictionResult, UserProfile } from '@/src/types/domain';

import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type { ConfirmedOvulation } from '@/src/lib/predictions/lutealLearning';
import { detectBbtShift } from '@/src/lib/predictions/signals/bbtShift';
import { fuseOvulationEstimate } from '@/src/lib/predictions/signals/fuseOvulationEstimate';
import { detectMucusPeak } from '@/src/lib/predictions/signals/mucusPeak';
import { detectOpkSurge } from '@/src/lib/predictions/signals/opkSurge';
import type { FuseOvulationEstimateResult } from '@/src/lib/predictions/signals/types';

// Only a confirmed ovulation this tight is trusted to teach LUTEAL LEARNING
// (see extractConfirmedOvulationDate / buildLutealLearningInput) -- mirrors
// lutealLearning.ts's own guard so the two modules agree on what "confirmed
// enough to learn from" means. This bar deliberately does NOT apply to the
// current-cycle re-anchor path (analyzeCurrentCycleOvulation): per the
// product spec, a wider-uncertainty estimate -- e.g. a mucus-only +/-2-day
// peak -- still re-anchors the current cycle's fertile window and
// nextPeriod. Re-anchoring is a this-cycle-only, self-correcting output,
// whereas luteal learning compounds across cycles, so only learning gets
// the stricter trust gate.
const MAX_TRUSTED_UNCERTAINTY_DAYS = 1;
// The fertile window is the 5 days preceding ovulation plus ovulation day
// itself. Single shared definition -- buildPredictionResult.ts imports this
// so the signal-confirmed window formula can never drift between the two
// modules.
export const FERTILE_WINDOW_LOOKBACK_DAYS = 5;

// Methods that are unambiguously hormonal and always gate. 'iud' is handled
// separately via `iudType` (copper does not gate); 'other' is excluded because
// it is not confirmed hormonal. See the module-level JSDoc.
const HORMONAL_BIRTH_CONTROL_METHODS = new Set<
  NonNullable<UserProfile['birthControlMethod']>
>(['pill', 'implant', 'ring', 'patch']);

export type HormonalBirthControlGateResult =
  | { gated: true; reason: 'hormonal-birth-control' }
  | { gated: false };

/**
 * Decides whether the user's current birth-control method should suppress
 * ALL ovulation-signal detection and window re-anchoring for this cycle. See
 * the module-level JSDoc for the full rationale (especially the IUD
 * judgment call).
 */
export function resolveHormonalBirthControlGate(
  profile: UserProfile,
): HormonalBirthControlGateResult {
  const method = profile.birthControlMethod;
  if (method == null) {
    return { gated: false };
  }
  if (method === 'iud') {
    // Copper IUDs do not suppress ovulation; hormonal -- and an unspecified
    // sub-type, as the safe default -- gate. See the module-level JSDoc.
    if (profile.iudType === 'copper') {
      return { gated: false };
    }
    return { gated: true, reason: 'hormonal-birth-control' };
  }
  if (HORMONAL_BIRTH_CONTROL_METHODS.has(method)) {
    return { gated: true, reason: 'hormonal-birth-control' };
  }
  return { gated: false };
}

export type CycleSlice = {
  startDate: string;
  entries: DailyLogEntry[];
  /** False only for the LAST (open/current) cycle in the provided history. */
  isComplete: boolean;
};

/**
 * Slices a full log-entry history into one segment per period start, in
 * chronological order. Each slice runs from its `startDate` (inclusive) up
 * to (but not including) the next period start; the final slice -- the
 * user's open/current cycle -- has no upper bound and is marked
 * `isComplete: false`.
 *

 * This produces the single-cycle inputs the A3 detectors require (see
 * signals/*.ts "CALLER CONTRACT" docs) for HISTORICAL cycles. Note it is
 * not the only slicing site: buildPredictionResult.ts derives the CURRENT
 * (open) cycle's slice separately with a plain
 * `logDate >= effectiveStartDate` filter, because its anchor can be a
 * rolled-forward synthetic date that never appears in `periodStarts`. Both
 * sites uphold the same single-cycle contract; keep them in agreement if
 * either changes. Entries logged before the first period start are dropped
 * entirely here, since they don't belong to any cycle the engine can
 * reason about.
 */
export function sliceCyclesIntoPeriods(
  entries: DailyLogEntry[],
  periodStarts: string[],
): CycleSlice[] {
  if (periodStarts.length === 0) return [];

  const sortedStarts = [...periodStarts].sort();
  const sortedEntries = [...entries].sort((a, b) => a.logDate.localeCompare(b.logDate));

  return sortedStarts.map((startDate, index) => {
    const nextStart = sortedStarts[index + 1];
    const sliceEntries = sortedEntries.filter(
      (entry) =>
        entry.logDate >= startDate && (nextStart === undefined || entry.logDate < nextStart),
    );

    return {
      startDate,
      entries: sliceEntries,
      isComplete: nextStart !== undefined,
    };
  });
}

/**
 * Runs all three A3 detectors + fusion on a single cycle's entries.
 * `cycleLengthDays` is only used for fusion's plausibility clamp (see
 * fuseOvulationEstimate.ts) -- it is the length of THIS specific cycle
 * (elapsed-so-far for the open cycle), not the user's average.
 */
function detectCycleOvulation(
  cycleStartIso: string,
  cycleLengthDays: number,
  entries: DailyLogEntry[],
): FuseOvulationEstimateResult {
  const bbt = detectBbtShift(entries) ?? undefined;
  const opk = detectOpkSurge(entries) ?? undefined;
  const mucus = detectMucusPeak(entries) ?? undefined;

  return fuseOvulationEstimate({
    cycleStartIso,
    cycleLengthDays,
    bbt,
    opk,
    mucus,
  });
}

/**
 * Extracts a single trusted "confirmed ovulation" from a fusion result, for
 * feeding luteal learning -- only when uncertainty is tight enough to trust
 * (mirrors lutealLearning.ts's own MAX_TRUSTED_UNCERTAINTY_DAYS guard, so a
 * caller can't bypass it by pre-filtering here; this is a second, redundant
 * checkpoint by design, not a substitute for lutealLearning's own check).
 */
function extractConfirmedOvulationDate(fused: FuseOvulationEstimateResult): {
  dateIso: string;
  uncertaintyDays: number;
} | null {
  if (fused.kind !== 'fused') return null;
  if (fused.uncertaintyDays > MAX_TRUSTED_UNCERTAINTY_DAYS) return null;
  return { dateIso: fused.ovulationDateIso, uncertaintyDays: fused.uncertaintyDays };
}

/**
 * Builds the lutealLearning.ts input by pairing each COMPLETED historical
 * cycle's confirmed ovulation with the NEXT cycle's period start (the
 * observed luteal-phase boundary: ovulation -> next period). The open
 * (current, `isComplete: false`) cycle is never used as the historical side
 * of a pairing -- it has no "next start" yet by definition.
 */
export function buildLutealLearningInput(slices: CycleSlice[]): ConfirmedOvulation[] {
  const pairs: ConfirmedOvulation[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index]!;
    if (!slice.isComplete) continue; // no "next start" to pair against yet.
    // Invariant: `sliceCyclesIntoPeriods` sets `isComplete: true` on a slice
    // IF AND ONLY IF a next start existed to bound it (see its own
    // implementation -- `isComplete: nextStart !== undefined`), so a slice
    // immediately after this one is guaranteed to exist whenever the guard
    // above doesn't `continue`.
    const nextSlice = slices[index + 1]!;

    // This cycle's OWN length (start -> next start) is what fusion's
    // plausibility clamp should be judged against, not the user's average.
    const cycleLengthDays = diffDays(slice.startDate, nextSlice.startDate);
    const fused = detectCycleOvulation(slice.startDate, cycleLengthDays, slice.entries);
    const confirmed = extractConfirmedOvulationDate(fused);
    if (!confirmed) continue;

    pairs.push({
      ovulationDateIso: confirmed.dateIso,
      nextPeriodStartIso: nextSlice.startDate,
      uncertaintyDays: confirmed.uncertaintyDays,
    });
  }

  return pairs;
}

export type CurrentCycleOvulationOptions = {
  todayIso: string;
  cycleStartIso: string;
  cycleLengthDays: number;
  entries: DailyLogEntry[];
  profile: UserProfile;
};

type PopulatedOvulationEstimate = Extract<
  NonNullable<PredictionResult['ovulation']>,
  { dateIso: string }
>;

function resolveBasis(
  fused: Extract<FuseOvulationEstimateResult, { kind: 'fused' }>,
): PopulatedOvulationEstimate['basis'] {
  if (fused.contributingSignals.length > 1) return 'fused';
  const only = fused.contributingSignals[0];
  if (only === 'bbt-shift') return 'bbt-shift';
  if (only === 'opk-surge') return 'opk-surge';
  return 'mucus-peak';
}

/**
 * A fused estimate's DATE is retrospective -- and therefore subject to the
 * not-yet-open-window discipline -- whenever BBT is what determined it:
 * either BBT was the only contributing signal, or fusion hit a >=2-day
 * conflict and anchored on BBT (see fuseOvulationEstimate.ts step 3b --
 * conflict resolution ALWAYS anchors on a confirmed BBT shift when one is
 * present, never on OPK/mucus). In the conflict case a prospective signal
 * (OPK/mucus) was also logged, but it did not win the anchor -- the actual
 * `ovulationDateIso` being reported is BBT's retrospective confirmation, so
 * the same forward-looking-window restriction applies to it. `mucus`/`opk`
 * -only or agreeing multi-signal fusions are prospective: the date did not
 * require a post-hoc BBT confirmation to be trusted.
 */
function isRetrospectiveDate(
  fused: Extract<FuseOvulationEstimateResult, { kind: 'fused' }>,
): boolean {
  if (fused.signalsDisagree) {
    // Conflict path: fuseOvulationEstimate only ever anchors on BBT here, so
    // BBT's presence among the contributors is exactly what "disagree, BBT
    // anchored" means (calendar-fallback fires instead when no BBT exists).
    return fused.contributingSignals.includes('bbt-shift');
  }
  // Agreement path: retrospective only when BBT was the SOLE contributor --
  // any prospective co-signal means the date didn't need a purely
  // after-the-fact confirmation.
  return fused.contributingSignals.length === 1 && fused.contributingSignals[0] === 'bbt-shift';
}

/**
 * Analyzes the CURRENT (open) cycle's ovulation signals, applying the
 * hormonal-birth-control gate and the retrospective-signal discipline.
 * Returns:
 * - `{ gated: 'hormonal-birth-control' }` when the profile's method gates
 *   (see resolveHormonalBirthControlGate) -- no detection is even attempted.
 * - `undefined` when there's nothing trustworthy to report: no signals,
 *   fusion's plausibility clamp failed, or a purely-retrospective (BBT-only)
 *   estimate whose implied fertile window has not opened yet as of
 *   `todayIso` (see the module-level retrospective-discipline doc).
 * - Otherwise, the populated `ovulation` shape ready to attach to
 *   `PredictionResult.ovulation` verbatim.
 */
export function analyzeCurrentCycleOvulation({
  todayIso,
  cycleStartIso,
  cycleLengthDays,
  entries,
  profile,
}: CurrentCycleOvulationOptions): PredictionResult['ovulation'] | undefined {
  const gate = resolveHormonalBirthControlGate(profile);
  if (gate.gated) {
    return { gated: gate.reason };
  }

  const fused = detectCycleOvulation(cycleStartIso, cycleLengthDays, entries);
  if (fused.kind !== 'fused') return undefined;

  const retrospective = isRetrospectiveDate(fused);

  if (retrospective) {
    const fertileWindowStart = addDays(fused.ovulationDateIso, -FERTILE_WINDOW_LOOKBACK_DAYS);
    // A purely-retrospective estimate may not open a fertile window that
    // hasn't started yet from today's point of view.
    if (diffDays(todayIso, fertileWindowStart) > 0) {
      return undefined;
    }
  }

  return {
    dateIso: fused.ovulationDateIso,
    uncertaintyDays: fused.uncertaintyDays,
    basis: resolveBasis(fused),
    ...(fused.signalsDisagree ? { signalsDisagree: true as const } : {}),
    retrospective,
  };
}
