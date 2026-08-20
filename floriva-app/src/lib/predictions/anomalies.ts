/**
 * Anomaly detection primitives (A6).
 *
 * Pure, I/O-free module: given already-resolved engine facts (typical cycle
 * length, spread, expected next-period start, current open-cycle start,
 * daily logs), reports cycle-timing and bleeding-duration anomalies as
 * plain facts. This module does NOT decide whether/how to show anything to
 * the user, nor does it know about dismissal state -- see
 * `anomalyPresentation.ts` (B4) for the `Anomaly` shape and the
 * already-built dismissal filter, and B5 (not yet built) for screen wiring.
 * Detection always includes already-dismissed anomalies; screens filter.
 *
 * RAW FACTS ONLY -- the critical input contract: this module must be fed
 * the user's RAW observed reality, never the engine's forward-rolled
 * projection. `buildPredictionResult` rolls its cycle anchor forward by
 * whole cycles when the last logged start is old (so predictions stay in
 * the future), but an anomaly detector fed that rolled view would see a
 * synthetic "day 13 of a fresh cycle" instead of the real "41 days and
 * counting since the last actual period" -- exactly the situation the
 * long-cycle and missed-expected-period detectors exist to flag. See the
 * per-field docs on `DetectAnomaliesInput` and the A6 wiring comment in
 * buildPredictionResult.ts for the two-views split.
 *
 * Pipeline (each anomaly kind is independent -- see the exported constants
 * below for the clinical rationale behind each threshold):
 * 1. short-cycle / long-cycle: walk each COMPLETED interval between
 *    consecutive logged period starts, comparing it against bounds derived
 *    from the engine's typical cycle length + spread. Also checks the
 *    current OPEN cycle (today - currentStart) against the long bound, since
 *    an ongoing too-long cycle is observable before the next period lands.
 * 2. prolonged-bleeding: scan daily logs for consecutive-day runs of
 *    light/medium/heavy bleeding (spotting and gaps break a run).
 * 3. missed-expected-period: compare today against the un-rolled expected
 *    next-period start date plus a spread-derived grace window.
 *
 * Suppression: short-cycle, long-cycle, and missed-expected-period all
 * require real bleeding history with at least 2 COMPLETED intervals (3
 * logged starts) -- see `hasSufficientHistory` below. A single interval (2
 * starts) or the onboarding-seed synthetic history cannot distinguish "this
 * cycle is anomalous" from "this is simply the user's normal rhythm, we
 * just don't have a baseline yet". prolonged-bleeding has no such gate: it
 * only needs the daily logs themselves, independent of period-start
 * history quality.
 *
 * Recency (LT-03): completed-interval short-cycle/long-cycle candidates
 * anchored more than `COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS` before today
 * are dropped entirely -- without this, a long-tenure user's full interval
 * history is re-detected on every run and dismissing one nudge just
 * promotes a many-months-old anomaly to the head of the queue, forever. The
 * open-cycle long-cycle check, prolonged-bleeding, and
 * missed-expected-period are exempt: they are anchored at/near today or the
 * current open cycle by construction, so they are already naturally
 * recent. See the constant's doc comment for the 90-day rationale.
 *
 * Anchor date conventions (see each detector for the specific rationale):
 * - short-cycle / long-cycle: the start date of the anomalous cycle -- for
 *   a completed interval this is the LATER of the two period starts (the
 *   one that arrived early/late relative to the earlier one); for the
 *   open-cycle long-cycle rule it is the current cycle's own start date.
 * - prolonged-bleeding: the first day of the qualifying run.
 * - missed-expected-period: the expected (next-period) start date that was
 *   missed.
 */

import type { DailyLogEntry, PredictionResult } from '@/src/types/domain';

import { diffDays } from '@/src/lib/predictions/dateMath';
import type { Anomaly, AnomalyKind } from '@/src/lib/predictions/anomalyPresentation';

// --- Reciprocal compile-time lock: B4's `Anomaly` <-> domain.ts's inline shape ---
//
// `src/types/domain.ts` deliberately INLINES the anomaly element shape on
// `PredictionResult['anomalies']` (that file stays free of `src/lib` imports,
// mirroring the inlined `statistics` shape precedent), so nothing structural
// ties the inline copy to B4's `Anomaly`. These exported assertions do: the
// `Equals` trick demands exact structural identity (including optionality) in
// BOTH directions, so any drift on either side -- a field added, removed,
// renamed, made optional, or a kind added to either union -- stops this file
// compiling instead of silently forking the two shapes.
type AssertTrue<T extends true> = T;
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type EngineAnomaly = NonNullable<PredictionResult['anomalies']>[number];
export type AnomalyShapeLock = AssertTrue<Equals<Anomaly, EngineAnomaly>>;

// --- short-cycle / long-cycle bounds ---

// A cycle can never be flagged short below this floor, regardless of how
// tight the user's observed spread is -- protects against a razor-thin
// spread (e.g. a handful of near-identical intervals) making completely
// unremarkable day-to-day variation look anomalous.
const MIN_SHORT_CYCLE_MARGIN_DAYS = 7;
const SHORT_CYCLE_FLOOR_DAYS = 21;

// Mirrors the short-side floor: never require less than a 7-day margin
// above typical before calling a cycle long, even for a very tight spread.
const MIN_LONG_CYCLE_MARGIN_DAYS = 7;
const LONG_CYCLE_CAP_DAYS = 60;

// Hard product rule (locked): for a user who has NOT opted into
// irregular-cycle support, a cycle running past 38 days is flagged long
// even if the formula-derived bound (typical + margin) would allow more --
// a wide observed spread should widen the NORMAL range, but should never by
// itself excuse a genuinely very late period from a "regular" user. Users
// who *have* told us their cycles are irregular are exempted from this
// specific hard stop (see `supportsIrregularCycles` below) since a wide
// natural range is exactly what they opted into.
const REGULAR_USER_LONG_STOP_DAYS = 38;

// LT-03: without an age cutoff, EVERY completed interval in the user's whole
// history is re-detected on every engine run, so a long-tenure user's
// dismissal queue never actually empties -- dismissing this cycle's nudge
// just promotes a 5-, 8-, or 10-month-old anomaly to the head, forever.
// 90 days (~3 typical cycles) is chosen as "recent enough to still be
// actionable": a short/long-cycle anomaly is a signal to notice a pattern
// forming or flag it to a clinician, and a cycle boundary from 3+ cycles ago
// is stale history, not something to act on today. This cutoff applies ONLY
// to the completed-interval short-cycle/long-cycle detectors below --
// missed-expected-period and the open-cycle long-cycle check are anchored
// at `currentCycleStartDate`/today by construction and are already
// naturally recent; prolonged-bleeding likewise scans from the logs
// forward and its qualifying runs are inherently near-present. See the
// findings ledger (LT-03) for the full rationale.
const COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS = 90;

// --- prolonged-bleeding ---

// 8 consecutive days of actual bleeding (light/medium/heavy) is the
// threshold most clinical guidance uses for "prolonged" menstrual bleeding
// (typical periods run 3-7 days). Spotting is deliberately NOT bleeding for
// this purpose -- see `isBleedingDay` below -- so a spotting day breaks a
// run rather than extending or merely not-counting-but-preserving it: this
// is the clinically sensible reading, since spotting is physiologically
// different from menstrual flow and its presence mid-run means the heavier
// bleeding was not actually continuous.
const PROLONGED_BLEEDING_MIN_RUN_DAYS = 8;

// --- missed-expected-period grace ---

// Baseline grace before a late period is flagged: at least a week, or
// spread-derived (half the spread, rounded up, plus a 2-day buffer) if
// that is larger -- mirrors the +/-5-day (or +/-7 for irregular support)
// window cap used by `resolveNextPeriodWindow` for the same statistics.
const BASE_GRACE_FLOOR_DAYS = 7;
const BASE_GRACE_SPREAD_BUFFER_DAYS = 2;

// Widened grace for users who have told us their cycles are irregular:
// still a real signal worth surfacing (locked product decision -- this
// anomaly is NOT fully suppressed in irregular mode), but the bar for
// "notably late" is higher since more day-to-day variation is expected and
// already accounted for elsewhere (e.g. the wider next-period window).
const IRREGULAR_GRACE_FLOOR_DAYS = 10;

export type DetectAnomaliesInput = {
  todayIso: string;
  logEntries: DailyLogEntry[];
  historySource: PredictionResult['history']['source'];
  /** Chronological logged/seeded period-start dates (`history.startDates`). */
  historyStartDates: string[];
  /** The engine's resolved cycle-length estimate (`cycleLengthDays`). */
  typicalCycleLengthDays: number;
  /** `statistics?.spreadDays`; absent/undefined-safe -- treated as 0. */
  spreadDays: number | undefined;
  supportsIrregularCycles: boolean;
  /**
   * The LAST REAL logged period start -- NOT the engine's forward-rolled
   * `current.cycleStartDate` (`effectiveStartDate`). The open-cycle
   * long-cycle rule measures `today - currentCycleStartDate`; feeding it the
   * rolled anchor would reset that clock every `cycleLengthDays` days and
   * make the rule unfireable for any typical length at or below the bounds.
   */
  currentCycleStartDate: string;
  /**
   * The UN-ROLLED expected start of the (still-missing) next period: last
   * real start + typical cycle length on the calendar path, or the
   * signal-re-anchored date (ovulation + learned luteal, possibly in the
   * past -- see the relaxed invariant on `PredictionResult.nextPeriod`) when
   * A4 produced one. NOT the engine's rolled-forward `nextPeriod.startDate`,
   * which is always pushed into the future on the calendar path and would
   * make missed-expected-period undetectable there.
   */
  expectedStartDate: string;
};

function buildAnomaly(kind: AnomalyKind, anchorDateIso: string): Anomaly {
  return { id: `${kind}:${anchorDateIso}`, kind, anchorDateIso };
}

function resolveShortCycleBound(typical: number, spread: number): number {
  return Math.max(SHORT_CYCLE_FLOOR_DAYS, typical - Math.max(MIN_SHORT_CYCLE_MARGIN_DAYS, spread));
}

/**
 * `observedMargin` (LT-11): only passed for `supportsIrregularCycles` users
 * (see `collectTopTwoIntervals` below) -- floors the long-cycle margin at
 * the user's OWN observed range, not just the post-MAD-rejection survivor
 * spread. Without this, MAD outlier rejection (cycleStatistics.ts) can
 * discard a user's recurring long cycles from the spread calculation (they
 * are genuine outliers relative to the SHORTER cycles, even though they
 * recur for this user), which shrinks `spread` and tightens the bound below
 * the user's actual variance -- repeatedly flagging their own normal
 * rhythm. The margin passed here must EXCLUDE the interval under test (see
 * the self-masking note on `collectTopTwoIntervals`). Absent/0 for
 * non-irregular users, where the formula is unchanged.
 */
function resolveLongCycleBound(typical: number, spread: number, observedMargin = 0): number {
  return Math.min(
    LONG_CYCLE_CAP_DAYS,
    typical + Math.max(MIN_LONG_CYCLE_MARGIN_DAYS, spread, observedMargin),
  );
}

/**
 * LT-11: the two widest COMPLETED intervals in the user's history, used to
 * build a per-interval observed-range floor -- "how far above typical has
 * this user's own rhythm already gone, before any outlier rejection threw
 * intervals away". Only meaningful (and only applied) for
 * `supportsIrregularCycles` users: a "regular" user's wide interval is
 * exactly what short/long-cycle exists to flag, but an irregular-support
 * user's own recurring extremes should not retrigger on every run merely
 * because MAD rejection judged them non-representative for the SPREAD
 * calculation.
 *
 * SELF-MASKING (why two maxima, not one): when evaluating a completed
 * interval, the floor must derive from the OTHER intervals only. Computing
 * the observed max over ALL intervals would let a record-setting interval
 * raise the bound to exactly itself (typical + (self - typical) = self), and
 * the strict `>` comparison could then never flag it -- a genuinely NEW
 * sub-cap extreme (e.g. prior max 45d, new 55d, typical 26d) would be
 * silently absorbed. So: an interval equal to the largest is judged against
 * the SECOND-largest (which equals the largest when the extreme recurs --
 * that duplication is precisely what makes it the user's own known rhythm
 * rather than a new extreme); every other interval is judged against the
 * largest. The OPEN-cycle check is not a completed interval, so it is
 * always judged against the plain largest.
 */
function collectTopTwoIntervals(historyStartDates: string[]): {
  largest: number;
  secondLargest: number;
} {
  let largest = 0;
  let secondLargest = 0;
  for (let i = 1; i < historyStartDates.length; i += 1) {
    const intervalDays = diffDays(historyStartDates[i - 1]!, historyStartDates[i]!);
    if (intervalDays > largest) {
      secondLargest = largest;
      largest = intervalDays;
    } else if (intervalDays > secondLargest) {
      secondLargest = intervalDays;
    }
  }
  return { largest, secondLargest };
}

function isLongInterval(intervalDays: number, bound: number, supportsIrregularCycles: boolean) {
  if (intervalDays > bound) return true;
  return !supportsIrregularCycles && intervalDays > REGULAR_USER_LONG_STOP_DAYS;
}

/**
 * short-cycle / long-cycle: one candidate per COMPLETED interval between
 * consecutive logged/seeded starts, plus one extra candidate for the
 * current OPEN cycle (today vs. its own start) since an ongoing
 * too-long cycle is observable before the next period ever arrives -- the
 * plan's tenure-preset expectations (a currently-open gap should surface as
 * long-cycle, a fully lapsed one as missed-expected-period) require both
 * checks to run independently; they are not mutually exclusive; see the
 * "both fire" case in anomalies.test.ts.
 */
function detectCycleLengthAnomalies({
  historyStartDates,
  typicalCycleLengthDays,
  spreadDays,
  supportsIrregularCycles,
  currentCycleStartDate,
  todayIso,
}: {
  historyStartDates: string[];
  typicalCycleLengthDays: number;
  spreadDays: number;
  supportsIrregularCycles: boolean;
  currentCycleStartDate: string;
  todayIso: string;
}): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const shortBound = resolveShortCycleBound(typicalCycleLengthDays, spreadDays);
  // LT-11: only irregular-support users get the observed-range floor -- see
  // collectTopTwoIntervals' doc comment, including why the interval under
  // test must be excluded from its own floor (self-masking).
  const { largest, secondLargest } = supportsIrregularCycles
    ? collectTopTwoIntervals(historyStartDates)
    : { largest: 0, secondLargest: 0 };
  const resolveLongBoundForInterval = (intervalDays: number) => {
    if (!supportsIrregularCycles) {
      return resolveLongCycleBound(typicalCycleLengthDays, spreadDays);
    }
    // Exclude self: an interval equal to the observed max is judged against
    // the second-largest (identical when the extreme recurs -- the user's
    // own known rhythm); everything else is judged against the largest.
    const observedMaxExcludingSelf = intervalDays === largest ? secondLargest : largest;
    return resolveLongCycleBound(
      typicalCycleLengthDays,
      spreadDays,
      Math.max(0, observedMaxExcludingSelf - typicalCycleLengthDays),
    );
  };

  for (let i = 1; i < historyStartDates.length; i += 1) {
    const previousStart = historyStartDates[i - 1]!;
    const start = historyStartDates[i]!;
    const intervalDays = diffDays(previousStart, start);
    // LT-03: a completed interval anchored (at `start`) more than the
    // recency horizon before today is stale history -- do not re-surface it
    // on every run. See COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS above.
    if (diffDays(start, todayIso) > COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS) {
      continue;
    }

    if (intervalDays < shortBound) {
      anomalies.push(buildAnomaly('short-cycle', start));
    } else if (
      isLongInterval(intervalDays, resolveLongBoundForInterval(intervalDays), supportsIrregularCycles)
    ) {
      anomalies.push(buildAnomaly('long-cycle', start));
    }
  }

  // The open cycle is NOT a completed interval, so no self-exclusion
  // applies: it is judged against the plain observed max (`largest`).
  const openCycleDays = diffDays(currentCycleStartDate, todayIso);
  const openCycleLongBound = supportsIrregularCycles
    ? resolveLongCycleBound(
        typicalCycleLengthDays,
        spreadDays,
        Math.max(0, largest - typicalCycleLengthDays),
      )
    : resolveLongCycleBound(typicalCycleLengthDays, spreadDays);
  if (isLongInterval(openCycleDays, openCycleLongBound, supportsIrregularCycles)) {
    anomalies.push(buildAnomaly('long-cycle', currentCycleStartDate));
  }

  return anomalies;
}

function isBleedingDay(bleeding: DailyLogEntry['bleeding']) {
  return bleeding === 'light' || bleeding === 'medium' || bleeding === 'heavy';
}

/**
 * prolonged-bleeding: consecutive-CALENDAR-DAY runs of light/medium/heavy
 * bleeding. A run breaks on ANY non-qualifying day -- a logged spotting/none
 * day, or simply a missing log entry for the next calendar day (no entry is
 * absence of evidence, not evidence of continued bleeding, so it cannot
 * extend a run either). Only needs the daily logs; independent of the
 * period-start suppression gate (see module doc comment).
 */
function detectProlongedBleedingAnomalies(logEntries: DailyLogEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const sorted = [...logEntries].sort((a, b) => a.logDate.localeCompare(b.logDate));

  let runStartDate: string | null = null;
  let runLength = 0;
  let previousLogDate: string | null = null;

  const flushRun = () => {
    if (runStartDate && runLength >= PROLONGED_BLEEDING_MIN_RUN_DAYS) {
      anomalies.push(buildAnomaly('prolonged-bleeding', runStartDate));
    }
    runStartDate = null;
    runLength = 0;
  };

  for (const entry of sorted) {
    const isContiguous =
      previousLogDate !== null && diffDays(previousLogDate, entry.logDate) === 1;

    if (isBleedingDay(entry.bleeding) && (runStartDate === null || isContiguous)) {
      if (runStartDate === null) {
        runStartDate = entry.logDate;
      }
      runLength += 1;
    } else if (isBleedingDay(entry.bleeding)) {
      // Bleeding day, but not contiguous with the run in progress (a gap in
      // logged dates) -- the old run ends here; this day starts a new one.
      flushRun();
      runStartDate = entry.logDate;
      runLength = 1;
    } else {
      // Non-bleeding day (none/spotting) -- breaks the run outright.
      flushRun();
    }

    previousLogDate = entry.logDate;
  }
  flushRun();

  return anomalies;
}

function resolveMissedPeriodGraceDays(spreadDays: number, supportsIrregularCycles: boolean) {
  if (supportsIrregularCycles) {
    return Math.max(IRREGULAR_GRACE_FLOOR_DAYS, spreadDays);
  }
  return Math.max(BASE_GRACE_FLOOR_DAYS, Math.ceil(spreadDays / 2) + BASE_GRACE_SPREAD_BUFFER_DAYS);
}

/**
 * missed-expected-period: compares `todayIso` against the UN-ROLLED
 * expected start date (see `DetectAnomaliesInput.expectedStartDate`). On the
 * A4 signal path the caller passes the signal-re-anchored date, which may
 * already be in the past (a confirmed ovulation implies the period is late
 * relative to observed ovulation) -- that is exactly the natural trigger
 * input for this anomaly, not a case to special-case around: a past
 * expected date simply means today is already deep into the grace window
 * (or beyond it).
 */
function detectMissedExpectedPeriodAnomaly({
  todayIso,
  expectedStartDate,
  spreadDays,
  supportsIrregularCycles,
}: {
  todayIso: string;
  expectedStartDate: string;
  spreadDays: number;
  supportsIrregularCycles: boolean;
}): Anomaly[] {
  const grace = resolveMissedPeriodGraceDays(spreadDays, supportsIrregularCycles);
  const daysLate = diffDays(expectedStartDate, todayIso);

  if (daysLate > grace) {
    return [buildAnomaly('missed-expected-period', expectedStartDate)];
  }
  return [];
}

// At least 2 completed intervals (3 logged/seeded starts) are required
// before short-cycle, long-cycle, or missed-expected-period may fire -- see
// the module doc comment for the rationale. Real bleeding history only:
// onboarding-seed's single synthetic start is never enough on its own.
function hasSufficientHistory(
  historySource: PredictionResult['history']['source'],
  historyStartDates: string[],
) {
  return historySource === 'bleeding-history' && historyStartDates.length >= 3;
}

export function detectAnomalies({
  todayIso,
  logEntries,
  historySource,
  historyStartDates,
  typicalCycleLengthDays,
  spreadDays,
  supportsIrregularCycles,
  currentCycleStartDate,
  expectedStartDate,
}: DetectAnomaliesInput): Anomaly[] {
  const resolvedSpreadDays = spreadDays ?? 0;
  const anomalies: Anomaly[] = [
    ...detectProlongedBleedingAnomalies(logEntries),
  ];

  if (hasSufficientHistory(historySource, historyStartDates)) {
    anomalies.push(
      ...detectCycleLengthAnomalies({
        historyStartDates,
        typicalCycleLengthDays,
        spreadDays: resolvedSpreadDays,
        supportsIrregularCycles,
        currentCycleStartDate,
        todayIso,
      }),
      ...detectMissedExpectedPeriodAnomaly({
        todayIso,
        expectedStartDate,
        spreadDays: resolvedSpreadDays,
        supportsIrregularCycles,
      }),
    );
  }

  // Most-recent anchor first, matching B4's `filterDismissedAnomalies` sort
  // convention so a consumer wanting "show at most one" can just take the
  // head of the list regardless of which detector produced it.
  return anomalies.sort((a, b) =>
    a.anchorDateIso < b.anchorDateIso ? 1 : a.anchorDateIso > b.anchorDateIso ? -1 : 0,
  );
}
