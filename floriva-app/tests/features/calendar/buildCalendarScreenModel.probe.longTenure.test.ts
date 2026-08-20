/**
 * Long-tenure probes for the calendar screen model (workstream E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment; resolution probes pin behavior 1.2.0 already fixed. Deterministic
 * via buildTenureDataset(variant, FIXED todayIso).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { buildCalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { formatPredictionRangeLabel } from '@/src/lib/predictions/presentation';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';

const TODAY = '2026-07-06';

function buildModelFor(
  variant: Parameters<typeof buildTenureDataset>[0],
  monthIso: string,
) {
  const dataset = buildTenureDataset(variant, TODAY);
  return {
    dataset,
    model: buildCalendarScreenModel({
      todayIso: TODAY,
      monthIso,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    }),
  };
}

describe('FIXED LT-01 — grid cycleDay rolls forward per-cell instead of growing unbounded', () => {
  it('the last day of the CURRENT month rolls into the following cycle instead of reading "Cycle day 32" of a 28-day cycle', () => {
    // tenure-12mo-regular: current cycle started 2026-06-30, cycle length 28.
    const { model } = buildModelFor('tenure-12mo-regular', '2026-07-01');
    const july31 = model.weeks.flat().find((cell) => cell.date === '2026-07-31');

    // FIXED: the grid now rolls the cycle anchor forward by whole cycles
    // per-cell (matching the engine's own anchor-roll convention used by
    // Today/CalendarDayScreen), so 2026-07-31 -- 32 days after 2026-06-30,
    // i.e. day 4 of the NEXT 28-day cycle -- reads as a bounded in-cycle day.
    expect(july31?.cycleDay).toBe(4);
    expect(july31?.cycleDay).toBeGreaterThanOrEqual(1);
    expect(july31?.cycleDay).toBeLessThanOrEqual(28);
  });

  it('a future month no longer grows the label without bound', () => {
    const { model } = buildModelFor('tenure-12mo-regular', '2026-09-01');
    const cells = model.weeks.flat();
    const lastCell = cells[cells.length - 1]!;

    // FIXED: previously "Cycle day 96" (96 days after the anchor, no roll).
    // Every cell now reports a cycleDay bounded to the 28-day cycle it
    // actually falls within.
    expect(lastCell.date).toBe('2026-10-03');
    expect(lastCell.cycleDay).toBeGreaterThanOrEqual(1);
    expect(lastCell.cycleDay).toBeLessThanOrEqual(28);
  });

  it('every in-grid cell at/after the cycle start reports a cycleDay bounded to the cycle length', () => {
    const { model } = buildModelFor('tenure-12mo-regular', '2026-09-01');
    const cellsWithCycleDay = model.weeks.flat().filter((cell) => cell.cycleDay !== null);

    expect(cellsWithCycleDay.length).toBeGreaterThan(0);
    for (const cell of cellsWithCycleDay) {
      expect(cell.cycleDay).toBeGreaterThanOrEqual(1);
      expect(cell.cycleDay).toBeLessThanOrEqual(28);
    }
  });
});

describe('FIXED LT-09 — lapsed user no longer gets a phantom predicted period shaded in a month they never logged', () => {
  it('suppresses ALL predicted-period shading once the prediction is stale, instead of painting Jun 24–28 in a month with zero logs', () => {
    const { dataset, model } = buildModelFor('tenure-lapsed', '2026-06-01');

    // Fixture guarantee: the user's last log of any kind is ~70 days before
    // today (2026-05-01 window); June contains no logged entries at all.
    expect(dataset.dailyLogs.at(-1)?.logDate).toBe('2026-05-01');

    const juneCells = model.weeks.flat().filter((cell) => cell.inMonth);
    const shaded = juneCells
      .filter((cell) => cell.marker === 'predicted-period')
      .map((cell) => cell.date);

    // FIXED: buildCalendarScreenModel now checks the same staleness signal
    // LT-04 uses (`confidence.reasonCodes` containing `stale-history`).
    // Once stale, predicted-period shading is suppressed entirely (both the
    // "current cycle" and "next period" windows, since both derive from the
    // same synthetic rolled anchor) -- the grid shows honest emptiness for
    // a month the user never logged, and the missed-expected-period anomaly
    // (already surfaced on Today) is where the lapse gets flagged instead
    // of a phantom shaded block here.
    expect(shaded).toEqual([]);
  });
});

describe('FIXED LT-08 — Dec→Jan prediction range label now includes the year on both sides', () => {
  it('renders "Dec 30, 2026 to Jan 3, 2027" instead of the year-ambiguous "Dec 30 to Jan 3"', () => {
    // FIXED: formatPredictionRangeLabel now renders the year on BOTH sides
    // whenever start/end years differ, so a next-period window spanning New
    // Year is no longer ambiguous in January history views.
    expect(formatPredictionRangeLabel('2026-12-30', '2027-01-03', 'en')).toBe(
      'Dec 30, 2026 to Jan 3, 2027',
    );
  });

  it('same-year ranges are unaffected (no year rendered)', () => {
    expect(formatPredictionRangeLabel('2026-04-28', '2026-05-02', 'en')).toBe(
      'Apr 28 to May 2',
    );
  });
});

describe('DOCUMENTED — history list is capped at the 6 most recent bleeding days', () => {
  it('a 13-cycle year (~65 bleeding days) surfaces exactly 6 history items and 3 recent cycles', () => {
    const { dataset, model } = buildModelFor('tenure-12mo-regular', '2026-07-01');

    const bleedingDayCount = dataset.dailyLogs.filter(
      (entry) => entry.bleeding !== 'none',
    ).length;
    expect(bleedingDayCount).toBeGreaterThan(50);

    // Current behavior (by design per the "recent history" card): the model
    // slices to the 6 newest bleeding-day items and the 3 newest completed
    // cycles. Pinned here so a long-tenure user's full year of data cannot
    // silently balloon this card, and as a reference point should the
    // product later want a "view all" affordance backed by
    // CalendarHistoryScreen.
    expect(model.historyItems).toHaveLength(6);
    expect(model.recentCycles).toHaveLength(3);
  });
});

describe('RESOLVED — stale anchors no longer distort the current-cycle readout on day-level surfaces', () => {
  it('the engine consumed by day surfaces reports a rolled, in-cycle cycleDay for the lapsed dataset', () => {
    const dataset = buildTenureDataset('tenure-lapsed', TODAY);
    const prediction = buildPredictionResult({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
    });

    // Original suspect: "cycle day 45 of a 29-day cycle" on Today. The
    // engine anchor roll (raw/rolled split) fixed the engine-side readout —
    // TodayScreen and CalendarDayScreen render this bounded value.
    expect(prediction.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(prediction.current.cycleDay).toBeLessThanOrEqual(prediction.cycleLengthDays);
  });
});

describe('RESOLVED LT-19 — browsing a past month no longer mixes epochs in the prediction banner', () => {
  it('a REGULAR (non-stale) user browsing -6mo sees the SAME today-anchored banner numbers as the current month, with no false staleness nudge', () => {
    // Re-reproduction per the LT-19 triage note: after LT-23 unified the
    // count-window basis across Today/Calendar/Settings and LT-04 scoped
    // staleness to a single todayIso-anchored signal, browsing a past month
    // (e.g. January 2026, viewed from "today" 2026-07-06) must show EXACTLY
    // the same confidenceBasisLabel/nextPeriodLabel as browsing the current
    // month -- both are built from buildPredictionResult({ todayIso, ... }),
    // which never reads monthIso. There is no month-scoped statistics path
    // left to diverge.
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);
    const currentMonthModel = buildModelFor('tenure-12mo-regular', '2026-07-01').model;
    const pastMonthModel = buildModelFor('tenure-12mo-regular', '2026-01-01').model;

    expect(pastMonthModel.predictionSummary.nextPeriodLabel).toBe(
      currentMonthModel.predictionSummary.nextPeriodLabel,
    );
    expect(pastMonthModel.predictionSummary.confidenceBasisLabel).toBe(
      currentMonthModel.predictionSummary.confidenceBasisLabel,
    );
    expect(pastMonthModel.predictionSummary.confidenceReasonCodes).toEqual(
      currentMonthModel.predictionSummary.confidenceReasonCodes,
    );

    // No false staleness nudge: this fixture's most recent log is within a
    // day of "today" (a "logged 8 days ago"-shaped regular user), so
    // `stale-history` must never appear regardless of which month is on
    // screen.
    const mostRecentLogDate = dataset.dailyLogs.at(-1)?.logDate ?? '';
    expect(mostRecentLogDate >= '2026-06-20').toBe(true);
    expect(pastMonthModel.predictionSummary.confidenceReasonCodes).not.toContain(
      'stale-history',
    );
  });

  it('an IRREGULAR user browsing a past month also stays today-anchored and free of a false staleness nudge', () => {
    const currentMonthModel = buildModelFor('tenure-12mo-irregular', '2026-07-01').model;
    const pastMonthModel = buildModelFor('tenure-12mo-irregular', '2026-01-01').model;

    expect(pastMonthModel.predictionSummary.nextPeriodLabel).toBe(
      currentMonthModel.predictionSummary.nextPeriodLabel,
    );
    expect(pastMonthModel.predictionSummary.confidenceBasisLabel).toBe(
      currentMonthModel.predictionSummary.confidenceBasisLabel,
    );
    expect(pastMonthModel.predictionSummary.confidenceReasonCodes).not.toContain(
      'stale-history',
    );
  });
});

describe('FIXED LT-27 — stale calendar banner no longer announces dates the grid refuses to draw', () => {
  it('once the prediction is stale, the banner switches to the log-to-refresh framing instead of "Next period expected ..." dates', () => {
    const { model } = buildModelFor('tenure-lapsed', '2026-06-01');

    // Precondition: this is the same stale fixture LT-09 suppresses grid
    // shading for.
    expect(model.predictionSummary.confidenceReasonCodes).toContain('stale-history');

    // FIXED: previously the banner still read "Next period expected Jul 24
    // to 28" (or an equivalent concrete-date framing) even though LT-09
    // suppresses every predicted-period shaded cell for the same stale
    // signal -- a banner announcing dates the grid refuses to draw. Now
    // both reconcile on the same honest, action-oriented message.
    expect(model.predictionSummary.nextPeriodLabel).toBe(
      'Log your latest period to update this estimate',
    );
    expect(model.predictionSummary.nextPeriodLabel).not.toMatch(/\d/);
  });

  it('a non-stale user keeps the concrete-date banner unchanged', () => {
    const { model } = buildModelFor('tenure-12mo-regular', '2026-07-01');

    expect(model.predictionSummary.confidenceReasonCodes).not.toContain('stale-history');
    expect(model.predictionSummary.nextPeriodLabel).toMatch(/\d/);
  });
});

describe('FIXED LT-31 — stale calendar grid no longer shades a phantom fertile window', () => {
  it('suppresses isFertile on every cell once the prediction is stale, instead of shading a green Jul 5-10 run built on the rolled synthetic anchor', () => {
    const { model } = buildModelFor('tenure-lapsed', '2026-07-01');

    // Precondition: same stale fixture LT-09/LT-27 already gate on.
    expect(model.predictionSummary.confidenceReasonCodes).toContain('stale-history');

    // BUG (pre-fix): `isFertile` was gated only on `showFertilityEstimates`,
    // so the grid still shaded a fertile run sourced from
    // `prediction.fertileWindow` -- the same rolled synthetic anchor whose
    // predicted-period shading LT-09 already suppresses and whose fertile
    // claim LT-24 already hedges on Today. FIXED: `isFertile` now also
    // requires `!isPredictionStale`, mirroring LT-09's exact gate in this
    // same file.
    const fertileCells = model.weeks.flat().filter((cell) => cell.isFertile);
    expect(fertileCells).toEqual([]);
  });

  it('a non-stale user keeps ordinary fertile-window shading unchanged', () => {
    const { model } = buildModelFor('tenure-12mo-regular', '2026-07-01');

    expect(model.predictionSummary.confidenceReasonCodes).not.toContain('stale-history');
    const fertileCells = model.weeks.flat().filter((cell) => cell.isFertile);
    expect(fertileCells.length).toBeGreaterThan(0);
  });

  it('a stale user with showFertilityEstimates explicitly on still gets no fertile shading', () => {
    const dataset = buildTenureDataset('tenure-lapsed', TODAY);
    const model = buildCalendarScreenModel({
      todayIso: TODAY,
      monthIso: '2026-07-01',
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
      showFertilityEstimates: true,
    });

    expect(model.predictionSummary.confidenceReasonCodes).toContain('stale-history');
    expect(model.weeks.flat().filter((cell) => cell.isFertile)).toEqual([]);
  });
});
