/**
 * Adversarial tests for dateMath.ts
 *
 * Probes: leap-year math, month-end rollovers, year boundaries, DST transition
 * dates, and numeric-safety edge cases.
 */

import { addDays, diffDays, isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';

describe('dateMath adversarial – calendar math', () => {
  it('correctly adds days across a leap-year Feb 28 -> Feb 29', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('correctly adds days across a leap-year Feb 29 -> Mar 01', () => {
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('skips Feb 29 in a non-leap year', () => {
    // 2025 is not a leap year; Feb 28 + 1 = Mar 01
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('diffDays is exactly 366 for a full leap year', () => {
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('diffDays is exactly 365 for a non-leap year', () => {
    expect(diffDays('2025-01-01', '2026-01-01')).toBe(365);
  });

  it('handles month-end rollovers: Jan 31 + 1 = Feb 01', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('handles month-end rollover: Mar 31 + 1 = Apr 01', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
  });

  it('handles year boundary: Dec 31 + 1 = Jan 01 next year', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('handles year boundary: Dec 31 + 366 lands in leap year', () => {
    // 2025-12-31 + 366 = 2026-12-31 (not leap) … just verifies no overflow crash
    const result = addDays('2025-12-31', 366);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('diffDays is 0 for identical dates', () => {
    expect(diffDays('2026-03-15', '2026-03-15')).toBe(0);
  });

  it('diffDays is negative when end is before start', () => {
    expect(diffDays('2026-04-01', '2026-03-01')).toBe(-31);
  });

  it('addDays with 0 days returns the same date', () => {
    expect(addDays('2026-06-01', 0)).toBe('2026-06-01');
  });

  it('addDays with negative days goes backward', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addDays backward across leap-year Feb 29 lands on Feb 29', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  // DST transition safety: all math must be UTC-stable regardless of TZ env
  it('is UTC-stable across a US spring-forward DST boundary (America/New_York)', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      // US DST spring-forward 2026: Mar 8 02:00 -> 03:00 (clocks skip an hour)
      expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
      expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
      expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });

  it('is UTC-stable across a US fall-back DST boundary (America/New_York)', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      // US DST fall-back 2026: Nov 1 02:00 -> 01:00 (clocks repeat an hour)
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
      expect(diffDays('2026-10-31', '2026-11-02')).toBe(2);
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });

  it('isoDateToUtcMillis is symmetric with Date.UTC', () => {
    expect(isoDateToUtcMillis('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    expect(isoDateToUtcMillis('2026-01-01')).toBe(Date.UTC(2026, 0, 1));
  });

  it('addDays is commutative with diffDays', () => {
    const start = '2024-02-28';
    const end = addDays(start, 29);
    expect(diffDays(start, end)).toBe(29);
  });
});

describe('dateMath adversarial – large and edge values', () => {
  it('handles adding a very large number of days without crashing', () => {
    const result = addDays('2026-01-01', 365 * 10);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('diffDays across a long span returns a large integer', () => {
    const diff = diffDays('2000-01-01', '2026-01-01');
    expect(diff).toBe(9497); // pre-computed: 26 years with 7 leap years
  });
});
