/**
 * Pure presentation helpers for the paywall surfaces. No React, no i18n. These
 * derive display values from raw price labels and billing config so the UI never
 * hardcodes a number it cannot back up. Every function returns `null` when its
 * input cannot be parsed, and callers omit the corresponding line rather than
 * show a guessed value (honest-claims rule).
 */

/**
 * Parse a localized price label (e.g. `"$39.99/year"`, `"€1.234,56"`,
 * `"1 234,56 ₽"`) into a numeric amount. Handles both `1,234.56` and
 * `1.234,56` grouping conventions. Returns `null` when no number is present.
 */
export function parsePriceAmount(label: string | undefined | null): number | null {
  if (typeof label !== 'string') {
    return null;
  }

  // Keep only digits and separators.
  const matched = label.match(/[\d.,\s ]*\d/g);
  if (!matched) {
    return null;
  }

  // Choose the longest run (the actual price, not a stray digit in a word).
  const raw = matched.reduce((longest, candidate) =>
    candidate.replace(/[\s ]/g, '').length >
    longest.replace(/[\s ]/g, '').length
      ? candidate
      : longest,
  );

  const cleaned = raw.replace(/[\s ]/g, '');
  if (cleaned.length === 0) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // The right-most separator is the decimal separator.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Comma only: decimal if it precedes exactly two trailing digits, else grouping.
    normalized = /,\d{2}$/.test(cleaned)
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

/** Leading currency symbol/prefix of a price label (e.g. `"$"`, `"€"`), or `""`. */
function extractCurrencyPrefix(label: string): string {
  const match = label.match(/^[^\d]*/);
  const prefix = match ? match[0].trim() : '';
  return prefix;
}

/** Trailing currency symbol of a price label (e.g. `"₽"`), or `""`. */
function extractCurrencySuffix(label: string): string {
  const match = label.match(/[^\d.,\s /]+\s*$/);
  if (!match) {
    return '';
  }
  // Avoid treating a period-cadence word ("year"/"month") as currency.
  const suffix = match[0].trim();
  return /[a-z]/i.test(suffix) ? '' : suffix;
}

function formatAmount(amount: number, prefix: string, suffix: string): string {
  const body = amount.toFixed(2);
  if (prefix) {
    return `${prefix}${body}`;
  }
  if (suffix) {
    return `${body} ${suffix}`;
  }
  return body;
}

/**
 * Percent saved by the annual plan versus paying the monthly price for 12
 * months. Returns `null` when either price is unparseable or the annual price
 * is not actually cheaper.
 */
export function computeAnnualSavingsPercent(
  monthlyLabel: string | undefined,
  annualLabel: string | undefined,
): number | null {
  const monthly = parsePriceAmount(monthlyLabel);
  const annual = parsePriceAmount(annualLabel);

  if (monthly == null || annual == null || monthly <= 0) {
    return null;
  }

  const yearlyAtMonthlyRate = monthly * 12;
  if (annual >= yearlyAtMonthlyRate) {
    return null;
  }

  const percent = Math.round((1 - annual / yearlyAtMonthlyRate) * 100);
  return percent > 0 ? percent : null;
}

/**
 * The annual price divided by 12, formatted with the same currency symbol as
 * the source label (e.g. `"$3.33"`). Returns `null` when unparseable. The
 * caller is responsible for any localized "/mo" suffix so the cadence word can
 * be translated per locale.
 */
export function computeMonthlyEquivalentPrice(
  annualLabel: string | undefined,
): string | null {
  const annual = parsePriceAmount(annualLabel);
  if (annual == null || typeof annualLabel !== 'string') {
    return null;
  }

  const prefix = extractCurrencyPrefix(annualLabel);
  const suffix = extractCurrencySuffix(annualLabel);
  const perMonth = annual / 12;
  return formatAmount(perMonth, prefix, suffix);
}
