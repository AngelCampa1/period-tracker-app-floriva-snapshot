/**
 * Adversarial tests for the BBT coverline detector.
 *
 * Probes: Fahrenheit-scale band-rejection, the exact 0.19C/0.2C rise
 * boundary, an anovulatory flat cycle, and a shift window straddling a
 * cycle boundary (must not fabricate a nonsensical date).
 */

import { buildBbtEntry, buildCycleFixture } from '@/tests/lib/predictions/fixtures';
import { detectBbtShift } from '@/src/lib/predictions/signals/bbtShift';

const CYCLE_START = '2026-01-01';

describe('detectBbtShift adversarial', () => {
  it('returns null for an anovulatory flat cycle (no sustained rise)', () => {
    const entries = buildCycleFixture({ cycleStartIso: CYCLE_START, bbt: 'flat' });

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('returns null when there are fewer than 6 valid readings in the prior 10 days (sparse data)', () => {
    const entries = buildCycleFixture({ cycleStartIso: CYCLE_START, bbt: 'sparse' });

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('band-rejects a Fahrenheit-scale value (97.8) rather than treating it as a valid Celsius reading', () => {
    // 97.8F is a plausible BBT chart value under a mistaken unit assumption,
    // but the domain type is Celsius-only; the detector must band-reject it
    // rather than silently treat it as a biologically implausible 97.8C.
    const entries = [
      buildBbtEntry('2025-12-22', 36.4),
      buildBbtEntry('2025-12-23', 36.3),
      buildBbtEntry('2025-12-24', 36.4),
      buildBbtEntry('2025-12-25', 36.3),
      buildBbtEntry('2025-12-26', 36.4),
      buildBbtEntry('2025-12-27', 97.8), // rejected: outside [35.0, 38.5]
      buildBbtEntry('2025-12-28', 36.3),
      buildBbtEntry('2025-12-29', 36.4),
      buildBbtEntry('2025-12-30', 36.75),
      buildBbtEntry('2025-12-31', 36.8),
      buildBbtEntry('2026-01-01', 36.8),
    ];

    const signal = detectBbtShift(entries);

    // With 97.8 rejected, 8 valid readings remain in the prior window,
    // still >= 6, so the shift still resolves off the valid data.
    expect(signal).not.toBeNull();
    expect(signal?.shiftDateIso).toBe('2025-12-30');
  });

  it('does not trigger on a boundary rise of exactly 0.19C', () => {
    const baseline = 36.4;
    const entries = [
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline),
      buildBbtEntry('2025-12-28', baseline + 0.19),
      buildBbtEntry('2025-12-29', baseline + 0.19),
      buildBbtEntry('2025-12-30', baseline + 0.19),
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('triggers on a rise of exactly 0.2C (boundary is inclusive)', () => {
    const baseline = 36.4;
    const entries = [
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline),
      buildBbtEntry('2025-12-28', baseline + 0.2),
      buildBbtEntry('2025-12-29', baseline + 0.2),
      buildBbtEntry('2025-12-30', baseline + 0.2),
    ];

    const signal = detectBbtShift(entries);

    expect(signal).not.toBeNull();
    expect(signal?.shiftDateIso).toBe('2025-12-28');
    expect(signal?.ovulationDateIso).toBe('2025-12-27');
  });

  it('does not produce nonsense when the shift window straddles a cycle boundary', () => {
    // Two back-to-back cycles concatenated. The caller normally passes only
    // one cycle's entries, but the detector must not explode or fabricate an
    // out-of-range date if given entries spanning a period-start boundary
    // (e.g. an off-by-one slice from the orchestrator). Whatever it resolves,
    // ovulation must strictly precede the shift date and both must be valid
    // ISO dates.
    const cycle1 = buildCycleFixture({
      cycleStartIso: '2025-11-01',
      bbt: 'biphasic',
      cycleLengthDays: 28,
    });
    const cycle2 = buildCycleFixture({
      cycleStartIso: '2025-11-29',
      bbt: 'biphasic',
      cycleLengthDays: 28,
    });
    const straddling = [...cycle1, ...cycle2];

    const signal = detectBbtShift(straddling);

    expect(signal).not.toBeNull();
    if (signal) {
      expect(signal.ovulationDateIso < signal.shiftDateIso).toBe(true);
      expect(Number.isNaN(Date.parse(signal.ovulationDateIso))).toBe(false);
      expect(Number.isNaN(Date.parse(signal.shiftDateIso))).toBe(false);
      // The detector must find the FIRST qualifying shift chronologically
      // (cycle1's), not skip ahead into cycle2's data.
      expect(signal.shiftDateIso).toBe('2025-11-11');
    }
  });

  it('does not confirm a shift when the day after the candidate is missing (gap, not a genuine 3-day rise)', () => {
    const baseline = 36.4;
    const entries = [
      // 7 baseline readings (one more than the minimum 6) so the candidate
      // below still has enough valid readings overall to reach the
      // per-candidate coverline check despite the day-2 gap.
      buildBbtEntry('2025-12-20', baseline),
      buildBbtEntry('2025-12-21', baseline),
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline + 0.3),
      // 2025-12-28 (day 2) missing entirely -- must not be treated as
      // confirming, even though 2025-12-29 (day 3) below is elevated.
      buildBbtEntry('2025-12-29', baseline + 0.3),
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('does not confirm a shift when the day two-after the candidate is missing', () => {
    const baseline = 36.4;
    const entries = [
      buildBbtEntry('2025-12-20', baseline),
      buildBbtEntry('2025-12-21', baseline),
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline + 0.3),
      buildBbtEntry('2025-12-28', baseline + 0.3),
      // 2025-12-29 (day 3) missing entirely.
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('does not confirm a shift when day 2 exists but drops back to (or below) the coverline', () => {
    const baseline = 36.4;
    const entries = [
      buildBbtEntry('2025-12-21', baseline),
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline + 0.3), // candidate shift day
      buildBbtEntry('2025-12-28', baseline), // drops back to coverline -- not elevated
      buildBbtEntry('2025-12-29', baseline + 0.3),
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });

  it('does not confirm a shift when day 3 exists but drops back to (or below) the coverline', () => {
    const baseline = 36.4;
    const entries = [
      buildBbtEntry('2025-12-21', baseline),
      buildBbtEntry('2025-12-22', baseline),
      buildBbtEntry('2025-12-23', baseline),
      buildBbtEntry('2025-12-24', baseline),
      buildBbtEntry('2025-12-25', baseline),
      buildBbtEntry('2025-12-26', baseline),
      buildBbtEntry('2025-12-27', baseline + 0.3), // candidate shift day
      buildBbtEntry('2025-12-28', baseline + 0.3),
      buildBbtEntry('2025-12-29', baseline), // drops back to coverline -- not elevated
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });
});
