import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');

function createRepositories() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return createDomainRepositories(db);
}

describe('daily log repository', () => {
  it('lists every entry in date order for private timeline hydration', async () => {
    const repositories = createRepositories();

    await repositories.importSessions.saveSession({
      id: 'import-session-1',
      source: 'clue',
      status: 'committed',
      startedAt: '2026-04-01T08:00:00.000Z',
      completedAt: '2026-04-01T08:05:00.000Z',
      importedLogCount: 1,
      skippedLogCount: 0,
    });

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2025-04-01',
      logDate: '2025-04-01',
      bleeding: 'medium',
      symptoms: ['cramps'],
      notes: 'Older imported history.',
      importSessionId: 'import-session-1',
    });

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-01',
      logDate: '2026-04-01',
      bleeding: 'light',
      symptoms: ['fatigue'],
      ttcObservation: {
        ovulationTest: 'positive',
      },
      birthControlEvent: {
        method: 'pill',
        lateDose: true,
      },
    });

    await expect(repositories.dailyLogs.listAll()).resolves.toEqual([
      {
        id: 'daily-log-2025-04-01',
        logDate: '2025-04-01',
        bleeding: 'medium',
        symptoms: ['cramps'],
        notes: 'Older imported history.',
        importSessionId: 'import-session-1',
      },
      {
        id: 'daily-log-2026-04-01',
        logDate: '2026-04-01',
        bleeding: 'light',
        symptoms: ['fatigue'],
        ttcObservation: {
          ovulationTest: 'positive',
        },
        birthControlEvent: {
          method: 'pill',
          lateDose: true,
        },
      },
    ]);
  });

  it('lists entries for a set of exact dates without overwriting by date', async () => {
    const repositories = createRepositories();

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-01',
      logDate: '2026-04-01',
      bleeding: 'light',
      symptoms: ['cramps'],
    });

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-03',
      logDate: '2026-04-03',
      bleeding: 'heavy',
      symptoms: ['fatigue'],
    });

    await repositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-02',
      logDate: '2026-04-02',
      bleeding: 'medium',
      symptoms: ['bloating'],
    });

    await expect(
      repositories.dailyLogs.listByDates(['2026-04-03', '2026-04-01', '2026-04-99']),
    ).resolves.toEqual([
      {
        id: 'daily-log-2026-04-01',
        logDate: '2026-04-01',
        bleeding: 'light',
        symptoms: ['cramps'],
      },
      {
        id: 'daily-log-2026-04-03',
        logDate: '2026-04-03',
        bleeding: 'heavy',
        symptoms: ['fatigue'],
      },
    ]);
  });
});
