import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

import {
  appPreferencesTable,
  backupEventsTable,
  billingSnapshotTable,
  birthControlEventsTable,
  dailyLogsTable,
  dailyLogSymptomsTable,
  importSessionsTable,
  privacyPreferencesTable,
  reminderPreferencesTable,
  ttcObservationsTable,
  userProfileConditionsTable,
  userProfileGoalsTable,
  userProfileTable,
} from '@/src/db/schema';

describe('schema metadata', () => {
  it('keeps normalized indexes and foreign keys on the core relational tables', () => {
    const appPreferencesConfig = getTableConfig(appPreferencesTable);
    const backupEventsConfig = getTableConfig(backupEventsTable);
    const billingSnapshotConfig = getTableConfig(billingSnapshotTable);
    const userProfileConfig = getTableConfig(userProfileTable);
    const userProfileGoalsConfig = getTableConfig(userProfileGoalsTable);
    const userProfileConditionsConfig = getTableConfig(userProfileConditionsTable);
    const dailyLogsConfig = getTableConfig(dailyLogsTable);
    const dailyLogSymptomsConfig = getTableConfig(dailyLogSymptomsTable);
    const ttcObservationsConfig = getTableConfig(ttcObservationsTable);
    const birthControlEventsConfig = getTableConfig(birthControlEventsTable);
    const reminderPreferencesConfig = getTableConfig(reminderPreferencesTable);
    const privacyPreferencesConfig = getTableConfig(privacyPreferencesTable);

    expect(appPreferencesConfig.columns.map((column) => column.name)).toEqual([
      'id',
      'has_completed_onboarding',
      'deferred_cycle_setup',
      'deferred_tracking_setup',
      'deferred_biometrics_setup',
      'deferred_reminder_setup',
      'deferred_import_setup',
      'dismissed_tailoring_checklist',
      'show_fertility_estimates',
      'haptics_enabled',
      'tap_sound_enabled',
      'theme_preference',
      'locale_preference',
      'dismissed_anomaly_ids',
      'created_at',
      'updated_at',
    ]);
    expect(appPreferencesConfig.indexes).toHaveLength(0);

    expect(backupEventsConfig.columns.map((column) => column.name)).toEqual([
      'id',
      'action',
      'occurred_at',
      'detail',
      'created_at',
    ]);
    expect(backupEventsConfig.indexes).toHaveLength(1);

    expect(billingSnapshotConfig.columns.map((column) => column.name)).toEqual([
      'id',
      'access_state',
      'plan_id',
      'trial_ends_at',
      'first_charge_at',
      'expires_at',
      'last_synced_at',
      'reminder_scheduled_for',
      'grandfather_trial_applied',
      'lifetime_trial_started_at',
      'created_at',
      'updated_at',
    ]);
    expect(billingSnapshotConfig.indexes).toHaveLength(0);

    expect(userProfileConfig.columns.map((column) => column.name)).toEqual([
      'id',
      'cycle_length_days',
      'period_length_days',
      'last_period_start_date',
      'supports_irregular_cycles',
      'ttc_tracking_sex',
      'ttc_tracking_ovulation_test',
      'ttc_tracking_cervical_mucus',
      'ttc_tracking_basal_body_temperature',
      'birth_control_method',
      'iud_type',
      'created_at',
      'updated_at',
    ]);

    expect(userProfileGoalsConfig.foreignKeys).toHaveLength(1);
    expect(userProfileGoalsConfig.indexes).toHaveLength(1);
    expect(userProfileGoalsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      userProfileTable,
    );

    expect(userProfileConditionsConfig.foreignKeys).toHaveLength(1);
    expect(userProfileConditionsConfig.indexes).toHaveLength(1);
    expect(userProfileConditionsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      userProfileTable,
    );

    expect(dailyLogsConfig.foreignKeys).toHaveLength(1);
    expect(dailyLogsConfig.indexes).toHaveLength(2);
    expect(dailyLogsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      importSessionsTable,
    );

    expect(dailyLogSymptomsConfig.foreignKeys).toHaveLength(1);
    expect(dailyLogSymptomsConfig.indexes).toHaveLength(1);
    expect(dailyLogSymptomsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      dailyLogsTable,
    );

    expect(ttcObservationsConfig.foreignKeys).toHaveLength(1);
    expect(ttcObservationsConfig.indexes).toHaveLength(1);
    expect(ttcObservationsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      dailyLogsTable,
    );

    expect(birthControlEventsConfig.foreignKeys).toHaveLength(1);
    expect(birthControlEventsConfig.indexes).toHaveLength(1);
    expect(birthControlEventsConfig.foreignKeys[0]?.reference().foreignTable).toBe(
      dailyLogsTable,
    );

    expect(reminderPreferencesConfig.indexes).toHaveLength(1);
    expect(privacyPreferencesConfig.columns.map((column) => column.name)).toEqual([
      'id',
      'biometrics_enabled',
      'relock_after_seconds',
      'destructive_action_confirmation_required',
      'diagnostics_consent_enabled',
      'created_at',
      'updated_at',
    ]);
  });

  it('rewrites the billing snapshot table in 0010 while preserving supported snapshot fields', () => {
    const sqlite = new Database(':memory:');
    const migrationsDirectory = path.resolve(__dirname, '../../drizzle');
    const migrationFiles = [
      '0004_phase4_billing_snapshot.sql',
      '0009_phase12_complimentary_access.sql',
      '0010_phase13_native_store_billing.sql',
    ];

    for (const migrationFile of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFile), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        sqlite.exec(statement);
      }

      if (migrationFile === '0009_phase12_complimentary_access.sql') {
        sqlite
          .prepare(
            `UPDATE billing_snapshot
             SET access_state = ?, plan_id = ?, trial_ends_at = ?, first_charge_at = ?, expires_at = ?, last_synced_at = ?, reminder_scheduled_for = ?, access_source = ?, complimentary_kind = ?, support_id = ?
             WHERE id = ?`,
          )
          .run(
            'complimentary_active',
            'annual',
            '2026-05-09T10:00:00.000Z',
            '2026-05-09T10:00:00.000Z',
            '2026-05-09T10:00:00.000Z',
            '2026-04-10T12:00:00.000Z',
            '2026-05-06T09:00:00.000Z',
            'complimentary',
            '30_day',
            '$RCAnonymousID:test',
            'billing-snapshot',
          );
      }
    }

    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('billing_snapshot') ORDER BY cid")
      .all()
      .map((row) => (row as { name: string }).name);
    const snapshotRow = sqlite
      .prepare(
        `SELECT id, access_state, plan_id, trial_ends_at, first_charge_at, expires_at, last_synced_at, reminder_scheduled_for
         FROM billing_snapshot
         WHERE id = ?`,
      )
      .get('billing-snapshot') as Record<string, string | null>;

    expect(columns).toEqual([
      'id',
      'access_state',
      'plan_id',
      'trial_ends_at',
      'first_charge_at',
      'expires_at',
      'last_synced_at',
      'reminder_scheduled_for',
      'created_at',
      'updated_at',
    ]);
    expect(snapshotRow).toEqual({
      id: 'billing-snapshot',
      access_state: 'complimentary_active',
      plan_id: 'annual',
      trial_ends_at: '2026-05-09T10:00:00.000Z',
      first_charge_at: '2026-05-09T10:00:00.000Z',
      expires_at: '2026-05-09T10:00:00.000Z',
      last_synced_at: '2026-04-10T12:00:00.000Z',
      reminder_scheduled_for: '2026-05-06T09:00:00.000Z',
    });

    sqlite.close();
  });

  it('backfills interaction feedback defaults when 0011 upgrades an existing app_preferences row', () => {
    const sqlite = new Database(':memory:');
    const migrationsDirectory = path.resolve(__dirname, '../../drizzle');
    const migrationFiles = [
      '0000_natural_power_pack.sql',
      '0006_phase10_theme_preference.sql',
      '0007_phase11_locale_preference.sql',
    ];

    for (const migrationFile of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, migrationFile), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        sqlite.exec(statement);
      }
    }

    sqlite
      .prepare(
        `UPDATE app_preferences
         SET has_completed_onboarding = ?, deferred_biometrics_setup = ?, deferred_reminder_setup = ?, deferred_import_setup = ?, theme_preference = ?, locale_preference = ?
         WHERE id = ?`,
      )
      .run(1, 1, 0, 1, 'dark', 'ja', 'app-preferences');

    const upgradeSql = fs.readFileSync(
      path.join(migrationsDirectory, '0011_phase14_interaction_feedback.sql'),
      'utf8',
    );
    const upgradeStatements = upgradeSql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of upgradeStatements) {
      sqlite.exec(statement);
    }

    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('app_preferences') ORDER BY cid")
      .all()
      .map((row) => (row as { name: string }).name);
    const preferencesRow = sqlite
      .prepare(
        `SELECT
            has_completed_onboarding,
            deferred_biometrics_setup,
            deferred_reminder_setup,
            deferred_import_setup,
            haptics_enabled,
            tap_sound_enabled,
            theme_preference,
            locale_preference
         FROM app_preferences
         WHERE id = ?`,
      )
      .get('app-preferences') as Record<string, number | string>;

    expect(columns).toEqual([
      'id',
      'has_completed_onboarding',
      'deferred_biometrics_setup',
      'deferred_reminder_setup',
      'deferred_import_setup',
      'created_at',
      'updated_at',
      'theme_preference',
      'locale_preference',
      'haptics_enabled',
      'tap_sound_enabled',
    ]);
    expect(preferencesRow).toEqual({
      has_completed_onboarding: 1,
      deferred_biometrics_setup: 1,
      deferred_reminder_setup: 0,
      deferred_import_setup: 1,
      haptics_enabled: 1,
      tap_sound_enabled: 0,
      theme_preference: 'dark',
      locale_preference: 'ja',
    });

    sqlite.close();
  });
});
