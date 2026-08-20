import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import { TtcExpectationsScreen } from '@/src/features/onboarding/screens/TtcExpectationsScreen';
import { createMockLocalization, resetMockLocalizations } from '@/tests/helpers/mockLocalizationProvider';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockLocale: Parameters<typeof createMockLocalization>[0] = 'en';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/localization/localizationContext', () => ({
  useLocalization: () => {
    const { createMockLocalization: mockCreateMockLocalization } = require('@/tests/helpers/mockLocalizationProvider');

    return mockCreateMockLocalization(mockLocale);
  },
}));

describe('TtcExpectationsScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
    mockLocale = 'en';
    resetMockLocalizations();
  });

  it('summarizes a disabled TTC setup and uses the default forward route when no save handler is provided', () => {
    render(
      <OnboardingProvider
        initialDraft={{
          ttcTrackingPreferences: {
            sex: false,
            ovulationTest: false,
            cervicalMucus: false,
            basalBodyTemperature: false,
          },
        }}
      >
        <TtcExpectationsScreen />
      </OnboardingProvider>,
    );

    expect(
      screen.getByText(createMockLocalization('en').t('onboarding.ttcExpectations.summary.disabled')),
    ).toBeTruthy();

    fireEvent.press(screen.getByText(createMockLocalization('en').t('common.actions.continue')));

    expect(mockPush).toHaveBeenCalledWith('./setup-later');
  });

  it('uses locale-specific TTC separators and honors a custom continue label', () => {
    mockLocale = 'ja';

    render(
      <OnboardingProvider
        initialDraft={{
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: false,
            cervicalMucus: true,
            basalBodyTemperature: false,
          },
        }}
      >
        <TtcExpectationsScreen continueLabel="保存して続ける" />
      </OnboardingProvider>,
    );

    expect(
      screen.getByText(
        createMockLocalization('ja').t('onboarding.ttcExpectations.summary.enabledPrefix') +
          `${createMockLocalization('ja').t('onboarding.ttcSetup.chips.sex')}、${createMockLocalization('ja').t('onboarding.ttcSetup.chips.cervicalMucus')}` +
          createMockLocalization('ja').t('onboarding.ttcExpectations.summary.enabledSuffix'),
      ),
    ).toBeTruthy();
    expect(screen.getByText('保存して続ける')).toBeTruthy();

    fireEvent.press(screen.getByText(createMockLocalization('ja').t('onboarding.ttcExpectations.backLabel')));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows saving copy while an async continue handler is in flight', async () => {
    let resolveSave: (() => void) | undefined;
    const onContinue = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(
      <OnboardingProvider>
        <TtcExpectationsScreen onContinue={onContinue} />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByText(createMockLocalization('en').t('common.actions.continue')));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(createMockLocalization('en').t('onboarding.ttcExpectations.saving')),
    ).toBeTruthy();

    resolveSave?.();

    await waitFor(() => {
      expect(
        screen.getByText(createMockLocalization('en').t('common.actions.continue')),
      ).toBeTruthy();
    });
  });
});
