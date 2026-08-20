/**
 * presentation.ts probe-2 adversarial test suite.
 *
 * Targets gaps not covered by the existing presentation.test.ts:
 *
 * 1. Russian plural correctness for numbers 5–24 (known bug zone):
 *    Russian requires: 1 → "день", 2-4 → "дня", 5-20 → "дней",
 *    21 → "день", 22-24 → "дня", 25+ → "дней".
 *    The implementation only checks `n < 5` which collapses all of
 *    5-24 into "дней" – wrong for 21 ("день") and 22-24 ("дня").
 *
 * 2. formatWeekdayLabels: all 8 locales return exactly 7 non-empty labels
 *    starting with Sunday.
 *
 * 3. formatPredictionRangeLabel where start == end (single-day range).
 *
 * 4. formatFertileWindowLabel boundary: today == startIso (open-boundary).
 *
 * 5. formatFertileWindowLabel boundary: today == endIso (closed-boundary).
 *
 * 6. formatFertileWindowCaption non-en locales for all three states (open,
 *    closed, active) always return an empty string.
 *
 * 7. formatHistoryChipLabel(1, 'en') → singular "1 cycle" (not "1 cycles").
 *
 * 8. formatLoggedPeriodStartsLabel Russian plural correctness (same bug zone
 *    as fertileWindow: numbers 5, 11, 21, 22, 24, 25).
 *
 * 9. formatPredictionConfidenceBasisLabel: all 8 locales for cycleCount == 0
 *    fall through to the <=1 branch (returns non-empty, correct language).
 *
 * 10. (removed) formatPredictionConfidenceReason coverage — the helper was
 *     deleted in A7 as a dead export (zero production callers post-A5;
 *     reason-code copy is now resolved directly via `translate()`/`t()` at
 *     the call sites, e.g. `ConfidenceImprovementList`).
 *
 * 11. Cross-year formatPredictionRangeLabel (Dec → Jan).
 *
 * 12. formatMonthLabel locale coverage: ja, zh-Hans, ru produce non-empty
 *     strings containing the year.
 */

import type { SupportedLocale } from '@/src/types/domain';
import {
  formatFertileWindowCaption,
  formatFertileWindowLabel,
  formatHistoryChipLabel,
  formatLoggedPeriodStartsLabel,
  formatMonthDayLabel,
  formatMonthDayLabelWithYearIfNotCurrent,
  formatMonthLabel,
  formatNextPeriodExpectedRangeLabel,
  formatPredictionConfidenceBasisLabel,
  formatPredictionConfidenceLabel,
  formatPredictionRangeLabel,
  formatStalePredictionBannerLabel,
  formatWeekdayLabels,
} from '@/src/lib/predictions/presentation';

const ALL_LOCALES: SupportedLocale[] = ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'];

// ──────────────────────────────────────────────────────────────────────────────
// 1. Russian plural correctness
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – Russian plural rules', () => {
  /**
   * Russian grammar for "день" (day):
   *   1, 21, 31, …  → день
   *   2-4, 22-24, … → дня
   *   5-20, 25-30, … → дней
   *
   * The implementation uses:
   *   n === 1 ? 'ень' : n < 5 ? 'ня' : 'ней'
   * which is incorrect for n >= 21 because it treats all n >= 5 as "дней".
   *
   * SUSPECTED BUG: numbers 21, 22, 23, 24 should not use "дней".
   */

  it('ru: fertileWindow OPEN 1 day → "день" (singular)', () => {
    // today=Apr 12, window starts Apr 13 → 1 day away
    expect(formatFertileWindowLabel('2026-04-12', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 1 день',
    );
  });

  it('ru: fertileWindow OPEN 2 days → "дня" (2-4 form)', () => {
    expect(formatFertileWindowLabel('2026-04-11', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 2 дня',
    );
  });

  it('ru: fertileWindow OPEN 5 days → "дней" (5-20 form)', () => {
    expect(formatFertileWindowLabel('2026-04-08', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 5 дней',
    );
  });

  it('ru: fertileWindow OPEN 11 days → "дней" (11-14 form, not "дня")', () => {
    expect(formatFertileWindowLabel('2026-04-02', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 11 дней',
    );
  });

  /**
   * SUSPECTED BUG – the following two tests are expected to FAIL with the
   * current implementation.
   *
   * Russian requires:
   *   21 → "через 21 день"   (ends in 1, not a teen number)
   *   22 → "через 22 дня"    (ends in 2)
   *
   * Current code: n >= 5 → always "дней", so it produces:
   *   "через 21 дней" and "через 22 дней" instead.
   */
  it('ru: fertileWindow OPEN 21 days → "день" (21 uses singular like 1) – SUSPECTED BUG', () => {
    // Apr 13 - 21 days back = Mar 23
    expect(formatFertileWindowLabel('2026-03-23', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 21 день',
    );
  });

  it('ru: fertileWindow OPEN 22 days → "дня" (22 uses 2-4 form like 2) – SUSPECTED BUG', () => {
    expect(formatFertileWindowLabel('2026-03-22', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 22 дня',
    );
  });

  it('ru: fertileWindow CLOSED 1 day → "день" (singular)', () => {
    // window ended Apr 18, today is Apr 19
    expect(formatFertileWindowLabel('2026-04-19', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно закончилось 1 день назад',
    );
  });

  it('ru: fertileWindow CLOSED 3 days → "дня" (2-4 form)', () => {
    expect(formatFertileWindowLabel('2026-04-21', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно закончилось 3 дня назад',
    );
  });

  it('ru: fertileWindow CLOSED 5 days → "дней" (5-20 form)', () => {
    expect(formatFertileWindowLabel('2026-04-23', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно закончилось 5 дней назад',
    );
  });

  /**
   * SUSPECTED BUG – same issue for the "closed" branch.
   */
  it('ru: fertileWindow CLOSED 21 days → "день" – SUSPECTED BUG', () => {
    // window ended Apr 18, today = May 9 (21 days later)
    expect(formatFertileWindowLabel('2026-05-09', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно закончилось 21 день назад',
    );
  });

  it('ru: loggedPeriodStarts 21 → "21 начало месячных" – SUSPECTED BUG', () => {
    // Current impl: n < 5 ? 'ала' : 'алов' → 21 gets "алов" (wrong; should be "ало")
    expect(formatLoggedPeriodStartsLabel(21, 'ru')).toBe('Записано 21 начало месячных');
  });

  it('ru: loggedPeriodStarts 22 → "22 начала месячных" – SUSPECTED BUG', () => {
    // 22 should use "начала" (2-4 form), not "началов"
    expect(formatLoggedPeriodStartsLabel(22, 'ru')).toBe('Записано 22 начала месячных');
  });

  it('ru: loggedPeriodStarts 5 → "5 началов месячных" (5-20 form is correct)', () => {
    expect(formatLoggedPeriodStartsLabel(5, 'ru')).toBe('Записано 5 началов месячных');
  });

  it('ru: loggedPeriodStarts 11 → "11 началов" (teen form correct)', () => {
    expect(formatLoggedPeriodStartsLabel(11, 'ru')).toBe('Записано 11 началов месячных');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. formatWeekdayLabels: all 8 locales → 7 non-empty labels, Sunday-first
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatWeekdayLabels all locales', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: returns exactly 7 non-empty weekday labels`, () => {
      const labels = formatWeekdayLabels(locale);
      expect(labels).toHaveLength(7);
      for (const label of labels) {
        expect(label.length).toBeGreaterThan(0);
      }
    });
  }

  it('en: weekday labels start with Sunday ("S") and include all 7 narrow labels', () => {
    const labels = formatWeekdayLabels('en');
    // Narrow weekday for Jan 4 2026 (Sunday) in English is 'S'
    expect(labels[0]).toBe('S');
    // Saturday (Jan 10 2026) is also 'S' — all 7 must be strings
    expect(labels).toHaveLength(7);
  });

  it('de: all 7 labels are non-empty strings', () => {
    const labels = formatWeekdayLabels('de');
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
  });

  it('ja: all 7 labels are non-empty strings (Intl narrow Japanese)', () => {
    const labels = formatWeekdayLabels('ja');
    expect(labels.every((l) => l.length > 0)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. formatPredictionRangeLabel: start == end (single-day range)
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatPredictionRangeLabel single-day range', () => {
  /**
   * When start == end the "compactEnd" logic should collapse to just the day
   * number (same month) — but the range separator is still applied.
   * We just assert non-empty, correct-locale output.
   */
  for (const locale of ALL_LOCALES) {
    it(`${locale}: single-day range (start == end) returns a non-empty string`, () => {
      const result = formatPredictionRangeLabel('2026-05-15', '2026-05-15', locale);
      expect(result.length).toBeGreaterThan(0);
    });
  }

  it('en: single-day range contains "15" (the day number)', () => {
    const result = formatPredictionRangeLabel('2026-05-15', '2026-05-15', 'en');
    expect(result).toContain('15');
  });

  it('en: cross-year range (Dec → Jan) uses full end date (different months)', () => {
    // Cross-month so compactEnd == full end label
    const result = formatPredictionRangeLabel('2026-12-29', '2027-01-03', 'en');
    // Should contain "Jan" for the end month
    expect(result).toContain('Jan');
    expect(result).toContain('Dec');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4 & 5. formatFertileWindowLabel open/closed boundary conditions
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatFertileWindowLabel boundary conditions', () => {
  /**
   * The implementation uses string comparison (todayIso < startIso).
   * When today == startIso the condition `todayIso < startIso` is false, so
   * the function checks `todayIso > endIso` — also false. Falls into the
   * "active" branch. That is correct behaviour.
   */
  it('en: today == startIso → "active today" (window is open on start day)', () => {
    expect(formatFertileWindowLabel('2026-04-12', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Fertile window active today',
    );
  });

  it('ru: today == startIso → active message (not "closed" or "open")', () => {
    expect(formatFertileWindowLabel('2026-04-12', '2026-04-12', '2026-04-18', 'ru')).toBe(
      'Фертильное окно активно сегодня',
    );
  });

  /**
   * When today == endIso the implementation checks `todayIso > endIso` — false,
   * so returns "active" too. That is the intended behaviour (end-inclusive).
   */
  it('en: today == endIso → "active today" (window includes the end day)', () => {
    expect(formatFertileWindowLabel('2026-04-18', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Fertile window active today',
    );
  });

  it('ja: today == endIso → active Japanese string', () => {
    expect(formatFertileWindowLabel('2026-04-18', '2026-04-12', '2026-04-18', 'ja')).toBe(
      '排卵期は今日です',
    );
  });

  it('en: today == endIso + 1 day → "closed 1 day ago"', () => {
    expect(formatFertileWindowLabel('2026-04-19', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Fertile window ended 1 day ago',
    );
  });

  it('en: today == startIso - 1 day → "opens in 1 day"', () => {
    expect(formatFertileWindowLabel('2026-04-11', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Fertile window opens in 1 day',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. formatFertileWindowCaption: non-en locales always return empty string
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatFertileWindowCaption non-en → empty', () => {
  const nonEnLocales = ALL_LOCALES.filter((l) => l !== 'en');

  for (const locale of nonEnLocales) {
    it(`${locale}: open state → empty string`, () => {
      expect(formatFertileWindowCaption('2026-04-10', '2026-04-12', '2026-04-18', locale)).toBe('');
    });

    it(`${locale}: closed state → empty string`, () => {
      expect(formatFertileWindowCaption('2026-04-22', '2026-04-12', '2026-04-18', locale)).toBe('');
    });

    it(`${locale}: active state → empty string`, () => {
      expect(formatFertileWindowCaption('2026-04-15', '2026-04-12', '2026-04-18', locale)).toBe('');
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. formatHistoryChipLabel singular/plural in English
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatHistoryChipLabel en singular', () => {
  it('1 cycle → "1 cycle" (no trailing s)', () => {
    expect(formatHistoryChipLabel(1, 'en')).toBe('1 cycle');
  });

  it('2 cycles → "2 cycles"', () => {
    expect(formatHistoryChipLabel(2, 'en')).toBe('2 cycles');
  });

  it('0 → "New baseline"', () => {
    expect(formatHistoryChipLabel(0, 'en')).toBe('New baseline');
  });

  it('-1 → "New baseline" (negative treated as ≤ 0)', () => {
    expect(formatHistoryChipLabel(-1, 'en')).toBe('New baseline');
  });

  it('non-en: any count → empty string (locale not implemented)', () => {
    const nonEnLocales = ALL_LOCALES.filter((l) => l !== 'en');
    for (const locale of nonEnLocales) {
      expect(formatHistoryChipLabel(3, locale)).toBe('');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. formatPredictionConfidenceBasisLabel: cycleCount == 0 → ≤1 branch
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatPredictionConfidenceBasisLabel cycleCount=0', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: cycleCount=0 returns non-empty string (falls into ≤1 branch)`, () => {
      const result = formatPredictionConfidenceBasisLabel(0, locale);
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. Cross-year formatPredictionRangeLabel
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – cross-year formatPredictionRangeLabel', () => {
  it('en: Dec→Jan uses full end-month label (cross-year is cross-month)', () => {
    const result = formatPredictionRangeLabel('2026-12-29', '2027-01-03', 'en');
    // Must include both Dec start and Jan end
    expect(result).toContain('Dec');
    expect(result).toContain('Jan');
    expect(result).toContain('to');
  });

  it('de: cross-year range contains "bis" separator', () => {
    const result = formatPredictionRangeLabel('2026-12-29', '2027-01-03', 'de');
    expect(result).toContain('bis');
  });

  it('ru: cross-year range is non-empty and contains an em-dash separator', () => {
    const result = formatPredictionRangeLabel('2026-12-29', '2027-01-03', 'ru');
    expect(result).toContain(' — ');
    expect(result.length).toBeGreaterThan(0);
  });

  // LT-08: every locale must render BOTH years on a cross-year range so the
  // window is never ambiguous about which year each side falls in.
  for (const locale of ALL_LOCALES) {
    it(`${locale}: cross-year range includes both "2026" and "2027"`, () => {
      const result = formatPredictionRangeLabel('2026-12-30', '2027-01-03', locale);
      expect(result).toContain('2026');
      expect(result).toContain('2027');
    });

    it(`${locale}: same-year range does NOT include a year`, () => {
      const result = formatPredictionRangeLabel('2026-04-28', '2026-05-02', locale);
      expect(result).not.toContain('2026');
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. formatMonthLabel locale coverage
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatMonthLabel all locales non-empty with year', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: formatMonthLabel returns non-empty string containing "2026"`, () => {
      const result = formatMonthLabel('2026-06-01', locale);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('2026');
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 13. formatMonthDayLabel: zero-padded days and all 8 locales
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatMonthDayLabel all locales non-empty', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: returns non-empty label for 2026-01-05`, () => {
      const result = formatMonthDayLabel('2026-01-05', locale);
      expect(result.length).toBeGreaterThan(0);
    });
  }

  it('en: single-digit day "2026-06-03" → contains "3" not "03"', () => {
    // Intl formats day as numeric (no zero-pad)
    const result = formatMonthDayLabel('2026-06-03', 'en');
    expect(result).toContain('3');
    // Should NOT zero-pad in English narrow format
    expect(result).not.toMatch(/\b03\b/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 14. formatNextPeriodExpectedRangeLabel locale completeness
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatNextPeriodExpectedRangeLabel locale completeness', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: returns non-empty string for same-month range`, () => {
      const result = formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', locale);
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 15. formatPredictionConfidenceLabel: all levels × all locales non-empty
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatPredictionConfidenceLabel completeness', () => {
  const levels = ['low', 'medium', 'high'] as const;

  for (const locale of ALL_LOCALES) {
    for (const level of levels) {
      it(`${locale} / ${level}: returns non-empty string`, () => {
        const result = formatPredictionConfidenceLabel(level, locale);
        expect(result.length).toBeGreaterThan(0);
      });
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 16. formatStalePredictionBannerLabel (LT-27): non-empty, no digits, all
//     locales -- this is deliberately a date-free message (it replaces a
//     concrete-date banner precisely because the grid can no longer back
//     those dates with real shading), so it must never accidentally
//     interpolate a stray number.
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatStalePredictionBannerLabel locale completeness', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: returns a non-empty, digit-free message`, () => {
      const result = formatStalePredictionBannerLabel(locale);
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toMatch(/\d/);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 17. formatMonthDayLabelWithYearIfNotCurrent (LT-20): year suffix only when
//     the entry's year differs from the reference "current year" date,
//     mirroring LT-08's start/end-year-comparison convention but applied
//     per-row against "today" instead of a range's own two ends.
// ──────────────────────────────────────────────────────────────────────────────

describe('presentation probe-2 – formatMonthDayLabelWithYearIfNotCurrent locale completeness', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: a prior-year entry includes "2025"`, () => {
      const result = formatMonthDayLabelWithYearIfNotCurrent('2025-07-02', '2026-07-06', locale);
      expect(result).toContain('2025');
    });

    it(`${locale}: a current-year entry omits the year entirely`, () => {
      const result = formatMonthDayLabelWithYearIfNotCurrent('2026-07-02', '2026-07-06', locale);
      expect(result).not.toContain('2026');
      expect(result).toBe(formatMonthDayLabel('2026-07-02', locale));
    });
  }

  it('en: two "Jul 2" entries a year apart render as distinct strings', () => {
    const olderEntry = formatMonthDayLabelWithYearIfNotCurrent('2025-07-02', '2026-07-06', 'en');
    const recentEntry = formatMonthDayLabelWithYearIfNotCurrent('2026-07-02', '2026-07-06', 'en');

    expect(olderEntry).not.toBe(recentEntry);
    expect(olderEntry).toBe('Jul 2, 2025');
    expect(recentEntry).toBe('Jul 2');
  });

  it('en: a future-year entry (relative to the reference date) also includes its year', () => {
    // Symmetric case: the reference date's year is the ONLY "no year"
    // exception, not merely "years <= current".
    const result = formatMonthDayLabelWithYearIfNotCurrent('2027-01-15', '2026-07-06', 'en');
    expect(result).toBe('Jan 15, 2027');
  });
});
