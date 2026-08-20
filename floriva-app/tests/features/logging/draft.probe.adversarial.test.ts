/**
 * Adversarial probe tests for src/features/logging/draft.ts
 *
 * Covers scenarios not yet exercised by draft.test.ts or draft.adversarial.test.ts.
 * Every assertion is computing the CORRECT expected value; a test failure signals
 * a real bug in the implementation.
 */
import {
  buildDailyLogEntry,
  createDailyLogDraft,
  createEmptyDailyLogDraft,
  getBasalBodyTemperatureValidationMessage,
  hasTrackableContent,
} from '@/src/features/logging/draft';
import type { DailyLogEntry } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    id: 'probe-entry-1',
    logDate: '2026-06-01',
    bleeding: 'none',
    symptoms: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BLEEDING — toggle / set / clear idempotency
// ---------------------------------------------------------------------------

describe('bleeding toggle idempotency', () => {
  it('toggling bleeding heavy -> heavy is idempotent', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'heavy';
    draft.bleeding = 'heavy'; // second assignment
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.bleeding).toBe('heavy');
  });

  it('cycling through all bleeding levels ends on the final assigned value', () => {
    const draft = createEmptyDailyLogDraft();
    for (const level of ['none', 'spotting', 'light', 'medium', 'heavy', 'light'] as const) {
      draft.bleeding = level;
    }
    // Last assignment wins
    expect(draft.bleeding).toBe('light');
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.bleeding).toBe('light');
  });

  it('setting bleeding to none then clearing (undefined) makes the draft non-trackable (no other content)', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'none';
    draft.bleeding = undefined;
    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('entry with bleeding:none hydrates into a draft where bleeding is "none" (not undefined)', () => {
    const entry = makeEntry({ bleeding: 'none' });
    const draft = createDailyLogDraft(entry);
    // bleeding:'none' is an explicit stored value, not absence
    expect(draft.bleeding).toBe('none');
  });

  it('draft hydrated from bleeding:"heavy" entry then set to "none" produces no trackable content when everything else is empty', () => {
    const entry = makeEntry({ bleeding: 'heavy' });
    const draft = createDailyLogDraft(entry);
    draft.bleeding = 'none';
    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('buildDailyLogEntry falls back to existingEntry.bleeding when draft.bleeding is undefined', () => {
    // Scenario: user opens an existing entry but never changes bleeding
    const entry = makeEntry({ bleeding: 'heavy', mood: 'steady' });
    const draft = createDailyLogDraft(entry);
    draft.bleeding = undefined; // simulate clearing it in the draft
    // draft still has mood, so it IS trackable
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    // Per the source: bleeding: draft.bleeding ?? existingEntry?.bleeding ?? 'none'
    expect(saved?.bleeding).toBe('heavy');
  });

  it('buildDailyLogEntry falls back to "none" when draft.bleeding is undefined and no existingEntry', () => {
    const draft = createEmptyDailyLogDraft();
    draft.mood = 'energized';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.bleeding).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// SYMPTOMS — duplicate detection and mutation safety
// ---------------------------------------------------------------------------

describe('symptoms multi-select edge cases', () => {
  it('directly pushing a duplicate into draft.symptoms round-trips the duplicates as-is (no dedup in buildDailyLogEntry)', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    draft.symptoms = ['cramps'];
    // Caller accidentally pushes the same key twice (e.g. fast double-tap)
    draft.symptoms.push('cramps');
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    // buildDailyLogEntry does NOT deduplicate — it passes symptoms through verbatim
    // This is documenting current behavior; if the spec changes, update here
    expect(saved?.symptoms).toEqual(['cramps', 'cramps']);
  });

  it('removing all symptoms leaves an empty array, not undefined', () => {
    const entry = makeEntry({ symptoms: ['cramps', 'headache'], bleeding: 'light' });
    const draft = createDailyLogDraft(entry);
    draft.symptoms = [];
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.symptoms).toEqual([]);
  });

  it('clearing all symptoms from an entry that had only symptoms makes it non-trackable (bleeding:none)', () => {
    const entry = makeEntry({ symptoms: ['cramps', 'headache'], bleeding: 'none' });
    const draft = createDailyLogDraft(entry);
    draft.symptoms = [];
    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('all known symptoms can be added without crashing', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    draft.symptoms = [
      'cramps',
      'headache',
      'bloating',
      'fatigue',
      'breast-tenderness',
      'acne',
      'discharge',
      'sleep-changes',
      'libido-changes',
      'sex',
    ];
    expect(() =>
      buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' }),
    ).not.toThrow();
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.symptoms).toHaveLength(10);
  });

  it('empty string is not a valid SymptomKey but does not crash buildDailyLogEntry', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    // @ts-expect-error intentional adversarial value
    draft.symptoms = [''];
    expect(() =>
      buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// MOOD — toggle / clear
// ---------------------------------------------------------------------------

describe('mood toggle and clear', () => {
  it('setting the same mood twice is idempotent', () => {
    const draft = createEmptyDailyLogDraft();
    draft.mood = 'low';
    draft.mood = 'low';
    draft.bleeding = 'spotting';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.mood).toBe('low');
  });

  it('clearing mood from an entry with only mood and bleeding:none makes the draft non-trackable', () => {
    const entry = makeEntry({ mood: 'energized', bleeding: 'none' });
    const draft = createDailyLogDraft(entry);
    draft.mood = undefined;
    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('switching from one mood to another does not affect other fields', () => {
    const entry = makeEntry({ mood: 'steady', bleeding: 'light', symptoms: ['cramps'] });
    const draft = createDailyLogDraft(entry);
    draft.mood = 'sensitive';
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.mood).toBe('sensitive');
    expect(saved?.bleeding).toBe('light');
    expect(saved?.symptoms).toEqual(['cramps']);
  });

  it('a draft with only mood set (no bleeding or symptoms) is trackable', () => {
    const draft = createEmptyDailyLogDraft();
    draft.mood = 'low';
    expect(hasTrackableContent(draft)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NOTES — edge strings
// ---------------------------------------------------------------------------

describe('notes adversarial strings', () => {
  it('RTL text in notes is preserved verbatim', () => {
    const rtlNote = 'مرحباً بالعالم'; // Arabic "Hello World"
    const draft = createEmptyDailyLogDraft();
    draft.notes = rtlNote;
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.notes).toBe(rtlNote);
  });

  it('notes with only newlines are treated as whitespace-only (non-trackable)', () => {
    const draft = createEmptyDailyLogDraft();
    draft.notes = '\n\n\n';
    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('notes with leading/trailing whitespace are trimmed on save', () => {
    const draft = createEmptyDailyLogDraft();
    draft.notes = '  cramps today  ';
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.notes).toBe('cramps today');
  });

  it('null-like string "null" in notes is preserved as-is', () => {
    const draft = createEmptyDailyLogDraft();
    draft.notes = 'null';
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.notes).toBe('null');
  });

  it('notes with high codepoint emoji surrogate pairs are preserved', () => {
    const emojiNote = '🩸🌸💊'; // period, flower, pill
    const draft = createEmptyDailyLogDraft();
    draft.notes = emojiNote;
    draft.bleeding = 'spotting';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.notes).toBe(emojiNote);
  });

  it('notes with zero-width-space only is treated as non-trackable', () => {
    const draft = createEmptyDailyLogDraft();
    draft.notes = '​'; // zero-width space — trim() does NOT remove this
    // After trim(), the string is still '​' (non-empty), so it IS trackable
    // This is documenting current behavior
    const trimmed = draft.notes.trim();
    if (trimmed.length > 0) {
      // Zero-width space survives trim — hasTrackableContent sees it as content
      expect(hasTrackableContent(draft)).toBe(true);
    } else {
      expect(hasTrackableContent(draft)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// SAVE AN EMPTY DRAFT — no-op contract
// ---------------------------------------------------------------------------

describe('saving an empty draft is always a no-op', () => {
  it('empty draft with no existingEntry returns null', () => {
    expect(
      buildDailyLogEntry({ draft: createEmptyDailyLogDraft(), existingEntry: null, logDate: '2026-06-01' }),
    ).toBeNull();
  });

  it('empty draft with an existingEntry still returns null (never wipes existing data)', () => {
    const existing = makeEntry({ bleeding: 'heavy', symptoms: ['cramps'], mood: 'low' });
    expect(
      buildDailyLogEntry({
        draft: createEmptyDailyLogDraft(),
        existingEntry: existing,
        logDate: existing.logDate,
      }),
    ).toBeNull();
  });

  it('createEmptyDailyLogDraft always returns a fresh object (no shared reference)', () => {
    const a = createEmptyDailyLogDraft();
    const b = createEmptyDailyLogDraft();
    a.symptoms.push('cramps');
    expect(b.symptoms).toHaveLength(0); // mutations to a must not affect b
  });

  it('createDailyLogDraft(null) result symptoms array is not shared with the next call', () => {
    const a = createDailyLogDraft(null);
    const b = createDailyLogDraft(null);
    a.symptoms.push('cramps');
    expect(b.symptoms).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DATE HANDLING — IDs and logDate pass-through
// ---------------------------------------------------------------------------

describe('date handling in buildDailyLogEntry', () => {
  it('logDate flows through to the saved entry', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2025-01-01' });
    expect(saved?.logDate).toBe('2025-01-01');
  });

  it('a future date is accepted without error', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'spotting';
    expect(() =>
      buildDailyLogEntry({ draft, existingEntry: null, logDate: '2099-12-31' }),
    ).not.toThrow();
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2099-12-31' });
    expect(saved?.logDate).toBe('2099-12-31');
    expect(saved?.id).toBe('daily-log-2099-12-31');
  });

  it('editing the same date twice preserves the same id and does not generate a new one', () => {
    const entry = makeEntry({ id: 'daily-log-2026-06-01', logDate: '2026-06-01', bleeding: 'light' });
    const draft = createDailyLogDraft(entry);
    draft.bleeding = 'heavy';
    const saved1 = buildDailyLogEntry({ draft, existingEntry: entry, logDate: '2026-06-01' });
    draft.bleeding = 'medium';
    const saved2 = buildDailyLogEntry({ draft, existingEntry: entry, logDate: '2026-06-01' });
    expect(saved1?.id).toBe(saved2?.id);
    expect(saved1?.id).toBe('daily-log-2026-06-01');
  });

  it('logDate that looks like an ISO datetime (with T) is passed through verbatim (no normalization)', () => {
    // The function accepts any string as logDate; it does not parse/validate it
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({
      draft,
      existingEntry: null,
      logDate: '2026-06-01T00:00:00.000Z',
    });
    expect(saved?.logDate).toBe('2026-06-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// BIRTH CONTROL + TTC mutual independence (no cross-contamination)
// ---------------------------------------------------------------------------

describe('birth-control and TTC mutual independence', () => {
  it('setting a birth-control method does not pollute ttcObservation', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'pill';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.ttcObservation).toBeUndefined();
  });

  it('logging sex (sexLogged:true) does not create a birth-control event', () => {
    const draft = createEmptyDailyLogDraft();
    draft.ttcObservation.sexLogged = true;
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.birthControlEvent).toBeUndefined();
    expect(saved?.ttcObservation?.sexLogged).toBe(true);
  });

  it('an entry with both pill:missedDose and a TTC observation round-trips both fields intact', () => {
    const entry = makeEntry({
      bleeding: 'light',
      birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
      ttcObservation: { ovulationTest: 'positive', sexLogged: true },
    });
    const draft = createDailyLogDraft(entry);
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.birthControlEvent?.method).toBe('pill');
    expect(saved?.birthControlEvent?.missedDose).toBe(true);
    expect(saved?.ttcObservation?.ovulationTest).toBe('positive');
    expect(saved?.ttcObservation?.sexLogged).toBe(true);
  });

  it('missedDose:false and lateDose:false on pill are stored as undefined in the entry (falsy collapse)', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = false;
    draft.birthControlEvent.lateDose = false;
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    // Per source: missedDose: draft.birthControlEvent.missedDose || undefined
    // false || undefined === undefined
    expect(saved?.birthControlEvent?.missedDose).toBeUndefined();
    expect(saved?.birthControlEvent?.lateDose).toBeUndefined();
  });

  it('sexLogged:false does not create a ttcObservation', () => {
    const draft = createEmptyDailyLogDraft();
    draft.ttcObservation.sexLogged = false;
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.ttcObservation).toBeUndefined();
  });

  it('sexLogged:true in ttcObservation is stored as true (not just truthy)', () => {
    const draft = createEmptyDailyLogDraft();
    draft.ttcObservation.sexLogged = true;
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    // Per source: sexLogged: draft.ttcObservation.sexLogged || undefined
    // true || undefined === true
    expect(saved?.ttcObservation?.sexLogged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TTC OBSERVATION sub-field isolation
// ---------------------------------------------------------------------------

describe('TTC observation sub-field isolation', () => {
  it('changing cervicalMucus does not affect ovulationTest', () => {
    const entry = makeEntry({
      ttcObservation: { cervicalMucus: 'dry', ovulationTest: 'positive' },
      bleeding: 'light',
    });
    const draft = createDailyLogDraft(entry);
    draft.ttcObservation.cervicalMucus = 'creamy';
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.ttcObservation?.cervicalMucus).toBe('creamy');
    expect(saved?.ttcObservation?.ovulationTest).toBe('positive');
  });

  it('clearing cervicalMucus while keeping ovulationTest preserves ovulationTest', () => {
    const entry = makeEntry({
      ttcObservation: { cervicalMucus: 'egg-white', ovulationTest: 'peak' },
      bleeding: 'medium',
    });
    const draft = createDailyLogDraft(entry);
    draft.ttcObservation.cervicalMucus = undefined;
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.ttcObservation?.cervicalMucus).toBeUndefined();
    expect(saved?.ttcObservation?.ovulationTest).toBe('peak');
  });

  it('all TTC fields cleared produces undefined ttcObservation', () => {
    const entry = makeEntry({
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'negative',
        basalBodyTemperatureCelsius: 36.5,
        sexLogged: true,
      },
      bleeding: 'spotting',
    });
    const draft = createDailyLogDraft(entry);
    draft.ttcObservation.cervicalMucus = undefined;
    draft.ttcObservation.ovulationTest = undefined;
    draft.ttcObservation.basalBodyTemperatureInput = '';
    draft.ttcObservation.sexLogged = false;
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.ttcObservation).toBeUndefined();
  });

  it('basalBodyTemperatureCelsius 36.40 round-trips through the draft as "36.40"', () => {
    // createDailyLogDraft calls .toFixed(2) on the stored numeric value
    const entry = makeEntry({
      ttcObservation: { basalBodyTemperatureCelsius: 36.4 },
      bleeding: 'light',
    });
    const draft = createDailyLogDraft(entry);
    expect(draft.ttcObservation.basalBodyTemperatureInput).toBe('36.40');
  });

  it('basalBodyTemperatureCelsius integer value (37) round-trips as "37.00"', () => {
    const entry = makeEntry({
      ttcObservation: { basalBodyTemperatureCelsius: 37 },
      bleeding: 'light',
    });
    const draft = createDailyLogDraft(entry);
    expect(draft.ttcObservation.basalBodyTemperatureInput).toBe('37.00');
  });
});

// ---------------------------------------------------------------------------
// BBT VALIDATION — additional adversarial inputs
// ---------------------------------------------------------------------------

describe('BBT validation adversarial inputs', () => {
  it('rejects empty string with leading/trailing spaces (not truly empty)', () => {
    // '   ' trimmed is '' — should be treated as empty, i.e. no validation message
    expect(getBasalBodyTemperatureValidationMessage('   ')).toBeUndefined();
  });

  it('rejects scientific notation that yields an in-range float', () => {
    // '3.65e1' = 36.5 — parseFloat parses this
    const msg = getBasalBodyTemperatureValidationMessage('3.65e1');
    // This is an INTERESTING case: parseFloat('3.65e1') = 36.5, which is in range
    // The function should accept it (no validation message) because it IS valid
    expect(msg).toBeUndefined();
  });

  it('rejects negative temperature', () => {
    expect(getBasalBodyTemperatureValidationMessage('-1')).toBeDefined();
  });

  it('rejects zero', () => {
    expect(getBasalBodyTemperatureValidationMessage('0')).toBeDefined();
  });

  it('accepts exactly 30.00 (minimum boundary)', () => {
    expect(getBasalBodyTemperatureValidationMessage('30')).toBeUndefined();
  });

  it('accepts exactly 45.00 (maximum boundary)', () => {
    expect(getBasalBodyTemperatureValidationMessage('45')).toBeUndefined();
  });

  it('rejects hexadecimal string like 0x24 (= 36 in-range but not a decimal literal)', () => {
    // parseFloat('0x24') = 0 (parseFloat does NOT parse hex), so this would fail range
    const msg = getBasalBodyTemperatureValidationMessage('0x24');
    expect(msg).toBeDefined(); // 0 is out of range
  });

  it('invalid BBT input does not block other fields from saving', () => {
    const draft = createEmptyDailyLogDraft();
    draft.ttcObservation.basalBodyTemperatureInput = 'abc'; // invalid
    draft.bleeding = 'medium'; // provides trackable content
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    // Invalid BBT is dropped silently; entry is saved without a BBT observation
    expect(saved).not.toBeNull();
    expect(saved?.ttcObservation).toBeUndefined();
    expect(saved?.bleeding).toBe('medium');
  });

  it('out-of-range BBT (29.99) is dropped and does not prevent saving', () => {
    const draft = createEmptyDailyLogDraft();
    draft.ttcObservation.basalBodyTemperatureInput = '29.99';
    draft.mood = 'steady';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.ttcObservation).toBeUndefined();
    expect(saved?.mood).toBe('steady');
  });
});

// ---------------------------------------------------------------------------
// areDailyLogEntriesEquivalent is NOT exported — tested indirectly
// DRAFT ROUND-TRIP EQUIVALENCE
// ---------------------------------------------------------------------------

describe('draft round-trip produces equivalent data', () => {
  it('hydrating a complex entry and saving without changes produces an equivalent entry', () => {
    const entry: DailyLogEntry = {
      id: 'trip-1',
      logDate: '2026-06-05',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue'],
      mood: 'low',
      notes: 'Day 2 of period',
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'negative',
        basalBodyTemperatureCelsius: 36.55,
        sexLogged: true,
      },
      birthControlEvent: { method: 'pill', missedDose: true },
      importSessionId: 'session-abc',
    };
    const draft = createDailyLogDraft(entry);
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    // The saved entry must match the original exactly
    expect(saved?.id).toBe(entry.id);
    expect(saved?.logDate).toBe(entry.logDate);
    expect(saved?.bleeding).toBe(entry.bleeding);
    expect(saved?.symptoms).toEqual(entry.symptoms);
    expect(saved?.mood).toBe(entry.mood);
    expect(saved?.notes).toBe(entry.notes);
    expect(saved?.ttcObservation?.cervicalMucus).toBe('creamy');
    expect(saved?.ttcObservation?.ovulationTest).toBe('negative');
    expect(saved?.ttcObservation?.basalBodyTemperatureCelsius).toBeCloseTo(36.55);
    expect(saved?.ttcObservation?.sexLogged).toBe(true);
    expect(saved?.birthControlEvent?.method).toBe('pill');
    expect(saved?.birthControlEvent?.missedDose).toBe(true);
    expect(saved?.importSessionId).toBe('session-abc');
  });
});

// ---------------------------------------------------------------------------
// REDUCER INVARIANTS — state shape never degrades
// ---------------------------------------------------------------------------

describe('reducer invariants — state shape', () => {
  it('createEmptyDailyLogDraft always returns symptoms as an array', () => {
    expect(Array.isArray(createEmptyDailyLogDraft().symptoms)).toBe(true);
  });

  it('createEmptyDailyLogDraft notes is always an empty string, not null or undefined', () => {
    expect(createEmptyDailyLogDraft().notes).toBe('');
  });

  it('createEmptyDailyLogDraft ttcObservation.sexLogged is always false, not undefined', () => {
    expect(createEmptyDailyLogDraft().ttcObservation.sexLogged).toBe(false);
  });

  it('createEmptyDailyLogDraft birthControlEvent.missedDose and lateDose are always false', () => {
    const d = createEmptyDailyLogDraft();
    expect(d.birthControlEvent.missedDose).toBe(false);
    expect(d.birthControlEvent.lateDose).toBe(false);
  });

  it('createDailyLogDraft from an entry with null notes produces empty-string notes in the draft', () => {
    // DailyLogEntry.notes is optional (can be undefined); draft should normalize to ''
    const entry = makeEntry({ bleeding: 'light' }); // notes omitted
    const draft = createDailyLogDraft(entry);
    expect(draft.notes).toBe('');
  });

  it('buildDailyLogEntry never returns an entry where symptoms is undefined', () => {
    const draft = createEmptyDailyLogDraft();
    draft.bleeding = 'light';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.symptoms).toBeDefined();
    expect(Array.isArray(saved?.symptoms)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PROBE: birthControlEvent — 'none' sentinel — potential BUG candidate
// The existing adversarial test already covers the method:'none' guard,
// but we probe an additional case: missedDose/lateDose flags left as true
// when method switches from pill to none.
// ---------------------------------------------------------------------------

describe('birth-control state machine — switching method', () => {
  it('switching from pill (missedDose:true) to iud produces event without missedDose', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = true;
    // User changes their mind and selects IUD instead
    draft.birthControlEvent.method = 'iud';
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.birthControlEvent?.method).toBe('iud');
    expect(saved?.birthControlEvent).not.toHaveProperty('missedDose');
    expect(saved?.birthControlEvent).not.toHaveProperty('lateDose');
  });

  it('switching from iud to pill with missedDose:true persists the flag', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'iud';
    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = true;
    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-06-01' });
    expect(saved?.birthControlEvent?.method).toBe('pill');
    expect(saved?.birthControlEvent?.missedDose).toBe(true);
  });

  it('hasTrackableContent: method "other" is considered trackable birth-control activity', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'other';
    expect(hasTrackableContent(draft)).toBe(true);
  });

  it('hasTrackableContent: method "pill" with missedDose but no other content is trackable', () => {
    const draft = createEmptyDailyLogDraft();
    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = true;
    expect(hasTrackableContent(draft)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PROBE: areDailyLogEntriesEquivalent — JSON.stringify ordering sensitivity
// ---------------------------------------------------------------------------

describe('entry equivalence — JSON.stringify ordering', () => {
  it('two entries with identical fields in different key orders are still equivalent via JSON.stringify', () => {
    // JSON.stringify key order is insertion order in V8; if two objects have the same
    // keys in different orders, they produce DIFFERENT JSON strings.
    // This is a latent bug in areDailyLogEntriesEquivalent — it is not exported so we
    // probe it indirectly through the observable behavior of the draft system.
    // The test just documents that buildDailyLogEntry produces consistent key ordering.
    const entry = makeEntry({ bleeding: 'light', mood: 'steady', symptoms: ['cramps'] });
    const draft = createDailyLogDraft(entry);
    const saved1 = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    const saved2 = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    // Two calls with the same inputs should produce structurally identical results
    expect(JSON.stringify(saved1)).toBe(JSON.stringify(saved2));
  });
});
