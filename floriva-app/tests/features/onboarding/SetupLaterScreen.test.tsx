import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import { SetupLaterScreen } from '@/src/features/onboarding/screens/SetupLaterScreen';
import { createMockLocalization } from '@/tests/helpers/mockLocalizationProvider';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCompleteOnboarding = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
  }),
}));

jest.mock('@/src/localization/localizationContext', () => ({
  useLocalization: () => {
    const { createMockLocalization: mockCreateMockLocalization } = require('@/tests/helpers/mockLocalizationProvider');

    return mockCreateMockLocalization('en');
  },
}));

describe('SetupLaterScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCompleteOnboarding.mockReset();
  });

  it('completes onboarding into import when the draft keeps import setup as now', async () => {
    mockCompleteOnboarding.mockResolvedValue(undefined);

    render(
      <OnboardingProvider
        initialDraft={{
          cycleLengthInput: '30',
          periodLengthInput: '5',
          lastPeriodStartDate: '2026-04-01',
          goals: ['period'],
          supportsIrregularCycles: false,
          conditionTags: [],
          reminderSetupChoice: 'later',
          importSetupChoice: 'now',
          biometricsSetupChoice: 'skip',
        }}
      >
        <SetupLaterScreen />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByTestId('onboarding-setup-later-complete-button'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleLengthDays: 30,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-01',
        }),
        expect.objectContaining({
          deferredReminderSetup: true,
          deferredImportSetup: false,
          deferredBiometricsSetup: false,
        }),
        '/import',
      );
      expect(mockReplace).toHaveBeenCalledWith('./import');
    });
  });

  it('lets every setup-later choice update the selected draft state before finishing to today', async () => {
    mockCompleteOnboarding.mockResolvedValue(undefined);

    render(
      <OnboardingProvider
        initialDraft={{
          cycleLengthInput: '30',
          periodLengthInput: '5',
          lastPeriodStartDate: '2026-04-01',
          goals: ['trying-to-conceive'],
          supportsIrregularCycles: false,
          conditionTags: [],
          reminderSetupChoice: 'skip',
          importSetupChoice: 'skip',
          biometricsSetupChoice: 'skip',
        }}
      >
        <SetupLaterScreen />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByTestId('onboarding-setup-later-reminder-later'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-reminder-off'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-import-now'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-import-later'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-import-skip'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-biometrics-later'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-biometrics-skip'));
    fireEvent.press(screen.getByText(createMockLocalization('en').t('onboarding.setupLater.backLabel')));

    expect(mockBack).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('onboarding-setup-later-complete-button'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          deferredReminderSetup: false,
          deferredImportSetup: false,
          deferredBiometricsSetup: false,
        }),
        '/today',
      );
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('surfaces a stable error for rejected completion and ignores duplicate taps while saving', async () => {
    let rejectCompletion: ((reason?: unknown) => void) | undefined;
    mockCompleteOnboarding.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectCompletion = reject;
        }),
    );

    render(
      <OnboardingProvider
        initialDraft={{
          cycleLengthInput: '30',
          periodLengthInput: '5',
          lastPeriodStartDate: '2026-04-01',
          goals: ['period'],
          supportsIrregularCycles: false,
          conditionTags: [],
          reminderSetupChoice: 'skip',
          importSetupChoice: 'skip',
          biometricsSetupChoice: 'skip',
        }}
      >
        <SetupLaterScreen />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByTestId('onboarding-setup-later-complete-button'));
    fireEvent.press(screen.getByTestId('onboarding-setup-later-complete-button'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    });
    await screen.findByText(createMockLocalization('en').t('onboarding.setupLater.saving'));

    rejectCompletion?.('save failed');

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-setup-later-error')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText(createMockLocalization('en').t('onboarding.setupLater.backLabel')));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
