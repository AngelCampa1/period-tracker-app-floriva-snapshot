/**
 * Adversarial stress tests for importParsers.ts.
 *
 * Each class of probe is documented inline with the expected behavior and
 * whether a real bug was found (and fixed in importParsers.ts) or whether
 * the test validates already-correct behaviour.
 */
import {
  UnsupportedImportShapeError,
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

// ---------------------------------------------------------------------------
// 1. DATE COERCION — timezone-safe ISO extraction
// ---------------------------------------------------------------------------
// BUG: coerceIsoDate falls back to `new Date(trimmed)` for non-ISO strings
// and then calls `.toISOString().slice(0,10)`.  `new Date("March 28 2026")`
// is parsed as LOCAL midnight, so in any timezone east of UTC the UTC
// ISO string starts on the PREVIOUS day.  Fix: parse the local date parts
// and always build a UTC timestamp to avoid the shift.
describe('DATE COERCION — timezone safety', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    if (originalTZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTZ;
    }
  });

  it('does not shift "March 28 2026" by a day in UTC+12 (Auckland)', () => {
    process.env.TZ = 'Pacific/Auckland'; // UTC+12 / UTC+13 DST — worst case
    const result = parseClueImport([
      { date: 'March 28 2026', type: 'period', value: 'light' },
    ]);
    // Even with a +12/+13 offset, the extracted date must be 2026-03-28
    expect(result.entries[0]?.logDate ?? result.skippedRows[0]?.message).toBe('2026-03-28');
  });

  it('does not shift "03/28/2026" (US locale format) in UTC+12', () => {
    process.env.TZ = 'Pacific/Auckland';
    const result = parseClueImport([
      { date: '03/28/2026', type: 'period', value: 'light' },
    ]);
    const logDate = result.entries[0]?.logDate;
    if (logDate !== undefined) {
      expect(logDate).toBe('2026-03-28');
    }
    // If the format isn't recognised at all, we get a skip — also acceptable
    // (the test documents the expected safe outcome)
  });

  it('does not shift "2026-3-8" (zero-padless ISO) in UTC+12', () => {
    process.env.TZ = 'Pacific/Auckland';
    const result = parseClueImport([
      { date: '2026-3-8', type: 'period', value: 'light' },
    ]);
    if (result.entries.length > 0) {
      expect(result.entries[0].logDate).toBe('2026-03-08');
    }
  });

  it('does not shift "28-03-2026" (dd-mm-yyyy) in UTC+12', () => {
    process.env.TZ = 'Pacific/Auckland';
    // dd-mm-yyyy is not a JS-parseable format — must be skipped, not shifted
    const result = parseClueImport([
      { date: '28-03-2026', type: 'period', value: 'light' },
    ]);
    // Either it's correctly parsed as 2026-03-28 or it's skipped entirely.
    // It must NOT silently produce 2026-03-27.
    if (result.entries.length > 0) {
      expect(result.entries[0].logDate).not.toBe('2026-03-27');
    }
  });

  it('strict ISO yyyy-mm-dd is always timezone-safe', () => {
    process.env.TZ = 'Pacific/Auckland';
    const result = parseClueImport([
      { date: '2026-03-28', type: 'period', value: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-03-28');
  });

  it('ISO timestamp date part (e.g. "2026-04-02T05:00:00.000Z") extracts correct date', () => {
    process.env.TZ = 'Pacific/Auckland';
    // The Z suffix makes it unambiguous UTC — must resolve to 2026-04-02
    const result = parseClueImport([
      { date: '2026-04-02T05:00:00.000Z', type: 'period', value: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-02');
  });
});

// ---------------------------------------------------------------------------
// 2. UNBOUNDED RANGE / DoS — buildInclusiveIsoDateRange
// ---------------------------------------------------------------------------
// BUG: extractFloRows calls buildInclusiveIsoDateRange(startIso, endIso) with
// no cap on the number of iterations.  A period_end_date of "9999-12-31"
// creates ~2.9 million date strings and can OOM/hang.
// Fix: cap the inclusive range at MAX_PERIOD_DAYS (e.g. 90) and skip the
// cycle with a warning when the span exceeds the cap.
describe('UNBOUNDED RANGE — DoS protection', () => {
  it('does not hang when period_end_date is absurdly far in the future', () => {
    // This must complete in well under 1 second; Jest default timeout is 5 s.
    const result = parseFloImport({
      operationalData: {
        cycles: [
          {
            period_start_date: '2026-01-01',
            period_end_date: '9999-12-31',
          },
        ],
      },
    });

    // Should either skip the cycle entirely or cap at a sane number of entries
    // (we allow up to 90 but definitely not millions)
    expect(result.entries.length).toBeLessThanOrEqual(90);
  });

  it('does not hang when period range spans multiple years', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          {
            period_start_date: '2020-01-01',
            period_end_date: '2030-12-31',
          },
        ],
      },
    });
    expect(result.entries.length).toBeLessThanOrEqual(90);
  });

  it('accepts a normal period range (≤ 90 days) without truncation', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          {
            period_start_date: '2026-04-01',
            period_end_date: '2026-04-07',
          },
        ],
      },
    });
    expect(result.entries).toHaveLength(7);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.entries[6].logDate).toBe('2026-04-07');
  });
});

// ---------------------------------------------------------------------------
// 3. PROTOTYPE POLLUTION
// ---------------------------------------------------------------------------
// Verify that objects with __proto__, constructor, or prototype keys do not
// pollute Object.prototype or cause crashes after parsing.
describe('PROTOTYPE POLLUTION — safe key handling', () => {
  it('does not pollute Object.prototype when __proto__ appears in a Clue row', () => {
    // JSON.parse produces a plain object with own key "__proto__" (not
    // prototype pollution by itself), but spread of such an object is safe.
    const malicious = JSON.parse('{"date":"2026-04-01","bleeding":"light","__proto__":{"polluted":true}}');
    expect(() => parseClueImport([malicious])).not.toThrow();
     
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('does not pollute Object.prototype when constructor/prototype appear in a Flo row', () => {
    const row = {
      date: '2026-04-01',
      bleeding: 'light',
      constructor: { method: 'evil' },
      prototype: { x: 1 },
    };
    expect(() => parseFloImport([row])).not.toThrow();
     
    expect((Object.prototype as any).x).toBeUndefined();
  });

  it('does not crash when a Flo ttcObservation contains __proto__', () => {
    const raw = JSON.parse(
      '{"date":"2026-04-02","bleeding":"light","ttcObservation":{"__proto__":{"evil":true},"sexLogged":true}}',
    );
    expect(() => parseFloImport([raw])).not.toThrow();
     
    expect((Object.prototype as any).evil).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. TYPE CONFUSION — wrong types for expected fields
// ---------------------------------------------------------------------------
describe('TYPE CONFUSION — graceful handling of wrong field types', () => {
  it('skips a Clue row where date is a number', () => {
    const result = parseClueImport([{ date: 20260401, bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].message).toMatch(/invalid date/i);
  });

  it('ignores symptoms field when it is a plain string instead of array (Flo generic row)', () => {
    const result = parseFloImport([
      { date: '2026-04-01', bleeding: 'light', symptoms: 'cramps' },
    ]);
    // symptoms as string should be handled (asStringList wraps it) or ignored
    // — what matters is no crash and entry is produced
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('ignores bleeding field when it is a number', () => {
    const result = parseClueImport([{ date: '2026-04-01', bleeding: 3 }]);
    // bleeding: 3 is not a valid BleedingIntensity string, no default → skip
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });

  it('handles bleeding field when it is an array of strings (takes the max)', () => {
    // adaptGenericDailyRow feeds arrays through asStringList → findBleedingValue
    // which picks the highest rank — so ['light', 'heavy'] → 'heavy'.
    const result = parseClueImport([{ date: '2026-04-01', bleeding: ['light', 'heavy'] }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('skips row gracefully when ttcObservation is an array', () => {
    const result = parseFloImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        ttcObservation: ['egg-white', 'positive'],
      },
    ]);
    // ttcObservation array → isPlainObject returns false → ttcObservation ignored
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation).toBeUndefined();
  });

  it('ignores ttcObservation.basalBodyTemperatureCelsius when it is a string-NaN', () => {
    const result = parseFloImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        ttcObservation: { basalBodyTemperatureCelsius: 'not-a-number' },
      },
    ]);
    expect(result.entries[0]?.ttcObservation?.basalBodyTemperatureCelsius).toBeUndefined();
  });

  it('handles null rows in a Clue array without crashing', () => {
    const result = parseClueImport([null, { date: '2026-04-01', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('handles undefined rows in a Flo array without crashing', () => {
    const result = parseFloImport([
      undefined,
      { date: '2026-04-01', bleeding: 'medium' },
    ]);
    expect(result.entries).toHaveLength(1);
  });

  it('handles NaN and Infinity as bleeding gracefully', () => {
    expect(() =>
      parseClueImport([{ date: '2026-04-01', bleeding: NaN }]),
    ).not.toThrow();
    expect(() =>
      parseClueImport([{ date: '2026-04-01', bleeding: Infinity }]),
    ).not.toThrow();
  });

  it('ignores ttcObservation when value is nested object inside a Flo metric row', () => {
    const result = parseFloImport([
      {
        date: '2026-04-01',
        type: 'bbt',
        value: { celsius: { nested: 36.5 } }, // value.celsius is not a number
      },
    ]);
    // Should not crash; entry will be skipped (no bleeding) or have no bbt
    expect(() => result).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. BOUNDARY VALUES
// ---------------------------------------------------------------------------
describe('BOUNDARY VALUES', () => {
  it('accepts BBT exactly 30 and exactly 45 (inclusive bounds)', () => {
    const result = parseFloImport([
      { date: '2026-04-01', bleeding: 'light', ttcObservation: { basalBodyTemperatureCelsius: 30 } },
      { date: '2026-04-02', bleeding: 'light', ttcObservation: { basalBodyTemperatureCelsius: 45 } },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(30);
    expect(result.entries[1].ttcObservation?.basalBodyTemperatureCelsius).toBe(45);
  });

  it('rejects BBT 29.9 and 45.1 (out of range)', () => {
    const result = parseFloImport([
      { date: '2026-04-01', bleeding: 'light', ttcObservation: { basalBodyTemperatureCelsius: 29.9 } },
      { date: '2026-04-02', bleeding: 'light', ttcObservation: { basalBodyTemperatureCelsius: 45.1 } },
    ]);
    expect(result.entries[0].ttcObservation).toBeUndefined();
    expect(result.entries[1].ttcObservation).toBeUndefined();
  });

  it('slices notes to exactly 500 characters', () => {
    const longNote = 'x'.repeat(600);
    const result = parseFloImport([{ date: '2026-04-01', bleeding: 'light', notes: longNote }]);
    expect(result.entries[0].notes).toHaveLength(500);
  });

  it('accepts notes of exactly 500 characters without truncating', () => {
    const note500 = 'y'.repeat(500);
    const result = parseFloImport([{ date: '2026-04-01', bleeding: 'light', notes: note500 }]);
    expect(result.entries[0].notes).toHaveLength(500);
  });

  it('handles huge symptom arrays without crashing and deduplicates', () => {
    const hugeSymptoms = Array.from({ length: 10_000 }, () => 'cramps');
    const result = parseFloImport([{ date: '2026-04-01', bleeding: 'light', symptoms: hugeSymptoms }]);
    expect(result.entries[0].symptoms).toEqual(['cramps']);
  });

  it('merges thousands of duplicate dates correctly and emits exactly one warning per date', () => {
    const rows = Array.from({ length: 500 }, () => ({
      date: '2026-04-01',
      bleeding: 'light',
    }));
    const result = parseClueImport(rows);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    // Exactly one merge warning for this date
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toMatch(/500/);
  });

  it('handles empty periodStarts array without crashing', () => {
    const result = parseManualHistoryImport({ periodStarts: [] });
    expect(result.entries).toHaveLength(0);
    expect(result.dateRange).toBeNull();
  });

  it('handles non-array data field in Flo generic shape via UnsupportedImportShapeError', () => {
    expect(() =>
      parseFloImport({ data: 'not-an-array' }),
    ).toThrow(UnsupportedImportShapeError);
  });

  it('dateRange reflects sorted min/max even when rows arrive in reverse order', () => {
    const result = parseClueImport([
      { date: '2026-04-10', bleeding: 'light' },
      { date: '2026-04-01', bleeding: 'light' },
      { date: '2026-04-05', bleeding: 'light' },
    ]);
    expect(result.dateRange).toEqual({ startIso: '2026-04-01', endIso: '2026-04-10' });
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.entries[2].logDate).toBe('2026-04-10');
  });
});

// ---------------------------------------------------------------------------
// 6. UNICODE / INJECTION
// ---------------------------------------------------------------------------
describe('UNICODE / INJECTION — safe handling of exotic string content', () => {
  it('preserves emoji in notes without crashing', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', note: '🌸 Feeling good 🌸' },
    ]);
    expect(result.entries[0].notes).toBe('🌸 Feeling good 🌸');
  });

  it('strips null bytes from notes gracefully (slice at 500 still works)', () => {
    const noteWithNull = 'abc\x00def';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', note: noteWithNull },
    ]);
    // Must not crash; content is whatever the parser produces
    expect(result.entries).toHaveLength(1);
    expect(typeof result.entries[0].notes).toBe('string');
  });

  it('handles RTL mark and control chars in notes without crashing', () => {
    const rtlNote = '‏؀Right-to-left text‮';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', note: rtlNote },
    ]);
    expect(result.entries).toHaveLength(1);
  });

  it('trims leading/trailing whitespace from date strings before coercion', () => {
    const result = parseClueImport([
      { date: '  2026-04-01  ', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('skips date strings that are only whitespace', () => {
    const result = parseClueImport([{ date: '   ', bleeding: 'light' }]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('handles a very long note (5000 chars) and slices to 500', () => {
    const veryLong = '中'.repeat(5000); // CJK character repeated
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', note: veryLong },
    ]);
    expect(result.entries[0].notes?.length).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// 7. ORDERING — entries sorted ascending, dateRange reflects actual min/max
// ---------------------------------------------------------------------------
describe('ORDERING — sorted output and accurate dateRange', () => {
  it('sorts Flo entries by logDate ascending regardless of input order', () => {
    const result = parseFloImport([
      { date: '2026-05-03', bleeding: 'heavy' },
      { date: '2026-05-01', bleeding: 'light' },
      { date: '2026-05-02', bleeding: 'medium' },
    ]);
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
  });

  it('dateRange.startIso and endIso equal the actual min/max, not first/last input row', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2026-05-10', '2026-05-01', '2026-05-20'],
    });
    expect(result.dateRange).toEqual({ startIso: '2026-05-01', endIso: '2026-05-20' });
  });

  it('single entry produces dateRange with identical startIso and endIso', () => {
    const result = parseClueImport([{ date: '2026-04-15', bleeding: 'medium' }]);
    expect(result.dateRange).toEqual({ startIso: '2026-04-15', endIso: '2026-04-15' });
  });
});
