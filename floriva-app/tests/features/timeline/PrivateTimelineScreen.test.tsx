import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockGetProfile = jest.fn();
const mockListAllDailyLogs = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockListImportSessions = jest.fn();
const mockListBackupEvents = jest.fn();
let mockLocale = 'en';

const mockRepositories = {
  userProfile: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
  },
  dailyLogs: {
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
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
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

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(mockLocale),
  };
});

// eslint-disable-next-line import/first
import { StyleSheet } from 'react-native';
// eslint-disable-next-line import/first
import { PrivateTimelineScreen } from '@/src/features/timeline/screens/PrivateTimelineScreen';
// eslint-disable-next-line import/first
import { resolveTheme } from '@/src/theme/tokens';
// eslint-disable-next-line import/first
import {
  buildPrivateTimelineFilterTestId,
  buildPrivateTimelineItemTestId,
  testIds,
} from '@/src/testing/testIds';

describe('PrivateTimelineScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockGetProfile.mockReset();
    mockListAllDailyLogs.mockReset();
    mockGetReminderPreferences.mockReset();
    mockListImportSessions.mockReset();
    mockListBackupEvents.mockReset();
    mockLocale = 'en';
    mockCanGoBack.mockReturnValue(false);
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
    });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListImportSessions.mockResolvedValue([]);
    mockListBackupEvents.mockResolvedValue([]);
  });

  it('renders private timeline rows from local persisted history', async () => {
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-rich',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: ['cramps'],
        mood: 'low',
        notes: 'Needed quiet time.',
        ttcObservation: {
          ovulationTest: 'positive',
          sexLogged: true,
        },
        birthControlEvent: {
          method: 'pill',
          missedDose: true,
        },
        importSessionId: 'import-clue',
      },
    ]);
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);
    mockListImportSessions.mockResolvedValue([
      {
        id: 'import-clue',
        source: 'clue',
        status: 'committed',
        startedAt: '2026-04-17T12:00:00.000Z',
        completedAt: '2026-04-17T12:05:00.000Z',
        importedLogCount: 4,
        skippedLogCount: 0,
      },
    ]);
    mockListBackupEvents.mockResolvedValue([
      {
        id: 'backup-export',
        action: 'exported',
        occurredAt: '2026-04-19T09:00:00.000Z',
        detail: '1 local log entry encrypted into a Floriva backup file.',
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Private timeline')).toBeTruthy();
    expect(await screen.findByText('Daily log')).toBeTruthy();
    expect(screen.getByText('Private note')).toBeTruthy();
    expect(screen.getByText('Private note saved.').props.numberOfLines).toBe(2);
    expect(screen.queryByText('Needed quiet time.')).toBeNull();
    expect(screen.getByText('TTC observation')).toBeTruthy();
    expect(screen.getByText('Birth-control log')).toBeTruthy();
    expect(screen.getByText('Clue import')).toBeTruthy();
    expect(screen.getByText('Backup exported')).toBeTruthy();
    expect(screen.getByText('Daily log reminder')).toBeTruthy();
    expect(screen.getByTestId(buildPrivateTimelineItemTestId('note-log-rich')).props.accessibilityLabel).toContain(
      'Apr 18, Private note, Private note saved., Private, Open Private note',
    );
    expect(mockListAllDailyLogs).toHaveBeenCalledTimes(1);
    expect(mockListImportSessions).toHaveBeenCalledTimes(1);
    expect(mockListBackupEvents).toHaveBeenCalledTimes(1);
  });

  it('filters visible rows by timeline kind', async () => {
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-note',
        logDate: '2026-04-18',
        bleeding: 'none',
        symptoms: [],
        notes: 'Private note only.',
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Private note')).toBeTruthy();

    fireEvent.press(screen.getByTestId(buildPrivateTimelineFilterTestId('note')));

    expect(screen.getByText('Private note')).toBeTruthy();
    expect(screen.queryByText('Daily log')).toBeNull();
    expect(screen.getByTestId(buildPrivateTimelineFilterTestId('note')).props.accessibilityState).toEqual({
      disabled: false,
      selected: true,
    });
  });

  it('UL-19: filters wear the selection-chip grammar, not the primary-CTA or bare-text costume', async () => {
    mockListAllDailyLogs.mockResolvedValue([]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await screen.findByText('Stored on this device');

    const theme = resolveTheme('light');
    const selected = screen.getByTestId(buildPrivateTimelineFilterTestId('all'));
    const selectedStyle = StyleSheet.flatten(
      typeof selected.props.style === 'function'
        ? selected.props.style({ pressed: false })
        : selected.props.style,
    );

    // "All" used to render as an oxblood primary-CTA circle while the other
    // filters were bare bold text. Selected now means the ink-outlined
    // selection chip (Wave A's UL-50 grammar), never the CTA fill.
    expect(selectedStyle.borderColor).toBe(theme.colors.chipSelectedBorder);
    expect(selectedStyle.backgroundColor).not.toBe(theme.colors.accentPrimary);

    const unselected = screen.getByTestId(buildPrivateTimelineFilterTestId('note'));
    const unselectedStyle = StyleSheet.flatten(
      typeof unselected.props.style === 'function'
        ? unselected.props.style({ pressed: false })
        : unselected.props.style,
    );

    // Unselected filters are real chips too (fill + rule border), not bare
    // text ragging across the row.
    expect(unselectedStyle.borderColor).toBe(theme.colors.chipBorder);
    expect(unselectedStyle.backgroundColor).toBe(theme.colors.chipFill);
  });

  it('does not present pending or failed import sessions as completed imports', async () => {
    mockListAllDailyLogs.mockResolvedValue([]);
    mockListImportSessions.mockResolvedValue([
      {
        id: 'import-pending',
        source: 'flo',
        status: 'pending',
        startedAt: '2026-04-17T12:00:00.000Z',
        importedLogCount: 0,
        skippedLogCount: 0,
      },
      {
        id: 'import-failed',
        source: 'clue',
        status: 'failed',
        startedAt: '2026-04-18T12:00:00.000Z',
        completedAt: '2026-04-18T12:05:00.000Z',
        importedLogCount: 0,
        skippedLogCount: 4,
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading timeline...')).toBeNull();
    });

    expect(screen.queryByText('Flo import')).toBeNull();
    expect(screen.queryByText('Clue import')).toBeNull();
    expect(screen.getByText('No timeline entries yet')).toBeTruthy();
  });

  it('localizes timeline row labels and row metadata', async () => {
    mockLocale = 'es';
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-es',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: ['cramps', 'fatigue'],
        notes: 'Nota guardada.',
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Registro diario')).toBeTruthy();
    expect(screen.getByText('Sangrado medio · Cólicos y Fatiga')).toBeTruthy();
    expect(screen.getByText('Nota privada')).toBeTruthy();
    expect(screen.getByText('Nota privada guardada.')).toBeTruthy();
    expect(screen.queryByText('Nota guardada.')).toBeNull();
    expect(screen.getAllByText('Privado').length).toBeGreaterThan(0);
  });

  it('localizes TTC detail branches and import source labels', async () => {
    mockLocale = 'es';
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-ttc',
        logDate: '2026-04-18',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'egg-white',
          basalBodyTemperatureCelsius: 36.58,
        },
      },
    ]);
    mockListImportSessions.mockResolvedValue([
      {
        id: 'import-flo',
        source: 'flo',
        status: 'committed',
        startedAt: '2026-04-17T12:00:00.000Z',
        completedAt: '2026-04-17T12:05:00.000Z',
        importedLogCount: 1,
        skippedLogCount: 0,
      },
      {
        id: 'import-manual',
        source: 'manual',
        status: 'committed',
        startedAt: '2026-04-16T12:00:00.000Z',
        completedAt: '2026-04-16T12:05:00.000Z',
        importedLogCount: 3,
        skippedLogCount: 1,
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Observación TTC')).toBeTruthy();
    expect(screen.getByText('Moco cervical: tipo clara de huevo · BBT: 36.58 C')).toBeTruthy();
    expect(screen.getByText('Importación de Flo')).toBeTruthy();
    expect(screen.getByText('1 entrada importada')).toBeTruthy();
    expect(screen.getByText('Importación de Historial manual')).toBeTruthy();
    expect(screen.getByText('3 entradas importadas · 1 omitidas')).toBeTruthy();
  });

  it('renders all TTC value labels through localized timeline rows', async () => {
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'ttc-negative-dry',
        logDate: '2026-04-18',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          ovulationTest: 'negative',
          cervicalMucus: 'dry',
        },
      },
      {
        id: 'ttc-peak-sticky',
        logDate: '2026-04-17',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          ovulationTest: 'peak',
          cervicalMucus: 'sticky',
        },
      },
      {
        id: 'ttc-creamy',
        logDate: '2026-04-16',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'creamy',
        },
      },
      {
        id: 'ttc-empty',
        logDate: '2026-04-15',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {},
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Ovulation test: negative · Cervical mucus: dry')).toBeTruthy();
    expect(screen.getByText('Ovulation test: peak · Cervical mucus: sticky')).toBeTruthy();
    expect(screen.getByText('Cervical mucus: creamy')).toBeTruthy();
    expect(screen.getByText('TTC observation logged')).toBeTruthy();
  });

  it('renders every birth-control method label through localized timeline rows', async () => {
    mockListAllDailyLogs.mockResolvedValue(
      ['none', 'iud', 'implant', 'ring', 'patch', 'other'].map((method, index) => ({
        id: `bc-${method}`,
        logDate: `2026-04-${String(18 - index).padStart(2, '0')}`,
        bleeding: 'none',
        symptoms: [],
        birthControlEvent: {
          method,
          lateDose: method === 'ring',
          missedDose: method === 'patch',
        },
      })),
    );

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Method: none')).toBeTruthy();
    expect(screen.getByText('Method: IUD')).toBeTruthy();
    expect(screen.getByText('Method: implant')).toBeTruthy();
    expect(screen.getByText('Method: ring · Late dose')).toBeTruthy();
    expect(screen.getByText('Method: patch · Missed dose')).toBeTruthy();
    expect(screen.getByText('Method: other')).toBeTruthy();
  });

  it('shows a localized load error when timeline hydration fails', async () => {
    mockListAllDailyLogs.mockRejectedValue(new Error('database unavailable'));

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByTestId(testIds.calendar.timelineErrorCard)).toBeTruthy();
    expect(screen.getByText('Timeline needs attention')).toBeTruthy();
    expect(screen.getByText('Timeline could not load right now.')).toBeTruthy();
  });

  it('shows an empty state when timeline has no entries', async () => {
    mockListAllDailyLogs.mockResolvedValue([]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading timeline...')).toBeNull();
    });

    expect(screen.getByTestId(testIds.calendar.timelineEmptyState)).toBeTruthy();
    expect(screen.getByText('No timeline entries yet')).toBeTruthy();
  });

  it('shows a filter-specific empty state when timeline has entries outside the active filter', async () => {
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-only',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Daily log')).toBeTruthy();

    fireEvent.press(screen.getByTestId(buildPrivateTimelineFilterTestId('backup')));

    expect(screen.getByTestId(testIds.calendar.timelineEmptyState)).toBeTruthy();
    expect(screen.getByText('Nothing in this filter yet')).toBeTruthy();
    expect(screen.getByText('0 Backups entries shown from 2 total')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.calendar.timelineShowAllButton));

    // UL-22: the metric numeral carries the count; the caption below is a
    // plain label, not "2 / 2 private timeline entries" twice over.
    expect(screen.getByText('Private timeline entries')).toBeTruthy();
    expect(screen.queryByText('2 private timeline entries')).toBeNull();
    expect(screen.getByText('Daily log')).toBeTruthy();
  });

  it('opens the source surface for timeline rows', async () => {
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-source',
        logDate: '2026-04-18',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Daily log')).toBeTruthy();

    fireEvent.press(screen.getByTestId(buildPrivateTimelineItemTestId('daily-log-log-source')));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-18');
  });

  it('renders every local reminder kind with real dates instead of sentinel dates', async () => {
    mockListAllDailyLogs.mockResolvedValue([]);
    // LT-26: a birth-control reminder only schedules when a method is on
    // file, so this profile needs one to exercise that reminder kind.
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      birthControlMethod: 'pill',
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByText('Daily log reminder')).toBeTruthy();
    expect(screen.getByText('Period reminder')).toBeTruthy();
    expect(screen.getByText('Fertile-window reminder')).toBeTruthy();
    expect(screen.getByText('Birth-control reminder')).toBeTruthy();
    expect(screen.queryByText('Dec 31')).toBeNull();
  });

  it('returns to calendar when no previous route exists', async () => {
    mockListAllDailyLogs.mockResolvedValue([]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading timeline...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(testIds.calendar.timelineBackButton));

    expect(mockReplace).toHaveBeenCalledWith('/calendar');
  });

  it('pops timeline when navigation history exists', async () => {
    mockCanGoBack.mockReturnValue(true);
    mockListAllDailyLogs.mockResolvedValue([]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading timeline...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(testIds.calendar.timelineBackButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('surfaces a load error without rendering stale timeline rows', async () => {
    mockListAllDailyLogs.mockRejectedValue(new Error('db unavailable'));

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    expect(await screen.findByTestId(testIds.calendar.timelineErrorCard)).toBeTruthy();
    expect(screen.queryByText('Daily log')).toBeNull();
  });

  it('LT-20: disambiguates two rows sharing the same month/day across different years', async () => {
    // A 12-month+ tenure user's timeline can contain two "Jul 2" rows (one
    // per year); rendered as bare "Jul 2" both, they were visually
    // indistinguishable. "today" is mocked to 2026-04-20 for this file, so
    // the 2025 entry is the prior-calendar-year row that must gain a year
    // suffix, and the 2026 entry stays in the compact form.
    mockListAllDailyLogs.mockResolvedValue([
      {
        id: 'log-recent-year',
        logDate: '2026-04-02',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: 'log-prior-year',
        logDate: '2025-04-02',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    // The current-year daily-log row keeps the compact "Apr 2" form...
    expect(
      await screen.findByTestId(buildPrivateTimelineItemTestId('daily-log-log-recent-year')),
    ).toHaveProperty('props.accessibilityLabel', expect.stringContaining('Apr 2, Daily log'));
    // ...while the prior-year row gains the disambiguating year suffix, so
    // the two "Apr 2" entries are no longer visually/accessibly identical.
    expect(
      screen.getByTestId(buildPrivateTimelineItemTestId('daily-log-log-prior-year')),
    ).toHaveProperty('props.accessibilityLabel', expect.stringContaining('Apr 2, 2025, Daily log'));
  });

  it('LT-26: does not surface a birth-control reminder row when the preference is enabled but no method is on file', async () => {
    // Orphaned data (enabled: true, no birthControlMethod) can exist without
    // ever going through the BC-detail screen's own clear-method flow. This
    // screen reads reminders through buildReminderCenterModel ->
    // buildReminderPlans, which (per LT-26) already refuses to schedule a
    // birth-control reminder without a method -- so the row must not appear,
    // consistent with the Settings hub reporting "Off" for the same data.
    mockListAllDailyLogs.mockResolvedValue([]);
    // Default mockGetProfile (set in beforeEach) already has no
    // birthControlMethod.
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 30,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<PrivateTimelineScreen todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading timeline...')).toBeNull();
    });

    expect(screen.queryByText('Birth-control reminder')).toBeNull();
  });
});
