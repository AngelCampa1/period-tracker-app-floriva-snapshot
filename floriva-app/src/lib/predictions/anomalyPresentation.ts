/**
 * Anomaly-nudge presentation scaffold (B4).
 *
 * This module is intentionally engine-independent: it defines the shape of
 * an `Anomaly` the (not-yet-built) real detection engine will eventually
 * produce, plus a pure helper for filtering out anomalies the user has
 * already dismissed. Nothing here is wired to a screen — `AnomalyNudge`
 * (src/components/primitives/AnomalyNudge.tsx) is a dumb, presentational
 * component that renders whatever `Anomaly` it's handed.
 *
 * A6 ("Anomaly primitives (anomalies.ts)") will introduce the real detection
 * logic in its own `anomalies.ts` module; this file deliberately does not
 * claim that name so A6 can land without a rename. B5 will then wire real
 * anomalies + this filter into a screen (Today nudge / Insights
 * Observations).
 */

export const anomalyKindValues = [
  'short-cycle',
  'long-cycle',
  'prolonged-bleeding',
  'missed-expected-period',
] as const;

export type AnomalyKind = (typeof anomalyKindValues)[number];

export type Anomaly = {
  /**
   * Stable identity for this anomaly occurrence, conventionally
   * `{kind}:{anchorDateIso}` — constructed by whatever eventually detects
   * anomalies (A6), not by this module or by `AnomalyNudge`. Used as the
   * dismissal key persisted in `AppPreferences.dismissedAnomalyIds`.
   */
  id: string;
  kind: AnomalyKind;
  /** ISO date the anomaly is anchored to (e.g. the cycle start it flags). */
  anchorDateIso: string;
};

/**
 * Filters out anomalies whose `id` has already been dismissed, returning the
 * remainder sorted most-recent `anchorDateIso` first. Sorting (rather than
 * leaving order up to the caller) lets a future consumer just take the head
 * of the list when it wants "show at most one nudge".
 */
export function filterDismissedAnomalies(
  anomalies: Anomaly[],
  dismissedIds: string[],
): Anomaly[] {
  const dismissed = new Set(dismissedIds);

  return anomalies
    .filter((anomaly) => !dismissed.has(anomaly.id))
    .sort((a, b) => (a.anchorDateIso < b.anchorDateIso ? 1 : a.anchorDateIso > b.anchorDateIso ? -1 : 0));
}
