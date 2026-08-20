import {
  buildTtcObservationSummary,
  buildTtcTrackingPreview,
  hasEnabledTtcMode,
  hasEnabledTtcTracking,
} from '@/src/features/ttc/summary';

describe('TTC summary helpers', () => {
  it('detects whether any TTC tracking field is enabled', () => {
    expect(hasEnabledTtcTracking()).toBe(false);
    expect(
      hasEnabledTtcTracking({
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      }),
    ).toBe(false);
    expect(
      hasEnabledTtcTracking({
        sex: false,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      }),
    ).toBe(true);
  });

  it('requires the TTC goal before treating TTC mode as enabled', () => {
    const preferences = {
      sex: true,
      ovulationTest: false,
      cervicalMucus: false,
      basalBodyTemperature: false,
    };

    expect(
      hasEnabledTtcMode({
        goals: ['period'],
        ttcTrackingPreferences: preferences,
      }),
    ).toBe(false);
    expect(
      hasEnabledTtcMode({
        goals: ['period', 'trying-to-conceive'],
        ttcTrackingPreferences: preferences,
      }),
    ).toBe(true);
  });

  it('builds a neutral observation summary from logged TTC details', () => {
    expect(
      buildTtcObservationSummary({
        locale: 'en',
        observation: {
          sexLogged: true,
          ovulationTest: 'peak',
          cervicalMucus: 'egg-white',
          basalBodyTemperatureCelsius: 36.55,
        },
      }),
    ).toBe('Sex logged · peak test · egg-white mucus · BBT added');
  });

  it('returns an empty-day label without interpreting fertility or pregnancy odds', () => {
    const summary = buildTtcObservationSummary({
      locale: 'en',
      observation: undefined,
    });

    expect(summary).toBe('No TTC details logged today');
    expect(summary).not.toMatch(/odds|chance|confirm|diagnos|recommend/i);
  });

  it('builds setup preview copy from enabled tracking preferences', () => {
    expect(
      buildTtcTrackingPreview({
        locale: 'en',
        preferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: true,
        },
      }),
    ).toBe('Floriva will keep these fields ready when you log: Sex, Ovulation test, BBT.');
  });

  it('localizes observation summaries and empty setup previews', () => {
    expect(
      buildTtcObservationSummary({
        locale: 'es',
        observation: {
          ovulationTest: 'positive',
          cervicalMucus: 'creamy',
        },
      }),
    ).toBe('prueba positiva · moco cremoso');
    expect(
      buildTtcTrackingPreview({
        locale: 'fr',
        preferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      }),
    ).toBe('Aucun champ TTC sélectionné');
  });
});
