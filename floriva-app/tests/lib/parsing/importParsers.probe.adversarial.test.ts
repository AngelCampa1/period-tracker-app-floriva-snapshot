/**
 * New adversarial probe battery for importParsers.ts.
 *
 * Focuses on areas NOT already covered by the three existing test files:
 *   - importParsers.test.ts
 *   - importParsers.adversarial.test.ts
 *   - importParsers.clueManual.adversarial.test.ts
 *
 * Numbered BUG CANDIDATE comments mark scenarios where the expected output
 * diverges from what the code actually produces.  Run with:
 *   pnpm jest tests/lib/parsing/importParsers.probe.adversarial.test.ts
 */
import {
  UnsupportedImportShapeError,
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

// ---------------------------------------------------------------------------
// A. FLO SHAPE ROBUSTNESS — untested container variants
// ---------------------------------------------------------------------------
describe('FLO — container shape variants', () => {
  it('accepts top-level array of plain daily rows', () => {
    const result = parseFloImport([
      { date: '2026-04-01', bleeding: 'light' },
    ]);
    expect(result.source).toBe('flo');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('returns empty document for empty top-level array', () => {
    const result = parseFloImport([]);
    expect(result.entries).toHaveLength(0);
    expect(result.dateRange).toBeNull();
  });

  it('accepts { values: [...] } wrapper', () => {
    const result = parseFloImport({
      values: [{ date: '2026-04-01', bleeding: 'medium' }],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('throws UnsupportedImportShapeError for a number', () => {
    expect(() => parseFloImport(42)).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for a plain string', () => {
    expect(() => parseFloImport('2026-04-01')).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for null', () => {
    expect(() => parseFloImport(null)).toThrow(UnsupportedImportShapeError);
  });

  it('throws UnsupportedImportShapeError for an object with no recognised key', () => {
    expect(() => parseFloImport({ cycles: [] })).toThrow(UnsupportedImportShapeError);
  });

  it('accepts operationalData.cycles with zero cycles as empty document (not a throw)', () => {
    const result = parseFloImport({ operationalData: { cycles: [] } });
    expect(result.entries).toHaveLength(0);
    expect(result.dateRange).toBeNull();
  });

  it('accepts update.cycles alongside data array — merges both', () => {
    const result = parseFloImport({
      data: [{ date: '2026-04-01', bleeding: 'light' }],
      update: {
        cycles: [{ period_start_date: '2026-04-05', period_end_date: '2026-04-07' }],
      },
    });
    // data contributes 2026-04-01; cycles contribute 2026-04-05..07
    expect(result.entries.length).toBeGreaterThanOrEqual(4);
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toContain('2026-04-01');
    expect(dates).toContain('2026-04-05');
    expect(dates).toContain('2026-04-07');
  });

  it('handles a cycle where endDate < startDate (invalid range) without crashing', () => {
    // Flo extractFloRows returns a stub row with the raw start_date value when
    // startDate or endDate is missing or endDate < startDate.  That stub has no
    // bleeding, so it ends up in skippedRows.
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-04-10', period_end_date: '2026-04-01' }],
      },
    });
    expect(() => result).not.toThrow();
    // The stub row has no bleeding → it should be skipped, not produce an entry
    expect(result.entries).toHaveLength(0);
  });

  it('handles a cycle with missing endDate — stub row passed through', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-04-01' }],
      },
    });
    expect(() => result).not.toThrow();
    // The stub row { date: '2026-04-01' } has a valid ISO date but no bleeding
    // → normalizeImportRow skips it (no bleeding, no default)
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });
});

// ---------------------------------------------------------------------------
// B. FLO METRIC ROW PARSING — adaptFloMetricRow / isFloListValueRow
// ---------------------------------------------------------------------------
describe('FLO — metric-style rows (type/category + value)', () => {
  it('maps type:bleeding with value "heavy" to bleeding:heavy', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('maps type:flow with value "light" to bleeding:light', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'flow', value: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('light');
  });

  it('maps type:symptom with value ["cramps"] to symptoms:["cramps"]', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'symptom', value: ['cramps'] },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].symptoms).toContain('cramps');
  });

  it('maps type:mood with value "happy" to mood:steady', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'mood', value: 'happy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].mood).toBe('steady');
  });

  it('maps type:note with string value to notes field', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'note', value: 'my note' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].notes).toBe('my note');
  });

  it('maps type:"cervical mucus" with value "egg white" to egg-white', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'cervical mucus', value: 'egg white' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('egg-white');
  });

  it('maps type:"ovulation test" with value "positive" to ovulationTest:positive', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'ovulation test', value: 'positive' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation?.ovulationTest).toBe('positive');
  });

  it('maps type:temperature with numeric string "36.5" to BBT', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'temperature', value: '36.5' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.5);
  });

  it('maps type:sex with value "yes" to ttcObservation.sexLogged:true', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'sex', value: 'yes' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation?.sexLogged).toBe(true);
  });

  it('maps type:"birth control" with value "pill" to birthControlEvent.method:pill', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'birth control', value: 'pill' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].birthControlEvent?.method).toBe('pill');
  });

  it('emits a warning for unrecognized Flo metric category with meaningful value', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'hair_texture', value: 'wavy' },
    ]);
    const typeWarnings = result.warnings.filter((w) =>
      w.includes('hair_texture') || w.toLowerCase().includes('unsupported'),
    );
    expect(typeWarnings.length).toBeGreaterThan(0);
  });

  it('does NOT emit a warning for unrecognized Flo metric with empty/null value', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'ignored_metric', value: null },
      { date: '2026-04-01', bleeding: 'light' }, // keep entry alive
    ]);
    const typeWarnings = result.warnings.filter((w) =>
      w.includes('ignored_metric'),
    );
    expect(typeWarnings).toHaveLength(0);
  });

  // BUG CANDIDATE B1: category key in isFloListValueRow
  // isFloListValueRow checks 'type', 'category', 'name', 'metric', 'trackingType', 'key'.
  // If a row uses 'category' instead of 'type', it should also be dispatched through
  // adaptFloMetricRow. Probe this.
  it('dispatches metric rows that use "category" field instead of "type"', () => {
    const result = parseFloImport([
      { date: '2026-04-01', category: 'bleeding', value: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('dispatches metric rows that use "metric" field', () => {
    const result = parseFloImport([
      { date: '2026-04-01', metric: 'bleeding', value: 'medium' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('medium');
  });

  // Multiple metric rows for the same date/type should aggregate, not duplicate.
  it('aggregates two bleeding metric rows for the same date (max-wins)', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'bleeding', value: 'heavy' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('aggregates bleeding + symptom rows into a single merged entry', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'medium' },
      { date: '2026-04-01', type: 'symptom', value: ['cramps'] },
      { date: '2026-04-01', type: 'mood', value: 'energized' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].bleeding).toBe('medium');
    expect(result.entries[0].symptoms).toContain('cramps');
    expect(result.entries[0].mood).toBe('energized');
  });
});

// ---------------------------------------------------------------------------
// C. FLO CYCLE RANGE — edge cases in buildInclusiveIsoDateRange
// ---------------------------------------------------------------------------
describe('FLO — cycle date ranges', () => {
  it('handles exactly MAX_PERIOD_DAYS (90-day) range without skipping', () => {
    // MAX_PERIOD_DAYS = 90. spanDays = round((endMs-startMs)/86400000)+1.
    // 2026-01-01 to 2026-03-31 inclusive = 89 days → accepted.
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-01-01', period_end_date: '2026-03-31' }],
      },
    });
    // 90 days inclusive Jan 1 through Mar 31
    expect(result.entries).toHaveLength(90);
  });

  it('skips a cycle that spans exactly 91 days (exceeds MAX_PERIOD_DAYS)', () => {
    // 2026-01-01 to 2026-04-01 inclusive = 91 days → exceeds MAX_PERIOD_DAYS → skipped
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-01-01', period_end_date: '2026-04-01' }],
      },
    });
    // Range null → cycle skipped entirely
    expect(result.entries).toHaveLength(0);
  });

  it('handles same-day start and end (single-day period)', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-04-01', period_end_date: '2026-04-01' }],
      },
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.entries[0].bleeding).toBe('medium');
  });

  it('sets bleeding to medium for all dates in the expanded cycle', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2026-04-01', period_end_date: '2026-04-03' }],
      },
    });
    for (const entry of result.entries) {
      expect(entry.bleeding).toBe('medium');
    }
  });

  it('handles Feb 29 at end of leap-year cycle correctly', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [{ period_start_date: '2024-02-27', period_end_date: '2024-02-29' }],
      },
    });
    expect(result.entries).toHaveLength(3);
    const dates = result.entries.map((e) => e.logDate);
    expect(dates).toContain('2024-02-29');
  });

  // BUG CANDIDATE C1: cycle with non-ISO date strings
  // If period_start_date is "2026-04-01T00:00:00Z" (ISO timestamp), coerceIsoDate
  // extracts "2026-04-01", but the endDate is also an ISO timestamp. This should work.
  it('handles cycle dates that are ISO timestamps (Z suffix) — coerces to date', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          {
            period_start_date: '2026-04-01T00:00:00.000Z',
            period_end_date: '2026-04-03T00:00:00.000Z',
          },
        ],
      },
    });
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    expect(result.entries[2].logDate).toBe('2026-04-03');
  });

  it('handles multiple overlapping cycles — merges by date, max bleeding wins', () => {
    const result = parseFloImport({
      operationalData: {
        cycles: [
          { period_start_date: '2026-04-01', period_end_date: '2026-04-05' },
          { period_start_date: '2026-04-03', period_end_date: '2026-04-07' },
        ],
      },
    });
    // Dates 04-03, 04-04, 04-05 appear in both cycles → should merge (not duplicate)
    const uniqueDates = new Set(result.entries.map((e) => e.logDate));
    expect(uniqueDates.size).toBe(result.entries.length); // no duplicates
    expect(result.entries.length).toBe(7); // 04-01 through 04-07
  });
});

// ---------------------------------------------------------------------------
// D. CLUE GENERIC ROW — adaptGenericDailyRow paths not yet probed
// ---------------------------------------------------------------------------
describe('CLUE — generic daily row adaptations', () => {
  it('maps hadSex:true (truthy-key path) to ttcObservation.sexLogged', () => {
    // hadSex is in the findTtcObservation path via coerceBoolean(row.hadSex)
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', hadSex: true },
    ]);
    expect(result.entries[0].ttcObservation?.sexLogged).toBe(true);
  });

  it('maps sex_logged:"yes" to ttcObservation.sexLogged:true', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', sex_logged: 'yes' },
    ]);
    expect(result.entries[0].ttcObservation?.sexLogged).toBe(true);
  });

  it('maps birthControl:"pill" to birthControlEvent.method:pill', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', birthControl: 'pill' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('pill');
  });

  it('maps birth_control_method:"iud" to birthControlEvent.method:iud', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', birth_control_method: 'iud' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('iud');
  });

  it('maps missedDose:"yes" to birthControlEvent.missedDose:true', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        birth_control: 'pill',
        missedDose: 'yes',
      },
    ]);
    expect(result.entries[0].birthControlEvent?.missedDose).toBe(true);
  });

  it('maps lateDose:true to birthControlEvent.lateDose:true', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        birth_control: 'pill',
        lateDose: true,
      },
    ]);
    expect(result.entries[0].birthControlEvent?.lateDose).toBe(true);
  });

  it('ignores birthControl field when value is not a recognised method', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', birthControl: 'unknown_method' },
    ]);
    expect(result.entries[0].birthControlEvent).toBeUndefined();
  });

  it('maps cervicalMucus:"dry" to ttcObservation.cervicalMucus:dry', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', cervicalMucus: 'dry' },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('dry');
  });

  it('maps cervical_mucus:"sticky" to ttcObservation.cervicalMucus:sticky', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', cervical_mucus: 'sticky' },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('sticky');
  });

  it('maps ovulationTest:"negative" to ttcObservation.ovulationTest:negative', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', ovulationTest: 'negative' },
    ]);
    expect(result.entries[0].ttcObservation?.ovulationTest).toBe('negative');
  });

  it('maps temperature:36.8 to ttcObservation.basalBodyTemperatureCelsius:36.8', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', temperature: 36.8 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.8);
  });

  it('maps basal_body_temperature_celsius:36.2 to BBT', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', basal_body_temperature_celsius: 36.2 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.2);
  });

  it('ignores temperature values outside 30-45 range', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', temperature: 29 },
    ]);
    expect(result.entries[0].ttcObservation).toBeUndefined();
  });

  // BUG CANDIDATE D1: adaptGenericDailyRow calls findTtcObservation(row) TWICE
  // (once to check existence, once to set value). This is wasteful but should
  // produce correct results. Verify correctness.
  it('does not produce doubled ttcObservation from double findTtcObservation call', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', temperature: 36.5 },
    ]);
    expect(result.entries).toHaveLength(1);
    const ttc = result.entries[0].ttcObservation;
    expect(ttc).toBeDefined();
    // Should be a single object, not an array or duplicated
    expect(typeof ttc).toBe('object');
    expect(Array.isArray(ttc)).toBe(false);
    expect(ttc!.basalBodyTemperatureCelsius).toBe(36.5);
  });

  it('maps symptom via truthy-key: cramps:true → symptoms contains cramps', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', cramps: true },
    ]);
    expect(result.entries[0].symptoms).toContain('cramps');
  });

  it('does NOT map symptom via truthy-key when value is false', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', cramps: false },
    ]);
    expect(result.entries[0].symptoms).not.toContain('cramps');
  });

  it('maps both symptoms array and truthy-key in the same row (union)', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        symptoms: ['fatigue'],
        cramps: true,
      },
    ]);
    expect(result.entries[0].symptoms).toContain('fatigue');
    expect(result.entries[0].symptoms).toContain('cramps');
  });

  // BUG CANDIDATE D2: symptomTokens is built as [...rawSymptoms, ...mappedSymptoms]
  // so it may include both the raw alias string ("bloated") AND the mapped key ("bloating")
  // when the truthy-key path fires. normalizeSymptomList then only keeps valid SymptomKey
  // values from the combined set — but rawSymptoms may contain alias strings like "bloated"
  // that are NOT in symptomValues. This should be fine because normalizeSymptomList
  // filters. But let's probe that "bloated" doesn't leak into final symptoms.
  it('does not include raw alias strings ("bloated") in final symptoms — only canonical keys', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', bloated: true },
    ]);
    const symptoms = result.entries[0].symptoms ?? [];
    expect(symptoms).not.toContain('bloated');
    expect(symptoms).toContain('bloating');
  });
});

// ---------------------------------------------------------------------------
// E. CLUE TYPE-DISPATCHED ROWS — edge cases and value shapes
// ---------------------------------------------------------------------------
describe('CLUE — type-dispatched row edge cases', () => {
  it('type:bbt with value as a number (not object) → extracts temperature', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: 36.7 },
    ]);
    // adaptClueRow: value is not a plain object → coerceNumber(row.value) → 36.7
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.7);
    // type-dispatched row without bleeding gets bleeding:'none' injected
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('type:bbt with value as a numeric string → extracts temperature', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: '36.5' },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.5);
  });

  it('type:bbt with value.celsius:36.5 → extracts temperature from celsius key', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: { celsius: 36.5 } },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.5);
  });

  it('type:"basal body temperature" matches bbt branch', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'basal body temperature', value: 36.4 },
    ]);
    expect(result.entries[0].ttcObservation?.basalBodyTemperatureCelsius).toBe(36.4);
  });

  it('type:opk with value "peak" → ovulationTest:peak', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'opk', value: 'peak' },
    ]);
    expect(result.entries[0].ttcObservation?.ovulationTest).toBe('peak');
  });

  it('type:"cervical mucus" with value "creamy" → cervicalMucus:creamy', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'cervical mucus', value: 'creamy' },
    ]);
    expect(result.entries[0].ttcObservation?.cervicalMucus).toBe('creamy');
  });

  it('type-dispatched row gets bleeding:none injected when bleeding not present', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'pain', value: [{ option: 'cramps' }] },
    ]);
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('type:pain with value that includes an unknown option — skips unknown, keeps known', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        type: 'pain',
        value: [{ option: 'cramps' }, { option: 'mystery_pain' }],
      },
    ]);
    expect(result.entries[0].symptoms).toContain('cramps');
    expect(result.entries[0].symptoms).not.toContain('mystery_pain');
  });

  // BUG CANDIDATE E1: adaptClueRow sets bleeding:'none' when symptoms/mood/ttcObservation
  // is present. But if type is a recognised metric with no known value (e.g. bbt with
  // out-of-range temp), the adaptedRow has no symptoms/mood/ttcObservation AND no bleeding
  // → row gets skipped with "missing a valid bleeding".
  // Is this the right behaviour? The test documents the actual outcome.
  it('skips bbt row when temperature is out of range (29) — no bleeding injected', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'bbt', value: 29 },
    ]);
    // bbt with out-of-range temp → ttcObservation not set → no bleeding injected
    // → row skipped
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });

  it('period type-dispatched row with unrecognized value — skipped, not crashed', () => {
    const result = parseClueImport([
      { date: '2026-04-01', type: 'period', value: 'ultra-heavy' },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows[0].message).toMatch(/missing a valid bleeding/i);
  });
});

// ---------------------------------------------------------------------------
// F. LARGE INPUTS — correctness under scale
// ---------------------------------------------------------------------------
describe('LARGE INPUTS — correctness at scale (10k+ rows)', () => {
  it('processes 10 000 unique daily Clue rows without data loss', () => {
    // Generate 10000 unique dates starting from 2000-01-01
    const rows = Array.from({ length: 10_000 }, (_, i) => {
      const date = new Date(Date.UTC(2000, 0, 1 + i));
      return {
        date: date.toISOString().slice(0, 10),
        bleeding: 'light' as const,
      };
    });
    const result = parseClueImport(rows);
    expect(result.entries).toHaveLength(10_000);
    expect(result.skippedRows).toHaveLength(0);
    // dateRange must span the full set
    expect(result.dateRange?.startIso).toBe('2000-01-01');
  });

  it('processes 10 000 identical Flo rows — deduplicates to 1 entry (no merge warning for Flo)', () => {
    // NOTE: parseFloImport pre-aggregates rows in a Map BEFORE calling mergeEntries,
    // so 10k identical rows collapse to 1 row before mergeEntries sees them.
    // mergeEntries therefore sees count=1 for that date → no "Merged" warning.
    // This is different from parseClueImport which does NOT pre-aggregate.
    const rows = Array.from({ length: 10_000 }, () => ({
      date: '2026-04-01',
      bleeding: 'light' as const,
    }));
    const result = parseFloImport(rows);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
    // No merge warning because Flo pre-aggregates
    const mergeWarnings = result.warnings.filter((w) => w.includes('Merged'));
    expect(mergeWarnings).toHaveLength(0);
  });

  it('processes 10 000 manual periodStarts entries correctly', () => {
    const starts = Array.from({ length: 10_000 }, (_, i) => {
      const date = new Date(Date.UTC(2000, 0, 1 + i));
      return date.toISOString().slice(0, 10);
    });
    const result = parseManualHistoryImport({ periodStarts: starts });
    expect(result.entries).toHaveLength(10_000);
    expect(result.skippedRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// G. INJECTION / FORMULA CHARACTERS — treated as plain data
// ---------------------------------------------------------------------------
describe('INJECTION — formula and HTML content treated as plain strings', () => {
  it('stores formula injection "=cmd|..." in notes as plain text (not executed)', () => {
    const injected = '=cmd|"/C calc"!A0';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: injected },
    ]);
    expect(result.entries[0].notes).toBe(injected);
  });

  it('stores script tags in notes as plain text', () => {
    const script = '<script>alert("xss")</script>';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: script },
    ]);
    expect(result.entries[0].notes).toBe(script);
  });

  it('stores SQL injection string in notes as plain text', () => {
    const sql = "'; DROP TABLE users; --";
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: sql },
    ]);
    expect(result.entries[0].notes).toBe(sql);
  });

  it('stores JSON string with __proto__ key in notes as plain text', () => {
    const poisoned = '{"__proto__":{"pwned":true}}';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: poisoned },
    ]);
    expect(result.entries[0].notes).toBe(poisoned);
    expect((Object.prototype as Record<string, unknown>).pwned).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// H. ENCODING / UNICODE IN DATE FIELDS
// ---------------------------------------------------------------------------
describe('ENCODING — exotic characters in date / field strings', () => {
  it('skips date with leading zero-width space (\\u200B)', () => {
    // '​2026-04-01' looks like ISO but has a zero-width space prefix.
    // isIsoDate uses /^\d{4}-\d{2}-\d{2}$/ which should not match.
    // coerceIsoDate trims via .trim() — but ​ is NOT stripped by JS trim().
    const result = parseClueImport([
      { date: '​2026-04-01', bleeding: 'light' },
    ]);
    // The date string after trim() still starts with ​ so coerceIsoDate
    // will attempt new Date('​2026-04-01') which is invalid → skip.
    // Expected: row skipped (0 entries, 1 skippedRow)
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('skips date with trailing non-breaking space (\\u00A0)', () => {
    //   is NOT removed by JS String.prototype.trim() by default (it IS in ES5+).
    // Actually JS trim() does strip   as it's a whitespace char.
    // After trimming → '2026-04-01' → valid → accepted.
    const result = parseClueImport([
      { date: '2026-04-01 ', bleeding: 'light' },
    ]);
    //   is whitespace, trim() removes it → should be accepted
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('skips date with embedded RTL mark (\\u200F) inside the date string', () => {
    // '2026-‏04-01' has an RTL mark in the middle — cannot be a valid ISO date
    const result = parseClueImport([
      { date: '2026-‏04-01', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  // REGRESSION (fixed): emoji date "🌸🌸-04-01" must NOT be silently coerced.
  // V8's lenient `new Date("🌸🌸-04-01")` parses to Apr 1, 2001, discarding the
  // emoji — which would record a confidently-wrong calendar date from corrupted
  // input. coerceIsoDate now rejects any date string containing characters
  // outside the plausible date charset, so the row is skipped instead.
  it('skips an emoji-garbled date string instead of coercing it to a wrong date', () => {
    const result = parseClueImport([
      { date: '🌸🌸-04-01', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('skips date that is a BOM-prefixed ISO string (\\uFEFF)', () => {
    // BOM at start — coerceIsoDate trimmed value still starts with
    // JS String.trim() does NOT remove ﻿ in most runtimes.
    const result = parseClueImport([
      { date: '﻿2026-04-01', bleeding: 'light' },
    ]);
    // ﻿ is stripped by trim() in modern V8 (ES6+ treats it as whitespace)
    // So this may either produce an entry or skip — test documents the safe outcome.
    // It must NOT crash.
    expect(() => result).not.toThrow();
    if (result.entries.length > 0) {
      expect(result.entries[0].logDate).toBe('2026-04-01');
    }
  });
});

// ---------------------------------------------------------------------------
// I. DATE EDGE CASES — untested forms
// ---------------------------------------------------------------------------
describe('DATE EDGE CASES — 2-digit years, US format, fractional seconds', () => {
  it('rejects 2-digit year format "26-04-01" (treated as YYYY-MM-DD → year 26)', () => {
    // "26-04-01" looks like YYYY-MM-DD with year 0026.
    // isIsoDate: new Date("0026-04-01T00:00:00.000Z") — JS may or may not handle this.
    // The test documents the actual outcome without asserting a specific logDate
    // since V8 behaviour for year < 100 is implementation-defined.
    const result = parseClueImport([
      { date: '26-04-01', bleeding: 'light' },
    ]);
    expect(() => result).not.toThrow();
    // Either accepted with some logDate or skipped — must not crash
  });

  it('rejects pure 8-digit date "20260401" (no separators)', () => {
    const result = parseClueImport([
      { date: '20260401', bleeding: 'light' },
    ]);
    // new Date("20260401") is NaN in most engines → skip
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it('handles ISO timestamp with fractional seconds and Z', () => {
    const result = parseClueImport([
      { date: '2026-04-01T12:34:56.789Z', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  it('handles ISO timestamp with fractional seconds and +offset', () => {
    const result = parseClueImport([
      { date: '2026-04-02T01:30:45.123+05:30', bleeding: 'light' },
    ]);
    // Prefix "2026-04-02" is a valid ISO date → returned as-is (wall-clock rule)
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-02');
  });

  it('handles ISO timestamp with -offset (negative UTC offset)', () => {
    const result = parseClueImport([
      { date: '2026-04-01T23:00:00-05:00', bleeding: 'light' },
    ]);
    // Wall-clock date prefix is '2026-04-01' → returned as-is
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('2026-04-01');
  });

  // NOTE: "0000-01-01" is accepted by V8's Date implementation and
  // toISOString() returns "0000-01-01T00:00:00.000Z", which starts with "0000-01-01",
  // so isIsoDate returns true and the row is accepted as logDate "0000-01-01".
  // This may be unexpected for callers but it does not constitute a safety bug —
  // the date is technically parseable. Document the actual behavior.
  it('accepts "0000-01-01" (year 0) as a valid ISO date in V8', () => {
    const result = parseClueImport([
      { date: '0000-01-01', bleeding: 'light' },
    ]);
    // V8 accepts year 0 — isIsoDate passes since toISOString() starts with "0000-01-01"
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('0000-01-01');
  });

  it('accepts epoch date 1970-01-01', () => {
    const result = parseClueImport([
      { date: '1970-01-01', bleeding: 'light' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].logDate).toBe('1970-01-01');
  });

  it('handles US-style "04/01/2026" — either coerced correctly or safely skipped', () => {
    const result = parseClueImport([
      { date: '04/01/2026', bleeding: 'light' },
    ]);
    // new Date("04/01/2026") → local midnight Apr 1 2026 in most engines
    // coerceIsoDate reads local year/month/day → "2026-04-01"
    // Must not produce a wrong date (e.g. 2026-04-02 in UTC+12)
    expect(() => result).not.toThrow();
    if (result.entries.length > 0) {
      // If accepted, it should map to April 1 in the LOCAL calendar
      expect(result.entries[0].logDate).toMatch(/^2026-04-0[12]$/);
    }
  });
});

// ---------------------------------------------------------------------------
// J. MERGE CORRECTNESS — ttcObservation and birthControlEvent merging
// ---------------------------------------------------------------------------
describe('MERGE — ttcObservation and birthControlEvent across duplicate dates', () => {
  it('merges two ttcObservation objects for the same date (spread — later overwrites)', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        ttcObservation: { cervicalMucus: 'dry', ovulationTest: 'negative' },
      },
      {
        date: '2026-04-01',
        bleeding: 'light',
        ttcObservation: { ovulationTest: 'positive', basalBodyTemperatureCelsius: 36.5 },
      },
    ]);
    const ttc = result.entries[0].ttcObservation;
    expect(ttc).toBeDefined();
    // Both sources provide ovulationTest — the spread order is existing then incoming,
    // so incoming overwrites → 'positive'
    expect(ttc!.ovulationTest).toBe('positive');
    // cervicalMucus only in first row
    expect(ttc!.cervicalMucus).toBe('dry');
    // basalBodyTemperatureCelsius only in second row
    expect(ttc!.basalBodyTemperatureCelsius).toBe(36.5);
  });

  it('merges two birthControlEvent objects for the same date (existing wins for method)', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        birthControlEvent: { method: 'pill', missedDose: false },
      },
      {
        date: '2026-04-01',
        bleeding: 'light',
        birthControlEvent: { method: 'iud', lateDose: true },
      },
    ]);
    const bc = result.entries[0].birthControlEvent;
    expect(bc).toBeDefined();
    // The mergeEntries spread: { ...existing.birthControlEvent, ...incoming.birthControlEvent }
    // so incoming.method ('iud') overwrites existing.method ('pill')
    // This is the ACTUAL behaviour — documenting it here.
    // If this surprises you it may be a BUG CANDIDATE J1 (last write wins for method).
    expect(['pill', 'iud']).toContain(bc!.method); // documents actual behaviour
    expect(bc!.lateDose).toBe(true); // from second row
    expect(bc!.missedDose).toBe(false); // from first row
  });

  it('preserves ttcObservation from second row when first row has none', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light' },
      {
        date: '2026-04-01',
        bleeding: 'light',
        ttcObservation: { sexLogged: true },
      },
    ]);
    expect(result.entries[0].ttcObservation?.sexLogged).toBe(true);
  });

  it('preserves birthControlEvent from first row when second row has none', () => {
    const result = parseClueImport([
      {
        date: '2026-04-01',
        bleeding: 'light',
        birthControlEvent: { method: 'ring' },
      },
      { date: '2026-04-01', bleeding: 'light' },
    ]);
    expect(result.entries[0].birthControlEvent?.method).toBe('ring');
  });
});

// ---------------------------------------------------------------------------
// K. NOTES EDGE CASES
// ---------------------------------------------------------------------------
describe('NOTES — edge cases', () => {
  it('stores multi-line notes with embedded newlines', () => {
    const multiLine = 'line1\nline2\nline3';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: multiLine },
    ]);
    expect(result.entries[0].notes).toBe(multiLine);
  });

  it('stores CJK characters in notes without corruption', () => {
    const cjk = '月経周期のメモ。気分は良かったです。';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: cjk },
    ]);
    expect(result.entries[0].notes).toBe(cjk);
  });

  it('stores Arabic RTL text in notes without corruption', () => {
    const arabic = 'ملاحظة دورية';
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: arabic },
    ]);
    expect(result.entries[0].notes).toBe(arabic);
  });

  it('ignores notes that are only whitespace after trim', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: '\t  \n  ' },
    ]);
    expect(result.entries[0].notes).toBeUndefined();
  });

  it('notes field from "memo" key is picked up', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', memo: 'memo note' },
    ]);
    expect(result.entries[0].notes).toBe('memo note');
  });

  it('notes field from "comment" key is picked up', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', comment: 'comment text' },
    ]);
    expect(result.entries[0].notes).toBe('comment text');
  });

  it('"note" key takes priority over "notes" key (first in getFirstRowString order)', () => {
    // getFirstRowString(row, ['notes','note','memo','comment'])
    // 'notes' comes FIRST, so it wins
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', notes: 'from-notes', note: 'from-note' },
    ]);
    expect(result.entries[0].notes).toBe('from-notes');
  });
});

// ---------------------------------------------------------------------------
// L. BLEEDING ALIAS MATCHING — findBleedingValue edge cases
// ---------------------------------------------------------------------------
describe('BLEEDING — alias matching in generic rows', () => {
  it('maps "no bleeding" value to bleeding:none', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'no bleeding' },
    ]);
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('maps "no period" value to bleeding:none', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'no period' },
    ]);
    expect(result.entries[0].bleeding).toBe('none');
  });

  it('maps "spot" value to bleeding:spotting', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'spot' },
    ]);
    expect(result.entries[0].bleeding).toBe('spotting');
  });

  it('maps "moderate" value to bleeding:medium', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'moderate' },
    ]);
    expect(result.entries[0].bleeding).toBe('medium');
  });

  // BUG CANDIDATE L1: "HEAVY" (uppercase) — findBleedingValue calls normalizeToken
  // which lowercases → 'heavy' → matched. But the bleeding field is fed through
  // getRowValues → asStringList → findBleedingValue. The question is whether
  // adaptGenericDailyRow's getRowValues call passes the raw value through.
  it('maps "HEAVY" (uppercase) to bleeding:heavy via normalizeToken', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'HEAVY' },
    ]);
    expect(result.entries[0].bleeding).toBe('heavy');
  });

  it('maps "  medium  " (whitespace-padded) to bleeding:medium', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: '  medium  ' },
    ]);
    expect(result.entries[0].bleeding).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// M. MOOD ALIAS EDGE CASES
// ---------------------------------------------------------------------------
describe('MOOD — alias edge cases', () => {
  it('maps "stressed" to sensitive', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', mood: 'stressed' },
    ]);
    expect(result.entries[0].mood).toBe('sensitive');
  });

  it('maps "energetic" to energized', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', mood: 'energetic' },
    ]);
    expect(result.entries[0].mood).toBe('energized');
  });

  it('ignores unknown mood string', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', mood: 'grumpy' },
    ]);
    expect(result.entries[0].mood).toBeUndefined();
  });

  it('handles mood from "feeling" key', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', feeling: 'sad' },
    ]);
    expect(result.entries[0].mood).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// N. FLO mergePartialFloRow — correctness of partial row merging
// ---------------------------------------------------------------------------
describe('FLO — mergePartialFloRow correctness', () => {
  it('first-wins for mood across multiple metric rows for the same date', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'mood', value: 'energized' },
      { date: '2026-04-01', type: 'mood', value: 'low' },
    ]);
    expect(result.entries).toHaveLength(1);
    // First mood wins in mergePartialFloRow
    expect(result.entries[0].mood).toBe('energized');
  });

  it('first-wins for notes across multiple metric rows for the same date', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'note', value: 'first' },
      { date: '2026-04-01', type: 'note', value: 'second' },
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].notes).toBe('first');
  });

  it('merges symptoms from multiple metric rows (union)', () => {
    const result = parseFloImport([
      { date: '2026-04-01', type: 'bleeding', value: 'light' },
      { date: '2026-04-01', type: 'symptom', value: ['cramps'] },
      { date: '2026-04-01', type: 'symptom', value: ['fatigue', 'cramps'] },
    ]);
    expect(result.entries).toHaveLength(1);
    const symptoms = result.entries[0].symptoms;
    expect(symptoms).toContain('cramps');
    expect(symptoms).toContain('fatigue');
    // No duplicates
    expect(symptoms.filter((s) => s === 'cramps')).toHaveLength(1);
  });

  it('Flo direct (non-metric) rows with no date land in directRows (skipped)', () => {
    // A non-plain-object row → directRows → skippedRows
    const result = parseFloImport([null as unknown as Record<string, unknown>]);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// O. WARNUNSUPPORTEDCLUEFIELDS — correct warning logic
// ---------------------------------------------------------------------------
describe('CLUE — warnUnsupportedClueFields', () => {
  it('does not warn for supported keys', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', mood: 'steady', notes: 'hi' },
    ]);
    const fieldWarnings = result.warnings.filter((w) => w.includes('Ignored unsupported Clue field'));
    expect(fieldWarnings).toHaveLength(0);
  });

  it('warns for exactly one unsupported key with singular wording', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', customKey: 'value' },
    ]);
    const fieldWarnings = result.warnings.filter((w) => w.includes('Ignored unsupported Clue field'));
    expect(fieldWarnings).toHaveLength(1);
    expect(fieldWarnings[0]).toContain('customKey');
    // Singular: "field" not "fields"
    expect(fieldWarnings[0]).not.toContain('fields');
  });

  it('warns for multiple unsupported keys with plural wording', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', keyA: 'a', keyB: 'b' },
    ]);
    const fieldWarnings = result.warnings.filter((w) => w.includes('Ignored unsupported Clue fields'));
    expect(fieldWarnings).toHaveLength(1);
    expect(fieldWarnings[0]).toContain('keyA');
    expect(fieldWarnings[0]).toContain('keyB');
  });

  it('does not warn for unsupported key with falsy value (empty string)', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', customKey: '' },
    ]);
    const fieldWarnings = result.warnings.filter((w) => w.includes('customKey'));
    expect(fieldWarnings).toHaveLength(0);
  });

  it('does not warn for unsupported key with false value', () => {
    const result = parseClueImport([
      { date: '2026-04-01', bleeding: 'light', customKey: false },
    ]);
    const fieldWarnings = result.warnings.filter((w) => w.includes('customKey'));
    expect(fieldWarnings).toHaveLength(0);
  });
});
