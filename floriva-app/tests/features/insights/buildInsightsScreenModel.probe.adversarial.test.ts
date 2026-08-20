/**
 * Adversarial probe tests for buildInsightsScreenModel and its helpers.
 *
 * Each scenario is constructed to force a specific failure mode.
 * "SUSPECTED BUG" comments flag scenarios where the expected behaviour is
 * known-correct and a real implementation defect would cause the assertion to
 * fail.
 */

import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import { formatFertileWindowLabel } from '@/src/lib/predictions/presentation';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
  ttcTrackingPreferences: {
    sex: false,
    ovulationTest: false,
    cervicalMucus: false,
    basalBodyTemperature: false,
  },
};

function bleeding(
  id: string,
  logDate: string,
  level: 'light' | 'medium' | 'heavy' = 'medium',
): DailyLogEntry {
  return { id, logDate, bleeding: level, symptoms: [] };
}

function spotting(id: string, logDate: string): DailyLogEntry {
  return { id, logDate, bleeding: 'spotting', symptoms: [] };
}

function noBleeding(id: string, logDate: string): DailyLogEntry {
  return { id, logDate, bleeding: 'none', symptoms: [] };
}

// ---------------------------------------------------------------------------
// 1. countPeriodStarts — period-start counting edge cases
// ---------------------------------------------------------------------------

describe('countPeriodStarts: gap-boundary edge cases', () => {
  /**
   * Gap == 1 day means consecutive — same period, NOT a new start.
   * The rule: diffDays(previousBleedingDay, current) > 1 → new start.
   * Gap == 1 should be SAME start.
   */
  it('bleeding days separated by exactly 1 day are ONE period start', () => {
    // Apr 1 → Apr 2: gap = 1 → same period
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('d1', '2026-04-01'),
        bleeding('d2', '2026-04-02'),
      ],
    });

    // Only 1 start, so no observed interval → hasObservedHistory false
    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.cyclePattern.periodStartsLabel).toBe('1 logged period start');
  });

  it('bleeding days separated by 2 days are still ONE period start (LT-13: 15-day minimum separation)', () => {
    // Apr 1, then Apr 3: a 2-day gap breaks CONTIGUITY, but insights now
    // counts period starts via the engine's canonical collectPeriodStarts
    // (LT-13), which additionally requires >= MIN_CYCLE_SEPARATION_DAYS (15)
    // between starts -- a 2-day-later bleed is intermenstrual bleeding
    // within the same cycle, not a new period. (Previously insights' own
    // gap>1-day heuristic had no separation guard and counted this as 2
    // starts / a 2-day "cycle", which is exactly the LT-13 disagreement
    // with the engine's own count on the same data.)
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('d1', '2026-04-01'),
        bleeding('d3', '2026-04-03'),
      ],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.cyclePattern.periodStartsLabel).toBe('1 logged period start');
  });

  /**
   * SUSPECTED BUG: spotting should NOT count as a period start in countPeriodStarts.
   * The filter only allows light/medium/heavy. Confirm spotting is excluded.
   */
  it('spotting-only days do not count as a period start', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [spotting('s1', '2026-04-01')],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.cyclePattern.periodStartsLabel).toBe('0 logged period starts');
  });

  /**
   * Spotting sandwiched between two real bleeding days.
   * The spotting day must NOT break the consecutive-days chain.
   *
   * SUSPECTED BUG: If spotting were counted as bleeding, the gap logic
   * would treat it as bridging Apr 2 and Apr 4, making Apr 4 part of the
   * same period — but spotting is excluded, so Apr 2 and Apr 4 must be
   * evaluated directly (gap = 2 > 1 → new start).
   */
  it('spotting between two bleeding days does not bridge the CONTIGUITY gap, but 3 days is still ONE period start (LT-13: 15-day minimum separation)', () => {
    // Apr 1 (medium) → Apr 2 (spotting) → Apr 4 (medium). Spotting is
    // correctly ignored for contiguity, so Apr 1/Apr 4 are evaluated
    // directly -- but a 3-day gap is still far under the engine's
    // MIN_CYCLE_SEPARATION_DAYS (15) that collectPeriodStarts now applies
    // here (LT-13), so Apr 4 is intermenstrual bleeding within the Apr 1
    // cycle, not a new start.
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('d1', '2026-04-01'),
        spotting('s1', '2026-04-02'),
        bleeding('d4', '2026-04-04'),
      ],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.cyclePattern.periodStartsLabel).toBe('1 logged period start');
  });

  /**
   * Duplicate date entries: two entries with the same logDate.
   * Both entries are bleeding. After sort, consecutive duplicates have gap = 0
   * which is NOT > 1 → second duplicate should NOT create a new start.
   */
  it('duplicate bleeding entries for the same date count as ONE start', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('d1a', '2026-04-01'),
        bleeding('d1b', '2026-04-01'), // duplicate date
        bleeding('d29', '2026-04-29'),
      ],
    });

    // Apr 1 (twice) + Apr 29 → 2 starts; 1 interval of 28 days
    expect(model.cycleLengthData.bars).toHaveLength(1);
    expect(model.cycleLengthData.bars[0]!.days).toBe(28);
  });

  /**
   * Period spanning a month boundary (Dec 29 → Jan 2).
   * All 5 days are within 1 day of their predecessor → one start only.
   */
  it('a period that spans a year boundary counts as one start', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('dec29', '2025-12-29'),
        bleeding('dec30', '2025-12-30'),
        bleeding('dec31', '2025-12-31'),
        bleeding('jan01', '2026-01-01'),
        bleeding('jan02', '2026-01-02'),
        // New start later in January
        bleeding('jan28', '2026-01-28'),
      ],
    });

    // 2 starts: Dec 29 and Jan 28 → 1 interval = 30 days
    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
    expect(model.cycleLengthData.bars).toHaveLength(1);
    expect(model.cycleLengthData.bars[0]!.days).toBe(30);
  });

  /**
   * Out-of-order entries: countPeriodStarts sorts, buildCycleLengthData must not
   * re-sort differently. Cross-check the full chain.
   */
  it('out-of-order 3-day period gives same result as sorted order', () => {
    // Sorted: Mar 10 (start), Mar 11, Mar 12, Apr 09 (start)
    // Interval = 30 days
    const logsSorted = [
      bleeding('a', '2026-03-10'),
      bleeding('b', '2026-03-11'),
      bleeding('c', '2026-03-12'),
      bleeding('d', '2026-04-09'),
    ];
    const logsReversed = [
      bleeding('d', '2026-04-09'),
      bleeding('c', '2026-03-12'),
      bleeding('b', '2026-03-11'),
      bleeding('a', '2026-03-10'),
    ];

    const mSorted = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: logsSorted,
    });
    const mReversed = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: logsReversed,
    });

    expect(mReversed.cycleLengthData.bars).toHaveLength(mSorted.cycleLengthData.bars.length);
    expect(mReversed.cycleLengthData.avgDays).toBe(mSorted.cycleLengthData.avgDays);
  });
});

// ---------------------------------------------------------------------------
// 2. Statistics — averages, window cap at 9 intervals
// ---------------------------------------------------------------------------

describe('statistics: average and window correctness', () => {
  it('two identical 28-day cycles → avgDays = 28, no rounding error', () => {
    // Starts: Jan 1, Jan 29, Feb 26 → intervals [28, 28]
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('c1', '2026-01-01'),
        bleeding('c2', '2026-01-29'),
        bleeding('c3', '2026-02-26'),
      ],
    });

    expect(model.cycleLengthData.avgDays).toBe(28);
    expect(Number.isInteger(model.cycleLengthData.avgDays)).toBe(true);
  });

  /**
   * UL-36: the chart window is the engine's own MAX_INTERVAL_WINDOW (12
   * intervals, cycleStatistics.ts), no longer an arbitrary last-9 slice.
   * With exactly 10 intervals (11 starts) all 10 fit inside the window.
   *
   * Starts every 30 days for 11 entries:
   *   Jan 01 → Jan 31 → Mar 02 → Apr 01 → May 01 → May 31 → Jun 30 → Jul 30 → Aug 29 → Sep 28 → Oct 28
   * All intervals = 30 days.  avg = 30.  Simple verification of the window.
   */
  it('exactly 10 cycles: all 10 intervals fit the 12-interval chart window and feed avgDays', () => {
    // Build 11 starts spaced 30 days apart starting 2025-01-01
    const starts: string[] = [];
    let d = '2025-01-01';

    for (let i = 0; i < 11; i++) {
      starts.push(d);
      d = new Date(new Date(d + 'T12:00:00Z').getTime() + 30 * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
    }

    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: starts.map((s, i) => bleeding(`c${i}`, s)),
    });

    expect(model.cycleLengthData.bars).toHaveLength(10);
    expect(model.cycleLengthData.avgDays).toBe(30);
  });

  /**
   * With 10 intervals of different sizes, confirm an old outlier does not
   * pollute the average. First interval = 100 days (an out-of-bounds
   * artifact the statistics module discards). Remaining 9 = 28 days each.
   * Expected avgDays = 28. The 100-day bar remains VISIBLE (UL-36 window is
   * 12 intervals; honest raw bars), but the summary number excludes it.
   */
  it('old outlier interval does not pollute avgDays', () => {
    // Starts: 2024-01-01, 2024-04-10 (100 days later), then 9 more × 28 days
    const firstTwo = ['2024-01-01', '2024-04-10'];
    const rest: string[] = [];
    let cur = '2024-04-10';

    for (let i = 0; i < 9; i++) {
      cur = new Date(new Date(cur + 'T12:00:00Z').getTime() + 28 * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
      rest.push(cur);
    }

    const allStarts = [...firstTwo, ...rest]; // 11 starts → 10 intervals

    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: allStarts.map((s, i) => bleeding(`c${i}`, s)),
    });

    // 10 total intervals, all within the 12-interval chart window
    expect(model.cycleLengthData.bars).toHaveLength(10);
    // avg should be 28, NOT influenced by the 100-day first interval
    expect(model.cycleLengthData.avgDays).toBe(28);
  });

  it('avgDays rounds 0.5 consistently (no fractional days exposed)', () => {
    // Two intervals: 27 and 28 → avg = 27.5 → Math.round → 28
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('c1', '2026-01-01'),
        bleeding('c2', '2026-01-28'), // 27 days
        bleeding('c3', '2026-02-25'), // 28 days
      ],
    });

    expect(Number.isInteger(model.cycleLengthData.avgDays)).toBe(true);
    // 27.5 rounds to 28 with Math.round
    expect(model.cycleLengthData.avgDays).toBe(28);
  });

  it('isLatest flag is on the last bar and only the last bar', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('c1', '2026-01-01'),
        bleeding('c2', '2026-01-29'),
        bleeding('c3', '2026-02-26'),
        bleeding('c4', '2026-03-26'),
      ],
    });

    const bars = model.cycleLengthData.bars;

    expect(bars.length).toBeGreaterThan(1);
    // only last bar should be isLatest
    bars.slice(0, -1).forEach((b) => expect(b.isLatest).toBe(false));
    expect(bars[bars.length - 1]!.isLatest).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. BBT / TTC highlights — NaN, missing, implausible temps
// ---------------------------------------------------------------------------

describe('TTC highlights: BBT edge cases', () => {
  const ttcProfile: UserProfile = {
    ...BASE_PROFILE,
    goals: ['trying-to-conceive'],
    ttcTrackingPreferences: {
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    },
  };

  it('NaN BBT value is NOT emitted as a highlight', () => {
    const entry: DailyLogEntry = {
      id: 'bbt-nan',
      logDate: '2026-04-10',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        basalBodyTemperatureCelsius: NaN,
      },
    };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: ttcProfile,
      logEntries: [entry],
    });

    /**
     * SUSPECTED BUG: The guard is `typeof value === 'number'`.
     * NaN satisfies `typeof NaN === 'number'` → it PASSES the check and
     * `.toFixed(2)` produces "NaN", yielding label "BBT NaN C".
     * Expected: NaN should be excluded from highlights.
     */
    const bbtHighlights = model.ttcSummary?.latestHighlights.filter(
      (h) => h.kind === 'basalBodyTemperature',
    );

    expect(bbtHighlights).toBeDefined();
    // A NaN reading is not a valid temperature — it must not appear
    bbtHighlights?.forEach((h) => {
      expect(h.label).not.toContain('NaN');
    });
  });

  it('implausibly low BBT (0°C) is still emitted but formatted as 0.00', () => {
    // 0 is a valid number — the label should reflect it without crashing
    const entry: DailyLogEntry = {
      id: 'bbt-zero',
      logDate: '2026-04-10',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        basalBodyTemperatureCelsius: 0,
      },
    };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: ttcProfile,
      logEntries: [entry],
    });

    /**
     * SUSPECTED BUG: typeof 0 === 'number' ✓ BUT the condition is
     * `typeof entry.ttcObservation?.basalBodyTemperatureCelsius === 'number'`.
     * Zero is falsy, but TypeScript's typeof check correctly treats it as a
     * number.  This should work — but confirm the label is produced.
     * A different failure mode: if the condition used a truthy check
     * (`if (entry.ttcObservation?.basalBodyTemperatureCelsius)`) then 0
     * would be silently dropped.
     */
    const bbtHighlights = model.ttcSummary?.latestHighlights.filter(
      (h) => h.kind === 'basalBodyTemperature',
    );

    expect(bbtHighlights).toHaveLength(1);
    expect(bbtHighlights![0]!.label).toBe('BBT 0.00 C');
  });

  it('single valid BBT reading produces exactly one highlight', () => {
    const entry: DailyLogEntry = {
      id: 'bbt-single',
      logDate: '2026-04-10',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        basalBodyTemperatureCelsius: 36.7,
      },
    };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: ttcProfile,
      logEntries: [entry],
    });

    const bbtHighlights = model.ttcSummary?.latestHighlights.filter(
      (h) => h.kind === 'basalBodyTemperature',
    );

    expect(bbtHighlights).toHaveLength(1);
    expect(bbtHighlights![0]!.label).toBe('BBT 36.70 C');
  });

  it('all-identical BBT readings do not crash and all appear in highlights (up to cap of 4)', () => {
    const entries: DailyLogEntry[] = Array.from({ length: 6 }, (_, i) => ({
      id: `bbt-${i}`,
      logDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      bleeding: 'none',
      symptoms: [],
      ttcObservation: { basalBodyTemperatureCelsius: 36.5 },
    }));

    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: ttcProfile,
        logEntries: entries,
      }),
    ).not.toThrow();

    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: ttcProfile,
      logEntries: entries,
    });

    // latestHighlights is capped at 4
    expect(model.ttcSummary!.latestHighlights.length).toBeLessThanOrEqual(4);
    model.ttcSummary!.latestHighlights.forEach((h) => {
      expect(h.label).toBe('BBT 36.50 C');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. fertileWindowLabel grammar and boundary conditions
// ---------------------------------------------------------------------------

describe('formatFertileWindowLabel: grammar and boundary conditions', () => {
  /**
   * todayIso === startIso: today IS the first day of the fertile window → "active today"
   */
  it('today == window start → active label (not "opens in 0 days")', () => {
    const label = formatFertileWindowLabel('2026-04-10', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window active today');
  });

  /**
   * todayIso === endIso: today IS the last day → still active
   */
  it('today == window end → active label', () => {
    const label = formatFertileWindowLabel('2026-04-15', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window active today');
  });

  /**
   * todayIso == startIso - 1 (one day before start): "opens in 1 day" (singular)
   */
  it('today is 1 day before window start → "opens in 1 day" (singular)', () => {
    const label = formatFertileWindowLabel('2026-04-09', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window opens in 1 day');
  });

  /**
   * todayIso == startIso - 2: "opens in 2 days" (plural)
   */
  it('today is 2 days before window start → "opens in 2 days" (plural)', () => {
    const label = formatFertileWindowLabel('2026-04-08', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window opens in 2 days');
  });

  /**
   * todayIso == endIso + 1: "ended 1 day ago" (singular)
   */
  it('today is 1 day after window end → "ended 1 day ago" (singular)', () => {
    const label = formatFertileWindowLabel('2026-04-16', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window ended 1 day ago');
  });

  /**
   * todayIso == endIso + 2: "ended 2 days ago" (plural)
   */
  it('today is 2 days after window end → "ended 2 days ago" (plural)', () => {
    const label = formatFertileWindowLabel('2026-04-17', '2026-04-10', '2026-04-15', 'en');

    expect(label).toBe('Fertile window ended 2 days ago');
  });

  /**
   * Spanish singular check: "1 día" not "1 días"
   */
  it('Spanish: 1 day before → singular "día"', () => {
    const label = formatFertileWindowLabel('2026-04-09', '2026-04-10', '2026-04-15', 'es');

    expect(label).toContain('1 día');
    expect(label).not.toContain('1 días');
  });

  /**
   * Spanish: 2+ days → plural "días"
   */
  it('Spanish: 2 days before → plural "días"', () => {
    const label = formatFertileWindowLabel('2026-04-08', '2026-04-10', '2026-04-15', 'es');

    expect(label).toContain('2 días');
  });

  /**
   * SUSPECTED BUG (Portuguese): The `pt` locale uses "dia" (singular) and
   * "dias" (plural). When the count is 1, the template uses
   * `${openCount} dia${openCount === 1 ? '' : 's'}`.
   * Let's verify it actually produces "1 dia" not "1 dias".
   */
  it('Portuguese: 1 day before → singular "dia"', () => {
    const label = formatFertileWindowLabel('2026-04-09', '2026-04-10', '2026-04-15', 'pt');

    expect(label).toContain('1 dia');
    expect(label).not.toContain('1 dias');
  });

  /**
   * Russian: count 1 → "1 день", count 2-4 → "2 дня", count 5+ → "5 дней"
   */
  it('Russian: 1 day → "1 день"', () => {
    const label = formatFertileWindowLabel('2026-04-09', '2026-04-10', '2026-04-15', 'ru');

    expect(label).toContain('1 день');
  });

  it('Russian: 2 days → "2 дня"', () => {
    const label = formatFertileWindowLabel('2026-04-08', '2026-04-10', '2026-04-15', 'ru');

    expect(label).toContain('2 дня');
  });

  it('Russian: 5 days → "5 дней"', () => {
    const label = formatFertileWindowLabel('2026-04-05', '2026-04-10', '2026-04-15', 'ru');

    expect(label).toContain('5 дней');
  });

  /**
   * SUSPECTED BUG: Russian closed case uses diffDays(endIso, todayIso).
   * "ended N days ago" → closedCount.
   * 1 day ago → "1 день назад"; 5 days ago → "5 дней назад".
   */
  it('Russian: ended 1 day ago → "1 день назад"', () => {
    const label = formatFertileWindowLabel('2026-04-16', '2026-04-10', '2026-04-15', 'ru');

    expect(label).toContain('1 день');
    expect(label).toContain('назад');
  });
});

// ---------------------------------------------------------------------------
// 5. Condition summaries — endometriosis / PCOS / PMDD
// ---------------------------------------------------------------------------

describe('endometriosis condition summary', () => {
  const endoProfile: UserProfile = {
    ...BASE_PROFILE,
    conditionTags: ['endometriosis'],
  };

  it('summary contains correct cramp count and heavy bleeding count (English)', () => {
    const logEntries: DailyLogEntry[] = [
      { id: 'e1', logDate: '2026-04-01', bleeding: 'heavy', symptoms: ['cramps'] },
      { id: 'e2', logDate: '2026-04-02', bleeding: 'heavy', symptoms: ['cramps'] },
      { id: 'e3', logDate: '2026-04-03', bleeding: 'medium', symptoms: [] },
    ];
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: endoProfile,
      logEntries,
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'endometriosis')!;

    // 2 cramp days, 2 heavy days
    expect(summary.summary).toContain('2');
    expect(summary.summary).toMatch(/cramp/i);
    expect(summary.summary).toMatch(/heavy bleeding/i);
  });

  it('zero cramps and zero heavy bleeding → summary uses "0" counts without crashing', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: endoProfile,
      logEntries: [],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'endometriosis')!;

    expect(summary).toBeDefined();
    expect(summary.summary).toContain('0');
  });

  /**
   * Cramp count singular grammar: 1 logged day → "1 logged day" not "1 logged days"
   */
  it('singular cramp day → "1 logged day" not "1 logged days"', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: endoProfile,
      logEntries: [
        { id: 'e1', logDate: '2026-04-01', bleeding: 'heavy', symptoms: ['cramps'] },
      ],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'endometriosis')!;

    // "1 logged day" not "1 logged days"
    expect(summary.summary).toContain('1 logged day');
    expect(summary.summary).not.toMatch(/1 logged days/);
  });

  /**
   * SUSPECTED BUG: The endometriosis summary counts all logEntries passed to it
   * (which are the `recentConditionEntries` — last 90 days). Entries outside the
   * 90-day window should not be counted.
   * Verify that entries older than 90 days are excluded.
   */
  it('entries older than 90 days are excluded from endometriosis counts', () => {
    const oldEntry: DailyLogEntry = {
      id: 'old',
      logDate: '2025-01-01', // well outside 90-day window from 2026-04-18
      bleeding: 'heavy',
      symptoms: ['cramps'],
    };
    const recentEntry: DailyLogEntry = {
      id: 'recent',
      logDate: '2026-04-01', // within 90 days
      bleeding: 'medium',
      symptoms: [],
    };
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: endoProfile,
      logEntries: [oldEntry, recentEntry],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'endometriosis')!;

    // old entry should be excluded → 0 cramp days, 0 heavy days
    expect(summary.summary).toMatch(/^Cramps appeared on 0 logged days/);
  });
});

describe('PMDD condition summary', () => {
  const pmddProfile: UserProfile = {
    ...BASE_PROFILE,
    conditionTags: ['pmdd'],
    lastPeriodStartDate: '2026-04-10',
  };

  /**
   * PMDD window: 7 days BEFORE the last period start (Apr 10) → Apr 3..Apr 9.
   * diffDays(entry.logDate, lastPeriodStart) must be between 1 and 7 inclusive.
   * i.e. entries at Apr 3 (7 days before) through Apr 9 (1 day before).
   *
   * Test: entries exactly on Apr 3 (daysBefore = 7) and Apr 9 (daysBefore = 1)
   * should both be included.
   */
  it('includes entries exactly 7 days before last period start', () => {
    const logEntries: DailyLogEntry[] = [
      { id: 'd7', logDate: '2026-04-03', symptoms: ['cramps'], mood: 'low', bleeding: 'none' }, // 7 days before
      { id: 'd1', logDate: '2026-04-09', symptoms: [], mood: 'sensitive', bleeding: 'none' }, // 1 day before
      { id: 'd8', logDate: '2026-04-02', symptoms: ['headache'], mood: 'low', bleeding: 'none' }, // 8 days before — EXCLUDED
    ];
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pmddProfile,
      logEntries: [
        ...logEntries,
        bleeding('pstart', '2026-04-10'), // the period start itself
      ],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'pmdd')!;

    // 2 mood-shift days (low + sensitive), from the 2 entries within the window
    expect(summary.summary).toContain('2 day');
  });

  it('no period starts → PMDD summary does not crash and shows 0 counts', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pmddProfile,
      logEntries: [
        { id: 'd1', logDate: '2026-04-05', bleeding: 'none', symptoms: ['cramps'], mood: 'low' },
      ],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'pmdd')!;

    expect(summary).toBeDefined();
    // No period start → windowEntries = [] → both counts = 0
    expect(summary.summary).toContain('0 day');
  });
});

describe('PCOS condition summary', () => {
  const pcosProfile: UserProfile = {
    ...BASE_PROFILE,
    conditionTags: ['pcos'],
    supportsIrregularCycles: true,
    lastPeriodStartDate: '2026-04-10',
  };

  it('single cycle start → no cycleIntervals → falls back to spotting-only copy', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pcosProfile,
      logEntries: [bleeding('p1', '2026-04-01')],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'pcos')!;

    // No intervals → "Floriva will sharpen variability summaries" branch
    expect(summary.summary).toMatch(/Floriva will sharpen/);
  });

  it('two cycle starts → maxInterval is the single gap', () => {
    // Apr 1 → Apr 29 = 28 days
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-29',
      locale: 'en',
      profile: pcosProfile,
      logEntries: [
        bleeding('p1', '2026-04-01'),
        bleeding('p2', '2026-04-29'),
      ],
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'pcos')!;

    expect(summary.summary).toContain('28');
  });

  /**
   * SUSPECTED BUG: spotting count in PCOS summary.
   * The spotting counter uses the full recentConditionEntries (last 90 days).
   * The summary copy says "in the last 90 days" — confirm the filter is correct.
   */
  it('spotting count reflects spotting entries only (not light/medium/heavy)', () => {
    const logEntries: DailyLogEntry[] = [
      spotting('s1', '2026-04-05'),
      spotting('s2', '2026-04-06'),
      bleeding('p1', '2026-04-01'),
      bleeding('p2', '2026-04-15'),
    ];
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: pcosProfile,
      logEntries,
    });

    const summary = model.conditionSummaries.find((s) => s.key === 'pcos')!;

    // The summary mentions "spotting appeared on 2 logged days"
    expect(summary.summary).toContain('2 logged day');
  });
});

// ---------------------------------------------------------------------------
// 6. Monthly briefing edge cases
// ---------------------------------------------------------------------------

describe('monthly briefing edge cases', () => {
  it('zero logs this month → uses noLogsLead and emptyState', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [],
    });

    expect(model.monthlyBriefing.lead).not.toContain('undefined');
    expect(model.monthlyBriefing.lead).toBeTruthy();
    expect(typeof model.monthlyBriefing.lead).toBe('string');
  });

  it('exactly 1 log this month → subtitle says "1 local log reviewed" (singular)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [bleeding('p1', '2026-04-01')],
    });

    expect(model.monthlyBriefing.subtitle).toBe('1 local log reviewed');
  });

  it('exactly 1 period day → periodDaysLabel says "1 period day" (singular)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [bleeding('p1', '2026-04-01')],
    });

    expect(model.monthlyBriefing.periodDaysLabel).toBe('1 period day');
  });

  it('exactly 1 symptom day → symptomDaysLabel says "1 symptom day" (singular)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [{ id: 's1', logDate: '2026-04-01', bleeding: 'none', symptoms: ['cramps'] }],
    });

    expect(model.monthlyBriefing.symptomDaysLabel).toBe('1 symptom day');
  });

  it('lead sentence uses correct singular "period day" grammar when periodDays == 1', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [bleeding('p1', '2026-04-01')],
    });

    // Lead should say "1 period day" not "1 period days"
    expect(model.monthlyBriefing.lead).toMatch(/1 period day[^s]/);
  });

  it('LT-22: lead sentence uses correct singular "symptom day" grammar when symptomDays == 1', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        { id: 's1', logDate: '2026-04-01', bleeding: 'none', symptoms: ['cramps'] },
      ],
    });

    // FIXED: lead now cites symptomDays (matching symptomDaysLabel below
    // it), not a distinct "tracked signal" (symptom-type) count.
    expect(model.monthlyBriefing.lead).toMatch(/1 symptom day[^s]/);
  });

  /**
   * Future-dated entries must NOT appear in the monthly briefing (logDate > todayIso).
   */
  it('future-dated entries are excluded from monthly briefing counts', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('future1', '2026-04-20'), // future — must be excluded
        bleeding('today1', '2026-04-10'), // past — included
      ],
    });

    // Only the April 10 entry counts → 1 period day
    expect(model.monthlyBriefing.periodDaysLabel).toBe('1 period day');
  });

  /**
   * All entries in a past month, none in current month.
   * Briefing falls back to the latest logged month (March).
   */
  it('no current-month logs → briefing uses latest logged month', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        bleeding('m1', '2026-03-01'),
        bleeding('m2', '2026-03-05'),
      ],
    });

    expect(model.monthlyBriefing.title).toContain('March');
  });
});

// ---------------------------------------------------------------------------
// 7. Degenerate inputs — no crash, no NaN, no Infinity
// ---------------------------------------------------------------------------

describe('degenerate inputs: robustness', () => {
  const cases: { label: string; logEntries: DailyLogEntry[] }[] = [
    { label: 'completely empty log list', logEntries: [] },
    { label: 'spotting-only entries', logEntries: [spotting('s1', '2026-04-01'), spotting('s2', '2026-04-10')] },
    { label: 'no-bleeding entries with symptoms only', logEntries: [noBleeding('n1', '2026-04-05'), noBleeding('n2', '2026-04-06')] },
    { label: 'single bleeding entry on today', logEntries: [bleeding('t', '2026-04-18')] },
    { label: 'two starts 2193 days apart (6 years)', logEntries: [bleeding('a', '2020-01-01'), bleeding('b', '2026-01-01')] },
  ];

  it.each(cases)('$label: model builds without throwing', ({ logEntries }) => {
    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: BASE_PROFILE,
        logEntries,
      }),
    ).not.toThrow();
  });

  it.each(cases)('$label: cycleLengthData.avgDays is a finite integer', ({ logEntries }) => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries,
    });

    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(Number.isNaN(model.cycleLengthData.avgDays)).toBe(false);
    expect(Number.isInteger(model.cycleLengthData.avgDays)).toBe(true);
  });

  it.each(cases)('$label: bar days are all finite', ({ logEntries }) => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries,
    });

    model.cycleLengthData.bars.forEach((bar) => {
      expect(Number.isFinite(bar.days)).toBe(true);
    });
  });

  it.each(cases)('$label: phaseRhythmData.cycleLengthDays is finite', ({ logEntries }) => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries,
    });

    expect(Number.isFinite(model.phaseRhythmData.cycleLengthDays)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Large history — correctness at scale
// ---------------------------------------------------------------------------

describe('large history correctness', () => {
  it('5 years of daily bleeding logs → no crash, correct start count, finite average', () => {
    // Create a realistic 5-year history: 28-day cycles, each period 5 days long
    const entries: DailyLogEntry[] = [];
    let cycleStart = '2021-01-01';

    for (let cycle = 0; cycle < 65; cycle++) { // ~5 years
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const logDate = new Date(
          new Date(cycleStart + 'T12:00:00Z').getTime() + dayOffset * 86400 * 1000,
        )
          .toISOString()
          .slice(0, 10);

        entries.push({
          id: `c${cycle}-d${dayOffset}`,
          logDate,
          bleeding: dayOffset === 0 ? 'heavy' : dayOffset < 3 ? 'medium' : 'light',
          symptoms: [],
        });
      }

      // advance to next cycle
      cycleStart = new Date(
        new Date(cycleStart + 'T12:00:00Z').getTime() + 28 * 86400 * 1000,
      )
        .toISOString()
        .slice(0, 10);
    }

    expect(() =>
      buildInsightsScreenModel({
        todayIso: '2026-04-18',
        locale: 'en',
        profile: BASE_PROFILE,
        logEntries: entries,
      }),
    ).not.toThrow();

    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: entries,
    });

    expect(Number.isFinite(model.cycleLengthData.avgDays)).toBe(true);
    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
    // Only the last 12 intervals (the engine statistics window, UL-36) in bars
    expect(model.cycleLengthData.bars).toHaveLength(12);
    // All cycles are exactly 28 days
    expect(model.cycleLengthData.avgDays).toBe(28);
  });
});

// ---------------------------------------------------------------------------
// 9. Trust rule — thin data must NOT claim high confidence
// ---------------------------------------------------------------------------

describe('trust rule: thin data must not overstate confidence', () => {
  /**
   * With 0 observed cycle-to-cycle intervals, hasObservedHistory must be false.
   * The UI should use this flag to avoid showing "steady" or "regular" copy.
   */
  it('hasObservedHistory is false with only one period start (no intervals)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [bleeding('p1', '2026-04-01')],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  it('hasObservedHistory is false with zero entries', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  it('hasObservedHistory is false with only spotting (no qualifying bleeds)', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: BASE_PROFILE,
      logEntries: [
        spotting('s1', '2026-03-01'),
        spotting('s2', '2026-04-01'),
      ],
    });

    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
  });

  /**
   * Confirm avgDays never returns 0 or negative when profile seed is positive
   * and no intervals are observed. A 0 or negative avgDays would imply a
   * degenerate cycle and could confuse downstream predictions.
   */
  it('avgDays is always positive when profile seed > 0 and no observed intervals', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: { ...BASE_PROFILE, cycleLengthDays: 28 },
      logEntries: [],
    });

    expect(model.cycleLengthData.avgDays).toBeGreaterThan(0);
  });
});
