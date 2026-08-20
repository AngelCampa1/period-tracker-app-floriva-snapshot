import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  defaultAppPreferences,
  defaultReviewPromptState,
  defaultReminderPreferences,
  defaultUserProfile,
  mergeReminderPreferences,
} from '@/src/db/domainDefaults';
import { appendDismissedAnomalyId, createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import type {
  AppPreferences,
  BackupEvent,
  BackupSnapshot,
  BillingSnapshot,
  DailyLogEntry,
  ImportSession,
  PrivacyPreference,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');
const initialMigrationPath = path.join(migrationDirectory, '0000_natural_power_pack.sql');
const upgradeMigrationPath = path.join(migrationDirectory, '0001_wise_killmonger.sql');
const tableNames = {
  appPreferences: 'app_preferences',
  backupEvents: 'backup_events',
  billingSnapshot: 'billing_snapshot',
  birthControlEvents: 'birth_control_events',
  dailyLogs: 'daily_logs',
  dailyLogSymptoms: 'daily_log_symptoms',
  importSessions: 'import_sessions',
  privacyPreferences: 'privacy_preferences',
  reviewPromptSaveEvents: 'review_prompt_save_events',
  reviewPromptState: 'review_prompt_state',
  reminderPreferences: 'reminder_preferences',
  ttcObservations: 'ttc_observations',
  userProfile: 'user_profile',
  userProfileConditions: 'user_profile_conditions',
  userProfileGoals: 'user_profile_goals',
} as const;

function applyGeneratedMigrations(database: Database.Database) {
  const db = drizzle(database, { schema });
  migrate(db, { migrationsFolder: migrationDirectory });
}

function applySqlMigration(database: Database.Database, migrationPath: string) {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmedStatement = statement.trim();

    if (trimmedStatement.length > 0) {
      database.exec(trimmedStatement);
    }
  }
}

function createTestHarness() {
  const sqlite = new Database(':memory:');
  applyGeneratedMigrations(sqlite);

  const db = drizzle(sqlite, { schema });
  const repositories = createDomainRepositories(db);

  return { sqlite, repositories };
}

function createBackupSnapshotFixture(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-04-10T15:00:00.000Z',
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredReminderSetup: true,
      themePreference: 'system',
      localePreference: 'system',
    },
    billingSnapshot: {
      accessState: 'subscribed',
      planId: 'annual',
      trialEndsAt: '2026-04-01T09:00:00.000Z',
      firstChargeAt: '2026-04-15T09:00:00.000Z',
      expiresAt: '2027-04-15T09:00:00.000Z',
      lastSyncedAt: '2026-04-10T09:00:00.000Z',
      reminderScheduledFor: undefined,
    },
    userProfile: {
      cycleLengthDays: 30,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-05',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    },
    reminderPreferences: [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 8,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ],
    privacyPreference: {
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [
      {
        id: 'snapshot-import-1',
        source: 'clue',
        status: 'committed',
        startedAt: '2026-04-09T08:00:00.000Z',
        completedAt: '2026-04-09T08:05:00.000Z',
        importedLogCount: 2,
        skippedLogCount: 1,
      },
    ],
    dailyLogs: [
      {
        id: 'snapshot-log-1',
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: ['cramps', 'fatigue'],
        mood: 'sensitive',
        notes: 'Imported from Clue.',
        ttcObservation: {
          cervicalMucus: 'creamy',
          ovulationTest: 'positive',
          basalBodyTemperatureCelsius: undefined,
          sexLogged: true,
        },
        birthControlEvent: {
          method: 'pill',
          missedDose: undefined,
          lateDose: true,
        },
        importSessionId: 'snapshot-import-1',
      },
      {
        id: 'snapshot-log-2',
        logDate: '2026-04-10',
        bleeding: 'light',
        symptoms: ['bloating'],
        mood: 'steady',
        notes: 'Follow-up day.',
        ttcObservation: undefined,
        birthControlEvent: undefined,
        importSessionId: undefined,
      },
    ],
  };
}

describe('domain data layer', () => {
  it('bootstraps singleton defaults and keeps them idempotent across repeated migrations', async () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });

    applyGeneratedMigrations(sqlite);
    applyGeneratedMigrations(sqlite);

    const repositories = createDomainRepositories(db);

    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.billingSnapshot}`).get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.appPreferences}`).get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.privacyPreferences}`).get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reviewPromptState}`).get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reminderPreferences}`).get(),
    ).toEqual({ count: 4 });

    await expect(repositories.billingSnapshot.getSnapshot()).resolves.toEqual({
      accessState: 'needs_purchase',
    });
    await expect(repositories.reminderPreferences.getPreferences()).resolves.toEqual([
      {
        kind: 'daily-log',
        enabled: false,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 8,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);
    await expect(repositories.reviewPromptState.getState()).resolves.toEqual(
      defaultReviewPromptState,
    );
  });

  it('round-trips the grandfatherTrialApplied flag through the billing snapshot table', async () => {
    const { repositories } = createTestHarness();

    const grandfatheredSnapshot: BillingSnapshot = {
      accessState: 'expired',
      grandfatherTrialApplied: true,
    };

    await repositories.billingSnapshot.saveSnapshot(grandfatheredSnapshot);

    expect(await repositories.billingSnapshot.getSnapshot()).toEqual(
      grandfatheredSnapshot,
    );
    expect(
      (await repositories.billingSnapshot.getSnapshot()).grandfatherTrialApplied,
    ).toBe(true);

    const withoutFlag: BillingSnapshot = {
      accessState: 'needs_purchase',
    };

    await repositories.billingSnapshot.saveSnapshot(withoutFlag);

    const reloaded = await repositories.billingSnapshot.getSnapshot();
    expect(reloaded.grandfatherTrialApplied).toBeFalsy();
    expect(reloaded).toEqual(withoutFlag);
  });

  it('round-trips the lifetimeTrialStartedAt marker through the billing snapshot table', async () => {
    const { repositories } = createTestHarness();

    // Dates must stay in the future: getSnapshot() runs the row through
    // normalizeBillingSnapshot(), which downgrades a trial whose end date has
    // passed to `expired`. A fixed near-term date turns this into a test that
    // silently starts failing once that day arrives.
    const lifetimeTrialSnapshot: BillingSnapshot = {
      accessState: 'trial_active',
      planId: 'lifetime',
      trialEndsAt: '2099-08-08T12:00:00.000Z',
      lifetimeTrialStartedAt: '2099-07-08T12:00:00.000Z',
    };

    await repositories.billingSnapshot.saveSnapshot(lifetimeTrialSnapshot);

    expect(await repositories.billingSnapshot.getSnapshot()).toEqual(
      lifetimeTrialSnapshot,
    );

    const withoutMarker: BillingSnapshot = {
      accessState: 'needs_purchase',
    };

    await repositories.billingSnapshot.saveSnapshot(withoutMarker);

    const reloaded = await repositories.billingSnapshot.getSnapshot();
    expect(reloaded.lifetimeTrialStartedAt).toBeUndefined();
    expect(reloaded).toEqual(withoutMarker);
  });

  it('tracks local review prompt state and successful-save events outside backup data', async () => {
    const { sqlite, repositories } = createTestHarness();

    await expect(repositories.reviewPromptState.getState()).resolves.toEqual(
      defaultReviewPromptState,
    );

    await repositories.reviewPromptState.seedOnboardingCompletion('2026-04-10T09:00:00.000Z');
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-04-12',
      '2026-04-12T10:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-04-14',
      '2026-04-14T11:00:00.000Z',
    );
    await repositories.reviewPromptState.recordAutomaticPrompt('2026-07-15T12:00:00.000Z');
    await repositories.reviewPromptState.recordManualStoreOpen('2026-07-16T12:00:00.000Z');

    await expect(repositories.reviewPromptState.getState()).resolves.toEqual({
      onboardingCompletedAt: '2026-04-10T09:00:00.000Z',
      automaticPromptCount: 1,
      lastAutomaticPromptAt: '2026-07-15T12:00:00.000Z',
      suppressAutomaticPrompts: true,
      lastManualStoreOpenAt: '2026-07-16T12:00:00.000Z',
    });
    await expect(
      repositories.reviewPromptState.listSuccessfulSaveEventsSince('2026-04-10T09:00:00.000Z'),
    ).resolves.toEqual([
      {
        logDate: '2026-04-12',
        savedAt: '2026-04-12T10:00:00.000Z',
      },
      {
        logDate: '2026-04-14',
        savedAt: '2026-04-14T11:00:00.000Z',
      },
    ]);

    const exportedSnapshot = await repositories.backupData.exportSnapshot();
    expect(exportedSnapshot).not.toHaveProperty('reviewPromptState');

    await repositories.reviewPromptState.reset();

    await expect(repositories.reviewPromptState.getState()).resolves.toEqual(
      defaultReviewPromptState,
    );
    await expect(
      repositories.reviewPromptState.listSuccessfulSaveEventsSince('2026-04-10T09:00:00.000Z'),
    ).resolves.toEqual([]);
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reviewPromptSaveEvents}`).get(),
    ).toEqual({ count: 0 });
  });

  it('persists app preferences, profile data, reminders, privacy settings, and import-linked daily logs', async () => {
    const { sqlite, repositories } = createTestHarness();

    const appPreferences: AppPreferences = {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: false,
      deferredImportSetup: true,
      themePreference: 'system',
      localePreference: 'system',
    };

    const userProfile = {
      cycleLengthDays: 31,
      periodLengthDays: 6,
      lastPeriodStartDate: '2026-04-02',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos', 'pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: false,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'pill',
    } as UserProfile;

    const reminderPreferences: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 21,
        minute: 15,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
    ];

    const privacyPreference: PrivacyPreference = {
      biometricsEnabled: true,
      relockAfterSeconds: 120,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: true,
    };

    const billingSnapshot: BillingSnapshot = {
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2099-06-09T08:00:00.000Z',
      firstChargeAt: '2099-06-09T08:00:00.000Z',
      expiresAt: '2100-06-09T08:00:00.000Z',
      lastSyncedAt: '2026-04-09T08:00:00.000Z',
      reminderScheduledFor: '2026-06-06T09:00:00.000Z',
    };

    const importSession: ImportSession = {
      id: 'import-session-1',
      source: 'clue',
      status: 'committed',
      startedAt: '2026-04-09T08:00:00.000Z',
      completedAt: '2026-04-09T08:05:00.000Z',
      importedLogCount: 12,
      skippedLogCount: 1,
    };

    const initialLogEntry: DailyLogEntry = {
      id: 'log-2026-04-09',
      logDate: '2026-04-09',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue'],
      mood: 'sensitive',
      notes: 'Cramping eased after a walk.',
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'negative',
        basalBodyTemperatureCelsius: 36.45,
        sexLogged: true,
      },
      birthControlEvent: {
        method: 'pill',
        lateDose: true,
      },
      importSessionId: importSession.id,
    };

    await repositories.appPreferences.savePreferences(appPreferences);
    await repositories.billingSnapshot.saveSnapshot(billingSnapshot);
    await repositories.userProfile.saveProfile(userProfile);
    await repositories.reminderPreferences.savePreferences(reminderPreferences);
    await repositories.privacyPreferences.savePreference(privacyPreference);
    await repositories.importSessions.saveSession(importSession);
    await repositories.dailyLogs.saveEntry(initialLogEntry);

    expect(await repositories.appPreferences.getPreferences()).toEqual(appPreferences);
    expect(await repositories.billingSnapshot.getSnapshot()).toEqual(billingSnapshot);
    expect(await repositories.userProfile.getProfile()).toEqual(userProfile);
    expect(await repositories.reminderPreferences.getPreferences()).toEqual(
      mergeReminderPreferences(reminderPreferences),
    );
    expect(await repositories.privacyPreferences.getPreference()).toEqual(privacyPreference);
    expect(await repositories.importSessions.getSession(importSession.id)).toEqual(importSession);
    expect(await repositories.importSessions.listSessions()).toEqual([importSession]);

    expect(
      await repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).toEqual([initialLogEntry]);
    expect(await repositories.dailyLogs.listAll()).toEqual([initialLogEntry]);

    const updatedLogEntry: DailyLogEntry = {
      ...initialLogEntry,
      bleeding: 'light',
      symptoms: ['cramps', 'bloating'],
      notes: 'Symptoms calmed down by lunch.',
      ttcObservation: {
        ...initialLogEntry.ttcObservation,
        ovulationTest: 'positive',
      },
      birthControlEvent: {
        method: 'pill',
        missedDose: false,
        lateDose: false,
      },
    };

    await repositories.dailyLogs.saveEntry(updatedLogEntry);

    expect(
      await repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).toEqual([updatedLogEntry]);

    await repositories.dailyLogs.deleteEntry(updatedLogEntry.id);

    expect(
      await repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).toEqual([]);

    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.dailyLogs}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.dailyLogSymptoms}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.ttcObservations}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.birthControlEvents}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.userProfileGoals}`).get(),
    ).toEqual({ count: 2 });
    expect(
      sqlite
        .prepare(`select count(*) as count from ${tableNames.userProfileConditions}`)
        .get(),
    ).toEqual({ count: 2 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.userProfile}`).get(),
    ).toEqual({ count: 1 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.importSessions}`).get(),
    ).toEqual({ count: 1 });
  });

  it('defaults dismissedAnomalyIds to an empty array when no preferences have been saved', async () => {
    const { repositories } = createTestHarness();

    expect(await repositories.appPreferences.getPreferences()).toEqual(defaultAppPreferences);
    expect((await repositories.appPreferences.getPreferences()).dismissedAnomalyIds).toEqual([]);
  });

  it('round-trips dismissedAnomalyIds through app preferences storage', async () => {
    const { repositories } = createTestHarness();

    const appPreferences: AppPreferences = {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      dismissedAnomalyIds: ['short-cycle:2026-04-01', 'long-cycle:2026-03-01'],
    };

    await repositories.appPreferences.savePreferences(appPreferences);

    expect(await repositories.appPreferences.getPreferences()).toEqual(appPreferences);
  });

  it('round-trips the IUD sub-type for a copper IUD profile', async () => {
    const { repositories } = createTestHarness();

    const profile: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'iud',
      iudType: 'copper',
    };

    await repositories.userProfile.saveProfile(profile);

    expect(await repositories.userProfile.getProfile()).toEqual(profile);
  });

  it('clears the persisted IUD sub-type when the method is switched away from IUD', async () => {
    const { repositories } = createTestHarness();

    const base: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'iud',
      iudType: 'copper',
    };

    await repositories.userProfile.saveProfile(base);
    // Switch to a non-IUD method while a stale sub-type is still on the object.
    await repositories.userProfile.saveProfile({
      ...base,
      birthControlMethod: 'pill',
    });

    const reloaded = await repositories.userProfile.getProfile();
    expect(reloaded?.birthControlMethod).toBe('pill');
    expect(reloaded?.iudType).toBeUndefined();
  });

  it('caps dismissedAnomalyIds at 50 entries, dropping the oldest first', async () => {
    const { repositories } = createTestHarness();

    const fiftyOneIds = Array.from({ length: 51 }, (_, index) => `anomaly-${index}`);

    await repositories.appPreferences.savePreferences({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      dismissedAnomalyIds: appendDismissedAnomalyId(fiftyOneIds.slice(0, 50), fiftyOneIds[50]),
    });

    const persisted = await repositories.appPreferences.getPreferences();

    expect(persisted.dismissedAnomalyIds).toHaveLength(50);
    // The oldest id (anomaly-0) should have been dropped; the newest 50 remain.
    expect(persisted.dismissedAnomalyIds).not.toContain('anomaly-0');
    expect(persisted.dismissedAnomalyIds?.[0]).toBe('anomaly-1');
    expect(persisted.dismissedAnomalyIds?.[49]).toBe('anomaly-50');
  });

  it('wipes every persisted local-data table when maintenance cleanup runs', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.appPreferences.savePreferences({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: true,
      deferredImportSetup: false,
      hapticsEnabled: true,
      tapSoundEnabled: false,
    });

    await repositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['endometriosis'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    } as UserProfile);

    await repositories.importSessions.saveSession({
      id: 'import-session-2',
      source: 'manual',
      status: 'committed',
      startedAt: '2026-04-10T07:00:00.000Z',
      completedAt: '2026-04-10T07:10:00.000Z',
      importedLogCount: 3,
      skippedLogCount: 0,
    });

    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-04-10',
      logDate: '2026-04-10',
      bleeding: 'light',
      symptoms: ['fatigue'],
      mood: 'steady',
      notes: 'Short note.',
      importSessionId: 'import-session-2',
    });
    await repositories.backupEvents.recordEvent({
      id: 'backup-exported-1',
      action: 'exported',
      occurredAt: '2026-04-11T10:00:00.000Z',
      detail: '1 local log entry encrypted into a Floriva backup file.',
    });

    await repositories.localDataMaintenance.wipeLocalData();

    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.appPreferences}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.userProfile}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.userProfileGoals}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite
        .prepare(`select count(*) as count from ${tableNames.userProfileConditions}`)
        .get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.dailyLogs}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.dailyLogSymptoms}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.ttcObservations}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.birthControlEvents}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.privacyPreferences}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reviewPromptState}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reviewPromptSaveEvents}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.reminderPreferences}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.importSessions}`).get(),
    ).toEqual({ count: 0 });
    expect(
      sqlite.prepare(`select count(*) as count from ${tableNames.backupEvents}`).get(),
    ).toEqual({ count: 0 });
  });

  it('tracks backup events as local operational history outside backup snapshots', async () => {
    const { repositories } = createTestHarness();
    const exportedEvent: BackupEvent = {
      id: 'backup-event-1',
      action: 'exported',
      occurredAt: '2026-04-12T10:00:00.000Z',
      detail: '2 local log entries encrypted into a Floriva backup file.',
    };
    const restoredEvent: BackupEvent = {
      id: 'backup-event-2',
      action: 'restored',
      occurredAt: '2026-04-13T11:00:00.000Z',
      detail: '2 local log entries restored from a Floriva backup file.',
    };

    await repositories.backupEvents.recordEvent(restoredEvent);
    await repositories.backupEvents.recordEvent(exportedEvent);
    await repositories.backupEvents.recordEvent({
      ...exportedEvent,
      detail: '2 local log entries encrypted into an updated Floriva backup file.',
    });

    await expect(repositories.backupEvents.listEvents()).resolves.toEqual([
      {
        ...exportedEvent,
        detail: '2 local log entries encrypted into an updated Floriva backup file.',
      },
      restoredEvent,
    ]);
    await expect(repositories.backupData.exportSnapshot()).resolves.not.toHaveProperty(
      'backupEvents',
    );
  });

  it('exports a backup snapshot that captures the full local-first domain state', async () => {
    const { repositories } = createTestHarness();
    const snapshot = createBackupSnapshotFixture();

    await repositories.appPreferences.savePreferences(snapshot.appPreferences);
    await repositories.billingSnapshot.saveSnapshot(snapshot.billingSnapshot);
    expect(snapshot.userProfile).not.toBeNull();
    await repositories.userProfile.saveProfile(snapshot.userProfile!);
    await repositories.reminderPreferences.savePreferences(snapshot.reminderPreferences);
    await repositories.privacyPreferences.savePreference(snapshot.privacyPreference);

    for (const importSession of snapshot.importSessions) {
      await repositories.importSessions.saveSession(importSession);
    }

    for (const dailyLog of snapshot.dailyLogs) {
      await repositories.dailyLogs.saveEntry(dailyLog);
    }

    await expect(repositories.backupData.exportSnapshot()).resolves.toEqual({
      ...snapshot,
      exportedAt: expect.any(String),
    });
  });

  it('atomically replaces the current local data with a restored backup snapshot', async () => {
    const { repositories } = createTestHarness();

    await repositories.appPreferences.savePreferences({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: false,
      deferredImportSetup: true,
      themePreference: 'system',
      localePreference: 'system',
    });
    await repositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 4,
      lastPeriodStartDate: '2026-03-10',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: undefined,
    });
    await repositories.dailyLogs.saveEntry({
      id: 'legacy-log',
      logDate: '2026-03-10',
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    const restoredSnapshot = createBackupSnapshotFixture();

    await repositories.backupData.restoreSnapshot(restoredSnapshot);

    await expect(repositories.appPreferences.getPreferences()).resolves.toEqual(
      restoredSnapshot.appPreferences,
    );
    await expect(repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      restoredSnapshot.billingSnapshot,
    );
    await expect(repositories.userProfile.getProfile()).resolves.toEqual(
      restoredSnapshot.userProfile,
    );
    await expect(repositories.reminderPreferences.getPreferences()).resolves.toEqual(
      restoredSnapshot.reminderPreferences,
    );
    await expect(repositories.privacyPreferences.getPreference()).resolves.toEqual(
      restoredSnapshot.privacyPreference,
    );
    await expect(
      repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).resolves.toEqual(restoredSnapshot.dailyLogs);
    await expect(
      repositories.dailyLogs.listByDateRange('2026-03-01', '2026-03-31'),
    ).resolves.toEqual([]);
    await expect(repositories.reviewPromptState.getState()).resolves.toEqual({
      ...defaultReviewPromptState,
      onboardingCompletedAt: expect.any(String),
    });
  });

  it('restores snapshots that intentionally contain no reminder preferences', async () => {
    const { repositories } = createTestHarness();

    await repositories.reminderPreferences.savePreferences([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    await repositories.backupData.restoreSnapshot({
      ...createBackupSnapshotFixture(),
      reminderPreferences: [],
    });

    await expect(repositories.reminderPreferences.getPreferences()).resolves.toEqual(
      defaultReminderPreferences,
    );
  });

  it('keeps the previous local data when a restored snapshot fails midway', async () => {
    const { repositories } = createTestHarness();

    const originalSnapshot = createBackupSnapshotFixture();

    await repositories.appPreferences.savePreferences(originalSnapshot.appPreferences);
    await repositories.billingSnapshot.saveSnapshot(originalSnapshot.billingSnapshot);
    expect(originalSnapshot.userProfile).not.toBeNull();
    await repositories.userProfile.saveProfile(originalSnapshot.userProfile!);
    await repositories.reminderPreferences.savePreferences(originalSnapshot.reminderPreferences);
    await repositories.privacyPreferences.savePreference(originalSnapshot.privacyPreference);

    for (const importSession of originalSnapshot.importSessions) {
      await repositories.importSessions.saveSession(importSession);
    }

    for (const dailyLog of originalSnapshot.dailyLogs) {
      await repositories.dailyLogs.saveEntry(dailyLog);
    }

    const invalidReplacementSnapshot = {
      ...createBackupSnapshotFixture(),
      appPreferences: defaultAppPreferences,
      importSessions: [],
      dailyLogs: [
        {
          id: 'invalid-restore-log',
          logDate: '2026-05-01',
          bleeding: 'light',
          symptoms: ['fatigue'],
          importSessionId: 'missing-import-session',
        },
      ],
    } satisfies BackupSnapshot;

    await expect(
      repositories.backupData.restoreSnapshot(invalidReplacementSnapshot),
    ).rejects.toThrow();

    await expect(repositories.backupData.exportSnapshot()).resolves.toEqual({
      ...originalSnapshot,
      exportedAt: expect.any(String),
    });
  });

  it('clears a saved user profile without affecting other local preferences', async () => {
    const { repositories } = createTestHarness();

    await repositories.appPreferences.savePreferences({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: 'system',
    });
    await repositories.userProfile.saveProfile({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    await repositories.userProfile.clearProfile();

    await expect(repositories.userProfile.getProfile()).resolves.toBeNull();
    await expect(repositories.appPreferences.getPreferences()).resolves.toEqual({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: 'system',
    });
  });

  it('lists daily logs for unique requested dates and returns empty arrays when nothing matches', async () => {
    const { repositories } = createTestHarness();

    await expect(repositories.dailyLogs.listByDates([])).resolves.toEqual([]);

    await repositories.dailyLogs.saveEntry({
      id: 'list-dates-log-1',
      logDate: '2026-04-01',
      bleeding: 'light',
      symptoms: ['fatigue'],
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'positive',
      },
    });
    await repositories.dailyLogs.saveEntry({
      id: 'list-dates-log-2',
      logDate: '2026-04-03',
      bleeding: 'medium',
      symptoms: ['cramps'],
      birthControlEvent: {
        method: 'pill',
        lateDose: true,
      },
    });

    await expect(
      repositories.dailyLogs.listByDates([
        '2026-04-03',
        '2026-04-01',
        '2026-04-03',
      ]),
    ).resolves.toEqual([
      {
        id: 'list-dates-log-1',
        logDate: '2026-04-01',
        bleeding: 'light',
        symptoms: ['fatigue'],
        mood: undefined,
        notes: undefined,
        birthControlEvent: undefined,
        importSessionId: undefined,
        ttcObservation: {
          cervicalMucus: 'creamy',
          ovulationTest: 'positive',
          basalBodyTemperatureCelsius: undefined,
          sexLogged: undefined,
        },
      },
      {
        id: 'list-dates-log-2',
        logDate: '2026-04-03',
        bleeding: 'medium',
        symptoms: ['cramps'],
        mood: undefined,
        notes: undefined,
        importSessionId: undefined,
        ttcObservation: undefined,
        birthControlEvent: {
          method: 'pill',
          lateDose: true,
          missedDose: undefined,
        },
      },
    ]);

    await expect(repositories.dailyLogs.listByDates(['2026-06-01'])).resolves.toEqual([]);
  });

  it('saves a daily log only when the log date is still absent', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntryIfDateAbsent({
        id: 'import-log-1',
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: ['cramps'],
      }),
    ).resolves.toBe(true);

    await expect(
      repositories.dailyLogs.saveEntryIfDateAbsent({
        id: 'import-log-2',
        logDate: '2026-04-09',
        bleeding: 'heavy',
        symptoms: ['fatigue'],
      }),
    ).resolves.toBe(false);

    await expect(repositories.dailyLogs.listByDates(['2026-04-09'])).resolves.toEqual([
      {
        id: 'import-log-1',
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: ['cramps'],
        mood: undefined,
        notes: undefined,
        birthControlEvent: undefined,
        importSessionId: undefined,
        ttcObservation: undefined,
      },
    ]);
  });

  it('does not replace another daily log when insert-if-absent receives an existing id', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'existing-log-id',
      logDate: '2026-04-08',
      bleeding: 'light',
      symptoms: ['fatigue'],
    });

    await expect(
      repositories.dailyLogs.saveEntryIfDateAbsent({
        id: 'existing-log-id',
        logDate: '2026-04-09',
        bleeding: 'heavy',
        symptoms: ['cramps'],
      }),
    ).resolves.toBe(false);

    await expect(
      repositories.dailyLogs.listByDates(['2026-04-08', '2026-04-09']),
    ).resolves.toEqual([
      {
        id: 'existing-log-id',
        logDate: '2026-04-08',
        bleeding: 'light',
        symptoms: ['fatigue'],
        mood: undefined,
        notes: undefined,
        birthControlEvent: undefined,
        importSessionId: undefined,
        ttcObservation: undefined,
      },
    ]);
  });

  it('preserves the previous profile if a replacement save fails midway', async () => {
    const { repositories } = createTestHarness();

    const initialProfile = {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-18',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    } as UserProfile;

    await repositories.userProfile.saveProfile(initialProfile);

    const invalidReplacement = {
      ...initialProfile,
      cycleLengthDays: 33,
      conditionTags: ['pcos', 'pcos'],
    } as UserProfile;

    await expect(repositories.userProfile.saveProfile(invalidReplacement)).rejects.toThrow();
    expect(await repositories.userProfile.getProfile()).toEqual(initialProfile);
  });

  it('preserves existing reminder settings if a replacement save fails midway', async () => {
    const { repositories } = createTestHarness();

    const initialPreferences: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
    ];

    await repositories.reminderPreferences.savePreferences(initialPreferences);

    const invalidReplacement = [
      initialPreferences[0],
      {
        ...initialPreferences[0],
        hour: 22,
      },
    ] as ReminderPreference[];

    await expect(
      repositories.reminderPreferences.savePreferences(invalidReplacement),
    ).rejects.toThrow();
    expect(await repositories.reminderPreferences.getPreferences()).toEqual(
      mergeReminderPreferences(initialPreferences),
    );
  });

  it('saves profile and reminder settings atomically', async () => {
    const { repositories } = createTestHarness();

    const initialProfile: UserProfile = {
      ...defaultUserProfile,
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    };
    const initialPreferences: ReminderPreference[] = [
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ];

    await repositories.userProfile.saveProfile(initialProfile);
    await repositories.reminderPreferences.savePreferences(initialPreferences);

    const nextProfile: UserProfile = {
      ...initialProfile,
      birthControlMethod: undefined,
    };
    const invalidReplacement = [
      {
        ...initialPreferences[0],
        enabled: false,
      },
      {
        ...initialPreferences[0],
        hour: 9,
      },
    ] as ReminderPreference[];

    await expect(
      repositories.userProfile.saveProfileAndReminderPreferences(
        nextProfile,
        invalidReplacement,
      ),
    ).rejects.toThrow();

    expect(await repositories.userProfile.getProfile()).toEqual(initialProfile);
    expect(await repositories.reminderPreferences.getPreferences()).toEqual(
      mergeReminderPreferences(initialPreferences),
    );
  });

  it('preserves the existing daily log if a replacement save fails midway', async () => {
    const { repositories } = createTestHarness();

    const initialLogEntry: DailyLogEntry = {
      id: 'log-2026-04-11',
      logDate: '2026-04-11',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue'],
      mood: 'steady',
      notes: 'Initial entry',
    };

    await repositories.dailyLogs.saveEntry(initialLogEntry);

    const invalidReplacement = {
      ...initialLogEntry,
      symptoms: ['cramps', 'cramps'],
      notes: 'This write should fail and roll back.',
    } as DailyLogEntry;

    await expect(repositories.dailyLogs.saveEntry(invalidReplacement)).rejects.toThrow();
    expect(
      await repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).toEqual([initialLogEntry]);
  });

  it('replaces an existing day when a new entry arrives for the same logDate', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-04-12-original',
      logDate: '2026-04-12',
      bleeding: 'medium',
      symptoms: ['cramps'],
      notes: 'Original entry',
    });

    const replacementEntry: DailyLogEntry = {
      id: 'log-2026-04-12-replacement',
      logDate: '2026-04-12',
      bleeding: 'light',
      symptoms: ['bloating'],
      mood: 'energized',
      notes: 'Replacement entry',
    };

    await repositories.dailyLogs.saveEntry(replacementEntry);

    expect(
      await repositories.dailyLogs.listByDateRange('2026-04-01', '2026-04-30'),
    ).toEqual([replacementEntry]);
  });

  it('looks up a single day by local logDate', async () => {
    const { repositories } = createTestHarness();

    const entry: DailyLogEntry = {
      id: 'log-2026-04-13',
      logDate: '2026-04-13',
      bleeding: 'none',
      symptoms: ['fatigue'],
      mood: 'low',
      notes: 'Hydrated for today.',
    };

    await repositories.dailyLogs.saveEntry(entry);

    await expect(repositories.dailyLogs.getEntryByDate('2026-04-13')).resolves.toEqual(
      entry,
    );
    await expect(repositories.dailyLogs.getEntryByDate('2026-04-14')).resolves.toBeNull();
  });

  it('keeps legacy sex symptom entries valid when older local data is re-saved', async () => {
    const { repositories } = createTestHarness();

    const legacyEntry: DailyLogEntry = {
      id: 'log-2026-04-14',
      logDate: '2026-04-14',
      bleeding: 'none',
      symptoms: ['sex'],
      notes: 'Legacy local data',
    };

    await repositories.dailyLogs.saveEntry(legacyEntry);

    await expect(
      repositories.dailyLogs.saveEntry({
        ...legacyEntry,
        notes: 'Legacy local data, re-saved',
      }),
    ).resolves.toBeUndefined();
  });

  it('backfills lastPeriodStartDate from the most recent period day during legacy upgrade', () => {
    const sqlite = new Database(':memory:');

    applySqlMigration(sqlite, initialMigrationPath);

    sqlite.exec(`
      INSERT INTO user_profile (
        id,
        cycle_length_days,
        period_length_days,
        supports_irregular_cycles
      ) VALUES (
        'primary-profile',
        29,
        5,
        1
      );
      INSERT INTO user_profile_goals (
        id,
        profile_id,
        goal,
        sort_order
      ) VALUES (
        'goal-period',
        'primary-profile',
        'period',
        0
      );
      INSERT INTO daily_logs (
        id,
        log_date,
        bleeding
      ) VALUES
      (
        'legacy-log-period-start',
        '2026-04-01',
        'medium'
      ),
      (
        'legacy-log-period-middle',
        '2026-04-02',
        'heavy'
      ),
      (
        'legacy-log-period',
        '2026-04-03',
        'light'
      ),
      (
        'legacy-log-spotting',
        '2026-04-11',
        'spotting'
      );
    `);

    applySqlMigration(sqlite, upgradeMigrationPath);

    expect(
      sqlite
        .prepare('select last_period_start_date as lastPeriodStartDate from user_profile')
        .get(),
    ).toEqual({ lastPeriodStartDate: '2026-04-01' });
  });

  it('completes onboarding atomically so invalid preferences do not leave a saved profile behind', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.onboarding.completeOnboarding(
        {
          cycleLengthDays: 29,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-01',
          goals: ['period'],
          supportsIrregularCycles: true,
          conditionTags: [],
        },
        {
          hasCompletedOnboarding: true,
          deferredCycleSetup: false,
          deferredTrackingSetup: false,
          deferredBiometricsSetup: false,
          deferredReminderSetup: false,
          deferredImportSetup: true,
          dismissedTailoringChecklist: false,
        } as AppPreferences,
      ),
    ).rejects.toThrow();

    await expect(repositories.userProfile.getProfile()).resolves.toBeNull();
    await expect(repositories.appPreferences.getPreferences()).resolves.toEqual(
      defaultAppPreferences,
    );
  });

  it('rejects incomplete onboarding profiles before writing any completion state', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.onboarding.completeOnboarding(
        {
          cycleLengthDays: 29,
          periodLengthDays: 5,
          goals: ['period'],
          supportsIrregularCycles: true,
          conditionTags: [],
        },
        {
          ...defaultAppPreferences,
          hasCompletedOnboarding: true,
        },
      ),
    ).rejects.toThrow('Onboarding profile is incomplete');

    await expect(repositories.userProfile.getProfile()).resolves.toBeNull();
    await expect(repositories.appPreferences.getPreferences()).resolves.toEqual(
      defaultAppPreferences,
    );
  });

  it('completes onboarding by storing the validated profile and preferences together', async () => {
    const { repositories } = createTestHarness();

    await repositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: true,
        deferredReminderSetup: false,
        deferredImportSetup: true,
        themePreference: 'system',
        localePreference: 'system',
      },
    );

    await expect(repositories.userProfile.getProfile()).resolves.toEqual({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    await expect(repositories.appPreferences.getPreferences()).resolves.toEqual({
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: false,
      deferredImportSetup: true,
      themePreference: 'system',
      localePreference: 'system',
    });
  });
});
