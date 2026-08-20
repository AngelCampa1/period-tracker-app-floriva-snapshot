/**
 * Long-tenure probes for date math (workstream E, Phase 1).
 *
 * Resolution probes: leap-year and year-boundary arithmetic — the exact
 * edges a multi-year history walks through. dateMath is UTC-based and
 * timezone-independent by construction; these pin that contract for the
 * dates long-tenure datasets actually cross (2028-02-29 is the next leap
 * day a current user will hit).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { addDays, diffDays, isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';

describe('RESOLVED — leap-year 2028 arithmetic', () => {
  it('addDays lands on and steps over 2028-02-29 correctly', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    // Non-leap century-style sanity: 2027 has no Feb 29.
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('a 28-day cycle spanning the leap day keeps exact interval math', () => {
    expect(diffDays('2028-02-15', '2028-03-14')).toBe(28);
    expect(addDays('2028-02-15', 28)).toBe('2028-03-14');
  });

  it('a full leap year is 366 days and a common year 365', () => {
    expect(diffDays('2028-01-01', '2029-01-01')).toBe(366);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
  });
});

describe('RESOLVED — year-boundary math', () => {
  it('addDays crosses Dec 31 -> Jan 1 without drift', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-12-20', 14)).toBe('2027-01-03');
  });

  it('diffDays is exact across multi-year spans (no DST contamination — UTC-based)', () => {
    // A 12-month backward walk (how tenure fixtures are built) crosses two
    // DST transitions in most US zones; UTC-based math must be unaffected.
    expect(diffDays('2025-07-06', '2026-07-06')).toBe(365);
    expect(diffDays('2025-11-01', '2025-11-03')).toBe(2);
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    // Round-trip identity over an arbitrary long-tenure offset.
    expect(diffDays('2024-02-29', addDays('2024-02-29', 500))).toBe(500);
  });

  it('isoDateToUtcMillis is midnight-UTC exact (no local-time leakage)', () => {
    expect(isoDateToUtcMillis('2026-01-01')).toBe(Date.UTC(2026, 0, 1));
    expect(isoDateToUtcMillis('2028-02-29')).toBe(Date.UTC(2028, 1, 29));
  });
});
