/**
 * Integration tests for A6 anomaly wiring in buildPredictionResult.
 *
 * These pin the RAW-vs-ROLLED split (the review-mandated acceptance gate):
 * the engine rolls its calendar anchor forward by whole cycles so
 * predictions always point ahead, but `detectAnomalies` must be fed the
 * user's RAW reality -- the last REAL logged period start and the UN-ROLLED
 * expectation derived from it. A regular 28-day user who is 41 days into an
 * open cycle must see BOTH long-cycle and missed-expected-period fire, even
 * though the engine simultaneously reports a synthetic "day 14" rolled
 * cycle with a future next-period date. See the A6 wiring comment in
 * buildPredictionResult.ts for the two-views rationale.
 */

import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';

function entry(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return { id: logDate, logDate, bleeding, symptoms: [] };
}

// A perfectly regular 28-day user: three starts, two exact 28-day intervals,
// so robust statistics report spreadDays 0 and the engine resolves
// cycleLengthDays 28. Last real start: 2026-03-02. Un-rolled expectation:
// 2026-03-30. Grace (spread 0): max(7, ceil(0/2)+2) = 7, so the missed
// boundary is 2026-04-06; the open-cycle long bound is min(60, 28+7) = 35
// days, crossed on the same date (structural for spread 0).
const REGULAR_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-03-02',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

const REGULAR_ENTRIES = [entry('2026-01-05'), entry('2026-02-02'), entry('2026-03-02')];

describe('buildPredictionResult anomalies wiring -- raw facts, not the rolled projection', () => {
  it('a regular 28-day user 41 days into the open cycle gets BOTH long-cycle and missed-expected-period', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-12', // 41 days after the last real start
      profile: REGULAR_PROFILE,
      logEntries: REGULAR_ENTRIES,
    });

    // The anomalies observe RAW reality: anchored on the last REAL start
    // (2026-03-02) and the UN-ROLLED expectation (2026-03-30).
    expect(result.anomalies).toStrictEqual([
      {
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      },
      {
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      },
    ]);

    // ...while the PROJECTION view stays rolled-forward and untouched: the
    // engine reports a synthetic current cycle re-anchored one whole cycle
    // ahead, with a genuinely future next-period date.
    expect(result.current.cycleStartDate).toBe('2026-03-30');
    expect(result.current.cycleDay).toBe(14);
    expect(result.nextPeriod.startDate).toBe('2026-04-27');
    expect(result.limitationCodes).toContain('projected-forward');
  });

  it('missed-expected-period does NOT fire at exactly expected + grace (day 35)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-06', // expected (2026-03-30) + grace (7), exactly
      profile: REGULAR_PROFILE,
      logEntries: REGULAR_ENTRIES,
    });

    // Exactly at the boundary: 7 days late is not > 7, and the open cycle
    // is exactly 35 days (not > 35), so no anomalies at all -- and per the
    // additive-field contract the key must be fully ABSENT, not [].
    expect(result.anomalies).toBeUndefined();
    expect('anomalies' in result).toBe(false);
  });

  it('missed-expected-period DOES fire at expected + grace + 1 (day 36)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-07', // one day past expected + grace
      profile: REGULAR_PROFILE,
      logEntries: REGULAR_ENTRIES,
    });

    // Note this is a day the engine has ALREADY rolled past (36 >= 28): the
    // pre-fix wiring fed the detector the rolled view and could never fire
    // here. long-cycle co-fires at 36 days (structural for spread 0).
    expect(result.anomalies).toStrictEqual([
      {
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      },
      {
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      },
    ]);
  });

  it('no anomalies mid-cycle for the same regular user', () => {
    const result = buildPredictionResult({
      todayIso: '2026-03-10', // day 9 of a normal open cycle
      profile: REGULAR_PROFILE,
      logEntries: REGULAR_ENTRIES,
    });

    expect('anomalies' in result).toBe(false);
  });

  it('a long gap with only ONE logged start stays suppressed (no baseline, no anomalies)', () => {
    // Mirrors golden case 5 ("long gap since last logged start"): the roll
    // happens, but with fewer than 2 completed intervals the cycle-timing
    // detectors are suppressed entirely -- the engine must not cry anomaly
    // at a user it has no baseline for.
    const result = buildPredictionResult({
      todayIso: '2026-06-01',
      profile: { ...REGULAR_PROFILE, lastPeriodStartDate: '2026-04-02', cycleLengthDays: 29 },
      logEntries: [entry('2026-04-02')],
    });

    expect('anomalies' in result).toBe(false);
    expect(result.limitationCodes).toContain('projected-forward');
  });
});
