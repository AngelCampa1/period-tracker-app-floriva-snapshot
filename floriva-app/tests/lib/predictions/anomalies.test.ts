/**
 * Spec tests for the anomaly-detection engine primitives (A6).
 *
 * Detection only -- these tests exercise `detectAnomalies` as a pure
 * function over already-resolved RAW engine facts (last real period start,
 * un-rolled expected start -- see the "raw facts only" contract in
 * anomalies.ts), NOT the full `buildPredictionResult` orchestration (see
 * buildPredictionResult.anomalies.test.ts for the wiring level).
 *
 * Assertion style: every test asserts the FULL anomaly array with
 * `toStrictEqual`, never a `toContainEqual` membership check -- fixtures
 * with an accidental extra anomaly (an unrealistic padding interval, an
 * open cycle quietly past its bound) must fail loudly, not hide stowaways.
 * All period-start fixtures keep >= 15-day separations, matching the
 * MIN_CYCLE_SEPARATION_DAYS floor `collectPeriodStarts` guarantees for any
 * real `history.startDates` input.
 */

import type { DailyLogEntry } from '@/src/types/domain';

import type { Anomaly } from '@/src/lib/predictions/anomalyPresentation';
import { detectAnomalies } from '@/src/lib/predictions/anomalies';

function entry(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return { id: logDate, logDate, bleeding, symptoms: [] };
}

function anomaly(kind: Anomaly['kind'], anchorDateIso: string): Anomaly {
  return { id: `${kind}:${anchorDateIso}`, kind, anchorDateIso };
}

// A "fully regular, well-behaved" baseline: three 28-day-apart starts, today
// sits 3 days into the current (still-open) cycle, well within every bound.
// `expectedStartDate` is the un-rolled calendar expectation off the last
// real start (2026-02-26 + 28 = 2026-03-26).
const BASE_INPUT = {
  todayIso: '2026-03-01',
  logEntries: [] as DailyLogEntry[],
  historySource: 'bleeding-history' as const,
  historyStartDates: ['2026-01-01', '2026-01-29', '2026-02-26'],
  typicalCycleLengthDays: 28,
  spreadDays: 0,
  supportsIrregularCycles: false,
  currentCycleStartDate: '2026-02-26',
  expectedStartDate: '2026-03-26',
};

describe('detectAnomalies -- short-cycle', () => {
  it('flags an interval below typical - max(7, spread) as short-cycle, anchored at the later start', () => {
    // typical 28, spread 0 -> short bound = max(21, 28-7) = 21. Interval 15 < 21.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-16'], // 28, 15
      currentCycleStartDate: '2026-01-16',
      expectedStartDate: '2026-02-13',
      todayIso: '2026-01-20',
    });

    expect(result).toStrictEqual([anomaly('short-cycle', '2026-01-16')]);
  });

  it('does not flag an interval right at the typical length', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-29'], // 28, 28
      currentCycleStartDate: '2026-01-29',
      expectedStartDate: '2026-02-26',
      todayIso: '2026-02-01',
    });

    expect(result).toStrictEqual([]);
  });

  it('widens the short bound with a larger spread', () => {
    // typical 40, spread 12 -> bound = max(21, 40-12) = 28. Interval 26 < 28 -> short.
    // Padding interval is 37 days: within the long formula bound (min(60,
    // 40+12) = 52) AND at/below the 38-day hard stop, so it stays quiet.
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 40,
      spreadDays: 12,
      historyStartDates: ['2025-11-25', '2026-01-01', '2026-01-27'], // 37, 26
      currentCycleStartDate: '2026-01-27',
      expectedStartDate: '2026-03-08',
      todayIso: '2026-02-01',
    });

    expect(result).toStrictEqual([anomaly('short-cycle', '2026-01-27')]);
  });
});

describe('detectAnomalies -- long-cycle', () => {
  it('flags an interval above typical + max(7, spread) as long-cycle, anchored at the later start', () => {
    // typical 28, spread 0 -> bound = min(60, 28+7) = 35. Interval 40 > 35.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-02-10'], // 28, 40
      currentCycleStartDate: '2026-02-10',
      expectedStartDate: '2026-03-10',
      todayIso: '2026-02-15',
    });

    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-10')]);
  });

  it('applies the hard 38-day long-stop when the user is NOT in irregular mode, even if the formula bound is higher', () => {
    // typical 40, spread 30 -> formula bound = min(60, 40+30) = 60, well above 39.
    // But NOT irregular -> hard stop at 38 still fires for a 39-day interval.
    // Padding interval 37 stays at/below the hard stop.
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 40,
      spreadDays: 30,
      supportsIrregularCycles: false,
      historyStartDates: ['2025-11-25', '2026-01-01', '2026-02-09'], // 37, 39
      currentCycleStartDate: '2026-02-09',
      expectedStartDate: '2026-03-21',
      todayIso: '2026-02-15',
    });

    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-09')]);
  });

  it('does NOT apply the hard 38-day long-stop when irregular mode is enabled', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 40,
      spreadDays: 30,
      supportsIrregularCycles: true,
      historyStartDates: ['2025-11-25', '2026-01-01', '2026-02-09'], // 37, 39 -- formula bound 60
      currentCycleStartDate: '2026-02-09',
      expectedStartDate: '2026-03-21',
      todayIso: '2026-02-15',
    });

    expect(result).toStrictEqual([]);
  });

  it('does not flag an interval right at the typical length', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-29'], // 28, 28
      currentCycleStartDate: '2026-01-29',
      expectedStartDate: '2026-02-26',
      todayIso: '2026-02-01',
    });

    expect(result).toStrictEqual([]);
  });

  it('flags the current OPEN cycle as long-cycle when today - currentStart exceeds the long bound, before the next period arrives', () => {
    // typical 28, spread 0 -> bound 35. Current cycle open since 2026-01-01,
    // today is 40 days later, no new start logged yet. NOTE: at 40 days the
    // open cycle is also past expected (2026-01-29) + grace (7), so
    // missed-expected-period co-fires -- structurally unavoidable for a
    // spread-0 user, since the long margin (7) equals the grace floor (7).
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-11-06', '2025-12-04', '2026-01-01'], // 28, 28
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-02-10', // 40 days into the open cycle
    });

    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-29'),
      anomaly('long-cycle', '2026-01-01'),
    ]);
  });
});

describe('detectAnomalies -- prolonged-bleeding', () => {
  it('flags 8+ consecutive light/medium/heavy days, anchored at the first day of the run', () => {
    // The period that started 2026-01-29 (a real BASE start) ran 8 days.
    const logEntries = [
      entry('2026-01-29', 'medium'),
      entry('2026-01-30', 'medium'),
      entry('2026-01-31', 'medium'),
      entry('2026-02-01', 'light'),
      entry('2026-02-02', 'light'),
      entry('2026-02-03', 'light'),
      entry('2026-02-04', 'light'),
      entry('2026-02-05', 'heavy'),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });

    expect(result).toStrictEqual([anomaly('prolonged-bleeding', '2026-01-29')]);
  });

  it('does not flag exactly 7 consecutive bleeding days', () => {
    const logEntries = [
      entry('2026-01-29'),
      entry('2026-01-30'),
      entry('2026-01-31'),
      entry('2026-02-01'),
      entry('2026-02-02'),
      entry('2026-02-03'),
      entry('2026-02-04'),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });

    expect(result).toStrictEqual([]);
  });

  it('a spotting day breaks the consecutive run rather than counting toward it', () => {
    const logEntries = [
      entry('2026-01-29', 'medium'),
      entry('2026-01-30', 'medium'),
      entry('2026-01-31', 'medium'),
      entry('2026-02-01', 'spotting'), // breaks the run
      entry('2026-02-02', 'medium'),
      entry('2026-02-03', 'medium'),
      entry('2026-02-04', 'medium'),
      entry('2026-02-05', 'medium'),
      entry('2026-02-06', 'medium'),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });

    // Longest unbroken run is 3 (Jan 29-31) or 5 (Feb 2-6) -- neither reaches 8.
    expect(result).toStrictEqual([]);
  });

  it('fires even with onboarding-seed history / fewer than 2 completed intervals', () => {
    const logEntries = Array.from({ length: 9 }, (_, i) =>
      entry(`2026-04-${String(i + 1).padStart(2, '0')}`, 'medium'),
    );
    const result = detectAnomalies({
      ...BASE_INPUT,
      historySource: 'onboarding-seed',
      historyStartDates: ['2026-04-01'],
      currentCycleStartDate: '2026-04-01',
      expectedStartDate: '2026-04-29',
      todayIso: '2026-04-10',
      logEntries,
    });

    expect(result).toStrictEqual([anomaly('prolonged-bleeding', '2026-04-01')]);
  });
});

describe('detectAnomalies -- missed-expected-period', () => {
  it('flags when today is beyond expected + grace', () => {
    // spread 0 -> grace = max(7, ceil(0/2)+2) = 7. Expected 2026-03-26,
    // today 15 days past it. NOTE: at that point the open cycle (since
    // 2026-02-26) is 43 days -- past the 35-day long bound -- so long-cycle
    // co-fires; see the open-cycle test above for why that is structural.
    const result = detectAnomalies({
      ...BASE_INPUT,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-10',
    });

    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });

  it('does not flag when today is within the grace window', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-01', // 6 days late, within 7-day grace; open cycle 34 days, within 35
    });

    expect(result).toStrictEqual([]);
  });

  it('widens the grace window in irregular mode but does not fully suppress the anomaly', () => {
    // irregular -> grace = max(10, spread). spread 0 -> grace 10.
    // 8 days late: would fire non-irregular (grace 7), but sits within the
    // widened grace. The open cycle is 36 days at that point, so long-cycle
    // still fires via the FORMULA bound (irregular mode only exempts the
    // 38-day hard stop, not the formula bound).
    const withinWidenedGrace = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-03',
    });
    expect(withinWidenedGrace).toStrictEqual([anomaly('long-cycle', '2026-02-26')]);

    const beyondWidenedGrace = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-10', // 15 days late: beyond widened grace too
    });
    expect(beyondWidenedGrace).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });
});

describe('detectAnomalies -- suppression', () => {
  it('suppresses short/long-cycle and missed-expected-period on onboarding-seed history', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historySource: 'onboarding-seed',
      historyStartDates: ['2026-01-01'],
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-04-20', // would otherwise be wildly overdue AND long-open
    });

    expect(result).toStrictEqual([]);
  });

  it('suppresses short/long-cycle and missed-expected-period with fewer than 2 completed intervals', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historySource: 'bleeding-history',
      historyStartDates: ['2026-01-01'], // only one start -> zero completed intervals
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-04-20',
    });

    expect(result).toStrictEqual([]);
  });
});

describe('detectAnomalies -- ordering and interaction', () => {
  it('orders multiple co-existing anomalies most-recent anchor first (B5 takes the head)', () => {
    // Four genuinely co-existing anomalies from one history:
    // - 2025-10-01 -> 2025-11-15 is a 45-day interval  -> long-cycle @ 11-15
    // - the 2025-10-01 period bled 8 straight days      -> prolonged  @ 10-01
    // - the open cycle since 2025-12-13 is 43 days long -> long-cycle @ 12-13
    // - expected 2026-01-10 is 15 days overdue          -> missed     @ 01-10
    const logEntries = [
      entry('2025-10-01', 'heavy'),
      entry('2025-10-02', 'heavy'),
      entry('2025-10-03', 'medium'),
      entry('2025-10-04', 'medium'),
      entry('2025-10-05', 'medium'),
      entry('2025-10-06', 'light'),
      entry('2025-10-07', 'light'),
      entry('2025-10-08', 'light'),
    ];
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-10-01', '2025-11-15', '2025-12-13'], // 45, 28
      currentCycleStartDate: '2025-12-13',
      expectedStartDate: '2026-01-10',
      todayIso: '2026-01-25',
      logEntries,
    });

    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-10'),
      anomaly('long-cycle', '2025-12-13'),
      anomaly('long-cycle', '2025-11-15'),
      anomaly('prolonged-bleeding', '2025-10-01'),
    ]);
  });

  it('emits both long-cycle and missed-expected-period when the current open cycle triggers both', () => {
    // Locked interaction contract: the engine reports BOTH facts; B5 picks
    // (it shows at most one nudge). 50 days into the open cycle: past the
    // 35-day long bound AND 22 days past expected + 7-day grace.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-11-06', '2025-12-04', '2026-01-01'], // 28, 28
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-02-20',
    });

    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-29'),
      anomaly('long-cycle', '2026-01-01'),
    ]);
  });

  it('returns an empty array for a fully regular, well-behaved history', () => {
    const result = detectAnomalies(BASE_INPUT);
    expect(result).toStrictEqual([]);
  });
});
