import type { DailyLogEntry, PredictionSnapshot, SupportedLocale, UserProfile } from '@/src/types/domain';

import { attachImprovementActions } from '@/src/lib/predictions/confidencePresentation';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { diffDays } from '@/src/lib/predictions/dateMath';
import { filterDismissedAnomalies } from '@/src/lib/predictions/anomalyPresentation';
import {
  formatCycleDayLabel,
  formatFertileWindowCaption,
  formatFertileWindowLabel,
  formatHistoryChipLabel,
  formatPredictionConfidenceBasisLabel,
  formatPredictionConfidenceLabel,
  formatPredictionLimitation,
} from '@/src/lib/predictions/presentation';
import { translate } from '@/src/localization/translations';

type BuildTodaySnapshotOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  locale: SupportedLocale;
  /**
   * `AppPreferences.dismissedAnomalyIds`, threaded in by the caller (this
   * module stays pure/I-O-free, per project rules -- it does not read
   * preferences itself). Defaults to empty so callers that haven't hydrated
   * preferences yet still get a valid snapshot. See `filterDismissedAnomalies`
   * (anomalyPresentation.ts) for the filter + sort this relies on.
   */
  dismissedAnomalyIds?: string[];
};

export function buildTodaySnapshot({
  todayIso,
  profile,
  logEntries,
  locale,
  dismissedAnomalyIds = [],
}: BuildTodaySnapshotOptions): PredictionSnapshot {
  const prediction = buildPredictionResult({
    todayIso,
    profile,
    logEntries,
  });
  const improvements = attachImprovementActions(
    prediction.confidence.improvementCodes ?? [],
    todayIso,
  );
  // B5: at most ONE nudge on Today. `detectAnomalies` (A6) already sorts
  // most-recent-anchor-first; filterDismissedAnomalies preserves that order
  // after removing dismissed ids, so the head of the filtered list is both
  // "not yet dismissed" and "the most recent anomaly" -- which is also how
  // missed-expected-period naturally outranks a co-occurring long-cycle
  // (its anchor -- the expected date -- lands after the open cycle's own
  // start date; see buildTodaySnapshot.test.ts's "anomaly threading" suite).
  const anomaly = filterDismissedAnomalies(prediction.anomalies ?? [], dismissedAnomalyIds)[0];
  // LT-24: the fertile-window headline/caption and the cycle-day ribbon are
  // built on `prediction.current`/`prediction.fertileWindow`, which are
  // derived from the ROLLED SYNTHETIC anchor once history is stale (the same
  // `stale-history` signal LT-04/LT-09/LT-27 already key off). Asserting
  // "Fertile window active today" and a confident "Cycle day 13 of 29"
  // directly above the missed-period nudge is a trust violation -- those
  // are projections dressed up as observations. When stale, the headline
  // is replaced with a neutral, calm acknowledgment instead of a fertile-
  // window claim; the missed-period anomaly nudge (unaffected -- see
  // `anomaly` above) stays the actionable surface for the lapse.
  const isStale = prediction.confidence.reasonCodes.includes('stale-history');

  return {
    cycleDay: prediction.current.cycleDay,
    cycleLengthDays: prediction.cycleLengthDays,
    periodLengthDays: prediction.nextPeriod.lengthDays,
    cycleDayLabel: formatCycleDayLabel(prediction.current.cycleDay, locale),
    nextPeriodStartIso: prediction.nextPeriod.startDate,
    fertileWindowLabel: isStale
      ? translate(locale, 'predictions.today.staleHeadline')
      : formatFertileWindowLabel(
          todayIso,
          prediction.fertileWindow.startDate,
          prediction.fertileWindow.endDate,
          locale,
        ),
    fertileWindowCaption: isStale
      ? translate(locale, 'predictions.today.staleCaption')
      : formatFertileWindowCaption(
          todayIso,
          prediction.fertileWindow.startDate,
          prediction.fertileWindow.endDate,
          locale,
        ),
    // Feeds cyclePhaseModel.ts's injectable fertileWindowStartOffsetDays (via
    // CycleRibbon) so the Today phase ribbon derives its fertile segment from
    // the SAME window as this live prediction -- including a signal-confirmed
    // window (prediction.fertileWindow.basis === 'signal-confirmed'), which
    // can fall on a different offset than the plain calendar formula
    // CycleRibbon used to fall back to implicitly.
    fertileWindowStartOffsetDays: diffDays(
      prediction.current.cycleStartDate,
      prediction.fertileWindow.startDate,
    ),
    confidenceLevel: prediction.confidence.level,
    confidenceLabel: formatPredictionConfidenceLabel(prediction.confidence.level, locale),
    confidenceBasisLabel: formatPredictionConfidenceBasisLabel(
      prediction.history.startDates.length,
      locale,
    ),
    confidenceReasonCodes: prediction.confidence.reasonCodes,
    historyChipLabel: formatHistoryChipLabel(prediction.history.startDates.length, locale),
    // Fixed pre-existing bug (A5): Today used to pass raw English limitation
    // sentinel strings straight through unlocalized, while Calendar/Insights
    // localized them via `localizePredictionLimitation`. Now that every call
    // site is being touched for the code migration anyway, Today localizes
    // here too so all three surfaces are consistent.
    limitations: prediction.limitationCodes.map((code) =>
      formatPredictionLimitation(code, locale),
    ),
    ...(improvements.length > 0 ? { improvements } : {}),
    ...(anomaly ? { anomaly } : {}),
  };
}
