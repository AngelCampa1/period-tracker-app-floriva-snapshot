import type {
  DailyLogEntry,
  PeriodEvidenceEntry,
  PredictionResult,
  UserProfile,
} from '@/src/types/domain';

import { detectAnomalies } from '@/src/lib/predictions/anomalies';
import {
  PROJECTED_FORWARD_LIMITATION_CODE,
  resolveConfidence,
  resolveLimitations,
} from '@/src/lib/predictions/confidence';
import { selectImprovementCodes } from '@/src/lib/predictions/confidenceImprovements';
import {
  collectPeriodStarts,
  resolveCycleLengthDays,
  resolvePeriodLengthDays,
} from '@/src/lib/predictions/cycleHistory';
import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import { resolveNextPeriodWindow } from '@/src/lib/predictions/nextPeriodWindow';
import {
  analyzeCurrentCycleOvulation,
  buildLutealLearningInput,
  FERTILE_WINDOW_LOOKBACK_DAYS,
  sliceCyclesIntoPeriods,
} from '@/src/lib/predictions/ovulationAnalysis';
import { learnLutealLength } from '@/src/lib/predictions/lutealLearning';

type BuildPredictionResultOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
};

export function buildPredictionResult({
  todayIso,
  profile,
  logEntries,
}: BuildPredictionResultOptions): PredictionResult {
  const periodStarts = collectPeriodStarts(logEntries);
  const historySource =
    periodStarts.length > 0 && periodStarts[0] ? 'bleeding-history' : 'onboarding-seed';
  const historyStartDates =
    historySource === 'bleeding-history'
      ? periodStarts.map((entry) => entry.logDate)
      : profile.lastPeriodStartDate
        ? [profile.lastPeriodStartDate]
        : [todayIso];
  const lastLoggedStartDate = historyStartDates[historyStartDates.length - 1] ?? todayIso;
  const activeBleeding =
    periodStarts[periodStarts.length - 1] ??
    ({
      logDate: lastLoggedStartDate,
      bleeding: 'light',
    } satisfies PeriodEvidenceEntry);
  const cycleLengthResolution = resolveCycleLengthDays(profile, historyStartDates, historySource);
  const { cycleLengthDays, statistics } = cycleLengthResolution;
  const periodLengthDays = resolvePeriodLengthDays(profile);

  // Roll the anchor forward by whole cycles until it lands within the current
  // cycle. Without this, an old logged start produces nonsensical output like
  // "cycle day 61 of 29" and a stale CALENDAR next-period date far in the
  // past. Note (A4): this roll only guarantees a future date for the
  // calendar-derived path below -- the signal re-anchor path
  // (ovulation + learned luteal) can legitimately emit a nextPeriod.startDate
  // in the recent past when the observed ovulation implies the period is
  // already late. See the invariant note on PredictionResult.nextPeriod in
  // src/types/domain.ts.
  let effectiveStartDate = lastLoggedStartDate;
  let rolledCycles = 0;
  while (diffDays(effectiveStartDate, todayIso) >= cycleLengthDays) {
    effectiveStartDate = addDays(effectiveStartDate, cycleLengthDays);
    rolledCycles += 1;
  }

  // LT-04: "high confidence, consistent RECENT bleeding history" is
  // dishonest once the user has gone quiet for a while -- only the
  // `projected-forward` limitation code (buried in a rarely-opened detail)
  // hinted at this before. Two independent triggers, either sufficient:
  // (1) the un-rolled calendar expectation (last real start + typical
  // length) is more than 30 days overdue -- mirrors the raw-facts
  // missed-expected-period signal (anomalies.ts) but computed directly here
  // so staleness applies even when that anomaly itself is suppressed for
  // insufficient history; (2) the anchor had to roll forward >= 2 whole
  // cycles to reach today, i.e. the user has been silent for at least two
  // of their own cycles. 30 days / 2 cycles are both "long enough that
  // 'recent' is no longer a fair description," independent of the user's
  // typical cycle length.
  const daysSinceCalendarExpectation = diffDays(
    addDays(lastLoggedStartDate, cycleLengthDays),
    todayIso,
  );
  const isHistoryStale = daysSinceCalendarExpectation > 30 || rolledCycles >= 2;

  const confidence = resolveConfidence(
    profile,
    historySource,
    historyStartDates.length,
    isHistoryStale,
  );
  const limitationCodes = resolveLimitations(profile, historySource, historyStartDates.length);
  if (rolledCycles > 0) {
    limitationCodes.push(PROJECTED_FORWARD_LIMITATION_CODE);
  }

  const calendarNextPeriodStartDate = addDays(effectiveStartDate, cycleLengthDays);

  // --- A4: ovulation-signal analysis (current/open cycle) ---
  //
  // Only bleeding-history callers have a real, contiguous open-cycle entry
  // slice to analyze -- the onboarding-seed path's single synthetic start
  // date has no corresponding logged entries to run detectors against, so
  // signal analysis is skipped entirely there (equivalent to "no signals
  // present" -> calendar-fallback). `effectiveStartDate` (not the raw last
  // logged start) anchors the current-cycle slice so a rolled-forward
  // history still analyzes the RIGHT (current) cycle window, not a stale
  // one.
  const currentCycleEntries =
    historySource === 'bleeding-history'
      ? logEntries.filter((entry) => entry.logDate >= effectiveStartDate)
      : [];
  const ovulation =
    historySource === 'bleeding-history'
      ? analyzeCurrentCycleOvulation({
          todayIso,
          cycleStartIso: effectiveStartDate,
          cycleLengthDays,
          entries: currentCycleEntries,
          profile,
        })
      : undefined;

  // --- A5: ovulation-derived confidence reason codes ---
  //
  // `resolveConfidence` has no access to `ovulation` (it only sees
  // profile/historySource/periodStartCount), so these three codes are
  // appended here, AFTER the base reasonCodes, based purely on the
  // `ovulation` field just computed above. They never change
  // `confidence.level` -- only the explanatory codes array. Mutually
  // exclusive by construction: gating suppresses all signal detection, so
  // 'signals-disagree' can only appear when ovulation is populated and NOT
  // gated.
  if (ovulation?.gated === 'hormonal-birth-control') {
    confidence.reasonCodes.push('hormonal-birth-control');
  } else if (ovulation != null) {
    confidence.reasonCodes.push(
      ovulation.signalsDisagree === true ? 'signals-disagree' : 'ovulation-signal-confirmed',
    );
  }

  const improvementCodes = selectImprovementCodes(confidence.reasonCodes);
  if (improvementCodes.length > 0) {
    confidence.improvementCodes = improvementCodes;
  }

  // --- A4: luteal-length learning ---
  //
  // Runs whenever there is real bleeding history to slice into cycles,
  // REGARDLESS of the gate above or the showFertilityEstimates display
  // toggle (that toggle is presentation-layer only -- see CycleRibbon.tsx /
  // buildCalendarScreenModel.ts / buildInsightsScreenModel.ts consumers,
  // none of which reach this engine module). Learning is independent of
  // whether the CURRENT cycle is gated: a user who just started hormonal
  // birth control should not lose the luteal length already learned from
  // their pre-BC history, since a future method change (or a data-entry
  // correction) could make that learned value relevant again, and there is
  // no harm in an unused learned value sitting in memory for this request.
  const lutealLearning =
    historySource === 'bleeding-history'
      ? learnLutealLength(
          buildLutealLearningInput(
            sliceCyclesIntoPeriods(logEntries, historyStartDates),
          ),
        )
      : learnLutealLength([]);

  // A signal-confirmed ovulation re-anchors the prediction (window + next
  // period) ONLY when analysis produced a populated, non-gated estimate.
  const hasConfirmedOvulation = ovulation != null && ovulation.gated == null;

  const nextPeriodStartDate = hasConfirmedOvulation
    ? addDays(ovulation.dateIso, lutealLearning.lutealLengthDays)
    : calendarNextPeriodStartDate;

  // Earliest/latest window around the predicted start, derived from the
  // robust statistics; undefined when there was no real observed-interval
  // sample (profile/default fallback, or every interval discarded). See
  // resolveNextPeriodWindow for the field-absence API contract: when
  // undefined, the optional keys spread below stay entirely ABSENT from the
  // result rather than present with undefined values. Re-anchored on
  // `nextPeriodStartDate` (which may now be the signal-confirmed date) --
  // this is exactly the argument-swap resolveNextPeriodWindow was built for
  // (see its own doc comment); the statistics summary itself still reflects
  // the user's observed calendar history either way.
  const nextPeriodWindow = resolveNextPeriodWindow(nextPeriodStartDate, statistics, profile);

  // --- A6: anomaly detection ---
  //
  // Two views of "the current cycle" coexist here, on purpose:
  //
  // 1. The PROJECTION view (everything else in this function):
  //    `effectiveStartDate` is rolled forward by whole cycles, so
  //    `nextPeriodStartDate` is always future on the calendar path --
  //    predictions must keep pointing forward no matter how stale the
  //    history is.
  // 2. The OBSERVED view (this block only): anomalies must see raw reality
  //    -- `lastLoggedStartDate` (the last REAL period start, pre-roll) and
  //    the UN-ROLLED expectation derived from it. Feeding the detector the
  //    rolled view would reset the open-cycle clock every cycleLengthDays
  //    days: an ongoing 41-day gap would read as a synthetic day-13 cycle,
  //    long-cycle could never fire for typical lengths at/below its bounds,
  //    and missed-expected-period would be dead on the whole calendar path.
  //
  // Expected start for the missed-period check: the signal-re-anchored date
  // when A4 confirmed ovulation (it already encodes "the period is late
  // relative to observed ovulation" and may sit in the past -- see the
  // relaxed invariant on PredictionResult.nextPeriod), otherwise the plain
  // un-rolled calendar expectation off the last real start. Detection
  // includes already-dismissed anomalies; screens (B5) filter via
  // `filterDismissedAnomalies` (anomalyPresentation.ts).
  const anomalies = detectAnomalies({
    todayIso,
    logEntries,
    historySource,
    historyStartDates,
    typicalCycleLengthDays: cycleLengthDays,
    spreadDays: statistics?.spreadDays,
    supportsIrregularCycles: profile.supportsIrregularCycles,
    currentCycleStartDate: lastLoggedStartDate,
    expectedStartDate: hasConfirmedOvulation
      ? nextPeriodStartDate
      : addDays(lastLoggedStartDate, cycleLengthDays),
  });

  return {
    cycleLengthDays,
    history: {
      source: historySource,
      startDates: historyStartDates,
    },
    current: {
      cycleDay: Math.max(1, diffDays(effectiveStartDate, todayIso) + 1),
      cycleStartDate: effectiveStartDate,
      activeBleeding,
    },
    nextPeriod: {
      startDate: nextPeriodStartDate,
      lengthDays: periodLengthDays,
      ...(nextPeriodWindow
        ? {
            earliestStartDate: nextPeriodWindow.earliestStartDate,
            latestStartDate: nextPeriodWindow.latestStartDate,
          }
        : {}),
    },
    fertileWindow: hasConfirmedOvulation
      ? {
          // Signal-confirmed window: ovulation day plus the 5 preceding days
          // (sperm survival) -- see ovulationAnalysis.ts for the retrospective
          // discipline that gates when this branch is even reachable.
          startDate: addDays(ovulation.dateIso, -FERTILE_WINDOW_LOOKBACK_DAYS),
          endDate: ovulation.dateIso,
          basis: 'signal-confirmed',
        }
      : {
          // Ovulation occurs ~14 days before the next period (the luteal phase is
          // the stable interval). The fertile window is the day of ovulation plus
          // the 5 preceding days (sperm survival), i.e. [next-19, next-14]. The
          // post-ovulation luteal phase is the LEAST fertile and must not be
          // surfaced as the fertile window.
          startDate: addDays(nextPeriodStartDate, -19),
          endDate: addDays(nextPeriodStartDate, -14),
        },
    confidence,
    limitationCodes,
    ...(nextPeriodWindow ? { statistics: nextPeriodWindow.statistics } : {}),
    ...(ovulation ? { ovulation } : {}),
    ...(anomalies.length > 0 ? { anomalies } : {}),
  };
}
