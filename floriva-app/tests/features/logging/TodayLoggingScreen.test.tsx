import path from 'node:path';

import Database from 'better-sqlite3';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { resolveTheme } from '@/src/theme/tokens';
import { createMockLocalization as mockCreateMockLocalization } from '../../helpers/mockLocalizationProvider';
import { expectAccessiblePressables } from '../../helpers/expectAccessiblePressables';

let mockRepositories: ReturnType<typeof createDomainRepositories>;
const mockAttemptAutomaticReviewPrompt = jest.fn();
const mockTriggerPressFeedback = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const localization = mockCreateMockLocalization();

  return {
    useLocalization: () => localization,
  };
});

jest.mock('@/src/features/review/automaticReview', () => ({
  attemptAutomaticReviewPrompt: (...args: unknown[]) =>
    mockAttemptAutomaticReviewPrompt(...args),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

// eslint-disable-next-line import/first
import {
  TodayLoggingCard,
  TodayLoggingScreen,
} from '@/src/features/logging/screens/TodayLoggingScreen';
// eslint-disable-next-line import/first
import {
  buildTodayLoggingChipTestId,
  testIds,
} from '@/src/testing/testIds';

const migrationDirectory = path.resolve(__dirname, '../../../drizzle');

function createRepositories() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return createDomainRepositories(db);
}

function flattenPressableStyle(style: unknown) {
  if (typeof style === 'function') {
    return StyleSheet.flatten(style({ pressed: false }));
  }

  return StyleSheet.flatten(style);
}

describe('TodayLoggingScreen', () => {
  const lightTheme = resolveTheme('light');

  async function flushMicrotasks() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  async function renderHydratedLoggingScreen(ui: React.ReactElement) {
    render(ui);
    await flushMicrotasks();
  }

  beforeEach(() => {
    mockRepositories = createRepositories();
    mockAttemptAutomaticReviewPrompt.mockReset();
    mockTriggerPressFeedback.mockReset();
    mockAttemptAutomaticReviewPrompt.mockResolvedValue({
      requested: false,
      reason: 'not-eligible',
    });
  });

  it('keeps sex out of the Wave 3 symptom chip list', async () => {
    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-12" />);

    await screen.findByText('Cramps');

    expect(screen.queryByText('Sex')).toBeNull();
  });

  it('wraps trying-to-conceive logging controls in a stable container', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'trying-to-conceive'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
    });

    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-12" />);

    expect(await screen.findByTestId(testIds.today.ttcLoggingControls)).toBeTruthy();
    expect(screen.getByTestId(buildTodayLoggingChipTestId('ttc', 'sex-logged'))).toBeTruthy();
    expect(screen.getByTestId(testIds.today.bbtInput)).toBeTruthy();

    expectAccessiblePressables(screen.UNSAFE_root);
  });

  it('hides trying-to-conceive controls when only stale preferences remain', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
    });

    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-12" />);

    await screen.findByText('Cramps');

    expect(screen.queryByTestId(testIds.today.ttcLoggingControls)).toBeNull();
    expect(screen.queryByTestId(buildTodayLoggingChipTestId('ttc', 'sex-logged'))).toBeNull();
    expect(screen.queryByTestId(testIds.today.bbtInput)).toBeNull();
  });

  it('triggers selection feedback when toggling a logging chip', async () => {
    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-12" />);

    await screen.findByText('Cramps');

    fireEvent.press(screen.getByText('Cramps'));

    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('selection');
  });

  it('keeps condition-aware symptom guidance compact when multiple condition templates are enabled', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      conditionTags: ['pcos', 'pmdd', 'endometriosis'],
    });

    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-12" />);

    await screen.findByText('PCOS patterns');

    expect(screen.getByTestId(testIds.today.conditionLoggingContext)).toBeTruthy();
    expect(screen.getByText('PCOS patterns')).toBeTruthy();

    // UL-64: the condition-context tags are informational labels, not
    // selectable chips -- they must not wear the pill-border chip costume
    // their tappable siblings use. Eyebrow voice, no border.
    const pcosTag = screen.getByText('PCOS patterns');
    const pcosTagStyle = StyleSheet.flatten(pcosTag.props.style);
    expect(pcosTagStyle.textTransform).toBe('uppercase');
    expect(screen.getByText('PMDD patterns')).toBeTruthy();
    expect(screen.getByText('Endometriosis patterns')).toBeTruthy();
    expect(
      screen.queryByText(
        'If you track PCOS-related patterns, Floriva keeps cycle variability, spotting, skin, and discharge signals easy to review later.',
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        'If you track PMDD-related patterns, Floriva keeps mood, sleep, headache, and cramp signals close before a period starts.',
      ),
    ).toBeNull();
  });

  it('uses selected-day copy when rendered from a calendar day route', async () => {
    render(
      <TodayLoggingCard
        logDate="2026-04-20"
        locale="en"
        surface="selected-day"
      />,
    );

    await screen.findByText('Log this day');

    expect(
      screen.getByText('Start with what changed on this day.'),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Anything worth remembering for this day')).toBeTruthy();
    expect(screen.getByText('Add something before saving.')).toBeTruthy();
    expect(screen.getByText('Save this log')).toBeTruthy();
    expect(screen.queryByText('Log today')).toBeNull();
    expect(screen.queryByText("Save today's log")).toBeNull();
  });

  it('creates a mood-only entry and defaults bleeding to none', async () => {
    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-13" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Anything worth remembering today'),
      'Mood dipped after lunch.',
    );
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-13')).resolves.toEqual({
        id: 'daily-log-2026-04-13',
        logDate: '2026-04-13',
        bleeding: 'none',
        symptoms: [],
        mood: 'low',
        notes: 'Mood dipped after lunch.',
      });
    });
  });

  it('hydrates and saves read-modify-write updates without dropping omitted fields', async () => {
    await mockRepositories.importSessions.saveSession({
      id: 'import-1',
      source: 'manual',
      status: 'committed',
      startedAt: '2026-04-14T07:00:00.000Z',
      completedAt: '2026-04-14T07:03:00.000Z',
      importedLogCount: 1,
      skippedLogCount: 0,
    });

    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-14',
      logDate: '2026-04-14',
      bleeding: 'medium',
      symptoms: ['fatigue'],
      mood: 'steady',
      notes: 'Started the day okay.',
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'negative',
      },
      birthControlEvent: {
        method: 'pill',
        lateDose: true,
      },
      importSessionId: 'import-1',
    });

    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-14" />);

    await screen.findByDisplayValue('Started the day okay.');

    fireEvent.press(screen.getByText('Cramps'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Anything worth remembering today'),
      'Cramping eased after tea.',
    );
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-14')).resolves.toEqual({
        id: 'daily-log-2026-04-14',
        logDate: '2026-04-14',
        bleeding: 'medium',
        symptoms: ['fatigue', 'cramps'],
        mood: 'steady',
        notes: 'Cramping eased after tea.',
        ttcObservation: {
          cervicalMucus: 'creamy',
          ovulationTest: 'negative',
        },
        birthControlEvent: {
          method: 'pill',
          lateDose: true,
        },
        importSessionId: 'import-1',
      });
    });
  });

  it('requires explicit confirmation before deleting the current day entry', async () => {
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-15',
      logDate: '2026-04-15',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing entry',
    });

    await renderHydratedLoggingScreen(<TodayLoggingScreen logDate="2026-04-15" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Delete entry'));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-15')).resolves.toEqual({
        id: 'daily-log-2026-04-15',
        logDate: '2026-04-15',
        bleeding: 'light',
        symptoms: ['cramps'],
        notes: 'Existing entry',
      });
    });

    expect(
      screen.getByText('Delete this entry from this device? This cannot be undone.'),
    ).toBeTruthy();
    expect(screen.queryByText("Save today's log")).toBeNull();
    expect(screen.getByText('Keep entry')).toBeTruthy();
    expect(screen.getByText('Confirm delete')).toBeTruthy();

    fireEvent.press(screen.getByText('Keep entry'));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-15')).resolves.toEqual({
        id: 'daily-log-2026-04-15',
        logDate: '2026-04-15',
        bleeding: 'light',
        symptoms: ['cramps'],
        notes: 'Existing entry',
      });
    });
    expect(screen.queryByText("Save today's log")).toBeNull();
    expect(screen.getByText('Delete entry')).toBeTruthy();

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-15')).resolves.toBeNull();
    });
  });

  it('re-hydrates persisted entries after the screen remounts', async () => {
    const view = render(<TodayLoggingScreen logDate="2026-04-16" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Sensitive'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Anything worth remembering today'),
      'Needed a slower pace today.',
    );
    fireEvent.press(screen.getByText("Save today's log"));

    await screen.findByText('Saved on this device.');

    view.unmount();
    render(<TodayLoggingScreen logDate="2026-04-16" />);

    expect(await screen.findByDisplayValue('Needed a slower pace today.')).toBeTruthy();
  });

  it('shows TTC controls only for the enabled profile preferences and saves them into the daily log', async () => {
    await mockRepositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });

    render(<TodayLoggingScreen logDate="2026-04-18" />);

    await screen.findByText('Trying-to-conceive tracking');

    expect(screen.getByText('Sex logged')).toBeTruthy();
    expect(screen.getByText('Peak test')).toBeTruthy();
    expect(screen.getByText('Egg-white')).toBeTruthy();
    expect(screen.getByTestId(buildTodayLoggingChipTestId('ttc', 'sex-logged'))).toBeTruthy();
    expect(
      screen.getByTestId(buildTodayLoggingChipTestId('ovulation-test', 'peak')),
    ).toBeTruthy();
    expect(
      screen.getByTestId(buildTodayLoggingChipTestId('cervical-mucus', 'egg-white')),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText('36.50')).toBeNull();

    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('ttc', 'sex-logged')));
    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('ovulation-test', 'peak')));
    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('cervical-mucus', 'egg-white')));
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-18')).resolves.toEqual({
        id: 'daily-log-2026-04-18',
        logDate: '2026-04-18',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'egg-white',
          ovulationTest: 'peak',
          sexLogged: true,
        },
      });
    });
  });

  it('shows a clear validation error for out-of-range BBT input instead of failing on save', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'trying-to-conceive'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: true,
      },
    });

    render(<TodayLoggingScreen logDate="2026-04-18" />);

    await screen.findByText('Trying-to-conceive tracking');

    fireEvent.changeText(screen.getByTestId(testIds.today.bbtInput), '99');

    expect(screen.getByTestId('today-save-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText("Save today's log"));

    expect(
      await screen.findByText('Enter a BBT between 30.00 C and 45.00 C.'),
    ).toBeTruthy();
    await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-18')).resolves.toBeNull();
  });

  it('renders basal temperature as a compact labeled input instead of the notes textarea', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'trying-to-conceive'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: true,
      },
    });

    render(<TodayLoggingScreen logDate="2026-04-27" />);

    expect(await screen.findByText('Basal body temperature')).toBeTruthy();

    const bbtInput = screen.getByTestId(testIds.today.bbtInput);
    const notesInput = screen.getByTestId(testIds.today.notesInput);

    expect(bbtInput.props.placeholder).toBe('e.g. 36.50 C');
    expect(bbtInput.props.style.minHeight).toBe(56);
    expect(notesInput.props.style.minHeight).toBe(128);
  });

  it('shows birth-control controls when the local reminder preference is enabled and saves pill adherence details', async () => {
    await mockRepositories.reminderPreferences.savePreferences([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 21,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    render(<TodayLoggingScreen logDate="2026-04-18" />);

    await screen.findByText('Birth control');

    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('birth-control-method', 'pill')));
    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('birth-control-pill', 'missed-dose')));
    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('birth-control-pill', 'late-dose')));
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-18')).resolves.toEqual({
        id: 'daily-log-2026-04-18',
        logDate: '2026-04-18',
        bleeding: 'none',
        symptoms: [],
        birthControlEvent: {
          method: 'pill',
          missedDose: true,
          lateDose: true,
        },
      });
    });
  });

  it('does not create an entry when the draft is still empty', async () => {
    render(<TodayLoggingScreen logDate="2026-04-19" />);

    await screen.findByText('Log today');

    expect(screen.getByTestId('today-save-button').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Add something before saving.')).toBeTruthy();

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-19')).resolves.toBeNull();
    });
    expect(screen.queryByText('Saved on this device.')).toBeNull();
  });

  it('shows when an existing entry has no unsaved changes yet', async () => {
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing entry',
    });

    render(<TodayLoggingScreen logDate="2026-04-25" />);

    await screen.findByDisplayValue('Existing entry');

    expect(screen.queryByTestId('today-save-button')).toBeNull();
    expect(screen.queryByText('No unsaved changes yet.')).toBeNull();
    expect(screen.getByText('Delete entry')).toBeTruthy();

    fireEvent.press(screen.getByText('Headache'));

    expect(screen.getByTestId('today-save-button').props.accessibilityState.disabled).toBe(false);
  });

  it('explains how to remove a fully cleared existing entry', async () => {
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-26',
      logDate: '2026-04-26',
      bleeding: 'light',
      symptoms: [],
      notes: 'Existing entry',
    });

    render(<TodayLoggingScreen logDate="2026-04-26" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Light'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Anything worth remembering today'),
      '',
    );

    expect(screen.getByTestId('today-save-button').props.accessibilityState.disabled).toBe(true);
    expect(
      screen.getByText(
        'Everything is cleared. Delete the entry to remove this day from this device.',
      ),
    ).toBeTruthy();
  });

  it('saves BBT entries and lets users remove an already-selected symptom', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'trying-to-conceive'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: true,
      },
    });
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-20',
      logDate: '2026-04-20',
      bleeding: 'none',
      symptoms: ['cramps'],
    });

    render(<TodayLoggingScreen logDate="2026-04-20" />);

    await screen.findByText('Trying-to-conceive tracking');

    fireEvent.press(screen.getByText('Cramps'));
    fireEvent.changeText(screen.getByTestId(testIds.today.bbtInput), '36.58');
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-04-20')).resolves.toEqual({
        id: 'daily-log-2026-04-20',
        logDate: '2026-04-20',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          basalBodyTemperatureCelsius: 36.58,
          sexLogged: undefined,
        },
      });
    });
  });

  it('shows a load error when the daily log cannot hydrate', async () => {
    mockRepositories = {
      dailyLogs: {
        getEntryByDate: jest.fn().mockRejectedValue(new Error('load failed')),
      },
      reminderPreferences: {
        getPreferences: jest.fn().mockResolvedValue([]),
      },
      userProfile: {
        getProfile: jest.fn().mockResolvedValue(defaultUserProfile),
      },
    } as unknown as ReturnType<typeof createDomainRepositories>;

    render(<TodayLoggingScreen logDate="2026-04-21" />);

    expect(await screen.findByText('Today could not load right now.')).toBeTruthy();
  });

  it('shows a save error when the entry cannot be persisted', async () => {
    mockRepositories = {
      dailyLogs: {
        getEntryByDate: jest.fn().mockResolvedValue(null),
        saveEntry: jest.fn().mockRejectedValue(new Error('save failed')),
      },
      userProfile: {
        getProfile: jest.fn().mockResolvedValue(defaultUserProfile),
      },
    } as unknown as ReturnType<typeof createDomainRepositories>;

    render(<TodayLoggingScreen logDate="2026-04-22" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Today could not save right now.')).toBeTruthy();
  });

  it('stops short of deleting when the entry is already gone by the time delete runs', async () => {
    const hydratedEntry = {
      id: 'daily-log-2026-04-23',
      logDate: '2026-04-23',
      bleeding: 'light' as const,
      symptoms: [],
      notes: 'Existing entry',
    };
    const deleteEntry = jest.fn();

    mockRepositories = {
      dailyLogs: {
        getEntryByDate: jest
          .fn()
          .mockResolvedValueOnce(hydratedEntry)
          .mockResolvedValueOnce(null),
        deleteEntry,
      },
      reminderPreferences: {
        getPreferences: jest.fn().mockResolvedValue([]),
      },
      userProfile: {
        getProfile: jest.fn().mockResolvedValue(defaultUserProfile),
      },
    } as unknown as ReturnType<typeof createDomainRepositories>;

    render(<TodayLoggingScreen logDate="2026-04-23" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    await waitFor(() => {
      expect(deleteEntry).not.toHaveBeenCalled();
      expect(screen.queryByText('Confirm delete')).toBeNull();
      expect(screen.getByText('Entry already removed from this device.')).toBeTruthy();
    });
  });

  it('shows a delete error when removal fails', async () => {
    const hydratedEntry = {
      id: 'daily-log-2026-04-24',
      logDate: '2026-04-24',
      bleeding: 'light' as const,
      symptoms: [],
      notes: 'Existing entry',
    };

    mockRepositories = {
      dailyLogs: {
        getEntryByDate: jest
          .fn()
          .mockResolvedValueOnce(hydratedEntry)
          .mockResolvedValueOnce(hydratedEntry),
        deleteEntry: jest.fn().mockRejectedValue(new Error('delete failed')),
      },
      reminderPreferences: {
        getPreferences: jest.fn().mockResolvedValue([]),
      },
      userProfile: {
        getProfile: jest.fn().mockResolvedValue(defaultUserProfile),
      },
    } as unknown as ReturnType<typeof createDomainRepositories>;

    render(<TodayLoggingScreen logDate="2026-04-24" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    expect(await screen.findByText('Today could not delete right now.')).toBeTruthy();
  });

  it('shows a stronger selected-state cue on chips and removes it when toggled off', async () => {
    render(<TodayLoggingScreen logDate="2026-04-27" />);

    await screen.findByText('Log today');

    // Multi-select symptoms show an empty checkbox even when unselected.
    expect(screen.getByTestId('selectable-chip-indicator-symptoms-cramps')).toBeTruthy();
    expect(screen.queryByText('✓')).toBeNull();

    fireEvent.press(screen.getByText('Cramps'));

    expect(screen.getAllByText('✓', { includeHiddenElements: true }).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Cramps'));

    expect(screen.queryByText('✓')).toBeNull();
  });

  it('keeps condition-highlighted chips softer than selected chips', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'symptoms'],
      conditionTags: ['pmdd'],
    });

    render(<TodayLoggingScreen logDate="2026-04-27" />);

    await screen.findByText('Log today');

    const crampsChip = screen.getByTestId(buildTodayLoggingChipTestId('symptoms', 'cramps'));
    const highlightedStyle = flattenPressableStyle(crampsChip.props.style);

    expect(highlightedStyle).toMatchObject({
      borderColor: lightTheme.colors.buttonGlassBorder,
      backgroundColor: lightTheme.colors.buttonGlassFill,
    });
    // Highlighted-but-unselected symptom shows an empty checkbox (no check mark yet).
    expect(screen.queryByText('✓')).toBeNull();

    fireEvent.press(crampsChip);

    const selectedStyle = flattenPressableStyle(
      screen.getByTestId(buildTodayLoggingChipTestId('symptoms', 'cramps')).props.style,
    );

    expect(selectedStyle).toMatchObject({
      borderColor: lightTheme.colors.chipSelectedBorder,
      backgroundColor: lightTheme.colors.chipSelectedFill,
    });
    expect(screen.getAllByText('✓', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('keeps symptom chip typography stable when selection changes', async () => {
    await mockRepositories.userProfile.saveProfile({
      ...defaultUserProfile,
      goals: ['period', 'symptoms'],
      conditionTags: ['pmdd'],
    });

    render(<TodayLoggingScreen logDate="2026-04-27" />);

    await screen.findByText('Log today');

    expect(StyleSheet.flatten(screen.getByText('Cramps').props.style)).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    });

    fireEvent.press(screen.getByTestId(buildTodayLoggingChipTestId('symptoms', 'cramps')));

    expect(StyleSheet.flatten(screen.getByText('Cramps').props.style)).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    });
  });

  it('clears stale success feedback as soon as the draft changes again', async () => {
    render(<TodayLoggingScreen logDate="2026-04-28" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Saved on this device.')).toBeTruthy();

    fireEvent.press(screen.getByText('Headache'));

    expect(screen.queryByText('Saved on this device.')).toBeNull();
  });

  it('collapses the saved state so delete stays reachable after saving', async () => {
    render(<TodayLoggingScreen logDate="2026-04-30" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Saved on this device.')).toBeTruthy();
    expect(screen.queryByTestId('today-save-button')).toBeNull();
    expect(screen.queryByText('No unsaved changes yet.')).toBeNull();
    expect(screen.getByText('Delete entry')).toBeTruthy();
  });

  it('tries the calm automatic review check only after a successful save settles', async () => {
    render(<TodayLoggingScreen logDate="2026-05-01" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Saved on this device.')).toBeTruthy();

    await waitFor(() => {
      expect(mockAttemptAutomaticReviewPrompt).toHaveBeenCalledTimes(1);
    });
  });

  it('swallows automatic review check failures after a successful save', async () => {
    mockAttemptAutomaticReviewPrompt.mockRejectedValueOnce(new Error('review-check-failed'));

    render(<TodayLoggingScreen logDate="2026-05-01" />);

    await screen.findByText('Log today');

    fireEvent.press(screen.getByText('Low'));
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Saved on this device.')).toBeTruthy();

    await waitFor(() => {
      expect(mockAttemptAutomaticReviewPrompt).toHaveBeenCalledTimes(1);
    });
  });

  it('does not run the automatic review check when save validation fails', async () => {
    await mockRepositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: true,
      },
    });

    render(<TodayLoggingScreen logDate="2026-05-02" />);

    await screen.findByText('Log today');

    fireEvent.changeText(screen.getByTestId(testIds.today.bbtInput), '29.00');
    fireEvent.press(screen.getByText("Save today's log"));

    expect(await screen.findByText('Enter a BBT between 30.00 C and 45.00 C.')).toBeTruthy();
    expect(mockAttemptAutomaticReviewPrompt).not.toHaveBeenCalled();
  });

  it('does not run the automatic review check when deleting an entry', async () => {
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-05-03',
      logDate: '2026-05-03',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing entry',
    });

    render(<TodayLoggingScreen logDate="2026-05-03" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    await waitFor(async () => {
      await expect(mockRepositories.dailyLogs.getEntryByDate('2026-05-03')).resolves.toBeNull();
    });
    expect(mockAttemptAutomaticReviewPrompt).not.toHaveBeenCalled();
  });

  it('locks delete confirmation actions while deletion is already in flight', async () => {
    let resolveDelete: (() => void) | undefined;
    const hydratedEntry = {
      id: 'daily-log-2026-04-29',
      logDate: '2026-04-29',
      bleeding: 'light' as const,
      symptoms: [],
      notes: 'Existing entry',
    };

    mockRepositories = {
      dailyLogs: {
        getEntryByDate: jest
          .fn()
          .mockResolvedValueOnce(hydratedEntry)
          .mockResolvedValueOnce(hydratedEntry),
        deleteEntry: jest.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveDelete = resolve;
            }),
        ),
      },
      reminderPreferences: {
        getPreferences: jest.fn().mockResolvedValue([]),
      },
      userProfile: {
        getProfile: jest.fn().mockResolvedValue(defaultUserProfile),
      },
    } as unknown as ReturnType<typeof createDomainRepositories>;

    render(<TodayLoggingScreen logDate="2026-04-29" />);

    await screen.findByDisplayValue('Existing entry');

    fireEvent.press(screen.getByText('Delete entry'));
    fireEvent.press(screen.getByText('Confirm delete'));

    expect(
      screen.getByTestId('today-delete-cancel-button').props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('today-delete-confirm-button').props.accessibilityState.disabled,
    ).toBe(true);

    resolveDelete?.();
  });
});
