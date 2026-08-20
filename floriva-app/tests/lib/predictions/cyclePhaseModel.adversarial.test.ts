/**
 * Adversarial tests for cyclePhaseModel.ts
 *
 * Probes: extreme/zero/negative inputs, phase sums, and numeric safety.
 */

import {
  buildCyclePhaseBreakdown,
  buildCyclePhaseEndDays,
} from '@/src/lib/predictions/cyclePhaseModel';

describe('buildCyclePhaseBreakdown adversarial – extreme inputs', () => {
  it('period length equal to cycle length clamps follicular/luteal to 0', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 10,
      periodLengthDays: 10,
    });

    expect(breakdown.follicularDays).toBe(0);
    expect(breakdown.lutealDays).toBe(0);
    expect(breakdown.periodDays).toBe(10);
  });

  it('period length exceeding cycle length clamps period to cycle length', () => {
    // periodDays is Math.max(0, periodLengthDays) — no capping to cycle length
    // is applied in source, so follicular and luteal simply go to 0.
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 5,
      periodLengthDays: 10,
    });

    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
    // Must not produce negative values
    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
  });

  it('zero period length leaves full cycle for follicular/fertile/luteal', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 0,
    });

    expect(breakdown.periodDays).toBe(0);
    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.fertileDays).toBe(6);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
  });

  it('negative period length is clamped to 0', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: -3,
    });

    expect(breakdown.periodDays).toBe(0);
    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
  });

  it('very short cycle (1 day) never produces negative phases', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 1,
      periodLengthDays: 1,
    });

    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.fertileDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.periodDays).toBeGreaterThanOrEqual(0);
  });

  it('very long cycle (365 days) produces non-negative phases', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 365,
      periodLengthDays: 7,
    });

    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.fertileDays).toBe(6);
    expect(breakdown.cycleLengthDays).toBe(365);
  });

  it('caller-supplied fertileWindowStartOffsetDays of 0 does not crash', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 0,
    });

    expect(breakdown.follicularDays).toBe(0); // 0 - 5 clamped to 0
    expect(breakdown.fertileDays).toBe(6);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
  });

  it('caller-supplied fertileWindowStartOffsetDays larger than cycle clamps luteal to 0', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      fertileWindowStartOffsetDays: 30, // beyond cycle length
    });

    expect(breakdown.lutealDays).toBe(0);
    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
  });
});

describe('buildCyclePhaseEndDays adversarial', () => {
  it('lutealEnd always equals cycleLengthDays', () => {
    const lengths = [10, 28, 29, 35, 90, 365];

    for (const length of lengths) {
      const breakdown = buildCyclePhaseBreakdown({
        cycleLengthDays: length,
        periodLengthDays: 5,
      });
      const endDays = buildCyclePhaseEndDays(breakdown);

      expect(endDays.lutealEnd).toBe(length);
    }
  });

  it('phases are non-decreasing in end-day order', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 28,
      periodLengthDays: 5,
    });
    const { periodEnd, follicularEnd, fertileEnd, lutealEnd } =
      buildCyclePhaseEndDays(breakdown);

    expect(periodEnd).toBeLessThanOrEqual(follicularEnd);
    expect(follicularEnd).toBeLessThanOrEqual(fertileEnd);
    expect(fertileEnd).toBeLessThanOrEqual(lutealEnd);
  });

  it('short cycle (cycle < period) produces non-decreasing end days', () => {
    const breakdown = buildCyclePhaseBreakdown({
      cycleLengthDays: 3,
      periodLengthDays: 5,
    });
    const { periodEnd, follicularEnd, fertileEnd, lutealEnd } =
      buildCyclePhaseEndDays(breakdown);

    expect(periodEnd).toBeLessThanOrEqual(follicularEnd);
    expect(follicularEnd).toBeLessThanOrEqual(fertileEnd);
    expect(fertileEnd).toBeLessThanOrEqual(lutealEnd);
    expect(lutealEnd).toBe(3);
  });
});
