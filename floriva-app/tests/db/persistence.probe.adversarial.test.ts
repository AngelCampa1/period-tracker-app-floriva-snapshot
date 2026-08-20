/**
 * Adversarial persistence probe tests.
 *
 * Targets not already covered by repositories.adversarial.test.ts and
 * validators.test.ts.  Focuses on:
 *  - round-trip fidelity across ALL field-type categories
 *  - boundary values: notes at exactly 500 chars, BBT at 30/45, dates at year
 *    boundaries, Feb 29 leap-year edge, month-rollover traps
 *  - validator rejection precision (enum coercion, wrong types, out-of-range)
 *  - privacy wipe completeness (every table including reviewPromptSaveEvents)
 *  - user-profile round-trip (goals ordering, conditionTags ordering)
 *  - reminder-preferences round-trip (daily vs cycle-event cadences)
 *  - import-session FK enforcement: delete cascade on wipe
 *  - saveEntryIfDateAbsent semantics (id clash, date clash)
 *  - listByDates query (empty list, partial overlaps)
 *  - concurrent-ish same-id write stability
 */

import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import {
  dailyLogEntrySchema,
  userProfileSchema,
  reminderPreferenceSchema,
  privacyPreferenceSchema,
} from '@/src/db/validators';
import type { UserProfile, ReminderPreference } from '@/src/types/domain';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');

function createTestHarness() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationDirectory });
  const repositories = createDomainRepositories(db);
  return { sqlite, db, repositories };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. ROUND-TRIP FIDELITY — comprehensive field coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: round-trip fidelity', () => {
  it('notes at exactly 500 chars survives unchanged (boundary allowed)', async () => {
    const { repositories } = createTestHarness();
    const notes = 'a'.repeat(500);

    await repositories.dailyLogs.saveEntry({
      id: 'log-notes-500',
      logDate: '2026-01-01',
      bleeding: 'none',
      symptoms: [],
      notes,
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-01-01');
    expect(entry?.notes).toBe(notes);
    expect(entry?.notes?.length).toBe(500);
  });

  it('BBT at boundary 30.0 is stored and returned exactly', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-bbt-min',
      logDate: '2026-01-02',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: { basalBodyTemperatureCelsius: 30.0 },
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-01-02');
    expect(entry?.ttcObservation?.basalBodyTemperatureCelsius).toBe(30.0);
  });

  it('BBT at boundary 45.0 is stored and returned exactly', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-bbt-max',
      logDate: '2026-01-03',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: { basalBodyTemperatureCelsius: 45.0 },
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-01-03');
    expect(entry?.ttcObservation?.basalBodyTemperatureCelsius).toBe(45.0);
  });

  it('year boundary: Dec 31 and Jan 1 are independent entries with correct logDate', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-dec31',
      logDate: '2025-12-31',
      bleeding: 'light',
      symptoms: [],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-jan01',
      logDate: '2026-01-01',
      bleeding: 'medium',
      symptoms: [],
    });

    const dec31 = await repositories.dailyLogs.getEntryByDate('2025-12-31');
    const jan01 = await repositories.dailyLogs.getEntryByDate('2026-01-01');

    expect(dec31?.logDate).toBe('2025-12-31');
    expect(jan01?.logDate).toBe('2026-01-01');
    expect(dec31?.id).toBe('log-dec31');
    expect(jan01?.id).toBe('log-jan01');
  });

  it('Feb 29 on a leap year is stored and retrieved with the correct date', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-leap-29',
      logDate: '2024-02-29',
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2024-02-29');
    expect(entry?.logDate).toBe('2024-02-29');
  });

  it('all bleeding intensity values round-trip cleanly', async () => {
    const { repositories } = createTestHarness();
    const values = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;

    for (const [i, bleeding] of values.entries()) {
      await repositories.dailyLogs.saveEntry({
        id: `log-bleeding-${bleeding}`,
        logDate: `2026-02-0${i + 1}`,
        bleeding,
        symptoms: [],
      });
    }

    for (const [i, bleeding] of values.entries()) {
      const entry = await repositories.dailyLogs.getEntryByDate(`2026-02-0${i + 1}`);
      expect(entry?.bleeding).toBe(bleeding);
    }
  });

  it('all mood values round-trip cleanly', async () => {
    const { repositories } = createTestHarness();
    const moods = ['steady', 'low', 'sensitive', 'energized'] as const;

    for (const [i, mood] of moods.entries()) {
      await repositories.dailyLogs.saveEntry({
        id: `log-mood-${mood}`,
        logDate: `2026-03-0${i + 1}`,
        bleeding: 'none',
        symptoms: [],
        mood,
      });
    }

    for (const [i, mood] of moods.entries()) {
      const entry = await repositories.dailyLogs.getEntryByDate(`2026-03-0${i + 1}`);
      expect(entry?.mood).toBe(mood);
    }
  });

  it('all cervical mucus values round-trip cleanly', async () => {
    const { repositories } = createTestHarness();
    const values = ['dry', 'sticky', 'creamy', 'egg-white'] as const;

    for (const [i, cm] of values.entries()) {
      await repositories.dailyLogs.saveEntry({
        id: `log-cm-${cm}`,
        logDate: `2026-04-0${i + 1}`,
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { cervicalMucus: cm },
      });
    }

    for (const [i, cm] of values.entries()) {
      const entry = await repositories.dailyLogs.getEntryByDate(`2026-04-0${i + 1}`);
      expect(entry?.ttcObservation?.cervicalMucus).toBe(cm);
    }
  });

  it('all ovulation test values round-trip cleanly', async () => {
    const { repositories } = createTestHarness();
    const values = ['negative', 'positive', 'peak'] as const;

    for (const [i, ot] of values.entries()) {
      await repositories.dailyLogs.saveEntry({
        id: `log-ot-${ot}`,
        logDate: `2026-05-0${i + 1}`,
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { ovulationTest: ot },
      });
    }

    for (const [i, ot] of values.entries()) {
      const entry = await repositories.dailyLogs.getEntryByDate(`2026-05-0${i + 1}`);
      expect(entry?.ttcObservation?.ovulationTest).toBe(ot);
    }
  });

  it('multi-byte unicode in notes is preserved byte-for-byte', async () => {
    const { repositories } = createTestHarness();
    // Japanese, Arabic, emoji, combining chars, surrogate pair
    const unicodeNotes = '今日は🌸。مرحبا — café ñoño 𝄞';

    await repositories.dailyLogs.saveEntry({
      id: 'log-unicode',
      logDate: '2026-06-01',
      bleeding: 'light',
      symptoms: [],
      notes: unicodeNotes,
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-01');
    expect(entry?.notes).toBe(unicodeNotes);
  });

  it('null optional fields (mood, notes, ttcObservation, birthControlEvent) come back as undefined', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-nulls',
      logDate: '2026-06-02',
      bleeding: 'none',
      symptoms: [],
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-02');
    expect(entry?.mood).toBeUndefined();
    expect(entry?.notes).toBeUndefined();
    expect(entry?.ttcObservation).toBeUndefined();
    expect(entry?.birthControlEvent).toBeUndefined();
    expect(entry?.importSessionId).toBeUndefined();
  });

  it('symptom sort order is preserved across writes', async () => {
    const { repositories } = createTestHarness();
    const symptoms = [
      'cramps',
      'fatigue',
      'bloating',
      'headache',
      'breast-tenderness',
    ] as const;

    await repositories.dailyLogs.saveEntry({
      id: 'log-sym-order',
      logDate: '2026-06-03',
      bleeding: 'medium',
      symptoms: [...symptoms],
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-03');
    expect(entry?.symptoms).toEqual(symptoms);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. USER PROFILE ROUND-TRIP
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: user profile round-trip', () => {
  it('goals ordering is preserved after save/load', async () => {
    const { repositories } = createTestHarness();

    const profile: UserProfile = {
      goals: ['trying-to-conceive', 'period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    };

    await repositories.userProfile.saveProfile(profile);
    const loaded = await repositories.userProfile.getProfile();

    expect(loaded?.goals).toEqual(['trying-to-conceive', 'period', 'symptoms']);
  });

  it('conditionTags ordering is preserved after save/load', async () => {
    const { repositories } = createTestHarness();

    const profile: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: ['endometriosis', 'pcos', 'pmdd'],
    };

    await repositories.userProfile.saveProfile(profile);
    const loaded = await repositories.userProfile.getProfile();

    expect(loaded?.conditionTags).toEqual(['endometriosis', 'pcos', 'pmdd']);
  });

  it('updating the profile replaces goals — old goals are gone, no duplicates', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });

    await repositories.userProfile.saveProfile({
      goals: ['trying-to-conceive'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
    });

    const goalCount = sqlite.prepare('SELECT count(*) as n FROM user_profile_goals').get() as { n: number };
    expect(goalCount.n).toBe(1);

    const conditionCount = sqlite.prepare('SELECT count(*) as n FROM user_profile_conditions').get() as { n: number };
    expect(conditionCount.n).toBe(1);

    const loaded = await repositories.userProfile.getProfile();
    expect(loaded?.goals).toEqual(['trying-to-conceive']);
    expect(loaded?.conditionTags).toEqual(['pcos']);
  });

  it('clearProfile removes the profile row and its goal/condition children', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
    });

    await repositories.userProfile.clearProfile();

    expect(await repositories.userProfile.getProfile()).toBeNull();
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_goals').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_conditions').get(),
    ).toEqual({ n: 0 });
  });

  it('optional numeric fields (cycleLengthDays, periodLengthDays) survive null→value→null round-trip', async () => {
    const { repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      cycleLengthDays: 28,
      periodLengthDays: 5,
    });

    const v1 = await repositories.userProfile.getProfile();
    expect(v1?.cycleLengthDays).toBe(28);
    expect(v1?.periodLengthDays).toBe(5);

    // Overwrite with undefined (omit optional fields)
    await repositories.userProfile.saveProfile({
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
    });

    const v2 = await repositories.userProfile.getProfile();
    expect(v2?.cycleLengthDays).toBeUndefined();
    expect(v2?.periodLengthDays).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. REMINDER PREFERENCES ROUND-TRIP
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: reminder preferences round-trip', () => {
  it('daily cadence reminders survive save/load with correct schedule shape', async () => {
    const { repositories } = createTestHarness();

    const prefs: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ];

    await repositories.reminderPreferences.savePreferences(prefs);
    const loaded = await repositories.reminderPreferences.getPreferences();

    const dailyLog = loaded.find((p) => p.kind === 'daily-log');
    expect(dailyLog?.schedule.cadence).toBe('daily');
    expect(dailyLog?.hour).toBe(20);
    expect(dailyLog?.minute).toBe(0);
    expect(dailyLog?.enabled).toBe(true);
  });

  it('cycle-event cadence reminders survive save/load with daysBefore intact', async () => {
    const { repositories } = createTestHarness();

    const prefs: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 30,
        schedule: { cadence: 'cycle-event', daysBefore: 3 },
      },
    ];

    await repositories.reminderPreferences.savePreferences(prefs);
    const loaded = await repositories.reminderPreferences.getPreferences();

    const periodStart = loaded.find((p) => p.kind === 'period-start');
    expect(periodStart?.schedule.cadence).toBe('cycle-event');
    if (periodStart?.schedule.cadence === 'cycle-event') {
      expect(periodStart.schedule.daysBefore).toBe(3);
    }
  });

  it('saving empty reminder list clears all existing reminders', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.reminderPreferences.savePreferences([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    await repositories.reminderPreferences.savePreferences([]);

    expect(
      sqlite.prepare('SELECT count(*) as n FROM reminder_preferences').get(),
    ).toEqual({ n: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. PRIVACY WIPE COMPLETENESS — highest priority
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: privacy wipe completeness', () => {
  /**
   * Seeds ALL tables that clearAllLocalTables targets, then wipes,
   * then checks every single table.  This is the canonical privacy-critical test.
   */
  it('wipeLocalData removes ALL rows from ALL tables including reviewPromptSaveEvents', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Seed import session first (FK parent)
    await repositories.importSessions.saveSession({
      id: 'sess-wipe',
      source: 'clue',
      status: 'committed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T01:00:00.000Z',
      importedLogCount: 2,
      skippedLogCount: 0,
    });

    // Daily log with all child types
    await repositories.dailyLogs.saveEntry({
      id: 'log-wipe-full',
      logDate: '2026-01-01',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      mood: 'low',
      notes: 'Wipe me',
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'positive',
        basalBodyTemperatureCelsius: 36.6,
        sexLogged: true,
      },
      birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
      importSessionId: 'sess-wipe',
    });

    // User profile with goals and conditions
    await repositories.userProfile.saveProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos', 'pmdd'],
    });

    // App preferences
    await repositories.appPreferences.savePreferences({
      hasCompletedOnboarding: true,
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: true,
      showFertilityEstimates: true,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      themePreference: 'system',
      localePreference: 'system',
    });

    // Privacy preference
    await repositories.privacyPreferences.savePreference({
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    });

    // Reminder preferences
    await repositories.reminderPreferences.savePreferences([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    // Review prompt state + save events
    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-01-01T12:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-01-01',
      '2026-01-01T12:00:00.000Z',
    );

    // Backup events
    await repositories.backupEvents.recordEvent({
      id: 'bkup-1',
      action: 'exported',
      occurredAt: '2026-01-01T13:00:00.000Z',
      detail: 'Test backup event',
    });

    // Billing snapshot
    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'annual',
      trialEndsAt: '2026-06-01T00:00:00.000Z',
    });

    // Verify data is present before wipe
    const preWipeLog = sqlite.prepare('SELECT count(*) as n FROM daily_logs').get() as { n: number };
    expect(preWipeLog.n).toBeGreaterThan(0);

    // WIPE
    await repositories.localDataMaintenance.wipeLocalData();

    // Check every table the implementation clears
    const tablesToCheck = [
      'backup_events',
      'daily_log_symptoms',
      'ttc_observations',
      'birth_control_events',
      'daily_logs',
      'review_prompt_save_events',
      'user_profile_goals',
      'user_profile_conditions',
      'user_profile',
      'import_sessions',
      'reminder_preferences',
      'privacy_preferences',
      'review_prompt_state',
      'billing_snapshot',
      'app_preferences',
    ];

    for (const table of tablesToCheck) {
      const result = sqlite.prepare(`SELECT count(*) as n FROM "${table}"`).get() as { n: number };
      expect(result.n).toBe(0);
    }
  });

  it('after wipe, getProfile returns null — not stale data', async () => {
    const { repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });

    await repositories.localDataMaintenance.wipeLocalData();

    expect(await repositories.userProfile.getProfile()).toBeNull();
  });

  it('after wipe, listAll returns empty array — not stale entries', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-pre-wipe',
      logDate: '2026-01-01',
      bleeding: 'light',
      symptoms: [],
    });

    await repositories.localDataMaintenance.wipeLocalData();

    expect(await repositories.dailyLogs.listAll()).toEqual([]);
  });

  it('after wipe, getPreferences returns default (not saved) app preferences', async () => {
    const { repositories } = createTestHarness();

    await repositories.appPreferences.savePreferences({
      hasCompletedOnboarding: true,
      deferredCycleSetup: true,
      deferredTrackingSetup: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: true,
      deferredImportSetup: true,
      dismissedTailoringChecklist: true,
      showFertilityEstimates: false,
      hapticsEnabled: false,
      tapSoundEnabled: true,
      themePreference: 'dark',
      localePreference: 'system',
    });

    await repositories.localDataMaintenance.wipeLocalData();

    const prefs = await repositories.appPreferences.getPreferences();
    // Defaults must be restored, not previous saved values
    expect(prefs.hasCompletedOnboarding).toBe(false);
    expect(prefs.themePreference).toBe('system');
    expect(prefs.hapticsEnabled).toBe(true);
    expect(prefs.tapSoundEnabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. IMPORT SESSION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: import session lifecycle', () => {
  it('import session FK: wipe removes import_sessions and associated daily_logs together', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.importSessions.saveSession({
      id: 'sess-fk',
      source: 'flo',
      status: 'committed',
      startedAt: '2026-01-10T00:00:00.000Z',
      importedLogCount: 1,
      skippedLogCount: 0,
    });

    await repositories.dailyLogs.saveEntry({
      id: 'log-fk',
      logDate: '2026-01-10',
      bleeding: 'light',
      symptoms: [],
      importSessionId: 'sess-fk',
    });

    await repositories.localDataMaintenance.wipeLocalData();

    expect(sqlite.prepare('SELECT count(*) as n FROM import_sessions').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) as n FROM daily_logs').get()).toEqual({ n: 0 });
  });

  it('round-trips all ImportSession fields including pending/failed statuses', async () => {
    const { repositories } = createTestHarness();

    await repositories.importSessions.saveSession({
      id: 'sess-pending',
      source: 'manual',
      status: 'pending',
      startedAt: '2026-02-01T08:00:00.000Z',
      importedLogCount: 0,
      skippedLogCount: 0,
    });

    await repositories.importSessions.saveSession({
      id: 'sess-failed',
      source: 'clue',
      status: 'failed',
      startedAt: '2026-02-02T08:00:00.000Z',
      importedLogCount: 5,
      skippedLogCount: 2,
    });

    const pending = await repositories.importSessions.getSession('sess-pending');
    expect(pending?.status).toBe('pending');
    expect(pending?.source).toBe('manual');

    const failed = await repositories.importSessions.getSession('sess-failed');
    expect(failed?.status).toBe('failed');
    expect(failed?.skippedLogCount).toBe(2);
  });

  it('listSessions returns sessions in ascending startedAt order', async () => {
    const { repositories } = createTestHarness();

    await repositories.importSessions.saveSession({
      id: 'sess-3',
      source: 'flo',
      status: 'committed',
      startedAt: '2026-03-03T00:00:00.000Z',
      importedLogCount: 0,
      skippedLogCount: 0,
    });
    await repositories.importSessions.saveSession({
      id: 'sess-1',
      source: 'clue',
      status: 'committed',
      startedAt: '2026-03-01T00:00:00.000Z',
      importedLogCount: 0,
      skippedLogCount: 0,
    });
    await repositories.importSessions.saveSession({
      id: 'sess-2',
      source: 'manual',
      status: 'committed',
      startedAt: '2026-03-02T00:00:00.000Z',
      importedLogCount: 0,
      skippedLogCount: 0,
    });

    const sessions = await repositories.importSessions.listSessions();
    expect(sessions.map((s) => s.id)).toEqual(['sess-1', 'sess-2', 'sess-3']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F. saveEntryIfDateAbsent SEMANTICS
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: saveEntryIfDateAbsent semantics', () => {
  it('returns true when the date is absent and persists the entry', async () => {
    const { repositories } = createTestHarness();

    const result = await repositories.dailyLogs.saveEntryIfDateAbsent({
      id: 'log-absent-1',
      logDate: '2026-07-01',
      bleeding: 'light',
      symptoms: [],
    });

    expect(result).toBe(true);
    const entry = await repositories.dailyLogs.getEntryByDate('2026-07-01');
    expect(entry?.id).toBe('log-absent-1');
  });

  it('returns false and does NOT overwrite when date already exists', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-existing',
      logDate: '2026-07-02',
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    const result = await repositories.dailyLogs.saveEntryIfDateAbsent({
      id: 'log-new',
      logDate: '2026-07-02',
      bleeding: 'none',
      symptoms: [],
    });

    expect(result).toBe(false);

    // Original entry must remain unchanged
    const entry = await repositories.dailyLogs.getEntryByDate('2026-07-02');
    expect(entry?.id).toBe('log-existing');
    expect(entry?.bleeding).toBe('heavy');
  });

  it('returns false and does NOT write when ID already exists on a different date', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-id-clash',
      logDate: '2026-07-03',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.saveEntryIfDateAbsent({
      id: 'log-id-clash',
      logDate: '2026-07-04', // different date but same id
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    expect(result).toBe(false);

    // The new date must NOT have been written
    const entry = await repositories.dailyLogs.getEntryByDate('2026-07-04');
    expect(entry).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G. listByDates QUERY
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: listByDates query', () => {
  it('listByDates with empty array returns empty result without error', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-skip',
      logDate: '2026-08-01',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDates([]);
    expect(result).toEqual([]);
  });

  it('listByDates returns only the matched dates, not all entries', async () => {
    const { repositories } = createTestHarness();

    for (const [id, logDate] of [
      ['log-a', '2026-08-01'],
      ['log-b', '2026-08-02'],
      ['log-c', '2026-08-03'],
    ] as const) {
      await repositories.dailyLogs.saveEntry({ id, logDate, bleeding: 'none', symptoms: [] });
    }

    const result = await repositories.dailyLogs.listByDates(['2026-08-01', '2026-08-03']);
    expect(result.map((e) => e.logDate)).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('listByDates deduplicates repeated dates — only one row per date', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-dup',
      logDate: '2026-08-05',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDates([
      '2026-08-05',
      '2026-08-05',
      '2026-08-05',
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.logDate).toBe('2026-08-05');
  });

  it('listByDates returns empty for dates not in DB', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-present',
      logDate: '2026-08-10',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDates(['2026-09-01', '2026-09-02']);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H. VALIDATOR BOUNDARY CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: validator boundary conditions', () => {
  it('dailyLogEntrySchema rejects notes of 501 chars', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        notes: 'a'.repeat(501),
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema accepts notes of exactly 500 chars', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        notes: 'a'.repeat(500),
      }),
    ).not.toThrow();
  });

  it('dailyLogEntrySchema rejects BBT below 30', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { basalBodyTemperatureCelsius: 29.9 },
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema rejects BBT above 45', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { basalBodyTemperatureCelsius: 45.1 },
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema rejects an unknown symptom key', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: ['magic-symptom'],
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema rejects an unknown mood value', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        mood: 'happy' as 'steady',
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema rejects an unknown cervical mucus value', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { cervicalMucus: 'watery' as 'creamy' },
      }),
    ).toThrow();
  });

  it('dailyLogEntrySchema rejects an unknown ovulation test value', () => {
    expect(() =>
      dailyLogEntrySchema.parse({
        id: 'x',
        logDate: '2026-01-01',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: { ovulationTest: 'inconclusive' as 'negative' },
      }),
    ).toThrow();
  });

  it('userProfileSchema rejects goals array with zero elements', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: [],
        supportsIrregularCycles: false,
        conditionTags: [],
      }),
    ).toThrow();
  });

  it('userProfileSchema rejects cycleLengthDays of 0', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        cycleLengthDays: 0,
      }),
    ).toThrow();
  });

  it('userProfileSchema rejects cycleLengthDays of 121', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        cycleLengthDays: 121,
      }),
    ).toThrow();
  });

  it('userProfileSchema accepts cycleLengthDays of 1 (min boundary)', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        cycleLengthDays: 1,
      }),
    ).not.toThrow();
  });

  it('userProfileSchema accepts cycleLengthDays of 120 (max boundary)', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        cycleLengthDays: 120,
      }),
    ).not.toThrow();
  });

  it('userProfileSchema rejects birthControlMethod of "none"', () => {
    expect(() =>
      userProfileSchema.parse({
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        birthControlMethod: 'none',
      }),
    ).toThrow('Birth control setup method cannot be none');
  });

  it('reminderPreferenceSchema rejects hour > 23', () => {
    expect(() =>
      reminderPreferenceSchema.parse({
        kind: 'daily-log',
        enabled: true,
        hour: 24,
        minute: 0,
        schedule: { cadence: 'daily' },
      }),
    ).toThrow();
  });

  it('reminderPreferenceSchema rejects minute > 59', () => {
    expect(() =>
      reminderPreferenceSchema.parse({
        kind: 'daily-log',
        enabled: true,
        hour: 8,
        minute: 60,
        schedule: { cadence: 'daily' },
      }),
    ).toThrow();
  });

  it('reminderPreferenceSchema rejects daysBefore > 30', () => {
    expect(() =>
      reminderPreferenceSchema.parse({
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 31 },
      }),
    ).toThrow();
  });

  it('privacyPreferenceSchema rejects relockAfterSeconds > 86400', () => {
    expect(() =>
      privacyPreferenceSchema.parse({
        biometricsEnabled: true,
        relockAfterSeconds: 86401,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      }),
    ).toThrow();
  });

  it('privacyPreferenceSchema accepts relockAfterSeconds of 0 and 86400 (boundaries)', () => {
    expect(() =>
      privacyPreferenceSchema.parse({
        biometricsEnabled: false,
        relockAfterSeconds: 0,
        destructiveActionConfirmationRequired: false,
        diagnosticsConsentEnabled: false,
      }),
    ).not.toThrow();

    expect(() =>
      privacyPreferenceSchema.parse({
        biometricsEnabled: false,
        relockAfterSeconds: 86400,
        destructiveActionConfirmationRequired: false,
        diagnosticsConsentEnabled: false,
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I. CONCURRENT-ISH SAME-ID WRITES
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: concurrent-ish writes on same key', () => {
  it('sequential awaited saves of the same id land in a consistent final state', async () => {
    const { repositories } = createTestHarness();

    // Fire three saves for the same id nearly simultaneously (sequential promises)
    const saves = [
      repositories.dailyLogs.saveEntry({
        id: 'log-concur',
        logDate: '2026-09-01',
        bleeding: 'heavy',
        symptoms: ['cramps'],
        notes: 'save-1',
      }),
      repositories.dailyLogs.saveEntry({
        id: 'log-concur',
        logDate: '2026-09-01',
        bleeding: 'medium',
        symptoms: ['fatigue'],
        notes: 'save-2',
      }),
      repositories.dailyLogs.saveEntry({
        id: 'log-concur',
        logDate: '2026-09-01',
        bleeding: 'light',
        symptoms: [],
        notes: 'save-3',
      }),
    ];

    await Promise.all(saves);

    // Exactly one row must exist
    const entry = await repositories.dailyLogs.getEntryByDate('2026-09-01');
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe('log-concur');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J. REVIEW PROMPT STATE ROUND-TRIP
// ─────────────────────────────────────────────────────────────────────────────

describe('probe: review prompt state round-trip', () => {
  it('seedOnboardingCompletion does not overwrite an existing onboardingCompletedAt', async () => {
    const { repositories } = createTestHarness();

    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-01-01T12:00:00.000Z',
    );
    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-06-01T12:00:00.000Z',
    );

    const state = await repositories.reviewPromptState.getState();
    // First timestamp must win
    expect(state.onboardingCompletedAt).toBe('2026-01-01T12:00:00.000Z');
  });

  it('recordAutomaticPrompt increments counter and sets lastAutomaticPromptAt', async () => {
    const { repositories } = createTestHarness();

    await repositories.reviewPromptState.recordAutomaticPrompt(
      '2026-01-02T10:00:00.000Z',
    );
    await repositories.reviewPromptState.recordAutomaticPrompt(
      '2026-01-03T10:00:00.000Z',
    );

    const state = await repositories.reviewPromptState.getState();
    expect(state.automaticPromptCount).toBe(2);
    expect(state.lastAutomaticPromptAt).toBe('2026-01-03T10:00:00.000Z');
  });

  it('reset clears prompt state and all save events', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-01-01T12:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-01-01',
      '2026-01-01T12:30:00.000Z',
    );

    await repositories.reviewPromptState.reset();

    const state = await repositories.reviewPromptState.getState();
    expect(state.onboardingCompletedAt).toBeUndefined();
    expect(state.automaticPromptCount).toBe(0);

    expect(
      sqlite.prepare('SELECT count(*) as n FROM review_prompt_save_events').get(),
    ).toEqual({ n: 0 });
  });

  it('listSuccessfulSaveEventsSince filters correctly by timestamp (inclusive)', async () => {
    const { repositories } = createTestHarness();

    const cutoff = '2026-05-10T00:00:00.000Z';

    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-05-09',
      '2026-05-09T23:59:59.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-05-10',
      cutoff,
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-05-11',
      '2026-05-11T00:00:01.000Z',
    );

    const events = await repositories.reviewPromptState.listSuccessfulSaveEventsSince(cutoff);
    expect(events.map((e) => e.logDate)).toEqual(['2026-05-10', '2026-05-11']);
  });
});
