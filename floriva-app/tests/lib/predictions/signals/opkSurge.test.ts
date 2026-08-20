/**
 * Tests for the OPK (ovulation predictor kit / LH surge) signal.
 *
 * Domain vocabulary (`TtcObservation.ovulationTest`): `negative | positive |
 * peak` (src/types/domain.ts, ovulationTestValues).
 *
 * Algorithm under test (see src/lib/predictions/signals/opkSurge.ts):
 * - First `positive` result -> ovulation ~= positive date + 1 day.
 * - A `peak` result outweighs `positive` -> ovulation ~= peak date + 1 day,
 *   even if a `positive` was logged earlier in the same cycle.
 * - Prospective: this signal is safe to use to open/adjust a fertile window
 *   ahead of confirmed ovulation.
 */

import { buildCycleFixture, buildOpkEntry } from '@/tests/lib/predictions/fixtures';
import { detectOpkSurge } from '@/src/lib/predictions/signals/opkSurge';

describe('detectOpkSurge', () => {
  it('estimates ovulation as first-positive + 1 day when no peak is logged', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', opk: 'positive-only' });

    const signal = detectOpkSurge(entries);

    expect(signal).toStrictEqual({
      kind: 'opk-surge',
      ovulationDateIso: '2026-01-14',
      triggerResult: 'positive',
      uncertaintyDays: 0,
      prospective: true,
      retrospective: false,
    });
  });

  it('prefers peak over an earlier positive: ovulation = peak + 1 day', () => {
    const entries = buildCycleFixture({
      cycleStartIso: '2026-01-01',
      opk: 'positive-then-peak',
    });

    const signal = detectOpkSurge(entries);

    expect(signal?.triggerResult).toBe('peak');
    // Fixture logs peak on cycle day index 13 (2026-01-14).
    expect(signal?.ovulationDateIso).toBe('2026-01-15');
  });

  it('resolves from a peak-only cycle', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', opk: 'peak-only' });

    const signal = detectOpkSurge(entries);

    expect(signal?.triggerResult).toBe('peak');
    expect(signal?.ovulationDateIso).toBe('2026-01-14');
  });

  it('returns null when no positive/peak result exists (only negatives or no OPK data)', () => {
    const entries = [buildOpkEntry('2026-01-10', 'negative'), buildOpkEntry('2026-01-11', 'negative')];

    expect(detectOpkSurge(entries)).toBeNull();
  });

  it('returns null for an empty entry list', () => {
    expect(detectOpkSurge([])).toBeNull();
  });

  it('uses the FIRST positive chronologically, not the last, when no peak exists', () => {
    const entries = [
      buildOpkEntry('2026-01-10', 'negative'),
      buildOpkEntry('2026-01-11', 'positive'),
      buildOpkEntry('2026-01-12', 'positive'),
    ];

    const signal = detectOpkSurge(entries);

    expect(signal?.ovulationDateIso).toBe('2026-01-12');
  });

  it('uses the FIRST peak chronologically when multiple peaks are logged', () => {
    const entries = [
      buildOpkEntry('2026-01-10', 'positive'),
      buildOpkEntry('2026-01-11', 'peak'),
      buildOpkEntry('2026-01-12', 'peak'),
    ];

    const signal = detectOpkSurge(entries);

    expect(signal?.ovulationDateIso).toBe('2026-01-12');
  });
});
