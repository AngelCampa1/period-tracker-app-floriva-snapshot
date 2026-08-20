import { Text } from 'react-native';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { testRouter } from 'expo-router/testing-library';

const MOCK_TODAY_ISO = '2026-04-16';
const mockRefreshReminderSchedules = jest.fn();
const mockClearPendingEntryRoute = jest.fn();

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => MOCK_TODAY_ISO,
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    return {
      repositories: require('../helpers/createWave5RouteHarness').getWave5RouteHarness().repositories,
    };
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    state: {
      pendingEntryRoute: undefined,
      billingAccessState: 'active',
    },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');
  const mockLocalization = createMockLocalization();

  return {
    useLocalization: () => mockLocalization,
  };
});

// eslint-disable-next-line import/first
import CalendarDayRoute from '@/app/(app)/calendar/day/[date]';
// eslint-disable-next-line import/first
import AppTabLayout from '@/app/(app)/(tabs)/_layout';
// eslint-disable-next-line import/first
import CalendarRoute from '@/app/(app)/(tabs)/calendar';
// eslint-disable-next-line import/first
import TodayRoute from '@/app/(app)/(tabs)/today';
// eslint-disable-next-line import/first
import AppImportCompleteRoute from '@/app/(app)/import/complete';
// eslint-disable-next-line import/first
import AppImportIndexRoute from '@/app/(app)/import';
// eslint-disable-next-line import/first
import AppImportLayout from '@/app/(app)/import/_layout';
// eslint-disable-next-line import/first
import AppImportReviewRoute from '@/app/(app)/import/review';
// eslint-disable-next-line import/first
import AppImportSourceRoute from '@/app/(app)/import/source/[source]';
// eslint-disable-next-line import/first
import OnboardingImportCompleteRoute from '@/app/(onboarding)/import/complete';
// eslint-disable-next-line import/first
import OnboardingImportIndexRoute from '@/app/(onboarding)/import';
// eslint-disable-next-line import/first
import OnboardingImportLayout from '@/app/(onboarding)/import/_layout';
// eslint-disable-next-line import/first
import OnboardingImportReviewRoute from '@/app/(onboarding)/import/review';
// eslint-disable-next-line import/first
import OnboardingImportSourceRoute from '@/app/(onboarding)/import/source/[source]';
// eslint-disable-next-line import/first
import {
  buildCalendarDayCellTestId,
  testIds,
} from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import {
  closeWave5RouteHarness,
  getWave5RouteHarness,
  initializeWave5RouteHarness,
  renderWave5Route,
} from '../helpers/createWave5RouteHarness';

describe('import routes', () => {
  beforeEach(() => {
    mockRefreshReminderSchedules.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    closeWave5RouteHarness();
  });

  it('commits manual history through the routed app flow and shows it in tracker and calendar', async () => {
    await initializeWave5RouteHarness();

    const view = renderWave5Route(
      {
        '(app)/import/_layout': AppImportLayout,
        '(app)/import/index': AppImportIndexRoute,
        '(app)/import/source/[source]': AppImportSourceRoute,
        '(app)/import/review': AppImportReviewRoute,
        '(app)/import/complete': AppImportCompleteRoute,
        '(app)/(tabs)/_layout': AppTabLayout,
        '(app)/(tabs)/today': TodayRoute,
        '(app)/(tabs)/calendar': CalendarRoute,
        '(app)/(tabs)/insights': () => <Text>Insights</Text>,
        '(app)/(tabs)/settings': () => <Text>Settings</Text>,
        '(app)/calendar/day/[date]': CalendarDayRoute,
      },
      '/(app)/import',
    );

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/source/manual');
      expect(screen.getByTestId(testIds.import.sourceScreen)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), MOCK_TODAY_ISO);
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/review');
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(async () => {
      expect(view.getPathnameWithParams()).toContain('/import/complete');
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
      await expect(
        getWave5RouteHarness().repositories.dailyLogs.getEntryByDate(MOCK_TODAY_ISO),
      ).resolves.toMatchObject({
        logDate: MOCK_TODAY_ISO,
        bleeding: 'medium',
      });
    });

    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId(testIds.import.resultTodayButton));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe('/today');
      expect(screen.getByTestId(testIds.today.screen)).toBeTruthy();
    });

    testRouter.navigate('/calendar');

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe('/calendar');
      expect(screen.getByTestId(testIds.calendar.screen)).toBeTruthy();
      expect(screen.getByTestId(buildCalendarDayCellTestId(MOCK_TODAY_ISO))).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId(MOCK_TODAY_ISO)));
    fireEvent.press(screen.getByText('View day'));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe(`/calendar/day/${MOCK_TODAY_ISO}`);
      expect(screen.getByTestId(testIds.calendar.dayScreen)).toBeTruthy();
      expect(screen.getByTestId('selectable-chip-indicator-bleeding-medium')).toBeTruthy();
    });
  });

  it('routes skipped-only local history into review without a commit action', async () => {
    await initializeWave5RouteHarness();

    const view = renderWave5Route(
      {
        '(app)/import/_layout': AppImportLayout,
        '(app)/import/index': AppImportIndexRoute,
        '(app)/import/source/[source]': AppImportSourceRoute,
        '(app)/import/review': AppImportReviewRoute,
        '(app)/import/complete': AppImportCompleteRoute,
      },
      '/(app)/import',
    );

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/source/manual');
    });

    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), '2024-01-01');
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/review');
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
      expect(screen.getByText('Row 1 uses data Floriva does not import yet.')).toBeTruthy();
      expect(screen.queryByTestId(testIds.import.commitButton)).toBeNull();
    });
  });

  it('commits manual history through the routed onboarding flow and continues into notifications', async () => {
    await initializeWave5RouteHarness();

    const view = renderWave5Route(
      {
        '(onboarding)/import/_layout': OnboardingImportLayout,
        '(onboarding)/import/index': OnboardingImportIndexRoute,
        '(onboarding)/import/source/[source]': OnboardingImportSourceRoute,
        '(onboarding)/import/review': OnboardingImportReviewRoute,
        '(onboarding)/import/complete': OnboardingImportCompleteRoute,
        notifications: () => <Text>Mock notifications</Text>,
      },
      '/(onboarding)/import',
    );

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/source/manual');
      expect(screen.getByTestId(testIds.import.sourceScreen)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), MOCK_TODAY_ISO);
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toContain('/import/review');
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(async () => {
      expect(view.getPathnameWithParams()).toContain('/import/complete');
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
      await expect(
        getWave5RouteHarness().repositories.dailyLogs.getEntryByDate(MOCK_TODAY_ISO),
      ).resolves.toMatchObject({
        logDate: MOCK_TODAY_ISO,
        bleeding: 'medium',
      });
    });

    fireEvent.press(screen.getByTestId(testIds.import.resultTodayButton));

    await waitFor(() => {
      expect(view.getPathnameWithParams()).toBe('/notifications');
      expect(screen.getByText('Mock notifications')).toBeTruthy();
    });
  });
});
