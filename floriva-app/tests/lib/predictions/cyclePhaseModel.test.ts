import {
  FERTILE_WINDOW_LENGTH_DAYS,
  buildCyclePhaseBreakdown,
} from '@/src/lib/predictions/cyclePhaseModel';

describe('buildCyclePhaseBreakdown', () => {
  it('decomposes a 29-day cycle the same way the prediction engine anchors the fertile window', () => {
    // Fertile window is the 6-day span ending 14 days before the next period,
    // exactly as buildPredictionResult derives it (nextPeriod-19..nextPeriod-14).
    expect(buildCyclePhaseBreakdown({ cycleLengthDays: 29, periodLengthDays: 5 })).toEqual({
      periodDays: 5,
      follicularDays: 5,
      fertileDays: 6,
      lutealDays: 13,
      cycleLengthDays: 29,
    });
  });

  it('keeps the luteal phase at the standard ~14-day length for a 28-day cycle', () => {
    expect(buildCyclePhaseBreakdown({ cycleLengthDays: 28, periodLengthDays: 5 })).toEqual({
      periodDays: 5,
      follicularDays: 4,
      fertileDays: FERTILE_WINDOW_LENGTH_DAYS,
      lutealDays: 13,
      cycleLengthDays: 28,
    });
  });

  it('honours a caller-supplied fertile-window start offset from the live prediction', () => {
    // When the engine reports an explicit fertile start offset, the breakdown uses it
    // verbatim so Insights stays byte-for-byte aligned with the shared prediction result.
    expect(
      buildCyclePhaseBreakdown({
        cycleLengthDays: 30,
        periodLengthDays: 4,
        fertileWindowStartOffsetDays: 16,
      }),
    ).toEqual({
      periodDays: 4,
      follicularDays: 12,
      fertileDays: 6,
      lutealDays: 8,
      cycleLengthDays: 30,
    });
  });

  it('clamps follicular and luteal phases to zero for short cycles without going negative', () => {
    const breakdown = buildCyclePhaseBreakdown({ cycleLengthDays: 10, periodLengthDays: 5 });

    expect(breakdown.follicularDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.lutealDays).toBeGreaterThanOrEqual(0);
    expect(breakdown.periodDays).toBe(5);
    expect(breakdown.cycleLengthDays).toBe(10);
  });
});
