import { fireEvent, render, screen } from '@testing-library/react-native';

import { TtcSetupScreen } from '@/src/features/onboarding/screens/TtcSetupScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSetHasCompletedTtcSetupStep = jest.fn();
const mockSetTtcTrackingPreference = jest.fn();

const mockDraft = {
  ttcTrackingPreferences: {
    sex: true,
    ovulationTest: false,
    cervicalMucus: true,
    basalBodyTemperature: false,
  },
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/features/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({
    draft: mockDraft,
    setHasCompletedTtcSetupStep: (...args: unknown[]) =>
      mockSetHasCompletedTtcSetupStep(...args),
    setTtcTrackingPreference: (...args: unknown[]) => mockSetTtcTrackingPreference(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () =>
    require('@/tests/helpers/mockLocalizationProvider').createMockLocalization(),
}));

describe('TtcSetupScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
    mockSetHasCompletedTtcSetupStep.mockReset();
    mockSetTtcTrackingPreference.mockReset();
  });

  it('toggles each TTC tracking chip against the current draft state', () => {
    render(<TtcSetupScreen />);

    expect(
      screen.getByText(
        'Floriva will keep these fields ready when you log: Sex, Cervical mucus.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('onboarding-ttc-setup-sex-toggle'));
    fireEvent.press(screen.getByTestId('onboarding-ttc-setup-ovulation-test-toggle'));
    fireEvent.press(screen.getByTestId('onboarding-ttc-setup-cervical-mucus-toggle'));
    fireEvent.press(screen.getByTestId('onboarding-ttc-setup-bbt-toggle'));

    expect(mockSetTtcTrackingPreference).toHaveBeenNthCalledWith(1, 'sex', false);
    expect(mockSetTtcTrackingPreference).toHaveBeenNthCalledWith(2, 'ovulationTest', true);
    expect(mockSetTtcTrackingPreference).toHaveBeenNthCalledWith(3, 'cervicalMucus', false);
    expect(mockSetTtcTrackingPreference).toHaveBeenNthCalledWith(
      4,
      'basalBodyTemperature',
      true,
    );
  });

  it('navigates backward and continues into the next TTC step', () => {
    render(<TtcSetupScreen nextHref="/settings/ttc-expectations" />);

    fireEvent.press(
      screen.getByText(
        require('@/tests/helpers/mockLocalizationProvider')
          .createMockLocalization()
          .t('onboarding.ttcSetup.backLabel'),
      ),
    );
    fireEvent.press(screen.getByTestId('onboarding-ttc-setup-continue-button'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockSetHasCompletedTtcSetupStep).toHaveBeenCalledWith(true);
    expect(mockPush).toHaveBeenCalledWith('/settings/ttc-expectations');
  });
});
