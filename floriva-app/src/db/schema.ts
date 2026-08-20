import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const isoTimestampSql = sql`CURRENT_TIMESTAMP`;

export const appPreferencesTable = sqliteTable('app_preferences', {
  id: text('id').primaryKey(),
  hasCompletedOnboarding: integer('has_completed_onboarding', {
    mode: 'boolean',
  }).notNull(),
  deferredCycleSetup: integer('deferred_cycle_setup', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  deferredTrackingSetup: integer('deferred_tracking_setup', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  deferredBiometricsSetup: integer('deferred_biometrics_setup', {
    mode: 'boolean',
  }).notNull(),
  deferredReminderSetup: integer('deferred_reminder_setup', {
    mode: 'boolean',
  }).notNull(),
  deferredImportSetup: integer('deferred_import_setup', {
    mode: 'boolean',
  }).notNull(),
  dismissedTailoringChecklist: integer('dismissed_tailoring_checklist', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  showFertilityEstimates: integer('show_fertility_estimates', {
    mode: 'boolean',
  })
    .notNull()
    .default(true),
  hapticsEnabled: integer('haptics_enabled', {
    mode: 'boolean',
  })
    .notNull()
    .default(true),
  tapSoundEnabled: integer('tap_sound_enabled', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  themePreference: text('theme_preference').notNull().default('system'),
  localePreference: text('locale_preference').notNull().default('system'),
  // JSON-encoded string array of dismissed anomaly-nudge ids (see
  // `Anomaly.id` in src/lib/predictions/anomalyPresentation.ts and
  // `AnomalyNudge` in src/components/primitives). A single
  // text column keeps this scaffold minimal -- there is no engine
  // wiring yet, so a dedicated child table (like the goals/conditions
  // tables) would be overkill for what is currently just a capped list
  // of opaque ids. Parsed back to `string[]` in `mapAppPreferences`.
  dismissedAnomalyIds: text('dismissed_anomaly_ids').notNull().default('[]'),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const billingSnapshotTable = sqliteTable('billing_snapshot', {
  id: text('id').primaryKey(),
  accessState: text('access_state').notNull(),
  planId: text('plan_id'),
  trialEndsAt: text('trial_ends_at'),
  firstChargeAt: text('first_charge_at'),
  expiresAt: text('expires_at'),
  lastSyncedAt: text('last_synced_at'),
  reminderScheduledFor: text('reminder_scheduled_for'),
  grandfatherTrialApplied: integer('grandfather_trial_applied', {
    mode: 'boolean',
  }),
  lifetimeTrialStartedAt: text('lifetime_trial_started_at'),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const userProfileTable = sqliteTable('user_profile', {
  id: text('id').primaryKey(),
  cycleLengthDays: integer('cycle_length_days'),
  periodLengthDays: integer('period_length_days'),
  lastPeriodStartDate: text('last_period_start_date'),
  supportsIrregularCycles: integer('supports_irregular_cycles', {
    mode: 'boolean',
  }).notNull(),
  ttcTrackingSex: integer('ttc_tracking_sex', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  ttcTrackingOvulationTest: integer('ttc_tracking_ovulation_test', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  ttcTrackingCervicalMucus: integer('ttc_tracking_cervical_mucus', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  ttcTrackingBasalBodyTemperature: integer('ttc_tracking_basal_body_temperature', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  birthControlMethod: text('birth_control_method'),
  iudType: text('iud_type'),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const userProfileGoalsTable = sqliteTable(
  'user_profile_goals',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => userProfileTable.id, { onDelete: 'cascade' }),
    goal: text('goal').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('user_profile_goals_profile_goal_unique').on(
      table.profileId,
      table.goal,
    ),
  ],
);

export const userProfileConditionsTable = sqliteTable(
  'user_profile_conditions',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => userProfileTable.id, { onDelete: 'cascade' }),
    conditionKey: text('condition_key').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('user_profile_conditions_profile_condition_unique').on(
      table.profileId,
      table.conditionKey,
    ),
  ],
);

export const importSessionsTable = sqliteTable('import_sessions', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  importedLogCount: integer('imported_log_count').notNull(),
  skippedLogCount: integer('skipped_log_count').notNull(),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const dailyLogsTable = sqliteTable(
  'daily_logs',
  {
    id: text('id').primaryKey(),
    logDate: text('log_date').notNull(),
    bleeding: text('bleeding').notNull(),
    mood: text('mood'),
    notes: text('notes'),
    importSessionId: text('import_session_id').references(() => importSessionsTable.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('daily_logs_log_date_unique').on(table.logDate),
    index('daily_logs_import_session_idx').on(table.importSessionId),
  ],
);

export const dailyLogSymptomsTable = sqliteTable(
  'daily_log_symptoms',
  {
    id: text('id').primaryKey(),
    dailyLogId: text('daily_log_id')
      .notNull()
      .references(() => dailyLogsTable.id, { onDelete: 'cascade' }),
    symptomKey: text('symptom_key').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('daily_log_symptoms_daily_log_symptom_unique').on(
      table.dailyLogId,
      table.symptomKey,
    ),
  ],
);

export const ttcObservationsTable = sqliteTable(
  'ttc_observations',
  {
    id: text('id').primaryKey(),
    dailyLogId: text('daily_log_id')
      .notNull()
      .references(() => dailyLogsTable.id, { onDelete: 'cascade' }),
    cervicalMucus: text('cervical_mucus'),
    ovulationTest: text('ovulation_test'),
    basalBodyTemperatureCelsius: real('basal_body_temperature_celsius'),
    sexLogged: integer('sex_logged', { mode: 'boolean' }),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('ttc_observations_daily_log_unique').on(table.dailyLogId),
  ],
);

export const birthControlEventsTable = sqliteTable(
  'birth_control_events',
  {
    id: text('id').primaryKey(),
    dailyLogId: text('daily_log_id')
      .notNull()
      .references(() => dailyLogsTable.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    missedDose: integer('missed_dose', { mode: 'boolean' }),
    lateDose: integer('late_dose', { mode: 'boolean' }),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [
    uniqueIndex('birth_control_events_daily_log_unique').on(table.dailyLogId),
  ],
);

export const reminderPreferencesTable = sqliteTable(
  'reminder_preferences',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    hour: integer('hour').notNull(),
    minute: integer('minute').notNull(),
    scheduleCadence: text('schedule_cadence').notNull(),
    scheduleDaysBefore: integer('schedule_days_before'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
    updatedAt: text('updated_at').notNull().default(isoTimestampSql),
  },
  (table) => [uniqueIndex('reminder_preferences_kind_unique').on(table.kind)],
);

export const privacyPreferencesTable = sqliteTable('privacy_preferences', {
  id: text('id').primaryKey(),
  biometricsEnabled: integer('biometrics_enabled', { mode: 'boolean' }).notNull(),
  relockAfterSeconds: integer('relock_after_seconds').notNull(),
  destructiveActionConfirmationRequired: integer(
    'destructive_action_confirmation_required',
    {
      mode: 'boolean',
    },
  ).notNull(),
  diagnosticsConsentEnabled: integer('diagnostics_consent_enabled', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const reviewPromptStateTable = sqliteTable('review_prompt_state', {
  id: text('id').primaryKey(),
  onboardingCompletedAt: text('onboarding_completed_at'),
  automaticPromptCount: integer('automatic_prompt_count').notNull().default(0),
  lastAutomaticPromptAt: text('last_automatic_prompt_at'),
  suppressAutomaticPrompts: integer('suppress_automatic_prompts', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  lastManualStoreOpenAt: text('last_manual_store_open_at'),
  createdAt: text('created_at').notNull().default(isoTimestampSql),
  updatedAt: text('updated_at').notNull().default(isoTimestampSql),
});

export const reviewPromptSaveEventsTable = sqliteTable(
  'review_prompt_save_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    logDate: text('log_date').notNull(),
    savedAt: text('saved_at').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
  },
  (table) => [index('review_prompt_save_events_saved_at_idx').on(table.savedAt)],
);

export const backupEventsTable = sqliteTable(
  'backup_events',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    occurredAt: text('occurred_at').notNull(),
    detail: text('detail').notNull(),
    createdAt: text('created_at').notNull().default(isoTimestampSql),
  },
  (table) => [index('backup_events_occurred_at_idx').on(table.occurredAt)],
);

export const schema = {
  appPreferencesTable,
  billingSnapshotTable,
  userProfileTable,
  userProfileGoalsTable,
  userProfileConditionsTable,
  importSessionsTable,
  dailyLogsTable,
  dailyLogSymptomsTable,
  ttcObservationsTable,
  birthControlEventsTable,
  reminderPreferencesTable,
  privacyPreferencesTable,
  reviewPromptStateTable,
  reviewPromptSaveEventsTable,
  backupEventsTable,
};
