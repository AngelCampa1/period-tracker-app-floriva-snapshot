import type {
  ConditionKey,
  ConfidenceImprovement,
  ConfidenceReasonCode,
  PredictionConfidenceLevel,
} from '@/src/types/domain';

import type { Anomaly } from '@/src/lib/predictions/anomalyPresentation';

export type TtcHighlightKind =
  | 'ovulationTest'
  | 'cervicalMucus'
  | 'basalBodyTemperature'
  | 'sex';

export type TtcObservationHighlight = {
  kind: TtcHighlightKind;
  date: string;
  label: string;
};

export type TtcRecentLogSummary = {
  date: string;
  summary: string;
};

export type TtcSummaryModel = {
  fertileWindowLabel: string;
  currentWindowLoggedDays: number;
  currentWindowLengthDays: number;
  /**
   * UL-14: highlights are scoped to the CURRENT fertile window -- the same
   * window `currentWindowLoggedDays` counts and the screen's "Logged on X
   * of Y fertile-window days" description claims. Empty when nothing was
   * logged inside that window (out-of-window observations still appear,
   * dated, in `recentLogSummaries`).
   */
  latestHighlights: TtcObservationHighlight[];
  recentLogSummaries: TtcRecentLogSummary[];
};

export type ConditionSummaryModel = {
  key: ConditionKey;
  title: string;
  summary: string;
  emptyState: string;
  loggingHint: string;
  recentLogCount: number;
  trackedSymptomLabels: string[];
};

export type CycleLengthBar = {
  days: number;
  isLatest: boolean;
};

/**
 * LT-18 (re-based by UL-02): an honest classification of how steady the
 * user's cycle length actually is, derived from the same robust statistics
 * module (`computeCycleStatistics`, cycleStatistics.ts) the engine uses --
 * never a locally recomputed average. See
 * `resolveCycleLengthConsistencyLevel` in buildInsightsScreenModel.ts for
 * the exact thresholds.
 *
 * UL-02: classification runs on `rawSpreadDays` (the MAD spread of the
 * bounds-filtered intervals BEFORE outlier rejection), not the survivor
 * spread -- rejecting a user's 38/45/64-day cycles as "outliers" and then
 * calling the surviving cluster "consistent" described visibly irregular
 * data as regular (the P0 ledger screenshot).
 *
 * - 'not-enough-data': fewer than 2 surviving observed intervals (a single
 *   logged period, or every interval discarded by the engine's bounds/MAD
 *   filters) -- there is no legitimate "regular" or "irregular" claim to
 *   make yet.
 * - 'consistent': rawSpreadDays <= 2 -- matches the historical "+/- 2 days"
 *   copy, honestly gated on it actually being true. Median-based, so a
 *   single anomalous lapse in a steady history stays consistent (calm).
 * - 'somewhat-variable': 2 < rawSpreadDays <= 6.
 * - 'varies-widely': rawSpreadDays > 6, OR the MAD step rejected >= 2
 *   intervals amounting to >= 1/3 of the bounds-plausible set (when a third
 *   of recent cycles are "outliers", the outliers are the pattern).
 */
export type CycleLengthConsistencyLevel =
  | 'not-enough-data'
  | 'consistent'
  | 'somewhat-variable'
  | 'varies-widely';

export type CycleLengthData = {
  /**
   * LT-18/LT-21: always the SAME number the engine uses elsewhere on this
   * screen (`PredictionResult.cycleLengthDays`, the robust/outlier-rejected
   * estimate) -- never a locally recomputed naive average of raw intervals.
   * This keeps the number on this card identical to the number the phase-
   * rhythm card derives its phase durations from (LT-21), and keeps a
   * bounds/MAD-discarded interval (e.g. a multi-month gap) from being
   * silently averaged back in (LT-18).
   */
  avgDays: number;
  /**
   * Raw per-interval history for the bar chart. Unlike `avgDays`, these
   * intentionally include every observed interval (even ones the engine's
   * statistics discarded as outliers) -- each bar is independently labeled
   * with its own day count, so showing the true range here is honest, not
   * misleading; only a SUMMARY number (avgDays, consistencyLevel) must not
   * silently blend in a discarded interval.
   */
  bars: CycleLengthBar[];
  /**
   * True only when at least one cycle-to-cycle interval has actually been
   * observed. When false the average is a seeded estimate, so the UI must not
   * claim the cycle is "steady" or "regular".
   */
  hasObservedHistory: boolean;
  /** LT-18: see `CycleLengthConsistencyLevel` above. */
  consistencyLevel: CycleLengthConsistencyLevel;
  /**
   * LT-18: localized subtitle for the card header (e.g. "Consistent on
   * average" / "Varies widely" / "Not enough data yet"), pre-resolved from
   * `consistencyLevel` via the `insights.cycleLength.subtitle*` catalog
   * (src/localization/messages/insights.ts) so the screen stays a pure
   * renderer with no locale branching of its own.
   */
  subtitleLabel: string;
  /**
   * LT-18: localized footnote explaining the classification (e.g. "Within
   * about +/- 2 days..." / "Ranging widely..."), pre-resolved from
   * `consistencyLevel` (and `spreadDays` where the copy cites a number) via
   * the `insights.cycleLength.footnote*` catalog.
   */
  footnoteLabel: string;
};

export type PhaseRhythmData = {
  periodDays: number;
  follicularDays: number;
  fertileDays: number;
  lutealDays: number;
  cycleLengthDays: number;
};

export type MonthlyBriefingModel = {
  title: string;
  subtitle: string;
  lead: string;
  /**
   * UL-33: raw day counts for stat-card slots whose LABEL already names the
   * unit (the briefing detail's "PERIOD DAYS" / "SYMPTOM DAYS" cards). The
   * pre-labeled `periodDaysLabel`/`symptomDaysLabel` strings remain for
   * standalone chips (the Insights hub) where the value must carry its own
   * unit — using those inside a labeled card produced "PERIOD DAYS / 2
   * period days" restatement.
   */
  periodDaysCount: number;
  symptomDaysCount: number;
  periodDaysLabel: string;
  symptomDaysLabel: string;
  /**
   * UL-33: true when at least one named signal exists — the "keep logging"
   * empty-state coaching must only lead the Top signals card when there is
   * actually nothing to show.
   */
  hasTopSignals: boolean;
  topSignalsLabel: string;
  sourceLabels: string[];
  emptyState: string;
};

export type InsightsScreenModel = {
  // UL-03: no `lead` here on purpose — the old lead was the privacy readout
  // ("Built from cycle history stored on this device."), which screens then
  // rendered inside insight-content slots (the "Pattern noticed" pull-quote,
  // a bold card lead), masquerading a privacy footnote as an analysis result.
  // Screens now render the privacy promise directly from the
  // `insights.cyclePattern.localPatternReadout` catalog string, in footnote/
  // subtitle roles only.
  cyclePattern: {
    title: string;
    periodStartsLabel: string;
    nextPeriodLabel: string;
    confidenceLevel: PredictionConfidenceLevel;
    confidenceLabel: string;
    // See PredictionSnapshot.confidenceReasonCodes in src/types/domain.ts —
    // feeds buildConfidenceInfoModalContent's reason-detail paragraph.
    confidenceReasonCodes: ConfidenceReasonCode[];
  };
  cycleLengthData: CycleLengthData;
  phaseRhythmData: PhaseRhythmData;
  showFertilityEstimates: boolean;
  ttcSummary?: TtcSummaryModel;
  conditionSummaries: ConditionSummaryModel[];
  monthlyBriefing: MonthlyBriefingModel;
  /**
   * Actionable suggestions derived from the current confidence reasons. See
   * `src/lib/predictions/confidencePresentation.ts`.
   */
  improvements?: ConfidenceImprovement[];
  /**
   * Additive (B5): ALL non-dismissed anomalies (most-recent-anchor first),
   * not just the head Today shows -- Insights is a quiet, complete record,
   * not an actionable nudge, so it does not truncate to one and does not
   * expose a dismiss affordance (dismissal is Today's job; see
   * `InsightsCyclePatternScreen`). Absent (not an empty array) when there is
   * nothing to show, so the "Observations" section can be omitted entirely
   * rather than rendered empty.
   */
  observations?: Anomaly[];
  /**
   * UL-88: which all-clear line the Observations section shows when
   * `observations` is absent. 'varies-widely' means the cycle-length pattern
   * is highly variable (see `cycleLengthData.consistencyLevel`), so the bare
   * "nothing unusual" line would contradict the cycle-length card's "Varies
   * widely" verdict on the same screen — an honest variability statement is
   * shown instead. 'calm' is the default reassuring all-clear. A calm data
   * statement either way; never a medical claim.
   */
  observationsAllClear: 'calm' | 'varies-widely';
};
