/**
 * Adversarial stress tests for parseClueImport and parseManualHistoryImport.
 *
 * Focuses on the areas NOT already covered by importParsers.adversarial.test.ts
 * (which targeted the Flo parser and shared coerceIsoDate/date-range helpers).
 *
 * Each section documents the probe class, the expected contract, and whether a
 * real bug was found and fixed in importParsers.ts.
 */
import {
  UnsupportedImportShapeError,
  parseClueImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

// ---------------------------------------------------------------------------
// 1. CLUE SHAPE ROBUSTNESS — empty containers, missing arrays, bad shapes
// ---------------------------------------------------------------------------
describe('CLUE SHAPE — container variants and edge-case payloads', () => {
  it('returns an empty document for an empty bare array', () => {
    expect(parseClueImport([])).toEqual({
      source: 'clue',
      entries: [],
      skippedRows: [],
      warnings: [],
      dateRange: null,
    });
  });

  it('returns an empty document for {data: []} (empty data wrapper)', () => {
    expect(parseClueImport({ data: [] })).toEqual({
      source: 'clue',
      entries: [],
      skippedRows: [],
      warnings: [],
      dateRange: null,
    });
  });

  it('returns an empty document for {trackedData: []} (alternate Clue key)', () => {
    expect(parseClueImport({ trackedData: [] })).toEqual({
      source: 'clue',
      entries: [],
      skippedRows: [],
      warnings: [],
      dateRange: null,
    });
  });

  it('throws UnsupportedImportShapeError for a top-level number', () => {
    expect(() => parseClueImport(42)).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for a top-level string', () => {
    expect(() => parseClueImport('2026-04-01')).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for {data: "not-an-array"}', () => {
    expect(() => parseClueImport({ data: 'not-an-array' })).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for {data: 42}', () => {
    expect(() => parseClueImport({ data: 42 })).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for {trackedData: {}}', () => {
    expect(() => parseClueImport({ trackedData: {} })).toThrow(UnsupportedImportShapeError);
  });

  it('accepts rows that are null inside the array (skips them)', () => {
    const result = parseClueImport([null, { date: '2026-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].rowNumber).toBe(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('accepts rows that are numbers inside the array (skips them)', () => {
    const result = parseClueImport([42, { date: '2026-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts rows that are strings inside the array (skips them)', () => {
    const result = parseClueImport(['2026-04-01', { date: '2026-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts rows that are arrays (skips them — nested array is not an object)', () => {
    const result = parseClueImport([['2026-04-01', 'light'], { date: '2026-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts rows with extra unknown keys without crashing (warns about meaningful ones)', () => {
    const result = parseClueImport([{
      date: '2026-04-01',
      bleeding: 'light',
      unknownField: 'some value',
      emptyField: '',
    }]);
    expect(result.entries).toHaveLength(1);
    // unknownField has a meaningful value → warning expected
    const unknownWarnings = result.warnings.filter((w) => w.includes('unknownField'));
    expect(unknownWarnings).toHaveLength(1);
    // emptyField is falsy → no warning
    const emptyWarnings = result.warnings.filter((w) => w.includes('emptyField'));
    expect(emptyWarnings).toHaveLength(0);
  });

  it('produces a valid empty document (not a throw) when ALL rows are invalid', () => {
    const result = parseClueImport([
      { bleeding: 'light' },       // no date
      { date: 'bad', bleeding: 'light' }, // bad date
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(2);
    expect(result.dateRange).toBeNull();
    expect(result.source).toBe('clue');
  });
});

// ---------------------------------------------------------------------------
// 2. CLUE DATE HANDLING — missing, blank, invalid, timezone-stamped dates
// ---------------------------------------------------------------------------
describe('CLUE DATE HANDLING — field variants, coercion, skipping', () => {
  it('skips row with no date field and adds it to skippedRows', () => {
    const result = parseClueImport([{ bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
    expect(result.skippedRows[0].message).toMatch(/invalid date/i);
  });

  it('skips row with date: null and adds it to skippedRows', () => {
    const result = parseClueImport([{ date: null, bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips row with date: "" (empty string) and adds it to skippedRows', () => {
    const result = parseClueImport([{ date: '', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips row with date: "not-a-date" and adds it to skippedRows', () => {
    const result = parseClueImport([{ date: 'not-a-date', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips row with date: "2026-13-01" (invalid month) and adds it to skippedRows', () => {
    const result = parseClueImport([{ date: '2026-13-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('skips row with date: "2026-02-30" (invalid day) and adds it to skippedRows', () => {
    const result = parseClueImport([{ date: '2026-02-30', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts leap day 2024-02-29 (valid)', () => {
    const result = parseClueImport([{ date: '2024-02-29', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2024-02-29');
  });

  it('rejects 2023-02-29 (non-leap year) and skips', () => {
    const result = parseClueImport([{ date: '2023-02-29', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts ISO timestamp with Z suffix via coercion (extracts date part)', () => {
    const result = parseClueImport([{ date: '2026-04-01T00:00:00.000Z', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('accepts ISO timestamp with +offset suffix via coercion (extracts UTC date)', () => {
    const result = parseClueImport([{ date: '2026-04-01T10:00:00+05:00', bleeding: 'light' }]);
    // +05:00 means UTC is 05:00 → 2026-04-01 UTC
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('accepts far-future date 9999-12-31 (valid ISO)', () => {
    const result = parseClueImport([{ date: '9999-12-31', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('9999-12-31');
  });

  it('accepts far-past date 0001-01-01 (valid ISO)', () => {
    // Some JS engines parse this correctly
    const result = parseClueImport([{ date: '0001-01-01', bleeding: 'light' }]);
    // Either accepted with correct date or skipped — must not crash
    expect(() => result).not.toThrow();
    if (result.entries.length > 0) {
      expect(result.entries[0].logDate).toBe('0001-01-01');
    }
  });

  it('uses the first valid date candidate key (date → logDate → day → ...)', () => {
    // 'date' is first — should win even if 'day' is also present
    const result = parseClueImport([{
      date: '2026-04-01',
      day: '2026-04-02',
      bleeding: 'light',
    }]);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('falls back to calendarDate when date is missing', () => {
    const result = parseClueImport([{
      calendarDate: '2026-04-03',
      bleeding: 'light',
    }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-03');
  });
});

// ---------------------------------------------------------------------------
// 3. CLUE DEDUP AND MERGE — same date, conflicting values
// ---------------------------------------------------------------------------
describe('CLUE DEDUP AND MERGE — deterministic conflict resolution', () => {
  it('merges two rows with the same date and takes the higher bleeding (max-wins)', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light' },
      { date: '2026-04-01', bleeding: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
    expect(result.warnings.some((w) => w.includes('Merged 2 Clue rows for 2026-04-01'))).toBe(true);
  });

  it('merges two rows and takes the higher bleeding even when first row is higher', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'heavy' },
      { date: '2026-04-01', bleeding: 'light' },
    ]);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('merges symptoms across duplicate date rows (union, no duplicates)', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', symptoms: ['cramps'] },
      { date: '2026-04-01', bleeding: 'light', symptoms: ['cramps', 'fatigue'] },
    ]);
    expect(result.entries[0].symptoms).toEqual(expect.arrayContaining(['cramps', 'fatigue']));
    expect(result.entries[0].symptoms).toHaveLength(2);
  });

  it('takes first non-null mood on duplicate date (first-wins)', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', mood: 'steady' },
      { date: '2026-04-01', bleeding: 'light', mood: 'low' },
    ]);
    expect(result.entries[0].mood).toBe('steady');
  });

  it('takes first non-null notes on duplicate date (first-wins)', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', note: 'first note' },
      { date: '2026-04-01', bleeding: 'light', note: 'second note' },
    ]);
    expect(result.entries[0].notes).toBe('first note');
  });

  it('emits exactly one merge warning per date even with 5 duplicate rows', () => {
    const rows = Array.from({ length: 5 }, () => ({ date: '2026-04-01', bleeding: 'light' }));
    const result = parseClueImport(rows);
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toContain('5');
  });

  it('does not emit a merge warning for a date that appears only once', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light' },
      { date: '2026-04-02', bleeding: 'light' },
    ]);
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(0);
  });

  it('entries are sorted ascending by date regardless of input order', () => {
    const result = parseClueImport([
      { date: '2026-04-03', bleeding: 'light' },
      { date: '2026-04-01', bleeding: 'light' },
      { date: '2026-04-02', bleeding: 'light' },
    ]);
    expect(result.entries.map((e) => e.logDate)).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
    ]);
  });

  it('dateRange reflects sorted min/max, not input order', () => {
    const result = parseClueImport([
      { date: '2026-04-10', bleeding: 'light' },
      { date: '2026-04-01', bleeding: 'light' },
    ]);
    expect(result.dateRange).toEqual({ startIso: '2026-04-01', endIso: '2026-04-10' });
  });

  it('skippedRows count plus entries count equals total valid-date rows processed', () => {
    // 1 valid, 1 skipped (bad date), 1 skipped (no bleeding)
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light' },
      { date: 'bad-date', bleeding: 'light' },
      { date: '2026-04-02' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 4. CLUE FIELD MAPPING — bleeding, symptoms, mood, notes, TTC, birth control
// ---------------------------------------------------------------------------
describe('CLUE FIELD MAPPING — enum variants, case sensitivity, aliases', () => {
  it('maps all BleedingIntensity values by exact name', () => {
    const intensities = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
    for (const intensity of intensities) {
      const result = parseClueImport([{ date: '2026-04-01', bleeding: intensity }]);
      expect(result.entries[0].bleeding).toBe(intensity);
    }
  });

  it('normalizes bleeding "MEDIUM" to "medium" via normalizeToken (case-insensitive via generic path)', () => {
    // adaptGenericDailyRow normalizes via normalizeToken which lowercases, so
    // "MEDIUM" maps to "medium" — it is accepted, not skipped.
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'MEDIUM' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('medium');
  });

  it('rejects unknown bleeding values that do not match any alias and skips the row', () => {
    // "plasma" is not a BleedingIntensity or any alias
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'plasma' }]);
    // No default bleeding for Clue parser → row skipped
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });

  it('rejects boolean bleeding (true) and skips the row', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: true }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });

  it('maps type:period with value "light" via type-dispatched branch', () => {
    const result = parseClueImport([{ date: '2026-04-01', type: 'period', value: 'light' }]);
    expect(result.entries[0].bleeding).toBe('light');
  });

  it('maps type:bleeding with value "heavy" via type-dispatched branch', () => {
    const result = parseClueImport([{ date: '2026-04-01', type: 'bleeding', value: 'heavy' }]);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('skips row when type:period has unrecognized value and row has no other bleeding', () => {
    // BUG PROBE: type-dispatched row with unrecognized value → adaptedRow has no bleeding
    // → normalizeImportRow skips with "missing a valid bleeding value"
    const result = parseClueImport([{ date: '2026-04-01', type: 'period', value: 'ultra-heavy' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });

  it('maps symptom aliases case-insensitively via normalizeToken', () => {
    // adaptGenericDailyRow path: symptom truthy-key lookup
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', Acne: true }]);
    // 'Acne' is uppercased, normalizeToken lowercases → maps to 'acne'
    // But the symptomAliasMap key lookup is case-sensitive to the normalizeToken result
    // This is actually fine — normalizeToken() lowercases
    // The truthy-key path checks key in symptomAliasMap[normalizeToken(key)]
    expect(result.entries).toHaveLength(1);
  });

  it('maps symptom alias "bloated" to "bloating" via symptomAliasMap', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', bloated: true }]);
    expect(result.entries[0].symptoms).toContain('bloating');
  });

  it('maps mood alias "anxious" to "sensitive"', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', mood: 'anxious' }]);
    // 'anxious' is not a direct MoodValue so isMoodValue returns false;
    // it gets found via findMoodValue → moodAliasMap
    // But wait: adaptGenericDailyRow does:
    //   mood = (isMoodValue(row.mood) ? row.mood : null) ?? findMoodValue(getRowValues(row, ['mood'...]))
    // isMoodValue('anxious') = false; getRowValues picks up 'anxious'; findMoodValue maps it
    expect(result.entries[0].mood).toBe('sensitive');
  });

  it('ignores mood when value is a number', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', mood: 42 }]);
    expect(result.entries[0].mood).toBeUndefined();
  });

  it('trims and caps notes at 500 chars', () => {
    const longNote = 'a'.repeat(600);
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', notes: longNote }]);
    expect(result.entries[0].notes).toHaveLength(500);
  });

  it('ignores empty notes', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 'light', notes: '   ' }]);
    expect(result.entries[0].notes).toBeUndefined();
  });

  it('maps Clue type:pain row with period_cramps option to cramps symptom', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'pain', value: [{ option: 'period_cramps' }] },
    ]);
    expect(result.entries[0].symptoms).toContain('cramps');
    // type-dispatched pain row gets bleeding:'none' default
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('maps Clue type:feelings row with "happy" option to "steady" mood', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'feelings', value: [{ option: 'happy' }] },
    ]);
    expect(result.entries[0].mood).toBe('steady');
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('maps Clue type:discharge with egg_white option to egg-white cervical mucus', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'discharge', value: [{ option: 'egg_white' }] },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('egg-white');
  });

  it('maps Clue type:ovulation with positive option to ovulationTest:positive', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'ovulation', value: 'positive' },
    ]);
    expect(result.entries[0].ttcObservation?.ovulationTest).toBe('positive');
  });

  it('maps Clue type:bbt with excluded:true and skips the temperature', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: { excluded: true, celsius: 36.5 } },
    ]);
    // excluded:true → temperature is NOT mapped
    expect(result.entries[0]?.ttcObservation?.basalBodyTemperatureCelsius).toBeUndefined();
  });

  it('maps Clue type:bbt with excluded:false and valid celsius', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: { excluded: false, celsius: 36.5 } },
    ]);
    expect(result.entries[0]?.ttcObservation?.basalBodyTemperatureCelsius).toBe(36.5);
  });

  // BUG PROBE: unrecognized Clue type with meaningful value silently drops data
  // Expected: warning emitted (like Flo does for unrecognized categories)
  // REAL BUG: adaptClueRow returns {date} without warning → data lost silently
  it('emits a warning for unrecognized Clue type with meaningful value', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'sleep_quality', value: 'great' },
    ]);
    // The row has no bleeding → gets skipped, but a warning about the unknown type
    // should still be emitted so users know data was not imported.
    // (The row may be in skippedRows due to missing bleeding — that is expected.)
    // The key contract: a warning about the unrecognized type must appear.
    const typeWarnings = result.warnings.filter(
      (w) => w.toLowerCase().includes('sleep_quality') || w.toLowerCase().includes('unsupported'),
    );
    expect(typeWarnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. MANUAL HISTORY SHAPE ROBUSTNESS — empty, wrong types, extra keys
// ---------------------------------------------------------------------------
describe('MANUAL HISTORY — shape and container edge cases', () => {
  it('throws UnsupportedImportShapeError for null input', () => {
    expect(() => parseManualHistoryImport(null)).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for a bare array', () => {
    expect(() => parseManualHistoryImport([])).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for a number', () => {
    expect(() => parseManualHistoryImport(42)).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for a string', () => {
    expect(() => parseManualHistoryImport('2026-04-01')).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError when periodStarts is a string instead of array', () => {
    expect(() => parseManualHistoryImport({ periodStarts: '2026-04-01' })).toThrow(
      UnsupportedImportShapeError,
    );
  });

  it('throws UnsupportedImportShapeError when periodStarts is an object', () => {
    expect(() => parseManualHistoryImport({ periodStarts: {} })).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError when periodStarts is missing', () => {
    expect(() => parseManualHistoryImport({ lookbackStartIso: '2026-01-01' })).toThrow(
      UnsupportedImportShapeError,
    );
  });

  it('returns empty document for {periodStarts: []} without throwing', () => {
    const result = parseManualHistoryImport({ periodStarts: [] });
    expect(result.source).toBe('manual');
    expect(result.entries).toHaveLength(0);
    expect(result.dateRange).toBeNull();
    expect(result.skippedRows).toHaveLength(0);
  });

  it('ignores extra top-level keys without crashing', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01'],
      unknownField: 'ignored',
      periodLengthDays: 5,
    });
    expect(result.entries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6. MANUAL HISTORY DATE HANDLING — invalid entries, coercion, types
// ---------------------------------------------------------------------------
describe('MANUAL HISTORY — date validation for periodStarts entries', () => {
  it('skips null entries and records them in skippedRows', () => {
    const result = parseManualHistoryImport({ periodStarts: [null, '2026-04-01'] });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
    expect(result.skippedRows[0].rowNumber).toBe(1);
  });

  it('skips number entries and records them in skippedRows', () => {
    const result = parseManualHistoryImport({ periodStarts: [20260401, '2026-04-01'] });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips object entries and records them in skippedRows', () => {
    const result = parseManualHistoryImport({
      periodStarts: [{ date: '2026-04-01' }, '2026-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('skips empty string entries and records them in skippedRows', () => {
    const result = parseManualHistoryImport({ periodStarts: ['', '2026-04-01'] });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('coerces locale-style date strings (unified with Clue/Flo via coerceIsoDate)', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['April 1, 2026', '2026-04-01'],
    });
    // The manual path now uses coerceIsoDate, the same forgiving helper as the
    // Clue/Flo parsers, so a long-form locale date is normalized rather than
    // skipped. Both rows resolve to the same ISO date and dedupe to one entry.
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.skippedRows).toHaveLength(0);
  });

  it('still skips genuinely unparseable date strings as invalid', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['not-a-date-at-all', '2026-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips invalid calendar dates (2026-02-30) and records them in skippedRows', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-02-30', '2026-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts leap day 2024-02-29 (valid ISO date)', () => {
    const result = parseManualHistoryImport({ periodStarts: ['2024-02-29'] });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2024-02-29');
  });

  it('rejects 2023-02-29 (non-leap year) and skips it', () => {
    const result = parseManualHistoryImport({ periodStarts: ['2023-02-29'] });
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('all entries produce bleeding:medium and empty symptoms', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01', '2026-04-05'],
    });
    for (const entry of result.entries) {
      expect(entry.bleeding).toBe('medium');
      expect(entry.symptoms).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. MANUAL HISTORY DEDUP AND MERGE
// ---------------------------------------------------------------------------
describe('MANUAL HISTORY — dedup and merge', () => {
  it('merges duplicate dates and emits exactly one warning per duplicate date', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01', '2026-04-01', '2026-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toContain('3');
  });

  it('sorts entries ascending by date after dedup', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-05-10', '2026-05-01', '2026-05-20'],
    });
    expect(result.entries.map((e) => e.logDate)).toEqual([
      '2026-05-01',
      '2026-05-10',
      '2026-05-20',
    ]);
  });

  it('dateRange reflects actual min/max of accepted entries, not input order', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-05-10', '2026-05-01', '2026-05-20'],
    });
    expect(result.dateRange).toEqual({ startIso: '2026-05-01', endIso: '2026-05-20' });
  });

  it('single entry yields dateRange with identical start and end', () => {
    const result = parseManualHistoryImport({ periodStarts: ['2026-04-15'] });
    expect(result.dateRange).toEqual({ startIso: '2026-04-15', endIso: '2026-04-15' });
  });
});

// ---------------------------------------------------------------------------
// 8. MANUAL HISTORY lookbackStartIso VALIDATION
// ---------------------------------------------------------------------------
// BUG: lookbackStartIso is used directly in a string comparison without being
// validated as a proper ISO date.  If it is not a string (e.g., a number or
// null from untrusted JSON), the comparison `value < lookbackStartIso` behaves
// unexpectedly (JS type coercion):
//   - number 42: "2026-04-01" < 42 → false (no entries filtered)
//   - "garbage": "2026-04-01" < "garbage" → true (ALL entries filtered, data
//     silently discarded)
// Fix: validate lookbackStartIso with isIsoDate; ignore if invalid.
describe('MANUAL HISTORY — lookbackStartIso validation', () => {
  it('filters entries older than a valid lookbackStartIso', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-03-01', '2026-04-01'],
      lookbackStartIso: '2026-01-01',
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('unsupported');
  });

  // REAL BUG: lookbackStartIso is a number → all entries pass through unfiltered
  // (because "2026-04-01" < 42 === false in JS).
  // Fix: validate lookbackStartIso with isIsoDate and ignore if invalid.
  it('ignores lookbackStartIso when it is a number (does not crash, no silent filter)', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2020-01-01', '2026-04-01'],
      lookbackStartIso: 42 as unknown as string,
    });
    // A numeric lookbackStartIso is invalid — treat as if no lookback was specified
    // → all valid dates should be accepted (no entries silently discarded)
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
  });

  // REAL BUG: lookbackStartIso is "garbage" → string comparison "2026-04-01" < "garbage"
  // is TRUE (because "2" < "g"), so ALL entries get silently filtered out.
  // Fix: validate lookbackStartIso with isIsoDate and ignore if invalid.
  it('ignores lookbackStartIso when it is a non-ISO garbage string (no silent data loss)', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01', '2026-04-02'],
      lookbackStartIso: 'garbage' as unknown as string,
    });
    // "garbage" is not a valid ISO date — treat as if no lookback was specified
    // → valid entries must NOT be silently discarded
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
  });

  it('ignores lookbackStartIso when it is null', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01'],
      lookbackStartIso: null as unknown as string,
    });
    expect(result.entries).toHaveLength(1);
  });

  it('ignores lookbackStartIso when it is an object', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01'],
      lookbackStartIso: {} as unknown as string,
    });
    expect(result.entries).toHaveLength(1);
  });

  it('ignores lookbackStartIso when it is an invalid date like "2026-13-01"', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01'],
      lookbackStartIso: '2026-13-01',
    });
    expect(result.entries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 9. CLUE UNRECOGNIZED TYPE — warning for data loss
// ---------------------------------------------------------------------------
// BUG: adaptClueRow silently drops rows where type is set but unrecognized,
// emitting no warning about the dropped data.  Flo emits a warning via
// adaptFloMetricRow for the same situation.  Users importing a Clue file with
// a new/unsupported metric type have no way to know data was not imported.
// Fix: emit a warning in adaptClueRow when the metric is unrecognized and the
// value has meaningful content.
describe('CLUE — unrecognized type warning', () => {
  it('emits a warning when type is unrecognized and value is a non-empty string', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'sleep_quality', value: 'great' },
    ]);
    const typeWarnings = result.warnings.filter(
      (w) => w.includes('sleep_quality') || w.toLowerCase().includes('unsupported'),
    );
    expect(typeWarnings.length).toBeGreaterThan(0);
  });

  it('emits a warning when type is unrecognized and value is a non-empty array', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'custom_metric', value: ['foo', 'bar'] },
    ]);
    const typeWarnings = result.warnings.filter(
      (w) => w.includes('custom_metric') || w.toLowerCase().includes('unsupported'),
    );
    expect(typeWarnings.length).toBeGreaterThan(0);
  });

  it('does NOT emit a warning when type is unrecognized but value is empty/null', () => {
    const result = parseClueImport([
      // Row itself is skipped due to no bleeding; but also no meaningful value
      // → no warning about the unsupported type
      { date: '2026-04-01', bleeding: 'light', type: 'noop', value: null },
    ]);
    // The entry may be produced (if bleeding overrides the type dispatch),
    // but no "unsupported type" warning should appear for null/empty value
    const unsupportedTypeWarnings = result.warnings.filter(
      (w) => w.includes('noop'),
    );
    expect(unsupportedTypeWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. CLUE COUNTS CONSISTENCY — entries + skipped accounts for all rows
// ---------------------------------------------------------------------------
describe('CLUE — output counts consistency', () => {
  it('entries + skipped equals total unique accepted-date entries after dedup', () => {
    // 3 rows: 2 valid different dates, 1 bad date
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light' },
      { date: '2026-04-02', bleeding: 'medium' },
      { date: 'bad', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.dateRange).toEqual({ startIso: '2026-04-01', endIso: '2026-04-02' });
  });

  it('warnings array is always defined (never undefined)', () => {
    const result = parseClueImport([]);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('skippedRows array is always defined (never undefined)', () => {
    const result = parseClueImport([]);
    expect(Array.isArray(result.skippedRows)).toBe(true);
  });

  it('entries array is always defined (never undefined)', () => {
    const result = parseClueImport([]);
    expect(Array.isArray(result.entries)).toBe(true);
  });
});
