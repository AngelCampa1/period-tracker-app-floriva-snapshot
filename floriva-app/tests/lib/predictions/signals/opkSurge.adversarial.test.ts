/**
 * Adversarial tests for the OPK surge detector.
 *
 * Probes: sparse/imported data with gaps (Clue/Flo-like), and out-of-order
 * entries.
 */

import { buildOpkEntry } from '@/tests/lib/predictions/fixtures';
import { detectOpkSurge } from '@/src/lib/predictions/signals/opkSurge';

describe('detectOpkSurge adversarial', () => {
  it('resolves correctly from sparse imported data with only a single positive reading and large gaps', () => {
    // Mimics an imported dataset where OPK testing wasn't done daily -- only
    // a handful of scattered readings exist across the whole cycle.
    const entries = [
      buildOpkEntry('2026-01-03', 'negative'),
      buildOpkEntry('2026-01-16', 'positive'),
      buildOpkEntry('2026-01-25', 'negative'),
    ];

    const signal = detectOpkSurge(entries);

    expect(signal).toStrictEqual({
      kind: 'opk-surge',
      ovulationDateIso: '2026-01-17',
      triggerResult: 'positive',
      uncertaintyDays: 0,
      prospective: true,
      retrospective: false,
    });
  });

  it('is independent of input array order (sorts internally by date)', () => {
    const outOfOrder = [
      buildOpkEntry('2026-01-16', 'positive'),
      buildOpkEntry('2026-01-03', 'negative'),
      buildOpkEntry('2026-01-10', 'negative'),
    ];

    const signal = detectOpkSurge(outOfOrder);

    expect(signal?.ovulationDateIso).toBe('2026-01-17');
  });
});
