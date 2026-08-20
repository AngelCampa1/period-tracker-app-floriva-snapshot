/**
 * Model-layer attachment of route hrefs onto engine-emitted improvement
 * codes.
 *
 * `PredictionResult.confidence.improvementCodes` (see
 * `src/lib/predictions/confidenceImprovements.ts` for how the engine selects
 * that set) is a plain, route-agnostic array of `ConfidenceReasonCode`s.
 * Building the actual `ConfidenceImprovement[]` shown on Today/Calendar/
 * Insights means attaching `action.href` — which route to open when the row
 * is tapped — and that IS a model-layer/route-aware concern, so it stays out
 * of the engine and lives here instead.
 *
 * This is the direct successor to the B1 adapter that used to live in this
 * file (`mapLegacyReasonToCode` + the legacy-string half of
 * `buildConfidenceImprovements`), now deleted: the engine emits reason codes
 * and improvement codes natively (A5 "Confidence v2"), so there is no more
 * string-to-code mapping to bridge.
 */

import type { ConfidenceImprovement, ConfidenceReasonCode } from '@/src/types/domain';

function buildTodayLogHref(todayIso: string) {
  return `/calendar/day/${todayIso}`;
}

/**
 * Attaches a "log today" route href to each improvement code. Every
 * actionable improvement code currently points at the same route (today's
 * log entry) — if a future code needs a different destination, give this
 * function a per-code lookup table at that point rather than pre-building
 * one for a single destination today.
 */
export function attachImprovementActions(
  improvementCodes: readonly ConfidenceReasonCode[],
  todayIso: string,
): ConfidenceImprovement[] {
  const href = buildTodayLogHref(todayIso);

  return improvementCodes.map((code) => ({
    code,
    action: { href },
  }));
}
