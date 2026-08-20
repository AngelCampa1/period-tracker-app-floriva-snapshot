import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useDatabase } from '@/src/db/DatabaseProvider';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import {
  buildImportConfidence,
  buildImportDateRangeFromEntries,
  createImportWorkflow,
  getManualHistoryLookbackStartIso,
} from '@/src/features/import/model';
import { attemptAutomaticReviewPrompt } from '@/src/features/review/automaticReview';
import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';
import { UnsupportedImportShapeError } from '@/src/lib/parsing/importParsers';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import {
  createImportReadyPreview,
  qaImportReadySelectedFileLabel,
} from '@/src/testing/qaFixtures';
import { resolveDevLaunchPreset } from '@/src/testing/devLaunchPreset';
import { resolveQaFixtureToday } from '@/src/testing/qaFixtureClock';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportSource,
} from '@/src/types/domain';

const IMPORT_PICKER_TYPES = [
  'application/json',
  'application/*+json',
  'text/json',
  'text/plain',
  'application/octet-stream',
  'image/*',
  'video/*',
  'audio/*',
] as const;
const UNSUPPORTED_IMPORT_MIME_PREFIXES = ['image/', 'video/', 'audio/'] as const;

// 50 MB hard cap. A real Clue/Flo JSON export is typically <2 MB even for years
// of data. Anything beyond this cap is almost certainly malformed or malicious,
// and passing it to JSON.parse risks OOM-killing the JS thread on low-end devices.
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;

// Strip a leading UTF-8 BOM (U+FEFF) that some export tools prepend. Without
// this, JSON.parse throws a SyntaxError on otherwise-valid JSON.
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

type ImportFlowContextValue = {
  errorMessage: string | null;
  manualDatesInput: string;
  preview: ImportPreview | null;
  result: ImportCommitResult | null;
  isCommitting: boolean;
  selectedFileLabel: string | null;
  selectedSource: ImportSource | null;
  clearError: () => void;
  commitPreview: () => Promise<boolean>;
  previewFileImport: (source: Extract<ImportSource, 'clue' | 'flo'>) => Promise<boolean>;
  previewManualHistory: () => Promise<boolean>;
  removePreviewEntry: (logDate: string) => void;
  selectSource: (source: ImportSource) => void;
  setManualDatesInput: (value: string) => void;
};

const ImportFlowContext = createContext<ImportFlowContextValue | null>(null);

function getUnsupportedImportMessage(
  mimeType: string | null | undefined,
  t: (key: string) => string,
) {
  if (!mimeType) {
    return null;
  }

  const normalizedMimeType = mimeType.toLowerCase();

  if (
    UNSUPPORTED_IMPORT_MIME_PREFIXES.some((prefix) => normalizedMimeType.startsWith(prefix))
  ) {
    return t('import.errors.unsupportedMedia');
  }

  return null;
}

function hasPreviewableHistory(nextPreview: ImportPreview) {
  return (
    nextPreview.importableEntries.length > 0 ||
    nextPreview.duplicateLocalDates.length > 0 ||
    nextPreview.skippedRows.length > 0 ||
    (nextPreview.skippedSummary?.totalCount ?? 0) > 0 ||
    nextPreview.warnings.length > 0
  );
}

function getPreviewErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof UnsupportedImportShapeError) {
    return t('import.errors.unsupportedShape');
  }

  return t('import.errors.noValidHistory');
}

function buildDevLaunchImportSeed() {
  if (resolveDevLaunchPreset() !== 'import-ready') {
    return null;
  }

  return {
    preview: createImportReadyPreview(resolveQaFixtureToday()),
    selectedFileLabel: qaImportReadySelectedFileLabel,
    selectedSource: 'clue' as const,
  };
}

export function ImportFlowProvider({ children }: PropsWithChildren) {
  const { repositories } = useDatabase();
  const { clearPendingEntryRoute, refreshReminderSchedules } = useAppShell();
  const { t } = useLocalization();
  const workflow = useMemo(() => createImportWorkflow({ repositories }), [repositories]);
  const devLaunchSeed = useMemo(() => buildDevLaunchImportSeed(), []);
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(
    devLaunchSeed?.selectedSource ?? null,
  );
  const [manualDatesInput, setManualDatesInput] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(devLaunchSeed?.preview ?? null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const isCommittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(
    devLaunchSeed?.selectedFileLabel ?? null,
  );
  const importReadErrorMessage = t('import.errors.readFile');
  const importCommitErrorMessage = t('import.errors.commit');

  function resetFlow(nextSource: ImportSource) {
    setSelectedSource(nextSource);
    setPreview(null);
    setResult(null);
    setErrorMessage(null);
    setSelectedFileLabel(null);
  }

  function clearError() {
    setErrorMessage(null);
  }

  async function previewPayload(source: ImportSource, payload: unknown) {
    try {
      setSelectedSource(source);
      const nextPreview = await workflow.previewImport({ source, payload });

      if (!hasPreviewableHistory(nextPreview)) {
        setPreview(null);
        setResult(null);
        setErrorMessage(t('import.errors.noValidHistory'));
        return false;
      }

      setSelectedSource(source);
      setPreview(nextPreview);
      setResult(null);
      setErrorMessage(null);
      return true;
    } catch (error) {
      setPreview(null);
      setResult(null);
      setErrorMessage(getPreviewErrorMessage(error, t));
      return false;
    }
  }

  function removePreviewEntry(logDate: string) {
    setPreview((currentPreview) => {
      if (!currentPreview) {
        return currentPreview;
      }

      const nextEntries = currentPreview.importableEntries.filter(
        (entry) => entry.logDate !== logDate,
      );

      if (nextEntries.length === currentPreview.importableEntries.length) {
        return currentPreview;
      }

      return {
        ...currentPreview,
        confidence: buildImportConfidence({
          duplicateCount:
            currentPreview.duplicateSummary?.count ?? currentPreview.duplicateLocalDates.length,
          importableCount: nextEntries.length,
          skippedCount:
            currentPreview.skippedSummary?.totalCount ?? currentPreview.skippedRows.length,
        }),
        dateRange: buildImportDateRangeFromEntries(nextEntries),
        importableEntries: nextEntries,
        editedEntryCount: (currentPreview.editedEntryCount ?? 0) + 1,
      };
    });
  }

  async function previewManualHistory() {
    setSelectedSource('manual');

    const periodStarts = manualDatesInput
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    // LT-07: only the manual quick-entry path applies a 12-month lookback;
    // file imports below (previewFileImport) accept history of any age.
    // This asymmetry is intentional -- see the policy comment on
    // getManualHistoryLookbackStartIso (model.ts) for the full rationale.
    return previewPayload('manual', {
      periodStarts,
      lookbackStartIso: getManualHistoryLookbackStartIso(),
    });
  }

  async function previewFileImport(source: Extract<ImportSource, 'clue' | 'flo'>) {
    try {
      // LT-07: deliberately no lookback/age cutoff here -- file imports
      // (Clue/Flo) accept history of any age. See the policy comment on
      // getManualHistoryLookbackStartIso (model.ts).
      setSelectedSource(source);
      const selection = await DocumentPicker.getDocumentAsync({
        type: [...IMPORT_PICKER_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled || selection.assets.length === 0) {
        return false;
      }

      const asset = selection.assets[0];
      const unsupportedMessage = getUnsupportedImportMessage(asset.mimeType, t);

      if (unsupportedMessage) {
        setPreview(null);
        setResult(null);
        setErrorMessage(unsupportedMessage);
        setSelectedFileLabel(asset.name ?? null);
        return false;
      }

      if (asset.size !== undefined && asset.size !== null && asset.size > MAX_IMPORT_FILE_BYTES) {
        setPreview(null);
        setResult(null);
        setSelectedFileLabel(asset.name ?? null);
        setErrorMessage(importReadErrorMessage);
        return false;
      }

      const contents = await FileSystem.readAsStringAsync(asset.uri);
      let payload: unknown;

      try {
        payload = JSON.parse(stripBom(contents)) as unknown;
      } catch {
        setPreview(null);
        setResult(null);
        setSelectedFileLabel(asset.name ?? null);
        setErrorMessage(t('import.errors.jsonParse'));
        return false;
      }

      setSelectedFileLabel(asset.name ?? t('import.labels.selectedExportFile'));
      return previewPayload(source, payload);
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'import_file_read_failed',
        error,
      });
      setSelectedSource(source);
      setPreview(null);
      setResult(null);
      setSelectedFileLabel(null);
      setErrorMessage(importReadErrorMessage);
      return false;
    }
  }

  async function commitPreview() {
    if (!preview || isCommittingRef.current) {
      return false;
    }

    isCommittingRef.current = true;
    setIsCommitting(true);

    try {
      const nextResult = await workflow.commitImport(preview);
      await clearPendingEntryRoute();
      setResult(nextResult);
      setErrorMessage(null);
      // A completed import is a natural, non-interrupting "it worked" moment.
      // Surface the review check through the same capped/cooldown policy as
      // logging; it never nags and lets the OS decide whether to show anything.
      void attemptAutomaticReviewPrompt({ repositories }).catch(() => undefined);
      try {
        await refreshReminderSchedules();
      } catch (error) {
        logSensitiveRuntimeFailure({
          event: 'import_follow_up_sync_failed',
          error,
        });
      }
      return true;
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'import_commit_failed',
        error,
      });
      setErrorMessage(importCommitErrorMessage);
      return false;
    } finally {
      isCommittingRef.current = false;
      setIsCommitting(false);
    }
  }

  return (
    <ImportFlowContext.Provider
      value={{
        clearError,
        commitPreview,
        errorMessage,
        isCommitting,
        manualDatesInput,
        preview,
        previewFileImport,
        previewManualHistory,
        removePreviewEntry,
        result,
        selectedFileLabel,
        selectedSource,
        selectSource: resetFlow,
        setManualDatesInput,
      }}
    >
      {children}
    </ImportFlowContext.Provider>
  );
}

export function useImportFlow() {
  const context = useContext(ImportFlowContext);

  if (!context) {
    throw new Error('useImportFlow must be used within an ImportFlowProvider');
  }

  return context;
}
