/**
 * Tests for luteal-phase-length learning.
 *
 * Algorithm under test (see src/lib/predictions/lutealLearning.ts):
 * - Confirmed luteal length (per cycle) = (next period start - confirmed
 *   ovulation date), counted only when the ovulation confirmation's
 *   uncertaintyDays <= 1.
 * - Learned luteal length = median of >=2 confirmed lengths, restricted to
 *   the plausible physiological bounds [9, 17] days (out-of-bounds
 *   confirmations are discarded before the median is taken).
 * - Default: 14 days when there are fewer than 2 plausible confirmed
 *   lengths to learn from.
 */

import { learnLutealLength } from '@/src/lib/predictions/lutealLearning';
import type { ConfirmedOvulation } from '@/src/lib/predictions/lutealLearning';

function confirmed(
  ovulationDateIso: string,
  nextPeriodStartIso: string,
  uncertaintyDays: number,
): ConfirmedOvulation {
  return { ovulationDateIso, nextPeriodStartIso, uncertaintyDays };
}

describe('learnLutealLength', () => {
  it('defaults to 14 days with no confirmed cycles', () => {
    const result = learnLutealLength([]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14,
      sampleSize: 0,
      isDefault: true,
    });
  });

  it('defaults to 14 days with only 1 confirmed cycle (needs >=2)', () => {
    const result = learnLutealLength([confirmed('2026-01-14', '2026-01-28', 0)]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14,
      sampleSize: 0,
      isDefault: true,
    });
  });

  it('learns the median luteal length from 2 confirmed cycles', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-27', 0), // 13 days
      confirmed('2026-02-14', '2026-02-29', 1), // 15 days, uncertainty=1 still counts
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14, // median(13, 15)
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('learns the median from 3 confirmed cycles (odd count -- exact middle value)', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-27', 0), // 13 days
      confirmed('2026-02-14', '2026-02-28', 0), // 14 days
      confirmed('2026-03-14', '2026-03-30', 0), // 16 days
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14,
      sampleSize: 3,
      isDefault: false,
    });
  });

  it('discards confirmations with uncertaintyDays > 1', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-27', 0), // 13 days, kept
      confirmed('2026-02-14', '2026-02-28', 2), // uncertainty 2 -- discarded
      confirmed('2026-03-14', '2026-03-30', 0), // 16 days, kept
    ]);

    // Only 2 survive the uncertainty guard -> median(13, 16) = 14.5
    expect(result).toStrictEqual({
      lutealLengthDays: 14.5,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('discards out-of-bounds luteal lengths (below 9 days)', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-20', 0), // 6 days -- implausibly short, discarded
      confirmed('2026-02-14', '2026-02-28', 0), // 14 days, kept
      confirmed('2026-03-14', '2026-03-29', 0), // 15 days, kept
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14.5,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('discards out-of-bounds luteal lengths (above 17 days)', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-02-05', 0), // 22 days -- implausibly long, discarded
      confirmed('2026-02-14', '2026-02-28', 0), // 14 days, kept
      confirmed('2026-03-14', '2026-03-29', 0), // 15 days, kept
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14.5,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('accepts the exact lower bound (9 days)', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-23', 0), // exactly 9 days
      confirmed('2026-02-14', '2026-02-23', 0), // exactly 9 days
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 9,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('accepts the exact upper bound (17 days)', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-31', 0), // exactly 17 days
      confirmed('2026-02-14', '2026-03-03', 0), // exactly 17 days
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 17,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('falls back to default when fewer than 2 confirmations survive the guards', () => {
    const result = learnLutealLength([
      confirmed('2026-01-14', '2026-01-27', 0), // 13 days, kept
      confirmed('2026-02-14', '2026-02-28', 2), // uncertainty too high, discarded
      confirmed('2026-03-14', '2026-04-05', 0), // 22 days, out of bounds, discarded
    ]);

    expect(result).toStrictEqual({
      lutealLengthDays: 14,
      sampleSize: 0,
      isDefault: true,
    });
  });
});
