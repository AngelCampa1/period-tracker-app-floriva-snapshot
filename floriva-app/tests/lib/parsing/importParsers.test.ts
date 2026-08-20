import {
  UnsupportedImportShapeError,
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

describe('import parsers', () => {
  it('normalizes manual period history, enforces the 12-month window, and merges repeated dates', () => {
    const result = parseManualHistoryImport({
      periodStarts: ['2025-03-31', '2026-04-01', '2026-04-01', '2026-04-03'],
      lookbackStartIso: '2025-04-01',
    });

    expect(result.source).toBe('manual');
    expect(result.entries).toEqual([
      {
        logDate: '2026-04-01',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-03',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
    expect(result.dateRange).toEqual({
      startIso: '2026-04-01',
      endIso: '2026-04-03',
    });
    expect(result.skippedRows).toEqual([
      {
        rowNumber: 1,
        reason: 'unsupported',
        message: "Row 1 is older than Floriva's 12-month manual import window.",
      },
    ]);
    expect(result.warnings).toEqual([
      'Merged 2 manual period-history rows for 2026-04-01.',
    ]);
  });

  it('salvages valid Clue .cluedata rows and maps third-party field names', () => {
    const result = parseClueImport({
      data: [
        {
          day: '2026-04-02T05:00:00.000Z',
          flow: 'light',
          symptoms: ['cramps', 'not-a-symptom'],
          bloating: true,
          sleepQuality: 'great',
        },
        {
          day: '2026-04-02T06:00:00.000Z',
          period: 'heavy',
          emotion: 'anxious',
          note: '  Keep this clue note.  ',
        },
        {
          day: 'broken-date',
          flow: 'medium',
        },
      ],
    });

    expect(result.source).toBe('clue');
    expect(result.entries).toEqual([
      {
        logDate: '2026-04-02',
        bleeding: 'heavy',
        symptoms: ['cramps', 'bloating'],
        mood: 'sensitive',
        notes: 'Keep this clue note.',
      },
    ]);
    expect(result.dateRange).toEqual({
      startIso: '2026-04-02',
      endIso: '2026-04-02',
    });
    expect(result.skippedRows).toEqual([
      {
        rowNumber: 3,
        reason: 'invalid',
        message: 'Row 3 has an invalid date.',
      },
    ]);
    expect(result.warnings).toEqual([
      'Ignored unsupported Clue field on row 1: sleepQuality.',
      'Ignored 1 unsupported symptom value on row 1.',
      'Merged 2 Clue rows for 2026-04-02.',
    ]);
  });

  it('fails clearly when a Flo export uses an unsupported future shape', () => {
    expect(() =>
      parseFloImport({
        events: [],
      }),
    ).toThrow(UnsupportedImportShapeError);
  });

  it('normalizes list-style Flo export rows and skips malformed ones', () => {
    const result = parseFloImport({
      data: [
        {
          recordedAt: '2026-04-05T08:30:00.000Z',
          category: 'flow',
          value: 'light',
        },
        {
          recordedAt: '2026-04-05T08:31:00.000Z',
          category: 'symptom',
          value: ['bloating', 'fatigue'],
        },
        {
          recordedAt: '2026-04-05T08:32:00.000Z',
          category: 'flow',
          value: 'heavy',
        },
        {
          recordedAt: '2026-04-05T08:33:00.000Z',
          category: 'sleep',
          value: 'great',
        },
        {
          recordedAt: 'bad-date',
          category: 'flow',
          value: 'medium',
        },
      ],
    });

    expect(result.source).toBe('flo');
    expect(result.entries).toEqual([
      {
        logDate: '2026-04-05',
        bleeding: 'heavy',
        symptoms: ['bloating', 'fatigue'],
      },
    ]);
    expect(result.skippedRows).toEqual([
      {
        rowNumber: 5,
        reason: 'invalid',
        message: 'Row 5 has an invalid date.',
      },
    ]);
    expect(result.warnings).toEqual([
      'Ignored unsupported Flo value category "sleep" on row 4.',
    ]);
  });

  it('keeps supported notes, mood, TTC, and birth-control details when Flo rows are valid', () => {
    const result = parseFloImport({
      values: [
        {
          recordedAt: '2026-04-06T08:00:00.000Z',
          category: 'flow',
          value: 'medium',
        },
        {
          recordedAt: '2026-04-06T08:01:00.000Z',
          category: 'symptom',
          value: ['fatigue'],
        },
        {
          recordedAt: '2026-04-06T08:02:00.000Z',
          category: 'mood',
          value: 'steady',
        },
        {
          recordedAt: '2026-04-06T08:03:00.000Z',
          category: 'note',
          value: '  Keep this note trimmed.  ',
        },
        {
          recordedAt: '2026-04-06T08:04:00.000Z',
          category: 'cervical mucus',
          value: 'creamy',
        },
        {
          recordedAt: '2026-04-06T08:05:00.000Z',
          category: 'ovulation test',
          value: 'positive',
        },
        {
          recordedAt: '2026-04-06T08:06:00.000Z',
          category: 'bbt',
          value: '36.5',
        },
        {
          recordedAt: '2026-04-06T08:07:00.000Z',
          category: 'sex',
          value: 'yes',
        },
        {
          recordedAt: '2026-04-06T08:08:00.000Z',
          category: 'birth control',
          value: 'pill',
        },
        'bad-row',
        {
          recordedAt: '2026-04-07T08:00:00.000Z',
          category: 'note',
          value: 'No bleeding for this day',
        },
      ],
    });

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-06',
        bleeding: 'medium',
        symptoms: ['fatigue'],
        notes: 'Keep this note trimmed.',
        mood: 'steady',
        ttcObservation: {
          cervicalMucus: 'creamy',
          ovulationTest: 'positive',
          basalBodyTemperatureCelsius: 36.5,
          sexLogged: true,
        },
        birthControlEvent: {
          method: 'pill',
        },
      },
    ]);
    expect(result.skippedRows).toEqual([
      {
        rowNumber: 10,
        reason: 'invalid',
        message: 'Row 10 is not an object.',
      },
      {
        rowNumber: 11,
        reason: 'invalid',
        message: 'Row 11 is missing a valid bleeding value.',
      },
    ]);
  });

  it('rejects malformed manual-history containers and reports invalid dates inside valid ones', () => {
    expect(() => parseManualHistoryImport(null)).toThrow(UnsupportedImportShapeError);
    expect(() =>
      parseManualHistoryImport({
        periodStarts: '2026-04-01',
      }),
    ).toThrow(UnsupportedImportShapeError);

    const result = parseManualHistoryImport({
      periodStarts: ['2026-04-01', 'bad-date'],
    });

    expect(result.skippedRows).toEqual([
      {
        rowNumber: 2,
        reason: 'invalid',
        message: 'Row 2 has an invalid date.',
      },
    ]);
  });

  it('supports top-level Flo arrays and alternate third-party field aliases', () => {
    const result = parseFloImport([
      {
        tracked_at: '2026-04-08T07:00:00.000Z',
        flow: 'spot',
        symptom: 'insomnia',
        feeling: 'happy',
        cervical_mucus: 'egg white',
        ovulation_test: 'peak',
        temperature: 36.7,
        sex_logged: true,
        birth_control_method: 'ring',
        missed_dose: 'yes',
        late_dose: 'no',
      },
      {
        start_date: '2026-04-09',
        period: 'no period',
        observations: ['sex'],
        comment: '  Keep this alternate note.  ',
      },
    ]);

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-08',
        bleeding: 'spotting',
        symptoms: ['sleep-changes'],
        mood: 'steady',
        ttcObservation: {
          cervicalMucus: 'egg-white',
          ovulationTest: 'peak',
          basalBodyTemperatureCelsius: 36.7,
          sexLogged: true,
        },
        birthControlEvent: {
          method: 'ring',
          missedDose: true,
          lateDose: false,
        },
      },
      {
        logDate: '2026-04-09',
        bleeding: 'none',
        symptoms: ['sex'],
        notes: 'Keep this alternate note.',
      },
    ]);
    // 'insomnia' resolves to the canonical 'sleep-changes' (asserted above), so
    // it imported fine — no false "unsupported symptom value" warning is raised.
    expect(result.warnings).toEqual([]);
  });

  it('passes through direct Floriva-compatible TTC and birth-control objects in generic daily rows', () => {
    const result = parseFloImport({
      data: [
        {
          date: '2026-04-10',
          bleeding: 'medium',
          ttcObservation: {
            sexLogged: false,
          },
          birthControlEvent: {
            method: 'iud',
            lateDose: true,
          },
        },
      ],
    });

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-10',
        bleeding: 'medium',
        symptoms: [],
        ttcObservation: {
          sexLogged: false,
        },
        birthControlEvent: {
          method: 'iud',
          lateDose: true,
        },
      },
    ]);
  });

  it('supports public converter-style Clue arrays with date/type/value entries', () => {
    const result = parseClueImport([
      {
        date: '2026-04-12',
        type: 'period',
        value: {
          option: 'light',
        },
      },
      {
        date: '2026-04-12',
        type: 'feelings',
        value: [
          {
            option: 'anxious',
          },
        ],
      },
      {
        date: '2026-04-12',
        type: 'discharge',
        value: [
          {
            option: 'egg_white',
          },
        ],
      },
      {
        date: '2026-04-12',
        type: 'bbt',
        value: {
          excluded: false,
          celsius: 36.48,
        },
      },
      {
        date: '2026-04-13',
        type: 'pain',
        value: [
          {
            option: 'period_cramps',
          },
          {
            option: 'breast_tenderness',
          },
        ],
      },
    ]);

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-12',
        bleeding: 'light',
        symptoms: [],
        mood: 'sensitive',
        ttcObservation: {
          cervicalMucus: 'egg-white',
          basalBodyTemperatureCelsius: 36.48,
        },
      },
      {
        logDate: '2026-04-13',
        bleeding: 'none',
        symptoms: ['cramps', 'breast-tenderness'],
      },
    ]);
    expect(result.dateRange).toEqual({
      startIso: '2026-04-12',
      endIso: '2026-04-13',
    });
  });

  it('handles empty or partially malformed public Clue arrays without losing valid ovulation rows', () => {
    expect(parseClueImport([])).toEqual({
      source: 'clue',
      entries: [],
      skippedRows: [],
      warnings: [],
      dateRange: null,
    });

    const result = parseClueImport([
      {
        date: '2026-04-16',
        type: 'ovulation',
        value: 'peak',
      },
      {
        date: '   ',
        type: 'period',
        value: {
          option: 'light',
        },
      },
      null,
    ]);

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-16',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          ovulationTest: 'peak',
        },
      },
    ]);
    expect(result.skippedRows).toEqual([
      {
        rowNumber: 2,
        reason: 'invalid',
        message: 'Row 2 has an invalid date.',
      },
      {
        rowNumber: 3,
        reason: 'invalid',
        message: 'Row 3 is not an object.',
      },
    ]);
  });

  it('supports Flo cycle-container exports from public converter and official API samples', () => {
    const operationalDataResult = parseFloImport({
      operationalData: {
        cycles: [
          {
            period_start_date: '2026-04-10T00:00:00.000Z',
            period_end_date: '2026-04-12T00:00:00.000Z',
          },
        ],
      },
    });

    expect(operationalDataResult.entries).toEqual([
      {
        logDate: '2026-04-10',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-11',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-12',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
    expect(operationalDataResult.dateRange).toEqual({
      startIso: '2026-04-10',
      endIso: '2026-04-12',
    });

    const updateCyclesResult = parseFloImport({
      update: {
        cycles: [
          {
            period_start_date: '2026-04-20T00:00:00.000Z',
            period_end_date: '2026-04-21T00:00:00.000Z',
            period_intensity: {
              4: -1,
              3: -1,
            },
          },
        ],
      },
      delete: {},
    });

    expect(updateCyclesResult.entries).toEqual([
      {
        logDate: '2026-04-20',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-21',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
  });

  it('merges Flo cycle containers with standard data rows in mixed exports', () => {
    const result = parseFloImport({
      data: [
        {
          recordedAt: '2026-04-11T08:00:00.000Z',
          category: 'symptom',
          value: ['fatigue'],
        },
      ],
      operationalData: {
        cycles: [
          {
            period_start_date: '2026-04-10T00:00:00.000Z',
            period_end_date: '2026-04-12T00:00:00.000Z',
          },
        ],
      },
    });

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-10',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-11',
        bleeding: 'medium',
        symptoms: ['fatigue'],
      },
      {
        logDate: '2026-04-12',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects malformed Clue containers and ignores unsupported falsey fields without warning', () => {
    expect(() => parseClueImport(null)).toThrow(UnsupportedImportShapeError);
    expect(() => parseFloImport(null)).toThrow(UnsupportedImportShapeError);
    expect(() =>
      parseClueImport({
        entries: [],
      }),
    ).toThrow(UnsupportedImportShapeError);

    const result = parseClueImport({
      data: [
        {
          day: '2026-04-11',
          flow: 'light',
          unsupportedEmpty: '',
          unsupportedFalse: false,
          unsupportedObject: {},
        },
      ],
    });

    expect(result.entries).toEqual([
      {
        logDate: '2026-04-11',
        bleeding: 'light',
        symptoms: [],
      },
    ]);
    expect(result.warnings).toEqual([]);
  });
});
