/**
 * Adversarial tests for ovulation-estimate fusion.
 *
 * Probes: genuine conflict resolution and anchoring, the documented
 * OPK-day-14-vs-BBT-day-16 conflict case, the no-BBT-to-anchor-on fallback,
 * and both plausibility-clamp boundaries (too early / too late).
 */

import { fuseOvulationEstimate } from '@/src/lib/predictions/signals/fuseOvulationEstimate';
import {
  bbt,
  CYCLE_LENGTH,
  CYCLE_START,
  mucus,
  opkPeak,
} from '@/tests/lib/predictions/signals/fuseOvulationEstimate.test';

describe('fuseOvulationEstimate adversarial', () => {
  it('resolves a genuine conflict (>2 days apart) by anchoring on BBT and widening uncertainty to the full span', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-16'),
      opk: opkPeak('2026-01-12'),
    });

    expect(result).toStrictEqual({
      kind: 'fused',
      ovulationDateIso: '2026-01-16',
      uncertaintyDays: 4,
      signalsDisagree: true,
      contributingSignals: ['bbt-shift', 'opk-surge'],
    });
  });

  it('adversarial-must: OPK says day 14, BBT says day 16 -- exactly a 2-day gap is a conflict, resolved by anchoring on BBT', () => {
    // This is the product spec's own worked conflict example. A 2-day gap is
    // deliberately on the conflict side of the agreement/conflict boundary
    // (agreement requires a STRICTLY smaller, <2-day gap) -- see the module
    // doc for the full rationale.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-16'),
      opk: opkPeak('2026-01-14'), // explicit: OPK says day 14
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      expect(result.ovulationDateIso).toBe('2026-01-16');
      expect(result.signalsDisagree).toBe(true);
      expect(result.uncertaintyDays).toBe(2);
    }
  });

  it('falls back to the calendar marker when no BBT is present and OPK/mucus genuinely conflict', () => {
    // OPK day 12 vs mucus day 20: 8 days apart, no BBT to anchor on. Without
    // a confirmed BBT shift, there is no principled anchor -- fusion must not
    // guess, so it defers to the calendar-fallback marker.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-12'),
      mucus: mucus('2026-01-20'),
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('clamps out-of-plausible-range fused dates to a calendar-fallback marker (too early)', () => {
    // Cycle day 3 (2026-01-03) is well before the plausibility floor of
    // cycle day 8.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-03'),
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('clamps out-of-plausible-range fused dates to a calendar-fallback marker (too late)', () => {
    // For a 28-day cycle, the ceiling is cycleLengthDays - 7 = day 21
    // (2026-01-21). Day 25 is past it.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-25'),
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('one day beyond the floor boundary (cycle day 7) is rejected', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-07'), // cycle day 7 -- one below the floor of 8
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('one day beyond the ceiling boundary (cycleLengthDays - 6) is rejected', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-22'), // cycle day 22 -- one above the ceiling of 21
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('resolves from sparse imported data with only the weakest (mucus) signal present', () => {
    // Mimics an imported dataset (Clue/Flo-like) where only cervical mucus
    // was ever tracked -- no BBT, no OPK. Fusion must still produce a usable
    // estimate off the single weak signal rather than requiring all three.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      mucus: mucus('2026-01-15'),
    });

    expect(result).toStrictEqual({
      kind: 'fused',
      ovulationDateIso: '2026-01-15',
      uncertaintyDays: 2,
      signalsDisagree: false,
      contributingSignals: ['mucus-peak'],
    });
  });
});
