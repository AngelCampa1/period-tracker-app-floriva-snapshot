/**
 * Adversarial tests for anomalies.ts (A6).
 *
 * Probes exact boundary values (21/38/60-day cycle bounds, spread-derived
 * bounds +/-1 day), the 8-vs-7-day bleeding run boundary, spotting-breaks-run
 * precisely at the boundary, the missed-expected-period grace boundary
 * exactly, irregular-mode widened grace, spreadDays undefined-safety,
 * suppression edge cases (onboarding seed, <2 intervals), and id-format
 * stability for dismissal persistence.
 *
 * Assertion style: every test asserts the FULL anomaly array with
 * `toStrictEqual` (see anomalies.test.ts header) so stowaway anomalies from
 * a sloppy fixture cannot hide behind a membership check. All period-start
 * fixtures keep >= 15-day separations (MIN_CYCLE_SEPARATION_DAYS -- the
 * floor `collectPeriodStarts` guarantees for real `history.startDates`).
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

// Quiet baseline (mirrors anomalies.test.ts): three 28-day-apart starts,
// today 3 days into the open cycle, expected = last start + 28.
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

// ─── short-cycle boundary (typical - max(7,spread), floored at 21) ─────────

describe('anomalies adversarial -- short-cycle boundary', () => {
  it('interval exactly at the bound is NOT short (strict less-than)', () => {
    // typical 28, spread 0 -> bound = max(21, 28-7) = 21. Interval exactly 21.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-22'], // 28, 21
      currentCycleStartDate: '2026-01-22',
      expectedStartDate: '2026-02-19',
      todayIso: '2026-01-25',
    });
    expect(result).toStrictEqual([]);
  });

  it('interval one day below the bound IS short', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-21'], // 28, 20 < 21
      currentCycleStartDate: '2026-01-21',
      expectedStartDate: '2026-02-18',
      todayIso: '2026-01-25',
    });
    expect(result).toStrictEqual([anomaly('short-cycle', '2026-01-21')]);
  });

  it('the 21-day floor holds even when typical - spread would suggest a lower bound', () => {
    // typical 25, spread 1 -> naive typical-spread = 24, but the margin floor
    // is max(7,1)=7 so bound = max(21, 25-7) = 21. Interval 22 is NOT short.
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 25,
      spreadDays: 1,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-23'], // 28, 22
      currentCycleStartDate: '2026-01-23',
      expectedStartDate: '2026-02-17',
      todayIso: '2026-01-25',
    });
    expect(result).toStrictEqual([]);
  });
});

// ─── long-cycle boundary (typical + max(7,spread), capped at 60; hard 38-stop) ─

describe('anomalies adversarial -- long-cycle boundary', () => {
  it('interval exactly at the formula bound is NOT long (strict greater-than)', () => {
    // typical 28, spread 0 -> bound = min(60, 28+7) = 35. Interval exactly 35,
    // and below the 38 hard stop, so no anomaly either way.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-02-05'], // 28, 35
      currentCycleStartDate: '2026-02-05',
      expectedStartDate: '2026-03-05',
      todayIso: '2026-02-10',
    });
    expect(result).toStrictEqual([]);
  });

  it('interval one day above the formula bound IS long', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-02-06'], // 28, 36 > 35
      currentCycleStartDate: '2026-02-06',
      expectedStartDate: '2026-03-06',
      todayIso: '2026-02-10',
    });
    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-06')]);
  });

  it('the 60-day cap holds even when typical + spread would suggest a higher bound (irregular mode)', () => {
    // typical 55, spread 10, irregular -> naive bound would be 65, capped at 60.
    // Interval 61 > 60 -> long, even though it is below the naive uncapped
    // bound. Padding interval is exactly 60 (not > 60, stays quiet).
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 55,
      spreadDays: 10,
      supportsIrregularCycles: true,
      historyStartDates: ['2025-11-02', '2026-01-01', '2026-03-03'], // 60, 61
      currentCycleStartDate: '2026-03-03',
      expectedStartDate: '2026-04-27',
      todayIso: '2026-03-10',
    });
    expect(result).toStrictEqual([anomaly('long-cycle', '2026-03-03')]);
  });

  it('hard 38-day long-stop: exactly 38 days is NOT long when not irregular, even with a wide formula bound (strict greater-than)', () => {
    // typical 40, spread 30 -> formula bound = min(60, 40+30) = 60, well above
    // 38, so only the hard stop is in play here. Exactly 38 must NOT fire it.
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 40,
      spreadDays: 30,
      historyStartDates: ['2025-11-24', '2026-01-01', '2026-02-08'], // 38, 38
      currentCycleStartDate: '2026-02-08',
      expectedStartDate: '2026-03-20',
      todayIso: '2026-02-12',
    });
    expect(result).toStrictEqual([]);
  });

  it('hard 38-day long-stop: 39 days IS long when not irregular, even though the formula bound (60) does not cover it', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      typicalCycleLengthDays: 40,
      spreadDays: 30,
      historyStartDates: ['2025-11-24', '2026-01-01', '2026-02-09'], // 38, 39
      currentCycleStartDate: '2026-02-09',
      expectedStartDate: '2026-03-21',
      todayIso: '2026-02-12',
    });
    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-09')]);
  });

  it('open-cycle long-cycle rule: exactly at the bound is not flagged, one day past is', () => {
    // typical 28, spread 0 -> bound 35; expected 2026-01-24 (12-27 + 28),
    // grace 7 -> missed boundary is ALSO day 35 of the open cycle, so the
    // day-past-the-bound case co-fires missed-expected-period (structural
    // for spread 0: long margin 7 == grace floor 7).
    const atBound = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-11-01', '2025-11-29', '2025-12-27'], // 28, 28
      currentCycleStartDate: '2025-12-27',
      expectedStartDate: '2026-01-24',
      todayIso: '2026-01-31', // exactly 35 days into the open cycle; exactly 7 days late
    });
    expect(atBound).toStrictEqual([]);

    const pastBound = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-11-01', '2025-11-29', '2025-12-27'],
      currentCycleStartDate: '2025-12-27',
      expectedStartDate: '2026-01-24',
      todayIso: '2026-02-01', // 36 days into the open cycle; 8 days late
    });
    expect(pastBound).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-24'),
      anomaly('long-cycle', '2025-12-27'),
    ]);
  });
});

// ─── prolonged-bleeding: 8 vs 7 day boundary, spotting-breaks-run ──────────

describe('anomalies adversarial -- prolonged-bleeding boundary', () => {
  it('exactly 8 consecutive days IS flagged', () => {
    const logEntries = Array.from({ length: 8 }, (_, i) =>
      entry(`2026-02-0${i + 1}`, 'light'),
    );
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([anomaly('prolonged-bleeding', '2026-02-01')]);
  });

  it('exactly 7 consecutive days is NOT flagged', () => {
    const logEntries = Array.from({ length: 7 }, (_, i) =>
      entry(`2026-02-0${i + 1}`, 'light'),
    );
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([]);
  });

  it('a non-contiguous gap (missing log day) breaks the run just like spotting does', () => {
    const logEntries = [
      entry('2026-02-01', 'medium'),
      entry('2026-02-02', 'medium'),
      entry('2026-02-03', 'medium'),
      entry('2026-02-04', 'medium'),
      // gap: no entry for 2026-02-05
      entry('2026-02-06', 'medium'),
      entry('2026-02-07', 'medium'),
      entry('2026-02-08', 'medium'),
      entry('2026-02-09', 'medium'),
      entry('2026-02-10', 'medium'),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([]);
  });

  it('"none" bleeding also breaks the run', () => {
    const logEntries = [
      ...Array.from({ length: 4 }, (_, i) => entry(`2026-02-0${i + 1}`, 'medium')),
      entry('2026-02-05', 'none'),
      ...Array.from({ length: 4 }, (_, i) => entry(`2026-02-0${i + 6}`, 'medium')),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([]);
  });

  it('a spotting day exactly at position 8 breaks what would otherwise be an 8-day run', () => {
    const logEntries = [
      ...Array.from({ length: 7 }, (_, i) => entry(`2026-02-0${i + 1}`, 'medium')),
      entry('2026-02-08', 'spotting'),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([]);
  });

  it('detects multiple independent qualifying runs, most recent first', () => {
    const logEntries = [
      ...Array.from({ length: 8 }, (_, i) => entry(`2026-01-0${i + 1}`, 'medium')),
      entry('2026-01-09', 'none'),
      ...Array.from({ length: 8 }, (_, i) => entry(`2026-02-0${i + 1}`, 'heavy')),
    ];
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([
      anomaly('prolonged-bleeding', '2026-02-01'),
      anomaly('prolonged-bleeding', '2026-01-01'),
    ]);
  });

  it('unsorted log entries are sorted before run detection', () => {
    const logEntries = Array.from({ length: 8 }, (_, i) =>
      entry(`2026-02-0${i + 1}`, 'medium'),
    ).reverse();
    const result = detectAnomalies({ ...BASE_INPUT, logEntries });
    expect(result).toStrictEqual([anomaly('prolonged-bleeding', '2026-02-01')]);
  });
});

// ─── missed-expected-period grace boundary ─────────────────────────────────

describe('anomalies adversarial -- missed-expected-period grace boundary', () => {
  it('exactly at expected + grace is NOT flagged (strict greater-than)', () => {
    // spread 0 -> grace = max(7, ceil(0/2)+2) = 7. Boundary = expected + 7.
    // The open cycle is exactly 35 days here too (long bound boundary), so
    // the full array is empty on both counts.
    const result = detectAnomalies({
      ...BASE_INPUT,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-02', // exactly 7 days late; open cycle exactly 35 days
    });
    expect(result).toStrictEqual([]);
  });

  it('one day past expected + grace IS flagged', () => {
    // 8 days late > grace 7. The open cycle hits 36 days at the same moment
    // (structural for spread 0 -- long margin == grace floor), so long-cycle
    // co-fires.
    const result = detectAnomalies({
      ...BASE_INPUT,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-03',
    });
    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });

  it('grace unchanged by a small spread: spread 6 -> grace = max(7, ceil(6/2)+2) = max(7,5) = 7', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      spreadDays: 6,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-02', // 7 days late, at the (unchanged) boundary; open 35 <= bound 35
    });
    expect(result).toStrictEqual([]);
  });

  it('grace widens with a larger spread: spread 12 -> grace = max(7, ceil(12/2)+2) = 8', () => {
    // spread 12 also widens the long bound to min(60, 28+12) = 40, so the
    // open cycle (36-37 days) stays quiet -- this pair isolates the
    // missed-expected-period boundary with NO co-firing long-cycle.
    const atWidenedBoundary = detectAnomalies({
      ...BASE_INPUT,
      spreadDays: 12,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-03', // exactly 8 days late == widened grace; open 36 <= 40
    });
    expect(atWidenedBoundary).toStrictEqual([]);

    const pastWidenedBoundary = detectAnomalies({
      ...BASE_INPUT,
      spreadDays: 12,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-04', // 9 days late > widened grace of 8; open 37 <= 40
    });
    expect(pastWidenedBoundary).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
    ]);
  });

  it('irregular-mode widened grace boundary: spread 0 -> grace max(10, 0) = 10', () => {
    // The open cycle is 38/39 days at these two probes -- past the 35-day
    // FORMULA bound, which still applies in irregular mode (only the 38-day
    // hard stop is exempted) -- so long-cycle appears in both arrays; the
    // missed-expected-period entry is what flips across the boundary.
    const atBoundary = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-05', // exactly 10 days late; open 38 > 35
    });
    expect(atBoundary).toStrictEqual([anomaly('long-cycle', '2026-02-26')]);

    const pastBoundary = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-06', // 11 days late; open 39 > 35
    });
    expect(pastBoundary).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });

  it('irregular mode with a large spread widens grace beyond the 10-day floor', () => {
    // irregular, spread 15 -> grace = max(10, 15) = 15. The spread also
    // pushes the long bound to min(60, 28+15) = 43; the open cycle is exactly
    // 43 days at the boundary probe (quiet) and 44 at the past-boundary probe
    // (long-cycle co-fires).
    const withinGrace = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      spreadDays: 15,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-10', // 15 days late == boundary; open exactly 43
    });
    expect(withinGrace).toStrictEqual([]);

    const beyondGrace = detectAnomalies({
      ...BASE_INPUT,
      supportsIrregularCycles: true,
      spreadDays: 15,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-11', // 16 days late > 15; open 44 > 43
    });
    expect(beyondGrace).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });

  it('a past expectedStartDate (signal-re-anchored) is a valid missed-period trigger input', () => {
    // A4 can re-anchor the expected start into the past when a confirmed
    // ovulation signal implies the period is already late. The caller passes
    // that signal date as expectedStartDate -- this module compares it
    // against `todayIso` as-is, without recomputing a calendar expectation.
    // The open cycle is 53 days by then, so long-cycle co-fires.
    const result = detectAnomalies({
      ...BASE_INPUT,
      expectedStartDate: '2026-04-05', // signal-derived; already past todayIso below
      todayIso: '2026-04-20', // 15 days after the (already-past) expected date
    });
    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-04-05'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });
});

// ─── spreadDays undefined-safety (no A2 statistics available) ─────────────

describe('anomalies adversarial -- spreadDays undefined-safety', () => {
  it('treats an undefined spreadDays as 0 for short/long-cycle bound derivation', () => {
    // Same fixture as the plain "flags a short interval" spec test, but with
    // spreadDays entirely absent (as when the engine had no statistics
    // sample) rather than explicitly 0 -- must behave identically.
    const result = detectAnomalies({
      ...BASE_INPUT,
      spreadDays: undefined,
      historyStartDates: ['2025-12-04', '2026-01-01', '2026-01-16'], // 28, 15 < 21
      currentCycleStartDate: '2026-01-16',
      expectedStartDate: '2026-02-13',
      todayIso: '2026-01-20',
    });

    expect(result).toStrictEqual([anomaly('short-cycle', '2026-01-16')]);
  });

  it('treats an undefined spreadDays as 0 for the missed-expected-period grace window', () => {
    // grace = max(7, ceil(0/2)+2) = 7, identical to explicit spreadDays: 0.
    // 8 days late fires it; the open cycle hits 36 days at the same moment,
    // so long-cycle co-fires (spread-0 structural pairing, see above).
    const result = detectAnomalies({
      ...BASE_INPUT,
      spreadDays: undefined,
      expectedStartDate: '2026-03-26',
      todayIso: '2026-04-03',
    });

    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-03-26'),
      anomaly('long-cycle', '2026-02-26'),
    ]);
  });
});

// ─── suppression edge cases ─────────────────────────────────────────────────

describe('anomalies adversarial -- suppression edge cases', () => {
  it('exactly 2 completed intervals (3 starts) is enough to NOT suppress short/long-cycle', () => {
    // Second interval is 16 days -- a realistic short cycle (>= the 15-day
    // MIN_CYCLE_SEPARATION_DAYS floor, < the 21-day short bound).
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2026-01-01', '2026-01-29', '2026-02-14'], // 28, 16
      currentCycleStartDate: '2026-02-14',
      expectedStartDate: '2026-03-14',
      todayIso: '2026-02-18',
    });
    expect(result).toStrictEqual([anomaly('short-cycle', '2026-02-14')]);
  });

  it('exactly 1 completed interval (2 starts) suppresses short/long-cycle and missed-expected-period', () => {
    // 15-day interval would be short, today is far past expected + grace and
    // the open cycle is far past the long bound -- but a single completed
    // interval is no baseline, so everything except prolonged-bleeding is
    // suppressed.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2026-01-01', '2026-01-16'], // 15
      currentCycleStartDate: '2026-01-16',
      expectedStartDate: '2026-02-13',
      todayIso: '2026-04-20',
    });
    expect(result).toStrictEqual([]);
  });

  it('zero starts suppresses short/long-cycle and missed-expected-period', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: [],
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-04-20',
    });
    expect(result).toStrictEqual([]);
  });

  it('prolonged-bleeding is NEVER suppressed by onboarding-seed source or sparse history', () => {
    const logEntries = Array.from({ length: 10 }, (_, i) =>
      entry(`2026-02-${String(i + 1).padStart(2, '0')}`, 'heavy'),
    );
    const result = detectAnomalies({
      ...BASE_INPUT,
      historySource: 'onboarding-seed',
      historyStartDates: [],
      logEntries,
    });
    expect(result).toStrictEqual([anomaly('prolonged-bleeding', '2026-02-01')]);
  });
});

// ─── LT-03: completed-interval recency cutoff (90 days) ────────────────────

describe('anomalies adversarial -- LT-03 completed-interval recency cutoff', () => {
  it('a completed-interval long-cycle anchored exactly 90 days before today still fires (boundary inclusive)', () => {
    // Anchor 2026-01-01, today 2026-04-01 = 90 days exactly.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-10-01', '2025-11-14', '2026-01-01'], // 44, 48 -- both long
      currentCycleStartDate: '2026-01-01',
      expectedStartDate: '2026-01-29',
      todayIso: '2026-04-01',
    });

    // The 2025-11-14 anchor is 138 days before today -> dropped (stale).
    // The 2026-01-01 anchor is exactly 90 days before today -> kept
    // (boundary inclusive: diffDays(start, today) > 90 is the drop rule, so
    // == 90 survives) -- both the completed-interval check AND the
    // open-cycle check independently fire on this same anchor (documented,
    // pre-existing "both fire" interaction; see anomalies.test.ts), and the
    // 90-day-overdue expected period also fires missed-expected-period.
    expect(result).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-29'),
      anomaly('long-cycle', '2026-01-01'),
      anomaly('long-cycle', '2026-01-01'),
    ]);
  });

  it('a completed-interval long-cycle anchored 91 days before today is dropped as stale', () => {
    // Anchor 2025-12-31, today 2026-04-01 = 91 days -- one past the cutoff.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-09-30', '2025-11-13', '2025-12-31'], // 44, 48 -- both long
      currentCycleStartDate: '2026-03-10', // separate, still-open, WITHIN the long bound (22 days)
      expectedStartDate: '2026-04-07',
      todayIso: '2026-04-01',
    });

    // Both completed-interval anchors (2025-11-13: 139 days old, 2025-12-31:
    // 91 days old) are stale and dropped. The open cycle is only 22 days in
    // -- within the 35-day long bound and well within the 7-day
    // missed-expected grace -- so it stays quiet too. Net result: nothing
    // fires, isolating the completed-interval cutoff.
    expect(result).toStrictEqual([]);
  });

  it('a stale completed-interval short-cycle anchor is also dropped', () => {
    // 2025-12-01 is 121 days before 2026-04-01 -- well past the cutoff.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: ['2025-11-01', '2025-12-01'], // 30 days -- not short by itself
      currentCycleStartDate: '2025-12-01',
      expectedStartDate: '2025-12-29',
      todayIso: '2026-04-01',
    });

    expect(result).toStrictEqual([]);
  });

  it('dismissing the freshest long-cycle nudge does NOT resurface a stale one (LT-03 core scenario)', () => {
    // Mirrors the long-tenure finding: several long-cycle intervals across a
    // year, only the most recent (within 90 days) survives detection at
    // all -- there is nothing stale left to promote after dismissal.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: [
        '2025-05-01',
        '2025-06-14', // 44 days -- long, but 292 days old -> dropped
        '2025-09-01', // 79 days -- long, but 213 days old -> dropped
        '2025-12-15', // 105 days -- long, but 108 days old -> dropped (just past cutoff)
        '2026-02-28', // 75 days -- long, 33 days old -> KEPT
      ],
      currentCycleStartDate: '2026-02-28',
      expectedStartDate: '2026-03-28',
      todayIso: '2026-04-01', // 32 days into the open cycle -- quiet on its own
    });

    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-28')]);
  });
});

// ─── id-format stability (dismissal persistence contract with B4) ─────────

describe('anomalies adversarial -- id format stability', () => {
  // Shared fixture emitting anomalies of THREE kinds at once:
  // 45-day first interval (long), 43-day open cycle (long), expected
  // 15 days overdue (missed), and an 8-day bleed at the 12-13 start
  // (prolonged). Two of them share the 2025-12-13 anchor across different
  // kinds -- ids must still be distinct.
  const MULTI_ANOMALY_INPUT = {
    ...BASE_INPUT,
    historyStartDates: ['2025-10-01', '2025-11-15', '2025-12-13'], // 45, 28
    currentCycleStartDate: '2025-12-13',
    expectedStartDate: '2026-01-10',
    todayIso: '2026-01-25',
  };

  it('every emitted anomaly id follows the exact `{kind}:{anchorDateIso}` format', () => {
    const logEntries = Array.from({ length: 8 }, (_, i) =>
      entry(`2025-12-${13 + i}`, 'medium'),
    );
    const result = detectAnomalies({ ...MULTI_ANOMALY_INPUT, logEntries });

    expect(result).toHaveLength(4);
    for (const detected of result) {
      expect(detected.id).toBe(`${detected.kind}:${detected.anchorDateIso}`);
    }
    // Same-anchor, different-kind anomalies keep distinct ids.
    expect(new Set(result.map((detected) => detected.id)).size).toBe(4);
  });

  it('the same detected conditions always produce the same ids across repeated calls (stable dismissal keys)', () => {
    const first = detectAnomalies(MULTI_ANOMALY_INPUT);
    const second = detectAnomalies(MULTI_ANOMALY_INPUT);

    expect(first).toStrictEqual([
      anomaly('missed-expected-period', '2026-01-10'),
      anomaly('long-cycle', '2025-12-13'),
      anomaly('long-cycle', '2025-11-15'),
    ]);
    expect(second).toStrictEqual(first);
  });
});

// ─── LT-11: observed-range floor for supportsIrregularCycles users ────────

describe('anomalies adversarial -- LT-11 observed-range floor (irregular-support users)', () => {
  // A user with a genuinely recurring 26/60-day alternating rhythm, opted
  // into irregular-cycle support. MAD rejection (cycleStatistics.ts, outside
  // this module) would treat the 60-day intervals as outliers relative to
  // the 26-day ones and shrink `spreadDays` accordingly -- the caller passes
  // that shrunk spread (3) here, simulating the real orchestration.
  const RECURRING_STARTS = [
    '2025-09-01',
    '2025-09-27', // 26
    '2025-11-26', // 60
    '2025-12-22', // 26
    '2026-02-20', // 60
    '2026-03-18', // 26
  ];

  it('does NOT flag the user\'s own recurring 60-day cycles once irregular support is ON (observed-range floor raises the bound to 60)', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: RECURRING_STARTS,
      typicalCycleLengthDays: 26,
      spreadDays: 3, // the shrunk post-MAD-rejection spread
      supportsIrregularCycles: true,
      currentCycleStartDate: '2026-03-18',
      expectedStartDate: '2026-04-13',
      todayIso: '2026-04-10', // 23 days into the open cycle -- quiet on its own
    });

    // Without the LT-11 fix, the bound would be min(60, 26 + max(7, 3)) =
    // 33, and both 60-day intervals (2025-11-26, 2026-02-20) would fire.
    // With the observed-range floor (widest historical interval, 60, minus
    // typical 26 = margin 34), the bound becomes min(60, 26 + 34) = 60, so
    // neither 60-day interval qualifies as long anymore.
    expect(result).toStrictEqual([]);
  });

  it('the SAME formula does not suppress long-cycle for a non-irregular user (observed-range floor is irregular-only)', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: RECURRING_STARTS,
      typicalCycleLengthDays: 26,
      spreadDays: 3,
      supportsIrregularCycles: false, // NOT opted into irregular support
      currentCycleStartDate: '2026-03-18',
      expectedStartDate: '2026-04-13',
      todayIso: '2026-04-10',
    });

    // Bound stays at the un-floored min(60, 26 + max(7,3)) = 33; the 60-day
    // interval anchored 2026-02-20 (49 days before today -- within the
    // LT-03 90-day recency window) fires. The OTHER 60-day interval
    // (2025-11-26) is a real 60-day-long-cycle candidate too, but it is 135
    // days before today -- stale per LT-03's recency cutoff regardless of
    // this (non-)fix, so it does not appear either way; this test isolates
    // the irregular-only scope of the observed-range floor, not LT-03.
    expect(result).toStrictEqual([anomaly('long-cycle', '2026-02-20')]);
  });

  it('a genuinely NEW extreme (wider than anything on record) still fires even for an irregular-support user', () => {
    const result = detectAnomalies({
      ...BASE_INPUT,
      // Same recurring 26/60 pattern, but the LATEST interval is 70 days --
      // wider than the 60-day historical max. Because the interval under
      // test is EXCLUDED from its own observed-range floor (see the
      // self-masking note on resolveLongCycleBound in anomalies.ts), the
      // bound for this interval derives from the other intervals' max (60
      // -> margin 34 -> bound capped at 60), and 70 > 60 fires. (It would
      // also exceed the 60-day hard cap regardless -- see the SUB-cap new
      // extreme test below for the case the cap alone would not catch.)
      historyStartDates: [...RECURRING_STARTS.slice(0, -1), '2026-03-18', '2026-05-27'], // last interval 70
      typicalCycleLengthDays: 26,
      spreadDays: 3,
      supportsIrregularCycles: true,
      currentCycleStartDate: '2026-05-27',
      expectedStartDate: '2026-06-22',
      todayIso: '2026-06-01', // 5 days into the open cycle -- quiet on its own
    });

    expect(result).toStrictEqual([anomaly('long-cycle', '2026-05-27')]);
  });

  it('a SUB-cap new extreme (prior max 45, new 55) fires -- the interval under test cannot raise its own bound (self-masking fix)', () => {
    // Intervals: 26, 45, 26, 55. The 55 is a genuinely new extreme for this
    // user (prior max 45) but sits BELOW the 60-day hard cap -- the exact
    // case the original self-masking bug hid: computing the observed max
    // over ALL intervals let the record-setting 55 raise the bound to
    // itself (min(60, 26 + (55-26)) = 55), and the strict `>` could then
    // never flag it. With the interval under test excluded, its bound
    // derives from the OTHER intervals (max 45 -> margin 19 -> bound
    // min(60, 26 + 19) = 45), and 55 > 45 fires.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: [
        '2026-01-01',
        '2026-01-27', // 26
        '2026-03-13', // 45 -- prior max; 89 days before today (within LT-03 window), quiet vs its own bound of 55
        '2026-04-08', // 26
        '2026-06-02', // 55 -- the new extreme
      ],
      typicalCycleLengthDays: 26,
      spreadDays: 3,
      supportsIrregularCycles: true,
      currentCycleStartDate: '2026-06-02',
      expectedStartDate: '2026-06-28',
      todayIso: '2026-06-10', // 8 days into the open cycle -- quiet on its own
    });

    expect(result).toStrictEqual([anomaly('long-cycle', '2026-06-02')]);
  });

  it('a RECURRING sub-cap extreme (two 55-day intervals) stays quiet -- own known rhythm, each covered by the other', () => {
    // Intervals: 26, 55, 26, 55. Each 55 is evaluated against a bound
    // floored at the OTHER intervals' max -- which includes the other 55 --
    // so margin = 55 - 26 = 29, bound = min(60, 26 + 29) = 55, and 55 is
    // not > 55: the user's own repeating pattern stays quiet even though a
    // single occurrence of the same interval (previous test) would fire.
    // This is exactly the "recurring rhythm vs genuinely new extreme"
    // distinction LT-11 is scoped to.
    const result = detectAnomalies({
      ...BASE_INPUT,
      historyStartDates: [
        '2026-01-01',
        '2026-01-27', // 26
        '2026-03-23', // 55
        '2026-04-18', // 26
        '2026-06-12', // 55 -- same extreme, second occurrence
      ],
      typicalCycleLengthDays: 26,
      spreadDays: 3,
      supportsIrregularCycles: true,
      currentCycleStartDate: '2026-06-12',
      expectedStartDate: '2026-07-08',
      todayIso: '2026-06-20', // 8 days into the open cycle -- quiet on its own
    });

    expect(result).toStrictEqual([]);
  });
});
