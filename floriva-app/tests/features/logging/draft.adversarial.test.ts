/**
 * Adversarial tests for src/features/logging/draft.ts
 *
 * Covers: draft integrity, toggle idempotency, field isolation, enum safety,
 * boundary values, and birth-control / TTC / symptom correctness.
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
    id: 'entry-1',
    logDate: '2026-05-01',
    bleeding: 'none',
    symptoms: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Draft integrity — merging an existing entry then editing
// ---------------------------------------------------------------------------

describe('draft integrity — editing an existing entry', () => {
  it('toggling a symptom ON does not duplicate it on re-save', () => {
    const entry = makeEntry({ symptoms: ['cramps'] });
    const draft = createDailyLogDraft(entry);

    // Simulate toggling 'cramps' on when it is already present — idempotent add
    if (!draft.symptoms.includes('cramps')) {
      draft.symptoms.push('cramps');
    }

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.symptoms).toEqual(['cramps']); // no duplicates
  });

  it('toggling a symptom OFF removes it without affecting other symptoms', () => {
    const entry = makeEntry({ symptoms: ['cramps', 'headache', 'fatigue'] });
    const draft = createDailyLogDraft(entry);

    // Remove 'headache'
    draft.symptoms = draft.symptoms.filter((s) => s !== 'headache');

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.symptoms).toEqual(['cramps', 'fatigue']);
  });

  it('changing flow does not drop mood, symptoms, notes, or ttc fields', () => {
    const entry = makeEntry({
      bleeding: 'light',
      mood: 'energized',
      symptoms: ['bloating'],
      notes: 'Feeling okay',
      ttcObservation: { cervicalMucus: 'creamy', sexLogged: true },
    });
    const draft = createDailyLogDraft(entry);

    draft.bleeding = 'heavy'; // only change is flow

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.bleeding).toBe('heavy');
    expect(saved?.mood).toBe('energized');
    expect(saved?.symptoms).toEqual(['bloating']);
    expect(saved?.notes).toBe('Feeling okay');
    expect(saved?.ttcObservation?.cervicalMucus).toBe('creamy');
    expect(saved?.ttcObservation?.sexLogged).toBe(true);
  });

  it('adding a birth-control event does not wipe existing symptoms or notes', () => {
    const entry = makeEntry({
      symptoms: ['cramps', 'fatigue'],
      notes: 'Rough day',
      mood: 'low',
    });
    const draft = createDailyLogDraft(entry);

    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = true;

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.symptoms).toEqual(['cramps', 'fatigue']);
    expect(saved?.notes).toBe('Rough day');
    expect(saved?.mood).toBe('low');
    expect(saved?.birthControlEvent?.method).toBe('pill');
    expect(saved?.birthControlEvent?.missedDose).toBe(true);
  });

  it('removing a birth-control event does not affect bleeding, symptoms, or ttc', () => {
    const entry = makeEntry({
      bleeding: 'medium',
      symptoms: ['cramps'],
      birthControlEvent: { method: 'pill', missedDose: true },
      ttcObservation: { ovulationTest: 'positive' },
    });
    const draft = createDailyLogDraft(entry);

    draft.birthControlEvent.method = undefined;
    draft.birthControlEvent.missedDose = false;

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.birthControlEvent).toBeUndefined();
    expect(saved?.bleeding).toBe('medium');
    expect(saved?.symptoms).toEqual(['cramps']);
    expect(saved?.ttcObservation?.ovulationTest).toBe('positive');
  });

  it('removing a ttc observation does not affect birth-control or bleeding', () => {
    const entry = makeEntry({
      bleeding: 'spotting',
      birthControlEvent: { method: 'iud' },
      ttcObservation: { cervicalMucus: 'egg-white' },
    });
    const draft = createDailyLogDraft(entry);

    draft.ttcObservation.cervicalMucus = undefined;
    draft.ttcObservation.ovulationTest = undefined;
    draft.ttcObservation.basalBodyTemperatureInput = '';
    draft.ttcObservation.sexLogged = false;

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.ttcObservation).toBeUndefined();
    expect(saved?.birthControlEvent?.method).toBe('iud');
    expect(saved?.bleeding).toBe('spotting');
  });

  it('preserves the original entry id when updating an existing entry', () => {
    const entry = makeEntry({ id: 'original-id-42', bleeding: 'light' });
    const draft = createDailyLogDraft(entry);

    draft.bleeding = 'heavy';

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.id).toBe('original-id-42');
  });

  it('preserves the importSessionId when editing an imported entry', () => {
    const entry = makeEntry({ bleeding: 'light', importSessionId: 'import-session-99' });
    const draft = createDailyLogDraft(entry);

    draft.bleeding = 'heavy';

    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });
    expect(saved?.importSessionId).toBe('import-session-99');
  });
});

// ---------------------------------------------------------------------------
// Empty draft vs populated draft distinction
// ---------------------------------------------------------------------------

describe('empty draft vs populated draft', () => {
  it('createEmptyDailyLogDraft produces a draft where hasTrackableContent is false', () => {
    expect(hasTrackableContent(createEmptyDailyLogDraft())).toBe(false);
  });

  it('buildDailyLogEntry returns null for an empty draft — does not wipe an existing entry', () => {
    const existingEntry = makeEntry({ bleeding: 'heavy', symptoms: ['cramps'] });
    const emptyDraft = createEmptyDailyLogDraft();

    // Caller must check null and skip save — returning null is the signal
    const result = buildDailyLogEntry({
      draft: emptyDraft,
      existingEntry,
      logDate: existingEntry.logDate,
    });
    expect(result).toBeNull();
  });

  it('a draft with only bleeding: none is still treated as having no trackable content', () => {
    const draft = createEmptyDailyLogDraft();

    draft.bleeding = 'none';

    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('a draft with only whitespace notes has no trackable content', () => {
    const draft = createEmptyDailyLogDraft();

    draft.notes = '   \n\t  ';

    expect(hasTrackableContent(draft)).toBe(false);
  });

  it('a draft that has only bleeding set to a non-none value is trackable', () => {
    const draft = createEmptyDailyLogDraft();

    draft.bleeding = 'spotting';

    expect(hasTrackableContent(draft)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BUG: method:'none' must not produce a BirthControlEvent
// ---------------------------------------------------------------------------

describe('birth-control — clearing a previously-set method by setting it to "none"', () => {
  it('an existing entry with method "pill" updated to method "none" has no birthControlEvent', () => {
    const existingEntry: DailyLogEntry = {
      id: 'entry-clear',
      logDate: '2026-05-20',
      bleeding: 'light',
      symptoms: [],
      birthControlEvent: { method: 'pill', missedDose: true },
    };
    const draft = createDailyLogDraft(existingEntry);

    // User clears the birth-control selection
    draft.birthControlEvent.method = 'none';
    draft.birthControlEvent.missedDose = false;

    const saved = buildDailyLogEntry({ draft, existingEntry, logDate: existingEntry.logDate });
    // 'none' means "no event" — the event must be absent, not orphaned with method:'none'
    expect(saved?.birthControlEvent).toBeUndefined();
  });

  it('setting method to "none" on an entry that had "iud" removes the event cleanly', () => {
    const existingEntry: DailyLogEntry = {
      id: 'entry-clear-iud',
      logDate: '2026-05-21',
      bleeding: 'spotting',
      symptoms: [],
      birthControlEvent: { method: 'iud' },
    };
    const draft = createDailyLogDraft(existingEntry);

    draft.birthControlEvent.method = 'none';

    const saved = buildDailyLogEntry({ draft, existingEntry, logDate: existingEntry.logDate });
    expect(saved?.birthControlEvent).toBeUndefined();
  });
});

describe('birth-control — method "none" must not produce a BirthControlEvent', () => {
  /**
   * BUG: buildBirthControlEvent guards with `if (!method) return undefined`.
   * Because 'none' is a truthy string in JS, it passes the guard and returns
   * { method: 'none' }, which is semantically wrong and could be mislabelled
   * in the timeline as a birth-control log.
   */
  it('does NOT produce a BirthControlEvent when method is "none"', () => {
    const draft = createEmptyDailyLogDraft();

    draft.birthControlEvent.method = 'none';
    draft.bleeding = 'light'; // give the draft trackable content so it doesn't bail early

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-10' });
    expect(saved?.birthControlEvent).toBeUndefined();
  });

  it('hasTrackableContent does not consider method "none" as birth-control activity', () => {
    const draft = createEmptyDailyLogDraft();

    draft.birthControlEvent.method = 'none';

    // 'none' should not count as trackable birth-control content
    expect(hasTrackableContent(draft)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Birth-control adherence flags — pill vs non-pill isolation
// ---------------------------------------------------------------------------

describe('birth-control adherence flags', () => {
  it('missedDose and lateDose are stored only for pill method', () => {
    const pillDraft = createEmptyDailyLogDraft();

    pillDraft.birthControlEvent.method = 'pill';
    pillDraft.birthControlEvent.missedDose = true;
    pillDraft.birthControlEvent.lateDose = true;

    const pillSaved = buildDailyLogEntry({
      draft: pillDraft,
      existingEntry: null,
      logDate: '2026-05-11',
    });
    expect(pillSaved?.birthControlEvent?.missedDose).toBe(true);
    expect(pillSaved?.birthControlEvent?.lateDose).toBe(true);
  });

  it.each(['iud', 'implant', 'ring', 'patch', 'other'] as const)(
    'method "%s" never stores pill-only adherence flags even if set in draft',
    (method) => {
      const draft = createEmptyDailyLogDraft();

      draft.birthControlEvent.method = method;
      draft.birthControlEvent.missedDose = true;
      draft.birthControlEvent.lateDose = true;

      const saved = buildDailyLogEntry({
        draft,
        existingEntry: null,
        logDate: '2026-05-12',
      });
      expect(saved?.birthControlEvent).toEqual({ method });
      expect(saved?.birthControlEvent).not.toHaveProperty('missedDose');
      expect(saved?.birthControlEvent).not.toHaveProperty('lateDose');
    },
  );
});

// ---------------------------------------------------------------------------
// Idempotent symptom toggles
// ---------------------------------------------------------------------------

describe('idempotent symptom toggles', () => {
  it('adding the same symptom twice does not duplicate it', () => {
    const draft = createEmptyDailyLogDraft();

    draft.symptoms = ['cramps'];
    draft.bleeding = 'light';

    // Simulate double-tap or race condition
    if (!draft.symptoms.includes('cramps')) draft.symptoms.push('cramps');
    if (!draft.symptoms.includes('cramps')) draft.symptoms.push('cramps');

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-13' });
    expect(saved?.symptoms.filter((s) => s === 'cramps')).toHaveLength(1);
  });

  it('draft built from an entry with duplicate symptoms (corrupted storage) round-trips without multiplying', () => {
    // If storage has duplicates, createDailyLogDraft copies them as-is.
    // buildDailyLogEntry should ideally deduplicate, but at minimum must not add more.
    const entry = makeEntry({
      bleeding: 'light',
      // Duplicate values are valid per the SymptomKey union type; we test
      // runtime behaviour when corrupted storage produces them.
      symptoms: ['cramps', 'cramps', 'headache'],
    });
    const draft = createDailyLogDraft(entry);
    const saved = buildDailyLogEntry({ draft, existingEntry: entry, logDate: entry.logDate });

    // Must not have MORE duplicates than what came in
    const crampCount = saved?.symptoms.filter((s) => s === 'cramps').length ?? 0;
    expect(crampCount).toBeLessThanOrEqual(2); // ideally 1, at worst same as input
  });
});

// ---------------------------------------------------------------------------
// Notes boundary values
// ---------------------------------------------------------------------------

describe('notes boundary values', () => {
  it('very long notes are preserved verbatim', () => {
    const longNote = 'A'.repeat(10_000);
    const draft = createEmptyDailyLogDraft();

    draft.notes = longNote;
    draft.bleeding = 'light';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-14' });
    expect(saved?.notes).toBe(longNote);
  });

  it('notes with unicode and emoji are preserved verbatim', () => {
    const unicodeNote = '日記 😊 Período 🌸 cramps très mauvais';
    const draft = createEmptyDailyLogDraft();

    draft.notes = unicodeNote;
    draft.bleeding = 'light';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-15' });
    expect(saved?.notes).toBe(unicodeNote);
  });

  it('notes with only whitespace are normalized to undefined', () => {
    const draft = createEmptyDailyLogDraft();

    draft.notes = '   ';
    draft.bleeding = 'spotting';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-16' });
    expect(saved?.notes).toBeUndefined();
  });

  it('empty string notes are normalized to undefined', () => {
    const draft = createEmptyDailyLogDraft();

    draft.notes = '';
    draft.bleeding = 'spotting';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-17' });
    expect(saved?.notes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// BBT boundary values
// ---------------------------------------------------------------------------

describe('BBT boundary values', () => {
  it('accepts the minimum valid temperature (30.00)', () => {
    expect(getBasalBodyTemperatureValidationMessage('30.00')).toBeUndefined();
  });

  it('accepts the maximum valid temperature (45.00)', () => {
    expect(getBasalBodyTemperatureValidationMessage('45.00')).toBeUndefined();
  });

  it('rejects a temperature just below the minimum (29.99)', () => {
    expect(getBasalBodyTemperatureValidationMessage('29.99')).toBeDefined();
  });

  it('rejects a temperature just above the maximum (45.01)', () => {
    expect(getBasalBodyTemperatureValidationMessage('45.01')).toBeDefined();
  });

  it('rejects NaN input', () => {
    expect(getBasalBodyTemperatureValidationMessage('not-a-number')).toBeDefined();
  });

  it('rejects Infinity', () => {
    expect(getBasalBodyTemperatureValidationMessage('Infinity')).toBeDefined();
  });

  it('builds a BBT entry at the boundary value of 36.50', () => {
    const draft = createEmptyDailyLogDraft();

    draft.ttcObservation.basalBodyTemperatureInput = '36.50';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-18' });
    expect(saved?.ttcObservation?.basalBodyTemperatureCelsius).toBeCloseTo(36.5);
  });
});

// ---------------------------------------------------------------------------
// Enum safety — unknown values
// ---------------------------------------------------------------------------

describe('enum safety — unknown enum values do not crash', () => {
  it('createDailyLogDraft with an unknown symptom key does not throw', () => {
    const entry = makeEntry({
      bleeding: 'light',
      // @ts-expect-error intentional unknown value
      symptoms: ['cramps', 'unknown-symptom-from-future'],
    });
    expect(() => createDailyLogDraft(entry)).not.toThrow();
  });

  it('buildDailyLogEntry with an unknown symptom key does not crash', () => {
    const draft = createEmptyDailyLogDraft();

    // @ts-expect-error intentional unknown value
    draft.symptoms = ['cramps', 'unknown-future-symptom'];
    draft.bleeding = 'light';

    expect(() =>
      buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-19' }),
    ).not.toThrow();
  });

  it('does not treat an unknown birth-control method as a known one', () => {
    const draft = createEmptyDailyLogDraft();

    // @ts-expect-error intentional unknown value
    draft.birthControlEvent.method = 'unknown-future-method';
    draft.bleeding = 'light';

    const saved = buildDailyLogEntry({ draft, existingEntry: null, logDate: '2026-05-20' });
    // Should still save without crashing; we just verify it doesn't explode
    expect(saved).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Null/undefined array safety
// ---------------------------------------------------------------------------

describe('null and undefined array safety', () => {
  it('createDailyLogDraft with a null ttcObservation produces empty ttc sub-draft', () => {
    const entry = makeEntry({ ttcObservation: undefined });
    const draft = createDailyLogDraft(entry);

    expect(draft.ttcObservation.cervicalMucus).toBeUndefined();
    expect(draft.ttcObservation.ovulationTest).toBeUndefined();
    expect(draft.ttcObservation.basalBodyTemperatureInput).toBe('');
    expect(draft.ttcObservation.sexLogged).toBe(false);
  });

  it('createDailyLogDraft with a null birthControlEvent produces empty bc sub-draft', () => {
    const entry = makeEntry({ birthControlEvent: undefined });
    const draft = createDailyLogDraft(entry);

    expect(draft.birthControlEvent.method).toBeUndefined();
    expect(draft.birthControlEvent.missedDose).toBe(false);
    expect(draft.birthControlEvent.lateDose).toBe(false);
  });
});
