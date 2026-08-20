import { defaultUserProfile } from '@/src/db/domainDefaults';
import {
  buildImportedOnboardingCompletion,
  buildOnboardingCompletion,
  createDefaultOnboardingDraft,
  createOnboardingDraftFromProfile,
  normalizeOnboardingDateInput,
  resolveOnboardingGuardRedirect,
  type OnboardingDraft,
  validateCycleBasicsStep,
  validateGoalsStep,
} from '@/src/features/onboarding/model';

const mockGetLocalTodayLogDate = jest.fn(() => '2026-04-10');

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => mockGetLocalTodayLogDate(),
}));

function createFreshStartDraft(
  overrides: Partial<OnboardingDraft> = {},
): OnboardingDraft {
  return {
    ...createDefaultOnboardingDraft(),
    startPath: 'fresh',
    lastPeriodStartDate: '2026-04-01',
    hasCompletedAccessStep: true,
    ...overrides,
  };
}

describe('onboarding model', () => {
  it('starts from privacy-first defaults with one-decision fields unset', () => {
    expect(createDefaultOnboardingDraft()).toEqual({
      cycleLengthInput: String(defaultUserProfile.cycleLengthDays),
      hasConfirmedCycleLength: false,
      periodLengthInput: String(defaultUserProfile.periodLengthDays),
      hasConfirmedPeriodLength: false,
      lastPeriodStartDate: '',
      goals: [],
      supportsIrregularCycles: null,
      conditionTags: [],
      ttcTrackingPreferences: defaultUserProfile.ttcTrackingPreferences,
      reminderSetupChoice: 'skip',
      importSetupChoice: 'skip',
      biometricsSetupChoice: 'skip',
      startPath: null,
      hasSelectedFreshPath: false,
      symptomLoggingEnabled: null,
      ttcEnabled: null,
      ttcTrackingPreset: null,
      hasCompletedTtcSetupStep: false,
      hasCompletedTtcExpectationsStep: false,
      hasCompletedAccessStep: false,
    });
  });

  it('hydrates the new onboarding decisions from an existing profile', () => {
    expect(
      createOnboardingDraftFromProfile({
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms', 'trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: ['pcos'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: true,
          basalBodyTemperature: true,
        },
      }),
    ).toEqual({
      cycleLengthInput: '31',
      hasConfirmedCycleLength: true,
      periodLengthInput: '6',
      hasConfirmedPeriodLength: true,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
      reminderSetupChoice: 'skip',
      importSetupChoice: 'skip',
      biometricsSetupChoice: 'skip',
      startPath: 'fresh',
      hasSelectedFreshPath: false,
      symptomLoggingEnabled: true,
      ttcEnabled: true,
      ttcTrackingPreset: 'full',
      hasCompletedTtcSetupStep: true,
      hasCompletedTtcExpectationsStep: true,
      hasCompletedAccessStep: false,
    });
  });

  it('keeps defaults when no profile is available to hydrate from', () => {
    expect(createOnboardingDraftFromProfile(null)).toEqual(createDefaultOnboardingDraft());
  });

  it('builds a profile from the redesigned fresh-start onboarding flow', () => {
    expect(
      buildOnboardingCompletion(
        createFreshStartDraft({
          cycleLengthInput: '30',
          hasConfirmedCycleLength: true,
          periodLengthInput: '6',
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: true,
          ttcEnabled: false,
        }),
      ),
    ).toEqual({
      profile: {
        cycleLengthDays: 30,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: defaultUserProfile.ttcTrackingPreferences,
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
    });
  });

  it('persists TTC preset choices from fresh-start completion', () => {
    expect(
      buildOnboardingCompletion(
        createFreshStartDraft({
          cycleLengthInput: '34',
          hasConfirmedCycleLength: true,
          periodLengthInput: '7',
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: true,
          ttcTrackingPreset: 'full',
        }),
      ),
    ).toEqual({
      profile: {
        cycleLengthDays: 34,
        periodLengthDays: 7,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: true,
          basalBodyTemperature: true,
        },
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
    });
  });

  it('normalizes slash-formatted onboarding dates into ISO storage', () => {
    expect(normalizeOnboardingDateInput('4/3/2026')).toBe('2026-04-03');
    expect(normalizeOnboardingDateInput('2026/4/3')).toBe('2026-04-03');
  });

  it('rejects invalid onboarding date formats and impossible dates', () => {
    expect(normalizeOnboardingDateInput('2026-02-31')).toBeNull();
    expect(normalizeOnboardingDateInput('04/xx/2026')).toBeNull();
    expect(normalizeOnboardingDateInput('2026-04')).toBeNull();
  });

  it('validates cycle basics for required, ranged, and future values', () => {
    expect(
      validateCycleBasicsStep(
        createFreshStartDraft({
          cycleLengthInput: 'abc',
          periodLengthInput: '0',
          lastPeriodStartDate: 'not-a-date',
        }),
      ),
    ).toEqual({
      cycleLengthInput: 'onboarding.basics.validation.cycleLengthRequired',
      periodLengthInput: 'onboarding.basics.validation.periodLengthRange',
      lastPeriodStartDate: 'onboarding.basics.validation.lastPeriodStartInvalid',
    });

    expect(
      validateCycleBasicsStep(
        createFreshStartDraft({
          cycleLengthInput: '121',
          periodLengthInput: '31',
          lastPeriodStartDate: '2026-04-20',
        }),
      ),
    ).toEqual({
      cycleLengthInput: 'onboarding.basics.validation.cycleLengthRange',
      periodLengthInput: 'onboarding.basics.validation.periodLengthRange',
      lastPeriodStartDate: 'onboarding.basics.validation.lastPeriodStartFuture',
    });
  });

  it('validates that goals and irregular-cycle support are both chosen', () => {
    expect(
      validateGoalsStep({
        ...createDefaultOnboardingDraft(),
        goals: [],
        supportsIrregularCycles: null,
      }),
    ).toEqual({
      goals: 'onboarding.goals.validation.goalsRequired',
      supportsIrregularCycles: 'onboarding.goals.validation.irregularCyclesRequired',
    });
  });

  it('routes the one-decision onboarding flow to the earliest incomplete step', () => {
    expect(
      resolveOnboardingGuardRedirect('/cycle-length', createDefaultOnboardingDraft()),
    ).toBe('/start-path');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({ lastPeriodStartDate: 'not-a-date' }),
      ),
    ).toBe('/last-period-start');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({ lastPeriodStartDate: '2026-04-20' }),
      ),
    ).toBe('/last-period-start');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({ hasCompletedAccessStep: false }),
      ),
    ).toBe('/cycle-length');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/period-length');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/cycle-length');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/symptom-logging');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/ttc');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: true,
          ttcTrackingPreset: null,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/ttc-preset');

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: true,
        }),
      ),
    ).toBeNull();
  });

  it('does not auto-advance users away from the route they are still reviewing', () => {
    expect(resolveOnboardingGuardRedirect('/welcome', createDefaultOnboardingDraft())).toBeNull();
    expect(
      resolveOnboardingGuardRedirect('/(onboarding)/welcome', createDefaultOnboardingDraft()),
    ).toBeNull();
    expect(
      resolveOnboardingGuardRedirect('/privacy-details', createDefaultOnboardingDraft()),
    ).toBeNull();
    expect(
      resolveOnboardingGuardRedirect(
        '/(onboarding)/privacy-details',
        createDefaultOnboardingDraft(),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/start-path',
        createFreshStartDraft({ startPath: 'fresh' }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/last-period-start',
        createFreshStartDraft({ lastPeriodStartDate: '2026-04-04' }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBeNull();
  });

  it('keeps fresh starts on redesigned setup routes until the setup decisions are complete', () => {
    expect(
      resolveOnboardingGuardRedirect(
        '/cycle-variability',
        createFreshStartDraft({
          lastPeriodStartDate: '2026-04-01',
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBe('/cycle-length');

    expect(
      resolveOnboardingGuardRedirect(
        '/ttc-preset',
        createFreshStartDraft({
          lastPeriodStartDate: '2026-04-01',
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: true,
          ttcTrackingPreset: null,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBeNull();
  });

  it('sends import and restore paths directly to completion instead of manual setup screens', () => {
    expect(
      resolveOnboardingGuardRedirect(
        '/last-period-start',
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
        },
      ),
    ).toBe('/completion');

    // A restore-path user already standing on /completion is left alone.
    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'restore',
        },
      ),
    ).toBeNull();
  });

  it('allows valid import and restore in-progress routes to stay put', () => {
    expect(
      resolveOnboardingGuardRedirect('/import/review', {
        ...createDefaultOnboardingDraft(),
        startPath: 'import',
      }),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect('/restore', {
        ...createDefaultOnboardingDraft(),
        startPath: 'restore',
      }),
    ).toBeNull();
  });

  it('allows completion regardless of the retired onboarding access step', () => {
    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: false,
        }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        createFreshStartDraft({
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
          hasCompletedAccessStep: true,
        }),
      ),
    ).toBeNull();

    expect(
      resolveOnboardingGuardRedirect(
        '/completion',
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: true,
        },
      ),
    ).toBeNull();
  });

  it('throws when a fresh-start draft is still incomplete at completion time', () => {
    expect(() =>
      buildOnboardingCompletion(
        createFreshStartDraft({
          hasCompletedAccessStep: false,
        }),
      ),
    ).toThrow('Onboarding draft is incomplete');
  });

  it('throws when import or restore drafts try to complete through the fresh-start builder', () => {
    expect(() =>
      buildOnboardingCompletion({
        ...createFreshStartDraft(),
        startPath: 'import',
      }),
    ).toThrow('Import and restore onboarding must finish from persisted data.');
  });

  it('supports the legacy non-one-decision draft shape when all required fields are present', () => {
    const draft: OnboardingDraft = {
      ...createDefaultOnboardingDraft(),
      cycleLengthInput: '33',
      periodLengthInput: '7',
      lastPeriodStartDate: '2026-03-30',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    };

    expect(buildOnboardingCompletion(draft)).toEqual({
      profile: {
        cycleLengthDays: 33,
        periodLengthDays: 7,
        lastPeriodStartDate: '2026-03-30',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
    });
  });

  it('rejects legacy drafts that still have invalid cycle basics', () => {
    expect(() =>
      buildOnboardingCompletion({
        ...createDefaultOnboardingDraft(),
        cycleLengthInput: 'abc',
        periodLengthInput: '31',
        lastPeriodStartDate: 'not-a-date',
        goals: ['period'],
        supportsIrregularCycles: true,
      }),
    ).toThrow('Onboarding draft is incomplete');
  });

  it('derives an import completion profile from imported history instead of overwriting with today', () => {
    expect(
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: true,
        },
        null,
        [
          {
            id: 'log-1',
            logDate: '2026-01-01',
            bleeding: 'light',
            symptoms: [],
          },
          {
            id: 'log-2',
            logDate: '2026-01-29',
            bleeding: 'medium',
            symptoms: [],
          },
          {
            id: 'log-3',
            logDate: '2026-02-26',
            bleeding: 'heavy',
            symptoms: [],
          },
          {
            id: 'log-4',
            logDate: '2026-03-26',
            bleeding: 'medium',
            symptoms: [],
          },
        ],
      ),
    ).toEqual({
      profile: {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-26',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
    });
  });

  it('accepts spotting-only imported history when no seeded cycle profile exists yet', () => {
    expect(
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: true,
        },
        null,
        [
          {
            id: 'log-1',
            logDate: '2026-04-01',
            bleeding: 'none',
            symptoms: ['cramps'],
          },
          {
            id: 'log-2',
            logDate: '2026-04-02',
            bleeding: 'spotting',
            symptoms: ['fatigue'],
          },
        ],
      ),
    ).toEqual({
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-10',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
    });
  });

  it('reuses a complete persisted profile during imported onboarding completion', () => {
    expect(
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'restore',
          hasCompletedAccessStep: true,
          reminderSetupChoice: 'later',
        },
        {
          cycleLengthDays: 30,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-01',
          goals: [],
          supportsIrregularCycles: true,
          conditionTags: ['pcos'],
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: false,
            cervicalMucus: false,
            basalBodyTemperature: false,
          },
        },
        [],
      ),
    ).toEqual({
      profile: {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period'],
        supportsIrregularCycles: true,
        conditionTags: ['pcos'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: true,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
      },
    });
  });

  it('rejects imported completion when the start path is not import or restore', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'fresh',
          hasCompletedAccessStep: true,
        },
        null,
        [],
      ),
    ).toThrow('Imported completion is only available for import and restore onboarding.');
  });

  it('does not gate imported completion on the retired billing access step', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: false,
        },
        null,
        [],
      ),
    ).toThrow('Floriva could not find any imported history to finish setup.');
  });

  it('rejects imported completion when no imported history exists', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: true,
        },
        null,
        [],
      ),
    ).toThrow('Floriva could not find any imported history to finish setup.');
  });

  it('rejects imported completion when imported history has no logged period evidence', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        {
          ...createDefaultOnboardingDraft(),
          startPath: 'import',
          hasCompletedAccessStep: true,
        },
        null,
        [
          {
            id: 'log-1',
            logDate: '2026-04-01',
            bleeding: 'none',
            symptoms: ['fatigue'],
          },
        ],
      ),
    ).toThrow('Floriva could not find any logged period days in that imported history.');
  });
});
