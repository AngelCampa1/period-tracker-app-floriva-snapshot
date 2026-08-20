/**
 * Long-tenure probes for the v2 prediction engine (workstream E, Phase 1).
 *
 * Convention (matches *.probe.adversarial.test.ts): probes DOCUMENT current
 * behavior. A bug probe asserts the CURRENT (buggy/questionable) behavior
 * with a comment explaining what SHOULD happen, so the suite stays green and
 * the eventual fix flips the assertion. Resolution probes pin behavior that
 * the 1.2.0 rework already fixed, as acceptance evidence for the campaign's
 * original suspects.
 *
 * All probes run the engine against `buildTenureDataset` fixtures with a
 * FIXED todayIso — the generator is a pure function of (variant, todayIso),
 * so every asserted value below is deterministic (see the determinism
 * contract in src/testing/tenureFixtures.ts).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { filterDismissedAnomalies } from '@/src/lib/predictions/anomalyPresentation';
import { computeCycleStatistics } from '@/src/lib/predictions/cycleStatistics';
import { diffDays } from '@/src/lib/predictions/dateMath';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';

const TODAY = '2026-07-06';

function runEngine(variant: Parameters<typeof buildTenureDataset>[0]) {
  const dataset = buildTenureDataset(variant, TODAY);
  return {
    dataset,
    prediction: buildPredictionResult({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
    }),
  };
}

// ─── Resolved original suspects (acceptance evidence for E) ─────────────────

describe('RESOLVED — A2 robust statistics: a multi-month gap no longer poisons the cycle-length estimate', () => {
  it('tenure-6mo-gap: the ~120-day gap interval is discarded and cycle length stays at the observed 30 days', () => {
    const { prediction } = runEngine('tenure-6mo-gap');

    // Pre-1.2.0 suspect: a 90-day logging gap would be averaged into the
    // cycle length. The MAD/bounds pipeline now discards it entirely.
    expect(prediction.cycleLengthDays).toBe(30);
    expect(prediction.statistics).toEqual({
      spreadDays: 0,
      sampleSize: 2,
      discardedCount: 1,
    });
  });

  it('tenure-6mo-gap: the gap cycle is surfaced as a long-cycle anomaly (as designed)', () => {
    const { prediction } = runEngine('tenure-6mo-gap');

    expect(prediction.anomalies).toEqual([
      { id: 'long-cycle:2026-05-31', kind: 'long-cycle', anchorDateIso: '2026-05-31' },
    ]);
  });
});

describe('RESOLVED — confidence honesty on irregular history', () => {
  it('tenure-12mo-irregular (24–60 day cycles, irregular support ON) reports medium confidence, never high', () => {
    const { prediction } = runEngine('tenure-12mo-irregular');

    // Pre-1.2.0 suspect: "high" confidence despite 24–60 day variance. The
    // irregular-cycle opt-in now caps the level at medium with an explicit
    // reason code.
    expect(prediction.confidence.level).toBe('medium');
    expect(prediction.confidence.reasonCodes).toContain('irregular-cycle-support-enabled');
  });

  it('tenure-12mo-irregular: outlier rejection is visible in the statistics (3 of 10 intervals discarded)', () => {
    const { prediction } = runEngine('tenure-12mo-irregular');

    expect(prediction.statistics).toEqual({
      spreadDays: 2.97,
      sampleSize: 7,
      discardedCount: 3,
    });
  });
});

describe('RESOLVED — history ages out of the estimate (12-interval window)', () => {
  it('8 old 40-day intervals followed by 12 recent 28-day intervals estimate 28, not a blend', () => {
    // Pre-1.2.0 suspect: "history never ages out". computeCycleStatistics
    // windows to the most recent <= 12 intervals, so the 40-day era
    // contributes nothing once 12 newer intervals exist.
    const intervals = [...Array<number>(8).fill(40), ...Array<number>(12).fill(28)];
    const statistics = computeCycleStatistics(intervals);

    expect(statistics.estimatedCycleLengthDays).toBe(28);
    expect(statistics.sampleSize).toBe(12);
    expect(statistics.spreadDays).toBe(0);
  });
});

describe('RESOLVED — tenure-lapsed produces the designed anomaly pair and keeps predictions in the future', () => {
  it('fires missed-expected-period (un-rolled expectation) plus open-cycle long-cycle', () => {
    const { prediction } = runEngine('tenure-lapsed');

    expect(prediction.anomalies).toEqual([
      {
        id: 'missed-expected-period:2026-05-26',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-05-26',
      },
      { id: 'long-cycle:2026-04-27', kind: 'long-cycle', anchorDateIso: '2026-04-27' },
    ]);
  });

  it('rolls the calendar prediction forward (nextPeriod in the future, projected-forward limitation attached)', () => {
    const { prediction } = runEngine('tenure-lapsed');

    expect(prediction.nextPeriod.startDate > TODAY).toBe(true);
    expect(prediction.nextPeriod.startDate).toBe('2026-07-23');
    expect(prediction.limitationCodes).toContain('projected-forward');
    // The rolled current-cycle view stays within one cycle of today.
    expect(prediction.current.cycleDay).toBeLessThanOrEqual(prediction.cycleLengthDays);
  });
});

describe('RESOLVED — plausibility sweep across all six tenure datasets', () => {
  const variants = [
    'tenure-1mo-new',
    'tenure-3mo-regular',
    'tenure-6mo-gap',
    'tenure-12mo-regular',
    'tenure-12mo-irregular',
    'tenure-lapsed',
  ] as const;

  it.each(variants)('%s: cycle length plausible, next period never behind today on the calendar path', (variant) => {
    const { prediction } = runEngine(variant);

    expect(prediction.cycleLengthDays).toBeGreaterThanOrEqual(20);
    expect(prediction.cycleLengthDays).toBeLessThanOrEqual(90);
    expect(prediction.current.cycleDay).toBeGreaterThanOrEqual(1);
    // Signal re-anchored predictions may legitimately sit in the recent past
    // (documented invariant on PredictionResult.nextPeriod); every calendar
    // -path variant here must stay in the future.
    if (prediction.fertileWindow.basis !== 'signal-confirmed') {
      expect(prediction.nextPeriod.startDate > TODAY).toBe(true);
    }
    // Fertile window is a coherent, correctly-ordered 6-day span.
    expect(
      diffDays(prediction.fertileWindow.startDate, prediction.fertileWindow.endDate),
    ).toBe(5);
  });

  it('tenure-12mo-regular (pill user): ovulation-signal analysis is gated by hormonal birth control', () => {
    const { prediction } = runEngine('tenure-12mo-regular');

    expect(prediction.ovulation).toEqual({ gated: 'hormonal-birth-control' });
    expect(prediction.confidence.reasonCodes).toContain('hormonal-birth-control');
    // Gated users never get a signal-confirmed fertile window.
    expect(prediction.fertileWindow.basis).toBeUndefined();
  });

  it('tenure-12mo-irregular: noisy OPK still yields a signal-confirmed window consistent with the fused ovulation estimate', () => {
    const { prediction } = runEngine('tenure-12mo-irregular');

    expect(prediction.fertileWindow.basis).toBe('signal-confirmed');
    expect(prediction.ovulation).toEqual({
      dateIso: '2026-07-07',
      uncertaintyDays: 0,
      basis: 'opk-surge',
      retrospective: false,
    });
    expect(prediction.fertileWindow.endDate).toBe('2026-07-07');
  });
});

// ─── Bug probes (current behavior asserted; SHOULD-BE in comments) ──────────

describe('FIXED LT-04 — staleness now degrades the confidence LEVEL and swaps the reason code', () => {
  it('a user who has not logged for ~70 days now reads "medium" confidence with the honest "stale-history" reason code', () => {
    const { prediction } = runEngine('tenure-lapsed');

    // FIXED: resolveConfidence now takes an `isStale` flag
    // (buildPredictionResult.ts's `isHistoryStale`, true here since the
    // anchor rolled forward >= 2 cycles for this ~70-day-silent user).
    // Instead of the dishonest "high / consistent-RECENT-bleeding-history",
    // the level degrades to medium and the reason code swaps to the new
    // `stale-history` code, which is also actionable (surfaces a "log your
    // latest period" improvement row).
    expect(prediction.confidence.level).toBe('medium');
    expect(prediction.confidence.reasonCodes).toContain('stale-history');
    expect(prediction.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
    expect(prediction.confidence.improvementCodes).toContain('stale-history');
    expect(prediction.limitationCodes).toContain('projected-forward');
  });

  it('regular, fresh-history tenure fixtures are NOT affected by the staleness fix', () => {
    // Justifies the "regular fresh fixtures must not move" constraint: none
    // of the actively-logging tenure datasets trigger isHistoryStale.
    const freshVariants = [
      'tenure-1mo-new',
      'tenure-3mo-regular',
      'tenure-12mo-regular',
    ] as const;

    for (const variant of freshVariants) {
      const { prediction } = runEngine(variant);
      expect(prediction.limitationCodes).not.toContain('projected-forward');
    }

    // tenure-12mo-regular reaches the terminal high-confidence branch and
    // still gets the original "recent" framing, unchanged.
    const { prediction: regular } = runEngine('tenure-12mo-regular');
    expect(regular.confidence.level).toBe('high');
    expect(regular.confidence.reasonCodes).toContain('consistent-recent-bleeding-history');
  });
});

describe('FIXED LT-03 — completed-interval anomalies now age out after 90 days', () => {
  it('tenure-12mo-irregular surfaces NO long-cycle backlog once both the 90-day recency cutoff and the LT-11 observed-range floor apply', () => {
    const { prediction } = runEngine('tenure-12mo-irregular');

    // FIXED: detectAnomalies now drops completed-interval short/long-cycle
    // candidates anchored more than COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS
    // (90) before today (anomalies.ts). Of the four candidates this history
    // used to surface under the OLD bound (2026-06-05: 31 days old,
    // 2026-02-08: 148 days old, 2025-11-02: 246 days old, 2025-08-31: 309
    // days old), only the 31-day-old one (2026-06-05, a 60-day interval)
    // would even survive the age cutoff on its own -- but the LT-11 fix
    // (observed-range floor for irregular-support users) ALSO raises the
    // long-cycle bound to 60 for this user (their own recurring 60-day
    // cycles are normal-for-them), so that interval no longer qualifies as
    // long either. The two fixes compound to a fully quiet result: this
    // user's whole "backlog" was either stale history or their own known
    // rhythm, not fresh signal. See the dedicated LT-11 test below for the
    // observed-range floor demonstrated in isolation (with a fresh,
    // genuinely-new-extreme interval that still fires).
    expect(prediction.anomalies).toBeUndefined();

    // Nothing to dismiss, so nothing can be "promoted" into view either --
    // this IS the fix: no stale history ever resurfaces.
    const queue = filterDismissedAnomalies(prediction.anomalies ?? [], []);
    expect(queue).toEqual([]);
  });
});

describe('FIXED LT-11 — long-cycle bound now floors at the user\'s own observed range for irregular-support users', () => {
  it('recurring 38–60 day cycles are no longer flagged long-cycle once irregular support is ON (observed-range floor)', () => {
    const { dataset, prediction } = runEngine('tenure-12mo-irregular');

    // FIXED: previously MAD rejection discarded the 45/60-day intervals from
    // the statistics, shrinking spreadDays to 2.97 and tightening the long
    // bound to min(60, 26 + max(7, 2.97)) = 33 days -- so the user's
    // genuinely recurring 38-60 day cycles all read as anomalies despite
    // opting into irregular-cycle support. The long-cycle bound now floors
    // at the user's own observed (pre-rejection) range, computed per
    // interval EXCLUDING the interval under test (collectTopTwoIntervals in
    // anomalies.ts -- the exclusion prevents a record-setting interval from
    // raising the bound to exactly itself and self-masking). For this
    // history the floor raises the bound to the 60-day cap, so none of
    // their past cycles (all covered by another interval on record) are
    // flagged anymore.
    expect(dataset.profile.supportsIrregularCycles).toBe(true);
    const longCycleAnomalies = (prediction.anomalies ?? []).filter(
      (anomaly) => anomaly.kind === 'long-cycle',
    );
    expect(longCycleAnomalies).toHaveLength(0);
  });

  // A genuinely NEW extreme still fires -- both past the 60-day hard cap
  // (70-day case) and BELOW it (prior max 45, new 55 -- caught by the
  // self-exclusion, which keeps the record-setter's own bound at the other
  // intervals' max). See `detectAnomalies -- LT-11 observed-range floor` in
  // anomalies.adversarial.test.ts for both cases demonstrated directly
  // against the pure detector with controlled ages/intervals, plus the
  // recurring-extreme (two 55s) still-quiet counterpart.
});
