import { render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

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
  useDatabase: () => {
    if (!mockCurrentHarness) {
      throw new Error('Calendar history integration harness has not been initialized');
    }

    return {
      repositories: mockCurrentHarness.repositories,
    };
  },
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');
  const mockLocalization = createMockLocalization();

  return {
    useLocalization: () => mockLocalization,
  };
});

// eslint-disable-next-line import/first
import { CalendarAboutEstimatesScreen } from '@/src/features/calendar/screens/CalendarAboutEstimatesScreen';
// eslint-disable-next-line import/first
import { CalendarHistoryScreen } from '@/src/features/calendar/screens/CalendarHistoryScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('Calendar history and estimate repo-backed integration', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
  });

  afterEach(() => {
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('renders recent bleeding history from persisted local log entries', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-15',
      logDate: '2026-04-15',
      bleeding: 'light',
      symptoms: ['cramps'],
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-12',
      logDate: '2026-04-12',
      bleeding: 'spotting',
      symptoms: [],
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-10',
      logDate: '2026-04-10',
      bleeding: 'medium',
      symptoms: ['fatigue'],
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-08',
      logDate: '2026-04-08',
      bleeding: 'none',
      symptoms: [],
    });

    render(<CalendarHistoryScreen todayIso="2026-04-20" />);

    expect(await screen.findByTestId(testIds.calendar.historyScreen)).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText('Loading calendar…')).toBeNull();
    });

    expect(screen.getByText('Apr 15')).toBeTruthy();
    expect(screen.getByText('Apr 12')).toBeTruthy();
    expect(screen.getByText('Apr 10')).toBeTruthy();
    // UL-15: rows are labeled by intensity (reusing the timeline's localized
    // bleeding strings) instead of six identical "Period day" subtitles.
    expect(screen.getByText('Light bleeding')).toBeTruthy();
    expect(screen.getByText('Medium bleeding')).toBeTruthy();
    expect(screen.getByText('Spotting')).toBeTruthy();
    expect(screen.queryByText('Period day')).toBeNull();
    expect(screen.queryByText('No bleeding history yet.')).toBeNull();
  });

  it('renders estimate limitations from persisted local prediction inputs', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<CalendarAboutEstimatesScreen todayIso="2026-04-20" />);

    expect(await screen.findByTestId(testIds.calendar.estimateScreen)).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText('Loading calendar…')).toBeNull();
    });

    expect(
      screen.getByText('Predictions stay on this device and adapt as more entries are logged.'),
    ).toBeTruthy();
    expect(screen.getByText('Floriva shows estimates, not medical certainty.')).toBeTruthy();
  });
});
