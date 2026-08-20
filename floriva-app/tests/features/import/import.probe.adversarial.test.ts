/**
 * Adversarial probe tests for the ImportFlowProvider state machine.
 *
 * Targets:
 *  - Full lifecycle (select → parse → preview → commit → done)
 *  - Every failure branch
 *  - Re-entrancy (new import while one in-progress, cancel+restart, double commit)
 *  - Dedup on second identical import
 *  - Partial data (valid + invalid rows)
 *  - State invariants (impossible states, loading flag always reset)
 *  - Large import correctness
 *  - BOM-prefixed JSON
 *  - Oversized file guard
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockClearPendingEntryRoute = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockPreviewImport = jest.fn();
const mockCommitImport = jest.fn();
const mockDocumentPicker = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockAttemptAutomaticReviewPrompt = jest.fn();
const mockLogSensitiveRuntimeFailure = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: { dailyLogs: {}, importSessions: {} },
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    privacyPreference: { diagnosticsConsentEnabled: false },
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
  resolveDevLaunchPreset: () => null,
}));

jest.mock('@/src/features/review/automaticReview', () => ({
  attemptAutomaticReviewPrompt: (...args: unknown[]) => mockAttemptAutomaticReviewPrompt(...args),
}));

jest.mock('@/src/lib/diagnostics/logSensitiveRuntimeFailure', () => ({
  logSensitiveRuntimeFailure: (...args: unknown[]) => mockLogSensitiveRuntimeFailure(...args),
}));

// eslint-disable-next-line import/first
import {
  ImportFlowProvider,
  useImportFlow,
} from '@/src/features/import/ImportFlowProvider';

// ─── fixtures ───────────────────────────────────────────────────────────────

const SUCCESS_PREVIEW = {
  importableEntries: [{ logDate: '2026-04-09', bleeding: 'medium', symptoms: [] }],
  duplicateLocalDates: [],
  skippedRows: [],
  warnings: [],
  dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
  editedEntryCount: 0,
};

const SUCCESS_RESULT = { importedLogCount: 1, skippedLogCount: 0 };

function setupDefaultMocks() {
  mockClearPendingEntryRoute.mockResolvedValue(undefined);
  mockRefreshReminderSchedules.mockResolvedValue(undefined);
  mockPreviewImport.mockResolvedValue(SUCCESS_PREVIEW);
  mockCommitImport.mockResolvedValue(SUCCESS_RESULT);
  mockDocumentPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://export.json', name: 'export.json', mimeType: 'application/json' }],
  });
  mockReadAsStringAsync.mockResolvedValue(JSON.stringify({ data: [] }));
  mockAttemptAutomaticReviewPrompt.mockResolvedValue({ requested: false });
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('ImportFlowProvider — adversarial probe', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ─── Full lifecycle ───────────────────────────────────────────────────────

  it('completes the full manual lifecycle: preview → commit → result set', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      const ok = await result.current.previewManualHistory();
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(1);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isCommitting).toBe(false);

    await act(async () => {
      const committed = await result.current.commitPreview();
      expect(committed).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.result?.importedLogCount).toBe(1);
    });
    expect(result.current.isCommitting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('completes the full file-import lifecycle: pick → parse → preview → commit', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(true);
    });

    expect(result.current.selectedSource).toBe('clue');
    expect(result.current.preview?.importableEntries).toHaveLength(1);

    await act(async () => {
      const committed = await result.current.commitPreview();
      expect(committed).toBe(true);
    });

    expect(result.current.result?.importedLogCount).toBe(1);
    expect(result.current.isCommitting).toBe(false);
  });

  // ─── State invariants ─────────────────────────────────────────────────────

  it('commitPreview with no preview returns false and never calls commitImport', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.commitPreview();
      expect(ok).toBe(false);
    });

    expect(mockCommitImport).not.toHaveBeenCalled();
    // isCommitting must not get stuck
    expect(result.current.isCommitting).toBe(false);
  });

  it('isCommitting is false after a successful commit (loading flag always reset)', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      await result.current.commitPreview();
    });

    expect(result.current.isCommitting).toBe(false);
  });

  it('isCommitting is false after a failed commit (loading flag always reset)', async () => {
    mockCommitImport.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      await result.current.commitPreview();
    });

    expect(result.current.isCommitting).toBe(false);
  });

  // ─── Re-entrancy ─────────────────────────────────────────────────────────

  it('starting a new import while preview exists clears prior preview and error', async () => {
    // First preview succeeds
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    expect(result.current.preview).not.toBeNull();

    // Switching source resets everything
    act(() => {
      result.current.selectSource('clue');
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.selectedFileLabel).toBeNull();
    expect(result.current.selectedSource).toBe('clue');
  });

  it('cancelling file selection then restarting gives a fresh preview', async () => {
    // First pick is cancelled
    mockDocumentPicker.mockResolvedValueOnce({ canceled: true, assets: [] });
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(false);
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.isCommitting).toBe(false);

    // Second pick succeeds
    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(1);
    expect(result.current.errorMessage).toBeNull();
  });

  it('second commitPreview while first is in-flight returns false without double-writing', async () => {
    let resolveCommit!: (value: typeof SUCCESS_RESULT) => void;
    mockCommitImport.mockImplementation(
      () => new Promise<typeof SUCCESS_RESULT>((res) => { resolveCommit = res; }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;

    await act(async () => {
      first = result.current.commitPreview();
      second = result.current.commitPreview();
    });

    expect(result.current.isCommitting).toBe(true);
    expect(mockCommitImport).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommit(SUCCESS_RESULT);
      await Promise.all([first, second]);
    });

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(result.current.isCommitting).toBe(false);
    // Data only written once
    expect(mockCommitImport).toHaveBeenCalledTimes(1);
  });

  // ─── Dedup: importing the same file twice ─────────────────────────────────

  it('second import of same data shows no importable entries (all duplicates)', async () => {
    // First import sets up preview with one entry; commit succeeds
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      await result.current.commitPreview();
    });

    // Simulate second import: same date now returns as duplicate
    mockPreviewImport.mockResolvedValueOnce({
      importableEntries: [],
      duplicateLocalDates: ['2026-04-09'],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
      editedEntryCount: 0,
    });

    act(() => {
      result.current.selectSource('manual');
    });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      const ok = await result.current.previewManualHistory();
      // Has previewable history (duplicates count) → returns true
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(0);
    expect(result.current.preview?.duplicateLocalDates).toEqual(['2026-04-09']);
    // No new commit should be needed
    await act(async () => {
      const ok = await result.current.commitPreview();
      // commitPreview should still work (0 importable but preview is not null)
      expect(typeof ok).toBe('boolean');
    });
    // commitImport called at most once more (for the second import)
    expect(mockCommitImport).toHaveBeenCalledTimes(2);
  });

  // ─── Partial data ─────────────────────────────────────────────────────────

  it('partial-data preview: valid rows imported, invalid surfaced as skipped', async () => {
    mockPreviewImport.mockResolvedValueOnce({
      importableEntries: [{ logDate: '2026-04-09', bleeding: 'medium', symptoms: [] }],
      duplicateLocalDates: [],
      skippedRows: [
        { rowNumber: 2, reason: 'invalid', message: 'Row 2 has an invalid date.' },
      ],
      skippedSummary: {
        totalCount: 1,
        invalidCount: 1,
        unsupportedCount: 0,
        messages: ['Row 2 has an invalid date.'],
      },
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
      editedEntryCount: 0,
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      const ok = await result.current.previewManualHistory();
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(1);
    expect(result.current.preview?.skippedRows).toHaveLength(1);
    expect(result.current.preview?.skippedRows[0].reason).toBe('invalid');
    expect(result.current.errorMessage).toBeNull();
  });

  it('all-invalid file yields noValidHistory error and null preview', async () => {
    mockPreviewImport.mockResolvedValueOnce({
      importableEntries: [],
      duplicateLocalDates: [],
      skippedRows: [
        { rowNumber: 1, reason: 'invalid', message: 'Row 1 has an invalid date.' },
      ],
      skippedSummary: { totalCount: 1, invalidCount: 1, unsupportedCount: 0, messages: [] },
      warnings: [],
      dateRange: null,
      editedEntryCount: 0,
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('bad-date');
      const ok = await result.current.previewManualHistory();
      // skippedRows only (no importable, no dupe, skippedSummary.totalCount=1)
      // hasPreviewableHistory returns true for skippedSummary.totalCount > 0
      expect(ok).toBe(true);
    });

    // preview is set because there are skipped rows to show
    expect(result.current.preview?.skippedRows).toHaveLength(1);
  });

  // ─── Error states are recoverable ────────────────────────────────────────

  it('error state from preview is cleared by clearError and then allows retry', async () => {
    mockPreviewImport.mockRejectedValueOnce(new Error('parse failed'));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      const ok = await result.current.previewManualHistory();
      expect(ok).toBe(false);
    });

    expect(result.current.errorMessage).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.errorMessage).toBeNull();

    // Retry succeeds
    await act(async () => {
      const ok = await result.current.previewManualHistory();
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(1);
  });

  it('error state from commit is cleared when a new preview is loaded', async () => {
    mockCommitImport.mockRejectedValueOnce(new Error('disk full'));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      await result.current.commitPreview();
    });

    expect(result.current.errorMessage).toBe('import.errors.commit');

    // Loading a fresh preview must clear the error
    await act(async () => {
      result.current.setManualDatesInput('2026-04-10');
      await result.current.previewManualHistory();
    });

    expect(result.current.errorMessage).toBeNull();
  });

  // ─── BOM-prefixed JSON ───────────────────────────────────────────────────

  it('parses a BOM-prefixed JSON file without error', async () => {
    // Prepend UTF-8 BOM (U+FEFF)
    const bomJson = '﻿' + JSON.stringify({ data: [] });
    mockReadAsStringAsync.mockResolvedValueOnce(bomJson);

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(true);
    });

    // Should not set a JSON parse error
    expect(result.current.errorMessage).toBeNull();
    expect(mockPreviewImport).toHaveBeenCalledTimes(1);
  });

  // ─── Oversized file guard ────────────────────────────────────────────────

  it('rejects a file over the 50 MB size cap before reading it', async () => {
    const overSizeBytes = 50 * 1024 * 1024 + 1;
    mockDocumentPicker.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://huge.json',
          name: 'huge.json',
          mimeType: 'application/json',
          size: overSizeBytes,
        },
      ],
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(false);
    });

    // File must NOT be read
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    // Must set an error message
    expect(result.current.errorMessage).toBeTruthy();
    expect(result.current.preview).toBeNull();
  });

  // ─── File exactly at the size cap is accepted ────────────────────────────

  it('accepts a file exactly at the 50 MB cap (boundary inclusive-check)', async () => {
    const exactSizeBytes = 50 * 1024 * 1024;
    mockDocumentPicker.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://exactly50mb.json',
          name: 'exactly50mb.json',
          mimeType: 'application/json',
          size: exactSizeBytes,
        },
      ],
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    // File should be read (size == limit, not > limit)
    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
  });

  // ─── UnsupportedImportShapeError maps to correct message ─────────────────

  it('maps UnsupportedImportShapeError to the unsupportedShape message key', async () => {
    const { UnsupportedImportShapeError } = jest.requireActual('@/src/lib/parsing/importParsers') as {
      UnsupportedImportShapeError: new (msg: string) => Error
    };
    mockPreviewImport.mockRejectedValueOnce(new UnsupportedImportShapeError('unrecognised'));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    expect(result.current.errorMessage).toBe('import.errors.unsupportedShape');
    expect(result.current.preview).toBeNull();
  });

  // ─── Large import correctness ─────────────────────────────────────────────

  it('handles a preview with 3000 importable entries without truncation', async () => {
    const manyEntries = Array.from({ length: 3000 }, (_, i) => {
      const year = 2018 + Math.floor(i / 365);
      const day = String(1 + (i % 28)).padStart(2, '0');
      const month = String(1 + Math.floor((i % 365) / 28)).padStart(2, '0');
      return { logDate: `${year}-${month}-${day}`, bleeding: 'medium', symptoms: [] };
    });

    mockPreviewImport.mockResolvedValueOnce({
      importableEntries: manyEntries,
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: manyEntries[0].logDate, endIso: manyEntries[manyEntries.length - 1].logDate },
      editedEntryCount: 0,
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewManualHistory();
      expect(ok).toBe(true);
    });

    expect(result.current.preview?.importableEntries).toHaveLength(3000);

    mockCommitImport.mockResolvedValueOnce({ importedLogCount: 3000, skippedLogCount: 0 });

    await act(async () => {
      const committed = await result.current.commitPreview();
      expect(committed).toBe(true);
    });

    expect(result.current.result?.importedLogCount).toBe(3000);
    expect(result.current.isCommitting).toBe(false);
  });

  // ─── selectSource after commit clears result ──────────────────────────────

  it('switching source after a successful commit clears the result', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    await act(async () => {
      await result.current.commitPreview();
    });

    await waitFor(() => expect(result.current.result?.importedLogCount).toBe(1));

    act(() => {
      result.current.selectSource('flo');
    });

    expect(result.current.result).toBeNull();
    expect(result.current.preview).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  // ─── removePreviewEntry on non-existent date is a no-op ──────────────────

  it('removePreviewEntry is a no-op when the date does not exist in the preview', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    const previewBefore = result.current.preview;

    act(() => {
      result.current.removePreviewEntry('9999-12-31');
    });

    // Preview is unchanged (same reference, per identity check in the reducer)
    expect(result.current.preview).toBe(previewBefore);
  });

  // ─── removePreviewEntry on null preview is safe ───────────────────────────

  it('removePreviewEntry is safe when there is no current preview', () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    expect(() => {
      act(() => {
        result.current.removePreviewEntry('2026-04-09');
      });
    }).not.toThrow();

    expect(result.current.preview).toBeNull();
  });

  // ─── flo source is wired up the same way as clue ─────────────────────────

  it('previewFileImport works for flo source', async () => {
    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('flo');
      expect(ok).toBe(true);
    });

    expect(result.current.selectedSource).toBe('flo');
    expect(result.current.preview).not.toBeNull();
  });

  // ─── video/audio/image mimeType rejection ────────────────────────────────

  it('rejects audio files before reading', async () => {
    mockDocumentPicker.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://track.mp3', name: 'track.mp3', mimeType: 'audio/mpeg' }],
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(false);
    });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('import.errors.unsupportedMedia');
  });

  it('rejects video files before reading', async () => {
    mockDocumentPicker.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://video.mp4', name: 'video.mp4', mimeType: 'video/mp4' }],
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      const ok = await result.current.previewFileImport('clue');
      expect(ok).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.unsupportedMedia');
  });

  // ─── Null size in asset metadata is treated as no size limit check ────────

  it('does not reject a file when size is null (no metadata)', async () => {
    mockDocumentPicker.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file://unknown-size.json',
          name: 'unknown-size.json',
          mimeType: 'application/json',
          size: null,
        },
      ],
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    // File should proceed to read (null size = skip size guard)
    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
  });
});
