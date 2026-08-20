import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
let mockPendingEntryRoute: string | undefined;
const mockGetProfile = jest.fn();
const mockListByDateRange = jest.fn();
const mockRepositories = {
  userProfile: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
  },
  dailyLogs: {
    listByDateRange: (...args: unknown[]) => mockListByDateRange(...args),
  },
};
let latestDayLoggingProps:
  | {
      onEntryChanged?: () => void;
      surface?: 'today' | 'selected-day';
    }
  | undefined;
let consoleErrorSpy: jest.SpyInstance;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-20',
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    state: { pendingEntryRoute: mockPendingEntryRoute },
  }),
}));

jest.mock('@/src/features/logging/screens/TodayLoggingScreen', () => ({
  TodayLoggingCard: (props: {
    onEntryChanged?: () => void;
    surface?: 'today' | 'selected-day';
  }) => {
    latestDayLoggingProps = props;
    const { Text } = require('react-native');

    return <Text>Mock logging card</Text>;
  },
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { CalendarAboutEstimatesScreen } from '@/src/features/calendar/screens/CalendarAboutEstimatesScreen';
// eslint-disable-next-line import/first
import { CalendarDayScreen } from '@/src/features/calendar/screens/CalendarDayScreen';
// eslint-disable-next-line import/first
import { CalendarHistoryScreen } from '@/src/features/calendar/screens/CalendarHistoryScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('Calendar detail screens', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
    mockPendingEntryRoute = undefined;
    mockGetProfile.mockReset();
    mockListByDateRange.mockReset();
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);
    latestDayLoggingProps = undefined;
    mockCanGoBack.mockReturnValue(false);
  });

  afterEach(() => {
    const actWarnings = consoleErrorSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' && message.includes('not wrapped in act'),
    );

    expect(actWarnings).toHaveLength(0);
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders day detail with a calendar-specific back affordance', async () => {
    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();
    expect(screen.getByTestId(testIds.calendar.dayBackButton)).toBeTruthy();
    expect(screen.getByText('Back to calendar')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('clears a pending notification handoff route on arrival at its calendar day', async () => {
    mockPendingEntryRoute = '/calendar/day/2026-04-10';

    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('leaves a pending route for a different calendar day untouched', async () => {
    mockPendingEntryRoute = '/calendar/day/2026-04-11';

    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClearPendingEntryRoute).not.toHaveBeenCalled();
  });

  it('leaves non-calendar pending entry routes untouched', async () => {
    mockPendingEntryRoute = '/import';

    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClearPendingEntryRoute).not.toHaveBeenCalled();
  });

  it('falls back to today and redirects when the selected day route parameter is invalid', async () => {
    render(<CalendarDayScreen selectedDate="not-a-date" />);

    expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/calendar');
    });
  });

  it('pops the day detail screen when navigation history exists', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    fireEvent.press(screen.getByTestId(testIds.calendar.dayBackButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalledWith('/calendar');
    });
  });

  it('returns day detail to the calendar root when no previous route exists', async () => {
    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    fireEvent.press(screen.getByTestId(testIds.calendar.dayBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/calendar');
    });
  });

  it('preserves logging side effects from the calendar day detail route', async () => {
    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    expect(latestDayLoggingProps?.surface).toBe('selected-day');
    latestDayLoggingProps?.onEntryChanged?.();

    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('keeps the day detail visible when prediction hydration fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('profile unavailable'));
    mockListByDateRange.mockRejectedValue(new Error('logs unavailable'));

    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Friday, April 10')).toBeTruthy();
      expect(screen.queryByText('Period')).toBeNull();
    });
  });

  it('labels day detail phases from the resolved local prediction', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListByDateRange.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarDayScreen selectedDate="2026-04-13" />);

    await waitFor(() => {
      expect(screen.getByText('Fertile')).toBeTruthy();
    });
  });

  it('LT-24: suppresses the Fertile chip once the day-level prediction is stale', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2025-11-01',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    // 3 period starts (minimum for the engine's terminal high-confidence
    // branch) with the last real bleeding on 2025-11-01; the viewed day
    // (2026-04-13, chosen to land in the SAME in-cycle position that the
    // "labels day detail phases" test above proves resolves to "Fertile")
    // is well over 2 rolled 28-day cycles later -- the same `stale-history`
    // trigger LT-04 introduced, evaluated with the engine pinned to this
    // day per this screen's existing per-day re-run convention.
    mockListByDateRange.mockResolvedValue([
      {
        id: '2025-09-04-heavy',
        logDate: '2025-09-04',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2025-10-02-heavy',
        logDate: '2025-10-02',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2025-11-01-heavy',
        logDate: '2025-11-01',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarDayScreen selectedDate="2026-04-13" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();
    });

    // FIXED: previously showed "Fertile" here (built on the rolled
    // synthetic anchor) -- same trust concern as Today's fertile-window
    // headline (LT-24). Now suppressed while stale.
    expect(screen.queryByText('Fertile')).toBeNull();
  });

  it('labels luteal day details after the fertile window has passed', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListByDateRange.mockResolvedValue([
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarDayScreen selectedDate="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Luteal')).toBeTruthy();
    });
  });

  it('LT-20: includes the year in the day-detail header for a date not in the current calendar year', async () => {
    // "today" is mocked to 2026-04-20 for this whole file (see the
    // getLocalTodayLogDate mock above); a selected date from 2025 must not
    // render as the bare "Friday, April 10" the 2026-04-10 case above
    // renders -- that string is ambiguous once the user has more than one
    // April 10 in their history.
    render(<CalendarDayScreen selectedDate="2025-04-10" />);

    expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();
    // 2025-04-10 was a Thursday (2026-04-10, the same-year case below, is a
    // Friday) -- the point under test is the trailing ", 2025", not the
    // weekday.
    expect(screen.getByText('Thursday, April 10, 2025')).toBeTruthy();
    expect(screen.queryByText('Thursday, April 10')).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('LT-20: omits the year in the day-detail header for a date in the current calendar year', async () => {
    render(<CalendarDayScreen selectedDate="2026-04-10" />);

    // Unchanged golden: same-year dates keep the compact "Weekday, Month Day"
    // form (no regression from the LT-20 fix).
    expect(screen.getByText('Friday, April 10')).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('returns history detail to the calendar root when no prior route exists', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    await screen.findByText('No bleeding history yet.');
    fireEvent.press(screen.getByTestId(testIds.calendar.historyBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/calendar');
    });
  });

  it('pops history detail when a previous route exists', async () => {
    mockCanGoBack.mockReturnValue(true);
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    await screen.findByText('No bleeding history yet.');
    fireEvent.press(screen.getByTestId(testIds.calendar.historyBackButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('renders the empty history state after hydration settles', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('No bleeding history yet.')).toBeTruthy();
    expect(screen.queryByText('Loading calendar…')).toBeNull();
  });

  it('renders hydrated bleeding history rows', async () => {
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
    mockListByDateRange.mockResolvedValue([
      {
        id: 'log-1',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Apr 18')).toBeTruthy();
  });

  it('LT-20: history rows include the year for a bleeding day logged in a prior calendar year', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2025-04-18',
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
    mockListByDateRange.mockResolvedValue([
      {
        id: 'log-prior-year',
        logDate: '2025-04-18',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    // FIXED: previously rendered the ambiguous bare "Apr 18" -- identical to
    // a CURRENT-year Apr 18 entry (see the test above). Once the entry's
    // year differs from "today"'s year, the row must disambiguate.
    expect(await screen.findByText('Apr 18, 2025')).toBeTruthy();
    expect(screen.queryByText('Apr 18')).toBeNull();
  });

  it('surfaces the localized history load error when hydration fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('db unavailable'));

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Calendar could not load right now.')).toBeTruthy();
  });

  it('ignores successful history hydration after the screen unmounts', async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    let resolveLogs: ((value: unknown[]) => void) | undefined;

    mockGetProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    mockListByDateRange.mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    const view = render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      resolveProfile?.(null);
      resolveLogs?.([]);
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('pops estimate detail when a previous route exists', async () => {
    mockCanGoBack.mockReturnValue(true);
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading calendar…')).toBeNull();
    });
    fireEvent.press(screen.getByTestId(testIds.calendar.estimateBackButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('returns estimate detail to the calendar root when no prior route exists', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading calendar…')).toBeNull();
    });
    fireEvent.press(screen.getByTestId(testIds.calendar.estimateBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/calendar');
    });
  });

  it('renders estimate detail after hydration settles', async () => {
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
    mockListByDateRange.mockResolvedValue([
      {
        id: 'log-1',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    expect(await screen.findByText(/How Floriva /)).toBeTruthy();
  });

  it('surfaces the localized estimate load error when hydration fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('db unavailable'));

    render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Calendar could not load right now.')).toBeTruthy();
  });

  it('ignores successful estimate hydration after the screen unmounts', async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    let resolveLogs: ((value: unknown[]) => void) | undefined;

    mockGetProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    mockListByDateRange.mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    const view = render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      resolveProfile?.(null);
      resolveLogs?.([]);
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
