import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import { createImportWorkflow } from '@/src/features/import/model';

const migrationDirectory = path.resolve(__dirname, '../../../drizzle');

function createRepositories() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return createDomainRepositories(db);
}

describe('import workflow', () => {
  it('reports merged rows, local duplicates, skipped rows, warnings, and date range before commit', async () => {
    const repositories = createRepositories();

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-10',
      logDate: '2026-04-10',
      bleeding: 'medium',
      symptoms: [],
      notes: 'Keep this local log unchanged.',
    });

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-09T08:00:00.000Z',
      createSessionId: () => 'import-session-1',
    });

    const preview = await workflow.previewImport({
      source: 'clue',
      payload: {
        trackedData: [
          {
            date: '2026-04-08',
            bleeding: 'light',
            symptoms: ['cramps', 'not-a-symptom'],
          },
          {
            date: '2026-04-08',
            bleeding: 'heavy',
            symptoms: ['fatigue'],
          },
          {
            date: '2026-04-10',
            bleeding: 'medium',
          },
          {
            date: 'bad-date',
            bleeding: 'spotting',
          },
        ],
      },
    });

    expect(preview.importableEntries).toEqual([
      {
        logDate: '2026-04-08',
        bleeding: 'heavy',
        symptoms: ['cramps', 'fatigue'],
      },
    ]);
    expect(preview.duplicateLocalDates).toEqual(['2026-04-10']);
    expect(preview.skippedRows).toEqual([
      {
        rowNumber: 4,
        reason: 'invalid',
        message: 'Row 4 has an invalid date.',
      },
    ]);
    expect(preview.dateRange).toEqual({
      startIso: '2026-04-08',
      endIso: '2026-04-10',
    });
    expect(preview.confidence).toEqual({
      label: 'medium',
      reasons: [
        { kind: 'reviewed-days-ready', count: 1 },
        { kind: 'duplicate-dates-skipped', count: 1 },
        { kind: 'rows-skipped', count: 1 },
      ],
    });
    expect(preview.duplicateSummary).toEqual({
      count: 1,
      details: [
        {
          action: 'skipped',
          existingEntryId: 'daily-log-2026-04-10',
          logDate: '2026-04-10',
        },
      ],
    });
    expect(preview.skippedSummary).toEqual({
      totalCount: 1,
      invalidCount: 1,
      unsupportedCount: 0,
      messages: ['Row 4 has an invalid date.'],
    });
    expect(preview.editedEntryCount).toBe(0);
    expect(preview.warnings).toEqual([
      'Ignored 1 unsupported symptom value on row 1.',
      'Merged 2 Clue rows for 2026-04-08.',
    ]);
  });

  it('creates a pending import session, writes only non-conflicting entries, and finalizes committed counts', async () => {
    const repositories = createRepositories();

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-11',
      logDate: '2026-04-11',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing local entry.',
    });

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-2',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: {
        periodStarts: ['2026-04-09', '2026-04-10', '2026-04-11', '2026-04-11'],
      },
    });

    expect(preview.importableEntries).toEqual([
      {
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-10',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
    expect(preview.duplicateLocalDates).toEqual(['2026-04-11']);
    expect(preview.warnings).toEqual([
      'Merged 2 manual period-history rows for 2026-04-11.',
    ]);

    const commitResult = await workflow.commitImport(preview);

    expect(commitResult).toEqual({
      importSessionId: 'import-session-2',
      source: 'manual',
      dateRange: {
        startIso: '2026-04-09',
        endIso: '2026-04-10',
      },
      importedLogCount: 2,
      skippedLogCount: 1,
      duplicateSkippedLogCount: 1,
      skippedRowCount: 0,
      unsupportedSkippedRowCount: 0,
      invalidSkippedRowCount: 0,
      editedEntryCount: 0,
    });

    expect(await repositories.importSessions.getSession('import-session-2')).toEqual({
      id: 'import-session-2',
      source: 'manual',
      status: 'committed',
      startedAt: '2026-04-10T09:30:00.000Z',
      completedAt: '2026-04-10T09:30:00.000Z',
      importedLogCount: 2,
      skippedLogCount: 1,
    });

    const savedEntries = await repositories.dailyLogs.listByDates([
      '2026-04-09',
      '2026-04-10',
      '2026-04-11',
    ]);

    expect(savedEntries).toHaveLength(3);
    expect(savedEntries[0]).toMatchObject({
      logDate: '2026-04-09',
      bleeding: 'medium',
      symptoms: [],
      importSessionId: 'import-session-2',
    });
    expect(savedEntries[1]).toMatchObject({
      logDate: '2026-04-10',
      bleeding: 'medium',
      symptoms: [],
      importSessionId: 'import-session-2',
    });
    expect(savedEntries[2]).toMatchObject({
      logDate: '2026-04-11',
      bleeding: 'light',
      symptoms: ['cramps'],
      notes: 'Existing local entry.',
    });
  });

  it('returns the committed date range after reviewed rows are removed before commit', async () => {
    const repositories = createRepositories();
    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-edited-range',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: {
        periodStarts: ['2026-04-09', '2026-04-10', '2026-04-11'],
      },
    });

    const commitResult = await workflow.commitImport({
      ...preview,
      importableEntries: preview.importableEntries.filter(
        (entry) => entry.logDate === '2026-04-10',
      ),
      dateRange: {
        startIso: '2026-04-09',
        endIso: '2026-04-11',
      },
      editedEntryCount: 2,
    });

    expect(commitResult).toMatchObject({
      dateRange: {
        startIso: '2026-04-10',
        endIso: '2026-04-10',
      },
      importedLogCount: 1,
      editedEntryCount: 2,
    });
  });

  it('previews public-source Flo cycle containers as importable bleeding days', async () => {
    const repositories = createRepositories();
    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-flo-public-shape',
    });

    const preview = await workflow.previewImport({
      source: 'flo',
      payload: {
        operationalData: {
          cycles: [
            {
              period_start_date: '2026-04-14T00:00:00.000Z',
              period_end_date: '2026-04-16T00:00:00.000Z',
            },
          ],
        },
      },
    });

    expect(preview.importableEntries).toEqual([
      {
        logDate: '2026-04-14',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-15',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        logDate: '2026-04-16',
        bleeding: 'medium',
        symptoms: [],
      },
    ]);
    expect(preview.skippedRows).toEqual([]);
    expect(preview.warnings).toEqual([]);
  });

  it('does not label duplicate-only previews as low-confidence parsing', async () => {
    const repositories = createRepositories();

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-09',
      logDate: '2026-04-09',
      bleeding: 'medium',
      symptoms: [],
    });

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-duplicate-only',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: {
        periodStarts: ['2026-04-09'],
      },
    });

    expect(preview.importableEntries).toEqual([]);
    expect(preview.duplicateLocalDates).toEqual(['2026-04-09']);
    expect(preview.skippedRows).toEqual([]);
    expect(preview.confidence).toEqual({
      label: 'medium',
      reasons: [
        { kind: 'no-reviewed-days-ready', count: 0 },
        { kind: 'duplicate-dates-skipped', count: 1 },
      ],
    });
  });

  it('skips entries that become duplicated locally between preview and commit', async () => {
    const repositories = createRepositories();

    const workflow = createImportWorkflow({
      repositories,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-concurrent',
    });

    const preview = await workflow.previewImport({
      source: 'manual',
      payload: {
        periodStarts: ['2026-04-09', '2026-04-10'],
      },
    });

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-10',
      logDate: '2026-04-10',
      bleeding: 'medium',
      symptoms: [],
      notes: 'Inserted after preview.',
    });

    const commitResult = await workflow.commitImport(preview);

    expect(commitResult).toEqual({
      importSessionId: 'import-session-concurrent',
      source: 'manual',
      dateRange: {
        startIso: '2026-04-09',
        endIso: '2026-04-09',
      },
      importedLogCount: 1,
      skippedLogCount: 1,
      duplicateSkippedLogCount: 1,
      skippedRowCount: 0,
      unsupportedSkippedRowCount: 0,
      invalidSkippedRowCount: 0,
      editedEntryCount: 0,
    });
  });

  it('returns a committed date range from successfully saved entries when a guarded save skips a row', async () => {
    const workflow = createImportWorkflow({
      repositories: {
        dailyLogs: {
          listByDates: jest.fn().mockResolvedValue([]),
          saveEntryIfDateAbsent: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
        },
        importSessions: {
          saveSession: jest.fn().mockResolvedValue(undefined),
        },
      } as never,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-guarded-skip',
    });

    const commitResult = await workflow.commitImport({
      source: 'manual',
      dateRange: {
        startIso: '2026-04-09',
        endIso: '2026-04-10',
      },
      importableEntries: [
        {
          logDate: '2026-04-09',
          bleeding: 'medium',
          symptoms: [],
        },
        {
          logDate: '2026-04-10',
          bleeding: 'medium',
          symptoms: [],
        },
      ],
      duplicateLocalDates: [],
      skippedRows: [],
      warnings: [],
    });

    expect(commitResult).toMatchObject({
      dateRange: {
        startIso: '2026-04-09',
        endIso: '2026-04-09',
      },
      importedLogCount: 1,
      skippedLogCount: 1,
      duplicateSkippedLogCount: 1,
    });
  });

  it('marks the import session as failed when saving a reviewed entry throws', async () => {
    const savedSessions: unknown[] = [];
    const deletedEntryIds: string[] = [];
    const workflow = createImportWorkflow({
      repositories: {
        dailyLogs: {
          listByDates: jest.fn().mockResolvedValue([]),
          saveEntryIfDateAbsent: jest
            .fn()
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('disk full')),
          deleteEntry: jest.fn(async (entryId) => {
            deletedEntryIds.push(entryId as string);
          }),
        },
        importSessions: {
          saveSession: jest.fn(async (session) => {
            savedSessions.push(session);
          }),
        },
      } as never,
      now: () => '2026-04-10T09:30:00.000Z',
      createSessionId: () => 'import-session-failed',
    });

    await expect(
      workflow.commitImport({
        source: 'manual',
        dateRange: {
          startIso: '2026-04-09',
          endIso: '2026-04-09',
        },
        importableEntries: [
          {
            logDate: '2026-04-09',
            bleeding: 'medium',
            symptoms: [],
          },
          {
            logDate: '2026-04-10',
            bleeding: 'medium',
            symptoms: [],
          },
        ],
        duplicateLocalDates: [],
        skippedRows: [],
        warnings: [],
      }),
    ).rejects.toThrow('disk full');

    expect(savedSessions).toEqual([
      {
        id: 'import-session-failed',
        source: 'manual',
        status: 'pending',
        startedAt: '2026-04-10T09:30:00.000Z',
        importedLogCount: 0,
        skippedLogCount: 0,
      },
      {
        id: 'import-session-failed',
        source: 'manual',
        status: 'failed',
        startedAt: '2026-04-10T09:30:00.000Z',
        completedAt: '2026-04-10T09:30:00.000Z',
        importedLogCount: 0,
        skippedLogCount: 2,
      },
    ]);
    expect(deletedEntryIds).toEqual(['import-import-session-failed-2026-04-09']);
  });

  it('falls back to a generated session id when crypto.randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    const savedSessions: { id: string }[] = [];

    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });

    try {
      const workflow = createImportWorkflow({
        repositories: {
        dailyLogs: {
          listByDates: jest.fn().mockResolvedValue([]),
          saveEntryIfDateAbsent: jest.fn().mockResolvedValue(true),
        },
          importSessions: {
            saveSession: jest.fn(async (session) => {
              savedSessions.push(session as { id: string });
            }),
          },
        } as never,
        now: () => '2026-04-10T09:30:00.000Z',
      });

      const result = await workflow.commitImport({
        source: 'manual',
        dateRange: {
          startIso: '2026-04-09',
          endIso: '2026-04-09',
        },
        importableEntries: [
          {
            logDate: '2026-04-09',
            bleeding: 'medium',
            symptoms: [],
          },
        ],
        duplicateLocalDates: [],
        skippedRows: [],
        warnings: [],
      });

      expect(result.importSessionId).toMatch(/^import-/);
      expect(savedSessions[0]?.id).toBe(result.importSessionId);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });

  it('uses crypto.randomUUID when it is available for generated session ids', async () => {
    const originalCrypto = globalThis.crypto;
    const savedSessions: { id: string }[] = [];

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: jest.fn(() => 'uuid-from-crypto'),
      },
      configurable: true,
    });

    try {
      const workflow = createImportWorkflow({
        repositories: {
        dailyLogs: {
          listByDates: jest.fn().mockResolvedValue([]),
          saveEntryIfDateAbsent: jest.fn().mockResolvedValue(true),
        },
          importSessions: {
            saveSession: jest.fn(async (session) => {
              savedSessions.push(session as { id: string });
            }),
          },
        } as never,
        now: () => '2026-04-10T09:30:00.000Z',
      });

      const result = await workflow.commitImport({
        source: 'manual',
        dateRange: {
          startIso: '2026-04-09',
          endIso: '2026-04-09',
        },
        importableEntries: [
          {
            logDate: '2026-04-09',
            bleeding: 'medium',
            symptoms: [],
          },
        ],
        duplicateLocalDates: [],
        skippedRows: [],
        warnings: [],
      });

      expect(result.importSessionId).toBe('uuid-from-crypto');
      expect(savedSessions[0]?.id).toBe('uuid-from-crypto');
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });

  it('uses the current clock when no custom now callback is supplied', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T09:30:00.000Z'));

    try {
      const repositories = createRepositories();
      const workflow = createImportWorkflow({
        repositories,
        createSessionId: () => 'import-session-default-now',
      });

      const preview = await workflow.previewImport({
        source: 'manual',
        payload: {
          periodStarts: ['2026-04-09'],
        },
      });

      const commitResult = await workflow.commitImport(preview);

      expect(commitResult.importSessionId).toBe('import-session-default-now');
      expect(await repositories.importSessions.getSession('import-session-default-now')).toEqual({
        id: 'import-session-default-now',
        source: 'manual',
        status: 'committed',
        startedAt: '2026-04-10T09:30:00.000Z',
        completedAt: '2026-04-10T09:30:00.000Z',
        importedLogCount: 1,
        skippedLogCount: 0,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('supports Flo JSON fixtures through the full preview and commit flow', async () => {
    const repositories = createRepositories();
    const workflow = createImportWorkflow({
      repositories,
      createSessionId: () => 'import-session-flo',
    });

    const fixturePath = path.resolve(
      __dirname,
      '../../fixtures/data-portability/import/flo-rich-history.json',
    );
    const preview = await workflow.previewImport({
      source: 'flo',
      payload: JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown,
    });

    expect(preview.source).toBe('flo');
    expect(preview.importableEntries).toHaveLength(1);
    expect(preview.importableEntries[0]).toMatchObject({
      logDate: '2026-04-14',
      bleeding: 'medium',
      symptoms: ['fatigue'],
      mood: 'steady',
    });

    const result = await workflow.commitImport(preview);

    expect(result).toEqual({
      importSessionId: 'import-session-flo',
      source: 'flo',
      dateRange: {
        startIso: '2026-04-14',
        endIso: '2026-04-14',
      },
      importedLogCount: 1,
      skippedLogCount: 0,
      duplicateSkippedLogCount: 0,
      skippedRowCount: 0,
      unsupportedSkippedRowCount: 0,
      invalidSkippedRowCount: 0,
      editedEntryCount: 0,
    });
  });
});
