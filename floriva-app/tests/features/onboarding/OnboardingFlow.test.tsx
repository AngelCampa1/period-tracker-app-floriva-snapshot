import type { ComponentProps, ReactElement } from 'react';
import { Keyboard, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { WelcomeScreen } from '@/src/features/onboarding/screens/WelcomeScreen';
import { StartPathScreen } from '@/src/features/onboarding/screens/StartPathScreen';
import { LastPeriodStartScreen } from '@/src/features/onboarding/screens/LastPeriodStartScreen';
import { CycleLengthScreen } from '@/src/features/onboarding/screens/CycleLengthScreen';
import { PeriodLengthScreen } from '@/src/features/onboarding/screens/PeriodLengthScreen';
import { CycleVariabilityScreen } from '@/src/features/onboarding/screens/CycleVariabilityScreen';
import { SymptomLoggingScreen } from '@/src/features/onboarding/screens/SymptomLoggingScreen';
import { TtcDecisionScreen } from '@/src/features/onboarding/screens/TtcDecisionScreen';
import { TtcPresetScreen } from '@/src/features/onboarding/screens/TtcPresetScreen';
import { OnboardingCompletionScreen } from '@/src/features/onboarding/screens/OnboardingCompletionScreen';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import { testIds } from '@/src/testing/testIds';
import { resetMockLocale, setMockLocale } from '@/tests/helpers/localization';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockTriggerPressFeedback = jest.fn();
const mockImportedProfile = jest.fn();
const mockImportedLogs = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-10',
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
  }),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: (...args: unknown[]) => mockImportedProfile(...args),
      },
      dailyLogs: {
        listByDateRange: (...args: unknown[]) => mockImportedLogs(...args),
      },
    },
  }),
}));

type ProviderProps = ComponentProps<typeof OnboardingProvider>;
const platformOsDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function renderWithProvider(ui: ReactElement, providerProps?: Partial<ProviderProps>) {
  return render(<OnboardingProvider {...providerProps}>{ui}</OnboardingProvider>);
}

function setPlatformOs(nextOs: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOs,
  });
}

describe('onboarding flow screens', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCompleteOnboarding.mockReset();
    mockTriggerPressFeedback.mockReset();
    mockImportedProfile.mockReset();
    mockImportedLogs.mockReset();
    (DateTimePickerAndroid.open as jest.Mock).mockReset();
    jest.restoreAllMocks();
    resetMockLocale();
  });

  afterEach(() => {
    if (platformOsDescriptor) {
      Object.defineProperty(Platform, 'OS', platformOsDescriptor);
    }
  });

  it('moves from the welcome screen into the start-path decision', () => {
    renderWithProvider(<WelcomeScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.welcome.startButton));

    expect(mockPush).toHaveBeenCalledWith('./start-path');
  });

  it('requires a start path before continuing', () => {
    renderWithProvider(<StartPathScreen />);

    expect(screen.getByTestId(testIds.onboarding.startPath.continueButton)).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.freshOption));

    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./last-period-start');
  });

  it('routes import and restore paths to their dedicated screens', () => {
    renderWithProvider(<StartPathScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.importOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.continueButton));
    expect(mockPush).toHaveBeenCalledWith('./import');

    mockPush.mockReset();

    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.restoreOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.continueButton));
    expect(mockPush).toHaveBeenCalledWith('./restore');
  });

  it('offers a single back affordance on the start-path step', () => {
    renderWithProvider(<StartPathScreen />);

    // UL-53: one back affordance — the top back pill — not a duplicate
    // footer Back button as well.
    expect(screen.getAllByText('Back')).toHaveLength(1);

    fireEvent.press(screen.getByTestId(testIds.onboarding.startPath.backButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('validates the last period start date before continuing', () => {
    renderWithProvider(<LastPeriodStartScreen />, {
      initialDraft: {
        lastPeriodStartDate: '2026-15-01',
      },
    });

    expect(screen.getByTestId(testIds.onboarding.lastPeriodStart.datePicker)).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(screen.getByText('Pick a date from the calendar or the quick options below.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.quickPickYesterday));
    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('renders the redesign calendar grid and quick picks without native picker clutter', () => {
    renderWithProvider(<LastPeriodStartScreen />);

    // UL-52: this step now uses the same fixed footer chrome as every other
    // onboarding step instead of a one-off inline placement.
    expect(screen.getByTestId(`${testIds.onboarding.lastPeriodStart.screen}-footer`)).toBeTruthy();
    expect(screen.getByText('April 2026')).toBeTruthy();
    expect(screen.getByTestId('last-period-calendar-day-2026-04-10')).toBeTruthy();
    expect(screen.queryByText('Native date picker')).toBeNull();
    expect(screen.queryByText('Type the exact date instead')).toBeNull();
    expect(screen.queryByText('Hide typed date entry')).toBeNull();
    expect(screen.queryByText('Type the exact date')).toBeNull();
    expect(screen.getByTestId(testIds.onboarding.lastPeriodStart.quickPickToday)).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.lastPeriodStart.quickPickYesterday)).toBeTruthy();
  });

  it('keeps the seventh calendar day in the Saturday column on Android', () => {
    setPlatformOs('android');

    renderWithProvider(<LastPeriodStartScreen />);

    const firstWeek = screen.getByTestId('last-period-calendar-week-0');

    expect(firstWeek.props.children).toHaveLength(7);
    expect(firstWeek.props.children[6].props.testID).toBe(
      'last-period-calendar-day-2026-04-04',
    );
    expect(firstWeek.props.children[6].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flex: 1 })]),
    );
  });

  it('lets users navigate to a previous month and choose an older period start', () => {
    renderWithProvider(<LastPeriodStartScreen />);

    expect(
      screen.getByTestId('last-period-calendar-next-month').props.accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('last-period-calendar-prev-month'));

    expect(screen.getByText('March 2026')).toBeTruthy();
    expect(
      screen.getByTestId('last-period-calendar-next-month').props.accessibilityState.disabled,
    ).toBe(false);
    fireEvent.press(screen.getByTestId('last-period-calendar-next-month'));

    expect(screen.getByText('April 2026')).toBeTruthy();
    fireEvent.press(screen.getByTestId('last-period-calendar-prev-month'));

    fireEvent.press(screen.getByTestId('last-period-calendar-day-2026-03-27'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('keeps the calendar actions in the shared fixed onboarding footer', () => {
    setPlatformOs('ios');

    renderWithProvider(<LastPeriodStartScreen />);

    expect(
      screen.getByTestId(`${testIds.onboarding.lastPeriodStart.screen}-footer`),
    ).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton)).toBeTruthy();
    expect(
      screen.getByTestId(testIds.onboarding.lastPeriodStart.quickPickFourteenDaysAgo),
    ).toBeTruthy();
  });

  it('continues with the selected calendar date when the draft starts empty', () => {
    setPlatformOs('ios');

    renderWithProvider(<LastPeriodStartScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('normalizes a persisted MM/DD/YYYY last period start date before continuing', () => {
    renderWithProvider(<LastPeriodStartScreen />, {
      initialDraft: {
        lastPeriodStartDate: '04/03/2026',
      },
    });

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('uses the same in-app calendar on Android and saves the selection', () => {
    setPlatformOs('android');

    renderWithProvider(<LastPeriodStartScreen />);

    fireEvent.press(screen.getByTestId('last-period-calendar-day-2026-04-08'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('updates the in-app calendar selection before continuing', () => {
    setPlatformOs('ios');

    renderWithProvider(<LastPeriodStartScreen />);

    fireEvent.press(screen.getByTestId('last-period-calendar-day-2026-04-04'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('formats the selected date and helper copy with the active locale', () => {
    setPlatformOs('android');
    setMockLocale('es');

    renderWithProvider(<LastPeriodStartScreen />, {
      initialDraft: {
        lastPeriodStartDate: '2026-04-03',
      },
    });

    expect(screen.getByText('3 de abril de 2026')).toBeTruthy();
    expect(screen.getByText('Floriva will start from 3 abr.')).toBeTruthy();
  });

  it('rejects future last-period dates before continuing', () => {
    renderWithProvider(<LastPeriodStartScreen />, {
      initialDraft: {
        lastPeriodStartDate: '2026-04-12',
      },
    });

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(screen.getByText('The start date cannot be in the future.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the current calendar date usable without dismissed native picker updates', () => {
    setPlatformOs('android');
    const { unmount } = renderWithProvider(<LastPeriodStartScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));
    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
    expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();

    mockPush.mockReset();
    unmount();
    setPlatformOs('ios');

    renderWithProvider(<LastPeriodStartScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.lastPeriodStart.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./cycle-length');
  });

  it('offers a single back affordance on the last-period step', () => {
    renderWithProvider(<LastPeriodStartScreen />);

    const backButtons = screen.getAllByText('Back');
    expect(backButtons).toHaveLength(1);

    fireEvent.press(backButtons[0]);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('validates cycle length before continuing', () => {
    renderWithProvider(<CycleLengthScreen />);

    expect(screen.getByTestId('screen-progress-track').props.accessibilityValue).toEqual({
      max: 9,
      min: 0,
      now: 3,
    });
    // UL-62: the oversized hero numeral panel is gone — the value lives in
    // exactly one editable place (the input), with the average kept as a
    // quiet caption beside it.
    expect(screen.queryByTestId('cycle-length-numeral')).toBeNull();
    expect(screen.getByText('Average: 21-35')).toBeTruthy();

    // Variability is captured inline on this screen — pick one so Continue is enabled.
    fireEvent.press(screen.getByText('Pretty regular'));

    fireEvent.changeText(screen.getByTestId(testIds.onboarding.cycleLength.input), '0');
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleLength.continueButton));

    expect(screen.getByText('Enter a cycle length between 1 and 120 days.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('30 days'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleLength.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./period-length');
  });

  it('rejects non-numeric cycle length input and supports a single back affordance', () => {
    renderWithProvider(<CycleLengthScreen />);

    // Variability is captured inline on this screen — pick one so Continue is enabled.
    fireEvent.press(screen.getByText('Pretty regular'));

    fireEvent.changeText(screen.getByTestId(testIds.onboarding.cycleLength.input), 'about four weeks');
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleLength.continueButton));

    expect(screen.getByText('Enter your usual cycle length.')).toBeTruthy();

    const backButtons = screen.getAllByText('Back');
    expect(backButtons).toHaveLength(1);
    fireEvent.press(backButtons[0]);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('records irregular cycle variability from the inline cycle-length step', () => {
    renderWithProvider(<CycleLengthScreen />);

    fireEvent.press(screen.getByText('Sometimes irregular'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleLength.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./period-length');
  });

  it('dismisses the number pad when selecting inline cycle variability', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);

    renderWithProvider(<CycleLengthScreen />);

    fireEvent.changeText(screen.getByTestId(testIds.onboarding.cycleLength.input), '29');
    fireEvent.press(screen.getByText('Pretty regular'));

    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it('validates period length before continuing', () => {
    renderWithProvider(<PeriodLengthScreen />);

    fireEvent.changeText(screen.getByTestId(testIds.onboarding.periodLength.input), '40');
    fireEvent.press(screen.getByTestId(testIds.onboarding.periodLength.continueButton));

    expect(screen.getByText('Enter a period length between 1 and 30 days.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('5 days'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.periodLength.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./symptom-logging');
  });

  it('rejects non-numeric period length input and supports a single back affordance', () => {
    renderWithProvider(<PeriodLengthScreen />);

    fireEvent.changeText(screen.getByTestId(testIds.onboarding.periodLength.input), 'five');
    fireEvent.press(screen.getByTestId(testIds.onboarding.periodLength.continueButton));

    expect(screen.getByText('Enter a period length between 1 and 30 days.')).toBeTruthy();

    const backButtons = screen.getAllByText('Back');
    expect(backButtons).toHaveLength(1);
    fireEvent.press(backButtons[0]);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('uses the cycle variability decision before continuing', () => {
    renderWithProvider(<CycleVariabilityScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleVariability.variableOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleVariability.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./symptom-logging');
  });

  it('supports the steady-cycle path and a single back affordance', () => {
    renderWithProvider(<CycleVariabilityScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleVariability.steadyOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.cycleVariability.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./symptom-logging');

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('uses the symptom logging decision before continuing', () => {
    renderWithProvider(<SymptomLoggingScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.symptomLogging.noOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.symptomLogging.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./ttc');
  });

  it('supports the symptom-logging opt-in path and a single back affordance', () => {
    renderWithProvider(<SymptomLoggingScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.symptomLogging.yesOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.symptomLogging.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./ttc');

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('skips the TTC preset step when TTC is turned off', () => {
    renderWithProvider(<TtcDecisionScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttc.noOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.ttc.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./notifications');
  });

  it('continues TTC users into the preset step', () => {
    renderWithProvider(<TtcDecisionScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttc.yesOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.ttc.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./ttc-preset');
  });

  it('supports the TTC back affordance', () => {
    renderWithProvider(<TtcDecisionScreen />);

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('moves from the TTC preset step into notifications', () => {
    renderWithProvider(<TtcPresetScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcPreset.fullOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcPreset.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./notifications');
  });

  it('supports the basic TTC preset and a single back affordance', () => {
    renderWithProvider(<TtcPresetScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcPreset.basicOption));
    fireEvent.press(screen.getByTestId(testIds.onboarding.ttcPreset.continueButton));

    expect(mockPush).toHaveBeenCalledWith('./notifications');

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('completes onboarding from the completion screen and enters the tracker', async () => {
    mockCompleteOnboarding.mockResolvedValue(undefined);

    renderWithProvider(<OnboardingCompletionScreen />, {
      initialDraft: {
        startPath: 'fresh',
        lastPeriodStartDate: '2026-04-02',
        cycleLengthInput: '30',
        hasConfirmedCycleLength: true,
        periodLengthInput: '5',
        hasConfirmedPeriodLength: true,
        supportsIrregularCycles: false,
        symptomLoggingEnabled: true,
        ttcEnabled: true,
        ttcTrackingPreset: 'full',
        hasCompletedAccessStep: true,
      },
    });

    fireEvent.press(screen.getByTestId(testIds.onboarding.completion.continueButton));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        {
          cycleLengthDays: 30,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-02',
          goals: ['period', 'symptoms', 'trying-to-conceive'],
          supportsIrregularCycles: false,
          conditionTags: [],
          ttcTrackingPreferences: {
            sex: true,
            ovulationTest: true,
            cervicalMucus: true,
            basalBodyTemperature: true,
          },
        },
        {
          deferredCycleSetup: false,
          deferredTrackingSetup: false,
          deferredBiometricsSetup: false,
          deferredReminderSetup: false,
          deferredImportSetup: false,
          dismissedTailoringChecklist: false,
        },
        '/today',
      );
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('builds imported completion data before entering the tracker', async () => {
    mockCompleteOnboarding.mockResolvedValue(undefined);
    const mockProfile = {
      cycleLengthDays: 31,
      periodLengthDays: 6,
      lastPeriodStartDate: '2026-03-29',
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    };
    const mockLogs = [
      {
        id: '2026-03-29-heavy',
        logDate: '2026-03-29',
        bleeding: 'heavy',
        symptoms: [],
      },
    ];
    mockImportedProfile.mockResolvedValue(mockProfile);
    mockImportedLogs.mockResolvedValue(mockLogs);

    renderWithProvider(<OnboardingCompletionScreen />, {
      initialDraft: {
        startPath: 'import',
        lastPeriodStartDate: '2026-04-02',
        cycleLengthInput: '30',
        hasConfirmedCycleLength: true,
        periodLengthInput: '5',
        hasConfirmedPeriodLength: true,
        supportsIrregularCycles: false,
        symptomLoggingEnabled: false,
        ttcEnabled: false,
        hasCompletedAccessStep: true,
      },
    });

    expect(screen.getByText('Starting point')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.onboarding.completion.continueButton));

    await waitFor(() => {
      expect(mockImportedProfile).toHaveBeenCalledTimes(1);
      expect(mockImportedLogs).toHaveBeenCalledWith('2000-01-01', '2099-12-31');
      expect(mockCompleteOnboarding).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('shows completion errors for restore users and supports a single back affordance', async () => {
    mockCompleteOnboarding.mockRejectedValue(new Error('Completion failed'));
    mockImportedProfile.mockResolvedValue({
      cycleLengthDays: 30,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-30',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockImportedLogs.mockResolvedValue([]);

    renderWithProvider(<OnboardingCompletionScreen />, {
      initialDraft: {
        startPath: 'restore',
        lastPeriodStartDate: '2026-04-02',
        cycleLengthInput: '30',
        hasConfirmedCycleLength: true,
        periodLengthInput: '5',
        hasConfirmedPeriodLength: true,
        supportsIrregularCycles: false,
        symptomLoggingEnabled: false,
        ttcEnabled: false,
        hasCompletedAccessStep: true,
      },
    });

    expect(screen.getByText('Starting point')).toBeTruthy();

    const backButtons = screen.getAllByText('Back');
    expect(backButtons).toHaveLength(1);
    fireEvent.press(backButtons[0]);

    expect(mockBack).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId(testIds.onboarding.completion.continueButton));

    await waitFor(() => {
      expect(screen.getByText('Completion failed')).toBeTruthy();
    });
  });

  it('omits the progress bar on the completion step', () => {
    // UL-52: a 100%-full progress bar renders as a thick trackless rule; the
    // journey is over, so the victory screen drops the progress chrome.
    renderWithProvider(<OnboardingCompletionScreen />, {
      initialDraft: {
        startPath: 'fresh',
        lastPeriodStartDate: '2026-04-02',
        cycleLengthInput: '30',
        hasConfirmedCycleLength: true,
        periodLengthInput: '5',
        hasConfirmedPeriodLength: true,
        supportsIrregularCycles: false,
        symptomLoggingEnabled: true,
        ttcEnabled: true,
        ttcTrackingPreset: 'basic',
        hasCompletedAccessStep: true,
      },
    });

    expect(screen.queryByTestId('screen-progress-track')).toBeNull();
  });
});
