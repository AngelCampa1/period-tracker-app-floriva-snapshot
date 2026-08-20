import {
  clearPersistedOnboardingDraft,
  loadPersistedOnboardingDraft,
  persistOnboardingDraft,
} from '@/src/features/onboarding/draftStorage';

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

describe('draftStorage', () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
  });

  it('returns null when the persisted onboarding draft is not a plain object', async () => {
    mockGetItemAsync.mockResolvedValue('[]');

    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('returns null when no onboarding draft has been stored yet', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('sanitizes malformed persisted onboarding drafts instead of trusting raw secure-store payloads', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        cycleLengthInput: '31',
        hasConfirmedCycleLength: true,
        periodLengthInput: 6,
        hasConfirmedPeriodLength: 'yes',
        lastPeriodStartDate: '2026-04-01',
        goals: ['symptoms', 'not-a-goal'],
        supportsIrregularCycles: false,
        conditionTags: ['pmdd', 'made-up-condition'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: 'nope',
          cervicalMucus: false,
          basalBodyTemperature: true,
        },
        reminderSetupChoice: 'later',
        importSetupChoice: 'tomorrow',
        biometricsSetupChoice: 'skip',
        startPath: 'import',
        symptomLoggingEnabled: true,
        ttcEnabled: 'sometimes',
        ttcTrackingPreset: 'full',
        hasCompletedAccessStep: false,
      }),
    );

    await expect(loadPersistedOnboardingDraft()).resolves.toEqual({
      cycleLengthInput: '31',
      hasConfirmedCycleLength: true,
      lastPeriodStartDate: '2026-04-01',
      goals: ['symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: true,
      },
      reminderSetupChoice: 'later',
      biometricsSetupChoice: 'skip',
      startPath: 'import',
      symptomLoggingEnabled: true,
      ttcTrackingPreset: 'full',
      hasCompletedAccessStep: false,
    });
  });

  it('returns null when secure store rejects during draft hydration', async () => {
    mockGetItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('serializes onboarding drafts into secure storage with device-only accessibility', async () => {
    await persistOnboardingDraft({
      cycleLengthInput: '29',
      hasConfirmedCycleLength: false,
      periodLengthInput: '5',
      hasConfirmedPeriodLength: false,
      lastPeriodStartDate: '',
      goals: [],
      supportsIrregularCycles: null,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
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

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'floriva.onboarding-draft.v1',
      expect.stringContaining('"cycleLengthInput":"29"'),
      {
        keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
      },
    );
  });

  it('swallows secure-store write failures when persisting onboarding drafts', async () => {
    mockSetItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(
      persistOnboardingDraft({
        cycleLengthInput: '29',
        hasConfirmedCycleLength: false,
        periodLengthInput: '5',
        hasConfirmedPeriodLength: false,
        lastPeriodStartDate: '',
        goals: [],
        supportsIrregularCycles: null,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
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
      }),
    ).resolves.toBeUndefined();
  });

  it('swallows secure-store delete failures when clearing onboarding drafts', async () => {
    mockDeleteItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(clearPersistedOnboardingDraft()).resolves.toBeUndefined();
  });
});
