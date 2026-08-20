import type {
  ImportCommitResult,
  ImportConfidence,
  ImportDateRange,
  ImportDuplicateSummary,
  ImportPreview,
  ImportSource,
  ImportSkippedSummary,
} from '@/src/types/domain';
import type { DomainRepositories } from '@/src/db/contracts';

import {
  type ParsedImportDocument,
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

type CreateImportWorkflowOptions = {
  repositories: Pick<DomainRepositories, 'dailyLogs' | 'importSessions'>;
  now?: () => string;
  createSessionId?: () => string;
};

type PreviewImportRequest = {
  source: ImportSource;
  payload: unknown;
};

function parseImportPayload(source: ImportSource, payload: unknown): ParsedImportDocument {
  if (source === 'clue') {
    return parseClueImport(payload);
  }

  if (source === 'flo') {
    return parseFloImport(payload);
  }

  return parseManualHistoryImport(payload);
}

function buildImportLogId(importSessionId: string, logDate: string) {
  return `import-${importSessionId}-${logDate}`;
}

function defaultNow() {
  return new Date().toISOString();
}

function defaultCreateSessionId() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSkippedSummary(skippedRows: ImportPreview['skippedRows']): ImportSkippedSummary {
  return {
    totalCount: skippedRows.length,
    invalidCount: skippedRows.filter((row) => row.reason === 'invalid').length,
    unsupportedCount: skippedRows.filter((row) => row.reason === 'unsupported').length,
    messages: skippedRows.map((row) => row.message),
  };
}

function buildDuplicateSummary(
  duplicateEntries: Awaited<ReturnType<DomainRepositories['dailyLogs']['listByDates']>>,
): ImportDuplicateSummary {
  return {
    count: duplicateEntries.length,
    details: duplicateEntries.map((entry) => ({
      action: 'skipped',
      existingEntryId: entry.id,
      logDate: entry.logDate,
    })),
  };
}

export function buildImportConfidence({
  duplicateCount,
  importableCount,
  skippedCount,
}: {
  duplicateCount: number;
  importableCount: number;
  skippedCount: number;
}): ImportConfidence {
  const reasons: ImportConfidence['reasons'] = [];

  if (importableCount > 0) {
    reasons.push({ kind: 'reviewed-days-ready', count: importableCount });
  } else {
    reasons.push({ kind: 'no-reviewed-days-ready', count: 0 });
  }

  if (duplicateCount > 0) {
    reasons.push({ kind: 'duplicate-dates-skipped', count: duplicateCount });
  }

  if (skippedCount > 0) {
    reasons.push({ kind: 'rows-skipped', count: skippedCount });
  }

  return {
    label:
      importableCount === 0 && duplicateCount > 0
        ? 'medium'
        : importableCount === 0
        ? 'low'
        : duplicateCount > 0 || skippedCount > 0
          ? 'medium'
          : 'high',
    reasons,
  };
}

export function buildImportDateRangeFromEntries(
  entries: Pick<ImportPreview['importableEntries'][number], 'logDate'>[],
): ImportDateRange | null {
  if (entries.length === 0) {
    return null;
  }

  const sortedDates = entries.map((entry) => entry.logDate).sort();

  return {
    startIso: sortedDates[0],
    endIso: sortedDates[sortedDates.length - 1],
  };
}

function formatLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

// LT-07 (long-tenure sweep, 2026-07): file imports (Clue/Flo) and manual
// quick-entry deliberately apply DIFFERENT age policies, and that asymmetry
// is intentional, not a bug:
//
//  - File imports (parseClueImport / parseFloImport) accept history of any
//    age with no lookback cutoff. Import is a flagship/strategic feature
//    (see CLAUDE.md "Import Direction"): a long-tenure switcher's full
//    history is exactly what makes Floriva worth switching to, and old data
//    cannot hurt the prediction engine even if it can't help it beyond a
//    point -- buildPredictionResult windows its own statistics to the most
//    recent 12 completed intervals (MAX_INTERVAL_WINDOW, cycleStatistics.ts)
//    regardless of how much history is stored. Respecting the user's full
//    data ownership costs nothing and is the strategically correct default.
//  - Manual quick-entry (parseManualHistoryImport, driven by this lookback)
//    caps at 12 months back. This is a deliberate UX simplification of a
//    hand-picked-dates flow, not a data-integrity or trust policy: asking a
//    user to hand-enter arbitrarily old period-start dates one at a time
//    via a date picker is a bad interaction for anything beyond "recent
//    history I forgot to log", so the flow is scoped accordingly. A user
//    with genuinely old history should use file import instead.
//
// Both call sites (ImportFlowProvider.tsx, the routed manual-entry flow;
// ImportScreen.tsx, a legacy/unrouted screen kept for its shared
// formatImportDateRange export) previously duplicated this function
// verbatim. Consolidated here as the single source of truth.
export function getManualHistoryLookbackStartIso(referenceDate = new Date()) {
  const lookbackDate = new Date(referenceDate);

  lookbackDate.setFullYear(referenceDate.getFullYear() - 1);

  return formatLocalIsoDate(lookbackDate);
}

function getPreviewDuplicateCount(preview: ImportPreview) {
  return preview.duplicateSummary?.count ?? preview.duplicateLocalDates.length;
}

function getPreviewSkippedSummary(preview: ImportPreview) {
  return preview.skippedSummary ?? buildSkippedSummary(preview.skippedRows);
}

export function createImportWorkflow({
  repositories,
  now = defaultNow,
  createSessionId = defaultCreateSessionId,
}: CreateImportWorkflowOptions) {
  async function previewImport({ source, payload }: PreviewImportRequest): Promise<ImportPreview> {
    const parsed = parseImportPayload(source, payload);
    const uniqueDates = [...new Set(parsed.entries.map((entry) => entry.logDate))];
    const existingEntries = await repositories.dailyLogs.listByDates(uniqueDates);
    const existingDates = new Set(existingEntries.map((entry) => entry.logDate));

    const duplicateLocalDates = parsed.entries
      .filter((entry) => existingDates.has(entry.logDate))
      .map((entry) => entry.logDate);
    const duplicateEntries = existingEntries.filter((entry) =>
      duplicateLocalDates.includes(entry.logDate),
    );
    const duplicateSummary = buildDuplicateSummary(duplicateEntries);
    const skippedSummary = buildSkippedSummary(parsed.skippedRows);
    const importableEntries = parsed.entries.filter((entry) => !existingDates.has(entry.logDate));

    return {
      source: parsed.source,
      dateRange: parsed.dateRange,
      confidence: buildImportConfidence({
        duplicateCount: duplicateSummary.count,
        importableCount: importableEntries.length,
        skippedCount: skippedSummary.totalCount,
      }),
      duplicateSummary,
      skippedRows: parsed.skippedRows,
      skippedSummary,
      warnings: parsed.warnings,
      duplicateLocalDates,
      importableEntries,
      editedEntryCount: 0,
    };
  }

  async function commitImport(preview: ImportPreview): Promise<ImportCommitResult> {
    const startedAt = now();
    const importSessionId = createSessionId();
    const previewDates = preview.importableEntries.map((entry) => entry.logDate);
    const currentEntries = await repositories.dailyLogs.listByDates(previewDates);
    const currentDates = new Set(currentEntries.map((entry) => entry.logDate));

    const previewReadyEntries = preview.importableEntries.filter(
      (entry) => !currentDates.has(entry.logDate),
    );
    let duplicateSkippedLogCount =
      getPreviewDuplicateCount(preview) + (preview.importableEntries.length - previewReadyEntries.length);
    let importedLogCount = 0;
    const skippedSummary = getPreviewSkippedSummary(preview);
    const savedEntryIds: string[] = [];
    const savedLogDates: string[] = [];

    await repositories.importSessions.saveSession({
      id: importSessionId,
      source: preview.source,
      status: 'pending',
      startedAt,
      importedLogCount: 0,
      skippedLogCount: 0,
    });

    try {
      for (const entry of previewReadyEntries) {
        const entryId = buildImportLogId(importSessionId, entry.logDate);
        const didSave = await repositories.dailyLogs.saveEntryIfDateAbsent({
          id: entryId,
          logDate: entry.logDate,
          bleeding: entry.bleeding,
          symptoms: entry.symptoms,
          mood: entry.mood,
          notes: entry.notes,
          ttcObservation: entry.ttcObservation,
          birthControlEvent: entry.birthControlEvent,
          importSessionId,
        });

        if (didSave) {
          importedLogCount += 1;
          savedEntryIds.push(entryId);
          savedLogDates.push(entry.logDate);
        } else {
          duplicateSkippedLogCount += 1;
        }
      }
      const skippedLogCount = skippedSummary.totalCount + duplicateSkippedLogCount;

      await repositories.importSessions.saveSession({
        id: importSessionId,
        source: preview.source,
        status: 'committed',
        startedAt,
        completedAt: now(),
        importedLogCount,
        skippedLogCount,
      });

      return {
        importSessionId,
        source: preview.source,
        dateRange: buildImportDateRangeFromEntries(
          savedLogDates.map((logDate) => ({ logDate })),
        ),
        importedLogCount,
        skippedLogCount,
        duplicateSkippedLogCount,
        skippedRowCount: skippedSummary.totalCount,
        unsupportedSkippedRowCount: skippedSummary.unsupportedCount,
        invalidSkippedRowCount: skippedSummary.invalidCount,
        editedEntryCount: preview.editedEntryCount ?? 0,
      };
    } catch (error) {
      await Promise.all(
        savedEntryIds.map((entryId) => repositories.dailyLogs.deleteEntry(entryId)),
      );

      await repositories.importSessions.saveSession({
        id: importSessionId,
        source: preview.source,
        status: 'failed',
        startedAt,
        completedAt: now(),
        importedLogCount: 0,
        skippedLogCount:
          skippedSummary.totalCount +
          getPreviewDuplicateCount(preview) +
          preview.importableEntries.length,
      });

      throw error;
    }
  }

  return {
    previewImport,
    commitImport,
  };
}
