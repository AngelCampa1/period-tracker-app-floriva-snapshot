/**
 * A4 orchestrator-wiring tests: buildPredictionResult with TTC ovulation
 * signals present. Complements buildPredictionResult.test.ts (bleeding-only
 * histories, unaffected by this slice) and goldenCharacterization.test.ts
 * (which pins that TTC-less outputs are byte-identical post-wiring).
 *
 * Fixture convention: cycles are built with `buildCycleFixture` (bleeding on
 * day 0 only, TTC observations layered in per-cycle) so period starts land
 * exactly at each cycle's `cycleStartIso`.
 */

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays } from '@/src/lib/predictions/dateMath';
import type { UserProfile } from '@/src/types/domain';
import { buildCycleFixture } from '@/tests/lib/predictions/fixtures';

const TTC_PROFILE: UserProfile = {
  goals: ['trying-to-conceive'],
  supportsIrregularCycles: false,
  conditionTags: [],
  cycleLengthDays: 28,
  periodLengthDays: 5,
};

describe('buildPredictionResult -- ovulation-signal wiring', () => {
  it('re-anchors nextPeriod and confirms a signal-confirmed fertile window for a biphasic BBT current cycle', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const ovulationDateIso = addDays(cycleStart, 9); // shift index 10 -> ovulation = shift - 1

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'bbt-shift',
      retrospective: true,
    });
    expect(result.fertileWindow).toEqual({
      startDate: addDays(ovulationDateIso, -5),
      endDate: ovulationDateIso,
      basis: 'signal-confirmed',
    });
    // Unlearned (< 2 confirmed historical cycles) -> default 14-day luteal.
    expect(result.nextPeriod.startDate).toBe(addDays(ovulationDateIso, 14));
  });

  it('does not re-anchor when the retrospective BBT window has not opened yet as of today', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const ovulationDateIso = addDays(cycleStart, 9);
    const beforeWindowOpens = addDays(ovulationDateIso, -6);

    const result = buildPredictionResult({
      todayIso: beforeWindowOpens,
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toBeUndefined();
    expect(result.fertileWindow.basis).toBeUndefined();
    // Falls back to the plain calendar formula.
    expect(result.fertileWindow.startDate).toBe(addDays(result.nextPeriod.startDate, -19));
  });

  it('opens a prospective fertile window from an OPK-peak signal even before ovulation day', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });
    const ovulationDateIso = addDays(cycleStart, 13);

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'opk-surge',
      retrospective: false,
    });
    expect(result.fertileWindow).toEqual({
      startDate: addDays(ovulationDateIso, -5),
      endDate: ovulationDateIso,
      basis: 'signal-confirmed',
    });
    expect(result.nextPeriod.startDate).toBe(addDays(ovulationDateIso, 14));
  });

  it('carries signalsDisagree through to the ovulation field on a fusion conflict', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'biphasic',
      opk: 'positive-only',
    });
    const bbtOvulationDateIso = addDays(cycleStart, 9);

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 20),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({
      dateIso: bbtOvulationDateIso,
      // Conflict path widens uncertainty to the full span across estimates:
      // |OPK offset 13 - BBT offset 9| = 4 days (deterministic, see
      // fuseOvulationEstimate.ts step 3b).
      uncertaintyDays: 4,
      basis: 'fused',
      signalsDisagree: true,
      retrospective: true,
    });
  });

  it('keeps the plain calendar fertile window and next-period math when sparse data yields no detectable signals at all', () => {
    // Sparse BBT never establishes a coverline and sparse mucus never gets a
    // dry-up, so both detectors return null and fusion short-circuits on "no
    // signals present" -- the no-signal calendar-fallback path. A GENUINE
    // plausibility-clamp failure (a real detected shift rejected by the
    // clamp) is covered in ovulationAnalysis.test.ts; the orchestrator
    // treats both identically (undefined -> calendar math), which is what
    // this test pins end-to-end.
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'sparse',
      mucus: 'sparse',
    });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toBeUndefined();
    expect(result.fertileWindow.basis).toBeUndefined();
    expect(result.fertileWindow.startDate).toBe(addDays(result.nextPeriod.startDate, -19));
    expect(result.fertileWindow.endDate).toBe(addDays(result.nextPeriod.startDate, -14));
    expect(result.nextPeriod.startDate).toBe(addDays(cycleStart, 28));
  });

  it('gates all signal refinement for a hormonal birth-control method (pill), even with a clean biphasic BBT signal', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart, birthControlMethod: 'pill' },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({ gated: 'hormonal-birth-control' });
    expect(result.fertileWindow.basis).toBeUndefined();
    expect(result.fertileWindow.startDate).toBe(addDays(result.nextPeriod.startDate, -19));
    expect(result.nextPeriod.startDate).toBe(addDays(cycleStart, 28));
  });

  it('gates an IUD with an unspecified sub-type (safe default)', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart, birthControlMethod: 'iud' },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({ gated: 'hormonal-birth-control' });
  });

  it('gates a hormonal IUD', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: {
        ...TTC_PROFILE,
        lastPeriodStartDate: cycleStart,
        birthControlMethod: 'iud',
        iudType: 'hormonal',
      },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({ gated: 'hormonal-birth-control' });
  });

  it('does NOT gate a copper IUD -- it gets the same signal refinement as an unmedicated cycle', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });
    const ovulationDateIso = addDays(cycleStart, 13);

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: {
        ...TTC_PROFILE,
        lastPeriodStartDate: cycleStart,
        birthControlMethod: 'iud',
        iudType: 'copper',
      },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'opk-surge',
      retrospective: false,
    });
  });

  it('does NOT gate for "other" birth-control method', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });
    const ovulationDateIso = addDays(cycleStart, 13);

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart, birthControlMethod: 'other' },
      logEntries: entries,
    });

    expect(result.ovulation).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'opk-surge',
      retrospective: false,
    });
  });

  it('still learns luteal length from historical (pre-BC) cycles even though the current cycle is gated', () => {
    // Two historical cycles (no birth control logged then) teach a learned
    // luteal length of 11 days; the user then started the pill for the
    // CURRENT cycle. Learning must still run (it's independent of the
    // current-cycle gate -- see buildPredictionResult.ts's own comment on
    // this), even though the gated current cycle can't use it to re-anchor.
    const c1Start = '2026-01-01';
    const c1OvulationDateIso = addDays(c1Start, 9);
    const c2Start = addDays(c1OvulationDateIso, 11);
    const c1 = buildCycleFixture({ cycleStartIso: c1Start, cycleLengthDays: 20, bbt: 'biphasic' });
    const c2OvulationDateIso = addDays(c2Start, 9);
    const c3Start = addDays(c2OvulationDateIso, 11);
    const c2 = buildCycleFixture({ cycleStartIso: c2Start, cycleLengthDays: 20, bbt: 'biphasic' });
    // Current (open, gated) cycle: pill started, so no signal refinement.
    const c3 = buildCycleFixture({ cycleStartIso: c3Start, cycleLengthDays: 28, bbt: 'biphasic' });

    const result = buildPredictionResult({
      todayIso: addDays(c3Start, 15),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: c1Start, birthControlMethod: 'pill' },
      logEntries: [...c1, ...c2, ...c3],
    });

    expect(result.ovulation).toEqual({ gated: 'hormonal-birth-control' });
    // Current cycle stays on the plain calendar formula since it's gated --
    // the learned luteal length has nowhere to apply this cycle, but
    // learning itself was not skipped (this only asserts the gated outcome
    // doesn't crash/short-circuit the learning step; see
    // ovulationAnalysis.test.ts for direct learning-input coverage). The
    // calendar formula uses the engine's resolved cycleLengthDays (~20, from
    // the two 20-day historical intervals), not the 28-day fixture length.
    expect(result.nextPeriod.startDate).toBe(addDays(c3Start, result.cycleLengthDays));
  });

  it('learns luteal length from >=2 confirmed historical cycles and re-anchors the CURRENT cycle prediction with it', () => {
    // Two historical (completed) cycles with confirmed BBT ovulations,
    // luteal length 11 days both times (< default 14) -> learned length 11.
    // Each historical cycle's OWN cycleLengthDays is set to exactly match the
    // real gap to the next cycle's start (ovulation day 10 [index 9] + 11
    // luteal days = 20 days) so the fixtures' entry ranges don't overlap --
    // buildCycleFixture always emits a full cycleLengthDays of entries, so an
    // under-length cycleLengthDays here would leave a same-date collision
    // with the next cycle's own entries once both are merged and re-sliced.
    const c1Start = '2026-01-01';
    const c1OvulationDateIso = addDays(c1Start, 9);
    const c2Start = addDays(c1OvulationDateIso, 11); // c1Start + 20
    const c1 = buildCycleFixture({ cycleStartIso: c1Start, cycleLengthDays: 20, bbt: 'biphasic' });
    const c2OvulationDateIso = addDays(c2Start, 9);
    const c3Start = addDays(c2OvulationDateIso, 11); // c2Start + 20
    const c2 = buildCycleFixture({ cycleStartIso: c2Start, cycleLengthDays: 20, bbt: 'biphasic' });
    // Current (open) cycle: also biphasic BBT, confirmed ovulation at +9. Full
    // 28-day length since nothing follows it to overlap with.
    const c3 = buildCycleFixture({ cycleStartIso: c3Start, cycleLengthDays: 28, bbt: 'biphasic' });
    const c3OvulationDateIso = addDays(c3Start, 9);

    // The engine's resolved cycleLengthDays comes from the two 20-day
    // historical intervals above, so `todayIso` must stay within one
    // 20-day cycle of c3Start -- otherwise the anchor-roll-forward logic
    // (buildPredictionResult.ts) legitimately advances past this cycle
    // entirely, same as it would for a real user whose logged history
    // doesn't cover "today". Day 15 keeps us inside the resolved 20-day
    // cycle while still being solidly past the confirmed ovulation (day 10).
    const result = buildPredictionResult({
      todayIso: addDays(c3Start, 15),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: c1Start },
      logEntries: [...c1, ...c2, ...c3],
    });

    expect(result.ovulation?.gated).toBeUndefined();
    expect(result.nextPeriod.startDate).toBe(addDays(c3OvulationDateIso, 11));
  });
});

describe('buildPredictionResult -- A5 ovulation-derived confidence reason codes', () => {
  it('appends hormonal-birth-control to reasonCodes when ovulation is gated, without changing confidence.level', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });

    const gated = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart, birthControlMethod: 'pill' },
      logEntries: entries,
    });
    const ungated = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(gated.ovulation).toEqual({ gated: 'hormonal-birth-control' });
    expect(gated.confidence.reasonCodes).toContain('hormonal-birth-control');
    // Same base reasonCodes/level as the otherwise-identical ungated run --
    // only the appended ovulation code differs.
    expect(gated.confidence.level).toBe(ungated.confidence.level);
    expect(gated.confidence.reasonCodes[0]).toBe(ungated.confidence.reasonCodes[0]);
  });

  it('appends signals-disagree to reasonCodes on a fusion conflict, without changing confidence.level', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'biphasic',
      opk: 'positive-only',
    });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 20),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toMatchObject({ signalsDisagree: true });
    expect(result.confidence.reasonCodes).toContain('signals-disagree');
    expect(result.confidence.reasonCodes).not.toContain('ovulation-signal-confirmed');
    expect(result.confidence.reasonCodes).not.toContain('hormonal-birth-control');
  });

  it('appends ovulation-signal-confirmed to reasonCodes when a populated, agreeing signal estimate exists, without changing confidence.level', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });

    const withSignal = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(withSignal.ovulation).toMatchObject({ basis: 'opk-surge' });
    expect(withSignal.ovulation).not.toMatchObject({ signalsDisagree: true });
    expect(withSignal.confidence.reasonCodes).toContain('ovulation-signal-confirmed');
    expect(withSignal.confidence.reasonCodes).not.toContain('signals-disagree');
    expect(withSignal.confidence.reasonCodes).not.toContain('hormonal-birth-control');
  });

  it('appends no ovulation-derived code when there is no signal data at all (calendar fallback)', () => {
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'sparse',
      mucus: 'sparse',
    });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 25),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: cycleStart },
      logEntries: entries,
    });

    expect(result.ovulation).toBeUndefined();
    expect(result.confidence.reasonCodes).not.toContain('hormonal-birth-control');
    expect(result.confidence.reasonCodes).not.toContain('signals-disagree');
    expect(result.confidence.reasonCodes).not.toContain('ovulation-signal-confirmed');
  });

  it('is mutually exclusive: hormonal-birth-control and signals-disagree can never appear together, across regular and irregular-mode profiles', () => {
    // hormonal-birth-control gates ALL signal detection (ovulationAnalysis.ts
    // returns `{ gated: 'hormonal-birth-control' }` with no signal fields at
    // all), so `signalsDisagree` -- which requires a populated, non-gated
    // fused estimate -- can never also be true. Proven here for both a
    // regular and an irregular-mode profile, since irregular-mode's level
    // cap is a wholly separate code path from the ovulation gate.
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'biphasic',
      opk: 'positive-only',
    });

    for (const supportsIrregularCycles of [false, true]) {
      const result = buildPredictionResult({
        todayIso: addDays(cycleStart, 20),
        profile: {
          ...TTC_PROFILE,
          lastPeriodStartDate: cycleStart,
          birthControlMethod: 'pill',
          supportsIrregularCycles,
        },
        logEntries: entries,
      });

      expect(result.confidence.reasonCodes).toContain('hormonal-birth-control');
      expect(result.confidence.reasonCodes).not.toContain('signals-disagree');
    }
  });

  it('never lets the ovulation-derived codes change confidence.level for an irregular-mode profile (level cap stays medium)', () => {
    // A second (historical, signal-free) cycle is layered in ahead of the
    // current cycle purely to get periodStartCount to 2+ -- resolveConfidence
    // checks `periodStartCount < 2` (-> low, 'limited-bleeding-history')
    // BEFORE it ever looks at `supportsIrregularCycles`, so a single-cycle
    // fixture would never reach the irregular-cycle branch this test targets.
    const priorCycleStart = '2026-01-01';
    const priorCycle = buildCycleFixture({ cycleStartIso: priorCycleStart, cycleLengthDays: 28 });
    const cycleStart = '2026-03-01';
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });

    const result = buildPredictionResult({
      todayIso: addDays(cycleStart, 12),
      profile: { ...TTC_PROFILE, lastPeriodStartDate: priorCycleStart, supportsIrregularCycles: true },
      logEntries: [...priorCycle, ...entries],
    });

    expect(result.confidence.reasonCodes).toContain('ovulation-signal-confirmed');
    // Irregular-cycle support caps the level at medium regardless of the
    // ovulation-signal-confirmed code being present.
    expect(result.confidence.level).toBe('medium');
  });
});
