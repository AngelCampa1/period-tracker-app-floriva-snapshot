/**
 * Adversarial tests for luteal-phase-length learning.
 *
 * Probes: imported sparse Clue/Flo-like data (few observations, mixed
 * uncertainty, some implausible), input order independence, and degenerate
 * (zero/negative) computed lengths from malformed data.
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

describe('learnLutealLength adversarial', () => {
  it('handles sparse imported data (Clue/Flo-like): few observations, gaps, mixed confidence', () => {
    // Simulates a realistic import: most cycles have no ovulation marker at
    // all (not represented here -- callers only ever pass confirmed
    // ovulations), one cycle has a coarse/uncertain marker that must be
    // discarded, and only two cycles have tight-enough confirmations to
    // actually teach the model anything.
    const confirmations: ConfirmedOvulation[] = [
      confirmed('2025-03-15', '2025-03-29', 0), // 14 days, kept
      confirmed('2025-06-20', '2025-07-05', 2), // imported coarse marker, uncertainty 2 -- discarded
      confirmed('2025-09-10', '2025-09-23', 1), // 13 days, uncertainty 1 -- kept (boundary inclusive)
    ];

    const result = learnLutealLength(confirmations);

    expect(result).toStrictEqual({
      lutealLengthDays: 13.5, // median(14, 13)
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('is independent of input order', () => {
    const forward = learnLutealLength([
      confirmed('2026-01-14', '2026-01-27', 0), // 13
      confirmed('2026-02-14', '2026-02-28', 0), // 14
      confirmed('2026-03-14', '2026-03-30', 0), // 16
    ]);
    const shuffled = learnLutealLength([
      confirmed('2026-03-14', '2026-03-30', 0), // 16
      confirmed('2026-01-14', '2026-01-27', 0), // 13
      confirmed('2026-02-14', '2026-02-28', 0), // 14
    ]);

    expect(shuffled).toStrictEqual(forward);
  });

  it('discards a zero-or-negative computed length from malformed data (next period before ovulation)', () => {
    const confirmations: ConfirmedOvulation[] = [
      // Malformed: next period start logged BEFORE the confirmed ovulation
      // date (e.g. a data-entry error, or import noise). diffDays is
      // negative here -- must be discarded by the plausibility bounds, not
      // propagate a nonsensical negative luteal length.
      confirmed('2026-01-20', '2026-01-14', 0),
      confirmed('2026-02-14', '2026-02-28', 0), // 14 days, kept
      confirmed('2026-03-14', '2026-03-29', 0), // 15 days, kept
    ];

    const result = learnLutealLength(confirmations);

    expect(result).toStrictEqual({
      lutealLengthDays: 14.5,
      sampleSize: 2,
      isDefault: false,
    });
  });

  it('returns the pure default shape for a completely empty import', () => {
    expect(learnLutealLength([])).toStrictEqual({
      lutealLengthDays: 14,
      sampleSize: 0,
      isDefault: true,
    });
  });
});
