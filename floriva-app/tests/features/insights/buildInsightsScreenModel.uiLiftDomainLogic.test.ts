/**
 * UI-lift Phase 1, domain-logic cluster (2026-07-23).
 *
 * Findings ledger: docs/qa/2026-07-22-ui-lift/phase-1/findings.md
 *   - UL-02 [P0] irregular cycles described as regular ("Consistent on
 *     average" over bars 27,38,26,27,45,26,31,64,21).
 *   - UL-14 [P1] Insights-TTC self-contradiction ("Logged on 0 of 6
 *     fertile-window days" above four log cards from months earlier).
 *   - UL-36 [P2] history-size claims disagree ("last nine cycles" chart cap
 *     vs the engine's own 12-interval statistics window).
 */

import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { MAX_INTERVAL_WINDOW } from '@/src/lib/predictions/cycleStatistics';
import { addDays } from '@/src/lib/predictions/dateMath';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

const BASE_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

/**
 * Builds a bleeding history whose consecutive period starts are separated by
 * exactly `intervals` days (chronological order), with the newest start
 * `daysAgoOfNewestStart` days before `todayIso`. Each period logs 3 bleeding
 * days so collectPeriodStarts sees an unambiguous episode per start.
 */
function buildHistoryFromIntervals(
  todayIso: string,
  intervals: number[],
  daysAgoOfNewestStart = 10,
): DailyLogEntry[] {
  const starts: string[] = [];
  let cursor = addDays(todayIso, -daysAgoOfNewestStart);
  starts.push(cursor);
  for (let i = intervals.length - 1; i >= 0; i -= 1) {
    cursor = addDays(cursor, -intervals[i]!);
    starts.push(cursor);
  }
  starts.reverse();

  return starts.flatMap((startIso, startIndex) =>
    [0, 1, 2].map((offset) => ({
      id: `ul-fixture-${startIndex}-${offset}`,
      logDate: addDays(startIso, offset),
      bleeding: offset === 0 ? ('heavy' as const) : ('medium' as const),
      symptoms: [],
    })),
  );
}

function buildModel(todayIso: string, logEntries: DailyLogEntry[], profile = BASE_PROFILE) {
  return buildInsightsScreenModel({
    todayIso,
    profile,
    logEntries,
    locale: 'en',
  });
}

describe('UL-02 — visibly irregular history is never called consistent/regular', () => {
  const TODAY = '2026-07-22';

  it('the exact ledger scenario (bars 27,38,26,27,45,26,31,64,21) classifies varies-widely, not consistent', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, [27, 38, 26, 27, 45, 26, 31, 64, 21]);

    const model = buildModel(TODAY, logEntries);

    // Before the fix, classification ran on the spread of the MAD-outlier
    // SURVIVORS only: rejecting 38/45/64 as outliers left a tight
    // 21..31-median cluster whose spread rounded to "+/- 1 days", so a user
    // whose recent cycles ranged 21..64 days was told "Consistent on
    // average ... Floriva is treating your cycle as regular" (the P0
    // screenshot). One third of the observed cycles being discarded as
    // outliers IS the irregularity — it must never be classified away.
    expect(model.cycleLengthData.bars.map((bar) => bar.days)).toEqual([
      27, 38, 26, 27, 45, 26, 31, 64, 21,
    ]);
    expect(model.cycleLengthData.consistencyLevel).toBe('varies-widely');
    expect(model.cycleLengthData.subtitleLabel).toBe('Varies widely');
    expect(model.cycleLengthData.footnoteLabel).not.toContain('regular');
    expect(model.cycleLengthData.footnoteLabel).not.toContain('+/-');
  });

  it('the tenure-12mo-irregular fixture on the sweep date (2026-07-22) classifies varies-widely', () => {
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY);

    const model = buildModel(TODAY, dataset.dailyLogs, dataset.profile);

    // Raw observed intervals on this seed are 58,27,38,26,27,45,26,31,64,21
    // — a 21..64-day range. Classification must reflect the observed
    // (bounds-filtered) history, not just the post-rejection survivors.
    expect(model.cycleLengthData.consistencyLevel).toBe('varies-widely');
  });

  it('a genuinely steady 28-day history stays consistent (calm copy protected)', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, Array.from({ length: 11 }, () => 28));

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.consistencyLevel).toBe('consistent');
    expect(model.cycleLengthData.subtitleLabel).toBe('Consistent on average');
  });

  it('a single anomalous 60-day gap in an otherwise steady history stays consistent (one lapse is not irregularity)', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, [28, 28, 28, 28, 60, 28, 28, 28, 28]);

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.consistencyLevel).toBe('consistent');
  });

  it('a consistent classification with a ~0-day spread cites "+/- 1 day" (singular, floored), never "+/- 0 days"', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, Array.from({ length: 11 }, () => 28));

    const model = buildModel(TODAY, logEntries);

    // Live before-state on tenure-12mo-regular read "Within about +/- 0
    // days" — a nonsense claim, and the UL-02 ledger's "+/- 1 days"
    // pluralization sibling.
    expect(model.cycleLengthData.footnoteLabel).toContain('+/- 1 day ');
    expect(model.cycleLengthData.footnoteLabel).not.toContain('0 days');
    expect(model.cycleLengthData.footnoteLabel).not.toContain('1 days');
  });

  it('a moderately variable history is classified somewhat-variable and cites the RAW observed spread', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, [26, 29, 31, 27, 25, 30]);

    const model = buildModel(TODAY, logEntries);

    // Raw MAD-scaled spread of the observed set is ~3 days; nothing is
    // rejected as an outlier, so raw == survivor here and the tier is
    // legitimately "somewhat variable".
    expect(model.cycleLengthData.consistencyLevel).toBe('somewhat-variable');
    expect(model.cycleLengthData.footnoteLabel).toContain('+/- 3 days');
  });

  it('two observed intervals remain classifiable; one is still not-enough-data', () => {
    const twoIntervals = buildModel(TODAY, buildHistoryFromIntervals(TODAY, [28, 28]));
    const oneInterval = buildModel(TODAY, buildHistoryFromIntervals(TODAY, [28]));

    expect(twoIntervals.cycleLengthData.consistencyLevel).toBe('consistent');
    expect(oneInterval.cycleLengthData.consistencyLevel).toBe('not-enough-data');
  });
});

describe('UL-88 — the Observations all-clear line never contradicts a varies-widely verdict', () => {
  const TODAY = '2026-07-22';

  it('a varies-widely history escalates the all-clear tone to varies-widely', () => {
    // The tenure-12mo-irregular Phase-4 capture read "Varies widely" on the
    // cycle-length card while the Observations section (no discrete anomalies
    // that day) still said "Nothing unusual in your recent logged cycles." —
    // a same-screen contradiction. `observationsAllClear` now tracks the
    // verdict so the screen can pick an honest fallback line. (Whether the
    // fallback actually renders depends on there being no discrete anomalies,
    // which is date-dependent and covered end-to-end in the screen test.)
    const logEntries = buildHistoryFromIntervals(TODAY, [27, 38, 26, 27, 45, 26, 31, 64, 21]);

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.consistencyLevel).toBe('varies-widely');
    expect(model.observationsAllClear).toBe('varies-widely');
  });

  it('a genuinely steady history keeps the calm all-clear line', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, Array.from({ length: 11 }, () => 28));

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.consistencyLevel).toBe('consistent');
    expect(model.observationsAllClear).toBe('calm');
  });

  it('a somewhat-variable history keeps the calm all-clear line (only varies-widely escalates)', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, [26, 29, 31, 27, 25, 30]);

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.consistencyLevel).toBe('somewhat-variable');
    expect(model.observationsAllClear).toBe('calm');
  });
});

describe('UL-14 — the TTC fertile-window claim matches the log cards shown beneath it', () => {
  const TODAY = '2026-07-22';
  const TTC_PROFILE: UserProfile = {
    ...BASE_PROFILE,
    goals: ['period', 'symptoms', 'trying-to-conceive'],
    ttcTrackingPreferences: {
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    },
  };

  it('months-old TTC observations are NOT shown as highlights of the current fertile window (the qa-rich-history contradiction)', () => {
    // qa-rich-history shape: dense TTC logging in April, nothing since,
    // viewed in late July. The current predicted fertile window is a
    // projected July window containing no logs at all.
    const logEntries: DailyLogEntry[] = [
      ...buildHistoryFromIntervals(TODAY, [28, 34, 21], 21),
      {
        id: 'ttc-april-1',
        logDate: '2026-04-12',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { cervicalMucus: 'egg-white', basalBodyTemperatureCelsius: 36.48 },
      },
      {
        id: 'ttc-april-2',
        logDate: '2026-04-13',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { ovulationTest: 'positive', sexLogged: true },
      },
    ];

    const model = buildModel(TODAY, logEntries, TTC_PROFILE);
    const prediction = buildPredictionResult({
      todayIso: TODAY,
      profile: TTC_PROFILE,
      logEntries,
    });

    expect(model.ttcSummary).toBeDefined();
    // The April observations are outside the current window the description
    // counts, so they must not render as cards directly under the "Logged
    // on 0 of N fertile-window days" claim.
    expect(model.ttcSummary!.currentWindowLoggedDays).toBe(0);
    expect(model.ttcSummary!.latestHighlights).toEqual([]);
    // They remain visible, dated, in the recent-logs section.
    expect(model.ttcSummary!.recentLogSummaries.map((entry) => entry.date)).toContain(
      '2026-04-13',
    );
    // Invariant: every highlight (none here) sits inside the counted window.
    for (const highlight of model.ttcSummary!.latestHighlights) {
      expect(highlight.date >= prediction.fertileWindow.startDate).toBe(true);
      expect(highlight.date <= prediction.fertileWindow.endDate).toBe(true);
    }
  });

  it('observations logged inside the current fertile window ARE highlighted, and the logged-day count matches them', () => {
    const baseEntries = buildHistoryFromIntervals(TODAY, [28, 28, 28], 12);
    const window = buildPredictionResult({
      todayIso: TODAY,
      profile: TTC_PROFILE,
      logEntries: baseEntries,
    }).fertileWindow;
    const inWindowDates = [window.startDate, addDays(window.startDate, 1)];
    const logEntries: DailyLogEntry[] = [
      ...baseEntries,
      ...inWindowDates.map((logDate, index) => ({
        id: `ttc-in-window-${index}`,
        logDate,
        bleeding: 'none' as const,
        symptoms: [],
        ttcObservation: index === 0 ? { sexLogged: true } : { ovulationTest: 'positive' as const },
      })),
      {
        id: 'ttc-out-of-window',
        logDate: addDays(window.startDate, -10),
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { cervicalMucus: 'creamy' },
      },
    ];

    const model = buildModel(TODAY, logEntries, TTC_PROFILE);
    // Recompute the window over the FULL entry set: adding an in-window OPK
    // positive can legitimately re-anchor the engine to a signal-confirmed
    // window, and the containment invariant must hold against whatever
    // window the model actually used.
    const liveWindow = buildPredictionResult({
      todayIso: TODAY,
      profile: TTC_PROFILE,
      logEntries,
    }).fertileWindow;

    expect(model.ttcSummary!.currentWindowLoggedDays).toBe(2);
    const highlightDates = model.ttcSummary!.latestHighlights.map((highlight) => highlight.date);
    expect(highlightDates.length).toBeGreaterThan(0);
    for (const date of highlightDates) {
      expect(date >= liveWindow.startDate).toBe(true);
      expect(date <= liveWindow.endDate).toBe(true);
    }
    // The out-of-window observation never leaks into the window card.
    expect(highlightDates).not.toContain(addDays(window.startDate, -10));
  });
});

describe('UL-36 — the chart window matches the engine statistics window (12 intervals, not an arbitrary 9)', () => {
  const TODAY = '2026-07-22';

  it('a 13-interval year shows the last 12 bars — the same window computeCycleStatistics classifies', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, Array.from({ length: 13 }, () => 28));

    const model = buildModel(TODAY, logEntries);

    // Before the fix the chart sliced the last NINE intervals while the
    // subtitle/footnote classification and avgDays were computed over the
    // engine's 12-interval window — a third, arbitrary history-size claim
    // ("What your last nine cycles say") alongside "13 cycles logged".
    expect(model.cycleLengthData.bars).toHaveLength(MAX_INTERVAL_WINDOW);
    expect(model.cycleLengthData.bars).toHaveLength(12);
    expect(model.cycleLengthData.bars.at(-1)!.isLatest).toBe(true);
  });

  it('shows the LAST 12 intervals when more are observed', () => {
    const intervals = [40, ...Array.from({ length: 12 }, () => 28)];
    const logEntries = buildHistoryFromIntervals(TODAY, intervals);

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.bars.map((bar) => bar.days)).toEqual(intervals.slice(-12));
  });

  it('fewer than 12 observed intervals all remain visible', () => {
    const logEntries = buildHistoryFromIntervals(TODAY, [28, 34, 21]);

    const model = buildModel(TODAY, logEntries);

    expect(model.cycleLengthData.bars.map((bar) => bar.days)).toEqual([28, 34, 21]);
  });
});
