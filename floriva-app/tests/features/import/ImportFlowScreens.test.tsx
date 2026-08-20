import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportPreviewEntry,
  SupportedLocale,
} from '@/src/types/domain';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockSelectSource = jest.fn();
const mockClearError = jest.fn();
const mockPreviewManualHistory = jest.fn();
const mockPreviewFileImport = jest.fn();
const mockCommitPreview = jest.fn();
const mockRemovePreviewEntry = jest.fn();
const mockSetStartPath = jest.fn();
const mockSetManualDatesInput = jest.fn();
const mockFormatImportDateRange = jest.fn(
  (dateRange: ImportPreview['dateRange'] | null) =>
    dateRange ? `${dateRange.startIso} to ${dateRange.endIso}` : 'No valid dates found',
);
let mockLocale: SupportedLocale = 'en';
const mockState = {
  pendingEntryRoute: undefined as string | undefined,
};
const mockImportFlowState = {
  errorMessage: null as string | null,
  isCommitting: false,
  manualDatesInput: '',
  preview: null as ImportPreview | null,
  result: null as ImportCommitResult | null,
  selectedFileLabel: null as string | null,
  selectedSource: null as 'clue' | 'flo' | 'manual' | null,
};

function createPreviewEntry(logDate = '2026-04-09'): ImportPreviewEntry {
  return {
    logDate,
    bleeding: 'medium',
    symptoms: [],
  };
}

function createImportPreview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return {
    source: 'manual',
    dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    importableEntries: [createPreviewEntry()],
    duplicateLocalDates: [],
    skippedRows: [],
    warnings: [],
    ...overrides,
  };
}

function createImportResult(overrides: Partial<ImportCommitResult> = {}): ImportCommitResult {
  return {
    importSessionId: 'import-session-test',
    source: 'manual',
    dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    importedLogCount: 1,
    skippedLogCount: 0,
    ...overrides,
  };
}

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');

    return <Text>{`redirect:${href}`}</Text>;
  },
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    state: mockState,
  }),
}));

jest.mock('@/src/features/import/ImportFlowProvider', () => ({
  useImportFlow: () => ({
    clearError: (...args: unknown[]) => mockClearError(...args),
    commitPreview: (...args: unknown[]) => mockCommitPreview(...args),
    errorMessage: mockImportFlowState.errorMessage,
    isCommitting: mockImportFlowState.isCommitting,
    manualDatesInput: mockImportFlowState.manualDatesInput,
    preview: mockImportFlowState.preview,
    previewFileImport: (...args: unknown[]) => mockPreviewFileImport(...args),
    previewManualHistory: (...args: unknown[]) => mockPreviewManualHistory(...args),
    removePreviewEntry: (...args: unknown[]) => mockRemovePreviewEntry(...args),
    result: mockImportFlowState.result,
    selectedFileLabel: mockImportFlowState.selectedFileLabel,
    selectedSource: mockImportFlowState.selectedSource,
    selectSource: (...args: unknown[]) => mockSelectSource(...args),
    setManualDatesInput: (...args: unknown[]) => mockSetManualDatesInput(...args),
  }),
}));

jest.mock('@/src/features/onboarding/OnboardingProvider', () => ({
  useOptionalOnboarding: () => ({
    setStartPath: (...args: unknown[]) => mockSetStartPath(...args),
  }),
}));

jest.mock('@/src/features/import/screens/ImportScreen', () => ({
  formatImportDateRange: (dateRange: ImportPreview['dateRange'] | null) =>
    mockFormatImportDateRange(dateRange),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(mockLocale),
  };
});

// eslint-disable-next-line import/first
import {
  ImportChooseSourceScreen,
  ImportCompleteStepScreen,
  ImportReviewStepScreen,
  ImportSourceStepScreen,
} from '@/src/features/import/screens/ImportFlowScreens';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('Import flow screens', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockSelectSource.mockReset();
    mockClearError.mockReset();
    mockPreviewManualHistory.mockReset();
    mockPreviewFileImport.mockReset();
    mockCommitPreview.mockReset();
    mockRemovePreviewEntry.mockReset();
    mockSetStartPath.mockReset();
    mockSetManualDatesInput.mockReset();
    mockFormatImportDateRange.mockClear();
    mockLocale = 'en';
    mockCanGoBack.mockReturnValue(false);
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
    mockPreviewManualHistory.mockResolvedValue(false);
    mockPreviewFileImport.mockResolvedValue(false);
    mockCommitPreview.mockResolvedValue(false);
    mockState.pendingEntryRoute = undefined;
    mockImportFlowState.errorMessage = null;
    mockImportFlowState.isCommitting = false;
    mockImportFlowState.manualDatesInput = '';
    mockImportFlowState.preview = null;
    mockImportFlowState.result = null;
    mockImportFlowState.selectedFileLabel = null;
    mockImportFlowState.selectedSource = null;
  });

  it('returns app import launches from a pending entry route to Today when there is no back stack', async () => {
    mockState.pendingEntryRoute = '/import';

    render(<ImportChooseSourceScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('returns settings-launched app imports to data controls when there is no back stack', async () => {
    render(<ImportChooseSourceScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/settings/data');
    });
  });

  it('uses the navigation stack when the app import screen can go back', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<ImportChooseSourceScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalledWith('/settings/data');
    });
  });

  it('turns onboarding skip into the fresh path instead of looping back into import', () => {
    render(<ImportChooseSourceScreen variant="onboarding" />);

    fireEvent.press(screen.getByTestId(testIds.import.skipButton));

    expect(mockSetStartPath).toHaveBeenCalledWith('fresh');
    expect(mockReplace).toHaveBeenCalledWith('/last-period-start');
  });

  it('routes onboarding back to the path choice screen', () => {
    render(<ImportChooseSourceScreen variant="onboarding" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    expect(mockReplace).toHaveBeenCalledWith('/start-path');
  });

  it('opens the selected app import source route from the choose-source screen', () => {
    render(<ImportChooseSourceScreen variant="app" />);

    expect(screen.getByText(/Bring your history /)).toBeTruthy();
    // UL-32: the most sensitive flow carries the local-only reassurance
    // (this inverts a 2026-04 density-pass assertion — the UI-lift audit
    // flagged the missing privacy line on exactly this screen).
    expect(
      screen.getByText(
        'Imports only open the file you choose. Floriva does not scan your storage or upload that file.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.import.sourceManual));

    expect(mockSelectSource).toHaveBeenCalledWith('manual');
    expect(mockPush).toHaveBeenCalledWith('/(app)/import/source/manual');
  });

  it('shows an attention card when the flow has an import error', () => {
    mockImportFlowState.errorMessage = 'Could not prepare that import.';

    render(<ImportChooseSourceScreen variant="app" />);

    expect(screen.getByTestId(testIds.import.errorCard)).toBeTruthy();
    expect(screen.getByText('Could not prepare that import.')).toBeTruthy();
  });

  it('redirects unknown source routes back to the import root', () => {
    render(<ImportSourceStepScreen source="unknown" variant="app" />);

    expect(screen.getByText('redirect:/(app)/import')).toBeTruthy();
  });

  it('clears the current source error when backing out of a source step', () => {
    mockImportFlowState.selectedSource = 'manual';

    render(<ImportSourceStepScreen source="manual" variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(app)/import');
  });

  it('routes source-step previews into the routed review step', async () => {
    mockImportFlowState.selectedSource = 'manual';
    mockImportFlowState.manualDatesInput = '2026-04-09';
    mockPreviewManualHistory.mockResolvedValue(true);

    render(<ImportSourceStepScreen source="manual" variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.previewButton));

    await waitFor(() => {
      expect(mockPreviewManualHistory).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/(app)/import/review');
    });
  });

  it('updates manual date input as the user types', () => {
    mockImportFlowState.selectedSource = 'manual';

    render(<ImportSourceStepScreen source="manual" variant="app" />);

    fireEvent.changeText(screen.getByTestId(testIds.import.manualDatesInput), '2026-04-09');

    expect(mockSetManualDatesInput).toHaveBeenCalledWith('2026-04-09');
  });

  it('uses a format hint instead of misleading sample dates when manual history is empty', () => {
    mockImportFlowState.selectedSource = 'manual';

    render(<ImportSourceStepScreen source="manual" variant="app" />);

    expect(screen.getByPlaceholderText('YYYY-MM-DD')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('2026-04-09\n2026-03-11\n2026-02-12'),
    ).toBeNull();
    expect(screen.getByTestId(testIds.import.previewButton).props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('routes file-based previews into review when the export parses cleanly', async () => {
    mockImportFlowState.selectedSource = 'clue';
    mockPreviewFileImport.mockResolvedValue(true);

    render(<ImportSourceStepScreen source="clue" variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.chooseFileButton));

    await waitFor(() => {
      expect(mockPreviewFileImport).toHaveBeenCalledWith('clue');
      expect(mockPush).toHaveBeenCalledWith('/(app)/import/review');
    });
  });

  it('shows the chosen file label for file-based sources', () => {
    mockImportFlowState.selectedSource = 'flo';
    mockImportFlowState.selectedFileLabel = 'flo-export.json';

    render(<ImportSourceStepScreen source="flo" variant="app" />);

    expect(screen.getByText('Selected file: flo-export.json')).toBeTruthy();
  });

  it('keeps the source step focused on one action instead of repeating the source title inside the content card', () => {
    mockImportFlowState.selectedSource = 'manual';

    render(<ImportSourceStepScreen source="manual" variant="app" />);

    expect(screen.queryAllByText('Manual history')).toHaveLength(1);
  });

  it('routes committed reviews into the routed completion step', async () => {
    mockImportFlowState.selectedSource = 'manual';
    mockImportFlowState.preview = createImportPreview();
    mockCommitPreview.mockResolvedValue(true);

    render(<ImportReviewStepScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.commitButton));

    await waitFor(() => {
      expect(mockCommitPreview).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(app)/import/complete');
    });
  });

  it('redirects review routes without a selected source back to the import root', () => {
    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByText('redirect:/(app)/import')).toBeTruthy();
  });

  it('redirects review routes without a prepared preview back to the source step', () => {
    mockImportFlowState.selectedSource = 'manual';

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByText('redirect:/(app)/import/source/manual')).toBeTruthy();
  });

  it('returns review back actions to the selected source step', () => {
    mockImportFlowState.selectedSource = 'manual';
    mockImportFlowState.preview = createImportPreview();

    render(<ImportReviewStepScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.backButton));

    expect(mockReplace).toHaveBeenCalledWith('/(app)/import/source/manual');
  });

  it('renders filtered warnings and skipped rows on the review screen', () => {
    mockImportFlowState.selectedSource = 'manual';
    mockImportFlowState.preview = createImportPreview({
      skippedRows: [{ rowNumber: 4, reason: 'invalid', message: 'Skipped duplicate row' }],
      warnings: ['Adjusted one date', '   '],
    });

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.queryAllByText(/Review before /).length).toBeGreaterThan(0);
    expect(screen.getByText('Floriva adjusted some rows in this import before review.')).toBeTruthy();
    expect(screen.getByText('Row 4 has a date or value Floriva could not read.')).toBeTruthy();
    expect(screen.queryByText('Adjusted one date')).toBeNull();
    expect(screen.queryByText('Skipped duplicate row')).toBeNull();
  });

  it('renders reviewed rows and lets users exclude one before commit', () => {
    mockLocale = 'es';
    mockImportFlowState.selectedSource = 'manual';
    mockImportFlowState.preview = createImportPreview({
      importableEntries: [
        createPreviewEntry('2026-04-09'),
        {
          logDate: '2026-04-10',
          bleeding: 'light',
          symptoms: ['cramps'],
        },
      ],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-10' },
    });

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByTestId(testIds.import.previewEntry('2026-04-09'))).toBeTruthy();
    expect(screen.getByTestId(testIds.import.previewEntry('2026-04-10'))).toBeTruthy();
    expect(screen.getByText('Sangrado: Moderado. Síntomas: 0.')).toBeTruthy();
    expect(screen.getByText('Sangrado: Ligero. Síntomas: 1.')).toBeTruthy();
    expect(screen.queryByText(/medium|light/)).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.import.removePreviewEntry('2026-04-10')));

    expect(mockRemovePreviewEntry).toHaveBeenCalledWith('2026-04-10');
  });

  it('renders review metadata, duplicate dates, and manual recovery when only duplicates remain', () => {
    mockImportFlowState.selectedSource = 'clue';
    mockImportFlowState.preview = createImportPreview({
      source: 'clue',
      confidence: {
        label: 'medium',
        reasons: [
          { kind: 'no-reviewed-days-ready', count: 0 },
          { kind: 'duplicate-dates-skipped', count: 2 },
        ],
      },
      duplicateSummary: {
        count: 2,
        details: [
          { action: 'skipped', logDate: '2026-04-09', existingEntryId: 'local-1' },
          { action: 'skipped', logDate: '2026-04-10', existingEntryId: 'local-2' },
        ],
      },
      editedEntryCount: 0,
      importableEntries: [],
      duplicateLocalDates: ['2026-04-09', '2026-04-10'],
      skippedRows: [],
      skippedSummary: {
        totalCount: 0,
        invalidCount: 0,
        unsupportedCount: 0,
        messages: [],
      },
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-10' },
    });

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByTestId(testIds.import.reviewMetrics)).toBeTruthy();
    expect(screen.getByTestId(testIds.import.confidenceSummary)).toBeTruthy();
    expect(screen.getByText('Medium confidence')).toBeTruthy();
    expect(screen.getByText('Duplicate dates skipped: 2')).toBeTruthy();
    expect(screen.getByTestId(testIds.import.duplicateSummary)).toBeTruthy();
    expect(screen.getByTestId(testIds.import.duplicateDate('2026-04-09'))).toBeTruthy();
    expect(screen.getByTestId(testIds.import.duplicateDate('2026-04-10'))).toBeTruthy();
    expect(screen.queryByTestId(testIds.import.commitButton)).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.import.manualFallbackButton));

    expect(mockSelectSource).toHaveBeenCalledWith('manual');
    expect(mockReplace).toHaveBeenCalledWith('/(app)/import/source/manual');
  });

  it('keeps manual recovery available when a file has partial import issues', () => {
    mockImportFlowState.selectedSource = 'flo';
    mockImportFlowState.preview = createImportPreview({
      source: 'flo',
      confidence: {
        label: 'medium',
        reasons: [
          { kind: 'reviewed-days-ready', count: 1 },
          { kind: 'rows-skipped', count: 2 },
        ],
      },
      duplicateSummary: {
        count: 0,
        details: [],
      },
      editedEntryCount: 0,
      importableEntries: [
        createPreviewEntry(),
      ],
      duplicateLocalDates: [],
      skippedRows: [
        { rowNumber: 5, reason: 'unsupported', message: 'Row 5 was unsupported.' },
        { rowNumber: 6, reason: 'invalid', message: 'Row 6 had an invalid date.' },
      ],
      skippedSummary: {
        totalCount: 2,
        invalidCount: 1,
        unsupportedCount: 1,
        messages: ['Row 5 was unsupported.', 'Row 6 had an invalid date.'],
      },
      warnings: ['Some rows need review.'],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-10' },
    });

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByTestId(testIds.import.commitButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.import.manualFallbackButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.import.skippedSummary)).toBeTruthy();
    expect(screen.getByText('Unsupported')).toBeTruthy();
    expect(screen.getByText('Invalid')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.import.manualFallbackButton));

    expect(mockSelectSource).toHaveBeenCalledWith('manual');
    expect(mockReplace).toHaveBeenCalledWith('/(app)/import/source/manual');
  });

  it('localizes review confidence and recovery copy outside English', () => {
    mockLocale = 'es';
    mockImportFlowState.selectedSource = 'clue';
    mockImportFlowState.preview = createImportPreview({
      source: 'clue',
      confidence: {
        label: 'low',
        reasons: [
          { kind: 'no-reviewed-days-ready', count: 0 },
          { kind: 'duplicate-dates-skipped', count: 1 },
        ],
      },
      duplicateSummary: {
        count: 1,
        details: [{ action: 'skipped', logDate: '2026-04-09', existingEntryId: 'local-1' }],
      },
      editedEntryCount: 0,
      importableEntries: [],
      duplicateLocalDates: ['2026-04-09'],
      skippedRows: [],
      skippedSummary: {
        totalCount: 0,
        invalidCount: 0,
        unsupportedCount: 0,
        messages: [],
      },
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    });

    render(<ImportReviewStepScreen variant="app" />);

    expect(screen.getByText('Confianza baja')).toBeTruthy();
    expect(screen.getByText('Fechas duplicadas omitidas: 1')).toBeTruthy();
    expect(screen.getByText('Usar historial manual')).toBeTruthy();
    expect(screen.queryByText('Low confidence')).toBeNull();
    expect(screen.queryByText('Use manual history')).toBeNull();
  });

  it('routes file-source error recovery to manual history', () => {
    mockImportFlowState.selectedSource = 'flo';
    mockImportFlowState.errorMessage = 'Floriva could not read that file.';

    render(<ImportSourceStepScreen source="flo" variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.manualFallbackButton));

    expect(mockSelectSource).toHaveBeenCalledWith('manual');
    expect(mockReplace).toHaveBeenCalledWith('/(app)/import/source/manual');
  });

  it('keeps the completion screen wired to focused app destinations', () => {
    mockImportFlowState.result = createImportResult({
      importedLogCount: 3,
      skippedLogCount: 1,
      duplicateSkippedLogCount: 1,
      skippedRowCount: 0,
      unsupportedSkippedRowCount: 0,
      invalidSkippedRowCount: 0,
      editedEntryCount: 0,
    });

    render(<ImportCompleteStepScreen variant="app" />);

    fireEvent.press(screen.getByTestId(testIds.import.resultTodayButton));
    fireEvent.press(screen.getByTestId(testIds.import.resultCalendarButton));

    expect(mockReplace).toHaveBeenCalledWith('/today');
    expect(mockReplace).toHaveBeenCalledWith('/calendar');
  });

  it('redirects complete routes without a result back to the import root', () => {
    render(<ImportCompleteStepScreen variant="app" />);

    expect(screen.getByText('redirect:/(app)/import')).toBeTruthy();
  });

  it('finishes onboarding imports by continuing to paywall instead of app destinations', () => {
    mockImportFlowState.result = createImportResult({
      importedLogCount: 2,
      skippedLogCount: 0,
      duplicateSkippedLogCount: 0,
      skippedRowCount: 0,
      unsupportedSkippedRowCount: 0,
      invalidSkippedRowCount: 0,
      editedEntryCount: 0,
    });

    render(<ImportCompleteStepScreen variant="onboarding" />);

    fireEvent.press(screen.getByTestId(testIds.import.resultTodayButton));

    expect(mockReplace).toHaveBeenCalledWith('/notifications');
    expect(screen.queryByTestId(testIds.import.resultCalendarButton)).toBeNull();
  });

  it('renders completion summary source, date range, skipped breakdown, and edited count when present', () => {
    mockImportFlowState.result = createImportResult({
      source: 'flo',
      dateRange: {
        startIso: '2026-04-01',
        endIso: '2026-04-30',
      },
      importedLogCount: 7,
      skippedLogCount: 4,
      duplicateSkippedLogCount: 2,
      skippedRowCount: 2,
      unsupportedSkippedRowCount: 1,
      invalidSkippedRowCount: 1,
      editedEntryCount: 1,
    });

    render(<ImportCompleteStepScreen variant="app" />);

    expect(screen.getByTestId(testIds.import.resultSummary)).toBeTruthy();
    expect(screen.getByText('Flo JSON')).toBeTruthy();
    expect(screen.getByText('2026-04-01 to 2026-04-30')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });
});
