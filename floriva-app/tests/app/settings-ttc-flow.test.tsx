import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { OnboardingProvider } from '../../src/features/onboarding/OnboardingProvider';
import { t } from '@/tests/helpers/localization';

const mockReplace = jest.fn();
const mockSaveProfile = jest.fn();
const mockGetProfile = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('../../src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: (...args: unknown[]) => mockGetProfile(...args),
        saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
      },
    },
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    privacyPreference: {
      diagnosticsConsentEnabled: true,
    },
  }),
}));

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

// eslint-disable-next-line import/first
import SettingsTtcExpectationsRoute from '../../app/(app)/settings/ttc-expectations';
// eslint-disable-next-line import/first
import SettingsTtcSetupRoute from '../../app/(app)/settings/ttc-setup';
// eslint-disable-next-line import/first
import { testIds } from '../../src/testing/testIds';

describe('settings TTC routes', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockReplace.mockReset();
    mockSaveProfile.mockReset();
    mockGetProfile.mockReset();
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 31,
      periodLengthDays: 6,
      lastPeriodStartDate: '2026-03-30',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the TTC setup route inside the shared onboarding draft wrapper', () => {
    render(
      <OnboardingProvider>
        <SettingsTtcSetupRoute />
      </OnboardingProvider>,
    );

    expect(screen.getByTestId(testIds.onboarding.ttcSetup.screen)).toBeTruthy();
    expect(screen.getAllByText(/Trying to /).length).toBeGreaterThan(0);
  });

  it('saves the edited TTC profile and returns to Settings', async () => {
    render(
      <OnboardingProvider
        initialDraft={{
          cycleLengthInput: '30',
          periodLengthInput: '5',
          lastPeriodStartDate: '2026-04-01',
          goals: ['period', 'trying-to-conceive'],
          supportsIrregularCycles: true,
          conditionTags: ['pcos'],
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: false,
            cervicalMucus: true,
            basalBodyTemperature: false,
          },
          reminderSetupChoice: 'skip',
          importSetupChoice: 'skip',
          biometricsSetupChoice: 'skip',
        }}
      >
        <SettingsTtcExpectationsRoute />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcExpectations.continueButton));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-03-30',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: false,
          cervicalMucus: true,
          basalBodyTemperature: false,
        },
      });
      expect(mockReplace).toHaveBeenCalledWith('/settings');
    });
  });

  it('surfaces a stable TTC save error when persistence rejects with a non-Error value', async () => {
    mockSaveProfile.mockRejectedValueOnce('save failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <OnboardingProvider
        initialDraft={{
          cycleLengthInput: '30',
          periodLengthInput: '5',
          lastPeriodStartDate: '2026-04-01',
          goals: ['period', 'trying-to-conceive'],
          supportsIrregularCycles: true,
          conditionTags: ['pcos'],
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: false,
            cervicalMucus: true,
            basalBodyTemperature: false,
          },
          reminderSetupChoice: 'skip',
          importSetupChoice: 'skip',
          biometricsSetupChoice: 'skip',
        }}
      >
        <SettingsTtcExpectationsRoute />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcExpectations.continueButton));

    await waitFor(() => {
      expect(screen.getByText(t('onboarding.ttcExpectations.error'))).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});
