import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');

export async function createWave5AcceptanceHarness() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return {
    repositories: createDomainRepositories(db),
    close: () => sqlite.close(),
  };
}
