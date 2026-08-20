/**
 * Tests for ovulation-estimate fusion across the three signal detectors.
 *
 * Algorithm under test (see src/lib/predictions/signals/fuseOvulationEstimate.ts):
 * - Weights: BBT 3, OPK-peak 3, OPK-positive 2, mucus 1.
 * - Agreement (widest pairwise gap among present estimates is STRICTLY LESS
 *   THAN 2 days, i.e. 0 or 1 day apart): weighted median date; uncertaintyDays
 *   = max(span of estimates, largest individual signal uncertainty).
 * - Conflict (gap >= 2 days -- per the product spec's own worked example of
 *   OPK day 14 vs BBT day 16): if a confirmed BBT shift is among the inputs,
 *   anchor on BBT's date; uncertaintyDays widens to the full span across all
 *   estimates; `signals-disagree: true`; no confidence boost is implied by
 *   the fused output shape (the orchestrator must not read agreement into a
 *   conflict result).
 * - Plausibility clamp: fused date must land within cycle day
 *   [8, cycleLengthDays - 7]; otherwise returns a calendar-fallback marker.
 *
 * Conflict-resolution, plausibility-clamp boundary, and OPK-vs-BBT disagreement
 * adversarial cases live in fuseOvulationEstimate.adversarial.test.ts.
 */

import { fuseOvulationEstimate } from '@/src/lib/predictions/signals/fuseOvulationEstimate';
import {
  buildBbtSignal as bbt,
  buildMucusSignal as mucus,
  buildOpkPeakSignal as opkPeak,
  buildOpkPositiveSignal as opkPositive,
} from '@/tests/lib/predictions/fixtures';

// Re-export the shared signal builders under this file's short aliases so the
// adversarial companion suite can keep importing them from here.
export { bbt, mucus, opkPeak, opkPositive };

// Cycle start far enough back that plausibility-clamp day math is easy to
// reason about: cycle day N = diffDays(cycleStartIso, date) + 1.
export const CYCLE_START = '2026-01-01';
export const CYCLE_LENGTH = 28;

describe('fuseOvulationEstimate', () => {
  it('returns a calendar-fallback marker when no signals are present', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
    });

    expect(result).toStrictEqual({ kind: 'calendar-fallback' });
  });

  it('fuses a single signal directly (no conflict possible with only one estimate)', () => {
    // Cycle day 15 -> within [8, 21] for a 28-day cycle.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-15'),
    });

    expect(result).toStrictEqual({
      kind: 'fused',
      ovulationDateIso: '2026-01-15',
      uncertaintyDays: 0,
      signalsDisagree: false,
      contributingSignals: ['opk-surge'],
    });
  });

  it('weighted-medians agreeing signals within 2 days of each other', () => {
    // BBT (weight 3) says day 15, mucus (weight 1) says day 14 -- 1 day
    // apart, well within agreement. Weighted median should land on the
    // higher-weight BBT date.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-15'),
      mucus: mucus('2026-01-14'),
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      expect(result.ovulationDateIso).toBe('2026-01-15');
      expect(result.signalsDisagree).toBe(false);
      // Span of estimates (1 day) vs max individual uncertainty (mucus: 2)
      // -- the larger wins per the documented rule.
      expect(result.uncertaintyDays).toBe(2);
      expect(result.contributingSignals.sort()).toStrictEqual(['bbt-shift', 'mucus-peak']);
    }
  });

  it('uncertainty is the span of estimates when that exceeds individual uncertainties', () => {
    // Use BBT (uncertainty 0) day 15 and OPK-peak (uncertainty 0) day 14: a
    // 1-day span, within the <2-day agreement threshold, and 1 > both
    // individual uncertainties (0).
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-15'),
      opk: opkPeak('2026-01-14'),
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      expect(result.signalsDisagree).toBe(false);
      expect(result.uncertaintyDays).toBe(1);
    }
  });

  it('treats a 1-day widest gap across three signals as agreement, not conflict', () => {
    // 3 signals: BBT=15 (weight 3), OPK-peak=14 (weight 3), mucus=14
    // (weight 1). Widest pairwise gap is 1 (15 vs 14) -- within the <2 day
    // agreement threshold, so this must weighted-median rather than conflict
    // -resolve.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-15'),
      opk: opkPeak('2026-01-14'),
      mucus: mucus('2026-01-14'),
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      expect(result.signalsDisagree).toBe(false);
      expect(result.contributingSignals.sort()).toStrictEqual([
        'bbt-shift',
        'mucus-peak',
        'opk-surge',
      ]);
    }
  });

  it('accepts a fused date exactly at the plausibility floor (cycle day 8)', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-08'), // cycle day 8
    });

    expect(result.kind).toBe('fused');
  });

  it('accepts a fused date exactly at the plausibility ceiling (cycleLengthDays - 7)', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPeak('2026-01-21'), // cycle day 21 = 28 - 7
    });

    expect(result.kind).toBe('fused');
  });

  it('resolves purely from OPK-positive when it is the only present signal', () => {
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      opk: opkPositive('2026-01-15'),
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      expect(result.contributingSignals).toStrictEqual(['opk-surge']);
    }
  });

  it('averages the two straddling values when the weighted-median cumulative weight lands exactly on the half-weight mark', () => {
    // BBT (weight 3, offset 14) and OPK-peak (weight 3, offset 15): equal
    // weights, 1-day gap (agreement). Total weight 6, half-weight 3 -- the
    // first (lower-offset) entry's own cumulative weight already equals the
    // half-weight exactly, triggering the tie-break: average of the two
    // straddling values.
    const result = fuseOvulationEstimate({
      cycleStartIso: CYCLE_START,
      cycleLengthDays: CYCLE_LENGTH,
      bbt: bbt('2026-01-14'),
      opk: opkPeak('2026-01-15'),
    });

    expect(result.kind).toBe('fused');
    if (result.kind === 'fused') {
      // (14 + 15) / 2 = 14.5 days from cycle start -> truncates to the 14th
      // when rendered back to an ISO date (see dateMath.addDays: a
      // fractional day offset lands mid-day UTC, which slice(0, 10) floors
      // to that calendar day).
      expect(result.ovulationDateIso).toBe('2026-01-14');
    }
  });
});
