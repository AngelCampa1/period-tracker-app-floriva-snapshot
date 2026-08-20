import { act, screen, waitFor } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import { createMockLocalization as mockCreateMockLocalization } from '../helpers/mockLocalizationProvider';

const mockGetProfile = jest.fn();
const mockListByDateRange = jest.fn();
const mockListAllDailyLogs = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockListImportSessions = jest.fn();
const mockListBackupEvents = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
let latestLoggingCardProps:
  | {
      logDate: string;
      surface?: 'today' | 'selected-day';
    }
  | undefined;

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-20',
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: () => mockGetProfile(),
      },
      dailyLogs: {
        listByDateRange: (...args: unknown[]) => mockListByDateRange(...args),
        listAll: (...args: unknown[]) => mockListAllDailyLogs(...args),
      },
      reminderPreferences: {
        getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
      },
      importSessions: {
        listSessions: (...args: unknown[]) => mockListImportSessions(...args),
      },
      backupEvents: {
        listEvents: (...args: unknown[]) => mockListBackupEvents(...args),
      },
    },
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    clearPendingEntryRoute: jest.fn().mockResolvedValue(undefined),
    state: { pendingEntryRoute: undefined },
  }),
}));

jest.mock('@/src/features/logging/screens/TodayLoggingScreen', () => ({
  TodayLoggingCard: (props: { logDate: string; surface?: 'today' | 'selected-day' }) => {
    latestLoggingCardProps = props;

    return <MockText>Mock logging card</MockText>;
  },
}));

jest.mock('@/src/features/timeline/screens/PrivateTimelineScreen', () => ({
  PrivateTimelineScreen: () => (
    <MockText testID="calendar-timeline-screen">Mock private timeline route</MockText>
  ),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  return {
    useLocalization: () => mockCreateMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import CalendarRoute from '../../app/(app)/(tabs)/calendar';
// eslint-disable-next-line import/first
import CalendarDayRoute from '../../app/(app)/calendar/day/[date]';
// eslint-disable-next-line import/first
import CalendarTimelineRoute from '../../app/(app)/calendar/timeline';
// eslint-disable-next-line import/first
import { renderFlorivaRoute } from '../helpers/renderFlorivaRoute';
// eslint-disable-next-line import/first
import { testIds } from '../../src/testing/testIds';

describe('calendar route integration', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockListByDateRange.mockReset();
    mockListAllDailyLogs.mockReset();
    mockGetReminderPreferences.mockReset();
    mockListImportSessions.mockReset();
    mockListBackupEvents.mockReset();
    mockRefreshReminderSchedules.mockReset();
    latestLoggingCardProps = undefined;
  });

  it('renders the real dynamic day route through Expo Router and preserves the selected date', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListByDateRange.mockResolvedValue([]);

    const view = renderFlorivaRoute(
      {
        calendar: CalendarRoute,
        'calendar/day/[date]': CalendarDayRoute,
      },
      '/calendar/day/2026-04-20',
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe('/calendar/day/2026-04-20');
      expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();
      expect(latestLoggingCardProps).toEqual(
        expect.objectContaining({
          logDate: '2026-04-20',
          surface: 'selected-day',
        }),
      );
    });
  });

  it('renders the private timeline route through Expo Router', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAllDailyLogs.mockResolvedValue([]);
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListImportSessions.mockResolvedValue([]);
    mockListBackupEvents.mockResolvedValue([]);

    const view = renderFlorivaRoute(
      {
        calendar: CalendarRoute,
        'calendar/timeline': CalendarTimelineRoute,
      },
      '/calendar/timeline',
    );

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe('/calendar/timeline');
      expect(screen.getByTestId(testIds.calendar.timelineScreen)).toBeTruthy();
    });
    expect(screen.getByText('Mock private timeline route')).toBeTruthy();
  });
});
