import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockSetLocalePreference = jest.fn();
const mockLogSensitiveRuntimeFailure = jest.fn();
const mockLocalizedStrings: Record<string, string> = {
  'import.screen.eyebrow': 'Import',
  'import.screen.title': 'Import history',
  'import.screen.description':
    'Choose a source, preview what Floriva can safely keep, and commit only what fits locally.',
  'import.screen.backLabel': 'Back to data controls',
  'import.screen.sourceTitle': 'Choose an import source',
  'import.screen.sourcePickerDescription': 'Pick one source to preview before Floriva imports anything.',
  'import.screen.attentionDescription': 'Floriva only commits imports it can explain clearly.',
  'import.screen.previewDescription':
    'Check the counts, date range, and skipped rows before you import.',
  'import.screen.resultDescription': 'Floriva only brought in the rows you reviewed.',
  'import.screen.sourceStepLabel': 'Step 1',
  'import.screen.previewStepLabel': 'Step 2',
  'import.screen.confirmStepLabel': 'Step 3',
  'import.screen.previewSummaryTitle': 'Preview summary',
  'import.screen.resultTitle': 'Import complete',
  'privacy.explainer.imports.body':
    'Imports only open the file you choose. Floriva does not scan your storage or upload that file.',
  'import.sources.clue.title': 'Clue JSON',
  'import.sources.clue.description':
    'Choose a Clue export file from this device and preview what Floriva can safely keep.',
  'import.sources.flo.title': 'Flo JSON',
  'import.sources.flo.description':
    'Use the JSON export you requested from Flo, then review any skipped or unsupported rows before import.',
  'import.sources.manual.title': 'Manual history',
  'import.sources.manual.description':
    'Quickly seed the last 12 months of period starts when you do not have an export file ready yet.',
  'import.actions.chooseFile': 'Choose file',
  'import.actions.preview': 'Preview import',
  'import.actions.commit': 'Import reviewed rows',
  'import.actions.goToToday': 'Go to Today',
  'import.actions.goToCalendar': 'Go to Calendar',
  'import.status.previewTitle': 'Ready to import',
  'import.status.resultTitle': 'Logs imported',
  'import.status.resultSubtitle': 'Duplicates or rows skipped',
  'import.status.attentionTitle': 'Import needs attention',
  'import.errors.unsupportedMedia':
    'That looks like an image or media file. Choose a Clue or Flo export file to preview in Floriva.',
  'import.errors.jsonParse':
    'Floriva could not read that file as a JSON export. Choose a .json or .cluedata export file.',
  'import.errors.noValidHistory': "Floriva couldn't find any valid history to review in that import.",
  'import.errors.readFile': 'Unable to read that import file.',
  'import.errors.commit': "Floriva couldn't finish that import. Try again.",
  'import.errors.unsupportedShape':
    'Unsupported Flo import file shape: expected a top-level array or "data"/"values" array.',
  'import.labels.localDuplicatesSkipped': 'Local duplicates skipped',
  'import.labels.rowsSkipped': 'Rows skipped',
  'import.labels.logsImported': 'Logs imported',
  'import.labels.dateRangeNone': 'No valid dates found',
  'import.labels.selectedFilePrefix': 'Selected file:',
  'import.labels.selectedExportFile': 'Selected export file',
  'import.labels.manualDateInput': 'Period start dates',
  'import.labels.manualDateHelper':
    'Add one local period start date per line. Floriva only uses the last 12 months in this quick-entry path.',
  'import.labels.manualDateDisabledHelper':
    'Enter at least one period start date to review before importing.',
  'import.labels.noFileSelected': 'No file selected yet.',
  'import.labels.dateRangeTitle': 'Date range',
  'import.labels.adjustmentsTitle': 'What Floriva adjusted',
  'import.labels.skippedRowsTitle': 'Skipped rows',
};

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    if (!mockCurrentHarness) {
      throw new Error('ImportScreen test harness has not been initialized');
    }

    return {
      repositories: mockCurrentHarness.repositories,
    };
  },
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

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: (...args: unknown[]) => mockSetLocalePreference(...args),
    t: (key: string) => mockLocalizedStrings[key] ?? key,
  }),
}));

jest.mock('@/src/lib/diagnostics/logSensitiveRuntimeFailure', () => ({
  logSensitiveRuntimeFailure: (...args: unknown[]) => mockLogSensitiveRuntimeFailure(...args),
}));

// eslint-disable-next-line import/first
import {
  formatImportDateLabel,
  formatImportDateRange,
  getUnsupportedImportMessage,
  ImportScreen,
} from '@/src/features/import/screens/ImportScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('ImportScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockGetDocumentAsync.mockReset();
    mockReadAsStringAsync.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockLogSensitiveRuntimeFailure.mockReset();
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('previews and commits manual history without overwriting existing local dates', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-11',
      logDate: '2026-04-11',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing local history.',
    });

    render(<ImportScreen />);

    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Pick one source to preview before Floriva imports anything.')).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10\n2026-04-11\n2026-04-11',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Ready to import')).toBeTruthy();
    expect(screen.getByText('Local duplicates skipped')).toBeTruthy();
    expect(screen.getByText('Rows skipped')).toBeTruthy();
    expect(screen.getByText('April 9, 2026 to April 11, 2026')).toBeTruthy();
    expect(
      screen.getByText('Merged 2 manual period-history rows for 2026-04-11.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
    });

    expect(screen.getByText('Step 3')).toBeTruthy();
    expect(screen.getByText('Logs imported')).toBeTruthy();
    expect(screen.getByText('Duplicates or rows skipped')).toBeTruthy();
    expect(screen.getByTestId(testIds.import.resultTodayButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.import.resultCalendarButton)).toBeTruthy();
    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
  });

  it('shows a neutral date-format hint before any manual history is entered', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    expect(screen.getByPlaceholderText('YYYY-MM-DD')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('2026-04-09\n2026-03-11\n2026-02-12'),
    ).toBeNull();
  });

  it('uses localized step labels and source copy from the translation layer', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    const originalSourceStep = mockLocalizedStrings['import.screen.sourceStepLabel'];
    const originalPreviewStep = mockLocalizedStrings['import.screen.previewStepLabel'];
    const originalConfirmStep = mockLocalizedStrings['import.screen.confirmStepLabel'];
    const originalSourceDescription = mockLocalizedStrings['import.screen.sourcePickerDescription'];
    mockLocalizedStrings['import.screen.sourceStepLabel'] = 'Paso 1';
    mockLocalizedStrings['import.screen.previewStepLabel'] = 'Paso 2';
    mockLocalizedStrings['import.screen.confirmStepLabel'] = 'Paso 3';
    mockLocalizedStrings['import.screen.sourcePickerDescription'] =
      'Elige una fuente para revisar antes de importar.';

    render(<ImportScreen />);

    expect(screen.getByText('Paso 1')).toBeTruthy();
    expect(screen.getByText('Elige una fuente para revisar antes de importar.')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), '2026-04-09');
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByText('Paso 2')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByText('Paso 3')).toBeTruthy();
    });

    mockLocalizedStrings['import.screen.sourceStepLabel'] = originalSourceStep;
    mockLocalizedStrings['import.screen.previewStepLabel'] = originalPreviewStep;
    mockLocalizedStrings['import.screen.confirmStepLabel'] = originalConfirmStep;
    mockLocalizedStrings['import.screen.sourcePickerDescription'] = originalSourceDescription;
  });

  it('keeps the success state visible when reminder follow-up fails after commit', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockRefreshReminderSchedules.mockRejectedValue(new Error('notifications unavailable'));

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
      expect(screen.queryByText('Floriva could not finish this import. Try again in a moment.')).toBeNull();
      expect(mockLogSensitiveRuntimeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'import_follow_up_sync_failed',
          error: expect.any(Error),
        }),
      );
    });
  });

  it('does not render a contradictory success result when pending-route cleanup fails after commit', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockClearPendingEntryRoute.mockRejectedValue(new Error('route cleanup unavailable'));

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(
        screen.getByText("Floriva couldn't finish that import. Try again."),
      ).toBeTruthy();
      expect(screen.queryByTestId(testIds.import.resultCard)).toBeNull();
      expect(mockLogSensitiveRuntimeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'import_commit_failed',
          error: expect.any(Error),
        }),
      );
    });
    expect(mockRefreshReminderSchedules).not.toHaveBeenCalled();
  });

  it('can suppress the secondary result CTA for onboarding-specific import handoffs', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(
      <ImportScreen
        resultPrimaryHref="/paywall"
        resultPrimaryLabel="Continue to Floriva access"
        resultSecondaryHref={null}
      />,
    );

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
    });

    expect(screen.getByText('Continue to Floriva access')).toBeTruthy();
    expect(screen.queryByTestId(testIds.import.resultCalendarButton)).toBeNull();
  });

  it('loads a Clue .cluedata file, then shows duplicate and warning counts in preview', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-10',
      logDate: '2026-04-10',
      bleeding: 'medium',
      symptoms: [],
      notes: 'Existing local log.',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://clue-export.cluedata', name: 'clue-export.cluedata' }],
    });
    mockReadAsStringAsync.mockResolvedValue(
      JSON.stringify({
        data: [
          {
            day: '2026-04-08T06:00:00.000Z',
            flow: 'light',
            symptoms: ['cramps', 'not-a-symptom'],
          },
          {
            day: '2026-04-08T08:00:00.000Z',
            period: 'heavy',
            fatigue: true,
          },
          {
            day: '2026-04-10T09:00:00.000Z',
            period: 'medium',
          },
          {
            day: 'bad-date',
            flow: 'spotting',
          },
        ],
      }),
    );

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(mockGetDocumentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: [
            'application/json',
            'application/*+json',
            'text/json',
            'text/plain',
            'application/octet-stream',
            'image/*',
            'video/*',
            'audio/*',
          ],
          copyToCacheDirectory: true,
          multiple: false,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    expect(screen.getByText('Selected file: clue-export.cluedata')).toBeTruthy();
    expect(screen.getByText('Ready to import')).toBeTruthy();
    expect(screen.getByText('Local duplicates skipped')).toBeTruthy();
    expect(screen.getByText('Rows skipped')).toBeTruthy();
    expect(
      screen.getByText('Ignored 1 unsupported symptom value on row 1.'),
    ).toBeTruthy();
    expect(screen.getByText('Row 4 has an invalid date.')).toBeTruthy();
  });

  it('loads valid JSON exports even when the filename is odd or missing', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://mystery-export.bin', name: 'mystery-export.bin' }],
    });
    mockReadAsStringAsync.mockResolvedValue(
      JSON.stringify({
        data: [
          {
            day: '2026-04-08T06:00:00.000Z',
            flow: 'light',
          },
        ],
      }),
    );

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledWith('file://mystery-export.bin');
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    expect(screen.getByText('Selected file: mystery-export.bin')).toBeTruthy();
    expect(screen.getByText('Ready to import')).toBeTruthy();
  });

  it('keeps manual preview disabled until at least one date is entered', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    expect(screen.getByTestId(testIds.import.previewButton).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), '2026-04-09');

    expect(screen.getByTestId(testIds.import.previewButton).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('returns null for supported import mime types', () => {
    expect(
      getUnsupportedImportMessage('application/json', (key) => mockLocalizedStrings[key] ?? key),
    ).toBeNull();
  });

  it('falls back to the raw ISO date label when formatting receives an invalid date', () => {
    expect(formatImportDateLabel('not-a-date', 'en')).toBe('not-a-date');
  });

  it('falls back to the localized empty date-range label when preview data has no valid range', () => {
    expect(
      formatImportDateRange(null, 'en', (key) => mockLocalizedStrings[key] ?? key),
    ).toBe('No valid dates found');
  });

  it.each([
    ['en', 'April 12, 2026 to April 13, 2026'],
    ['es', '12 de abril de 2026 a 13 de abril de 2026'],
    ['de', '12. April 2026 bis 13. April 2026'],
    ['fr', '12 avril 2026 au 13 avril 2026'],
    ['ja', '2026年4月12日〜2026年4月13日'],
    ['zh-Hans', '2026年4月12日至2026年4月13日'],
    ['pt', '12 de abril de 2026 a 13 de abril de 2026'],
    ['ru', '12 апреля 2026 г. — 13 апреля 2026 г.'],
  ] as const)('formats import date ranges naturally for %s', (locale, expected) => {
    expect(
      formatImportDateRange(
        { startIso: '2026-04-12', endIso: '2026-04-13' },
        locale,
        (key) => mockLocalizedStrings[key] ?? key,
      ),
    ).toBe(expected);
  });

  it('shows an explicit error when a Flo export uses an unsupported future shape', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://flo-export.json', name: 'flo-export.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue(
      JSON.stringify({
        events: [],
      }),
    );

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceFlo));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(screen.getByText('Import needs attention')).toBeTruthy();
    });

    expect(
      screen.getByText(
        'Unsupported Flo import file shape: expected a top-level array or "data"/"values" array.',
      ),
    ).toBeTruthy();
  });

  it('shows a corrupted-file error when the chosen JSON cannot be parsed', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://broken.json', name: 'broken.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue('{not-json');

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(screen.getByText('Import needs attention')).toBeTruthy();
    });

    expect(
      screen.getByText(
        'Floriva could not read that file as a JSON export. Choose a .json or .cluedata export file.',
      ),
    ).toBeTruthy();
  });

  it('blocks obviously unsupported image files before attempting to parse them', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file://vacation-photo.jpg',
          name: 'vacation-photo.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(screen.getByText('Import needs attention')).toBeTruthy();
    });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'That looks like an image or media file. Choose a Clue or Flo export file to preview in Floriva.',
      ),
    ).toBeTruthy();
  });

  it('shows skipped-row review details for malformed manual dates', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), 'not-a-date');
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    expect(screen.queryByText('Import needs attention')).toBeNull();
    expect(screen.getByText('Row 1 has an invalid date.')).toBeTruthy();
    expect(screen.queryByTestId(testIds.import.commitButton)).toBeNull();
  });

  it('shows explicit onboarding escape hatches when setup sends the user into import next', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(
      <ImportScreen
        backHref="/setup-later"
        backLabel="Back to setup"
        skipHref="/today"
        skipLabel="Skip import for now"
      />,
    );

    fireEvent.press(screen.getByText('Back to setup'));
    expect(mockReplace).toHaveBeenCalledWith('/setup-later');

    fireEvent.press(screen.getByText('Skip import for now'));
    expect(mockReplace).toHaveBeenCalledWith('/today');
  });

  it('explains when manual dates are outside the 12-month quick-entry window', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2024-01-01, 2024-02-01',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.previewCard)).toBeTruthy();
    });

    expect(screen.queryByText('Import needs attention')).toBeNull();
    expect(
      screen.getByText("Row 1 is older than Floriva's 12-month manual import window."),
    ).toBeTruthy();
    expect(
      screen.getByText("Row 2 is older than Floriva's 12-month manual import window."),
    ).toBeTruthy();
    expect(screen.queryByTestId(testIds.import.commitButton)).toBeNull();
  });

  it('ignores cancelled file selection without opening preview state', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockGetDocumentAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(mockGetDocumentAsync).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId(testIds.import.previewCard)).toBeNull();
  });

  it('uses stack back navigation for the top-level back action when history exists', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockCanGoBack.mockReturnValue(true);

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('falls back to settings data when the top-level back action has no history to pop', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/settings/data');
    });
  });

  it('routes from the import result back to Today and Calendar', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.commitButton)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.resultCard)).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Go to Today'));
    fireEvent.press(screen.getByText('Go to Calendar'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/today');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/calendar');
  });

  it('shows a commit error when the reviewed import cannot be saved', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));
    fireEvent.changeText(
      screen.getByTestId(testIds.import.manualDatesInput),
      '2026-04-09\n2026-04-10',
    );
    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.import.commitButton)).toBeTruthy();
    });

    mockCurrentHarness.repositories.dailyLogs.saveEntryIfDateAbsent = jest
      .fn()
      .mockRejectedValue(new Error('save failed'));

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(screen.getByText('Import needs attention')).toBeTruthy();
      expect(mockLogSensitiveRuntimeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'import_commit_failed',
          error: expect.any(Error),
        }),
      );
    });

    expect(screen.getByText("Floriva couldn't finish that import. Try again.")).toBeTruthy();
  });

  it('shows a safe file-read error instead of raw device details', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://clue-export.json', name: 'clue-export.json' }],
    });
    mockReadAsStringAsync.mockRejectedValue(new Error('EACCES: permission denied, open /private/...'));

    render(<ImportScreen />);

    fireEvent.press(screen.getByTestId(testIds.import.sourceClue));
    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(screen.getByText('Import needs attention')).toBeTruthy();
      expect(mockLogSensitiveRuntimeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'import_file_read_failed',
          error: expect.any(Error),
        }),
      );
    });

    expect(screen.getByText('Unable to read that import file.')).toBeTruthy();
    expect(screen.queryByText(/EACCES/)).toBeNull();
  });
});
