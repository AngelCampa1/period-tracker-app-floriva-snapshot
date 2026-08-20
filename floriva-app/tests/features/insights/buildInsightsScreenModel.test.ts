import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import type { DailyLogEntry, SupportedLocale, UserProfile } from '@/src/types/domain';

describe('buildInsightsScreenModel', () => {
  it('builds a local monthly briefing from current-month logs without medical claims', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: {
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'apr-1',
          logDate: '2026-04-01',
          bleeding: 'heavy',
          symptoms: ['cramps', 'fatigue'],
          mood: 'low',
        },
        {
          id: 'apr-2',
          logDate: '2026-04-02',
          bleeding: 'medium',
          symptoms: ['fatigue'],
          mood: 'steady',
        },
        {
          id: 'apr-12',
          logDate: '2026-04-12',
          bleeding: 'none',
          symptoms: ['discharge'],
          mood: 'energized',
          importSessionId: 'import-clue',
          birthControlEvent: {
            method: 'pill',
            lateDose: false,
          },
          ttcObservation: {
            sexLogged: true,
          },
        },
        {
          id: 'old',
          logDate: '2026-03-12',
          bleeding: 'light',
          symptoms: ['headache'],
        },
      ],
    });

    // LT-22: `lead` now cites symptomDays (a DAY count), the SAME number
    // symptomDaysLabel shows below it, instead of a distinct symptom-TYPE
    // count under the "tracked signals" name -- the two numbers happened to
    // coincide at 3 in this fixture (3 logs this month, 3 distinct symptom
    // types: fatigue, cramps, discharge -- ALSO 3 symptom-DAYS, since every
    // one of those 3 logs has at least one symptom), which is exactly why
    // the incoherence (a symptom-type count that could exceed the log
    // count) was easy to miss here; see the probe test for a fixture where
    // the two numbers actually diverge.
    expect(model.monthlyBriefing).toEqual({
      title: 'April briefing',
      subtitle: '3 local logs reviewed',
      lead: 'April shows 2 period days and 3 symptom days so far.',
      // UL-33: raw counts for stat-card values whose card label already names
      // the unit ("PERIOD DAYS / 2", never "PERIOD DAYS / 2 period days").
      periodDaysCount: 2,
      symptomDaysCount: 3,
      periodDaysLabel: '2 period days',
      symptomDaysLabel: '3 symptom days',
      hasTopSignals: true,
      topSignalsLabel: 'Fatigue, Cramps, Discharge',
      sourceLabels: ['Imported history included'],
      emptyState: 'Keep logging this month to build a fuller local briefing.',
    });
  });

  it('only labels TTC and birth-control sources when those modes are currently enabled', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: {
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
        birthControlMethod: 'pill',
      },
      logEntries: [
        {
          id: 'apr-12',
          logDate: '2026-04-12',
          bleeding: 'none',
          symptoms: [],
          birthControlEvent: {
            method: 'pill',
            lateDose: false,
          },
          ttcObservation: {
            sexLogged: true,
          },
        },
      ],
    });

    expect(model.monthlyBriefing.sourceLabels).toEqual([
      'TTC details logged on 1 day',
      'Birth-control details logged on 1 day',
    ]);
  });

  it('uses the latest logged month when the current month has no local logs', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-05-14',
      locale: 'en',
      profile: {
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'apr-1',
          logDate: '2026-04-01',
          bleeding: 'heavy',
          symptoms: ['cramps'],
        },
      ],
    });

    expect(model.monthlyBriefing.title).toBe('April briefing');
    expect(model.monthlyBriefing.subtitle).toBe('1 local log reviewed');
  });


  it('reports an active fertile window, includes BBT highlights, and builds endometriosis summaries', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-10',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: ['endometriosis'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: true,
        },
      },
      logEntries: [
        {
          id: 'period-start-1',
          logDate: '2026-02-28',
          bleeding: 'heavy',
          symptoms: ['cramps'],
        },
        {
          id: 'period-start-2',
          logDate: '2026-03-28',
          bleeding: 'heavy',
          symptoms: ['cramps'],
        },
        {
          id: 'fertile-bbt',
          logDate: '2026-04-09',
          bleeding: 'none',
          symptoms: ['cramps'],
          ttcObservation: {
            basalBodyTemperatureCelsius: 36.5,
          },
        },
      ],
    });

    expect(model.cyclePattern).toMatchObject({
      periodStartsLabel: '2 logged period starts',
      nextPeriodLabel: 'Next period expected around Apr 25',
      // Two starts is a single observed interval — medium, not "steady rhythm".
      confidenceLabel: 'Medium confidence',
    });
    // Two logged starts = one observed interval, so the cycle-length card may show a real average.
    expect(model.cycleLengthData.hasObservedHistory).toBe(true);
    expect(model.ttcSummary?.fertileWindowLabel).toBe('Fertile window active today');
    expect(model.ttcSummary?.latestHighlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'basalBodyTemperature',
          label: 'BBT 36.50 C',
        }),
      ]),
    );
    expect(model.ttcSummary?.recentLogSummaries).toEqual([
      {
        date: '2026-04-09',
        summary: 'BBT added',
      },
    ]);
    expect(model.conditionSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'endometriosis',
          loggingHint: 'Pain and heavier-flow days are quick to log here.',
          recentLogCount: 3,
          summary: 'Cramps appeared on 3 logged days and heavy bleeding on 2 days in the last 90 days.',
          trackedSymptomLabels: ['Cramps', 'Fatigue', 'Bloating'],
        }),
      ]),
    );
  });

  it('does not build TTC insights when TTC mode is off even if stale observations exist', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-13',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'fertile-observation',
          logDate: '2026-04-12',
          bleeding: 'none',
          symptoms: [],
          ttcObservation: {
            ovulationTest: 'positive',
            sexLogged: true,
          },
        },
      ],
    });

    expect(model.ttcSummary).toBeUndefined();
  });

  it('localizes the cycle summary for Spanish', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-08',
      locale: 'es',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'period-start-1',
          logDate: '2026-03-28',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
    });

    // A single logged start is not an observed interval — the average is only an estimate.
    expect(model.cycleLengthData.hasObservedHistory).toBe(false);
    expect(model.ttcSummary?.fertileWindowLabel).toBe('La ventana fértil está activa hoy');
  });

  it('reports when the fertile window has not opened yet', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-03',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'period-start-1',
          logDate: '2026-02-28',
          bleeding: 'medium',
          symptoms: [],
        },
        {
          id: 'period-start-2',
          logDate: '2026-03-28',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
    });

    expect(model.cyclePattern).toMatchObject({
      periodStartsLabel: '2 logged period starts',
      nextPeriodLabel: 'Next period expected around Apr 25',
      confidenceLabel: 'Medium confidence',
    });
    expect(model.ttcSummary?.fertileWindowLabel).toBe('Fertile window opens in 3 days');
  });

  it('keeps TTC mode available with an empty recent-log summary', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-08',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'period-start-1',
          logDate: '2026-03-28',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
    });

    expect(model.ttcSummary?.recentLogSummaries).toEqual([]);
    expect(model.ttcSummary?.latestHighlights).toEqual([]);
  });

  it('uses singular fertile-window grammar after the window ends', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-12',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: 'period-start-1',
          logDate: '2026-02-28',
          bleeding: 'medium',
          symptoms: [],
        },
        {
          id: 'period-start-2',
          logDate: '2026-03-28',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
    });

    expect(model.ttcSummary?.fertileWindowLabel).toBe('Fertile window ended 1 day ago');
  });

  it('localizes TTC observation highlights across supported languages', () => {
    // UL-14: highlights are scoped to the current fertile window (Apr 6-11
    // for this seed profile), so the observation fixtures below are dated
    // inside it -- this test exercises LABEL localization, not the window
    // filter (covered by buildInsightsScreenModel.uiLiftDomainLogic.test.ts).
    const locales: SupportedLocale[] = ['es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru', 'en'];

    const labelsByLocale = locales.map((locale) => {
      const model = buildInsightsScreenModel({
        todayIso: '2026-04-13',
        locale,
        profile: {
          cycleLengthDays: 28,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-03-28',
          goals: ['period', 'trying-to-conceive'],
          supportsIrregularCycles: false,
          conditionTags: [],
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: true,
            cervicalMucus: true,
            basalBodyTemperature: false,
          },
        },
        logEntries: [
          {
            id: `${locale}-peak`,
            logDate: '2026-04-11',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: {
              ovulationTest: 'peak',
              sexLogged: true,
              cervicalMucus: 'egg-white',
            },
          },
          {
            id: `${locale}-positive`,
            logDate: '2026-04-10',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: {
              ovulationTest: 'positive',
              cervicalMucus: 'creamy',
            },
          },
          {
            id: `${locale}-negative`,
            logDate: '2026-04-09',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: {
              ovulationTest: 'negative',
              cervicalMucus: 'sticky',
            },
          },
          {
            id: `${locale}-dry`,
            logDate: '2026-04-08',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: {
              cervicalMucus: 'dry',
            },
          },
        ],
      });

      return model.ttcSummary?.latestHighlights.map((highlight) => highlight.label) ?? [];
    });

    expect(labelsByLocale).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          'Prueba de ovulación pico',
          'Sexo registrado',
          'Moco cervical tipo clara de huevo',
          'Prueba de ovulación positiva',
        ]),
        expect.arrayContaining([
          'Peak-Ovulationstest',
          'Sex erfasst',
          'Eiweißartiger Zervixschleim',
          'Positiver Ovulationstest',
        ]),
        expect.arrayContaining([
          'Test d’ovulation au pic',
          'Rapport sexuel noté',
          "Glaire cervicale type blanc d'œuf",
          'Test d’ovulation positif',
        ]),
        expect.arrayContaining([
          '排卵検査薬ピーク',
          '性交を記録',
          '頸管粘液 卵白状',
          '排卵検査薬陽性',
        ]),
        expect.arrayContaining([
          '排卵试纸峰值',
          '已记录性生活',
          '宫颈黏液蛋清状',
          '排卵试纸阳性',
        ]),
        expect.arrayContaining([
          'Teste de ovulação pico',
          'Sexo registrado',
          'Muco cervical tipo clara de ovo',
          'Teste de ovulação positivo',
        ]),
        expect.arrayContaining([
          'Пик теста на овуляцию',
          'Секс отмечен',
          'Цервикальная слизь как яичный белок',
          'Положительный тест на овуляцию',
        ]),
        expect.arrayContaining([
          'Peak ovulation test',
          'Sex logged',
          'Egg-white cervical mucus',
          'Positive ovulation test',
        ]),
      ]),
    );
  });

  it('summarizes PMDD mood shifts before the last logged period', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-15',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: '2026-04-10-sensitive',
          logDate: '2026-04-10',
          bleeding: 'none',
          mood: 'sensitive',
          symptoms: ['fatigue'],
        },
        {
          id: '2026-04-14-low',
          logDate: '2026-04-14',
          bleeding: 'none',
          mood: 'low',
          symptoms: [],
        },
        {
          id: '2026-04-15-period',
          logDate: '2026-04-15',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
    });

    expect(model.conditionSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'pmdd',
          summary:
            'In the 7 days before the last logged period, mood shifts appeared on 2 days and related symptoms on 1 day.',
        }),
      ]),
    );
  });

  it('summarizes PCOS spotting when recent cycle intervals are available', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-18',
      locale: 'en',
      profile: {
        cycleLengthDays: 35,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-10',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pcos'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      logEntries: [
        {
          id: '2026-02-28-heavy',
          logDate: '2026-02-28',
          bleeding: 'heavy',
          symptoms: [],
        },
        {
          id: '2026-04-10-medium',
          logDate: '2026-04-10',
          bleeding: 'medium',
          symptoms: [],
        },
        {
          id: '2026-04-16-spotting',
          logDate: '2026-04-16',
          bleeding: 'spotting',
          symptoms: [],
        },
      ],
    });

    expect(model.conditionSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'pcos',
          summary:
            'Recent cycle starts span 41 days, and spotting appeared on 1 logged day in the last 90 days.',
        }),
      ]),
    );
  });

  it('exposes confidence improvements derived from the current confidence reasons', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-20',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [
        {
          id: '2026-02-28-medium',
          logDate: '2026-02-28',
          bleeding: 'medium',
          symptoms: [],
        },
        {
          id: '2026-03-28-heavy',
          logDate: '2026-03-28',
          bleeding: 'heavy',
          symptoms: [],
        },
      ],
    });

    expect(model.improvements).toEqual([
      {
        code: 'one-observed-interval',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
    expect(model.cyclePattern.confidenceLevel).toBe('medium');
  });

  it('omits improvements entirely when confidence reasons have nothing actionable', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-20',
      locale: 'en',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-01-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [
        {
          id: '2026-01-01-heavy',
          logDate: '2026-01-01',
          bleeding: 'heavy',
          symptoms: [],
        },
        {
          id: '2026-01-29-heavy',
          logDate: '2026-01-29',
          bleeding: 'heavy',
          symptoms: [],
        },
        {
          id: '2026-02-26-heavy',
          logDate: '2026-02-26',
          bleeding: 'heavy',
          symptoms: [],
        },
        {
          id: '2026-03-26-heavy',
          logDate: '2026-03-26',
          bleeding: 'heavy',
          symptoms: [],
        },
      ],
    });

    expect(model.cyclePattern.confidenceLabel).toBe('High confidence');
    expect(model.improvements).toBeUndefined();
  });
});

// --- B5: Insights "Observations" -- renders ALL non-dismissed anomalies, not
// just the head (contrast with Today's buildTodaySnapshot, which takes only
// the head). Reuses the same fixture as buildTodaySnapshot.test.ts's
// "anomaly threading" suite (a regular 28-day user, 41 days into an open
// cycle, both missed-expected-period and long-cycle fire).
describe('buildInsightsScreenModel -- observations', () => {
  const ANOMALY_PROFILE: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-02',
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };
  const ANOMALY_ENTRIES: DailyLogEntry[] = [
    { id: '2026-01-05', logDate: '2026-01-05', bleeding: 'medium' as const, symptoms: [] },
    { id: '2026-02-02', logDate: '2026-02-02', bleeding: 'medium' as const, symptoms: [] },
    { id: '2026-03-02', logDate: '2026-03-02', bleeding: 'medium' as const, symptoms: [] },
  ];

  it('lists every non-dismissed anomaly, most-recent-anchor first', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-12',
      profile: ANOMALY_PROFILE,
      logEntries: ANOMALY_ENTRIES,
      locale: 'en',
      dismissedAnomalyIds: [],
    });

    expect(model.observations).toEqual([
      {
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      },
      {
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      },
    ]);
  });

  it('excludes dismissed anomalies while still listing the rest', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-12',
      profile: ANOMALY_PROFILE,
      logEntries: ANOMALY_ENTRIES,
      locale: 'en',
      dismissedAnomalyIds: ['missed-expected-period:2026-03-30'],
    });

    expect(model.observations).toEqual([
      {
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      },
    ]);
  });

  it('omits observations entirely once every detected anomaly has been dismissed', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-12',
      profile: ANOMALY_PROFILE,
      logEntries: ANOMALY_ENTRIES,
      locale: 'en',
      dismissedAnomalyIds: [
        'missed-expected-period:2026-03-30',
        'long-cycle:2026-03-02',
      ],
    });

    expect(model.observations).toBeUndefined();
    expect('observations' in model).toBe(false);
  });

  it('omits observations entirely when the engine detected no anomalies', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-20',
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [
        { id: '2026-02-28', logDate: '2026-02-28', bleeding: 'medium', symptoms: [] },
        { id: '2026-03-28', logDate: '2026-03-28', bleeding: 'heavy', symptoms: [] },
      ],
      locale: 'en',
      dismissedAnomalyIds: [],
    });

    expect(model.observations).toBeUndefined();
    expect('observations' in model).toBe(false);
  });

  it('defaults dismissedAnomalyIds to empty when the option is omitted', () => {
    const model = buildInsightsScreenModel({
      todayIso: '2026-04-12',
      profile: ANOMALY_PROFILE,
      logEntries: ANOMALY_ENTRIES,
      locale: 'en',
    });

    expect(model.observations).toEqual([
      {
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      },
      {
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      },
    ]);
  });
});
