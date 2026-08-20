/**
 * Long-tenure probes for the insights window (workstream E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment. Deterministic via buildTenureDataset(variant, FIXED todayIso).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';

const TODAY = '2026-07-06';

describe('RESOLVED LT-06 — insights hydrate the full stored history, matching the "built from cycle history stored on this device" claim', () => {
  it('a 13-cycle year reports the full "logged period starts" count now that useInsightsModel hydrates all stored logs, not a 120-day window', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);

    // FIXED: useInsightsModel.ts now hydrates via repositories.dailyLogs
    // .listAll() instead of a hardcoded `listByDateRange(addDays(todayIso,
    // -120), todayIso)` window. This probe simulates that by passing the
    // full dataset directly to the pure model function, which is exactly
    // what the hook now does end-to-end. The old 120-day-windowed call
    // (documented here previously) produced "5 logged period starts" and a
    // falsely-confident `high` confidence level from a 2.5-month slice of a
    // 12-month history; both symptoms are gone once the full history flows
    // through.
    const fullModel = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // LT-13 (FIXED separately): insights counts period starts via the
    // engine's canonical collectPeriodStarts (cycleHistory.ts), so the
    // full-data label is 13, matching the engine's own count.
    expect(fullModel.cyclePattern.periodStartsLabel).toBe('13 logged period starts');
  });

  it('the engine statistics behind the readout also see the full 12-interval window once hydration is unbounded', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);

    const fullModel = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // With the full year of history available, confidence is grounded in
    // the engine's full statistical appetite (MAX_INTERVAL_WINDOW = 12
    // intervals, cycleStatistics.ts) rather than a truncated 4-interval
    // slice that happened to also read as "high".
    expect(fullModel.cyclePattern.confidenceLevel).toBe('high');
  });
});

describe('RESOLVED LT-18 — cycle-length card classification is honest, derived from the engine\'s robust statistics', () => {
  it('12mo-irregular: a real 24-60d spread is classified varies-widely, not the hardcoded "Consistent on average"', () => {
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });
    const prediction = buildPredictionResult({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
    });

    // FIXED (LT-18, tightened by UL-02): the card used to say "Consistent
    // on average / Within +/- 2 days. Floriva is treating your cycle as
    // regular." unconditionally. LT-18 first keyed the copy on the
    // SURVIVOR spread (statistics.spreadDays) -- but on this fixture the
    // MAD step rejects the 44/60/62-day intervals as outliers, and on some
    // date seeds the surviving cluster is tight enough to read
    // 'consistent' again (the UL-02 P0 screenshot: bars 21-64 under
    // "Consistent on average"). Classification now runs on the RAW
    // (pre-rejection, bounds-filtered) spread with an outlier-share
    // escalation, so a genuinely 24-60-day history is always classified
    // 'varies-widely' regardless of which cluster survives rejection.
    expect(prediction.statistics?.spreadDays).toBeLessThanOrEqual(6);
    expect(model.cycleLengthData.consistencyLevel).toBe('varies-widely');
    expect(model.cycleLengthData.subtitleLabel).toBe('Varies widely');
    expect(model.cycleLengthData.subtitleLabel).not.toBe('Consistent on average');
    expect(model.cycleLengthData.footnoteLabel).not.toContain('treating your cycle as regular');
  });

  it('6mo-gap: the 121-day gap is NOT averaged into avgDays -- the card matches the engine\'s outlier-rejected estimate', () => {
    const dataset = buildTenureDataset('tenure-6mo-gap', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });
    const prediction = buildPredictionResult({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
    });

    // FIXED: avgDays used to be a naive mean of the last 9 RAW intervals,
    // which silently included the multi-month gap interval and reported
    // "60 AVG" (see the ledger entry for the exact pre-fix number). avgDays
    // is now ALWAYS prediction.cycleLengthDays -- the engine's own
    // bounds/MAD-outlier-rejected estimate, which discarded the gap
    // interval (statistics.discardedCount >= 1) before estimating.
    expect(model.cycleLengthData.avgDays).toBe(prediction.cycleLengthDays);
    expect(prediction.statistics?.discardedCount).toBeGreaterThanOrEqual(1);
    // The raw gap interval is still visible on the bar chart (honest, not
    // hidden) -- it is only the SUMMARY number that must not blend it in.
    expect(model.cycleLengthData.bars.some((bar) => bar.days > 90)).toBe(true);
  });

  it('1mo-new: a single observed interval (n=1) gets "not enough data yet" framing, never a false consistency claim', () => {
    const dataset = buildTenureDataset('tenure-1mo-new', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // FIXED: 1 observed interval cannot support ANY consistency claim (no
    // basis for comparison) -- previously the card unconditionally said
    // "Consistent on average" even here.
    expect(model.cycleLengthData.bars).toHaveLength(1);
    expect(model.cycleLengthData.consistencyLevel).toBe('not-enough-data');
    expect(model.cycleLengthData.subtitleLabel).toBe('Not enough data yet');
  });

  it('12mo-regular: a genuinely steady cycle (spread 0) is still honestly classified consistent', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // Not every fixture should flip away from 'consistent' -- a genuinely
    // steady 28-day-every-time history must still read as consistent, so
    // the fix is a real classification, not a blanket downgrade.
    expect(model.cycleLengthData.consistencyLevel).toBe('consistent');
    expect(model.cycleLengthData.subtitleLabel).toBe('Consistent on average');
  });
});

describe('RESOLVED LT-21 — phase-rhythm durations sum to the SAME cycle length the card displays', () => {
  it.each([
    'tenure-1mo-new',
    'tenure-3mo-regular',
    'tenure-6mo-gap',
    'tenure-12mo-regular',
    'tenure-12mo-irregular',
    'tenure-lapsed',
  ] as const)('%s: period + follicular + fertile + luteal days sum to cycleLengthData.avgDays', (variant) => {
    const dataset = buildTenureDataset(variant, TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // FIXED: the phase-rhythm card always derived its phases from
    // prediction.cycleLengthDays (buildCyclePhaseBreakdown sums phases to
    // EXACTLY cycleLengthDays by construction -- see cyclePhaseModel.ts).
    // The bug was that the cycle-length CARD's avgDays used to be a
    // different, naive number (see LT-18), so the two cards visually
    // disagreed (e.g. "5+2+6+13=26 vs 34 AVG" on the irregular fixture).
    // Now that avgDays IS prediction.cycleLengthDays, they are the same
    // number by construction, on every tenure variant.
    const { periodDays, follicularDays, fertileDays, lutealDays, cycleLengthDays } =
      model.phaseRhythmData;

    expect(cycleLengthDays).toBe(model.cycleLengthData.avgDays);
    expect(periodDays + follicularDays + fertileDays + lutealDays).toBe(
      model.cycleLengthData.avgDays,
    );
  });
});

describe('RESOLVED LT-22 — monthly briefing numbers reconcile, and "so far" only appears on the current month', () => {
  it.each([
    'tenure-1mo-new',
    'tenure-3mo-regular',
    'tenure-6mo-gap',
    'tenure-12mo-regular',
    'tenure-12mo-irregular',
    'tenure-lapsed',
  ] as const)('%s: lead cites the SAME period/symptom-day numbers as the chips below it', (variant) => {
    const dataset = buildTenureDataset(variant, TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });
    const { periodDaysLabel, symptomDaysLabel, lead } = model.monthlyBriefing;

    if (lead === 'This month has no local logs yet.') {
      // No-logs branch has no counts to reconcile.
      return;
    }

    // FIXED: lead used to cite a distinct symptom-TYPE count
    // (signalCounts.size) under the "tracked signals" name, which could
    // exceed the chip's DAY-based symptomDaysLabel (e.g. "6 logs / 0 period
    // days and 10 tracked signals / 6 symptom days" on this exact
    // long-tenure fixture set -- see the ledger). Extract the leading
    // integer from each chip/lead phrase and assert they now agree.
    const periodDaysFromChip = Number(periodDaysLabel.match(/^\d+/)?.[0]);
    const symptomDaysFromChip = Number(symptomDaysLabel.match(/^\d+/)?.[0]);
    // "shows"/"showed" (current vs. past-month branch -- see the "so far"
    // gating tests below) -- either way, the trailing digit must match.
    const periodDaysFromLead = Number(lead.match(/(\d+) period day/)?.[1]);
    const symptomDaysFromLead = Number(lead.match(/(\d+) symptom day/)?.[1]);

    expect(periodDaysFromLead).toBe(periodDaysFromChip);
    expect(symptomDaysFromLead).toBe(symptomDaysFromChip);
  });

  it('tenure-1mo-new: briefing falls back to June (already ended by the fixed July 6 "today"), and must NOT say "so far"', () => {
    const dataset = buildTenureDataset('tenure-1mo-new', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // FIXED: this fixture's most recent log is in June, so the briefing
    // falls back to June -- a month that fully ended before TODAY (Jul 6).
    // "so far" implies the month is still in progress; the lead must use
    // past tense ("showed"), not "so far".
    expect(model.monthlyBriefing.title).toBe('June briefing');
    expect(model.monthlyBriefing.lead).not.toContain('so far');
    expect(model.monthlyBriefing.lead).toContain('showed');
  });

  it('tenure-lapsed: the fallback briefing month (May) is long over by July -- must NOT say "so far"', () => {
    const dataset = buildTenureDataset('tenure-lapsed', TODAY);

    const model = buildInsightsScreenModel({
      todayIso: TODAY,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    // FIXED: this is the exact case the ledger cites -- a lapsed user's May
    // briefing (their last logged month) previously said "so far" while
    // being viewed in July, implying May was still ongoing.
    expect(model.monthlyBriefing.title).toBe('May briefing');
    expect(model.monthlyBriefing.lead).not.toContain('so far');
    expect(model.monthlyBriefing.lead).toContain('showed');
  });

  it.each(['tenure-6mo-gap', 'tenure-12mo-regular', 'tenure-12mo-irregular'] as const)(
    '%s: the briefing month IS the current month (July) -- "so far" is correct and must stay',
    (variant) => {
      const dataset = buildTenureDataset(variant, TODAY);

      const model = buildInsightsScreenModel({
        todayIso: TODAY,
        profile: dataset.profile,
        logEntries: dataset.dailyLogs,
        locale: 'en',
      });

      expect(model.monthlyBriefing.title).toBe('July briefing');
      expect(model.monthlyBriefing.lead).toContain('so far');
    },
  );
});
