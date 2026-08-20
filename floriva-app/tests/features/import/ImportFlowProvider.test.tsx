import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { DevLaunchPreset } from '@/src/types/domain';

const mockClearPendingEntryRoute = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockPreviewImport = jest.fn();
const mockCommitImport = jest.fn();
const mockDocumentPicker = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockResolveDevLaunchPreset = jest.fn<DevLaunchPreset | null, []>(() => null);
const mockAttemptAutomaticReviewPrompt = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      dailyLogs: {},
    },
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    privacyPreference: {
      diagnosticsConsentEnabled: false,
    },
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
  }),
}));

jest.mock('@/src/features/import/model', () => ({
  ...jest.requireActual('@/src/features/import/model'),
  createImportWorkflow: () => ({
    previewImport: (...args: unknown[]) => mockPreviewImport(...args),
    commitImport: (...args: unknown[]) => mockCommitImport(...args),
  }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockDocumentPicker(...args),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/src/testing/devLaunchPreset', () => ({
  resolveDevLaunchPreset: () => mockResolveDevLaunchPreset(),
}));

jest.mock('@/src/features/review/automaticReview', () => ({
  attemptAutomaticReviewPrompt: (...args: unknown[]) => mockAttemptAutomaticReviewPrompt(...args),
}));

// eslint-disable-next-line import/first
import {
  ImportFlowProvider,
  useImportFlow,
} from '@/src/features/import/ImportFlowProvider';
// eslint-disable-next-line import/first
import { getLocalTodayLogDate } from '@/src/features/logging/date';
// eslint-disable-next-line import/first
import { createImportReadyPreview } from '@/src/testing/qaFixtures';

describe('ImportFlowProvider', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockClearPendingEntryRoute.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockPreviewImport.mockReset();
    mockCommitImport.mockReset();
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockPreviewImport.mockResolvedValue({
      importableEntries: [{ logDate: '2026-04-09' }],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    });
    mockCommitImport.mockResolvedValue({
      importedLogCount: 1,
      skippedLogCount: 0,
    });
    mockDocumentPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://fixture.json', name: 'fixture.json', mimeType: 'application/json' }],
    });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify({ data: [] }));
    mockResolveDevLaunchPreset.mockReset();
    mockResolveDevLaunchPreset.mockReturnValue(null);
    mockAttemptAutomaticReviewPrompt.mockReset();
    mockAttemptAutomaticReviewPrompt.mockResolvedValue({ requested: false, reason: 'noop' });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('refreshes reminder schedules after committing a routed import preview', async () => {
    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await waitFor(() => {
      expect(result.current.preview?.importableEntries).toHaveLength(1);
    });

    await act(async () => {
      const committed = await result.current.commitPreview();

      expect(committed).toBe(true);
    });

    expect(mockCommitImport).toHaveBeenCalledTimes(1);
    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
    expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.result?.importedLogCount).toBe(1);
    });
  });

  it('checks automatic review eligibility after a successful import commit', async () => {
    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      expect(await result.current.commitPreview()).toBe(true);
    });

    await waitFor(() => {
      expect(mockAttemptAutomaticReviewPrompt).toHaveBeenCalledTimes(1);
    });
  });

  it('does not check review eligibility when an import commit fails', async () => {
    mockCommitImport.mockRejectedValue(new Error('commit exploded'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      expect(await result.current.commitPreview()).toBe(false);
    });

    expect(mockAttemptAutomaticReviewPrompt).not.toHaveBeenCalled();
  });

  it('keeps the committed result visible when reminder follow-up fails after import persistence succeeds', async () => {
    mockRefreshReminderSchedules.mockRejectedValue(new Error('notifications unavailable'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      const committed = await result.current.commitPreview();

      expect(committed).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.result?.importedLogCount).toBe(1);
      expect(result.current.errorMessage).toBeNull();
    });
    expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
  });

  it('does not keep a success result visible when pending-route cleanup fails after commit', async () => {
    mockClearPendingEntryRoute.mockRejectedValue(new Error('cleanup unavailable'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      expect(await result.current.commitPreview()).toBe(false);
    });

    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBe('import.errors.commit');
    expect(mockRefreshReminderSchedules).not.toHaveBeenCalled();
  });

  it('clears stale preview state when switching sources', async () => {
    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    expect(result.current.preview?.importableEntries).toHaveLength(1);

    act(() => {
      result.current.selectSource('flo');
    });

    expect(result.current.selectedSource).toBe('flo');
    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.selectedFileLabel).toBeNull();
  });

  it('reports when a preview contains no importable or duplicate history', async () => {
    mockPreviewImport.mockResolvedValue({
      importableEntries: [],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: null,
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      expect(await result.current.previewManualHistory()).toBe(false);
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBe('import.errors.noValidHistory');
  });

  it('keeps a skipped-only preview available for review recovery', async () => {
    mockPreviewImport.mockResolvedValue({
      confidence: {
        label: 'low',
        reasons: [
          { kind: 'no-reviewed-days-ready', count: 0 },
          { kind: 'rows-skipped', count: 2 },
        ],
      },
      duplicateSummary: {
        count: 0,
        details: [],
      },
      editedEntryCount: 0,
      importableEntries: [],
      duplicateLocalDates: [],
      skippedRows: [
        { rowNumber: 1, reason: 'unsupported', message: 'Raw unsupported row message.' },
        { rowNumber: 2, reason: 'invalid', message: 'Raw invalid row message.' },
      ],
      skippedSummary: {
        totalCount: 2,
        invalidCount: 1,
        unsupportedCount: 1,
        messages: ['Raw unsupported row message.', 'Raw invalid row message.'],
      },
      warnings: [],
      dateRange: null,
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('not-a-date');
      expect(await result.current.previewManualHistory()).toBe(true);
    });

    expect(result.current.preview?.skippedSummary?.totalCount).toBe(2);
    expect(result.current.errorMessage).toBeNull();
  });

  it('keeps a duplicate-only preview available for review recovery', async () => {
    mockPreviewImport.mockResolvedValue({
      confidence: {
        label: 'medium',
        reasons: [{ kind: 'no-reviewed-days-ready', count: 0 }],
      },
      duplicateSummary: {
        count: 1,
        details: [{ action: 'skipped', logDate: '2026-04-09' }],
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

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      expect(await result.current.previewManualHistory()).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toEqual([]);
    expect(result.current.preview?.duplicateLocalDates).toEqual(['2026-04-09']);
    expect(result.current.errorMessage).toBeNull();
  });

  it('removes a reviewed preview row before commit and records the edit', async () => {
    mockPreviewImport.mockResolvedValue({
      importableEntries: [
        { logDate: '2026-04-09', bleeding: 'medium', symptoms: [] },
        { logDate: '2026-04-10', bleeding: 'light', symptoms: ['cramps'] },
      ],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-10' },
      editedEntryCount: 0,
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09\n2026-04-10');
      await result.current.previewManualHistory();
    });

    act(() => {
      result.current.removePreviewEntry('2026-04-10');
    });

    expect(result.current.preview?.importableEntries).toEqual([
      { logDate: '2026-04-09', bleeding: 'medium', symptoms: [] },
    ]);
    expect(result.current.preview?.dateRange).toEqual({
      startIso: '2026-04-09',
      endIso: '2026-04-09',
    });
    expect(result.current.preview?.confidence).toEqual({
      label: 'high',
      reasons: [{ kind: 'reviewed-days-ready', count: 1 }],
    });
    expect(result.current.preview?.editedEntryCount).toBe(1);
  });


  it('surfaces preview preparation errors from the workflow', async () => {
    mockPreviewImport.mockRejectedValue(new Error('Preview exploded'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      expect(await result.current.previewManualHistory()).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.noValidHistory');
    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('clears errors on demand', async () => {
    mockPreviewImport.mockRejectedValue(new Error('Preview exploded'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.errorMessage).toBeNull();
  });

  it('returns false when file selection is canceled', async () => {
    mockDocumentPicker.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(result.current.selectedSource).toBe('clue');
  });

  it('keeps the current preview state intact when file selection is canceled', async () => {
    mockDocumentPicker.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    const previewBeforeCancel = result.current.preview;

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.preview).toEqual(previewBeforeCancel);
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it('rejects unsupported media imports before reading the file', async () => {
    mockDocumentPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.png', name: 'photo.png', mimeType: 'image/png' }],
    });

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      expect(await result.current.previewFileImport('flo')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.unsupportedMedia');
    expect(result.current.selectedFileLabel).toBe('photo.png');
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('reports JSON parse failures for selected import files', async () => {
    mockReadAsStringAsync.mockResolvedValue('{broken');

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
    expect(result.current.selectedFileLabel).toBe('fixture.json');
  });

  it('reports file read failures with the shared localized message', async () => {
    mockReadAsStringAsync.mockRejectedValue(new Error('disk read failed'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.readFile');
    expect(result.current.selectedFileLabel).toBeNull();
    expect(result.current.preview).toBeNull();
  });

  it('returns false when no preview has been prepared yet', async () => {
    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      expect(await result.current.commitPreview()).toBe(false);
    });

    expect(mockCommitImport).not.toHaveBeenCalled();
  });

  it('ignores a second commit request while the first import is still saving', async () => {
    let resolveCommit: ((value: { importedLogCount: number; skippedLogCount: number }) => void) | null =
      null;
    mockCommitImport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommit = resolve;
        }),
    );

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    let firstCommit: Promise<boolean>;
    let secondCommit: Promise<boolean>;

    await act(async () => {
      firstCommit = result.current.commitPreview();
      secondCommit = result.current.commitPreview();
    });

    expect(result.current.isCommitting).toBe(true);
    expect(mockCommitImport).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommit?.({ importedLogCount: 1, skippedLogCount: 0 });
      await firstCommit;
      await secondCommit;
    });

    await expect(firstCommit!).resolves.toBe(true);
    await expect(secondCommit!).resolves.toBe(false);
    expect(result.current.isCommitting).toBe(false);
  });

  it('surfaces commit failures with the localized commit error message', async () => {
    mockCommitImport.mockRejectedValue(new Error('commit exploded'));

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      expect(await result.current.commitPreview()).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.commit');
    expect(result.current.result).toBeNull();
  });

  it('requires the provider context when using the hook', () => {
    expect(() => renderHook(() => useImportFlow())).toThrow(
      'useImportFlow must be used within an ImportFlowProvider',
    );
  });

  it('hydrates a seeded import review preview for the import-ready dev preset', () => {
    mockResolveDevLaunchPreset.mockReturnValue('import-ready');

    const { result } = renderHook(() => useImportFlow(), {
      wrapper: ImportFlowProvider,
    });

    // RJ-2: the import-ready preview is seeded today-anchored (like the tenure
    // presets), so derive the expected first log date from the same builder
    // instead of a hardcoded 2026-04 date.
    const expectedFirstLogDate =
      createImportReadyPreview(getLocalTodayLogDate()).importableEntries[0]?.logDate;

    expect(result.current.selectedSource).toBe('clue');
    expect(result.current.selectedFileLabel).toBe('clue-export-fixture.json');
    expect(result.current.preview).toEqual(
      expect.objectContaining({
        source: 'clue',
        importableEntries: expect.arrayContaining([
          expect.objectContaining({
            logDate: expectedFirstLogDate,
          }),
        ]),
      }),
    );
    expect(mockPreviewImport).not.toHaveBeenCalled();
  });
});
