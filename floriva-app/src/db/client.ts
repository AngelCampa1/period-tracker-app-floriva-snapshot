import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { schema } from '@/src/db/schema';

const sqlite = openDatabaseSync('floriva.db');

sqlite.execSync('PRAGMA foreign_keys = ON;');

export const florivaSqlite = sqlite;
export const florivaDb = drizzle(sqlite, { schema });
