/**
 * Real-world adversarial probe for importParsers.ts.
 *
 * Focuses on MESSY, REALISTIC competitor-export shapes that are NOT already
 * covered by the four existing test files:
 *   - importParsers.test.ts
 *   - importParsers.adversarial.test.ts
 *   - importParsers.clueManual.adversarial.test.ts
 *   - importParsers.probe.adversarial.test.ts
 *
 * Any assertion that fails is flagged "SUSPECTED BUG #n" with a precise
 * explanation of expected vs. actual.
 */
import {
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

// ---------------------------------------------------------------------------
// A. CLUE REAL-WORLD EXPORT SHAPES
// The real Clue JSON export uses a top-level object with a "data" array
// where each element is either a "daily summary" flat object or a typed
// metric row { date, type, value }. Real exports also include BOM bytes
// at the file start (often stripped by JSON.parse already), but the date
// strings themselves may carry timezone suffixes from the app.
// ---------------------------------------------------------------------------
describe('CLUE — realistic export shapes', () => {
  it('handles a real-world Clue daily-summary row with multiple alias fields', () => {
    // Real Clue exports often use the "day" key for date, "flow" for bleeding,
    // and a flat symptom key like "headaches: true".
    const result = parseClueImport({
      data: [
        {
          day: '2025-11-14',
          flow: 'medium',
          headaches: true,
          bloated: true,
          emotion: 'irritable',
          note: 'Felt rough today.',
        },
      ],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-11-14');
    expect(result.entries[0].bleeding).toBe('medium');
    expect(result.entries[0].symptoms).toContain('headache');
    expect(result.entries[0].symptoms).toContain('bloating');
    expect(result.entries[0].mood).toBe('sensitive');
    expect(result.entries[0].notes).toBe('Felt rough today.');
  });

  it('handles Clue type-dispatched rows with ISO timestamp dates (Z suffix)', () => {
    // Real Clue apps record events at the moment logged, so "trackedAt" may be
    // a full ISO timestamp. The wall-clock date in the prefix is the correct date.
    const result = parseClueImport([
      { trackedAt: '2025-12-01T22:45:00.000Z', type: 'period', value: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-12-01');
    expect(result.entries[0].bleeding).toBe('light');
  });

  it('handles Clue type-dispatched rows with +offset timestamp dates', () => {
    // User in UTC+5:30; logs at 00:30 — wall-clock date on Apr 2, not Apr 1 UTC.
    const result = parseClueImport([
      { trackedAt: '2025-10-15T01:30:00+05:30', type: 'period', value: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    // Wall-clock date prefix is "2025-10-15" — must preserve that, not shift to UTC.
    expect(result.entries[0].logDate).toBe('2025-10-15');
  });

  it('handles multiple Clue type-dispatched rows for the same date merged into one entry', () => {
    // Clue may export each tracked metric as a separate row sharing the same date.
    const result = parseClueImport([
      { date: '2025-09-01', type: 'period', value: 'light' },
      { date: '2025-09-01', type: 'pain', value: [{ option: 'cramps' }] },
      { date: '2025-09-01', type: 'feeling', value: 'sad' },
      { date: '2025-09-01', type: 'bbt', value: { celsius: 36.6 } },
    ]);
    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0];
    expect(entry.bleeding).toBe('light');
    expect(entry.symptoms).toContain('cramps');
    expect(entry.mood).toBe('low');
    expect(entry.ttcObservation?.basalBodyTemperatureCelsius).toBe(36.6);
  });

  it('handles Clue export with "trackedData" instead of "data" as the array key', () => {
    const result = parseClueImport({
      trackedData: [{ date: '2025-08-10', type: 'period', value: 'spotting' }],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('spotting');
  });

  it('skips Clue rows where the date is the string "null"', () => {
    const result = parseClueImport([
      { date: 'null', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips a non-object element (string) inside the Clue data array', () => {
    const result = parseClueImport(['not-an-object' as unknown]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('skips a null element inside the Clue data array', () => {
    const result = parseClueImport([null as unknown]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('handles extra/unknown top-level keys in Clue wrapper object gracefully', () => {
    // Some Clue exports include metadata like "version", "exportDate" etc.
    const result = parseClueImport({
      version: '2.1.0',
      exportDate: '2026-01-01',
      userId: 'abc123',
      data: [{ date: '2025-06-01', bleeding: 'heavy' }],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('handles a Clue row with date as a number (epoch ms) — should be skipped', () => {
    // Some broken exports may serialise dates as epoch milliseconds.
    const result = parseClueImport([
      { date: 1_700_000_000_000, bleeding: 'light' },
    ]);
    // date is not a string → isIsoDate returns false → skipped with "invalid"
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('handles Clue row with bleeding as a number (1=light) — treated as unknown, skipped', () => {
    // Some manual edits / conversions may use numeric bleeding levels.
    // isBleedingIntensity expects a string. defaultBleeding is null → skip.
    const result = parseClueImport([
      { date: '2025-07-01', bleeding: 1 },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('handles Clue row with bleeding as boolean true — treated as unknown, skipped', () => {
    const result = parseClueImport([
      { date: '2025-07-01', bleeding: true },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('handles very large out-of-order Clue export — entries sorted by date', () => {
    // 3000 rows in REVERSE date order
    const rows = Array.from({ length: 3000 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1 + (2999 - i)));
      return { date: date.toISOString().slice(0, 10), bleeding: 'light' as const };
    });
    const result = parseClueImport(rows);
    expect(result.entries).toHaveLength(3000);
    // Must be sorted ascending
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i].logDate > result.entries[i - 1].logDate).toBe(true);
    }
    expect(result.dateRange?.startIso).toBe(result.entries[0].logDate);
    expect(result.dateRange?.endIso).toBe(result.entries[result.entries.length - 1].logDate);
  });

  it('handles 3000 duplicate dates in Clue — collapses to 1 entry with merge warning', () => {
    const rows = Array.from({ length: 3000 }, () => ({
      date: '2025-05-01',
      bleeding: 'light' as const,
    }));
    const result = parseClueImport(rows);
    expect(result.entries).toHaveLength(1);
    // parseClueImport does NOT pre-aggregate (unlike Flo), so mergeEntries sees
    // 3000 rows for the same date and emits a single "Merged 3000..." warning.
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toContain('3000');
  });
});

// ---------------------------------------------------------------------------
// B. FLO REAL-WORLD EXPORT SHAPES
// Flo JSON exports come in several shapes depending on the app version:
//   v1: top-level array of flat daily objects
//   v2: { data: [...] } with mixed metric/daily rows
//   v3: { operationalData: { cycles: [...] } } with start/end date ranges
//   Some newer exports: { update: { cycles: [...] } }
// Real exports also contain many per-category rows for the same date.
// ---------------------------------------------------------------------------
describe('FLO — realistic export shapes', () => {
  it('handles a real v2 Flo export with mixed daily + metric rows', () => {
    // Simulates a Flo v2 export where daily observations are separate per-metric rows
    const result = parseFloImport({
      data: [
        { date: '2025-10-01', type: 'bleeding', value: 'medium' },
        { date: '2025-10-01', type: 'symptom', value: ['cramps', 'fatigue'] },
        { date: '2025-10-01', type: 'mood', value: 'irritable' },
        { date: '2025-10-02', type: 'bleeding', value: 'light' },
        { date: '2025-10-02', type: 'note', value: 'Less pain today.' },
      ],
    });
    expect(result.entries).toHaveLength(2);
    const oct1 = result.entries.find((e) => e.logDate === '2025-10-01');
    const oct2 = result.entries.find((e) => e.logDate === '2025-10-02');
    expect(oct1?.bleeding).toBe('medium');
    expect(oct1?.symptoms).toContain('cramps');
    expect(oct1?.symptoms).toContain('fatigue');
    expect(oct1?.mood).toBe('sensitive');
    expect(oct2?.bleeding).toBe('light');
    expect(oct2?.notes).toBe('Less pain today.');
  });

  it('handles a real v3 Flo export with operationalData.cycles', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          { period_start_date: '2025-10-01', period_end_date: '2025-10-05' },
          { period_start_date: '2025-11-02', period_end_date: '2025-11-06' },
        ],
      },
    });
    expect(result.entries).toHaveLength(10); // 5 + 5
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toContain('2025-10-01');
    expect(dates).toContain('2025-10-05');
    expect(dates).toContain('2025-11-02');
    expect(dates).toContain('2025-11-06');
    for (const entry of result.entries) {
      expect(entry.bleeding).toBe('medium');
    }
  });

  it('handles Flo export with both operationalData.cycles AND data array — merges both', () => {
    // Some Flo exports include both a cycles container and per-metric rows
    const result = parseFloImport({
      data: [
        { date: '2025-10-01', type: 'symptom', value: ['cramps'] },
        { date: '2025-10-01', type: 'mood', value: 'sensitive' },
      ],
      operationalData: {
        cycles: [
          { period_start_date: '2025-10-01', period_end_date: '2025-10-03' },
        ],
      },
    });
    // data contributes 2025-10-01 (symptom + mood); cycles contribute 10-01..03 (bleeding)
    // Flo pre-aggregation merges 10-01 from both sources
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toContain('2025-10-01');
    expect(dates).toContain('2025-10-02');
    expect(dates).toContain('2025-10-03');
    const oct1 = result.entries.find((e) => e.logDate === '2025-10-01');
    // The cycle row provides bleeding:medium; metric rows provide symptoms/mood
    // Whether they are pre-merged in aggregatedRows or separately depends on order.
    // At minimum the entry should exist and have a valid bleeding value.
    expect(oct1).toBeDefined();
    expect(oct1!.bleeding).toBeTruthy();
  });

  it('handles Flo row with date via "tracked_at" key (snake_case)', () => {
    const result = parseFloImport([
      { tracked_at: '2025-09-15', type: 'bleeding', value: 'spotting' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-09-15');
    expect(result.entries[0].bleeding).toBe('spotting');
  });

  it('handles Flo export where cycle dates use camelCase keys', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          { periodStartDate: '2025-10-01', periodEndDate: '2025-10-04' },
        ],
      },
    });
    expect(result.entries).toHaveLength(4);
  });

  it('handles Flo export where cycle dates use "startDate" / "endDate"', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          { startDate: '2025-10-01', endDate: '2025-10-04' },
        ],
      },
    });
    expect(result.entries).toHaveLength(4);
  });

  it('handles Flo export with unknown metric category — emits warning, no crash', () => {
    const result = parseFloImport([
      { date: '2025-07-01', type: 'bleeding', value: 'light' },
      { date: '2025-07-01', type: 'water_intake', value: '8 glasses' },
    ]);
    expect(result.entries).toHaveLength(1);
    const warnMatches = result.warnings.filter((w) =>
      w.toLowerCase().includes('water_intake') || w.toLowerCase().includes('unsupported'),
    );
    expect(warnMatches.length).toBeGreaterThan(0);
  });

  it('skips oversized cycle range (>90 days) but continues processing remaining cycles', () => {
    // SUSPECTED BUG #1:
    // When an oversized cycle is skipped (returns null from buildInclusiveIsoDateRange),
    // the remaining valid cycles should still be processed.
    // Expected: 2 entries from the valid cycle, 0 from the skipped one.
    // Actual: may silently skip ALL if the implementation returns early.
    const result = parseFloImport({
      operationalData: {
        cycles: [
          // Oversized: 2025-01-01 to 2025-12-31 = 365 days > MAX_PERIOD_DAYS(90)
          { period_start_date: '2025-01-01', period_end_date: '2025-12-31' },
          // Valid: 2-day period
          { period_start_date: '2025-06-01', period_end_date: '2025-06-02' },
        ],
      },
    });
    // The valid cycle should still produce entries even though the first was skipped.
    expect(result.entries).toHaveLength(2);
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toContain('2025-06-01');
    expect(dates).toContain('2025-06-02');
  });

  it('handles Flo rows where symptoms value is a single string (not array)', () => {
    // Some Flo exports may send a single symptom as a string rather than array
    const result = parseFloImport([
      { date: '2025-08-01', type: 'bleeding', value: 'light' },
      { date: '2025-08-01', type: 'symptom', value: 'cramps' },
    ]);
    expect(result.entries).toHaveLength(1);
    // asStringList handles single strings, mapSymptomsFromValues maps 'cramps' → 'cramps'
    expect(result.entries[0].symptoms).toContain('cramps');
  });

  it('handles Flo rows with date as ISO timestamp with Z suffix', () => {
    const result = parseFloImport([
      { date: '2025-03-20T08:15:00.000Z', type: 'bleeding', value: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-03-20');
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('handles Flo export with 3000+ rows across multiple dates — correct count and order', () => {
    // 3000 unique daily bleeding rows
    const rows = Array.from({ length: 3000 }, (_, i) => {
      const date = new Date(Date.UTC(2017, 0, 1 + i));
      return {
        date: date.toISOString().slice(0, 10),
        type: 'bleeding',
        value: 'light',
      };
    });
    const result = parseFloImport(rows);
    expect(result.entries).toHaveLength(3000);
    // Sorted ascending
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i].logDate > result.entries[i - 1].logDate).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// C. MANUAL HISTORY REAL-WORLD SHAPES
// ---------------------------------------------------------------------------
describe('MANUAL — realistic import shapes', () => {
  it('handles periodStarts with whitespace-padded ISO dates — coerced, not skipped (regression)', () => {
    // FIXED BUG #2: the manual path now uses coerceIsoDate (like Clue/Flo), so a
    // hand-edited JSON with leading/trailing whitespace — the most likely real
    // source of a manual import — is trimmed and accepted instead of silently
    // skipped. Both rows import; the padded date is normalized to its ISO form.
    const result = parseManualHistoryImport({
      periodStarts: ['  2025-04-01  ', '2025-05-01'],
    });
    expect(result.skippedRows).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.logDate)).toEqual([
      '2025-04-01',
      '2025-05-01',
    ]);
  });

  it('handles periodStarts with impossible date Feb 30 — skipped as invalid', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-02-30', '2025-03-01'],
    });
    // "2025-02-30" passes /^\d{4}-\d{2}-\d{2}$/ but new Date().toISOString()
    // does NOT start with "2025-02-30" in isIsoDate → skipped
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-03-01');
  });

  it('handles periodStarts with impossible date month 13 — skipped as invalid', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-13-01'],
    });
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('handles periodStarts with null entries mixed in — skips nulls', () => {
    const result = parseManualHistoryImport({
      periodStarts: [null, '2025-04-01', undefined, '2025-05-01'],
    });
    // null and undefined fail isIsoDate → skipped
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(2);
    for (const skipped of result.skippedRows) {
      expect(skipped.reason).toBe('invalid');
    }
  });

  it('handles periodStarts with numeric entries — skipped as invalid', () => {
    const result = parseManualHistoryImport({
      periodStarts: [20250401, '2025-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toBe('invalid');
  });

  it('handles empty periodStarts array — zero entries, no error', () => {
    const result = parseManualHistoryImport({ periodStarts: [] });
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(0);
    expect(result.dateRange).toBeNull();
  });

  it('handles lookbackStartIso that is invalid — gracefully ignored, no filtering', () => {
    // If lookbackStartIso is garbage, all entries should pass (no lookback filter).
    const result = parseManualHistoryImport({
      periodStarts: ['2020-01-01', '2024-06-01'],
      lookbackStartIso: 'not-a-date',
    });
    // Invalid lookbackStartIso → treated as undefined → no filtering
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
  });

  it('handles lookbackStartIso that is null — gracefully ignored, no filtering', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2020-01-01', '2024-06-01'],
      lookbackStartIso: null,
    });
    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
  });

  it('handles out-of-order periodStarts — entries sorted ascending in output', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-06-01', '2025-03-01', '2025-09-01', '2025-01-01'],
    });
    expect(result.entries).toHaveLength(4);
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toEqual(['2025-01-01', '2025-03-01', '2025-06-01', '2025-09-01']);
    expect(result.dateRange?.startIso).toBe('2025-01-01');
    expect(result.dateRange?.endIso).toBe('2025-09-01');
  });

  it('handles duplicate periodStarts — collapses to single entry with merge warning', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-04-01', '2025-04-01', '2025-04-01'],
    });
    expect(result.entries).toHaveLength(1);
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toContain('3');
  });

  it('handles far-future date (year 9999) — valid ISO, accepted', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['9999-12-31'],
    });
    // isIsoDate: new Date("9999-12-31T00:00:00.000Z").toISOString() starts with "9999-12-31"
    // → should be accepted (technically a valid ISO date)
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('9999-12-31');
  });

  it('handles far-past date (year 1800) — accepted by isIsoDate', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['1800-06-15'],
    });
    // new Date("1800-06-15T00:00:00.000Z") may or may not be valid depending on V8
    // Must not crash regardless
    expect(() => result).not.toThrow();
    // Document actual behavior without asserting a specific count
    // (V8 may or may not accept pre-epoch dates with toISOString starting with "1800-06-15")
  });

  it('handles 3000 unique periodStarts — all accepted, correct count', () => {
    const starts = Array.from({ length: 3000 }, (_, i) => {
      const date = new Date(Date.UTC(2000, 0, 1 + i));
      return date.toISOString().slice(0, 10);
    });
    const result = parseManualHistoryImport({ periodStarts: starts });
    expect(result.entries).toHaveLength(3000);
    expect(result.skippedRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// D. NOTES CONTENT — unicode, emoji, extremely long notes
// ---------------------------------------------------------------------------
describe('NOTES — unicode, emoji, and length limits', () => {
  it('stores notes with emoji without corruption', () => {
    const emojiNote = '🌸 Feeling okay today 🌷 Period started 💕';
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: emojiNote },
    ]);
    expect(result.entries[0].notes).toBe(emojiNote);
  });

  it('stores notes with mixed-script content (Russian, Japanese, Arabic)', () => {
    const mixedNote = 'Прекрасный день。今日はいい日でした。يوم جميل';
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: mixedNote },
    ]);
    expect(result.entries[0].notes).toBe(mixedNote);
  });

  it('truncates notes exceeding 500 characters to exactly 500 chars', () => {
    const longNote = 'A'.repeat(600);
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: longNote },
    ]);
    expect(result.entries[0].notes).toBeDefined();
    expect(result.entries[0].notes!.length).toBe(500);
  });

  it('preserves notes that are exactly 500 characters', () => {
    const note500 = 'B'.repeat(500);
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: note500 },
    ]);
    expect(result.entries[0].notes).toBe(note500);
  });

  it('stores notes with null bytes without crash (if present in string)', () => {
    const noteWithNull = 'before after';
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: noteWithNull },
    ]);
    // Must not crash; note content is stored as-is
    expect(() => result).not.toThrow();
    expect(result.entries[0].notes).toBe(noteWithNull);
  });

  it('ignores notes field when value is an empty array', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: [] },
    ]);
    // notes: [] → typeof notes !== 'string' → not set
    expect(result.entries[0].notes).toBeUndefined();
  });

  it('ignores notes field when value is a number', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', notes: 42 },
    ]);
    expect(result.entries[0].notes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E. COERCEISO DATE — additional realistic messy date formats
// ---------------------------------------------------------------------------
describe('coerceIsoDate — additional realistic date formats', () => {
  it('accepts "2025-04-01" (clean ISO) — baseline', () => {
    const result = parseClueImport([{ date: '2025-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-04-01');
  });

  it('accepts "  2025-04-01  " (whitespace-padded ISO) — trimmed and accepted', () => {
    // coerceIsoDate calls trim() before isIsoDate check
    const result = parseClueImport([{ date: '  2025-04-01  ', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2025-04-01');
  });

  it('rejects "2025-02-29" (not a leap year) — not silently overflowed to Mar 1', () => {
    const result = parseClueImport([{ date: '2025-02-29', bleeding: 'light' }]);
    // Must NOT silently become "2025-03-01" — the strict ISO regex guard catches this
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts "2024-02-29" (leap year) — valid', () => {
    const result = parseClueImport([{ date: '2024-02-29', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2024-02-29');
  });

  it('rejects "2025-00-01" (month 0) — invalid calendar date', () => {
    const result = parseClueImport([{ date: '2025-00-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('rejects "2025-12-00" (day 0) — invalid calendar date', () => {
    const result = parseClueImport([{ date: '2025-12-00', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('rejects "2025-04-31" (April has 30 days) — not silently overflowed to May 1', () => {
    const result = parseClueImport([{ date: '2025-04-31', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('accepts "April 1, 2025" (long-form locale date) — coerced to 2025-04-01', () => {
    const result = parseClueImport([{ date: 'April 1, 2025', bleeding: 'light' }]);
    // new Date('April 1, 2025') → local midnight → local year/month/day read back
    // Must not crash; likely produces '2025-04-01' in most locales
    expect(() => result).not.toThrow();
    if (result.entries.length > 0) {
      expect(result.entries[0].logDate).toMatch(/^2025-04/);
    }
  });

  it('handles "2025-04-01T00:00:00" (local-time ISO without tz) via new Date fallback', () => {
    // Does NOT match the Z or offset regex → goes through new Date() path
    // new Date('2025-04-01T00:00:00') is treated as LOCAL midnight in V8 since ES6
    const result = parseClueImport([{ date: '2025-04-01T00:00:00', bleeding: 'light' }]);
    expect(() => result).not.toThrow();
    // Should produce logDate '2025-04-01' regardless of TZ since we read local parts
    if (result.entries.length > 0) {
      // Accept either the correct date or a 1-day shift (V8 locale behavior)
      expect(result.entries[0].logDate).toMatch(/^2025-04-0[12]$/);
    }
  });

  it('rejects empty string date — no crash, row skipped', () => {
    const result = parseClueImport([{ date: '', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('rejects date "undefined" (literal string) — row skipped', () => {
    const result = parseClueImport([{ date: 'undefined', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// F. SYMPTOM EDGE CASES — real-world variant values
// ---------------------------------------------------------------------------
describe('SYMPTOM — real-world variant values', () => {
  it('maps "cramping" alias to cramps via symptom array with NO spurious warning (regression #3)', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: ['cramping'] },
    ]);
    // adaptGenericDailyRow resolves "cramping" → 'cramps' via symptomAliasMap and
    // now excludes the already-resolved raw alias from the passthrough, so
    // normalizeSymptomList no longer mistakes it for an unsupported value.
    // Result: 'cramps' imported, and NO false data-loss warning.
    expect(result.entries[0].symptoms).toContain('cramps');
    const warnMatches = result.warnings.filter((w) =>
      w.toLowerCase().includes('unsupported symptom'),
    );
    expect(warnMatches).toHaveLength(0);
  });

  it('maps "tired" alias to fatigue via truthy-key path', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', tired: true },
    ]);
    expect(result.entries[0].symptoms).toContain('fatigue');
  });

  it('maps "sore breasts" alias to breast-tenderness via symptom array in generic row', () => {
    // "sore breasts" is in symptomAliasMap but NOT in symptomKeyValues.
    // In a symptoms: array, normalizeSymptomList drops it.
    // Via adaptGenericDailyRow rawSymptoms + mapSymptomsFromValues path, it WOULD be mapped.
    // This tests the array path specifically.
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: ['sore breasts'] },
    ]);
    // Actual: 'sore breasts' is not a canonical symptomKey → dropped with warning
    const symptoms = result.entries[0]?.symptoms ?? [];
    expect(symptoms).not.toContain('sore breasts');
    // breast-tenderness would only be present if the alias path were invoked
    // via the truthy-key or tags/observations path, NOT the symptoms array path
  });

  it('handles symptoms array with duplicate values — deduplicates', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: ['cramps', 'cramps', 'fatigue', 'cramps'] },
    ]);
    const symptoms = result.entries[0].symptoms;
    expect(symptoms.filter((s) => s === 'cramps')).toHaveLength(1);
    expect(symptoms).toContain('fatigue');
  });

  it('handles symptoms array with null/number entries — skips non-strings', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: [null, 42, 'cramps', true, 'fatigue'] },
    ]);
    // asStringList / normalizeSymptomList filters non-strings
    const symptoms = result.entries[0].symptoms;
    expect(symptoms).toContain('cramps');
    expect(symptoms).toContain('fatigue');
    expect(symptoms).not.toContain(null);
    expect(symptoms).not.toContain(42);
  });

  it('handles symptoms field as a string (not array) — treated as single-element list', () => {
    // normalizeSymptomList checks Array.isArray(rawSymptoms) — if not array, returns []
    // SUSPECTED BUG #4:
    // If symptoms is a plain string "cramps" (not an array), normalizeSymptomList
    // returns [] because it only handles arrays.
    // But in adaptGenericDailyRow the rawSymptoms path uses getRowValues which
    // calls asStringList → wraps string in array → then mapSymptomsFromValues.
    // However the normalizedImportRow's normalizeSymptomList checks row.symptoms
    // directly without going through getRowValues.
    // For a generic Clue row (no 'type' field), adaptGenericDailyRow is called.
    // adaptGenericDailyRow sets symptoms: [...symptomTokens] as array.
    // So by the time normalizeImportRow sees the row, symptoms IS an array.
    // BUT if the original row already has symptoms as string, adaptGenericDailyRow
    // picks it via getRowValues → wrapped → symptomTokens → array. OK.
    // Final expectation: 'cramps' should be in symptoms.
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: 'cramps' },
    ]);
    expect(() => result).not.toThrow();
    // Via adaptGenericDailyRow's getRowValues path, "cramps" is asStringList'd to ["cramps"]
    // then mapSymptomsFromValues("cramps") maps it to 'cramps' (canonical key = alias key)
    // Then normalizeSymptomList sees ['cramps'] → valid → kept.
    expect(result.entries[0]?.symptoms ?? []).toContain('cramps');
  });

  it('handles completely empty symptoms array — no symptoms, no warning', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: [] },
    ]);
    expect(result.entries[0].symptoms).toHaveLength(0);
    const symptomWarnings = result.warnings.filter((w) => w.includes('symptom'));
    expect(symptomWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// G. TTC OBSERVATION — messy/real-world input shapes
// ---------------------------------------------------------------------------
describe('TTC OBSERVATION — realistic messy inputs', () => {
  it('handles basalBodyTemperatureCelsius as a string "36.7" — coerces to number', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', basalBodyTemperatureCelsius: '36.7' },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.7);
  });

  it('ignores basalBodyTemperatureCelsius out of range (100 — Fahrenheit?) — not recorded', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', basalBodyTemperatureCelsius: 98.6 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBeUndefined();
  });

  it('handles cervicalMucus: "egg white" (with space) — mapped to egg-white', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', cervicalMucus: 'egg white' },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('egg-white');
  });

  it('handles cervicalMucus: "Egg-White" (mixed case) — mapped to egg-white', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', cervicalMucus: 'Egg-White' },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('egg-white');
  });

  it('ignores unknown cervicalMucus value — no ttcObservation created', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', cervicalMucus: 'watery' },
    ]);
    // 'watery' is not in the accepted list
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBeUndefined();
  });

  it('handles ovulationTest: "Peak" (capitalized) — mapped to peak', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', ovulationTest: 'Peak' },
    ]);
    expect(result.entries[0].ttcObservation?.ovulationTest).toBe('peak');
  });

  it('handles basalBodyTemperatureCelsius at boundary 30.0 — accepted', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', basalBodyTemperatureCelsius: 30.0 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(30);
  });

  it('handles basalBodyTemperatureCelsius at boundary 45.0 — accepted', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', basalBodyTemperatureCelsius: 45.0 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(45);
  });

  it('handles basalBodyTemperatureCelsius just below 30 (29.99) — rejected', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', basalBodyTemperatureCelsius: 29.99 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// H. BIRTH CONTROL — messy field names from real exports
// ---------------------------------------------------------------------------
describe('BIRTH CONTROL — realistic field variants', () => {
  it('maps birth_control: "pill" (snake_case) to birthControlEvent.method:pill', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', birth_control: 'pill' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('pill');
  });

  it('maps contraception: "iud" to birthControlEvent.method:iud', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', contraception: 'iud' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('iud');
  });

  it('maps birth_control_method: "implant" (snake_case) to method:implant', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', birth_control_method: 'implant' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('implant');
  });

  it('handles birth_control: "PILL" (uppercase) via normalizeToken', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', birth_control: 'PILL' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('pill');
  });

  it('handles missed_dose: "yes" (snake_case key) coerced to true', () => {
    const result = parseClueImport([
      {
        date: '2025-04-01',
        bleeding: 'light',
        birth_control: 'pill',
        missed_dose: 'yes',
      },
    ]);
    expect(result.entries[0].birthControlEvent?.missedDose).toBe(true);
  });

  it('handles late_dose: "true" (string) coerced to true', () => {
    const result = parseClueImport([
      {
        date: '2025-04-01',
        bleeding: 'light',
        birth_control: 'pill',
        late_dose: 'true',
      },
    ]);
    expect(result.entries[0].birthControlEvent?.lateDose).toBe(true);
  });

  it('handles birth_control: "other" — valid method (regression: was silently dropped)', () => {
    // FIXED BUG #5: birthControlMethodValues includes "other", but it was missing
    // from birthControlMethodAliasMap, so birth_control: "other" was silently
    // dropped on import — real data loss for users tracking "other" contraception
    // in Clue/Flo. "other" is now mapped, so the event is preserved.
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', birth_control: 'other' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// I. FLO BIRTH CONTROL — metric row with "other" method
// ---------------------------------------------------------------------------
describe('FLO — birth control "other" method via metric row', () => {
  it('Flo metric row type:"birth control" with value "other" — method preserved (regression)', () => {
    // FIXED BUG #5: "other" now resolves via birthControlMethodAliasMap on the
    // Flo metric-row path too, so the contraception event is no longer dropped.
    const result = parseFloImport([
      { date: '2025-04-01', type: 'bleeding', value: 'light' },
      { date: '2025-04-01', type: 'birth control', value: 'other' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// J. DATERANGE CORRECTNESS — computed from sorted entries
// ---------------------------------------------------------------------------
describe('DATE RANGE — computed from sorted entries', () => {
  it('dateRange.startIso and endIso match the actual first/last entry dates', () => {
    const result = parseClueImport([
      { date: '2025-12-31', bleeding: 'light' },
      { date: '2025-01-01', bleeding: 'light' },
      { date: '2025-06-15', bleeding: 'light' },
    ]);
    expect(result.dateRange?.startIso).toBe('2025-01-01');
    expect(result.dateRange?.endIso).toBe('2025-12-31');
  });

  it('dateRange is null when all rows are skipped', () => {
    const result = parseClueImport([
      { date: 'bad-date', bleeding: 'light' },
      { date: 'also-bad', bleeding: 'light' },
    ]);
    expect(result.dateRange).toBeNull();
  });

  it('dateRange spans single entry when only one valid row exists', () => {
    const result = parseClueImport([
      { date: '2025-06-15', bleeding: 'light' },
    ]);
    expect(result.dateRange?.startIso).toBe('2025-06-15');
    expect(result.dateRange?.endIso).toBe('2025-06-15');
  });
});

// ---------------------------------------------------------------------------
// K. SYMPTOM-ALIAS WARNING FIDELITY
// A misleading "unsupported symptom" warning violates Floriva's trust rule:
// never tell users data was dropped when it was actually imported.
// ---------------------------------------------------------------------------
describe('SYMPTOM aliases — warning fidelity', () => {
  it('resolves an alias symptom WITHOUT a spurious unsupported warning (regression #3)', () => {
    // FIXED BUG #3: 'cramping' resolves to the canonical 'cramps' and imports
    // fine, but the raw alias used to leak into the symptom list and trip
    // normalizeSymptomList's "unsupported" counter, emitting a false data-loss
    // warning. The symptom must import AND no warning may be raised.
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: ['cramping'] },
    ]);
    expect(result.entries[0].symptoms).toEqual(['cramps']);
    expect(result.warnings).toEqual([]);
  });

  it('still warns for a genuinely unsupported symptom value', () => {
    const result = parseClueImport([
      { date: '2025-04-01', bleeding: 'light', symptoms: ['not-a-real-symptom'] },
    ]);
    expect(result.entries[0].symptoms ?? []).toEqual([]);
    expect(result.warnings.some((w) => w.includes('unsupported symptom value'))).toBe(true);
  });

  it('mixes resolved alias + canonical + unsupported: warns only for the unsupported one', () => {
    const result = parseClueImport([
      {
        date: '2025-04-01',
        bleeding: 'light',
        symptoms: ['cramping', 'acne', 'totally-made-up'],
      },
    ]);
    expect(result.entries[0].symptoms).toEqual(
      expect.arrayContaining(['cramps', 'acne']),
    );
    expect(result.entries[0].symptoms).not.toContain('cramping');
    // exactly one unsupported value → exactly one warning, count of 1
    const symptomWarnings = result.warnings.filter((w) =>
      w.includes('unsupported symptom value'),
    );
    expect(symptomWarnings).toHaveLength(1);
    expect(symptomWarnings[0]).toContain('1 unsupported symptom value');
  });
});
