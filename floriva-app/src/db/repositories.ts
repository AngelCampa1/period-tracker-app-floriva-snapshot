import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { DomainRepositories } from '@/src/db/contracts';
import {
  appPreferencesRowId,
  defaultAppPreferences,
  billingSnapshotRowId,
  defaultBillingSnapshot,
  defaultPrivacyPreference,
  defaultReviewPromptState,
  defaultReminderPreferences,
  defaultTtcTrackingPreferences,
  mergeReminderPreferences,
  privacyPreferencesRowId,
  reviewPromptStateRowId,
  userProfileRowId,
} from '@/src/db/domainDefaults';
import {
  appPreferencesTable,
  backupEventsTable,
  billingSnapshotTable,
  birthControlEventsTable,
  dailyLogsTable,
  dailyLogSymptomsTable,
  importSessionsTable,
  privacyPreferencesTable,
  reviewPromptSaveEventsTable,
  reviewPromptStateTable,
  reminderPreferencesTable,
  ttcObservationsTable,
  userProfileConditionsTable,
  userProfileGoalsTable,
  userProfileTable,
} from '@/src/db/schema';
import { isOnboardingProfileComplete } from '@/src/features/app-shell/isOnboardingProfileComplete';
import {
  appPreferencesSchema,
  backupEventSchema,
  backupSnapshotSchema,
  billingSnapshotSchema,
  dailyLogEntrySchema,
  importSessionSchema,
  privacyPreferenceSchema,
  reviewPromptStateSchema,
  reminderPreferencesSchema,
  userProfileSchema,
} from '@/src/db/validators';
import type {
  AppPreferences,
  BackupEvent,
  BillingSnapshot,
  DailyLogEntry,
  ImportSession,
  IudType,
  PrivacyPreference,
  ReviewPromptSaveEvent,
  ReviewPromptState,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';
import type { schema } from '@/src/db/schema';

type FlorivaDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Validates that a logDate string like "YYYY-MM-DD" represents a real calendar
 * date.  The zod isoDateSchema only checks the regex pattern — it allows
 * structurally-valid-but-logically-invalid values such as "2026-13-01" (month 13)
 * or "2026-01-99" (day 99).  Persisting those into the DB would silently corrupt
 * the user's cycle timeline.
 */
function assertLogDateIsCalendarValid(logDate: string): void {
  const [yearStr, monthStr, dayStr] = logDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // Month must be 1–12, day must be 1–31 as a coarse guard.
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid logDate: "${logDate}" is not a valid calendar date`);
  }

  // Use Date to catch month-overflow (e.g. 2026-02-30 → rolls over to March).
  const d = new Date(`${logDate}T00:00:00`);
  if (
    isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() + 1 !== month ||
    d.getDate() !== day
  ) {
    throw new Error(`Invalid logDate: "${logDate}" is not a valid calendar date`);
  }
}

function runInTransaction<T>(
  database: FlorivaDatabase,
  callback: (tx: FlorivaDatabase) => T,
) {
  return database.transaction((transaction) => callback(transaction));
}

// Anomaly-nudge dismissals are cheap to lose (worst case: a previously
// dismissed nudge reappears once), so this is intentionally unsophisticated --
// no LRU tracking, just "keep the newest 50, drop the rest". Ids are appended
// to the end of the array by callers, so the oldest entries sit at the front;
// truncating from the front keeps the most recently dismissed ids.
const MAX_DISMISSED_ANOMALY_IDS = 50;

// Keep the newest MAX entries (oldest sit at the front of the array, so
// truncate from the front). Applied structurally on the read path
// (`parseDismissedAnomalyIds`) and the write path (`persistAppPreferences`)
// as well as in `appendDismissedAnomalyId`, so an oversized array can never
// bypass the cap regardless of how a caller assembles preferences.
function clampDismissedAnomalyIds(ids: string[]): string[] {
  return ids.length > MAX_DISMISSED_ANOMALY_IDS
    ? ids.slice(ids.length - MAX_DISMISSED_ANOMALY_IDS)
    : ids;
}

export function appendDismissedAnomalyId(
  dismissedAnomalyIds: string[],
  anomalyId: string,
): string[] {
  const next = dismissedAnomalyIds.includes(anomalyId)
    ? dismissedAnomalyIds
    : [...dismissedAnomalyIds, anomalyId];

  return clampDismissedAnomalyIds(next);
}

function parseDismissedAnomalyIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? clampDismissedAnomalyIds(parsed.filter((id): id is string => typeof id === 'string'))
      : [];
  } catch {
    return [];
  }
}

function mapAppPreferences(row: typeof appPreferencesTable.$inferSelect): AppPreferences {
  return {
    hasCompletedOnboarding: row.hasCompletedOnboarding,
    deferredCycleSetup: row.deferredCycleSetup,
    deferredTrackingSetup: row.deferredTrackingSetup,
    deferredBiometricsSetup: row.deferredBiometricsSetup,
    deferredReminderSetup: row.deferredReminderSetup,
    deferredImportSetup: row.deferredImportSetup,
    dismissedTailoringChecklist: row.dismissedTailoringChecklist,
    showFertilityEstimates: row.showFertilityEstimates,
    hapticsEnabled: row.hapticsEnabled,
    tapSoundEnabled: row.tapSoundEnabled,
    themePreference: row.themePreference as AppPreferences['themePreference'],
    localePreference: row.localePreference as AppPreferences['localePreference'],
    dismissedAnomalyIds: parseDismissedAnomalyIds(row.dismissedAnomalyIds),
  };
}

function mapBillingSnapshot(
  row: typeof billingSnapshotTable.$inferSelect,
): BillingSnapshot {
  return billingSnapshotSchema.parse({
    accessState: row.accessState as BillingSnapshot['accessState'],
    planId: (row.planId as BillingSnapshot['planId']) ?? undefined,
    trialEndsAt: row.trialEndsAt ?? undefined,
    firstChargeAt: row.firstChargeAt ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    lastSyncedAt: row.lastSyncedAt ?? undefined,
    reminderScheduledFor: row.reminderScheduledFor ?? undefined,
    grandfatherTrialApplied: row.grandfatherTrialApplied ?? undefined,
    lifetimeTrialStartedAt: row.lifetimeTrialStartedAt ?? undefined,
  });
}

function mapReminderPreference(
  row: typeof reminderPreferencesTable.$inferSelect,
): ReminderPreference {
  return {
    kind: row.kind as ReminderPreference['kind'],
    enabled: row.enabled,
    hour: row.hour,
    minute: row.minute,
    schedule:
      row.scheduleCadence === 'daily'
        ? { cadence: 'daily' }
        : {
            cadence: 'cycle-event',
            daysBefore: row.scheduleDaysBefore ?? 0,
          },
  };
}

function mapUserProfile(
  row: typeof userProfileTable.$inferSelect,
  goals: (typeof userProfileGoalsTable.$inferSelect)[],
  conditions: (typeof userProfileConditionsTable.$inferSelect)[],
): UserProfile {
  return {
    cycleLengthDays: row.cycleLengthDays ?? undefined,
    periodLengthDays: row.periodLengthDays ?? undefined,
    lastPeriodStartDate: row.lastPeriodStartDate ?? undefined,
    goals: goals.map((goal) => goal.goal as UserProfile['goals'][number]),
    supportsIrregularCycles: row.supportsIrregularCycles,
    conditionTags: conditions.map(
      (condition) => condition.conditionKey as UserProfile['conditionTags'][number],
    ),
    ttcTrackingPreferences: {
      sex: row.ttcTrackingSex ?? defaultTtcTrackingPreferences.sex,
      ovulationTest:
        row.ttcTrackingOvulationTest ?? defaultTtcTrackingPreferences.ovulationTest,
      cervicalMucus:
        row.ttcTrackingCervicalMucus ?? defaultTtcTrackingPreferences.cervicalMucus,
      basalBodyTemperature:
        row.ttcTrackingBasalBodyTemperature ??
        defaultTtcTrackingPreferences.basalBodyTemperature,
    },
    birthControlMethod: row.birthControlMethod
      ? (row.birthControlMethod as UserProfile['birthControlMethod'])
      : undefined,
    iudType: row.iudType ? (row.iudType as IudType) : undefined,
  };
}

function normalizeUserProfileTtcTrackingPreferences(profile: UserProfile) {
  return profile.ttcTrackingPreferences ?? defaultTtcTrackingPreferences;
}

/**
 * The persisted IUD sub-type is only meaningful for an IUD method; clear it
 * whenever the method is anything else so a stale sub-type can never linger
 * after a user switches methods.
 */
function resolveIudTypeForPersistence(profile: UserProfile): IudType | null {
  return profile.birthControlMethod === 'iud' ? (profile.iudType ?? null) : null;
}

function mapImportSession(row: typeof importSessionsTable.$inferSelect): ImportSession {
  return {
    id: row.id,
    source: row.source as ImportSession['source'],
    status: row.status as ImportSession['status'],
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
    importedLogCount: row.importedLogCount,
    skippedLogCount: row.skippedLogCount,
  };
}

function mapBackupEvent(row: typeof backupEventsTable.$inferSelect): BackupEvent {
  return {
    id: row.id,
    action: row.action as BackupEvent['action'],
    occurredAt: row.occurredAt,
    detail: row.detail,
  };
}

function mapReviewPromptState(
  row: typeof reviewPromptStateTable.$inferSelect,
): ReviewPromptState {
  return {
    onboardingCompletedAt: row.onboardingCompletedAt ?? undefined,
    automaticPromptCount: row.automaticPromptCount,
    lastAutomaticPromptAt: row.lastAutomaticPromptAt ?? undefined,
    suppressAutomaticPrompts: row.suppressAutomaticPrompts,
    lastManualStoreOpenAt: row.lastManualStoreOpenAt ?? undefined,
  };
}

function mapReviewPromptSaveEvent(
  row: typeof reviewPromptSaveEventsTable.$inferSelect,
): ReviewPromptSaveEvent {
  return {
    logDate: row.logDate,
    savedAt: row.savedAt,
  };
}

function mapDailyLogEntry(
  row: typeof dailyLogsTable.$inferSelect,
  symptomRows: (typeof dailyLogSymptomsTable.$inferSelect)[],
  ttcRow?: typeof ttcObservationsTable.$inferSelect,
  birthControlRow?: typeof birthControlEventsTable.$inferSelect,
): DailyLogEntry {
  return {
    id: row.id,
    logDate: row.logDate,
    bleeding: row.bleeding as DailyLogEntry['bleeding'],
    symptoms: symptomRows.map(
      (symptom) => symptom.symptomKey as DailyLogEntry['symptoms'][number],
    ),
    mood: (row.mood as DailyLogEntry['mood']) ?? undefined,
    notes: row.notes ?? undefined,
    ttcObservation: ttcRow
      ? {
          cervicalMucus:
            (ttcRow.cervicalMucus as NonNullable<
              DailyLogEntry['ttcObservation']
            >['cervicalMucus']) ??
            undefined,
          ovulationTest:
            (ttcRow.ovulationTest as NonNullable<
              DailyLogEntry['ttcObservation']
            >['ovulationTest']) ??
            undefined,
          basalBodyTemperatureCelsius:
            ttcRow.basalBodyTemperatureCelsius ?? undefined,
          sexLogged: ttcRow.sexLogged ?? undefined,
        }
      : undefined,
    birthControlEvent: birthControlRow
      ? {
          method: birthControlRow.method as NonNullable<
            DailyLogEntry['birthControlEvent']
          >['method'],
          missedDose: birthControlRow.missedDose ?? undefined,
          lateDose: birthControlRow.lateDose ?? undefined,
        }
      : undefined,
    importSessionId: row.importSessionId ?? undefined,
  };
}

export function createDomainRepositories(db: FlorivaDatabase): DomainRepositories {
  async function loadReviewPromptState() {
    const [row] = await db
      .select()
      .from(reviewPromptStateTable)
      .where(eq(reviewPromptStateTable.id, reviewPromptStateRowId))
      .limit(1);

    return row ? mapReviewPromptState(row) : defaultReviewPromptState;
  }

  function persistAppPreferences(
    targetDb: FlorivaDatabase,
    preferences: AppPreferences,
    timestamp: string,
  ) {
    const row = {
      ...preferences,
      dismissedAnomalyIds: JSON.stringify(
        clampDismissedAnomalyIds(preferences.dismissedAnomalyIds ?? []),
      ),
    };

    targetDb
      .insert(appPreferencesTable)
      .values({
        id: appPreferencesRowId,
        ...row,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: appPreferencesTable.id,
        set: {
          ...row,
          updatedAt: timestamp,
        },
      })
      .run();
  }

  function persistUserProfile(
    targetDb: FlorivaDatabase,
    profile: UserProfile,
    timestamp: string,
  ) {
    const ttcTrackingPreferences = normalizeUserProfileTtcTrackingPreferences(profile);

    targetDb
      .insert(userProfileTable)
      .values({
        id: userProfileRowId,
        cycleLengthDays: profile.cycleLengthDays ?? null,
        periodLengthDays: profile.periodLengthDays ?? null,
        lastPeriodStartDate: profile.lastPeriodStartDate ?? null,
        supportsIrregularCycles: profile.supportsIrregularCycles,
        ttcTrackingSex: ttcTrackingPreferences.sex,
        ttcTrackingOvulationTest: ttcTrackingPreferences.ovulationTest,
        ttcTrackingCervicalMucus: ttcTrackingPreferences.cervicalMucus,
        ttcTrackingBasalBodyTemperature: ttcTrackingPreferences.basalBodyTemperature,
        birthControlMethod: profile.birthControlMethod ?? null,
        iudType: resolveIudTypeForPersistence(profile),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: userProfileTable.id,
        set: {
          cycleLengthDays: profile.cycleLengthDays ?? null,
          periodLengthDays: profile.periodLengthDays ?? null,
          lastPeriodStartDate: profile.lastPeriodStartDate ?? null,
          supportsIrregularCycles: profile.supportsIrregularCycles,
          ttcTrackingSex: ttcTrackingPreferences.sex,
          ttcTrackingOvulationTest: ttcTrackingPreferences.ovulationTest,
          ttcTrackingCervicalMucus: ttcTrackingPreferences.cervicalMucus,
          ttcTrackingBasalBodyTemperature: ttcTrackingPreferences.basalBodyTemperature,
          birthControlMethod: profile.birthControlMethod ?? null,
          iudType: resolveIudTypeForPersistence(profile),
          updatedAt: timestamp,
        },
      })
      .run();

    targetDb
      .delete(userProfileGoalsTable)
      .where(eq(userProfileGoalsTable.profileId, userProfileRowId))
      .run();
    targetDb
      .delete(userProfileConditionsTable)
      .where(eq(userProfileConditionsTable.profileId, userProfileRowId))
      .run();

    if (profile.goals.length > 0) {
      targetDb
        .insert(userProfileGoalsTable)
        .values(
          profile.goals.map((goal, index) => ({
            id: `${userProfileRowId}-goal-${goal}`,
            profileId: userProfileRowId,
            goal,
            sortOrder: index,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        )
        .run();
    }

    if (profile.conditionTags.length > 0) {
      targetDb
        .insert(userProfileConditionsTable)
        .values(
          profile.conditionTags.map((conditionKey, index) => ({
            id: `${userProfileRowId}-condition-${conditionKey}`,
            profileId: userProfileRowId,
            conditionKey,
            sortOrder: index,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        )
        .run();
    }
  }

  function persistBillingSnapshot(
    targetDb: FlorivaDatabase,
    snapshot: BillingSnapshot,
    timestamp: string,
  ) {
    targetDb
      .insert(billingSnapshotTable)
      .values({
        id: billingSnapshotRowId,
        accessState: snapshot.accessState,
        planId: snapshot.planId ?? null,
        trialEndsAt: snapshot.trialEndsAt ?? null,
        firstChargeAt: snapshot.firstChargeAt ?? null,
        expiresAt: snapshot.expiresAt ?? null,
        lastSyncedAt: snapshot.lastSyncedAt ?? null,
        reminderScheduledFor: snapshot.reminderScheduledFor ?? null,
        grandfatherTrialApplied: snapshot.grandfatherTrialApplied ?? null,
        lifetimeTrialStartedAt: snapshot.lifetimeTrialStartedAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: billingSnapshotTable.id,
        set: {
          accessState: snapshot.accessState,
          planId: snapshot.planId ?? null,
          trialEndsAt: snapshot.trialEndsAt ?? null,
          firstChargeAt: snapshot.firstChargeAt ?? null,
          expiresAt: snapshot.expiresAt ?? null,
          lastSyncedAt: snapshot.lastSyncedAt ?? null,
          reminderScheduledFor: snapshot.reminderScheduledFor ?? null,
          grandfatherTrialApplied: snapshot.grandfatherTrialApplied ?? null,
          lifetimeTrialStartedAt: snapshot.lifetimeTrialStartedAt ?? null,
          updatedAt: timestamp,
        },
      })
      .run();
  }

  function persistReminderPreferences(
    targetDb: FlorivaDatabase,
    preferences: ReminderPreference[],
    timestamp: string,
  ) {
    targetDb.delete(reminderPreferencesTable).run();

    if (preferences.length === 0) {
      return;
    }

    targetDb
      .insert(reminderPreferencesTable)
      .values(
        preferences.map((preference, index) => ({
          id: `reminder-${preference.kind}`,
          kind: preference.kind,
          enabled: preference.enabled,
          hour: preference.hour,
          minute: preference.minute,
          scheduleCadence: preference.schedule.cadence,
          scheduleDaysBefore:
            preference.schedule.cadence === 'cycle-event'
              ? preference.schedule.daysBefore
              : null,
          sortOrder: index,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      )
      .run();
  }

  function persistPrivacyPreference(
    targetDb: FlorivaDatabase,
    preference: PrivacyPreference,
    timestamp: string,
  ) {
    targetDb
      .insert(privacyPreferencesTable)
      .values({
        id: privacyPreferencesRowId,
        ...preference,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: privacyPreferencesTable.id,
        set: {
          ...preference,
          updatedAt: timestamp,
        },
      })
      .run();
  }

  function persistReviewPromptState(
    targetDb: FlorivaDatabase,
    state: ReviewPromptState,
    timestamp: string,
  ) {
    targetDb
      .insert(reviewPromptStateTable)
      .values({
        id: reviewPromptStateRowId,
        onboardingCompletedAt: state.onboardingCompletedAt ?? null,
        automaticPromptCount: state.automaticPromptCount,
        lastAutomaticPromptAt: state.lastAutomaticPromptAt ?? null,
        suppressAutomaticPrompts: state.suppressAutomaticPrompts,
        lastManualStoreOpenAt: state.lastManualStoreOpenAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: reviewPromptStateTable.id,
        set: {
          onboardingCompletedAt: state.onboardingCompletedAt ?? null,
          automaticPromptCount: state.automaticPromptCount,
          lastAutomaticPromptAt: state.lastAutomaticPromptAt ?? null,
          suppressAutomaticPrompts: state.suppressAutomaticPrompts,
          lastManualStoreOpenAt: state.lastManualStoreOpenAt ?? null,
          updatedAt: timestamp,
        },
      })
      .run();
  }

  function persistImportSession(
    targetDb: FlorivaDatabase,
    session: ImportSession,
    timestamp: string,
  ) {
    targetDb
      .insert(importSessionsTable)
      .values({
        ...session,
        completedAt: session.completedAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: importSessionsTable.id,
        set: {
          source: session.source,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt ?? null,
          importedLogCount: session.importedLogCount,
          skippedLogCount: session.skippedLogCount,
          updatedAt: timestamp,
        },
      })
      .run();
  }

  function persistDailyLogEntry(
    targetDb: FlorivaDatabase,
    entry: DailyLogEntry,
    timestamp: string,
  ) {
    const conflictingRows = targetDb
      .select({ id: dailyLogsTable.id })
      .from(dailyLogsTable)
      .where(eq(dailyLogsTable.id, entry.id))
      .all();
    const conflictingByDate = targetDb
      .select({ id: dailyLogsTable.id })
      .from(dailyLogsTable)
      .where(eq(dailyLogsTable.logDate, entry.logDate))
      .all();
    const idsToDelete = new Set([
      ...conflictingRows.map((row) => row.id),
      ...conflictingByDate.map((row) => row.id),
    ]);

    if (idsToDelete.size > 0) {
      targetDb
        .delete(dailyLogsTable)
        .where(inArray(dailyLogsTable.id, [...idsToDelete]))
        .run();
    }

    targetDb
      .insert(dailyLogsTable)
      .values({
        id: entry.id,
        logDate: entry.logDate,
        bleeding: entry.bleeding,
        mood: entry.mood ?? null,
        notes: entry.notes ?? null,
        importSessionId: entry.importSessionId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    if (entry.symptoms.length > 0) {
      targetDb
        .insert(dailyLogSymptomsTable)
        .values(
          entry.symptoms.map((symptomKey, index) => ({
            id: `${entry.id}-symptom-${symptomKey}`,
            dailyLogId: entry.id,
            symptomKey,
            sortOrder: index,
            createdAt: timestamp,
            updatedAt: timestamp,
          })),
        )
        .run();
    }

    if (entry.ttcObservation) {
      targetDb
        .insert(ttcObservationsTable)
        .values({
          id: `${entry.id}-ttc`,
          dailyLogId: entry.id,
          cervicalMucus: entry.ttcObservation.cervicalMucus ?? null,
          ovulationTest: entry.ttcObservation.ovulationTest ?? null,
          basalBodyTemperatureCelsius:
            entry.ttcObservation.basalBodyTemperatureCelsius ?? null,
          sexLogged: entry.ttcObservation.sexLogged ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    }

    if (entry.birthControlEvent) {
      targetDb
        .insert(birthControlEventsTable)
        .values({
          id: `${entry.id}-birth-control`,
          dailyLogId: entry.id,
          method: entry.birthControlEvent.method,
          missedDose: entry.birthControlEvent.missedDose ?? null,
          lateDose: entry.birthControlEvent.lateDose ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    }
  }

  function clearAllLocalTables(targetDb: FlorivaDatabase) {
    targetDb.delete(backupEventsTable).run();
    targetDb.delete(dailyLogSymptomsTable).run();
    targetDb.delete(ttcObservationsTable).run();
    targetDb.delete(birthControlEventsTable).run();
    targetDb.delete(dailyLogsTable).run();
    targetDb.delete(reviewPromptSaveEventsTable).run();
    targetDb.delete(userProfileGoalsTable).run();
    targetDb.delete(userProfileConditionsTable).run();
    targetDb.delete(userProfileTable).run();
    targetDb.delete(importSessionsTable).run();
    targetDb.delete(reminderPreferencesTable).run();
    targetDb.delete(privacyPreferencesTable).run();
    targetDb.delete(reviewPromptStateTable).run();
    targetDb.delete(billingSnapshotTable).run();
    targetDb.delete(appPreferencesTable).run();
  }

  async function listAllDailyLogEntries() {
    const rows = await db.select().from(dailyLogsTable).orderBy(asc(dailyLogsTable.logDate));

    if (rows.length === 0) {
      return [];
    }

    const logIds = rows.map((row) => row.id);
    const [symptomRows, ttcRows, birthControlRows] = await Promise.all([
      db
        .select()
        .from(dailyLogSymptomsTable)
        .where(inArray(dailyLogSymptomsTable.dailyLogId, logIds))
        .orderBy(asc(dailyLogSymptomsTable.sortOrder)),
      db
        .select()
        .from(ttcObservationsTable)
        .where(inArray(ttcObservationsTable.dailyLogId, logIds)),
      db
        .select()
        .from(birthControlEventsTable)
        .where(inArray(birthControlEventsTable.dailyLogId, logIds)),
    ]);

    const symptomsByLogId = new Map<string, (typeof dailyLogSymptomsTable.$inferSelect)[]>();
    for (const row of symptomRows) {
      const current = symptomsByLogId.get(row.dailyLogId) ?? [];
      current.push(row);
      symptomsByLogId.set(row.dailyLogId, current);
    }

    const ttcByLogId = new Map(ttcRows.map((row) => [row.dailyLogId, row]));
    const birthControlByLogId = new Map(birthControlRows.map((row) => [row.dailyLogId, row]));

    return rows.map((row) =>
      mapDailyLogEntry(
        row,
        symptomsByLogId.get(row.id) ?? [],
        ttcByLogId.get(row.id),
        birthControlByLogId.get(row.id),
      ),
    );
  }

  async function listDailyLogEntries(startIso: string, endIso: string) {
    const rows = await db
      .select()
      .from(dailyLogsTable)
      .where(and(gte(dailyLogsTable.logDate, startIso), lte(dailyLogsTable.logDate, endIso)))
      .orderBy(asc(dailyLogsTable.logDate));

    if (rows.length === 0) {
      return [];
    }

    const logIds = rows.map((row) => row.id);
    const [symptomRows, ttcRows, birthControlRows] = await Promise.all([
      db
        .select()
        .from(dailyLogSymptomsTable)
        .where(inArray(dailyLogSymptomsTable.dailyLogId, logIds))
        .orderBy(asc(dailyLogSymptomsTable.sortOrder)),
      db
        .select()
        .from(ttcObservationsTable)
        .where(inArray(ttcObservationsTable.dailyLogId, logIds)),
      db
        .select()
        .from(birthControlEventsTable)
        .where(inArray(birthControlEventsTable.dailyLogId, logIds)),
    ]);

    const symptomsByLogId = new Map<string, (typeof dailyLogSymptomsTable.$inferSelect)[]>();
    for (const row of symptomRows) {
      const current = symptomsByLogId.get(row.dailyLogId) ?? [];
      current.push(row);
      symptomsByLogId.set(row.dailyLogId, current);
    }

    const ttcByLogId = new Map(ttcRows.map((row) => [row.dailyLogId, row]));
    const birthControlByLogId = new Map(
      birthControlRows.map((row) => [row.dailyLogId, row]),
    );

    return rows.map((row) =>
      mapDailyLogEntry(
        row,
        symptomsByLogId.get(row.id) ?? [],
        ttcByLogId.get(row.id),
        birthControlByLogId.get(row.id),
      ),
    );
  }

  return {
    appPreferences: {
      async getPreferences() {
        const [row] = await db
          .select()
          .from(appPreferencesTable)
          .where(eq(appPreferencesTable.id, appPreferencesRowId))
          .limit(1);

        return row ? mapAppPreferences(row) : defaultAppPreferences;
      },
      async savePreferences(preferences) {
        const parsedPreferences = appPreferencesSchema.parse(preferences);
        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistAppPreferences(tx, parsedPreferences, timestamp);
        });
      },
    },

    billingSnapshot: {
      async getSnapshot() {
        const [row] = await db
          .select()
          .from(billingSnapshotTable)
          .where(eq(billingSnapshotTable.id, billingSnapshotRowId))
          .limit(1);

        return row ? mapBillingSnapshot(row) : defaultBillingSnapshot;
      },
      async saveSnapshot(snapshot) {
        const parsedSnapshot = billingSnapshotSchema.parse(snapshot);
        const timestamp = nowIso();

        persistBillingSnapshot(db, parsedSnapshot, timestamp);
      },
    },

    userProfile: {
      async getProfile() {
        const [row] = await db
          .select()
          .from(userProfileTable)
          .where(eq(userProfileTable.id, userProfileRowId))
          .limit(1);

        if (!row) {
          return null;
        }

        const [goals, conditions] = await Promise.all([
          db
            .select()
            .from(userProfileGoalsTable)
            .where(eq(userProfileGoalsTable.profileId, userProfileRowId))
            .orderBy(asc(userProfileGoalsTable.sortOrder)),
          db
            .select()
            .from(userProfileConditionsTable)
            .where(eq(userProfileConditionsTable.profileId, userProfileRowId))
            .orderBy(asc(userProfileConditionsTable.sortOrder)),
        ]);

        return mapUserProfile(row, goals, conditions);
      },
      async saveProfile(profile) {
        const parsedProfile = userProfileSchema.parse(profile);
        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistUserProfile(tx, parsedProfile, timestamp);
        });
      },
      async saveProfileAndReminderPreferences(profile, preferences) {
        const parsedProfile = userProfileSchema.parse(profile);
        const parsedPreferences = reminderPreferencesSchema.parse(preferences);
        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistUserProfile(tx, parsedProfile, timestamp);
          persistReminderPreferences(tx, parsedPreferences, timestamp);
        });
      },
      async clearProfile() {
        await db.delete(userProfileTable).where(eq(userProfileTable.id, userProfileRowId));
      },
    },

    dailyLogs: {
      async getEntryByDate(logDate) {
        const entries = await listDailyLogEntries(logDate, logDate);

        return entries[0] ?? null;
      },
      async listAll() {
        return listAllDailyLogEntries();
      },
      async listByDates(dates) {
        const uniqueDates = [...new Set(dates)];

        if (uniqueDates.length === 0) {
          return [];
        }

        const rows = await db
          .select()
          .from(dailyLogsTable)
          .where(inArray(dailyLogsTable.logDate, uniqueDates))
          .orderBy(asc(dailyLogsTable.logDate));

        if (rows.length === 0) {
          return [];
        }

        const logIds = rows.map((row) => row.id);
        const [symptomRows, ttcRows, birthControlRows] = await Promise.all([
          db
            .select()
            .from(dailyLogSymptomsTable)
            .where(inArray(dailyLogSymptomsTable.dailyLogId, logIds))
            .orderBy(asc(dailyLogSymptomsTable.sortOrder)),
          db
            .select()
            .from(ttcObservationsTable)
            .where(inArray(ttcObservationsTable.dailyLogId, logIds)),
          db
            .select()
            .from(birthControlEventsTable)
            .where(inArray(birthControlEventsTable.dailyLogId, logIds)),
        ]);

        const symptomsByLogId = new Map<string, (typeof dailyLogSymptomsTable.$inferSelect)[]>();
        for (const row of symptomRows) {
          const current = symptomsByLogId.get(row.dailyLogId) ?? [];
          current.push(row);
          symptomsByLogId.set(row.dailyLogId, current);
        }

        const ttcByLogId = new Map(ttcRows.map((row) => [row.dailyLogId, row]));
        const birthControlByLogId = new Map(
          birthControlRows.map((row) => [row.dailyLogId, row]),
        );

        return rows.map((row) =>
          mapDailyLogEntry(
            row,
            symptomsByLogId.get(row.id) ?? [],
            ttcByLogId.get(row.id),
            birthControlByLogId.get(row.id),
          ),
        );
      },
      async listByDateRange(startIso, endIso) {
        return listDailyLogEntries(startIso, endIso);
      },
      async saveEntry(entry) {
        const parsedEntry = dailyLogEntrySchema.parse(entry);
        assertLogDateIsCalendarValid(parsedEntry.logDate);
        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistDailyLogEntry(tx, parsedEntry, timestamp);
        });
      },
      async saveEntryIfDateAbsent(entry) {
        const parsedEntry = dailyLogEntrySchema.parse(entry);
        assertLogDateIsCalendarValid(parsedEntry.logDate);
        const timestamp = nowIso();

        return runInTransaction(db, (tx) => {
          const existingDate = tx
            .select({ id: dailyLogsTable.id })
            .from(dailyLogsTable)
            .where(eq(dailyLogsTable.logDate, parsedEntry.logDate))
            .limit(1)
            .get();

          if (existingDate) {
            return false;
          }

          const existingId = tx
            .select({ id: dailyLogsTable.id })
            .from(dailyLogsTable)
            .where(eq(dailyLogsTable.id, parsedEntry.id))
            .limit(1)
            .get();

          if (existingId) {
            return false;
          }

          persistDailyLogEntry(tx, parsedEntry, timestamp);
          return true;
        });
      },
      async deleteEntry(entryId) {
        await db.delete(dailyLogsTable).where(eq(dailyLogsTable.id, entryId));
      },
    },

    reminderPreferences: {
      async getPreferences() {
        const rows = await db
          .select()
          .from(reminderPreferencesTable)
          .orderBy(asc(reminderPreferencesTable.sortOrder));

        return rows.length > 0
          ? mergeReminderPreferences(rows.map(mapReminderPreference))
          : defaultReminderPreferences;
      },
      async savePreferences(preferences) {
        const parsedPreferences = reminderPreferencesSchema.parse(preferences);
        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistReminderPreferences(tx, parsedPreferences, timestamp);
        });
      },
    },

    privacyPreferences: {
      async getPreference() {
        const [row] = await db
          .select()
          .from(privacyPreferencesTable)
          .where(eq(privacyPreferencesTable.id, privacyPreferencesRowId))
          .limit(1);

        return row
          ? {
              biometricsEnabled: row.biometricsEnabled,
              relockAfterSeconds: row.relockAfterSeconds,
              destructiveActionConfirmationRequired:
                row.destructiveActionConfirmationRequired,
              diagnosticsConsentEnabled: row.diagnosticsConsentEnabled,
            }
          : defaultPrivacyPreference;
      },
      async savePreference(preference) {
        const parsedPreference = privacyPreferenceSchema.parse(preference);
        const timestamp = nowIso();

        persistPrivacyPreference(db, parsedPreference, timestamp);
      },
    },

    reviewPromptState: {
      async getState() {
        return loadReviewPromptState();
      },
      async seedOnboardingCompletion(timestamp) {
        const existingState = await loadReviewPromptState();
        const parsedState = reviewPromptStateSchema.parse({
          ...existingState,
          onboardingCompletedAt: existingState.onboardingCompletedAt ?? timestamp,
        });

        runInTransaction(db, (tx) => {
          persistReviewPromptState(tx, parsedState, timestamp);
        });
      },
      async recordSuccessfulSave(logDate, timestamp) {
        runInTransaction(db, (tx) => {
          tx.insert(reviewPromptSaveEventsTable).values({
            logDate,
            savedAt: timestamp,
            createdAt: timestamp,
          }).run();
        });
      },
      async listSuccessfulSaveEventsSince(timestamp) {
        const rows = await db
          .select()
          .from(reviewPromptSaveEventsTable)
          .where(gte(reviewPromptSaveEventsTable.savedAt, timestamp))
          .orderBy(asc(reviewPromptSaveEventsTable.savedAt));

        return rows.map(mapReviewPromptSaveEvent);
      },
      async recordAutomaticPrompt(timestamp) {
        const existingState = await loadReviewPromptState();
        const parsedState = reviewPromptStateSchema.parse({
          ...existingState,
          automaticPromptCount: existingState.automaticPromptCount + 1,
          lastAutomaticPromptAt: timestamp,
        });

        runInTransaction(db, (tx) => {
          persistReviewPromptState(tx, parsedState, timestamp);
        });
      },
      async recordManualStoreOpen(timestamp) {
        const existingState = await loadReviewPromptState();
        const parsedState = reviewPromptStateSchema.parse({
          ...existingState,
          suppressAutomaticPrompts: true,
          lastManualStoreOpenAt: timestamp,
        });

        runInTransaction(db, (tx) => {
          persistReviewPromptState(tx, parsedState, timestamp);
        });
      },
      async reset() {
        runInTransaction(db, (tx) => {
          tx.delete(reviewPromptSaveEventsTable).run();
          tx.delete(reviewPromptStateTable).where(eq(reviewPromptStateTable.id, reviewPromptStateRowId)).run();
        });
      },
    },

    importSessions: {
      async getSession(sessionId) {
        const [row] = await db
          .select()
          .from(importSessionsTable)
          .where(eq(importSessionsTable.id, sessionId))
          .limit(1);

        return row ? mapImportSession(row) : null;
      },
      async listSessions() {
        const rows = await db
          .select()
          .from(importSessionsTable)
          .orderBy(asc(importSessionsTable.startedAt));

        return rows.map(mapImportSession);
      },
      async saveSession(session) {
        const parsedSession = importSessionSchema.parse(session);
        const timestamp = nowIso();

        persistImportSession(db, parsedSession, timestamp);
      },
    },

    backupEvents: {
      async listEvents() {
        const rows = await db
          .select()
          .from(backupEventsTable)
          .orderBy(asc(backupEventsTable.occurredAt));

        return rows.map(mapBackupEvent);
      },
      async recordEvent(event) {
        const parsedEvent = backupEventSchema.parse(event);

        await db
          .insert(backupEventsTable)
          .values({
            id: parsedEvent.id,
            action: parsedEvent.action,
            occurredAt: parsedEvent.occurredAt,
            detail: parsedEvent.detail,
            createdAt: parsedEvent.occurredAt,
          })
          .onConflictDoUpdate({
            target: backupEventsTable.id,
            set: {
              action: parsedEvent.action,
              occurredAt: parsedEvent.occurredAt,
              detail: parsedEvent.detail,
            },
          });
      },
    },

    localDataMaintenance: {
      async wipeLocalData() {
        runInTransaction(db, (tx) => {
          clearAllLocalTables(tx);
        });
      },
    },

    backupData: {
      async exportSnapshot() {
        const [appPreferencesRow, billingSnapshotRow, userProfileRow, reminderRows, privacyRow, importSessionRows, dailyLogs] =
          await Promise.all([
            db
              .select()
              .from(appPreferencesTable)
              .where(eq(appPreferencesTable.id, appPreferencesRowId))
              .limit(1),
            db
              .select()
              .from(billingSnapshotTable)
              .where(eq(billingSnapshotTable.id, billingSnapshotRowId))
              .limit(1),
            db
              .select()
              .from(userProfileTable)
              .where(eq(userProfileTable.id, userProfileRowId))
              .limit(1),
            db.select().from(reminderPreferencesTable).orderBy(asc(reminderPreferencesTable.sortOrder)),
            db
              .select()
              .from(privacyPreferencesTable)
              .where(eq(privacyPreferencesTable.id, privacyPreferencesRowId))
              .limit(1),
            db.select().from(importSessionsTable).orderBy(asc(importSessionsTable.startedAt)),
            listAllDailyLogEntries(),
          ]);

        const profileRow = userProfileRow[0];
        const [profileGoals, profileConditions] = profileRow
          ? await Promise.all([
              db
                .select()
                .from(userProfileGoalsTable)
                .where(eq(userProfileGoalsTable.profileId, userProfileRowId))
                .orderBy(asc(userProfileGoalsTable.sortOrder)),
              db
                .select()
                .from(userProfileConditionsTable)
                .where(eq(userProfileConditionsTable.profileId, userProfileRowId))
                .orderBy(asc(userProfileConditionsTable.sortOrder)),
            ])
          : [[], []];

        return backupSnapshotSchema.parse({
          formatVersion: 1,
          exportedAt: nowIso(),
          appPreferences: appPreferencesRow[0]
            ? mapAppPreferences(appPreferencesRow[0])
            : defaultAppPreferences,
          billingSnapshot: billingSnapshotRow[0]
            ? mapBillingSnapshot(billingSnapshotRow[0])
            : defaultBillingSnapshot,
          userProfile: profileRow
            ? mapUserProfile(profileRow, profileGoals, profileConditions)
            : null,
          reminderPreferences:
            reminderRows.length > 0
              ? mergeReminderPreferences(reminderRows.map(mapReminderPreference))
              : defaultReminderPreferences,
          privacyPreference: privacyRow[0]
            ? {
                biometricsEnabled: privacyRow[0].biometricsEnabled,
                relockAfterSeconds: privacyRow[0].relockAfterSeconds,
                destructiveActionConfirmationRequired:
                  privacyRow[0].destructiveActionConfirmationRequired,
                diagnosticsConsentEnabled: privacyRow[0].diagnosticsConsentEnabled,
              }
            : defaultPrivacyPreference,
          importSessions: importSessionRows.map(mapImportSession),
          dailyLogs,
        });
      },
      async restoreSnapshot(snapshot) {
        const parsedSnapshot = backupSnapshotSchema.parse(snapshot);
        const importSessionIds = new Set(
          parsedSnapshot.importSessions.map((importSession) => importSession.id),
        );

        for (const dailyLog of parsedSnapshot.dailyLogs) {
          if (
            dailyLog.importSessionId &&
            !importSessionIds.has(dailyLog.importSessionId)
          ) {
            throw new Error(
              `Backup daily log ${dailyLog.id} references a missing import session.`,
            );
          }
          assertLogDateIsCalendarValid(dailyLog.logDate);
        }

        runInTransaction(db, (tx) => {
          clearAllLocalTables(tx);

          const timestamp = nowIso();

          persistAppPreferences(tx, parsedSnapshot.appPreferences, timestamp);
          persistBillingSnapshot(tx, parsedSnapshot.billingSnapshot, timestamp);

          if (parsedSnapshot.userProfile) {
            persistUserProfile(tx, parsedSnapshot.userProfile, timestamp);
          }

          persistReminderPreferences(
            tx,
            mergeReminderPreferences(parsedSnapshot.reminderPreferences),
            timestamp,
          );
          persistPrivacyPreference(tx, parsedSnapshot.privacyPreference, timestamp);

          for (const importSession of parsedSnapshot.importSessions) {
            persistImportSession(tx, importSession, timestamp);
          }

          for (const dailyLog of parsedSnapshot.dailyLogs) {
            persistDailyLogEntry(tx, dailyLog, timestamp);
          }

          if (parsedSnapshot.appPreferences.hasCompletedOnboarding && parsedSnapshot.userProfile) {
            persistReviewPromptState(
              tx,
              {
                ...defaultReviewPromptState,
                onboardingCompletedAt: timestamp,
              },
              timestamp,
            );
          }
        });
      },
    },

    onboarding: {
      async completeOnboarding(profile, preferences) {
        const parsedProfile = userProfileSchema.parse(profile);
        const parsedPreferences = appPreferencesSchema.parse(preferences);
        const hydratedProfile = {
          ...parsedProfile,
          ttcTrackingPreferences:
            parsedProfile.ttcTrackingPreferences ?? defaultTtcTrackingPreferences,
        };

        if (!isOnboardingProfileComplete(hydratedProfile)) {
          throw new Error('Onboarding profile is incomplete');
        }

        const timestamp = nowIso();

        runInTransaction(db, (tx) => {
          persistUserProfile(tx, hydratedProfile, timestamp);
          persistAppPreferences(tx, parsedPreferences, timestamp);
        });
      },
    },
  };
}
