/**
 * Shared discriminated shape for all ovulation-estimate signals.
 *
 * Every detector in `src/lib/predictions/signals/` produces (or fails to
 * produce) one of these. The `kind` discriminant identifies the physiological
 * source; `prospective` / `retrospective` encode WHEN in the cycle the signal
 * is allowed to be acted on:
 *
 * - `prospective: true` — the signal can open or adjust the fertile window
 *   ahead of ovulation (e.g. an OPK surge detected today). Consumers (the A4
 *   orchestrator) may act on it immediately.
 * - `retrospective: true` — the signal can only ever CONFIRM that ovulation
 *   already happened (e.g. a BBT coverline shift, which by construction needs
 *   3 days of post-ovulation temperatures to detect). Consumers must never use
 *   a retrospective signal to open a fertile window prospectively; its only
 *   valid use is anchoring luteal-phase learning after the fact.
 *
 * A signal is exactly one of the two -- never both, never neither -- so the
 * orchestrator can branch on the flag without also checking `kind`.
 */

export type OvulationSignalBase = {
  /** Best estimate of the ovulation date, as an ISO (YYYY-MM-DD) date. */
  ovulationDateIso: string;
  /**
   * Estimate uncertainty in days. 0 means the detector considers the date
   * exact (given its own methodology); higher values mean the true ovulation
   * day could plausibly be anywhere within +/- uncertaintyDays.
   */
  uncertaintyDays: number;
};

export type BbtShiftSignal = OvulationSignalBase & {
  kind: 'bbt-shift';
  /** The first elevated-temperature day that established the coverline shift. */
  shiftDateIso: string;
  /** Always true: a completed 3-over-6 shift is definitionally a confirmation. */
  confirmed: true;
  /** Always true: see module doc -- BBT can only confirm after the fact. */
  retrospective: true;
  prospective: false;
};

export type OpkSurgeSignal = OvulationSignalBase & {
  kind: 'opk-surge';
  /** Which OPK result triggered the estimate -- `peak` outweighs `positive`. */
  triggerResult: 'positive' | 'peak';
  /** Always true: an OPK surge can be acted on the same day it is observed. */
  prospective: true;
  retrospective: false;
};

export type MucusPeakSignal = OvulationSignalBase & {
  kind: 'mucus-peak';
  /** The last egg-white-quality day preceding the observed dry-up. */
  peakDateIso: string;
  /**
   * Weakest of the three signals -- confirmed only once a dry-up is
   * observed, so treated as prospective-adjacent but with the widest
   * uncertainty band (+/-2 days, see mucusPeak.ts).
   */
  prospective: true;
  retrospective: false;
};

export type OvulationSignal = BbtShiftSignal | OpkSurgeSignal | MucusPeakSignal;

/**
 * Fusion result types (produced by `fuseOvulationEstimate`). Kept here
 * alongside the per-signal shapes so the whole signal-library vocabulary
 * lives in one place; the fusion algorithm itself and the rationale for each
 * field live in fuseOvulationEstimate.ts.
 */
export type FusedOvulationEstimate = {
  kind: 'fused';
  ovulationDateIso: string;
  uncertaintyDays: number;
  /** True only on the conflict-resolution path (see fuseOvulationEstimate.ts). */
  signalsDisagree: boolean;
  contributingSignals: OvulationSignal['kind'][];
};

/**
 * Marker telling the caller (the A4 orchestrator) that fusion declined to
 * produce a trustworthy estimate and it should fall back to the plain
 * calendar method. Returned when no signals are present, when non-BBT
 * signals conflict with no BBT to anchor on, or when the fused date fails
 * the plausibility clamp.
 */
export type CalendarFallbackMarker = {
  kind: 'calendar-fallback';
};

export type FuseOvulationEstimateResult = FusedOvulationEstimate | CalendarFallbackMarker;

export type FuseOvulationEstimateInput = {
  cycleStartIso: string;
  cycleLengthDays: number;
  bbt?: BbtShiftSignal;
  opk?: OpkSurgeSignal;
  mucus?: MucusPeakSignal;
};
