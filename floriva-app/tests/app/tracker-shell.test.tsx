import { screen } from '@testing-library/react-native';

const mockDailyLogsRepository = {
  getEntryByDate: jest.fn().mockResolvedValue(null),
  saveEntry: jest.fn(),
  deleteEntry: jest.fn(),
  listByDateRange: jest.fn(),
};
const mockGetProfile = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  dailyLogs: mockDailyLogsRepository,
  reminderPreferences: {
    getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    state: {
      pendingEntryRoute: undefined,
    },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import TodayRoute from '../../app/(app)/(tabs)/today';
// eslint-disable-next-line import/first
import { testIds } from '../../src/testing/testIds';
// eslint-disable-next-line import/first
import { renderFlorivaRoute } from '../helpers/renderFlorivaRoute';

describe('tracker today route', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockDailyLogsRepository.getEntryByDate.mockReset();
    mockDailyLogsRepository.saveEntry.mockReset();
    mockDailyLogsRepository.deleteEntry.mockReset();
    mockDailyLogsRepository.listByDateRange.mockReset();
    mockGetReminderPreferences.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockClearPendingEntryRoute.mockReset();

    mockGetProfile.mockReturnValue(new Promise(() => {}));
    mockDailyLogsRepository.getEntryByDate.mockReturnValue(new Promise(() => {}));
    mockDailyLogsRepository.listByDateRange.mockReturnValue(new Promise(() => {}));
    mockGetReminderPreferences.mockReturnValue(new Promise(() => {}));
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
  });

  it('renders the integrated snapshot and inline logging experience', () => {
    renderFlorivaRoute({ today: TodayRoute }, '/today');

    expect(screen.getByTestId(testIds.today.screen)).toBeTruthy();
    expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
    expect(screen.getByTestId('today-snapshot-card')).toBeTruthy();
    expect(screen.getByText('Log today')).toBeTruthy();
  });
});
