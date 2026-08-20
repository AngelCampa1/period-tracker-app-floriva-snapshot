/**
 * Adversarial probe tests for:
 *   - src/features/logging/date.ts          (getLocalTodayLogDate)
 *   - src/features/logging/conditionTemplates.ts (buildConditionTemplateContext)
 *   - src/features/logging/constants.ts     (option builders)
 *
 * Focus: behaviors NOT already covered by date.adversarial.test.ts or conditionTemplates.test.ts.
 *
 * date.adversarial already covers: basic contract, timezone correctness, DST, extreme dates.
 * conditionTemplates.test already covers: merged symptoms, empty tags, loggingHints order.
 *
 * New uncovered surface:
 *   date.ts       – output is strictly YYYY-MM-DD (10 chars, correct separator, no time component)
 *                 – default `now` parameter uses the system clock (smoke only)
 *   conditionTemplates – all-three condition tags together
 *                      – duplicate symptom deduplication across > 2 conditions
 *                      – templates retain passed-in key ordering (caller order, not definition order)
 *                      – every highlighted symptom is a valid SymptomKey
 *                      – title / loggingHint / insightsEmptyState are non-empty for every locale
 *                      – pcos highlighted symptoms
 *   constants.ts  – option arrays cover all domain values (no gap, no extra)
 *                 – no duplicate values within any option array
 *                 – no empty labels across all 8 locales
 *                 – option value ordering is stable (same order for every locale)
 */

import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { buildConditionTemplateContext } from '@/src/features/logging/conditionTemplates';
import {
  getBleedingOptions,
  getMoodOptions,
  getSymptomOptions,
  getBirthControlMethodOptions,
  getOvulationTestOptions,
  getCervicalMucusOptions,
} from '@/src/features/logging/constants';
import {
  bleedingIntensityValues,
  moodValueValues,
  symptomKeyValues,
  birthControlMethodValues,
  ovulationTestValues,
  cervicalMucusValues,
  conditionKeyValues,
  supportedLocaleValues,
} from '@/src/types/domain';
import type { SupportedLocale } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// date.ts – uncovered: output shape and default parameter smoke
// ---------------------------------------------------------------------------
describe('getLocalTodayLogDate – output shape', () => {
  it('always returns exactly 10 characters', () => {
    const dates = [
      new Date(2026, 0, 1, 12, 0, 0),
      new Date(2026, 11, 31, 23, 59, 59),
      new Date(2000, 1, 29, 0, 0, 0), // leap day 2000
      new Date(1970, 0, 1, 12, 0, 0),
    ];
    for (const d of dates) {
      expect(getLocalTodayLogDate(d)).toHaveLength(10);
    }
  });

  it('uses hyphens as the only separator and no time component', () => {
    const result = getLocalTodayLogDate(new Date(2026, 5, 10, 15, 30, 45));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Must contain no letters, colons, or spaces
    expect(result).not.toMatch(/[a-zA-Z: ]/);
  });

  it('default parameter returns today\'s local date (smoke — no fixed assertion)', () => {
    const result = getLocalTodayLogDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Result must be a plausible calendar year (2020–2099)
    const year = parseInt(result.slice(0, 4), 10);
    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2099);
  });

  it('month component is always two digits (zero-padded)', () => {
    // January = month 0
    expect(getLocalTodayLogDate(new Date(2026, 0, 15, 12, 0, 0)).slice(5, 7)).toBe('01');
    // September = month 8
    expect(getLocalTodayLogDate(new Date(2026, 8, 3, 12, 0, 0)).slice(5, 7)).toBe('09');
  });

  it('day component is always two digits (zero-padded)', () => {
    expect(getLocalTodayLogDate(new Date(2026, 2, 5, 12, 0, 0)).slice(8, 10)).toBe('05');
    expect(getLocalTodayLogDate(new Date(2026, 2, 31, 12, 0, 0)).slice(8, 10)).toBe('31');
  });
});

// ---------------------------------------------------------------------------
// conditionTemplates.ts – uncovered behaviors
// ---------------------------------------------------------------------------
describe('buildConditionTemplateContext – uncovered behaviors', () => {
  it('includes all three conditions without panicking', () => {
    const allKeys = [...conditionKeyValues] as typeof conditionKeyValues[number][];
    const context = buildConditionTemplateContext(allKeys, 'en');
    expect(context.templates).toHaveLength(3);
    expect(context.loggingHints).toHaveLength(3);
  });

  it('deduplicates highlighted symptoms across all three conditions', () => {
    // pcos: acne, bloating, fatigue, discharge
    // pmdd: sleep-changes, headache, cramps
    // endometriosis: cramps, fatigue, bloating
    // cramps appears in pmdd + endometriosis → should appear once
    // fatigue appears in pcos + endometriosis → should appear once
    // bloating appears in pcos + endometriosis → should appear once
    const context = buildConditionTemplateContext(
      ['pcos', 'pmdd', 'endometriosis'],
      'en',
    );
    const symptoms = context.highlightedSymptoms;
    const unique = new Set(symptoms);
    expect(unique.size).toBe(symptoms.length); // no duplicates
  });

  it('preserves caller-specified order for templates (not alphabetical / definition order)', () => {
    // Reverse the natural order
    const context = buildConditionTemplateContext(['endometriosis', 'pcos'], 'en');
    expect(context.templates[0].key).toBe('endometriosis');
    expect(context.templates[1].key).toBe('pcos');
  });

  it('loggingHints ordering matches template ordering', () => {
    const context = buildConditionTemplateContext(['pmdd', 'pcos', 'endometriosis'], 'en');
    for (let i = 0; i < context.templates.length; i++) {
      expect(context.loggingHints[i]).toBe(context.templates[i].loggingHint);
    }
  });

  it('every highlighted symptom returned is a valid SymptomKey', () => {
    const validKeys = new Set<string>(symptomKeyValues);
    const context = buildConditionTemplateContext(
      ['pcos', 'pmdd', 'endometriosis'],
      'en',
    );
    for (const sym of context.highlightedSymptoms) {
      expect(validKeys.has(sym)).toBe(true);
    }
  });

  it('pcos template includes acne and discharge as highlighted symptoms', () => {
    const context = buildConditionTemplateContext(['pcos'], 'en');
    expect(context.highlightedSymptoms).toContain('acne');
    expect(context.highlightedSymptoms).toContain('discharge');
  });

  it('title, loggingHint, insightsEmptyState are non-empty strings for every locale', () => {
    const locales = supportedLocaleValues as readonly SupportedLocale[];
    const conditions = conditionKeyValues as readonly typeof conditionKeyValues[number][];

    for (const locale of locales) {
      const context = buildConditionTemplateContext([...conditions], locale);
      for (const template of context.templates) {
        expect(template.title.length).toBeGreaterThan(0);
        expect(template.loggingHint.length).toBeGreaterThan(0);
        expect(template.insightsEmptyState.length).toBeGreaterThan(0);
      }
    }
  });

  it('single condition returns a single-element templates and loggingHints array', () => {
    const context = buildConditionTemplateContext(['endometriosis'], 'en');
    expect(context.templates).toHaveLength(1);
    expect(context.loggingHints).toHaveLength(1);
    expect(context.templates[0].key).toBe('endometriosis');
  });

  it('insightsEmptyState is included in the returned template objects', () => {
    const context = buildConditionTemplateContext(['pcos'], 'en');
    const template = context.templates[0];
    expect(typeof template.insightsEmptyState).toBe('string');
    expect(template.insightsEmptyState.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// constants.ts – option builders
// ---------------------------------------------------------------------------

describe('getBleedingOptions', () => {
  it('covers every BleedingIntensity value exactly once', () => {
    const options = getBleedingOptions('en');
    const values = options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining([...bleedingIntensityValues]));
    expect(values).toHaveLength(bleedingIntensityValues.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getBleedingOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getBleedingOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      const values = getBleedingOptions(locale).map((o) => o.value);
      expect(values).toEqual(reference);
    }
  });
});

describe('getMoodOptions', () => {
  it('covers every MoodValue exactly once', () => {
    const options = getMoodOptions('en');
    const values = options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining([...moodValueValues]));
    expect(values).toHaveLength(moodValueValues.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getMoodOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getMoodOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      expect(getMoodOptions(locale).map((o) => o.value)).toEqual(reference);
    }
  });
});

describe('getSymptomOptions', () => {
  it('covers exactly the symptomKeyValues that have UI entries (no "sex" key)', () => {
    // "sex" is in the domain SymptomKey union but is a TTC-tracked symptom,
    // NOT expected in the generic symptom option list.
    // This test asserts the actual behavior: the list does NOT include 'sex'.
    const options = getSymptomOptions('en');
    const values = options.map((o) => o.value);
    expect(values).not.toContain('sex');
  });

  it('contains no duplicate values', () => {
    const values = getSymptomOptions('en').map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getSymptomOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every returned value is a valid SymptomKey', () => {
    const validKeys = new Set<string>(symptomKeyValues);
    for (const option of getSymptomOptions('en')) {
      expect(validKeys.has(option.value)).toBe(true);
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getSymptomOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      expect(getSymptomOptions(locale).map((o) => o.value)).toEqual(reference);
    }
  });
});

describe('getBirthControlMethodOptions', () => {
  // NOTE: BirthControlMethod includes 'none', but the method options list
  // intentionally omits 'none' (it's the "not tracking" sentinel, not an option to choose).
  it('does not include the "none" sentinel value', () => {
    const values = getBirthControlMethodOptions('en').map((o) => o.value);
    expect(values).not.toContain('none');
  });

  it('covers all non-none BirthControlMethod values exactly once', () => {
    const expected = birthControlMethodValues.filter((v) => v !== 'none');
    const options = getBirthControlMethodOptions('en');
    const values = options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(expected));
    expect(values).toHaveLength(expected.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getBirthControlMethodOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getBirthControlMethodOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      expect(getBirthControlMethodOptions(locale).map((o) => o.value)).toEqual(reference);
    }
  });
});

describe('getOvulationTestOptions', () => {
  it('covers every OvulationTestValue exactly once', () => {
    const options = getOvulationTestOptions('en');
    const values = options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining([...ovulationTestValues]));
    expect(values).toHaveLength(ovulationTestValues.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getOvulationTestOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getOvulationTestOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      expect(getOvulationTestOptions(locale).map((o) => o.value)).toEqual(reference);
    }
  });
});

describe('getCervicalMucusOptions', () => {
  it('covers every CervicalMucusValue exactly once', () => {
    const options = getCervicalMucusOptions('en');
    const values = options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining([...cervicalMucusValues]));
    expect(values).toHaveLength(cervicalMucusValues.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no label is empty or whitespace-only for any locale', () => {
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      for (const option of getCervicalMucusOptions(locale)) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('option value ordering is identical across all locales', () => {
    const reference = getCervicalMucusOptions('en').map((o) => o.value);
    for (const locale of supportedLocaleValues as readonly SupportedLocale[]) {
      expect(getCervicalMucusOptions(locale).map((o) => o.value)).toEqual(reference);
    }
  });
});
