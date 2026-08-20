import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockGetEntryByDate = jest.fn();
const mockGetProfile = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockPush = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      dailyLogs: {
        getEntryByDate: (...args: unknown[]) => mockGetEntryByDate(...args),
      },
      userProfile: {
        getProfile: (...args: unknown[]) => mockGetProfile(...args),
      },
      reminderPreferences: {
        getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
      },
    },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { TodaySummaryCard } from '@/src/features/logging/screens/TodaySummaryCard';

describe('TodaySummaryCard', () => {
  beforeEach(() => {
    mockGetEntryByDate.mockReset();
    mockGetProfile.mockReset();
    mockGetReminderPreferences.mockReset();
    mockPush.mockReset();
    mockGetProfile.mockResolvedValue(null);
    mockGetReminderPreferences.mockResolvedValue([]);
  });

  it('summarizes saved flow, mood, energy, and sleep signals from the local daily log', async () => {
    mockGetEntryByDate.mockResolvedValue({
      id: 'daily-log-2026-04-20',
      logDate: '2026-04-20',
      bleeding: 'light',
      symptoms: ['fatigue', 'sleep-changes'],
      mood: 'low',
    });

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeTruthy();
      // Mood "Low" and Energy "Low" both render the word "Low".
      expect(screen.getAllByText('Low').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('Fatigue')).toBeNull();
      expect(screen.getByText('Sleep changes')).toBeTruthy();
    });
  });

  it('wraps summary boxes into two columns so localized values are not forced into narrow quarters', async () => {
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      // LT-29: FLOW now shares the same en-dash empty-state glyph as
      // MOOD/ENERGY/SLEEP (previously FLOW alone used a middle dot) -- all
      // 4 boxes render the identical glyph.
      expect(screen.getAllByText('–')).toHaveLength(4);
    });

    const grid = screen.getByTestId('today-summary-grid');
    const flowBoxStyle = StyleSheet.flatten(screen.getByTestId('today-summary-flow-box').props.style);
    const gridStyle = StyleSheet.flatten(grid.props.style);

    expect(gridStyle.flexWrap).toBe('wrap');
    expect(flowBoxStyle.flexBasis).toBe('48%');
    expect(flowBoxStyle.minWidth).toBe(132);
  });

  it('refetches the local entry when its refresh key changes after returning from logging', async () => {
    let storedEntry: unknown = null;
    mockGetEntryByDate.mockImplementation(async () => storedEntry);

    const view = render(
      <TodaySummaryCard logDate="2026-04-20" locale="en" refreshKey={0} />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('–')).toHaveLength(4);
    });

    storedEntry = {
        id: 'daily-log-2026-04-20',
        logDate: '2026-04-20',
        bleeding: 'light',
        symptoms: ['sleep-changes'],
    };

    await act(async () => {
      view.update(<TodaySummaryCard logDate="2026-04-20" locale="en" refreshKey={1} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeTruthy();
      expect(screen.getByText('Sleep changes')).toBeTruthy();
    });
  });

  it('keeps the summary empty when the local entry lookup fails', async () => {
    mockGetEntryByDate.mockRejectedValue(new Error('sqlite unavailable'));

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      // LT-29: all four empty-state boxes (FLOW + MOOD/ENERGY/SLEEP) now
      // share the same en-dash glyph -- 4 matches, not a 1/3 split across
      // two different characters.
      expect(screen.getAllByText('–')).toHaveLength(4);
    });
  });

  it('routes to history from the "See all" action', async () => {
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(mockGetReminderPreferences).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText('See all'));

    expect(mockPush).toHaveBeenCalledWith('/calendar/history');
  });

  it('no longer renders the "Log today" call to action (moved above the card)', async () => {
    mockGetEntryByDate.mockResolvedValue(null);

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(mockGetReminderPreferences).toHaveBeenCalled();
    });

    expect(screen.queryByText('Log today')).toBeNull();
  });

  it('shows a compact birth-control summary from today logs and setup state', async () => {
    mockGetEntryByDate.mockResolvedValue({
      id: 'daily-log-2026-04-20',
      logDate: '2026-04-20',
      bleeding: 'none',
      symptoms: [],
      birthControlEvent: {
        method: 'pill',
        missedDose: true,
        lateDose: true,
      },
    });
    mockGetProfile.mockResolvedValue({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(screen.getByTestId('today-birth-control-summary-card')).toBeTruthy();
      expect(screen.getByText('Pill · missed dose · late dose · reminder on')).toBeTruthy();
    });
  });

  it('shows a compact TTC summary from today logs and setup state', async () => {
    mockGetEntryByDate.mockResolvedValue({
      id: 'daily-log-2026-04-20',
      logDate: '2026-04-20',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        sexLogged: true,
        ovulationTest: 'peak',
        cervicalMucus: 'egg-white',
      },
    });
    mockGetProfile.mockResolvedValue({
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(screen.getByTestId('today-ttc-summary-card')).toBeTruthy();
      expect(screen.getByText('Sex logged · peak test · egg-white mucus')).toBeTruthy();
    });
  });

  it('shows TTC setup context before any TTC details are logged today', async () => {
    mockGetEntryByDate.mockResolvedValue(null);
    mockGetProfile.mockResolvedValue({
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(screen.getByTestId('today-ttc-summary-card')).toBeTruthy();
      expect(screen.getByText('No TTC details logged today')).toBeTruthy();
    });
  });

  it('hides stale TTC observations when TTC mode is off', async () => {
    mockGetEntryByDate.mockResolvedValue({
      id: 'daily-log-2026-04-20',
      logDate: '2026-04-20',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        sexLogged: true,
        ovulationTest: 'positive',
      },
    });
    mockGetProfile.mockResolvedValue({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<TodaySummaryCard logDate="2026-04-20" locale="en" />);

    await waitFor(() => {
      expect(screen.queryByTestId('today-ttc-summary-card')).toBeNull();
      expect(screen.queryByText(/Sex logged/)).toBeNull();
    });
  });
});
