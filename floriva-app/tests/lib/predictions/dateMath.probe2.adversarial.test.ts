/**
 * dateMath probe-2 adversarial test suite.
 *
 * Targets gaps not covered by the existing dateMath.adversarial.test.ts:
 *  - addDays across the Dec 31 → Jan 1 year boundary
 *  - addDays with large negative offsets crossing year boundaries
 *  - isoDateToUtcMillis round-trip stability for single-digit months/days (zero-padded)
 *  - diffDays always returns an integer (Math.round behaviour on midpoint inputs)
 *  - diffDays symmetry: diffDays(a,b) === -diffDays(b,a)
 *  - isIsoDate-style output format invariants for every addDays call
 *  - Feb 28 on a non-leap year (2026) + 1 = Mar 1
 *  - addDays zero-offset identity on New Year's Day
 *  - Exact millisecond value assertions for isoDateToUtcMillis
 */

import { addDays, diffDays, isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';

// ──────────────────────────────────────────────────────────────────────────────
// addDays: year-boundary and negative-large-offset cases
// ──────────────────────────────────────────────────────────────────────────────

describe('dateMath probe-2 – addDays year-boundary correctness', () => {
  it('addDays("2026-12-31", 1) → "2027-01-01"', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('addDays("2026-12-31", 0) → "2026-12-31" (identity on year-end)', () => {
    expect(addDays('2026-12-31', 0)).toBe('2026-12-31');
  });

  it('addDays("2027-01-01", -1) → "2026-12-31" (backward across year)', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('addDays("2026-01-01", -365) → "2025-01-01" (large negative, non-leap year back)', () => {
    expect(addDays('2026-01-01', -365)).toBe('2025-01-01');
  });

  it('addDays("2025-01-01", -365) → "2024-01-02" (large negative through leap year 2024)', () => {
    // 2024 is a leap year, so going back 365 days from 2025-01-01 lands on 2024-01-02
    expect(addDays('2025-01-01', -365)).toBe('2024-01-02');
  });

  it('addDays("2026-02-28", 1) → "2026-03-01" (non-leap year 2026)', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('addDays("2024-02-28", 2) → "2024-03-01" (leap year: passes through Feb 29)', () => {
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });

  it('addDays always returns YYYY-MM-DD ISO format (10 chars, dashes)', () => {
    const cases = [
      ['2026-12-31', 1],
      ['2024-02-28', 1],
      ['2026-01-01', -1],
      ['2020-02-29', 366],
    ] as const;

    for (const [date, offset] of cases) {
      const result = addDays(date, offset);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toHaveLength(10);
    }
  });

  it('addDays output has zero-padded month and day (e.g. "2026-01-05" not "2026-1-5")', () => {
    // Jan 4 2026 + 1 = Jan 5 — must be zero-padded
    expect(addDays('2026-01-04', 1)).toBe('2026-01-05');
    // Dec 1 2026 + 0 = Dec 1 — month zero-padded
    expect(addDays('2026-12-01', 0)).toBe('2026-12-01');
    // Mar 9 2026 - 1 = Mar 8
    expect(addDays('2026-03-09', -1)).toBe('2026-03-08');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// diffDays: integer guarantee, symmetry, cross-year spans
// ──────────────────────────────────────────────────────────────────────────────

describe('dateMath probe-2 – diffDays integer guarantee and symmetry', () => {
  it('diffDays always returns an integer (no fractional days)', () => {
    const pairs: [string, string][] = [
      ['2026-01-01', '2026-12-31'],
      ['2024-01-01', '2025-01-01'],
      ['2026-03-07', '2026-03-09'],
    ];

    for (const [a, b] of pairs) {
      const d = diffDays(a, b);
      expect(Number.isInteger(d)).toBe(true);
    }
  });

  it('diffDays is anti-symmetric: diffDays(a,b) === -diffDays(b,a)', () => {
    const pairs: [string, string][] = [
      ['2026-01-01', '2026-07-15'],
      ['2024-02-28', '2024-03-01'],
      ['2026-12-31', '2027-01-01'],
    ];

    for (const [a, b] of pairs) {
      expect(diffDays(a, b)).toBe(-diffDays(b, a));
    }
  });

  it('diffDays across Dec-Jan year boundary is 1', () => {
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('diffDays across a 4-year span including 2 leap years (2024, 2028)', () => {
    // 2024-01-01 to 2028-01-01 = 365+366+365+365 = 1461
    expect(diffDays('2024-01-01', '2028-01-01')).toBe(1461);
  });

  it('diffDays same date is always 0', () => {
    const dates = ['2026-01-01', '2026-12-31', '2024-02-29'];
    for (const d of dates) {
      expect(diffDays(d, d)).toBe(0);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// isoDateToUtcMillis: round-trip and exact value assertions
// ──────────────────────────────────────────────────────────────────────────────

describe('dateMath probe-2 – isoDateToUtcMillis round-trip and exact values', () => {
  it('isoDateToUtcMillis returns 0 for the Unix epoch', () => {
    expect(isoDateToUtcMillis('1970-01-01')).toBe(0);
  });

  it('isoDateToUtcMillis("2026-01-01") equals Date.UTC(2026, 0, 1)', () => {
    expect(isoDateToUtcMillis('2026-01-01')).toBe(Date.UTC(2026, 0, 1));
  });

  it('isoDateToUtcMillis("2026-12-31") equals Date.UTC(2026, 11, 31)', () => {
    expect(isoDateToUtcMillis('2026-12-31')).toBe(Date.UTC(2026, 11, 31));
  });

  it('isoDateToUtcMillis("2026-02-01") equals Date.UTC(2026, 1, 1)', () => {
    // Month 2 = February = index 1 — tests month-minus-1 offset in impl
    expect(isoDateToUtcMillis('2026-02-01')).toBe(Date.UTC(2026, 1, 1));
  });

  it('isoDateToUtcMillis("2024-02-29") is a valid UTC timestamp (leap day)', () => {
    const ms = isoDateToUtcMillis('2024-02-29');
    // Round-trip: new Date(ms).toISOString() must start with 2024-02-29
    expect(new Date(ms).toISOString().startsWith('2024-02-29')).toBe(true);
  });

  it('isoDateToUtcMillis round-trip: addDays inverse check', () => {
    const base = '2026-06-15';
    const offset = 45;
    const shifted = addDays(base, offset);
    // diffDays must exactly equal offset
    expect(diffDays(base, shifted)).toBe(offset);
    // And the millisecond difference must be exactly offset * MS_PER_DAY
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    expect(isoDateToUtcMillis(shifted) - isoDateToUtcMillis(base)).toBe(offset * MS_PER_DAY);
  });

  it('isoDateToUtcMillis produces consistent values independent of local timezone', () => {
    // Force a non-UTC timezone and confirm the result is identical
    const original = process.env.TZ;
    const tzs = ['Asia/Tokyo', 'America/Los_Angeles', 'Europe/London'];
    const expected = isoDateToUtcMillis('2026-06-01');

    for (const tz of tzs) {
      process.env.TZ = tz;
      try {
        expect(isoDateToUtcMillis('2026-06-01')).toBe(expected);
      } finally {
        // restore after each iteration so we don't leak
      }
    }

    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  });
});
