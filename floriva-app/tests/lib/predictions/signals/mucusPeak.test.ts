/**
 * Tests for the cervical mucus "peak day" ovulation signal.
 *
 * Domain vocabulary (`TtcObservation.cervicalMucus`, src/types/domain.ts,
 * `cervicalMucusValues`): `dry | sticky | creamy | egg-white`.
 *
 * Algorithm under test (see src/lib/predictions/signals/mucusPeak.ts):
 * - Peak day = the LAST egg-white-quality day that is followed by an
 *   OBSERVED dry-up -- i.e. a later logged entry with a non-egg-white
 *   mucus quality. Mere absence of further logging must NOT count as a
 *   dry-up (there's no way to distinguish "dried up" from "stopped
 *   logging").
 * - Ovulation ~= peak day. This is the weakest of the three signals, so it
 *   carries the widest uncertainty band: +/-2 days.
 */

import { buildCycleFixture, buildMucusEntry } from '@/tests/lib/predictions/fixtures';
import { detectMucusPeak } from '@/src/lib/predictions/signals/mucusPeak';

describe('detectMucusPeak', () => {
  it('detects the peak day as the last egg-white day before an observed dry-up', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', mucus: 'clear-peak' });

    const signal = detectMucusPeak(entries);

    expect(signal).toStrictEqual({
      kind: 'mucus-peak',
      // Fixture: egg-white on day 10 & 11 (index), dry-up (sticky) on day 12.
      peakDateIso: '2026-01-12',
      ovulationDateIso: '2026-01-12',
      uncertaintyDays: 2,
      prospective: true,
      retrospective: false,
    });
  });

  it('returns null when egg-white mucus is logged but no dry-up is ever observed', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', mucus: 'no-dry-up' });

    expect(detectMucusPeak(entries)).toBeNull();
  });

  it('returns null when there is no mucus data at all', () => {
    const entries = buildCycleFixture({ cycleStartIso: '2026-01-01', mucus: 'none' });

    expect(detectMucusPeak(entries)).toBeNull();
  });

  it('returns null for an empty entry list', () => {
    expect(detectMucusPeak([])).toBeNull();
  });

  it('picks the LAST egg-white day among consecutive egg-white days before dry-up', () => {
    const entries = [
      buildMucusEntry('2026-01-10', 'creamy'),
      buildMucusEntry('2026-01-11', 'egg-white'),
      buildMucusEntry('2026-01-12', 'egg-white'),
      buildMucusEntry('2026-01-13', 'egg-white'),
      buildMucusEntry('2026-01-14', 'dry'),
    ];

    const signal = detectMucusPeak(entries);

    expect(signal?.peakDateIso).toBe('2026-01-13');
  });

  it('does not treat a single non-consecutive later egg-white/dry-up flip-flop as ambiguous -- uses the last qualifying peak', () => {
    const entries = [
      buildMucusEntry('2026-01-10', 'egg-white'),
      buildMucusEntry('2026-01-11', 'sticky'), // dry-up after first egg-white block
      buildMucusEntry('2026-01-13', 'egg-white'),
      buildMucusEntry('2026-01-14', 'creamy'), // dry-up after second block
    ];

    const signal = detectMucusPeak(entries);

    // The last egg-white day that is followed by an observed dry-up is
    // 2026-01-13 (followed by creamy on 01-14), not the earlier 01-10.
    expect(signal?.peakDateIso).toBe('2026-01-13');
  });
});
