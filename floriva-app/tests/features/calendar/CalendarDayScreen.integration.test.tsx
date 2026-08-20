import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';
import { testIds } from '@/src/testing/testIds';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRefreshReminderSchedules = jest.fn();

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    if (!mockCurrentHarness) {
      throw new Error('Calendar day test harness has not been initialized');
    }

    return {
      repositories: mockCurrentHarness.repositories,
    };
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    clearPendingEntryRoute: jest.fn().mockResolvedValue(undefined),
    state: { pendingEntryRoute: undefined },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { CalendarDayScreen } from '@/src/features/calendar/screens/CalendarDayScreen';

describe('CalendarDayScreen repo-backed integration', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('keeps a selected-day delete when reminder follow-up sync fails', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockRefreshReminderSchedules.mockRejectedValueOnce(new Error('reminder sync failed'));

    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-15',
      logDate: '2026-04-15',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing entry',
    });

    render(<CalendarDayScreen selectedDate="2026-04-15" />);

    expect(await screen.findByDisplayValue('Existing entry')).toBeTruthy();

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    await waitFor(async () => {
      await expect(
        mockCurrentHarness?.repositories.dailyLogs.getEntryByDate('2026-04-15'),
      ).resolves.toBeNull();
    });

    expect(await screen.findByText('Entry deleted from this device.')).toBeTruthy();
    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
  });

  describe('quick-log pre-selection (?quick=period from a notification quick action)', () => {
    it('pre-selects medium flow when the day has no existing entry, without auto-saving', async () => {
      mockCurrentHarness = await createWave5AcceptanceHarness();

      render(<CalendarDayScreen selectedDate="2026-04-15" quick="period" />);

      await waitFor(() => {
        expect(screen.getByTestId('selectable-chip-indicator-bleeding-medium')).toBeTruthy();
      });

      // Pre-selection only fills the draft in memory — it must not auto-save.
      await expect(
        mockCurrentHarness.repositories.dailyLogs.getEntryByDate('2026-04-15'),
      ).resolves.toBeNull();
      expect(screen.getByTestId(testIds.today.saveButton)).toBeTruthy();
    });

    it('does not override an already-logged bleeding value for the day', async () => {
      mockCurrentHarness = await createWave5AcceptanceHarness();
      await mockCurrentHarness.repositories.dailyLogs.saveEntry({
        id: 'daily-log-2026-04-15',
        logDate: '2026-04-15',
        bleeding: 'light',
        symptoms: [],
      });

      render(<CalendarDayScreen selectedDate="2026-04-15" quick="period" />);

      await waitFor(() => {
        expect(screen.getByTestId('selectable-chip-indicator-bleeding-light')).toBeTruthy();
      });

      expect(screen.queryByTestId('selectable-chip-indicator-bleeding-medium')).toBeNull();
    });

    it('does not pre-select anything when quick is absent', async () => {
      mockCurrentHarness = await createWave5AcceptanceHarness();

      render(<CalendarDayScreen selectedDate="2026-04-15" />);

      await waitFor(() => {
        expect(screen.getByTestId(testIds.today.loggingCard)).toBeTruthy();
      });

      expect(screen.queryByTestId('selectable-chip-indicator-bleeding-medium')).toBeNull();
    });

    it('does not pre-select when quick has an unrecognized value', async () => {
      mockCurrentHarness = await createWave5AcceptanceHarness();

      render(<CalendarDayScreen selectedDate="2026-04-15" quick="something-else" />);

      await waitFor(() => {
        expect(screen.getByTestId(testIds.today.loggingCard)).toBeTruthy();
      });

      expect(screen.queryByTestId('selectable-chip-indicator-bleeding-medium')).toBeNull();
    });
  });
});
