/**
 * Adversarial tests for the mucus peak-day detector.
 *
 * Probes: sparse/imported data (Clue/Flo-like) where "no further entries"
 * must NOT be conflated with an observed dry-up.
 */

import { buildCycleFixture, buildMucusEntry } from '@/tests/lib/predictions/fixtures';
import { detectMucusPeak } from '@/src/lib/predictions/signals/mucusPeak';

describe('detectMucusPeak adversarial', () => {
  it('does not fabricate a peak day from sparse data where logging simply stops (no observed dry-up)', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', mucus: 'sparse' });

    // Fixture logs a single egg-white day with no later entries at all --
    // absence of further logging is not an observed dry-up.
    expect(detectMucusPeak(entries)).toBeNull();
  });

  it('does not fabricate a peak day when the only later entries are also missing mucus data (gaps, not dry-up)', () => {
    const entries = [
      buildMucusEntry('2026-01-10', 'egg-white'),
      // Gap: no mucus observation logged 01-11..01-15 at all (imported data
      // with missing days), only bleeding entries with no ttcObservation.
      { id: 'gap-1', logDate: '2026-01-11', bleeding: 'none' as const, symptoms: [] },
      { id: 'gap-2', logDate: '2026-01-12', bleeding: 'none' as const, symptoms: [] },
    ];

    expect(detectMucusPeak(entries)).toBeNull();
  });
});
