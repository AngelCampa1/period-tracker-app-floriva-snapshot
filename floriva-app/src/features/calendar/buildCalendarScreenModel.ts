import type {
  ConfidenceImprovement,
  ConfidenceReasonCode,
  DailyLogEntry,
  PredictionConfidenceLevel,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

import { buildTodaySnapshot } from '@/src/features/tracker/buildTodaySnapshot';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays, diffDays, isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';
import {
  formatCurrentExpectedPeriodRangeLabel,
  formatMonthDayLabel,
  formatMonthLabel,
  formatNextPeriodExpectedRangeLabel,
  formatPredictionLimitation,
  formatStalePredictionBannerLabel,
  formatWeekdayLabels,
} from '@/src/lib/predictions/presentation';

type CalendarMarker = 'none' | 'spotting' | 'period' | 'predicted-period';

/**
 * Position of a day cell within a contiguous horizontal band run, computed
 * INDEPENDENTLY per week row (see applyBandSegments below): 'single' is a
 * one-cell run, otherwise 'start' -> 'mid'* -> 'end'. Runs are clipped at
 * row boundaries and at out-of-month cells, so within any row a 'start'
 * always has a matching 'end' and never dangles.
 */
export type CalendarBandSegment = 'start' | 'mid' | 'end' | 'single';

export type CalendarScreenModel = {
  monthLabel: string;
  showFertilityEstimates: boolean;
  weekdayLabels: string[];
  weeks: {
    date: string;
    dayNumber: string;
    inMonth: boolean;
    isToday: boolean;
    marker: CalendarMarker;
    cycleDay: number | null;
    isFertile: boolean;
    /** Band run position among contiguous logged-period days (marker 'period'). */
    periodBand: CalendarBandSegment | null;
    /** Band run position among contiguous predicted-period days. */
    predictedBand: CalendarBandSegment | null;
    /**
     * Band run position among contiguous fertile days. Orthogonal to the two
     * marker-driven bands above: a cell can carry a fertile band AND a
     * period/predicted band at the same time.
     */
    fertileBand: CalendarBandSegment | null;
  }[][];
  predictionSummary: {
    nextPeriodLabel: string;
    confidenceLevel: PredictionConfidenceLevel;
    confidenceLabel: string;
    confidenceBasisLabel: string;
    // See PredictionSnapshot.confidenceReasonCodes in src/types/domain.ts —
    // feeds buildConfidenceInfoModalContent's reason-detail paragraph.
    confidenceReasonCodes: ConfidenceReasonCode[];
    limitations: string[];
  };
  historyItems: {
    date: string;
    label: string;
    bleeding: DailyLogEntry['bleeding'];
  }[];
  recentCycles: {
    startDate: string;
    endDate: string;
    rangeLabel: string;
    lengthDays: number;
  }[];
  /**
   * Actionable suggestions derived from the current confidence reasons. See
   * `src/lib/predictions/confidencePresentation.ts`.
   */
  improvements?: ConfidenceImprovement[];
};

type BuildCalendarScreenModelOptions = {
  todayIso: string;
  monthIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  locale: SupportedLocale;
  showFertilityEstimates?: boolean;
};

function getDateParts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return {
    year,
    month,
    day,
  };
}

function getMonthStart(monthIso: string) {
  const { year, month } = getDateParts(monthIso);

  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getMonthEnd(monthIso: string) {
  const { year, month } = getDateParts(monthIso);

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function getUtcWeekday(isoDate: string) {
  return new Date(isoDateToUtcMillis(isoDate)).getUTCDay();
}

function buildLoggedMarkers(logEntries: DailyLogEntry[]) {
  const markers = new Map<string, CalendarMarker>();

  for (const entry of logEntries) {
    if (entry.bleeding === 'spotting') {
      markers.set(entry.logDate, 'spotting');
      continue;
    }

    if (
      entry.bleeding === 'light' ||
      entry.bleeding === 'medium' ||
      entry.bleeding === 'heavy'
    ) {
      markers.set(entry.logDate, 'period');
      continue;
    }

    markers.set(entry.logDate, 'none');
  }

  return markers;
}

function buildPredictedPeriodDates(startDate: string, lengthDays: number) {
  return new Set(Array.from({ length: lengthDays }, (_, index) => addDays(startDate, index)));
}

function formatCalendarPredictionRangeLabel({
  currentPeriodStartIso,
  currentPeriodEndIso,
  nextPeriodStartIso,
  nextPeriodEndIso,
  locale,
  todayIso,
  isPredictionStale,
}: {
  currentPeriodStartIso: string;
  currentPeriodEndIso: string;
  nextPeriodStartIso: string;
  nextPeriodEndIso: string;
  locale: SupportedLocale;
  todayIso: string;
  isPredictionStale: boolean;
}) {
  // LT-27: once the prediction is stale, LT-09 already suppresses every
  // predicted-period shaded cell on the grid (both windows derive from the
  // same synthetic rolled anchor -- see the isPredictionStale comment
  // below). Continuing to announce concrete dates here ("Next period
  // expected Jul 24 to 28") while the grid draws nothing for them is its
  // own incoherence: the banner would assert exactly what the grid just
  // refused to draw. Reconciled by switching the banner to the same
  // honest, action-oriented framing as the confidence-improvement row
  // (see confidenceImprovements.ts's `stale-history` code) BEFORE the
  // current/next branch below -- one coherent stale story across
  // banner + grid, matching Today's stale handling (LT-24).
  if (isPredictionStale) {
    return formatStalePredictionBannerLabel(locale);
  }

  // The next-period boundary is always projected into the future, so "current
  // expected period" must be detected against the period window of the cycle the
  // user is currently in (which may itself be a forward-projected start).
  if (todayIso >= currentPeriodStartIso && todayIso <= currentPeriodEndIso) {
    return formatCurrentExpectedPeriodRangeLabel(
      currentPeriodStartIso,
      currentPeriodEndIso,
      locale,
    );
  }

  return formatNextPeriodExpectedRangeLabel(nextPeriodStartIso, nextPeriodEndIso, locale);
}

function formatHistoryItemLabel(bleeding: DailyLogEntry['bleeding'], locale: SupportedLocale) {
  if (bleeding === 'spotting') {
    switch (locale) {
      case 'es':
        return 'Manchado';
      case 'de':
        return 'Schmierblutung';
      case 'fr':
        return 'Saignotement';
      case 'ja':
        return 'スポッティング';
      case 'zh-Hans':
        return '点滴出血';
      case 'pt':
        return 'Escape';
      case 'ru':
        return 'Мажущие выделения';
      default:
        return 'Spotting';
    }
  }

  switch (locale) {
    case 'es':
      return 'Día de periodo';
    case 'de':
      return 'Periodentag';
    case 'fr':
      return 'Jour de règles';
    case 'ja':
      return '生理の日';
    case 'zh-Hans':
      return '月经日';
    case 'pt':
      return 'Dia de período';
    case 'ru':
      return 'День месячных';
    default:
      return 'Period day';
  }
}

export function buildCalendarScreenModel({
  todayIso,
  monthIso,
  profile,
  logEntries,
  locale,
  showFertilityEstimates = true,
}: BuildCalendarScreenModelOptions): CalendarScreenModel {
  const monthStart = getMonthStart(monthIso);
  const monthEnd = getMonthEnd(monthIso);
  const monthStartOffset = getUtcWeekday(monthStart);
  const monthEndOffset = (6 - getUtcWeekday(monthEnd) + 7) % 7;
  const gridStart = addDays(monthStart, -monthStartOffset);
  const gridEnd = addDays(monthEnd, monthEndOffset);
  const prediction = buildPredictionResult({
    todayIso,
    profile,
    logEntries,
  });
  const todaySnapshot = buildTodaySnapshot({
    todayIso,
    profile,
    logEntries,
    locale,
  });
  const loggedMarkers = buildLoggedMarkers(logEntries);
  // LT-09: once the engine's calendar anchor is stale (same signal LT-04
  // uses to degrade confidence -- `stale-history` on confidence.reasonCodes,
  // meaning the anchor rolled forward >= 2 whole cycles or the user is
  // >30 days past the calendar expectation), both the "current cycle" and
  // "next period" windows are built from a SYNTHETIC rolled anchor, not a
  // real logged/confirmed period. Shading them as `predicted-period` paints
  // concrete past/future days the user never confirmed -- most visibly, a
  // "current expected period" window landing in a past month the user never
  // logged at all (this exact case). Suppress predicted-period shading
  // entirely while stale: the grid falls back to honest emptiness, and the
  // missed-expected-period anomaly (already surfaced on Today) is the
  // correct place to flag the lapse -- not a phantom shaded block on a
  // calendar page the user has no reason to have logged.
  const isPredictionStale = prediction.confidence.reasonCodes.includes('stale-history');
  const predictedDates = isPredictionStale
    ? new Set<string>()
    : new Set([
        // The upcoming projected period...
        ...buildPredictedPeriodDates(
          prediction.nextPeriod.startDate,
          prediction.nextPeriod.lengthDays,
        ),
        // ...and the period window of the cycle the user is currently in, so
        // an active expected period is shaded rather than left blank on the
        // grid.
        ...buildPredictedPeriodDates(
          prediction.current.cycleStartDate,
          prediction.nextPeriod.lengthDays,
        ),
      ]);
  const cycleStartMs = isoDateToUtcMillis(prediction.current.cycleStartDate);
  const cycleLengthMs = prediction.cycleLengthDays * 24 * 60 * 60 * 1000;
  const fertileWindowStart = prediction.fertileWindow.startDate;
  const fertileWindowEnd = prediction.fertileWindow.endDate;
  const cells: CalendarScreenModel['weeks'][number] = [];

  for (
    let cursorIso = gridStart;
    cursorIso <= gridEnd;
    cursorIso = addDays(cursorIso, 1)
  ) {
    const { day } = getDateParts(cursorIso);
    const marker = loggedMarkers.get(cursorIso);
    const cellMs = isoDateToUtcMillis(cursorIso);
    // Cells strictly before the resolved cycle start stay null (unchanged --
    // there is no cycle to count a day within yet). Cells at/after it roll
    // FORWARD by whole cycles until the cell falls within the cycle it
    // actually belongs to, then take the offset from that rolled anchor.
    // Without this roll, a cell many cycles ahead of
    // `prediction.current.cycleStartDate` (a future month, or the tail of the
    // current month once the cycle has run long) reports an ever-growing
    // "cycle day 96" instead of the bounded day-within-cycle every other
    // cycleDay consumer (Today, CalendarDayScreen) already shows — both
    // re-run the engine with `todayIso` pinned to the cell's own date, which
    // has the same forward-rolling effect per-day. This keeps the grid
    // consistent with that convention without re-running the whole engine
    // per cell. Only forward rolls are applied (never backward past the
    // resolved cycle start) so pre-history cells keep their `null`.
    const cycleDay =
      cellMs >= cycleStartMs
        ? (() => {
            const cyclesFromAnchor = Math.floor((cellMs - cycleStartMs) / cycleLengthMs);
            const cellCycleStartMs = cycleStartMs + cyclesFromAnchor * cycleLengthMs;
            return Math.floor((cellMs - cellCycleStartMs) / (24 * 60 * 60 * 1000)) + 1;
          })()
        : null;

    cells.push({
      date: cursorIso,
      dayNumber: String(day),
      inMonth: cursorIso >= monthStart && cursorIso <= monthEnd,
      isToday: cursorIso === todayIso,
      // An explicit log for this date always wins — including an explicit
      // 'none' (the user recorded "no bleeding"), which must SUPPRESS the
      // predicted-period marker rather than be overridden by it. Only fall
      // through to the prediction when there is no logged entry at all.
      marker: loggedMarkers.has(cursorIso)
        ? (marker as CalendarMarker)
        : predictedDates.has(cursorIso)
          ? 'predicted-period'
          : 'none',
      cycleDay,
      // LT-31 (gap between LT-09 and LT-24): the fertile window, like the
      // predicted-period window LT-09 already gates above, is derived from
      // `prediction.fertileWindow` -- built on the same rolled SYNTHETIC
      // anchor once history is stale. Shading a "Fertile window" run (and
      // the inline day card's matching chip, which reads this same
      // `isFertile` flag via `selectedDateTags` in CalendarScreen.tsx) is
      // the identical trust violation LT-09 already fixed for
      // predicted-period shading and LT-24 already fixed for Today's
      // fertile-window headline -- mirrors LT-09's exact gate.
      isFertile:
        showFertilityEstimates &&
        !isPredictionStale &&
        cursorIso >= fertileWindowStart &&
        cursorIso <= fertileWindowEnd,
      // Band segments are a post-pass over the assembled rows (see
      // applyBandSegments below) -- they start null here.
      periodBand: null,
      predictedBand: null,
      fertileBand: null,
    });
  }

  const weeks: CalendarScreenModel['weeks'] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  applyBandSegments(weeks);

  const predictedPeriodStartIso = prediction.nextPeriod.startDate;
  const predictedPeriodEndIso = addDays(
    prediction.nextPeriod.startDate,
    prediction.nextPeriod.lengthDays - 1,
  );
  const currentPeriodStartIso = prediction.current.cycleStartDate;
  const currentPeriodEndIso = addDays(
    prediction.current.cycleStartDate,
    prediction.nextPeriod.lengthDays - 1,
  );

  return {
    monthLabel: formatMonthLabel(monthIso, locale),
    showFertilityEstimates,
    weekdayLabels: formatWeekdayLabels(locale),
    weeks,
    predictionSummary: {
      nextPeriodLabel: formatCalendarPredictionRangeLabel({
        currentPeriodStartIso,
        currentPeriodEndIso,
        nextPeriodStartIso: predictedPeriodStartIso,
        nextPeriodEndIso: predictedPeriodEndIso,
        locale,
        todayIso,
        isPredictionStale,
      }),
      confidenceLevel: todaySnapshot.confidenceLevel,
      confidenceLabel: todaySnapshot.confidenceLabel,
      confidenceBasisLabel: todaySnapshot.confidenceBasisLabel,
      confidenceReasonCodes: todaySnapshot.confidenceReasonCodes,
      limitations: prediction.limitationCodes.map((code) =>
        formatPredictionLimitation(code, locale),
      ),
    },
    historyItems: [...logEntries]
      .sort((left, right) => right.logDate.localeCompare(left.logDate))
      .filter((entry) => entry.bleeding !== 'none')
      .map((entry) => ({
        date: entry.logDate,
        label: formatHistoryItemLabel(entry.bleeding, locale),
        bleeding: entry.bleeding,
      }))
      .slice(0, 6),
    recentCycles: buildRecentCycles(prediction.history.startDates, locale),
    ...(todaySnapshot.improvements ? { improvements: todaySnapshot.improvements } : {}),
  };
}

type CalendarCell = CalendarScreenModel['weeks'][number][number];
type CalendarBandField = 'periodBand' | 'predictedBand' | 'fertileBand';

/**
 * Post-pass that segments each week row's contiguous band runs into
 * start/mid/end ('single' for one-cell runs). Deliberate contract choices,
 * relied on by the grid variant renderers (see
 * components/gridVariants/gridVariantContract.ts):
 *
 * - Segmentation is PER WEEK ROW: a run crossing a Sat/Sun boundary is
 *   clipped -- the trailing cell of one row reads 'end' and the leading cell
 *   of the next reads 'start'. Each row portion is a self-contained capsule,
 *   so a one-cell portion of a longer run reads 'single' (both caps), never
 *   a dangling 'end'/'start'.
 * - Out-of-month cells (inMonth false) terminate runs and never carry bands,
 *   even when they hold a predicted-period marker in the padding area.
 * - periodBand follows marker 'period' (logged bleeding), predictedBand
 *   follows marker 'predicted-period', fertileBand follows isFertile.
 *   Because an explicit log always wins the marker (see the marker
 *   resolution above), a logged day inside a predicted stretch splits the
 *   predicted band in two. Spotting is never banded.
 * - The stale-history gate (LT-09/LT-31) empties predictedDates and zeroes
 *   isFertile BEFORE this pass, so predicted/fertile bands are suppressed
 *   under staleness for free while logged periodBand always survives.
 */
function applyBandSegments(weeks: CalendarScreenModel['weeks']) {
  for (const row of weeks) {
    applyRowBand(row, 'periodBand', (cell) => cell.inMonth && cell.marker === 'period');
    applyRowBand(
      row,
      'predictedBand',
      (cell) => cell.inMonth && cell.marker === 'predicted-period',
    );
    applyRowBand(row, 'fertileBand', (cell) => cell.inMonth && cell.isFertile);
  }
}

function applyRowBand(
  row: CalendarCell[],
  field: CalendarBandField,
  isBanded: (cell: CalendarCell) => boolean,
) {
  let runStart = -1;

  const closeRun = (endExclusive: number) => {
    if (runStart < 0) {
      return;
    }

    if (endExclusive - runStart === 1) {
      row[runStart]![field] = 'single';
    } else {
      row[runStart]![field] = 'start';
      for (let index = runStart + 1; index < endExclusive - 1; index += 1) {
        row[index]![field] = 'mid';
      }
      row[endExclusive - 1]![field] = 'end';
    }

    runStart = -1;
  };

  row.forEach((cell, index) => {
    if (isBanded(cell)) {
      if (runStart < 0) {
        runStart = index;
      }
      return;
    }

    closeRun(index);
  });
  closeRun(row.length);
}

function buildRecentCycles(
  startDates: readonly string[],
  locale: SupportedLocale,
): CalendarScreenModel['recentCycles'] {
  if (startDates.length < 2) return [];
  const sorted = [...startDates].sort();
  const cycles: CalendarScreenModel['recentCycles'] = [];
  for (let index = sorted.length - 1; index >= 1; index -= 1) {
    const start = sorted[index - 1];
    const next = sorted[index];
    if (!start || !next) continue;
    const end = addDays(next, -1);
    const lengthDays = diffDays(start, next);
    if (lengthDays <= 0) continue;
    cycles.push({
      startDate: start,
      endDate: end,
      rangeLabel: `${formatMonthDayLabel(start, locale)} to ${formatMonthDayLabel(end, locale)}`,
      lengthDays,
    });
    if (cycles.length >= 3) break;
  }
  return cycles;
}
