/**
 * Adversarial tests for src/features/import/model.ts
 *
 * Probes:
 * 1. buildImportConfidence – all label/reason combinations
 * 2. Duplicate dedup – full overlap, partial, date-format consistency
 * 3. commitImport – empty set no-op, log-id uniqueness, idempotency, injected clock/sessionId
 * 4. Count consistency – importable + duplicates + skipped vs parsed entries
 */

import { buildImportConfidence, buildImportDateRangeFromEntries, createImportWorkflow } from '@/src/features/import/model';
import type { ImportPreview } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Lightweight fake repositories
// ---------------------------------------------------------------------------

type FakeDailyLog = {
  id: string;
  logDate: string;
  bleeding?: string;
  symptoms?: string[];
  notes?: string;
  importSessionId?: string;
};

function makeFakeRepos(existingLogs: FakeDailyLog[] = []) {
  const logs = new Map<string, FakeDailyLog>(existingLogs.map((l) => [l.logDate, l]));
  const sessionsMap = new Map<string, unknown>();
  const savedEntryIds: string[] = [];
  const deletedEntryIds: string[] = [];
  const savedSessions: unknown[] = [];

  return {
    logs,
    sessionsMap,
    savedEntryIds,
    deletedEntryIds,
    savedSessions,
    repositories: {
      dailyLogs: {
        listByDates: jest.fn(async (dates: string[]) =>
          dates.flatMap((d) => {
            const entry = logs.get(d);
            return entry ? [entry] : [];
          }),
        ),
        saveEntryIfDateAbsent: jest.fn(async (entry: FakeDailyLog) => {
          if (logs.has(entry.logDate)) return false;
          logs.set(entry.logDate, entry);
          savedEntryIds.push(entry.id);
          return true;
        }),
        deleteEntry: jest.fn(async (id: string) => {
          deletedEntryIds.push(id);
          for (const [date, log] of logs.entries()) {
            if (log.id === id) {
              logs.delete(date);
              break;
            }
          }
        }),
      },
      importSessions: {
        saveSession: jest.fn(async (session: unknown) => {
          savedSessions.push(session);
        }),
        getSession: jest.fn(async (id: string) => sessionsMap.get(id)),
      },
    } as never,
  };
}

// ---------------------------------------------------------------------------
// 1. CONFIDENCE LABELING
// ---------------------------------------------------------------------------

describe('buildImportConfidence – label matrix', () => {
  it('(0,0,0) → low with only no-reviewed-days-ready reason', () => {
    const result = buildImportConfidence({ importableCount: 0, duplicateCount: 0, skippedCount: 0 });
    expect(result.label).toBe('low');
    expect(result.reasons).toEqual([{ kind: 'no-reviewed-days-ready', count: 0 }]);
  });

  it('(0,dup>0,0) → medium (duplicates only, nothing to import, no skips)', () => {
    const result = buildImportConfidence({ importableCount: 0, duplicateCount: 3, skippedCount: 0 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'no-reviewed-days-ready', count: 0 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 3 });
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ kind: 'rows-skipped' }));
  });

  it('(0,0,skip>0) → low with no-reviewed-days-ready and rows-skipped reasons', () => {
    const result = buildImportConfidence({ importableCount: 0, duplicateCount: 0, skippedCount: 2 });
    expect(result.label).toBe('low');
    expect(result.reasons).toContainEqual({ kind: 'no-reviewed-days-ready', count: 0 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 2 });
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ kind: 'duplicate-dates-skipped' }));
  });

  it('(0,dup>0,skip>0) → medium: both duplicates and skipped present means data was parsed but not importable', () => {
    // BUG CHECK: importable=0, dup>0, skip>0
    // Ternary: case 1 fails (skippedCount > 0), case 2 fires → 'low'
    // But we have duplicate entries — the data was parsed; this should be 'medium' not 'low'
    const result = buildImportConfidence({ importableCount: 0, duplicateCount: 2, skippedCount: 1 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'no-reviewed-days-ready', count: 0 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 2 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 1 });
  });

  it('(importable>0,0,0) → high with only reviewed-days-ready reason', () => {
    const result = buildImportConfidence({ importableCount: 5, duplicateCount: 0, skippedCount: 0 });
    expect(result.label).toBe('high');
    expect(result.reasons).toEqual([{ kind: 'reviewed-days-ready', count: 5 }]);
  });

  it('(importable>0,dup>0,0) → medium', () => {
    const result = buildImportConfidence({ importableCount: 3, duplicateCount: 2, skippedCount: 0 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'reviewed-days-ready', count: 3 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 2 });
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ kind: 'rows-skipped' }));
  });

  it('(importable>0,0,skip>0) → medium', () => {
    const result = buildImportConfidence({ importableCount: 4, duplicateCount: 0, skippedCount: 3 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'reviewed-days-ready', count: 4 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 3 });
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ kind: 'duplicate-dates-skipped' }));
  });

  it('(importable>0,dup>0,skip>0) → medium', () => {
    const result = buildImportConfidence({ importableCount: 2, duplicateCount: 1, skippedCount: 1 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons).toContainEqual({ kind: 'reviewed-days-ready', count: 2 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 1 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 1 });
  });

  it('large counts preserve exact count values in reasons', () => {
    const result = buildImportConfidence({ importableCount: 1000, duplicateCount: 500, skippedCount: 250 });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'reviewed-days-ready', count: 1000 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 500 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 250 });
  });

  it('reasons array never has both reviewed-days-ready and no-reviewed-days-ready', () => {
    for (const importableCount of [0, 1, 5]) {
      const result = buildImportConfidence({ importableCount, duplicateCount: 1, skippedCount: 1 });
      const hasReady = result.reasons.some((r) => r.kind === 'reviewed-days-ready');
      const hasNoReady = result.reasons.some((r) => r.kind === 'no-reviewed-days-ready');
      expect(hasReady && hasNoReady).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. DUPLICATE DEDUP
// ---------------------------------------------------------------------------

describe('duplicate dedup in previewImport', () => {
  it('all dates already exist → zero importable, all are duplicates', async () => {
    const { repositories } = makeFakeRepos([
      { id: 'existing-1', logDate: '2026-05-01' },
      { id: 'existing-2', logDate: '2026-05-02' },
    ]);

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-all-dupes',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02'] },
    });

    expect(preview.importableEntries).toHaveLength(0);
    expect(preview.duplicateLocalDates).toHaveLength(2);
    expect(preview.duplicateSummary!.count).toBe(2);
    // confidence: importable=0, dup=2, skip=0 → medium
    expect(preview.confidence!.label).toBe('medium');
  });

  it('partial overlap → only non-existing dates are importable', async () => {
    const { repositories } = makeFakeRepos([{ id: 'existing-1', logDate: '2026-05-01' }]);

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-partial',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02', '2026-05-03'] },
    });

    expect(preview.importableEntries.map((e) => e.logDate)).toEqual(['2026-05-02', '2026-05-03']);
    expect(preview.duplicateLocalDates).toEqual(['2026-05-01']);
    expect(preview.duplicateSummary!.count).toBe(1);
    // importable=2, dup=1, skip=0 → medium
    expect(preview.confidence!.label).toBe('medium');
  });

  it('importable + duplicates counts are consistent: importable.length + dup.count = total parsed entries (minus skipped)', async () => {
    const { repositories } = makeFakeRepos([{ id: 'ex-1', logDate: '2026-05-01' }]);

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-consistency',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02', '2026-05-03'] },
    });

    const totalParsed =
      preview.importableEntries.length +
      (preview.duplicateSummary?.count ?? 0) +
      (preview.skippedSummary?.totalCount ?? 0);

    // 3 period starts → 3 parsed entries (no skips in manual parser for valid dates)
    expect(totalParsed).toBe(3);
  });

  it('duplicateSummary.count equals duplicateLocalDates.length', async () => {
    const { repositories } = makeFakeRepos([
      { id: 'ex-1', logDate: '2026-05-01' },
      { id: 'ex-2', logDate: '2026-05-03' },
    ]);

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-count-match',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02', '2026-05-03'] },
    });

    expect(preview.duplicateSummary!.count).toBe(preview.duplicateLocalDates.length);
  });

  it('committed entries do not include duplicate dates', async () => {
    const fake = makeFakeRepos([{ id: 'ex-1', logDate: '2026-05-01', bleeding: 'light', symptoms: [] }]);

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-commit-no-dup',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02'] },
    });

    const result = await workflow.commitImport(preview);

    expect(result.importedLogCount).toBe(1);
    expect(result.duplicateSkippedLogCount).toBe(1);
    // The pre-existing entry for 2026-05-01 must not be overwritten
    const existing = fake.logs.get('2026-05-01');
    expect(existing?.id).toBe('ex-1');
  });
});

// ---------------------------------------------------------------------------
// 3. COMMIT EDGE CASES
// ---------------------------------------------------------------------------

describe('commitImport edge cases', () => {
  it('empty importable set is a safe no-op (no writes, session committed with 0 counts)', async () => {
    const fake = makeFakeRepos();

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-empty',
    });

    const emptyPreview: ImportPreview = {
      source: 'manual',
      dateRange: null,
      importableEntries: [],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'low', reasons: [{ kind: 'no-reviewed-days-ready', count: 0 }] },
      editedEntryCount: 0,
    };

    const result = await workflow.commitImport(emptyPreview);

    expect(result.importedLogCount).toBe(0);
    expect(result.duplicateSkippedLogCount).toBe(0);
    expect(result.skippedLogCount).toBe(0);
    expect(result.dateRange).toBeNull();
    expect((fake.repositories as { dailyLogs: { saveEntryIfDateAbsent: jest.Mock } }).dailyLogs.saveEntryIfDateAbsent).not.toHaveBeenCalled();
  });

  it('log id is constructed as import-{sessionId}-{logDate} and is unique per date', async () => {
    const fake = makeFakeRepos();

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'my-session-id',
    });

    const preview: ImportPreview = {
      source: 'manual',
      dateRange: { startIso: '2026-05-01', endIso: '2026-05-02' },
      importableEntries: [
        { logDate: '2026-05-01', bleeding: 'medium', symptoms: [] },
        { logDate: '2026-05-02', bleeding: 'medium', symptoms: [] },
      ],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 2 }] },
      editedEntryCount: 0,
    };

    await workflow.commitImport(preview);

    const calls = ((fake.repositories as { dailyLogs: { saveEntryIfDateAbsent: jest.Mock } }).dailyLogs.saveEntryIfDateAbsent).mock.calls;
    const ids = calls.map((c: [FakeDailyLog]) => c[0].id);

    expect(ids).toContain('import-my-session-id-2026-05-01');
    expect(ids).toContain('import-my-session-id-2026-05-02');
    // Uniqueness
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('session id and now() are injected at creation time and consistent across pending/committed sessions', async () => {
    const fake = makeFakeRepos();

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T12:00:00.000Z',
      createSessionId: () => 'injected-session',
    });

    const preview: ImportPreview = {
      source: 'clue',
      dateRange: { startIso: '2026-05-05', endIso: '2026-05-05' },
      importableEntries: [{ logDate: '2026-05-05', bleeding: 'light', symptoms: [] }],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    const result = await workflow.commitImport(preview);

    expect(result.importSessionId).toBe('injected-session');
    const sessions = fake.savedSessions as { id: string; startedAt: string; status: string }[];
    expect(sessions.every((s) => s.id === 'injected-session')).toBe(true);
    expect(sessions.every((s) => s.startedAt === '2026-05-10T12:00:00.000Z')).toBe(true);
    const finalSession = sessions.find((s) => s.status === 'committed');
    expect(finalSession).toBeDefined();
  });

  it('committing the same preview twice does not double-write entries (idempotency via saveEntryIfDateAbsent)', async () => {
    const fake = makeFakeRepos();

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-idempotent',
    });

    const preview: ImportPreview = {
      source: 'manual',
      dateRange: { startIso: '2026-05-07', endIso: '2026-05-07' },
      importableEntries: [{ logDate: '2026-05-07', bleeding: 'heavy', symptoms: [] }],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    const result1 = await workflow.commitImport(preview);
    const result2 = await workflow.commitImport(preview);

    // First commit writes 1 entry, second commit sees it as already present
    expect(result1.importedLogCount).toBe(1);
    expect(result2.importedLogCount).toBe(0);
    // The underlying log store should only have one entry for 2026-05-07
    expect(fake.logs.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. COUNT CONSISTENCY
// ---------------------------------------------------------------------------

describe('count consistency', () => {
  it('skippedSummary messages length equals totalCount', async () => {
    const { repositories } = makeFakeRepos();

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-msg-count',
    });

    // Clue parser skips rows with bad dates; inject two invalid date rows
    const preview = await workflow.previewImport({
      source: 'clue',
      payload: {
        trackedData: [
          { date: 'not-a-date', bleeding: 'light' },
          { date: 'also-bad', bleeding: 'medium' },
          { date: '2026-05-01', bleeding: 'light' },
        ],
      },
    });

    const summary = preview.skippedSummary!;
    expect(summary.messages).toHaveLength(summary.totalCount);
  });

  it('importedLogCount + duplicateSkippedLogCount + skippedRowCount matches session skippedLogCount in commit result', async () => {
    const fake = makeFakeRepos([{ id: 'ex-1', logDate: '2026-05-01', symptoms: [], bleeding: 'light' }]);

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-totals',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02'] },
    });

    const result = await workflow.commitImport(preview);

    expect(result.importedLogCount + result.skippedLogCount).toBe(
      result.importedLogCount + (result.duplicateSkippedLogCount ?? 0) + (result.skippedRowCount ?? 0),
    );
  });

  it('commit result skippedLogCount equals duplicateSkippedLogCount + skippedRowCount', async () => {
    const fake = makeFakeRepos([{ id: 'ex-1', logDate: '2026-05-01', symptoms: [], bleeding: 'light' }]);

    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-05-10T00:00:00.000Z',
      createSessionId: () => 'sess-skipped-breakdown',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-02'] },
    });

    const result = await workflow.commitImport(preview);

    expect(result.skippedLogCount).toBe((result.duplicateSkippedLogCount ?? 0) + (result.skippedRowCount ?? 0));
  });
});

// ---------------------------------------------------------------------------
// 5. buildImportDateRangeFromEntries
// ---------------------------------------------------------------------------

describe('buildImportDateRangeFromEntries', () => {
  it('returns null for empty array', () => {
    expect(buildImportDateRangeFromEntries([])).toBeNull();
  });

  it('single entry → startIso equals endIso', () => {
    const result = buildImportDateRangeFromEntries([{ logDate: '2026-05-05' }]);
    expect(result).toEqual({ startIso: '2026-05-05', endIso: '2026-05-05' });
  });

  it('out-of-order entries → sorted correctly', () => {
    const result = buildImportDateRangeFromEntries([
      { logDate: '2026-05-10' },
      { logDate: '2026-05-01' },
      { logDate: '2026-05-05' },
    ]);
    expect(result).toEqual({ startIso: '2026-05-01', endIso: '2026-05-10' });
  });
});
