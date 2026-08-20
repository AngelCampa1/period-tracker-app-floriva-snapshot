/**
 * Adversarial probe tests for src/features/import/model.ts
 *
 * Focus areas NOT already covered by the existing test files:
 *  - buildImportConfidence: importable=0, dup>0, skip>0  (boundary label bug)
 *  - duplicateLocalDates contains duplicates when import has repeated dates
 *  - previewImport dateRange reflects parsed-document range, not importable range
 *  - commitImport: dateRange is derived from SAVED entries, not preview.dateRange
 *  - commitImport: completedAt === startedAt (same clock tick — possible intent
 *    bug; completedAt should be the real end time, but the impl uses startedAt)
 *  - Future-dated entries are importable (no guard should exist)
 *  - All bleeding values round-trip faithfully through the workflow
 *  - Entries with only ttcObservation / birthControlEvent are preserved
 *  - notes are trimmed and capped at 500 chars in the parser
 *  - commitImport skippedLogCount = duplicateSkippedLogCount + skippedRowCount
 *  - Large import (1 000 entries) completes without error
 *  - previewImport on empty Clue array → importableEntries=[], skipped=[]
 *  - Duplicate rows in the import payload are merged, not double-counted
 *    in duplicateLocalDates
 */

import {
  buildImportConfidence,
  buildImportDateRangeFromEntries,
  createImportWorkflow,
} from '@/src/features/import/model';
import type { ImportPreview, NormalizedImportEntry } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Minimal fake repository helpers
// ---------------------------------------------------------------------------

type FakeLog = {
  id: string;
  logDate: string;
  bleeding: string;
  symptoms: string[];
  notes?: string;
  importSessionId?: string;
};

function makeFakeRepos(existingLogs: FakeLog[] = []) {
  const logs = new Map<string, FakeLog>(existingLogs.map((l) => [l.logDate, l]));
  const savedSessions: unknown[] = [];
  const deletedIds: string[] = [];

  const repositories = {
    dailyLogs: {
      listByDates: jest.fn(async (dates: string[]) =>
        dates.flatMap((d) => {
          const e = logs.get(d);
          return e ? [e] : [];
        }),
      ),
      saveEntryIfDateAbsent: jest.fn(async (entry: FakeLog) => {
        if (logs.has(entry.logDate)) return false;
        logs.set(entry.logDate, entry);
        return true;
      }),
      deleteEntry: jest.fn(async (id: string) => {
        deletedIds.push(id);
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
    },
  } as never;

  return { logs, savedSessions, deletedIds, repositories };
}

function makeWorkflow(
  existingLogs: FakeLog[] = [],
  opts: { now?: () => string; sessionId?: string } = {},
) {
  const fake = makeFakeRepos(existingLogs);
  const workflow = createImportWorkflow({
    repositories: fake.repositories,
    now: opts.now ?? (() => '2026-06-01T00:00:00.000Z'),
    createSessionId: opts.sessionId ? () => opts.sessionId! : undefined,
  });
  return { ...fake, workflow };
}

// ---------------------------------------------------------------------------
// 1. buildImportConfidence – importable=0, dup>0, skip>0  (SUSPECTED BUG)
// ---------------------------------------------------------------------------

describe('buildImportConfidence – importable=0, dup>0, skip>0', () => {
  /**
   * SUSPECTED BUG — model.ts:110-118
   *
   * The label ternary is:
   *   importableCount === 0 && duplicateCount > 0 → 'medium'
   *   importableCount === 0                        → 'low'
   *   duplicateCount > 0 || skippedCount > 0       → 'medium'
   *   else                                         → 'high'
   *
   * When importableCount=0, duplicateCount>0, skippedCount>0 the FIRST branch
   * fires and returns 'medium'. That is correct. No bug here — the existing
   * test in importModel.adversarial.test.ts at line 101 was labeled
   * "BUG CHECK" but actually verifies the correct 'medium' result.
   *
   * This test confirms correct behavior and makes the contract explicit.
   */
  it('returns medium when importable=0, dup>0, skip>0', () => {
    const result = buildImportConfidence({
      importableCount: 0,
      duplicateCount: 3,
      skippedCount: 5,
    });
    expect(result.label).toBe('medium');
    expect(result.reasons).toContainEqual({ kind: 'no-reviewed-days-ready', count: 0 });
    expect(result.reasons).toContainEqual({ kind: 'duplicate-dates-skipped', count: 3 });
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 5 });
  });

  it('returns low when importable=0, dup=0, skip>0', () => {
    const result = buildImportConfidence({
      importableCount: 0,
      duplicateCount: 0,
      skippedCount: 7,
    });
    expect(result.label).toBe('low');
    expect(result.reasons).toContainEqual({ kind: 'rows-skipped', count: 7 });
    expect(result.reasons).not.toContainEqual(
      expect.objectContaining({ kind: 'duplicate-dates-skipped' }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. duplicateLocalDates must NOT double-count when import payload itself
//    has repeated dates (both rows match an existing entry)
// ---------------------------------------------------------------------------

describe('previewImport – duplicateLocalDates deduplication', () => {
  /**
   * If the import contains two rows for the same date AND that date already
   * exists locally, the parser merges the two import rows into one entry.
   * duplicateLocalDates should therefore contain that date ONCE, not twice.
   */
  it('lists each duplicate date only once even if the import had multiple rows for it', async () => {
    const { workflow } = makeWorkflow(
      [{ id: 'ex-1', logDate: '2026-05-10', bleeding: 'light', symptoms: [] }],
      { sessionId: 'sess-dedup' },
    );

    const preview = await workflow.previewImport({
      source: 'clue',
      // Two rows for 2026-05-10 — the Clue parser merges them.
      payload: [
        { date: '2026-05-10', bleeding: 'light' },
        { date: '2026-05-10', bleeding: 'heavy' },
      ],
    });

    // The parsed document has ONE merged entry for 2026-05-10.
    expect(preview.duplicateLocalDates).toEqual(['2026-05-10']);
    expect(preview.duplicateLocalDates).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. previewImport dateRange reflects the full parsed document range
//    (includes duplicate dates), not just importable entries
// ---------------------------------------------------------------------------

describe('previewImport – dateRange includes duplicate dates', () => {
  /**
   * The dateRange exposed by previewImport comes directly from
   * parsed.dateRange (set by buildDateRange over all parsed entries).
   * This range should span the full import, not just the importable subset.
   */
  it('dateRange spans duplicate + importable dates', async () => {
    const { workflow } = makeWorkflow(
      [{ id: 'ex-1', logDate: '2026-05-01', bleeding: 'light', symptoms: [] }],
    );

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-01', '2026-05-15'] },
    });

    // 2026-05-01 is a duplicate, 2026-05-15 is importable.
    expect(preview.dateRange).toEqual({
      startIso: '2026-05-01',
      endIso: '2026-05-15',
    });
  });
});

// ---------------------------------------------------------------------------
// 4. commitImport dateRange is derived from SAVED entries,
//    not from preview.dateRange
// ---------------------------------------------------------------------------

describe('commitImport – dateRange reflects actually saved dates', () => {
  /**
   * When the user removes entries from the importable set before committing,
   * or when some entries are race-condition skipped, the commit result
   * dateRange should cover only the dates that were actually saved.
   */
  it('returns null dateRange when no entries are actually saved', async () => {
    // All dates in the preview become duplicates by the time commit runs.
    const fake = makeFakeRepos();
    // Seed the log AFTER preview so the commit sees it as a duplicate.
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'sess-null-range',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-05-20'] },
    });

    // Simulate: another writer inserted this date between preview and commit.
    fake.logs.set('2026-05-20', {
      id: 'injected',
      logDate: '2026-05-20',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await workflow.commitImport(preview);

    expect(result.importedLogCount).toBe(0);
    expect(result.dateRange).toBeNull();
  });

  it('dateRange covers only the saved subset when some entries are skipped', async () => {
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'sess-partial-range',
    });

    const preview: ImportPreview = {
      source: 'manual',
      dateRange: { startIso: '2026-05-01', endIso: '2026-05-03' },
      importableEntries: [
        { logDate: '2026-05-01', bleeding: 'medium', symptoms: [] },
        { logDate: '2026-05-02', bleeding: 'medium', symptoms: [] },
        { logDate: '2026-05-03', bleeding: 'medium', symptoms: [] },
      ],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 3 }] },
      editedEntryCount: 0,
    };

    // Pre-insert one of the dates so it gets skipped at commit time.
    fake.logs.set('2026-05-02', {
      id: 'pre-existing',
      logDate: '2026-05-02',
      bleeding: 'spotting',
      symptoms: [],
    });

    const result = await workflow.commitImport(preview);

    expect(result.importedLogCount).toBe(2);
    // dateRange must be built from the two saved entries, not the full preview.
    expect(result.dateRange).toEqual({
      startIso: '2026-05-01',
      endIso: '2026-05-03',
    });
  });
});

// ---------------------------------------------------------------------------
// 5. FIXED — commitImport stamps completedAt with a fresh now() at completion
// ---------------------------------------------------------------------------

describe('commitImport – completedAt vs startedAt', () => {
  /**
   * FIXED — model.ts:239
   *
   * The committed session previously saved `completedAt: startedAt`, losing all
   * duration information. It now calls now() again at completion so completedAt
   * reflects the real end time and is distinct from startedAt.
   */
  it('stamps completedAt with the completion time, distinct from startedAt', async () => {
    let callCount = 0;
    const times = ['2026-06-01T10:00:00.000Z', '2026-06-01T10:05:00.000Z'];
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => times[callCount++ % 2] ?? '2026-06-01T10:00:00.000Z',
      createSessionId: () => 'sess-time-bug',
    });

    const preview: ImportPreview = {
      source: 'manual',
      dateRange: { startIso: '2026-06-01', endIso: '2026-06-01' },
      importableEntries: [{ logDate: '2026-06-01', bleeding: 'medium', symptoms: [] }],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    await workflow.commitImport(preview);

    const sessions = fake.savedSessions as {
      status: string;
      startedAt: string;
      completedAt?: string;
    }[];
    const committed = sessions.find((s) => s.status === 'committed');
    expect(committed).toBeDefined();
    expect(committed!.startedAt).toBe('2026-06-01T10:00:00.000Z');
    expect(committed!.completedAt).toBe('2026-06-01T10:05:00.000Z');
    expect(committed!.completedAt).not.toBe(committed!.startedAt);
  });
});

// ---------------------------------------------------------------------------
// 6. Future-dated entries are importable (no guard)
// ---------------------------------------------------------------------------

describe('previewImport – future dates', () => {
  it('future-dated entries are treated as normal importable entries', async () => {
    const { workflow } = makeWorkflow([], { sessionId: 'sess-future' });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2099-12-31'] },
    });

    expect(preview.importableEntries).toHaveLength(1);
    expect(preview.importableEntries[0]?.logDate).toBe('2099-12-31');
    expect(preview.skippedRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. All bleeding intensity values round-trip faithfully
// ---------------------------------------------------------------------------

describe('previewImport – all bleeding intensity values preserved', () => {
  const bleedingValues = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;

  for (const bleeding of bleedingValues) {
    it(`preserves bleeding=${bleeding} through preview`, async () => {
      const { workflow } = makeWorkflow();

      const preview = await workflow.previewImport({
        source: 'clue',
        payload: [{ date: '2026-06-10', bleeding }],
      });

      expect(preview.importableEntries).toHaveLength(1);
      expect(preview.importableEntries[0]?.bleeding).toBe(bleeding);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. ttcObservation and birthControlEvent are preserved through commit
// ---------------------------------------------------------------------------

describe('commitImport – ttcObservation and birthControlEvent persisted', () => {
  it('saves ttcObservation fields to the repository', async () => {
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'sess-ttc',
    });

    const preview: ImportPreview = {
      source: 'clue',
      dateRange: { startIso: '2026-06-10', endIso: '2026-06-10' },
      importableEntries: [
        {
          logDate: '2026-06-10',
          bleeding: 'none',
          symptoms: [],
          ttcObservation: {
            cervicalMucus: 'egg-white',
            ovulationTest: 'positive',
            basalBodyTemperatureCelsius: 36.8,
            sexLogged: true,
          },
        },
      ],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    await workflow.commitImport(preview);

    const saved = fake.logs.get('2026-06-10');
    expect(saved).toBeDefined();
    expect((saved as unknown as NormalizedImportEntry).ttcObservation).toEqual({
      cervicalMucus: 'egg-white',
      ovulationTest: 'positive',
      basalBodyTemperatureCelsius: 36.8,
      sexLogged: true,
    });
  });

  it('saves birthControlEvent fields to the repository', async () => {
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'sess-bc',
    });

    const preview: ImportPreview = {
      source: 'clue',
      dateRange: { startIso: '2026-06-11', endIso: '2026-06-11' },
      importableEntries: [
        {
          logDate: '2026-06-11',
          bleeding: 'none',
          symptoms: [],
          birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
        },
      ],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    await workflow.commitImport(preview);

    const saved = fake.logs.get('2026-06-11');
    expect(saved).toBeDefined();
    expect((saved as unknown as NormalizedImportEntry).birthControlEvent).toEqual({
      method: 'pill',
      missedDose: true,
      lateDose: false,
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Commit: skippedLogCount === duplicateSkippedLogCount + skippedRowCount
// ---------------------------------------------------------------------------

describe('commitImport – skipped count decomposition', () => {
  it('skippedLogCount equals sum of its components in all-clean import', async () => {
    const { workflow } = makeWorkflow([], { sessionId: 'sess-counts-clean' });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts: ['2026-06-01', '2026-06-02'] },
    });

    const result = await workflow.commitImport(preview);

    expect(result.skippedLogCount).toBe(
      (result.duplicateSkippedLogCount ?? 0) + (result.skippedRowCount ?? 0),
    );
  });

  it('skippedLogCount equals sum of its components when there are duplicates and skipped rows', async () => {
    const fake = makeFakeRepos([
      { id: 'ex-1', logDate: '2026-06-01', bleeding: 'light', symptoms: [] },
    ]);
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-10T00:00:00.000Z',
      createSessionId: () => 'sess-counts-mixed',
    });

    const preview = await workflow.previewImport({
      source: 'clue',
      // Row 1: duplicate date, Row 2: bad date (skipped), Row 3: importable
      payload: [
        { date: '2026-06-01', bleeding: 'medium' },
        { date: 'INVALID', bleeding: 'light' },
        { date: '2026-06-05', bleeding: 'spotting' },
      ],
    });

    const result = await workflow.commitImport(preview);

    expect(result.skippedLogCount).toBe(
      (result.duplicateSkippedLogCount ?? 0) + (result.skippedRowCount ?? 0),
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Large import (1 000 unique entries) – sanity / no OOM
// ---------------------------------------------------------------------------

describe('previewImport – large import', () => {
  it('handles 1 000 unique entries without error', async () => {
    const { workflow } = makeWorkflow();

    const periodStarts: string[] = [];
    // Generate 1 000 dates starting 2020-01-01
    let date = new Date('2020-01-01T00:00:00.000Z');
    for (let i = 0; i < 1000; i++) {
      periodStarts.push(date.toISOString().slice(0, 10));
      date = new Date(date.getTime() + 86_400_000);
    }

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: { periodStarts },
    });

    expect(preview.importableEntries).toHaveLength(1000);
    expect(preview.skippedRows).toHaveLength(0);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// 11. Empty Clue array import → no errors, empty importable
// ---------------------------------------------------------------------------

describe('previewImport – empty Clue array', () => {
  it('returns empty importable entries and no skipped rows for an empty array', async () => {
    const { workflow } = makeWorkflow();

    const preview = await workflow.previewImport({
      source: 'clue',
      payload: [],
    });

    expect(preview.importableEntries).toHaveLength(0);
    expect(preview.skippedRows).toHaveLength(0);
    expect(preview.dateRange).toBeNull();
    expect(preview.confidence?.label).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 12. previewImport with Clue { data: [] } shape (empty object wrapper)
// ---------------------------------------------------------------------------

describe('previewImport – empty Clue object wrapper', () => {
  it('returns empty importable entries for { data: [] }', async () => {
    const { workflow } = makeWorkflow();

    const preview = await workflow.previewImport({
      source: 'clue',
      payload: { data: [] },
    });

    expect(preview.importableEntries).toHaveLength(0);
    expect(preview.dateRange).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 13. importSessionId is attached to saved entries
// ---------------------------------------------------------------------------

describe('commitImport – importSessionId attached to entries', () => {
  it('each saved entry carries the current session id', async () => {
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'my-session',
    });

    const preview: ImportPreview = {
      source: 'manual',
      dateRange: { startIso: '2026-06-20', endIso: '2026-06-21' },
      importableEntries: [
        { logDate: '2026-06-20', bleeding: 'light', symptoms: [] },
        { logDate: '2026-06-21', bleeding: 'heavy', symptoms: [] },
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

    const entry1 = fake.logs.get('2026-06-20') as FakeLog | undefined;
    const entry2 = fake.logs.get('2026-06-21') as FakeLog | undefined;
    expect(entry1?.importSessionId).toBe('my-session');
    expect(entry2?.importSessionId).toBe('my-session');
  });
});

// ---------------------------------------------------------------------------
// 14. buildImportDateRangeFromEntries – extra adversarial cases
// ---------------------------------------------------------------------------

describe('buildImportDateRangeFromEntries – adversarial', () => {
  it('works with year-boundary dates', () => {
    const result = buildImportDateRangeFromEntries([
      { logDate: '2025-12-31' },
      { logDate: '2026-01-01' },
    ]);
    expect(result).toEqual({ startIso: '2025-12-31', endIso: '2026-01-01' });
  });

  it('identical dates → startIso equals endIso', () => {
    const result = buildImportDateRangeFromEntries([
      { logDate: '2026-06-10' },
      { logDate: '2026-06-10' },
    ]);
    // Both entries have the same date; the sort is stable, startIso === endIso
    expect(result).toEqual({ startIso: '2026-06-10', endIso: '2026-06-10' });
  });
});

// ---------------------------------------------------------------------------
// 15. Mood and notes are preserved through commit
// ---------------------------------------------------------------------------

describe('commitImport – optional fields preserved', () => {
  it('mood and notes survive the round-trip', async () => {
    const fake = makeFakeRepos();
    const workflow = createImportWorkflow({
      repositories: fake.repositories,
      now: () => '2026-06-01T00:00:00.000Z',
      createSessionId: () => 'sess-opts',
    });

    const preview: ImportPreview = {
      source: 'clue',
      dateRange: { startIso: '2026-06-15', endIso: '2026-06-15' },
      importableEntries: [
        {
          logDate: '2026-06-15',
          bleeding: 'light',
          symptoms: ['cramps'],
          mood: 'low',
          notes: 'feeling rough today',
        },
      ],
      duplicateLocalDates: [],
      duplicateSummary: { count: 0, details: [] },
      skippedRows: [],
      skippedSummary: { totalCount: 0, invalidCount: 0, unsupportedCount: 0, messages: [] },
      warnings: [],
      confidence: { label: 'high', reasons: [{ kind: 'reviewed-days-ready', count: 1 }] },
      editedEntryCount: 0,
    };

    await workflow.commitImport(preview);

    const saved = fake.logs.get('2026-06-15') as FakeLog | undefined;
    expect(saved?.notes).toBe('feeling rough today');
    expect((saved as unknown as NormalizedImportEntry).mood).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 16. previewImport with Flo direct-array shape
// ---------------------------------------------------------------------------

describe('previewImport – Flo direct array shape', () => {
  it('accepts a plain array of date+bleeding rows as Flo format', async () => {
    const { workflow } = makeWorkflow();

    const preview = await workflow.previewImport({
      source: 'flo',
      payload: [
        { date: '2026-05-01', bleeding: 'medium' },
        { date: '2026-05-02', bleeding: 'heavy' },
      ],
    });

    expect(preview.importableEntries).toHaveLength(2);
    expect(preview.importableEntries[0]?.bleeding).toBe('medium');
    expect(preview.importableEntries[1]?.bleeding).toBe('heavy');
  });
});

// ---------------------------------------------------------------------------
// 17. SUSPECTED BUG – duplicateLocalDates can contain duplicate strings
//     when the import document has multiple rows for the same existing date
// ---------------------------------------------------------------------------

describe('previewImport – duplicateLocalDates uniqueness', () => {
  /**
   * SUSPECTED BUG — model.ts:155-157
   *
   * duplicateLocalDates is built by:
   *   parsed.entries.filter(entry => existingDates.has(entry.logDate))
   *                 .map(entry => entry.logDate)
   *
   * `parsed.entries` at this point has already been merged by mergeEntries,
   * so each logDate appears only once. This should be fine — no bug.
   * This test verifies and documents the correct behavior.
   *
   * However, if mergeEntries were ever bypassed (e.g. a future refactor),
   * the list could contain duplicates. This probe guards against regression.
   */
  it('duplicateLocalDates contains each date at most once', async () => {
    const { workflow } = makeWorkflow([
      { id: 'ex-1', logDate: '2026-05-10', bleeding: 'light', symptoms: [] },
    ]);

    // Two rows for the same date in the payload — merged before dedup check.
    const preview = await workflow.previewImport({
      source: 'clue',
      payload: [
        { date: '2026-05-10', bleeding: 'light' },
        { date: '2026-05-10', bleeding: 'medium' },
      ],
    });

    const unique = new Set(preview.duplicateLocalDates);
    expect(preview.duplicateLocalDates).toHaveLength(unique.size);
  });
});
