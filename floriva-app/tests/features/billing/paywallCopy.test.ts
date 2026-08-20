import {
  computeAnnualSavingsPercent,
  computeMonthlyEquivalentPrice,
  parsePriceAmount,
} from '@/src/features/billing/paywallCopy';

describe('parsePriceAmount', () => {
  it('parses common currency formats', () => {
    expect(parsePriceAmount('$39.99/year')).toBeCloseTo(39.99, 2);
    expect(parsePriceAmount('$5.99/month')).toBeCloseTo(5.99, 2);
    expect(parsePriceAmount('$59.99')).toBeCloseTo(59.99, 2);
    expect(parsePriceAmount('€1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parsePriceAmount('1 234,56 ₽')).toBeCloseTo(1234.56, 2);
  });

  it('returns null when no number is present', () => {
    expect(parsePriceAmount('Free')).toBeNull();
    expect(parsePriceAmount('')).toBeNull();
    expect(parsePriceAmount(undefined)).toBeNull();
  });

  it('picks the longest numeric run when stray digits appear elsewhere', () => {
    // "Plan2" contributes a stray "2"; the real price is the longer run.
    expect(parsePriceAmount('Plan2 — $1,234.56/year')).toBeCloseTo(1234.56, 2);
  });

  it('treats the right-most separator as the decimal when both are present', () => {
    // Dot is right-most => US grouping with a comma thousands separator.
    expect(parsePriceAmount('$1,234.56')).toBeCloseTo(1234.56, 2);
  });

  it('treats a lone comma with non-2-digit tail as a grouping separator', () => {
    expect(parsePriceAmount('1,234')).toBeCloseTo(1234, 2);
  });
});

describe('computeAnnualSavingsPercent', () => {
  it('computes percent saved versus 12 months of the monthly price', () => {
    // 12 * 5.99 = 71.88; annual 39.99 => saves ~44%
    expect(computeAnnualSavingsPercent('$5.99/month', '$39.99/year')).toBe(44);
  });

  it('returns null when either price cannot be parsed', () => {
    expect(computeAnnualSavingsPercent('Free', '$39.99/year')).toBeNull();
    expect(computeAnnualSavingsPercent('$5.99/month', 'n/a')).toBeNull();
  });

  it('returns null when annual is not cheaper than 12 months', () => {
    expect(computeAnnualSavingsPercent('$1.00/month', '$39.99/year')).toBeNull();
  });
});

describe('computeMonthlyEquivalentPrice', () => {
  it('divides the annual price by 12 and formats with the source symbol', () => {
    expect(computeMonthlyEquivalentPrice('$39.99/year')).toBe('$3.33');
  });

  it('returns null when the annual price cannot be parsed', () => {
    expect(computeMonthlyEquivalentPrice('annual')).toBeNull();
  });

  it('formats with a trailing currency symbol when there is no leading prefix', () => {
    expect(computeMonthlyEquivalentPrice('1 234,56 ₽')).toBe('102.88 ₽');
  });

  it('formats a bare numeric annual price with no currency markers', () => {
    expect(computeMonthlyEquivalentPrice('39.99')).toBe('3.33');
  });
});
