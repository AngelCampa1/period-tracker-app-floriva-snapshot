import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();
const mockPush = jest.fn();
const mockSetLocalePreference = jest.fn();
const mockTranslate = (key: string, params?: Record<string, string | number>) =>
  require('@/src/localization/translations').translate('en', key, params);
const mockLocalization = {
  isHydrated: true,
  localePreference: 'en',
  resolvedLocale: 'en',
  setLocalePreference: (...args: unknown[]) => mockSetLocalePreference(...args),
  t: mockTranslate,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  dailyLogs: {
    listAll: (...args: unknown[]) => mockListAll(...args),
  },
  appPreferences: {
    getPreferences: () => mockGetAppPreferences(),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => mockLocalization,
}));

// eslint-disable-next-line import/first
import {
  InsightsScreen,
  InsightsScreenContent,
} from '@/src/features/insights/screens/InsightsScreen';
// eslint-disable-next-line import/first
import { defaultAppPreferences } from '@/src/db/domainDefaults';
// eslint-disable-next-line import/first
import { buildInsightsConditionRowTestId, testIds } from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { t } from '@/tests/helpers/localization';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '@/tests/helpers/expectAccessiblePressables';

describe('InsightsScreen', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockListAll.mockReset();
    mockGetAppPreferences.mockReset();
    mockPush.mockReset();
    mockSetLocalePreference.mockReset();
    mockGetAppPreferences.mockResolvedValue(defaultAppPreferences);
  });

  it('renders the explore index with cycle-pattern and TTC rows', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos', 'pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-medium',
        logDate: '2026-02-28',
        bleeding: 'medium',
        symptoms: ['cramps'],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: ['cramps', 'fatigue'],
      },
    ]);

    const view = render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-screen')).toBeTruthy();
      expect(screen.getByText(t('insights.screen.eyebrow'))).toBeTruthy();
      expect(screen.queryByText(t('insights.screen.description'))).toBeNull();
      expect(screen.getByTestId(testIds.insights.cyclePatternRow)).toBeTruthy();
      expect(screen.getByTestId(testIds.insights.ttcSummaryRow)).toBeTruthy();
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
      expect(screen.queryByTestId(testIds.insights.ttcSummaryCard)).toBeNull();
    });

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('hides the TTC explore row when TTC mode is not enabled', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.queryByText(t('insights.screen.description'))).toBeNull();
      expect(screen.getByTestId(testIds.insights.cyclePatternRow)).toBeTruthy();
      expect(screen.queryByTestId(testIds.insights.ttcSummaryRow)).toBeNull();
      expect(screen.getByTestId(testIds.insights.byConditionRow)).toBeTruthy();
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
    });

    expect(
      screen.getByTestId(testIds.insights.cyclePatternRow).props.accessibilityLabel,
    ).toBe('Open Cycle pattern');
    expect(
      screen.getByTestId(testIds.insights.byConditionRow).props.accessibilityLabel,
    ).toBe('Open Condition modes');
  });

  it('hides the fertility phase row when fertility estimates are disabled', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetAppPreferences.mockResolvedValue({
      ...defaultAppPreferences,
      showFertilityEstimates: false,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('Phase rhythm')).toBeTruthy();
      expect(screen.queryByText('Fertile / ovulation')).toBeNull();
      expect(screen.queryByTestId('insights-fertility-help')).toBeNull();
      expect(screen.queryByTestId(testIds.insights.ttcSummaryRow)).toBeNull();
    });
  });

  it('routes the TTC explore row into the TTC detail screen', async () => {
    mockGetProfile.mockResolvedValue({
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
    });
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(await screen.findByTestId(testIds.insights.ttcSummaryRow));

    expect(mockPush).toHaveBeenCalledWith('/insights/ttc');
  });

  it('routes condition setup row to tracking settings when no condition mode is active', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(await screen.findByTestId(testIds.insights.byConditionRow));

    expect(mockPush).toHaveBeenCalledWith('/settings/tracking-setup');
  });

  it('links each explore row into its dedicated detail route', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(await screen.findByTestId(testIds.insights.cyclePatternRow));
    fireEvent.press(screen.getByTestId(testIds.insights.monthlyBriefingRow));
    fireEvent.press(screen.getByTestId(testIds.insights.ttcSummaryRow));
    fireEvent.press(screen.getByTestId(buildInsightsConditionRowTestId('pcos')));

    expect(mockPush).toHaveBeenCalledWith('/insights/cycle-pattern');
    expect(mockPush).toHaveBeenCalledWith('/insights/monthly-briefing');
    expect(mockPush).toHaveBeenCalledWith('/insights/ttc');
    expect(mockPush).toHaveBeenCalledWith('/insights/condition/pcos');
  });

  it('shows this month briefing on the insights hub', async () => {
    mockGetProfile.mockResolvedValue({
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
    });
    mockListAll.mockResolvedValue([
      {
        id: 'apr-1',
        logDate: '2026-04-01',
        bleeding: 'heavy',
        symptoms: ['cramps', 'fatigue'],
        mood: 'low',
      },
      {
        id: 'apr-12',
        logDate: '2026-04-12',
        bleeding: 'none',
        symptoms: ['discharge'],
      },
    ]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(await screen.findByTestId(testIds.insights.monthlyBriefingCard)).toBeTruthy();
    expect(screen.getByText('April briefing')).toBeTruthy();
    // LT-22: lead now cites symptomDays (2 -- both logs this month have
    // symptoms), the same number the symptomDaysLabel chip shows, not a
    // distinct symptom-TYPE count under "tracked signals" (which would have
    // been 3: cramps, fatigue, discharge).
    expect(screen.getByText('April shows 1 period day and 2 symptom days so far.')).toBeTruthy();
  });

  it('renders through the default InsightsScreen wrapper', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
    });
  });

  it('shows a recoverable error state when insights hydration fails', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('profile failed'));
    mockListAll.mockRejectedValueOnce(new Error('logs failed'));
    mockGetProfile.mockResolvedValueOnce({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValueOnce([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.hydrationErrorCard)).toBeTruthy();
      expect(screen.getByText(t('insights.error.load'))).toBeTruthy();
      expect(screen.getByText(t('insights.error.title'))).toBeTruthy();
      expect(screen.getByText(t('insights.error.body'))).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.insights.retryButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
      expect(screen.getByTestId(testIds.insights.cyclePatternRow)).toBeTruthy();
      expect(screen.queryByTestId(testIds.insights.ttcSummaryRow)).toBeNull();
    });
  });

  it('avoids setting insights state after unmount during a successful hydrate', async () => {
    let resolveProfile: ((value: null) => void) | undefined;
    let resolveLogs: ((value: []) => void) | undefined;
    const profilePromise = new Promise<null>((resolve) => {
      resolveProfile = resolve;
    });
    const logsPromise = new Promise<[]>((resolve) => {
      resolveLogs = resolve;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetProfile.mockReturnValue(profilePromise);
    mockListAll.mockReturnValue(logsPromise);

    const view = render(<InsightsScreenContent todayIso="2026-04-18" />);

    view.unmount();

    await act(async () => {
      resolveProfile?.(null);
      resolveLogs?.([]);
      await Promise.all([profilePromise, logsPromise]);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('avoids setting insights error state after unmount during a failed hydrate', async () => {
    let rejectProfile: ((reason?: unknown) => void) | undefined;
    const profilePromise = new Promise<never>((_resolve, reject) => {
      rejectProfile = reject;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetProfile.mockReturnValue(profilePromise);
    mockListAll.mockReturnValue(new Promise(() => {}));

    const view = render(<InsightsScreenContent todayIso="2026-04-18" />);

    view.unmount();

    await act(async () => {
      rejectProfile?.(new Error('profile failed'));
      await profilePromise.catch(() => undefined);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  // UL-03: the privacy readout is real and must stay on the screen, but as a
  // quiet footnote — never dressed up as a "Pattern noticed" insight.
  it('renders the privacy readout as a quiet footnote, never as a pattern insight', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
    });

    const footnote = screen.getByTestId(testIds.insights.privacyFootnote);
    expect(footnote).toHaveTextContent('Built from cycle history stored on this device.');
    expect(screen.queryByText('Pattern noticed')).toBeNull();
  });

  it('renders the Explore editorial eyebrow inside the pattern card', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
    });

    expect(screen.getByText('Explore')).toBeTruthy();
  });

  it('keeps the explore card and bar chart as the primary surface on the insights hub', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
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
    mockListAll.mockResolvedValue([]);

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.patternCard)).toBeTruthy();
      expect(screen.queryByTestId(testIds.insights.ttcSummaryCard)).toBeNull();
    });
  });
});
