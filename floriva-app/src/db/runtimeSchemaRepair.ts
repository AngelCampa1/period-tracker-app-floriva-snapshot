import { florivaSqlite } from '@/src/db/client';

type SqliteRepairDatabase = Pick<typeof florivaSqlite, 'execSync' | 'getAllSync'>;

type RepairStep = {
  tableName: string;
  columnName: string;
  statement: string;
};

// Idempotent add-only repairs that reconcile a device's on-disk schema with
// columns introduced by migrations that may have been silently skipped (the
// journal's hand-authored, out-of-order `when` timestamps can leave some
// migrations un-applied on some installs). Add-column only -- never
// destructive. A step whose table is absent is skipped (a fresh DB will have
// the column created by the migration itself).
const repairSteps: RepairStep[] = [
  {
    tableName: 'app_preferences',
    columnName: 'haptics_enabled',
    statement:
      'ALTER TABLE `app_preferences` ADD `haptics_enabled` integer DEFAULT true NOT NULL;',
  },
  {
    tableName: 'app_preferences',
    columnName: 'tap_sound_enabled',
    statement:
      'ALTER TABLE `app_preferences` ADD `tap_sound_enabled` integer DEFAULT false NOT NULL;',
  },
  {
    tableName: 'app_preferences',
    columnName: 'show_fertility_estimates',
    statement:
      'ALTER TABLE `app_preferences` ADD `show_fertility_estimates` integer DEFAULT true NOT NULL;',
  },
  {
    tableName: 'app_preferences',
    columnName: 'dismissed_anomaly_ids',
    statement:
      "ALTER TABLE `app_preferences` ADD `dismissed_anomaly_ids` text DEFAULT '[]' NOT NULL;",
  },
  {
    tableName: 'user_profile',
    columnName: 'iud_type',
    statement: 'ALTER TABLE `user_profile` ADD `iud_type` text;',
  },
  {
    tableName: 'billing_snapshot',
    columnName: 'lifetime_trial_started_at',
    statement:
      'ALTER TABLE `billing_snapshot` ADD `lifetime_trial_started_at` text;',
  },
];

export async function repairRuntimeSchemaIfNeeded(
  database: SqliteRepairDatabase = florivaSqlite,
) {
  const columnsByTable = new Map<string, Set<string>>();
  const existingColumnsFor = (tableName: string): Set<string> => {
    let columns = columnsByTable.get(tableName);
    if (!columns) {
      columns = new Set(
        database
          .getAllSync<{ name: string }>(
            `SELECT name FROM pragma_table_info('${tableName}')`,
          )
          .map((column) => column.name),
      );
      columnsByTable.set(tableName, columns);
    }
    return columns;
  };

  for (const repairStep of repairSteps) {
    const existingColumns = existingColumnsFor(repairStep.tableName);
    // Absent table (0 columns) => fresh DB; the migration will create it.
    if (existingColumns.size === 0) {
      continue;
    }
    if (!existingColumns.has(repairStep.columnName)) {
      database.execSync(repairStep.statement);
      existingColumns.add(repairStep.columnName);
    }
  }
}
