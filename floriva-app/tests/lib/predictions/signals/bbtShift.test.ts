/**
 * Tests for the BBT three-over-six coverline rule (Marshall).
 *
 * Algorithm under test (see src/lib/predictions/signals/bbtShift.ts):
 * 1. Extract dated BBT readings from DailyLogEntry[] for one cycle.
 * 2. Reject any reading outside the valid [35.0, 38.5] Celsius band.
 * 3. For each candidate shift day, require >=6 valid readings in the prior
 *    10 days (the eligibility window). The coverline is the HIGHEST of the
 *    most recent 6 valid readings prior to the candidate (Marshall's "last
 *    6") -- NOT the max of every reading in the 10-day window, so an older
 *    spike cannot inflate it.
 * 4. Shift day = first day with temp >= coverline + 0.2C, followed by 2 more
 *    days both above the coverline (3 elevated days total).
 * 5. Estimated ovulation = day before the shift day.
 *
 * Adversarial cases (Fahrenheit rejection, boundary rise, anovulatory flat
 * cycle, cycle-boundary straddling) live in bbtShift.adversarial.test.ts.
 */

import { buildBbtEntry, buildCycleFixture } from '@/tests/lib/predictions/fixtures';
import { detectBbtShift } from '@/src/lib/predictions/signals/bbtShift';

const CYCLE_START = '2026-01-01';

describe('detectBbtShift', () => {
  it('detects a biphasic shift and anchors ovulation the day before the shift day', () => {
    const entries = buildCycleFixture({ cycleStartIso: CYCLE_START, bbt: 'biphasic' });

    const signal = detectBbtShift(entries);

    expect(signal).not.toBeNull();
    expect(signal).toMatchObject({
      kind: 'bbt-shift',
      confirmed: true,
      retrospective: true,
      prospective: false,
      uncertaintyDays: 0,
    });
    // Fixture's biphasic pattern shifts at day index 10 (11th day).
    const expectedShiftDate = '2026-01-11';
    const expectedOvulationDate = '2026-01-10';
    expect(signal?.shiftDateIso).toBe(expectedShiftDate);
    expect(signal?.ovulationDateIso).toBe(expectedOvulationDate);
  });

  it('tolerates noisy pre-shift readings that stay within the baseline window', () => {
    const entries = buildCycleFixture({ cycleStartIso: CYCLE_START, bbt: 'noisy' });

    const signal = detectBbtShift(entries);

    expect(signal).not.toBeNull();
    expect(signal?.shiftDateIso).toBe('2026-01-11');
  });

  it('builds the coverline from the last 6 readings, not the whole window: an old spike must not suppress a real shift', () => {
    // Discriminating case for the "last 6" vs "max of whole 10-day window"
    // coverline formulation. There is a single high spike (36.8C) 8 days
    // before the candidate, then 6 baseline readings (36.4C) in the days
    // immediately before it.
    //
    // - Correct rule (max of the last 6 valid readings = the 6 baselines):
    //   coverline = 36.4, so the candidate at 36.7 clears 36.4 + 0.2 = 36.6
    //   and the shift IS detected.
    // - Buggy rule (max of all readings in the 10-day window): coverline
    //   would be 36.8 (the old spike), so the candidate at 36.7 fails
    //   36.8 + 0.2 = 37.0 and the shift would be WRONGLY suppressed.
    const entries = [
      buildBbtEntry('2025-12-23', 36.8), // old spike, 8 days back -- ages out of the last 6
      buildBbtEntry('2025-12-25', 36.4),
      buildBbtEntry('2025-12-26', 36.4),
      buildBbtEntry('2025-12-27', 36.4),
      buildBbtEntry('2025-12-28', 36.4),
      buildBbtEntry('2025-12-29', 36.4),
      buildBbtEntry('2025-12-30', 36.4),
      buildBbtEntry('2025-12-31', 36.7), // candidate shift day
      buildBbtEntry('2026-01-01', 36.7), // day 2, above the 36.4 coverline
      buildBbtEntry('2026-01-02', 36.7), // day 3, above the 36.4 coverline
    ];

    const signal = detectBbtShift(entries);

    expect(signal).not.toBeNull();
    expect(signal?.shiftDateIso).toBe('2025-12-31');
    expect(signal?.ovulationDateIso).toBe('2025-12-30');
  });

  it('returns null for an empty entry list', () => {
    expect(detectBbtShift([])).toBeNull();
  });

  it('ignores entries without a ttcObservation or without a BBT reading', () => {
    const entries = [
      { id: '1', logDate: '2026-01-01', bleeding: 'none' as const, symptoms: [] },
      { id: '2', logDate: '2026-01-02', bleeding: 'none' as const, symptoms: [], ttcObservation: {} },
    ];

    expect(detectBbtShift(entries)).toBeNull();
  });
});
