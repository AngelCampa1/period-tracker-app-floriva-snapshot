/**
 * Tests for the A4 per-cycle ovulation-signal orchestration module (see
 * src/lib/predictions/ovulationAnalysis.ts).
 *
 * Covers, in order:
 * 1. `sliceCyclesIntoPeriods` -- splitting a full DailyLogEntry[] history into
 *    single-cycle slices at period-start boundaries (the detectors' REQUIRED
 *    single-cycle caller contract).
 * 2. `resolveHormonalBirthControlGate` -- which birth-control methods gate.
 * 3. `buildLutealLearningInput` -- pairing each historical cycle's confirmed
 *    ovulation with the NEXT cycle's period start.
 * 4. `analyzeCurrentCycleOvulation` -- fusion + retrospective discipline +
 *    plausibility/gating for the OPEN (current) cycle.
 */

import { addDays } from '@/src/lib/predictions/dateMath';
import {
  analyzeCurrentCycleOvulation,
  buildLutealLearningInput,
  resolveHormonalBirthControlGate,
  sliceCyclesIntoPeriods,
} from '@/src/lib/predictions/ovulationAnalysis';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';
import { buildBbtEntry, buildCycleFixture } from '@/tests/lib/predictions/fixtures';

function createLogEntry(
  logDate: string,
  bleeding: DailyLogEntry['bleeding'],
  overrides: Partial<DailyLogEntry> = {},
): DailyLogEntry {
  return {
    id: `${logDate}-${bleeding}`,
    logDate,
    bleeding,
    symptoms: [],
    ...overrides,
  };
}

const BASE_PROFILE: UserProfile = {
  goals: ['trying-to-conceive'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

describe('sliceCyclesIntoPeriods', () => {
  it('slices entries into one segment per period start, each running up to (not including) the next start', () => {
    const entries = [
      ...buildCycleFixture({ cycleStartIso: '2026-01-01', cycleLengthDays: 28 }),
      ...buildCycleFixture({ cycleStartIso: '2026-01-29', cycleLengthDays: 30 }),
    ];

    const slices = sliceCyclesIntoPeriods(entries, ['2026-01-01', '2026-01-29']);

    expect(slices).toHaveLength(2);
    expect(slices[0]!.startDate).toBe('2026-01-01');
    expect(slices[0]!.isComplete).toBe(true);
    expect(slices[0]!.entries).toHaveLength(28);
    expect(slices[0]!.entries.every((e) => e.logDate < '2026-01-29')).toBe(true);

    expect(slices[1]!.startDate).toBe('2026-01-29');
    // Last period start -> the OPEN (current) cycle, not complete.
    expect(slices[1]!.isComplete).toBe(false);
    expect(slices[1]!.entries).toHaveLength(30);
  });

  it('returns an empty array when there are no period starts', () => {
    expect(sliceCyclesIntoPeriods([], [])).toEqual([]);
  });

  it('excludes entries logged before the first period start', () => {
    const entries = [
      createLogEntry('2025-12-15', 'none'),
      ...buildCycleFixture({ cycleStartIso: '2026-01-01', cycleLengthDays: 10 }),
    ];

    const slices = sliceCyclesIntoPeriods(entries, ['2026-01-01']);

    expect(slices).toHaveLength(1);
    expect(slices[0]!.entries.some((e) => e.logDate === '2025-12-15')).toBe(false);
  });

  it('handles a single period start as one open (incomplete) cycle', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-02-01', cycleLengthDays: 15 });
    const slices = sliceCyclesIntoPeriods(entries, ['2026-02-01']);

    expect(slices).toHaveLength(1);
    expect(slices[0]!.isComplete).toBe(false);
  });
});

describe('resolveHormonalBirthControlGate', () => {
  it('does not gate when no birth-control method is set', () => {
    expect(resolveHormonalBirthControlGate(BASE_PROFILE)).toEqual({ gated: false });
  });

  it.each(['pill', 'implant', 'ring', 'patch'] as const)(
    'gates for unambiguously hormonal method: %s',
    (method) => {
      const profile: UserProfile = { ...BASE_PROFILE, birthControlMethod: method };
      expect(resolveHormonalBirthControlGate(profile)).toEqual({
        gated: true,
        reason: 'hormonal-birth-control',
      });
    },
  );

  it('gates for a hormonal IUD', () => {
    const profile: UserProfile = {
      ...BASE_PROFILE,
      birthControlMethod: 'iud',
      iudType: 'hormonal',
    };
    expect(resolveHormonalBirthControlGate(profile)).toEqual({
      gated: true,
      reason: 'hormonal-birth-control',
    });
  });

  it('gates for an IUD with an unspecified sub-type (safe default)', () => {
    const profile: UserProfile = { ...BASE_PROFILE, birthControlMethod: 'iud' };
    expect(resolveHormonalBirthControlGate(profile)).toEqual({
      gated: true,
      reason: 'hormonal-birth-control',
    });
  });

  it('does NOT gate for a copper IUD (does not suppress ovulation)', () => {
    const profile: UserProfile = {
      ...BASE_PROFILE,
      birthControlMethod: 'iud',
      iudType: 'copper',
    };
    expect(resolveHormonalBirthControlGate(profile)).toEqual({ gated: false });
  });

  it('ignores iudType when the method is not an IUD', () => {
    const profile: UserProfile = {
      ...BASE_PROFILE,
      birthControlMethod: 'pill',
      // A stale copper sub-type must never ungate a genuinely hormonal method.
      iudType: 'copper',
    };
    expect(resolveHormonalBirthControlGate(profile)).toEqual({
      gated: true,
      reason: 'hormonal-birth-control',
    });
  });

  it('does not gate for "other" -- an unspecified, non-hormonal-confirmed method', () => {
    const profile: UserProfile = { ...BASE_PROFILE, birthControlMethod: 'other' };
    expect(resolveHormonalBirthControlGate(profile)).toEqual({ gated: false });
  });
});

describe('buildLutealLearningInput', () => {
  it('pairs a completed cycle confirmed ovulation with the NEXT cycle start', () => {
    // Cycle 1: biphasic BBT -> confirmed ovulation at day 11 (index 10).
    // Shift day = cycleStart + 10, ovulation = shift - 1 = cycleStart + 9.
    const cycle1 = buildCycleFixture({
      cycleStartIso: '2026-01-01',
      cycleLengthDays: 28,
      bbt: 'biphasic',
    });
    const cycle2Start = '2026-01-29';
    const cycle2 = buildCycleFixture({ cycleStartIso: cycle2Start, cycleLengthDays: 28 });

    const slices = sliceCyclesIntoPeriods([...cycle1, ...cycle2], ['2026-01-01', cycle2Start]);

    const result = buildLutealLearningInput(slices);

    expect(result).toHaveLength(1);
    expect(result[0]!.ovulationDateIso).toBe(addDays('2026-01-01', 9));
    expect(result[0]!.nextPeriodStartIso).toBe(cycle2Start);
    expect(result[0]!.uncertaintyDays).toBe(0);
  });

  it('produces no pairing when the last cycle in a completed pair has no confirmed ovulation', () => {
    const cycle1 = buildCycleFixture({ cycleStartIso: '2026-01-01', cycleLengthDays: 28 }); // no TTC signals
    const cycle2Start = '2026-01-29';
    const cycle2 = buildCycleFixture({ cycleStartIso: cycle2Start, cycleLengthDays: 28 });

    const slices = sliceCyclesIntoPeriods([...cycle1, ...cycle2], ['2026-01-01', cycle2Start]);
    const result = buildLutealLearningInput(slices);

    expect(result).toEqual([]);
  });

  it('never pairs the OPEN (current/last) cycle as the historical side, even if it has a confirmed ovulation', () => {
    // Only one cycle -> it is the open cycle -> nothing to pair against a
    // "next" period start.
    const onlyCycle = buildCycleFixture({
      cycleStartIso: '2026-01-01',
      cycleLengthDays: 28,
      bbt: 'biphasic',
    });
    const slices = sliceCyclesIntoPeriods(onlyCycle, ['2026-01-01']);

    expect(buildLutealLearningInput(slices)).toEqual([]);
  });

  it('pairs multiple completed cycles independently across a 3-cycle history', () => {
    const c1Start = '2026-01-01';
    const c2Start = '2026-01-29'; // c1 length 28
    const c3Start = '2026-02-28'; // c2 length 30
    const cycle1 = buildCycleFixture({ cycleStartIso: c1Start, cycleLengthDays: 28, bbt: 'biphasic' });
    const cycle2 = buildCycleFixture({ cycleStartIso: c2Start, cycleLengthDays: 30, bbt: 'biphasic' });
    const cycle3 = buildCycleFixture({ cycleStartIso: c3Start, cycleLengthDays: 28 }); // open, no signals needed

    const slices = sliceCyclesIntoPeriods(
      [...cycle1, ...cycle2, ...cycle3],
      [c1Start, c2Start, c3Start],
    );
    const result = buildLutealLearningInput(slices);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      ovulationDateIso: addDays(c1Start, 9),
      nextPeriodStartIso: c2Start,
      uncertaintyDays: 0,
    });
    expect(result[1]).toEqual({
      ovulationDateIso: addDays(c2Start, 9),
      nextPeriodStartIso: c3Start,
      uncertaintyDays: 0,
    });
  });

  it('does not pair when the confirmed ovulation fails the single-cycle plausibility clamp', () => {
    // A cycle whose BBT shift lands too close to the end to pass the fusion
    // plausibility clamp: shift index 10 -> ovulation day 10 (index 9, day
    // 10 of the cycle). With a very short 15-day cycle, ceiling cycle day =
    // 15 - 7 = 8, so ovulation cycle day 10 fails the clamp -> no confirmed
    // ovulation -> no pairing.
    const cycle1 = buildCycleFixture({ cycleStartIso: '2026-01-01', cycleLengthDays: 15, bbt: 'biphasic' });
    const cycle2Start = '2026-01-16';
    const cycle2 = buildCycleFixture({ cycleStartIso: cycle2Start, cycleLengthDays: 28 });

    const slices = sliceCyclesIntoPeriods([...cycle1, ...cycle2], ['2026-01-01', cycle2Start]);
    expect(buildLutealLearningInput(slices)).toEqual([]);
  });

  it('does not pair a historical cycle whose only signal is too uncertain to trust (mucus-only, +/-2 days)', () => {
    // Mucus is the only signal in cycle1 -- its uncertaintyDays (2) exceeds
    // the 1-day trust threshold this module applies before ever handing a
    // confirmation to lutealLearning (mirrors lutealLearning.ts's own guard).
    const cycle1 = buildCycleFixture({
      cycleStartIso: '2026-01-01',
      cycleLengthDays: 28,
      mucus: 'clear-peak',
    });
    const cycle2Start = '2026-01-29';
    const cycle2 = buildCycleFixture({ cycleStartIso: cycle2Start, cycleLengthDays: 28 });

    const slices = sliceCyclesIntoPeriods([...cycle1, ...cycle2], ['2026-01-01', cycle2Start]);
    expect(buildLutealLearningInput(slices)).toEqual([]);
  });
});

describe('analyzeCurrentCycleOvulation', () => {
  const cycleStart = '2026-03-01';

  it('returns gated when the profile uses a hormonal birth-control method, regardless of signals', () => {
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const profile: UserProfile = { ...BASE_PROFILE, birthControlMethod: 'pill' };

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 20),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile,
    });

    expect(result).toEqual({ gated: 'hormonal-birth-control' });
  });

  it('returns undefined (calendar fallback) when no signals are present', () => {
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28 });

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 20),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toBeUndefined();
  });

  it('confirms a retrospective BBT-only ovulation when today is already past the fertile window it implies', () => {
    // Biphasic shift at day 11 -> ovulation day 10 (index 9). Today is well
    // past the implied fertile window ([ov-5, ov]).
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const ovulationDateIso = addDays(cycleStart, 9);

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 25),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'bbt-shift',
      retrospective: true,
    });
  });

  it('retrospective discipline: a BBT-only signal must NOT open a fertile window that starts in the future', () => {
    // Simulate "today" landing WITHIN what would be the fertile window (i.e.
    // ov date is still in the future relative to today) -- BBT literally
    // cannot detect this yet (it needs 3 post-ovulation days), but this test
    // pins the discipline directly against the analysis function's contract:
    // even if a BBT signal is (hypothetically) computed with an ovulation
    // date in the future, the analysis must decline to surface it
    // prospectively.
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const ovulationDateIso = addDays(cycleStart, 9);
    // "Today" is set BEFORE the fertile window would open (ov - 5).
    const beforeWindowOpens = addDays(ovulationDateIso, -6);

    const result = analyzeCurrentCycleOvulation({
      todayIso: beforeWindowOpens,
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    // BBT detection itself requires 3 days of post-shift readings that are
    // already logged in the fixture, so the signal is technically detectable
    // "today" in this synthetic scenario -- but retrospective discipline
    // must still refuse to open the (still fully future) fertile window.
    expect(result).toBeUndefined();
  });

  it('allows a retrospective BBT confirmation to stand when today lands inside the implied fertile window', () => {
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'biphasic' });
    const ovulationDateIso = addDays(cycleStart, 9);
    // Today = ovulation day itself: inside [ov-5, ov], not before it opens.
    const result = analyzeCurrentCycleOvulation({
      todayIso: ovulationDateIso,
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'bbt-shift',
      retrospective: true,
    });
  });

  it('surfaces a prospective OPK-peak estimate even when today is before the estimated ovulation day', () => {
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, opk: 'peak-only' });
    // opk peak-only: peak logged at day index 12 -> ovulation = peak + 1.
    const ovulationDateIso = addDays(cycleStart, 13);

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 12),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 0,
      basis: 'opk-surge',
      retrospective: false,
    });
  });

  it('surfaces a prospective mucus-peak estimate', () => {
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, mucus: 'clear-peak' });
    const ovulationDateIso = addDays(cycleStart, 11); // last egg-white day before dry-up

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 12),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toEqual({
      dateIso: ovulationDateIso,
      uncertaintyDays: 2,
      basis: 'mucus-peak',
      retrospective: false,
    });
  });

  it('surfaces a fused estimate with basis "fused" and carries signalsDisagree through on conflict', () => {
    // OPK positive-only at day 12 (index 11) -> ovulation day 13 (index 12).
    // BBT biphasic shift at index 10 -> ovulation day 10 (index 9). Gap = 3
    // days >= 2 -> conflict; BBT anchors; signalsDisagree: true.
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'biphasic',
      opk: 'positive-only',
    });
    const bbtOvulationDateIso = addDays(cycleStart, 9);

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 20),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toEqual({
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

  it('returns undefined when sparse data yields NO detectable signals at all (fusion never runs)', () => {
    // Sparse BBT never establishes a coverline; sparse mucus never gets a
    // dry-up -- both detectors return null -- so with no OPK either, fusion
    // short-circuits on "no signals present". This is the no-signal
    // calendar-fallback path, NOT the plausibility clamp (see the next test
    // for a genuine clamp failure).
    const entries = buildCycleFixture({ cycleStartIso: cycleStart, cycleLengthDays: 28, bbt: 'sparse', mucus: 'sparse' });

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 25),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toBeUndefined();
  });

  it('falls back to calendar (undefined) when a genuinely detected BBT shift fails the plausibility clamp', () => {
    // Hand-built BBT curve: 6 low baseline days (indexes 0-5, enough for a
    // Marshall coverline) then 3 elevated days (indexes 6-8). detectBbtShift
    // DOES confirm a shift at index 6, estimating ovulation at index 5 --
    // cycle day 6, which is below fusion's minimum plausible cycle day of 8
    // (see fuseOvulationEstimate.ts step 4), so the clamp rejects the
    // detected estimate and the analysis returns undefined. Unlike the
    // sparse test above, a real signal exists here; the clamp is what
    // discards it.
    const low = 36.4;
    const high = 36.75;
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => buildBbtEntry(addDays(cycleStart, i), low)),
      buildBbtEntry(addDays(cycleStart, 6), high),
      buildBbtEntry(addDays(cycleStart, 7), high),
      buildBbtEntry(addDays(cycleStart, 8), high),
    ];

    const result = analyzeCurrentCycleOvulation({
      todayIso: addDays(cycleStart, 25),
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toBeUndefined();
  });

  it('a fused estimate anchored on BBT (retrospective) is still subject to the not-yet-open-window discipline', () => {
    // Same conflict scenario as above, but "today" is before the fertile
    // window the BBT-anchored fused date would imply.
    const entries = buildCycleFixture({
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      bbt: 'biphasic',
      opk: 'positive-only',
    });
    const bbtOvulationDateIso = addDays(cycleStart, 9);
    const beforeWindowOpens = addDays(bbtOvulationDateIso, -6);

    const result = analyzeCurrentCycleOvulation({
      todayIso: beforeWindowOpens,
      cycleStartIso: cycleStart,
      cycleLengthDays: 28,
      entries,
      profile: BASE_PROFILE,
    });

    expect(result).toBeUndefined();
  });
});
