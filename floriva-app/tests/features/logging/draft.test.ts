import {
  buildDailyLogEntry,
  createDailyLogDraft,
  createEmptyDailyLogDraft,
  getBasalBodyTemperatureValidationMessage,
  hasTrackableContent,
} from '@/src/features/logging/draft';

describe('logging draft helpers', () => {
  it('returns null when there is no trackable content to save', () => {
    expect(
      buildDailyLogEntry({
        draft: createEmptyDailyLogDraft(),
        existingEntry: null,
        logDate: '2026-04-20',
      }),
    ).toBeNull();
  });

  it('returns an empty draft when there is no stored entry yet', () => {
    expect(createDailyLogDraft(null)).toEqual(createEmptyDailyLogDraft());
  });

  it('normalizes TTC temperature input into a numeric entry payload', () => {
    const draft = createEmptyDailyLogDraft();

    draft.ttcObservation.basalBodyTemperatureInput = ' 36.55 ';

    expect(hasTrackableContent(draft)).toBe(true);
    expect(
      buildDailyLogEntry({
        draft,
        existingEntry: null,
        logDate: '2026-04-21',
      }),
    ).toEqual({
      id: 'daily-log-2026-04-21',
      logDate: '2026-04-21',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        basalBodyTemperatureCelsius: 36.55,
        sexLogged: undefined,
      },
    });
  });

  it('hydrates TTC observations back into editable draft inputs', () => {
    expect(
      createDailyLogDraft({
        id: 'daily-log-2026-04-22',
        logDate: '2026-04-22',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'creamy',
          ovulationTest: 'positive',
          basalBodyTemperatureCelsius: 36.4,
          sexLogged: true,
        },
      }),
    ).toEqual({
      bleeding: 'none',
      symptoms: [],
      mood: undefined,
      notes: '',
      birthControlEvent: {
        method: undefined,
        missedDose: false,
        lateDose: false,
      },
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'positive',
        basalBodyTemperatureInput: '36.40',
        sexLogged: true,
      },
    });
  });

  it('builds a birth-control event from editable draft state', () => {
    const draft = createEmptyDailyLogDraft();

    draft.birthControlEvent.method = 'pill';
    draft.birthControlEvent.missedDose = true;
    draft.birthControlEvent.lateDose = true;

    expect(hasTrackableContent(draft)).toBe(true);
    expect(
      buildDailyLogEntry({
        draft,
        existingEntry: null,
        logDate: '2026-04-23',
      }),
    ).toEqual({
      id: 'daily-log-2026-04-23',
      logDate: '2026-04-23',
      bleeding: 'none',
      symptoms: [],
      birthControlEvent: {
        method: 'pill',
        missedDose: true,
        lateDose: true,
      },
    });
  });

  it('stores non-pill birth-control methods without pill-only adherence flags', () => {
    const draft = createEmptyDailyLogDraft();

    draft.birthControlEvent.method = 'implant';
    draft.birthControlEvent.missedDose = true;
    draft.birthControlEvent.lateDose = true;

    expect(
      buildDailyLogEntry({
        draft,
        existingEntry: null,
        logDate: '2026-04-24',
      }),
    ).toEqual({
      id: 'daily-log-2026-04-24',
      logDate: '2026-04-24',
      bleeding: 'none',
      symptoms: [],
      birthControlEvent: {
        method: 'implant',
      },
    });
  });

  it('drops invalid TTC temperature input instead of persisting a malformed number', () => {
    const draft = createEmptyDailyLogDraft();

    draft.ttcObservation.basalBodyTemperatureInput = '29.9';

    expect(
      buildDailyLogEntry({
        draft,
        existingEntry: null,
        logDate: '2026-04-25',
      }),
    ).toBeNull();
  });

  it('treats a blank TTC temperature input as valid empty state', () => {
    expect(getBasalBodyTemperatureValidationMessage('   ')).toBeUndefined();
  });
});
