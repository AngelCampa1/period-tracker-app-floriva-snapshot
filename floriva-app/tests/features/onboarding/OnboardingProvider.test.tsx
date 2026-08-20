import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { OnboardingProvider, useOnboarding } from '@/src/features/onboarding/OnboardingProvider';

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

function OnboardingConsumer() {
  const onboarding = useOnboarding();

  return (
    <>
      <Text>cycle:{onboarding.draft.cycleLengthInput}</Text>
      <Text>period:{onboarding.draft.periodLengthInput}</Text>
      <Text>last-period:{onboarding.draft.lastPeriodStartDate}</Text>
      <Text>goals:{onboarding.draft.goals.join(',')}</Text>
      <Text>irregular:{String(onboarding.draft.supportsIrregularCycles)}</Text>
      <Text>conditions:{onboarding.draft.conditionTags.join(',')}</Text>
      <Text>reminders:{onboarding.draft.reminderSetupChoice}</Text>
      <Text>imports:{onboarding.draft.importSetupChoice}</Text>
      <Text>biometrics:{onboarding.draft.biometricsSetupChoice}</Text>
      <Text>fresh-selected:{String(onboarding.draft.hasSelectedFreshPath)}</Text>
      <Text>ttc-sex:{String(onboarding.draft.ttcTrackingPreferences.sex)}</Text>
      <Text>
        ttc-ovulation:{String(onboarding.draft.ttcTrackingPreferences.ovulationTest)}
      </Text>
      <Text>
        ttc-cervical:{String(onboarding.draft.ttcTrackingPreferences.cervicalMucus)}
      </Text>
      <Text>
        ttc-bbt:{String(onboarding.draft.ttcTrackingPreferences.basalBodyTemperature)}
      </Text>
      <Text>ttc-setup-step:{String(onboarding.draft.hasCompletedTtcSetupStep)}</Text>
      <Text>
        ttc-expectations-step:{String(onboarding.draft.hasCompletedTtcExpectationsStep)}
      </Text>
      <Text>start-path:{String(onboarding.draft.startPath)}</Text>
      <Text onPress={() => onboarding.setCycleLengthInput('34')}>cycle-action</Text>
      <Text onPress={() => onboarding.setPeriodLengthInput('7')}>period-action</Text>
      <Text onPress={() => onboarding.setLastPeriodStartDate('2026-04-10')}>
        date-action
      </Text>
      <Text onPress={() => onboarding.setStartPath('import')}>start-path-import-action</Text>
      <Text onPress={() => onboarding.setStartPath('fresh')}>start-path-fresh-action</Text>
      <Text onPress={() => onboarding.toggleGoal('trying-to-conceive')}>goal-add</Text>
      <Text onPress={() => onboarding.toggleGoal('period')}>goal-remove</Text>
      <Text onPress={() => onboarding.setSupportsIrregularCycles(false)}>
        irregular-action
      </Text>
      <Text onPress={() => onboarding.toggleConditionTag('pmdd')}>condition-add</Text>
      <Text onPress={() => onboarding.toggleConditionTag('pmdd')}>condition-remove</Text>
      <Text onPress={() => onboarding.setSetupChoice('reminderSetupChoice', 'later')}>
        reminder-action
      </Text>
      <Text onPress={() => onboarding.setSetupChoice('importSetupChoice', 'later')}>
        import-action
      </Text>
      <Text onPress={() => onboarding.setSetupChoice('biometricsSetupChoice', 'later')}>
        biometrics-action
      </Text>
      <Text onPress={() => onboarding.setHasCompletedTtcSetupStep(true)}>
        ttc-setup-action
      </Text>
      <Text onPress={() => onboarding.setHasCompletedTtcExpectationsStep(true)}>
        ttc-expectations-action
      </Text>
      <Text onPress={() => onboarding.setTtcTrackingPreference('sex', false)}>
        ttc-sex-action
      </Text>
      <Text onPress={() => onboarding.setTtcTrackingPreference('ovulationTest', true)}>
        ttc-ovulation-action
      </Text>
      <Text onPress={() => onboarding.setHasSelectedFreshPath(true)}>fresh-path-action</Text>
    </>
  );
}

describe('OnboardingProvider', () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockGetItemAsync.mockResolvedValue(null);
  });

  it('hydrates draft state, applies updates, and toggles list selections', () => {
    render(
      <OnboardingProvider
        initialDraft={{
          goals: ['period'],
          conditionTags: ['pcos'],
        }}
      >
        <OnboardingConsumer />
      </OnboardingProvider>,
    );

    fireEvent.press(screen.getByText('cycle-action'));
    fireEvent.press(screen.getByText('period-action'));
    fireEvent.press(screen.getByText('date-action'));
    fireEvent.press(screen.getByText('goal-add'));
    fireEvent.press(screen.getByText('goal-remove'));
    fireEvent.press(screen.getByText('irregular-action'));
    fireEvent.press(screen.getByText('condition-add'));
    fireEvent.press(screen.getByText('condition-remove'));
    fireEvent.press(screen.getByText('reminder-action'));
    fireEvent.press(screen.getByText('import-action'));
    fireEvent.press(screen.getByText('biometrics-action'));
    fireEvent.press(screen.getByText('ttc-setup-action'));
    fireEvent.press(screen.getByText('ttc-expectations-action'));
    fireEvent.press(screen.getByText('ttc-sex-action'));
    fireEvent.press(screen.getByText('ttc-ovulation-action'));
    fireEvent.press(screen.getByText('start-path-import-action'));
    fireEvent.press(screen.getByText('start-path-fresh-action'));
    fireEvent.press(screen.getByText('fresh-path-action'));

    expect(screen.getByText('cycle:34')).toBeTruthy();
    expect(screen.getByText('period:7')).toBeTruthy();
    expect(screen.getByText('last-period:2026-04-10')).toBeTruthy();
    expect(screen.getByText('goals:trying-to-conceive')).toBeTruthy();
    expect(screen.getByText('irregular:false')).toBeTruthy();
    expect(screen.getByText('conditions:pcos')).toBeTruthy();
    expect(screen.getByText('reminders:later')).toBeTruthy();
    expect(screen.getByText('imports:later')).toBeTruthy();
    expect(screen.getByText('biometrics:later')).toBeTruthy();
    expect(screen.getByText('fresh-selected:true')).toBeTruthy();
    expect(screen.getByText('ttc-setup-step:true')).toBeTruthy();
    expect(screen.getByText('ttc-expectations-step:true')).toBeTruthy();
    expect(screen.getByText('ttc-sex:false')).toBeTruthy();
    expect(screen.getByText('ttc-ovulation:true')).toBeTruthy();
    expect(screen.getByText('start-path:fresh')).toBeTruthy();
  });

  it('throws when the onboarding hook is used without the provider', () => {
    expect(() => render(<OnboardingConsumer />)).toThrow(
      'useOnboarding must be used within OnboardingProvider',
    );
  });

  it('rehydrates and persists the onboarding draft when resumable onboarding is enabled', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        cycleLengthInput: '33',
        periodLengthInput: '6',
        lastPeriodStartDate: '2026-04-02',
        goals: ['symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
        reminderSetupChoice: 'later',
        importSetupChoice: 'skip',
        biometricsSetupChoice: 'later',
        hasSelectedFreshPath: true,
        hasCompletedTtcSetupStep: true,
        hasCompletedTtcExpectationsStep: false,
      }),
    );

    render(
      <OnboardingProvider persistDraft>
        <OnboardingConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('cycle:33')).toBeTruthy();
      expect(screen.getByText('goals:symptoms')).toBeTruthy();
      expect(screen.getByText('fresh-selected:true')).toBeTruthy();
      expect(screen.getByText('ttc-setup-step:true')).toBeTruthy();
      expect(screen.getByText('ttc-expectations-step:false')).toBeTruthy();
      expect(mockGetItemAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByText('cycle-action'));

    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalled();
    });
  });

  it('drops malformed persisted arrays and setup choices instead of hydrating unsafe shapes', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        cycleLengthInput: '31',
        goals: 'symptoms',
        conditionTags: { unexpected: true },
        reminderSetupChoice: 'tomorrow',
        importSetupChoice: 3,
        biometricsSetupChoice: null,
      }),
    );

    render(
      <OnboardingProvider persistDraft>
        <OnboardingConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('cycle:31')).toBeTruthy();
      expect(screen.getByText('goals:')).toBeTruthy();
      expect(screen.getByText('conditions:')).toBeTruthy();
      expect(screen.getByText('reminders:skip')).toBeTruthy();
      expect(screen.getByText('imports:skip')).toBeTruthy();
      expect(screen.getByText('biometrics:skip')).toBeTruthy();
    });
  });

  it('falls back missing TTC preference keys to safe defaults when hydrating persisted drafts', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        ttcTrackingPreferences: {
          sex: true,
        },
      }),
    );

    render(
      <OnboardingProvider persistDraft>
        <OnboardingConsumer />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ttc-sex:true')).toBeTruthy();
      expect(screen.getByText('ttc-ovulation:false')).toBeTruthy();
      expect(screen.getByText('ttc-cervical:false')).toBeTruthy();
      expect(screen.getByText('ttc-bbt:false')).toBeTruthy();
    });
  });

  it('avoids setting draft state after a persisted hydration resolves post-unmount', async () => {
    let resolveDraft: ((value: string | null) => void) | undefined;
    const pendingDraft = new Promise<string | null>((resolve) => {
      resolveDraft = resolve;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetItemAsync.mockReturnValue(pendingDraft);

    const view = render(
      <OnboardingProvider persistDraft>
        <OnboardingConsumer />
      </OnboardingProvider>,
    );

    view.unmount();

    resolveDraft?.(JSON.stringify({ cycleLengthInput: '37' }));
    await pendingDraft;

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
