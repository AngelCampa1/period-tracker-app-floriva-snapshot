import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetEntryByDate = jest.fn();
const mockSaveEntry = jest.fn();
const mockDeleteEntry = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockGetAppPreferences = jest.fn();
const mockSaveAppPreferences = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockPush = jest.fn();
let mockFocusEffectCallback: (() => void) | undefined;
const mockAppShellState = {
  pendingEntryRoute: undefined as string | undefined,
  billingAccessState: 'trial_active' as
    | 'trial_active'
    | 'subscribed'
    | 'needs_purchase'
    | 'sync_error',
};
const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  dailyLogs: {
    getEntryByDate: (...args: unknown[]) => mockGetEntryByDate(...args),
    // LT-23: TodayScreen now reads via listAll() (total period starts on
    // record), not a bounded listByDateRange window -- see
    // TodayScreen.tsx's hydrateSnapshot effect.
    listAll: (...args: unknown[]) => mockListAll(...args),
    saveEntry: (...args: unknown[]) => mockSaveEntry(...args),
    deleteEntry: (...args: unknown[]) => mockDeleteEntry(...args),
  },
  reminderPreferences: {
    getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
  },
  appPreferences: {
    getPreferences: () => mockGetAppPreferences(),
    savePreferences: (...args: unknown[]) => mockSaveAppPreferences(...args),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocusEffectCallback = callback;
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    state: mockAppShellState,
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import {
  TodayScreen,
  TodayScreenContent,
} from '@/src/features/tracker/screens/TodayScreen';
// eslint-disable-next-line import/first
import { defaultAppPreferences } from '@/src/db/domainDefaults';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { resolveTheme } from '@/src/theme/tokens';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '../../helpers/expectAccessiblePressables';

describe('TodayScreen', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockListAll.mockReset();
    mockGetEntryByDate.mockReset();
    mockSaveEntry.mockReset();
    mockDeleteEntry.mockReset();
    mockGetReminderPreferences.mockReset();
    mockGetAppPreferences.mockReset();
    mockSaveAppPreferences.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockPush.mockReset();
    mockFocusEffectCallback = undefined;
    mockAppShellState.pendingEntryRoute = undefined;
    mockAppShellState.billingAccessState = 'trial_active';
    mockGetReminderPreferences.mockResolvedValue([]);
    mockGetAppPreferences.mockResolvedValue(defaultAppPreferences);
    mockSaveAppPreferences.mockResolvedValue(undefined);
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
  });

  it('renders the wrapper shell while repository hydration is still in flight', () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    mockListAll.mockReturnValue(new Promise(() => {}));
    mockGetEntryByDate.mockReturnValue(new Promise(() => {}));
    mockGetReminderPreferences.mockReturnValue(new Promise(() => {}));

    render(<TodayScreen />);

    expect(screen.getByTestId('today-snapshot-card')).toBeTruthy();
    expect(screen.getByText('Log today')).toBeTruthy();
    expect(screen.getByText('Loading your local cycle snapshot…')).toBeTruthy();
    expect(
      screen.queryByText(
        'Log today first, then check the local snapshot Floriva is building on this device.',
      ),
    ).toBeNull();
    expect(screen.queryByText('Cycle day 12')).toBeNull();
  });

  it('keeps today focused on logging and the compact cycle snapshot while local reminder preferences hydrate in the background', () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    mockListAll.mockReturnValue(new Promise(() => {}));
    mockGetEntryByDate.mockReturnValue(new Promise(() => {}));
    mockGetReminderPreferences.mockReturnValue(new Promise(() => {}));

    render(<TodayScreenContent todayIso="2026-04-20" />);

    expect(screen.getByTestId('today-snapshot-card')).toBeTruthy();
    expect(screen.getByText('Loading your local cycle snapshot…')).toBeTruthy();
    expect(screen.queryByText('Updated from the history stored on this device.')).toBeNull();
    expect(screen.queryByText('Next to review')).toBeNull();
    expect(screen.queryByText('Loading reminder timing…')).toBeNull();
  });

  it('hydrates the snapshot from persisted profile and bleeding history', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-medium',
        logDate: '2026-02-28',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);

    const view = render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Cycle day 24')).toBeTruthy();
      expect(screen.getByText('Fertile window ended 9 days ago')).toBeTruthy();
      expect(screen.getByText('Medium confidence')).toBeTruthy();
      expect(screen.getByTestId(testIds.today.confidenceSummary)).toBeTruthy();
      expect(screen.getByText('Based on 2 local cycle starts')).toBeTruthy();
      expect(
        screen.getByText('Log today to confirm your rhythm sooner'),
      ).toBeTruthy();
      expect(screen.queryByText('Next period')).toBeNull();
      expect(screen.getByText('Log today')).toBeTruthy();
    });

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('renders confidence improvements as a tappable list that replaces the plain reason-label rows', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await screen.findByTestId(testIds.confidenceImprovementList.list);

    fireEvent.press(
      screen.getByTestId(testIds.confidenceImprovementList.row('limited-bleeding-history')),
    );

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
  });

  it('opens the confidence info modal when the confidence chip is pressed, instead of the old local tooltip', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-medium',
        logDate: '2026-02-28',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await screen.findByText('Medium confidence');
    expect(screen.queryByTestId('today-confidence-help')).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.today.confidenceChipButton));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/modal',
        params: expect.objectContaining({
          title: 'Why confidence is medium',
        }),
      }),
    );
  });

  it('exposes the confidence chip as an accessible button that announces it opens an explanation', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    const chip = await screen.findByTestId(testIds.today.confidenceChipButton);

    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityLabel).toContain('confidence');
    expect(chip.props.accessibilityHint).toBeTruthy();
  });

  it('UL-20: warms the filled confidence chip to espresso ink instead of near-black', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    const chip = await screen.findByTestId(testIds.today.confidenceChipButton);
    const chipStyle = StyleSheet.flatten(
      typeof chip.props.style === 'function'
        ? chip.props.style({ pressed: false })
        : chip.props.style,
    );

    // The pure-black (ink) fill fought the warm editorial palette (UL-20).
    // The warm espresso fill now comes from the ConfidenceChip primitive's
    // filled variant itself (the Wave B screen-level override was promoted
    // into the component); this pins Today's chip to that treatment.
    const theme = resolveTheme('light');
    expect(chipStyle.backgroundColor).toBe(theme.colors.textSecondary);
  });

  it('keeps the hero cycle-day numeral line box tall enough to avoid clipping', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    const heroNumeral = await screen.findByText('24');
    const heroNumeralStyle = StyleSheet.flatten(heroNumeral.props.style);

    expect(heroNumeralStyle.lineHeight).toBeGreaterThan(heroNumeralStyle.fontSize);
  });

  it('hides fertile-window copy when fertility estimates are disabled', async () => {
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
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);
    mockGetAppPreferences.mockResolvedValue({
      ...defaultAppPreferences,
      showFertilityEstimates: false,
    });

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Cycle day 24')).toBeTruthy();
      expect(screen.queryByText('Fertile window ended 3 days ago')).toBeNull();
      expect(screen.queryByText('Fertile')).toBeNull();
      expect(screen.queryByTestId('today-fertile-window-help')).toBeNull();
    });
  });

  it('keeps today compact while routing deeper detail to Calendar only', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-medium',
        logDate: '2026-02-28',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Cycle day 24')).toBeTruthy();
      expect(screen.queryByText('Open insights')).toBeNull();
      expect(screen.queryByText('Review reminder settings')).toBeNull();
      expect(screen.queryByText('Next to review')).toBeNull();
      expect(screen.queryByText('Keep in mind')).toBeNull();
      expect(screen.queryByText('Floriva shows patterns, not medical answers.')).toBeNull();
    });
  });

  it('keeps the preview-build onboarding handoff intact while billing is still in sync-error fallback', async () => {
    mockAppShellState.pendingEntryRoute = '/today';
    mockAppShellState.billingAccessState = 'sync_error';
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockClearPendingEntryRoute).not.toHaveBeenCalled();
  });

  it('falls back to default local prediction behavior when no profile is stored yet', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Cycle day 1')).toBeTruthy();
      expect(screen.getByText('Medium confidence')).toBeTruthy();
    });
  });

  it('falls back to the default snapshot when the repository hydration fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('profile lookup failed'));
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Cycle snapshot could not load right now.')).toBeTruthy();
      expect(screen.getByText('Cycle day 12')).toBeTruthy();
      expect(screen.getByText('Building confidence from local history')).toBeTruthy();
      expect(screen.queryByText('All reminders are off right now')).toBeNull();
    });
  });

  it('keeps the cycle snapshot as the only glass hero card on today', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.snapshotCard)).toBeTruthy();
      expect(screen.queryByTestId('today-snapshot-card-fallback')).toBeNull();
      expect(screen.queryByTestId('today-reminder-preview-card-fallback')).toBeNull();
    });
  });

  it('dismisses the no-reminders nudge from the Today surface', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await screen.findByText('No reminders set');

    fireEvent.press(screen.getByLabelText('Dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('No reminders set')).toBeNull();
    });
  });

  it('clears the pending entry route when today opens from the app shell handoff', async () => {
    mockAppShellState.pendingEntryRoute = '/today';
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalled();
    });
  });

  it('routes to the day editor when the Log today CTA is pressed', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockGetEntryByDate.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await screen.findByText('Cycle day 24');

    fireEvent.press(screen.getByText('Log today'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
    });
  });

  it('refreshes the local snapshot and summary when today regains focus after day logging', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'daily-log-2026-04-20',
          logDate: '2026-04-20',
          bleeding: 'light',
          symptoms: ['sleep-changes'],
        },
      ]);
    // getEntryByDate now has two independent callers on this screen
    // (TodaySummaryCard and QuickLogPeriodButton), so this test tracks the
    // "logged" transition with a shared mutable flag instead of a call-order
    // sequence — both callers should observe the same before/after state.
    let hasLoggedToday = false;
    mockGetEntryByDate.mockImplementation(() =>
      Promise.resolve(
        hasLoggedToday
          ? {
              id: 'daily-log-2026-04-20',
              logDate: '2026-04-20',
              bleeding: 'light',
              symptoms: ['sleep-changes'],
            }
          : null,
      ),
    );

    render(<TodayScreenContent todayIso="2026-04-20" />);

    await screen.findByText('Cycle day 24');
    // LT-29: FLOW now shares the same en-dash empty-state glyph as
    // MOOD/ENERGY/SLEEP (previously FLOW alone used a middle dot) -- all 4
    // boxes render the identical glyph.
    expect(screen.getAllByText('–')).toHaveLength(4);

    hasLoggedToday = true;

    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockListAll).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Light')).toBeTruthy();
      expect(screen.getByText('Sleep changes')).toBeTruthy();
    });
  });

  it('avoids setting snapshot state after the screen unmounts during a successful hydrate', async () => {
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
    mockGetEntryByDate.mockReturnValue(new Promise(() => {}));

    const view = render(<TodayScreenContent todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      resolveProfile?.(null);
      resolveLogs?.([]);
      await Promise.all([profilePromise, logsPromise]);
    });

    const unexpectedConsoleErrors = consoleErrorSpy.mock.calls.filter(
      ([message]) => typeof message !== 'string' || !message.includes('not wrapped in act'),
    );

    expect(unexpectedConsoleErrors).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('avoids surfacing a snapshot error after the screen unmounts during a failed hydrate', async () => {
    let rejectProfile: ((reason?: unknown) => void) | undefined;
    const profilePromise = new Promise<never>((_resolve, reject) => {
      rejectProfile = reject;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetProfile.mockReturnValue(profilePromise);
    mockListAll.mockReturnValue(new Promise(() => {}));
    mockGetEntryByDate.mockReturnValue(new Promise(() => {}));

    const view = render(<TodayScreenContent todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      rejectProfile?.(new Error('profile lookup failed'));
      await profilePromise.catch(() => undefined);
    });

    const unexpectedConsoleErrors = consoleErrorSpy.mock.calls.filter(
      ([message]) => typeof message !== 'string' || !message.includes('not wrapped in act'),
    );

    expect(unexpectedConsoleErrors).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  describe('quick-log period fast path', () => {
    beforeEach(() => {
      mockGetProfile.mockResolvedValue({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      mockListAll.mockResolvedValue([
        {
          id: '2026-03-28-heavy',
          logDate: '2026-03-28',
          bleeding: 'heavy',
          symptoms: [],
        },
      ]);
      mockSaveEntry.mockResolvedValue(undefined);
    });

    it('renders the quick-log button between the snapshot card and the today summary card when within the window', async () => {
      // Predicted next period start is 2026-04-25 (28-day cycle from
      // 2026-03-28); today is within [start-2, start+3].
      mockGetEntryByDate.mockResolvedValue(null);

      render(<TodayScreenContent todayIso="2026-04-24" />);

      await screen.findByTestId(testIds.today.quickLogPeriodButton);

      const tree = JSON.stringify(screen.toJSON());
      const snapshotIndex = tree.indexOf(testIds.today.snapshotCard);
      const quickLogIndex = tree.indexOf(testIds.today.quickLogPeriodButton);
      const summaryIndex = tree.indexOf(testIds.today.loggingCard);

      expect(snapshotIndex).toBeGreaterThan(-1);
      expect(quickLogIndex).toBeGreaterThan(snapshotIndex);
      expect(summaryIndex).toBeGreaterThan(quickLogIndex);
    });

    it('does not render the quick-log button when today is outside the window', async () => {
      mockGetEntryByDate.mockResolvedValue(null);

      render(<TodayScreenContent todayIso="2026-04-10" />);

      await screen.findByTestId(testIds.today.loggingCard);

      expect(screen.queryByTestId(testIds.today.quickLogPeriodButton)).toBeNull();
    });

    it('saves a medium-flow entry and refreshes the snapshot and summary after a quick-log tap', async () => {
      let hasLoggedToday = false;
      mockGetEntryByDate.mockImplementation(() =>
        Promise.resolve(
          hasLoggedToday
            ? {
                id: 'daily-log-2026-04-24',
                logDate: '2026-04-24',
                bleeding: 'medium',
                symptoms: [],
              }
            : null,
        ),
      );

      render(<TodayScreenContent todayIso="2026-04-24" />);

      await screen.findByTestId(testIds.today.quickLogPeriodButton);

      hasLoggedToday = true;

      await act(async () => {
        fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSaveEntry).toHaveBeenCalledWith(
          expect.objectContaining({ logDate: '2026-04-24', bleeding: 'medium' }),
        );
        expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
        expect(screen.getByText('Medium')).toBeTruthy();
      });
    });
  });

  // --- B5: anomaly nudge wiring ---
  //
  // Reuses the same fixture as buildTodaySnapshot.test.ts's "anomaly
  // threading" suite: a regular 28-day user, 41 days into an open cycle,
  // where both missed-expected-period and long-cycle fire (only the head,
  // missed-expected-period, should ever render as a nudge).
  describe('anomaly nudge', () => {
    const ANOMALY_PROFILE = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-02',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };
    const ANOMALY_ENTRIES = [
      { id: '2026-01-05', logDate: '2026-01-05', bleeding: 'medium', symptoms: [] },
      { id: '2026-02-02', logDate: '2026-02-02', bleeding: 'medium', symptoms: [] },
      { id: '2026-03-02', logDate: '2026-03-02', bleeding: 'medium', symptoms: [] },
    ];

    beforeEach(() => {
      mockGetProfile.mockResolvedValue(ANOMALY_PROFILE);
      mockListAll.mockResolvedValue(ANOMALY_ENTRIES);
      mockGetEntryByDate.mockResolvedValue(null);
    });

    it('renders exactly one anomaly nudge (the head of the filtered list) when multiple anomalies co-occur', async () => {
      render(<TodayScreenContent todayIso="2026-04-12" />);

      await screen.findByTestId(testIds.anomalyNudge.wrapper);

      expect(
        screen.getByText('Your period hasn’t started yet'),
      ).toBeTruthy();
      expect(screen.queryByText('A longer cycle than usual')).toBeNull();
      expect(screen.queryAllByTestId(testIds.anomalyNudge.wrapper)).toHaveLength(1);
    });

    it('dismisses the anomaly nudge, persists the dismissal, and hides it immediately', async () => {
      render(<TodayScreenContent todayIso="2026-04-12" />);

      await screen.findByTestId(testIds.anomalyNudge.wrapper);

      fireEvent.press(screen.getByTestId(testIds.anomalyNudge.dismissButton));

      await waitFor(() => {
        expect(screen.queryByTestId(testIds.anomalyNudge.wrapper)).toBeNull();
      });

      expect(mockSaveAppPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedAnomalyIds: ['missed-expected-period:2026-03-30'],
        }),
      );
    });

    it('does not resurrect a dismissed anomaly on next focus', async () => {
      render(<TodayScreenContent todayIso="2026-04-12" />);

      await screen.findByTestId(testIds.anomalyNudge.wrapper);

      fireEvent.press(screen.getByTestId(testIds.anomalyNudge.dismissButton));

      await waitFor(() => {
        expect(screen.queryByTestId(testIds.anomalyNudge.wrapper)).toBeNull();
      });

      mockGetAppPreferences.mockResolvedValue({
        ...defaultAppPreferences,
        dismissedAnomalyIds: ['missed-expected-period:2026-03-30'],
      });

      await act(async () => {
        mockFocusEffectCallback?.();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText('A longer cycle than usual')).toBeTruthy();
        expect(screen.queryByText('Your period hasn’t started yet')).toBeNull();
      });
    });

    it('renders no anomaly nudge when the engine detected nothing', async () => {
      mockGetProfile.mockResolvedValue({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      mockListAll.mockResolvedValue([
        { id: '2026-02-28', logDate: '2026-02-28', bleeding: 'medium', symptoms: [] },
        { id: '2026-03-28', logDate: '2026-03-28', bleeding: 'heavy', symptoms: [] },
      ]);

      render(<TodayScreenContent todayIso="2026-04-20" />);

      await screen.findByText('Cycle day 24');

      expect(screen.queryByTestId(testIds.anomalyNudge.wrapper)).toBeNull();
    });
  });

  describe('LT-24: stale prediction hedging', () => {
    it('replaces the fertile-window headline/caption with a neutral acknowledgment and hides the phase ribbon once history is stale', async () => {
      mockGetProfile.mockResolvedValue({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-01-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      // 3 period starts (the minimum for the engine's terminal high-
      // confidence branch, per confidence.ts) with the last real bleeding
      // on 2026-01-01; "today" (2026-04-20) is well over 2 rolled 28-day
      // cycles later -- the same `stale-history` trigger LT-04 introduced.
      mockListAll.mockResolvedValue([
        { id: '2025-11-06', logDate: '2025-11-06', bleeding: 'heavy', symptoms: [] },
        { id: '2025-12-04', logDate: '2025-12-04', bleeding: 'heavy', symptoms: [] },
        { id: '2026-01-01', logDate: '2026-01-01', bleeding: 'heavy', symptoms: [] },
      ]);
      mockGetEntryByDate.mockResolvedValue(null);

      render(<TodayScreenContent todayIso="2026-04-20" />);

      await waitFor(() => {
        // FIXED: previously asserted "Fertile window active today"-shaped
        // copy built on the rolled synthetic anchor. Now shows the neutral
        // stale headline/caption instead.
        expect(screen.getByText('Your local estimate needs a refresh')).toBeTruthy();
        expect(
          screen.getByText('Log your latest period to see today’s cycle phase again.'),
        ).toBeTruthy();
        expect(screen.queryByText(/Fertile window/)).toBeNull();
      });

      // FIXED: the "This cycle" phase-ribbon section (cycle-day marker +
      // phase segments, all built on the same rolled anchor) is suppressed
      // entirely while stale, matching LT-09's calendar-shading precedent.
      expect(screen.queryByText('This cycle')).toBeNull();
      expect(screen.queryByTestId(testIds.today.confidenceChipButton)).toBeTruthy();

      // LT-30 (residual of LT-24): the hero numeral block sits ABOVE the
      // hedged headline and was asserting "13 / Cycle day 13 of 29" --
      // computed from the exact same rolled synthetic anchor the headline
      // swap above already refuses to assert. It must not render the raw
      // cycle-day number/label while stale. UL-08: the giant en-dash
      // placeholder read as a redaction bar/broken asset, so the stale hero
      // now renders no numeral glyph at all.
      expect(screen.queryByTestId(testIds.today.heroNumeral)).toBeNull();
      expect(screen.queryByText(/Cycle day/)).toBeNull();
      expect(screen.queryByText('of 29')).toBeNull();
    });

    it('replaces the hero numeral/cycle-day claim with a neutral placeholder once history is stale (LT-30)', async () => {
      mockGetProfile.mockResolvedValue({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-01-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      mockListAll.mockResolvedValue([
        { id: '2025-11-06', logDate: '2025-11-06', bleeding: 'heavy', symptoms: [] },
        { id: '2025-12-04', logDate: '2025-12-04', bleeding: 'heavy', symptoms: [] },
        { id: '2026-01-01', logDate: '2026-01-01', bleeding: 'heavy', symptoms: [] },
      ]);
      mockGetEntryByDate.mockResolvedValue(null);

      render(<TodayScreenContent todayIso="2026-04-20" />);

      await waitFor(() => {
        expect(screen.getByText('Your local estimate needs a refresh')).toBeTruthy();
      });

      // UL-08 (supersedes the LT-30 en-dash): the 88px en-dash placeholder
      // rendered as a solid oxblood rectangle -- a redaction bar/broken
      // asset -- in the comeback moment. The stale hero now drops the
      // numeral glyph entirely and lets the neutral "Awaiting an update"
      // label carry the hero slot in the serif display voice.
      expect(screen.queryByTestId(testIds.today.heroNumeral)).toBeNull();
      const heroLabel = screen.getByTestId(testIds.today.heroLabel);
      expect(heroLabel.props.children).toBe('Awaiting an update');
      const heroLabelStyle = StyleSheet.flatten(heroLabel.props.style);
      expect(heroLabelStyle.fontFamily).toBe(
        resolveTheme('light').typography.title.fontFamily,
      );
      expect(screen.queryByText(/Cycle day/)).toBeNull();
      expect(screen.queryByText(/^of \d+$/)).toBeNull();
    });

    it('keeps the ordinary fertile-window headline and phase ribbon for a non-stale (regularly logging) user', async () => {
      mockGetProfile.mockResolvedValue({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      mockListAll.mockResolvedValue([
        { id: '2026-02-28', logDate: '2026-02-28', bleeding: 'medium', symptoms: [] },
        { id: '2026-03-28', logDate: '2026-03-28', bleeding: 'heavy', symptoms: [] },
      ]);
      mockGetEntryByDate.mockResolvedValue(null);

      render(<TodayScreenContent todayIso="2026-04-20" />);

      await waitFor(() => {
        expect(screen.getByText('Fertile window ended 9 days ago')).toBeTruthy();
        expect(screen.queryByText('Your local estimate needs a refresh')).toBeNull();
      });
      expect(screen.getByText('This cycle')).toBeTruthy();

      // Regression proof for LT-30: the hero numeral/cycle-day claim is
      // untouched for a non-stale prediction -- only the stale branch
      // swaps to the neutral placeholder.
      expect(screen.getByText('24')).toBeTruthy();
      expect(screen.getByText('Cycle day 24')).toBeTruthy();
      expect(screen.getByText('of 28')).toBeTruthy();
    });
  });
});
