/**
 * Pure, engine-side derivation of which confidence reason codes have
 * something actionable to suggest.
 *
 * This is a straight relocation of the code-selection half of the old B1
 * adapter (`src/lib/predictions/confidencePresentation.ts`'s
 * `IMPROVEMENT_BUILDERS` table) — same 3-code actionable set
 * (`onboarding-seed`, `limited-bleeding-history`, `one-observed-interval`),
 * same "no improvement" codes, no behavior change. What moved is WHERE the
 * selection happens (engine, keyed off `ConfidenceReasonCode`s) and WHAT it
 * returns (plain codes, not `ConfidenceImprovement`s) — labels and
 * `action.href` are presentation-layer concerns and stay out of the engine;
 * see `src/features/tracker/buildTodaySnapshot.ts` (and its Calendar/
 * Insights siblings) for where those get attached.
 *
 * LT-04 added a 4th actionable code, `stale-history`: unlike the other
 * three (which describe SPARSE history), staleness describes OLD history --
 * but the fix is the same concrete action ("log today"), so it belongs in
 * the same actionable set and reuses `attachImprovementActions`'s single
 * "log today" route unchanged.
 */

import type { ConfidenceReasonCode } from '@/src/types/domain';

const ACTIONABLE_REASON_CODES: ReadonlySet<ConfidenceReasonCode> = new Set([
  'onboarding-seed',
  'limited-bleeding-history',
  'one-observed-interval',
  'stale-history',
]);

/**
 * Selects the subset of `reasonCodes` that have a concrete, actionable
 * follow-up ("log today", etc.). Codes with nothing actionable to suggest --
 * `irregular-cycle-support-enabled`, `consistent-recent-bleeding-history`,
 * and the A5 ovulation-derived codes (`hormonal-birth-control`,
 * `signals-disagree`, `ovulation-signal-confirmed`) -- are always excluded,
 * by design, not by omission.
 */
export function selectImprovementCodes(
  reasonCodes: readonly ConfidenceReasonCode[],
): ConfidenceReasonCode[] {
  return reasonCodes.filter((code) => ACTIONABLE_REASON_CODES.has(code));
}
