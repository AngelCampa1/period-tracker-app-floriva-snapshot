/**
 * Adversarial tests for the file ingestion path of ImportFlowProvider.
 *
 * Covers: invalid JSON, file-size guard, BOM/encoding, cancellation/empty
 * selection, and wrong-shape-for-source errors.
 *
 * Mocking conventions mirror ImportFlowProvider.test.tsx.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { DevLaunchPreset } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import of the module under test.
// ---------------------------------------------------------------------------

const mockClearPendingEntryRoute = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockPreviewImport = jest.fn();
const mockCommitImport = jest.fn();
const mockDocumentPicker = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockResolveDevLaunchPreset = jest.fn<DevLaunchPreset | null, []>(() => null);
const mockAttemptAutomaticReviewPrompt = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: { dailyLogs: {} },
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
  resolveDevLaunchPreset: () => mockResolveDevLaunchPreset(),
}));

jest.mock('@/src/features/review/automaticReview', () => ({
  attemptAutomaticReviewPrompt: (...args: unknown[]) =>
    mockAttemptAutomaticReviewPrompt(...args),
}));

// eslint-disable-next-line import/first
import {
  ImportFlowProvider,
  useImportFlow,
} from '@/src/features/import/ImportFlowProvider';
// eslint-disable-next-line import/first
import { UnsupportedImportShapeError } from '@/src/lib/parsing/importParsers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a selection result with a single asset. */
function makeSelection(overrides: Partial<{
  uri: string;
  name: string;
  mimeType: string;
  size: number | undefined;
}> = {}) {
  const { uri = 'file://fixture.json', name = 'fixture.json', mimeType = 'application/json', size = undefined } = overrides;
  return {
    canceled: false,
    assets: [{ uri, name, mimeType, size }],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ImportFlowProvider – adversarial file ingestion', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockClearPendingEntryRoute.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockPreviewImport.mockReset();
    mockCommitImport.mockReset();
    mockDocumentPicker.mockReset();
    mockReadAsStringAsync.mockReset();
    mockAttemptAutomaticReviewPrompt.mockReset();
    mockResolveDevLaunchPreset.mockReturnValue(null);

    // Default: picker returns a valid JSON file, workflow returns importable data.
    mockDocumentPicker.mockResolvedValue(
      makeSelection({ size: 1024 }),
    );
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify({ data: [] }));
    mockPreviewImport.mockResolvedValue({
      importableEntries: [{ logDate: '2026-04-09' }],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    });
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockAttemptAutomaticReviewPrompt.mockResolvedValue({ requested: false, reason: 'noop' });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 1. INVALID JSON
  // -------------------------------------------------------------------------

  it('shows jsonParse error and returns false for completely invalid JSON (CSV text)', async () => {
    mockReadAsStringAsync.mockResolvedValue(
      'date,type\n2026-04-09,period\n2026-04-10,spotting',
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
    expect(result.current.preview).toBeNull();
    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
  });

  it('shows jsonParse error for HTML content', async () => {
    mockReadAsStringAsync.mockResolvedValue(
      '<!DOCTYPE html><html><body>Not JSON</body></html>',
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
  });

  it('shows jsonParse error for an empty file', async () => {
    mockReadAsStringAsync.mockResolvedValue('');

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('flo')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
    expect(result.current.preview).toBeNull();
  });

  it('shows jsonParse error for whitespace-only content', async () => {
    mockReadAsStringAsync.mockResolvedValue('   \n\t  \n');

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
  });

  it('shows jsonParse error for truncated JSON', async () => {
    mockReadAsStringAsync.mockResolvedValue('{"cycleHistory":[{"date":"2026-01-01"');

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
  });

  it('sets the file label even when JSON parse fails', async () => {
    mockDocumentPicker.mockResolvedValue(
      makeSelection({ name: 'bad-export.json', size: 200 }),
    );
    mockReadAsStringAsync.mockResolvedValue('{broken json');

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('flo');
    });

    expect(result.current.selectedFileLabel).toBe('bad-export.json');
    expect(result.current.errorMessage).toBe('import.errors.jsonParse');
  });

  // -------------------------------------------------------------------------
  // 2. SIZE / DoS guard
  // -------------------------------------------------------------------------

  it('rejects a file that exceeds the 50 MB size cap without reading it', async () => {
    const FIFTY_MB_PLUS_ONE = 50 * 1024 * 1024 + 1;
    mockDocumentPicker.mockResolvedValue(
      makeSelection({ name: 'huge.json', size: FIFTY_MB_PLUS_ONE }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    // Must never call readAsStringAsync — the guard runs before the read.
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('import.errors.readFile');
    expect(result.current.selectedFileLabel).toBe('huge.json');
    expect(result.current.preview).toBeNull();
  });

  it('accepts a file exactly at the 50 MB boundary', async () => {
    const FIFTY_MB_EXACTLY = 50 * 1024 * 1024;
    mockDocumentPicker.mockResolvedValue(
      makeSelection({ size: FIFTY_MB_EXACTLY }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
  });

  it('skips the size check when asset.size is absent (proceeds to read)', async () => {
    // Some platforms/pickers don't provide size — must not block those.
    mockDocumentPicker.mockResolvedValue(
      makeSelection({ size: undefined }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 3. ENCODING — BOM
  // -------------------------------------------------------------------------

  it('successfully parses valid JSON that has a leading UTF-8 BOM (U+FEFF)', async () => {
    // JSON.parse('﻿{...}') throws on every JS engine — BOM must be stripped.
    mockReadAsStringAsync.mockResolvedValue('﻿' + JSON.stringify({ data: [] }));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    // If BOM is not stripped the flow would surface jsonParse. It must not.
    expect(result.current.errorMessage).not.toBe('import.errors.jsonParse');
    expect(mockPreviewImport).toHaveBeenCalledTimes(1);
    // The payload passed to previewImport must be an object (parsed correctly),
    // not a string starting with U+FEFF — confirming the BOM was removed before parse.
    const passedPayload = mockPreviewImport.mock.calls[0]?.[0];
    expect(typeof passedPayload).toBe('object');
    expect(passedPayload).not.toBeNull();
  });

  it('still parses JSON without a BOM as before', async () => {
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify({ data: [] }));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    expect(mockPreviewImport).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 4. CANCELLATION / EMPTY SELECTION
  // -------------------------------------------------------------------------

  it('returns false and does not error when user cancels the picker', async () => {
    mockDocumentPicker.mockResolvedValue({ canceled: true, assets: [] });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.preview).toBeNull();
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('returns false when picker returns an empty assets array even if not canceled', async () => {
    // canceled: false but assets: [] — defensive guard against picker contract edge-case.
    mockDocumentPicker.mockResolvedValue({ canceled: false, assets: [] });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBeNull();
  });

  it('does not clear an existing preview when the user cancels a subsequent file pick', async () => {
    // Set up an existing preview via manual history.
    mockPreviewImport.mockResolvedValue({
      importableEntries: [{ logDate: '2026-04-09' }],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
      dateRange: { startIso: '2026-04-09', endIso: '2026-04-09' },
    });

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      result.current.setManualDatesInput('2026-04-09');
      await result.current.previewManualHistory();
    });

    const previewBeforeCancel = result.current.preview;
    mockDocumentPicker.mockResolvedValue({ canceled: true, assets: [] });

    await act(async () => {
      await result.current.previewFileImport('clue');
    });

    expect(result.current.preview).toEqual(previewBeforeCancel);
    expect(result.current.errorMessage).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. WRONG SHAPE FOR SOURCE
  // -------------------------------------------------------------------------

  it('surfaces unsupportedShape error when valid JSON does not match the chosen source', async () => {
    mockPreviewImport.mockRejectedValue(
      new UnsupportedImportShapeError('flo', 'Payload does not look like a Flo export'),
    );
    // File reads correctly — it's a Clue-format JSON chosen as Flo.
    mockReadAsStringAsync.mockResolvedValue(
      JSON.stringify({ cycleHistory: [], settings: {} }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('flo')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.unsupportedShape');
    expect(result.current.preview).toBeNull();
    // The flow must be recoverable — error is visible, not null.
    expect(result.current.selectedSource).toBe('flo');
  });

  it('shows unsupportedShape when a Flo JSON is loaded as Clue source', async () => {
    mockPreviewImport.mockRejectedValue(
      new UnsupportedImportShapeError('clue', 'Payload does not look like a Clue export'),
    );
    mockReadAsStringAsync.mockResolvedValue(
      JSON.stringify({ periods: [], settings: {} }),
    );

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      expect(await result.current.previewFileImport('clue')).toBe(false);
    });

    expect(result.current.errorMessage).toBe('import.errors.unsupportedShape');
    expect(result.current.preview).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Deeply-nested JSON (regression: must not crash via stack overflow)
  // -------------------------------------------------------------------------

  it('handles deeply nested but valid JSON without crashing', async () => {
    // Build a 500-level nest — deep but within V8 stack limits.
    let nested: unknown = { value: 1 };
    for (let i = 0; i < 500; i++) {
      nested = { child: nested };
    }

    mockReadAsStringAsync.mockResolvedValue(JSON.stringify(nested));

    const { result } = renderHook(() => useImportFlow(), { wrapper: ImportFlowProvider });

    await act(async () => {
      // previewImport will receive the nested payload. Whether it succeeds or
      // fails a shape check is irrelevant — we only care the app doesn't crash.
      await result.current.previewFileImport('clue');
    });

    // No unhandled exception — errorMessage is one of the expected values.
    expect(['import.errors.noValidHistory', 'import.errors.unsupportedShape', null]).toContain(
      result.current.errorMessage,
    );
  });
});
