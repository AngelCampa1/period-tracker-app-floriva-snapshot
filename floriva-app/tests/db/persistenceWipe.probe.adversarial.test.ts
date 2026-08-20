/**
 * persistenceWipe.probe.adversarial.test.ts
 *
 * Fresh adversarial pass — targets behaviors NOT covered by the existing
 * persistence.probe.adversarial.test.ts and repositories.adversarial.test.ts files.
 *
 * Focus areas:
 *   1.  saveProfileAndReminderPreferences — atomic combined write (untested elsewhere)
 *   2.  clearProfile isolation — only profile tables cleared, everything else intact
 *   3.  restoreSnapshot with duplicate logDate entries in the payload (data-loss probe)
 *   4.  restoreSnapshot atomicity: invalid importSessionId reference rolls back entirely
 *   5.  exportSnapshot exclusions: reviewPromptSaveEvents and backupEvents are NOT exported
 *       (correct) but after wipe+restore those rows are gone
 *   6.  billingSnapshot boolean field grandfatherTrialApplied round-trips false/null/true
 *       at the DB layer
 *   7.  reviewPromptState.reset is scoped: daily_logs and other tables survive reset
 *   8.  backupEvents ordering: listEvents returns ascending occurredAt order
 *   9.  importSession upsert: re-saving same id updates fields, no duplicate row
 *  10.  wipeLocalData followed immediately by restoreSnapshot is clean (no FK ghosts)
 *  11.  PRIVACY: after wipeLocalData + saveEntry, old notes from prior wipe cycle cannot
 *       be seen via listByDateRange
 *  12.  PRIVACY: restore of a snapshot that has NO userProfile still wipes any prior
 *       profile row — no stale reproductive data survives a restore
 *  13.  listByDates returns entries in ascending logDate order regardless of insert order
 */

import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import type { BackupSnapshot, UserProfile } from '@/src/types/domain';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');

function createTestHarness() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationDirectory });
  const repositories = createDomainRepositories(db);
  return { sqlite, db, repositories };
}

/** Minimal valid snapshot skeleton — caller can spread/override fields. */
function minimalSnapshot(
  overrides: Partial<BackupSnapshot> = {},
): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    appPreferences: {
      hasCompletedOnboarding: false,
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: false,
      showFertilityEstimates: true,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      themePreference: 'system',
      localePreference: 'system',
    },
    billingSnapshot: { accessState: 'needs_purchase' },
    userProfile: null,
    reminderPreferences: [],
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [],
    dailyLogs: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. saveProfileAndReminderPreferences — atomic combined write
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: saveProfileAndReminderPreferences', () => {
  it('writes profile and reminders atomically — both are visible after the call', async () => {
    const { repositories } = createTestHarness();

    const profile: UserProfile = {
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      cycleLengthDays: 28,
      periodLengthDays: 5,
    };

    await repositories.userProfile.saveProfileAndReminderPreferences(profile, [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 19,
        minute: 30,
        schedule: { cadence: 'daily' },
      },
    ]);

    const loadedProfile = await repositories.userProfile.getProfile();
    expect(loadedProfile?.cycleLengthDays).toBe(28);
    expect(loadedProfile?.conditionTags).toEqual(['pcos']);

    const loadedReminders = await repositories.reminderPreferences.getPreferences();
    const dailyLog = loadedReminders.find((r) => r.kind === 'daily-log');
    expect(dailyLog?.enabled).toBe(true);
    expect(dailyLog?.hour).toBe(19);
    expect(dailyLog?.minute).toBe(30);
  });

  it('overwriting profile via saveProfileAndReminderPreferences replaces goals — no duplicates', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.userProfile.saveProfileAndReminderPreferences(
      {
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      [],
    );

    await repositories.userProfile.saveProfileAndReminderPreferences(
      {
        goals: ['trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: ['endometriosis'],
      },
      [],
    );

    const goalCount = sqlite
      .prepare('SELECT count(*) as n FROM user_profile_goals')
      .get() as { n: number };
    expect(goalCount.n).toBe(1);

    const loaded = await repositories.userProfile.getProfile();
    expect(loaded?.goals).toEqual(['trying-to-conceive']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. clearProfile isolation — only profile tables are cleared
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: clearProfile isolation', () => {
  it('clearProfile removes only profile+goals+conditions, leaving other tables untouched', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Seed multiple tables
    await repositories.appPreferences.savePreferences({
      hasCompletedOnboarding: true,
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: false,
      showFertilityEstimates: true,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      themePreference: 'system',
      localePreference: 'system',
    });

    await repositories.dailyLogs.saveEntry({
      id: 'log-isolation',
      logDate: '2026-01-10',
      bleeding: 'light',
      symptoms: ['cramps'],
    });

    await repositories.userProfile.saveProfile({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
    });

    await repositories.userProfile.clearProfile();

    // Profile tables should be empty
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_goals').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_conditions').get(),
    ).toEqual({ n: 0 });

    // Other tables must be untouched
    expect(
      sqlite.prepare('SELECT count(*) as n FROM app_preferences').get(),
    ).toEqual({ n: 1 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });

    // Querying daily logs still works
    const entry = await repositories.dailyLogs.getEntryByDate('2026-01-10');
    expect(entry?.id).toBe('log-isolation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. restoreSnapshot with duplicate logDate entries
//    The schema validator enforces unique dates so the restore must be REJECTED
//    before any DB write happens, leaving the DB in its pre-call state.
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: restoreSnapshot duplicate logDate', () => {
  it('snapshot with two logs on the same logDate is rejected — the DB stays in its prior state', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Seed a pre-existing log so we can verify the DB was not cleared
    await repositories.dailyLogs.saveEntry({
      id: 'log-pre-dup-test',
      logDate: '2026-02-28',
      bleeding: 'medium',
      symptoms: [],
    });

    const snapshot = minimalSnapshot({
      dailyLogs: [
        {
          id: 'log-dup-a',
          logDate: '2026-03-01',
          bleeding: 'heavy' as const,
          symptoms: ['cramps', 'fatigue'],
        },
        {
          id: 'log-dup-b',
          logDate: '2026-03-01', // same date — schema must reject this
          bleeding: 'light' as const,
          symptoms: [],
        },
      ],
    });

    // The validator catches duplicate dates and throws before touching the DB
    await expect(
      repositories.backupData.restoreSnapshot(snapshot),
    ).rejects.toThrow();

    // backupSnapshotSchema.parse() runs BEFORE clearAllLocalTables, so prior
    // data should still be intact.
    const logCount = sqlite
      .prepare('SELECT count(*) as n FROM daily_logs')
      .get() as { n: number };
    expect(logCount.n).toBe(1);

    const entry = await repositories.dailyLogs.getEntryByDate('2026-02-28');
    expect(entry?.id).toBe('log-pre-dup-test');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. restoreSnapshot atomicity: orphan importSessionId reference rolls back
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: restoreSnapshot atomicity on orphan FK', () => {
  it('snapshot with dailyLog referencing missing importSession throws and leaves DB empty', async () => {
    const { sqlite, repositories } = createTestHarness();

    // First seed some data so we can verify it is not corrupted
    await repositories.dailyLogs.saveEntry({
      id: 'log-before-restore',
      logDate: '2026-02-15',
      bleeding: 'medium',
      symptoms: [],
    });

    const snapshot = minimalSnapshot({
      importSessions: [],
      dailyLogs: [
        {
          id: 'log-orphan-fk',
          logDate: '2026-04-01',
          bleeding: 'light' as const,
          symptoms: [],
          importSessionId: 'session-that-does-not-exist',
        },
      ],
    });

    await expect(
      repositories.backupData.restoreSnapshot(snapshot),
    ).rejects.toThrow();

    // The pre-existing entry AND the snapshot entry must both be gone:
    // restoreSnapshot calls clearAllLocalTables before writing, and the
    // transaction that includes the new data rolled back — so the DB should
    // now be empty of daily_logs (the wipe already happened atomically).
    //
    // IMPORTANT: The current implementation calls clearAllLocalTables inside
    // the same transaction as the restore writes, so a throw inside that
    // transaction should cause a rollback, restoring the previous state.
    //
    // If this test FAILS it means restoreSnapshot wipes the DB first and then
    // throws, leaving the user with NO data. That is a PRIVACY BUG because the
    // user's prior reproductive data has been irreversibly deleted.
    //
    // SUSPECTED BUG (PRIVACY): if clearAllLocalTables runs, then the loop
    // throws mid-way, the transaction may have already committed the clear
    // depending on the SQLite driver's behavior. Mark as expected-fail if found.
    const logCount = sqlite
      .prepare('SELECT count(*) as n FROM daily_logs')
      .get() as { n: number };

    // After a rolled-back restoreSnapshot, the original 'log-before-restore'
    // SHOULD still be present. If it is 0, the wipe committed before the throw.
    expect(logCount.n).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. exportSnapshot exclusions: reviewPromptSaveEvents and backupEvents
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: exportSnapshot exclusions', () => {
  it('exportSnapshot does not include reviewPromptSaveEvents — they are not in BackupSnapshot', async () => {
    const { repositories } = createTestHarness();

    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-01-05T10:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-01-05',
      '2026-01-05T10:30:00.000Z',
    );

    const snapshot = await repositories.backupData.exportSnapshot();

    // BackupSnapshot type does not have a reviewPromptSaveEvents field.
    // Verify the exported object doesn't accidentally carry it via an extra property.
    expect((snapshot as Record<string, unknown>)['reviewPromptSaveEvents']).toBeUndefined();
  });

  it('exportSnapshot does not include backupEvents audit trail — those stay local-only', async () => {
    const { repositories } = createTestHarness();

    await repositories.backupEvents.recordEvent({
      id: 'evt-audit',
      action: 'exported',
      occurredAt: '2026-01-10T08:00:00.000Z',
      detail: 'Exported to Files app',
    });

    const snapshot = await repositories.backupData.exportSnapshot();

    // BackupSnapshot type does not have a backupEvents field.
    expect((snapshot as Record<string, unknown>)['backupEvents']).toBeUndefined();
  });

  it('after wipe + restoreSnapshot, reviewPromptSaveEvents are empty (not ghost-restored)', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-02-01',
      '2026-02-01T12:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-02-02',
      '2026-02-02T12:00:00.000Z',
    );

    // Restore a fresh snapshot
    await repositories.backupData.restoreSnapshot(minimalSnapshot());

    expect(
      sqlite.prepare('SELECT count(*) as n FROM review_prompt_save_events').get(),
    ).toEqual({ n: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. billingSnapshot boolean grandfatherTrialApplied at the DB layer
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: billingSnapshot grandfatherTrialApplied round-trip', () => {
  it('grandfatherTrialApplied=true survives save/load', async () => {
    const { repositories } = createTestHarness();

    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'annual',
      grandfatherTrialApplied: true,
    });

    const loaded = await repositories.billingSnapshot.getSnapshot();
    expect(loaded.grandfatherTrialApplied).toBe(true);
  });

  it('grandfatherTrialApplied=false survives save/load (not coerced to null/undefined)', async () => {
    const { repositories } = createTestHarness();

    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'annual',
      grandfatherTrialApplied: false,
    });

    const loaded = await repositories.billingSnapshot.getSnapshot();
    expect(loaded.grandfatherTrialApplied).toBe(false);
  });

  it('grandfatherTrialApplied undefined comes back as undefined after save/load', async () => {
    const { repositories } = createTestHarness();

    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'needs_purchase',
    });

    const loaded = await repositories.billingSnapshot.getSnapshot();
    expect(loaded.grandfatherTrialApplied).toBeUndefined();
  });

  it('billingSnapshot overwrite replaces all fields including planId → undefined', async () => {
    const { repositories } = createTestHarness();

    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'monthly',
      grandfatherTrialApplied: true,
    });

    // Overwrite with a minimal snapshot that has no planId
    await repositories.billingSnapshot.saveSnapshot({
      accessState: 'needs_purchase',
    });

    const loaded = await repositories.billingSnapshot.getSnapshot();
    expect(loaded.accessState).toBe('needs_purchase');
    expect(loaded.planId).toBeUndefined();
    expect(loaded.grandfatherTrialApplied).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. reviewPromptState.reset is scoped — daily_logs and other tables survive
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: reviewPromptState.reset scope', () => {
  it('reset only clears reviewPromptState and reviewPromptSaveEvents — daily logs intact', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-survived-reset',
      logDate: '2026-04-01',
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-04-01T09:00:00.000Z',
    );
    await repositories.reviewPromptState.recordSuccessfulSave(
      '2026-04-01',
      '2026-04-01T09:30:00.000Z',
    );

    await repositories.reviewPromptState.reset();

    // Review tables must be empty
    expect(
      sqlite.prepare('SELECT count(*) as n FROM review_prompt_state').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM review_prompt_save_events').get(),
    ).toEqual({ n: 0 });

    // Daily logs must survive
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });
    const entry = await repositories.dailyLogs.getEntryByDate('2026-04-01');
    expect(entry?.id).toBe('log-survived-reset');
  });

  it('after reset, getState returns the default state (not stale data)', async () => {
    const { repositories } = createTestHarness();

    await repositories.reviewPromptState.seedOnboardingCompletion(
      '2026-01-01T00:00:00.000Z',
    );
    await repositories.reviewPromptState.recordAutomaticPrompt(
      '2026-02-01T00:00:00.000Z',
    );

    await repositories.reviewPromptState.reset();

    const state = await repositories.reviewPromptState.getState();
    expect(state.onboardingCompletedAt).toBeUndefined();
    expect(state.automaticPromptCount).toBe(0);
    expect(state.suppressAutomaticPrompts).toBe(false);
    expect(state.lastAutomaticPromptAt).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. backupEvents ordering
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: backupEvents ordering', () => {
  it('listEvents returns events in ascending occurredAt order regardless of insert order', async () => {
    const { repositories } = createTestHarness();

    await repositories.backupEvents.recordEvent({
      id: 'evt-c',
      action: 'exported',
      occurredAt: '2026-05-03T10:00:00.000Z',
      detail: 'Third',
    });
    await repositories.backupEvents.recordEvent({
      id: 'evt-a',
      action: 'exported',
      occurredAt: '2026-05-01T10:00:00.000Z',
      detail: 'First',
    });
    await repositories.backupEvents.recordEvent({
      id: 'evt-b',
      action: 'restored',
      occurredAt: '2026-05-02T10:00:00.000Z',
      detail: 'Second',
    });

    const events = await repositories.backupEvents.listEvents();
    expect(events.map((e) => e.id)).toEqual(['evt-a', 'evt-b', 'evt-c']);
  });

  it('recording the same event id again upserts (no duplicate rows)', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.backupEvents.recordEvent({
      id: 'evt-upsert',
      action: 'exported',
      occurredAt: '2026-05-05T10:00:00.000Z',
      detail: 'Original',
    });

    await repositories.backupEvents.recordEvent({
      id: 'evt-upsert',
      action: 'restored',
      occurredAt: '2026-05-05T11:00:00.000Z',
      detail: 'Updated',
    });

    expect(
      sqlite.prepare('SELECT count(*) as n FROM backup_events').get(),
    ).toEqual({ n: 1 });

    const events = await repositories.backupEvents.listEvents();
    expect(events[0]?.detail).toBe('Updated');
    expect(events[0]?.action).toBe('restored');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. importSession upsert: re-saving same id updates fields
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: importSession upsert', () => {
  it('re-saving same import session id updates status and counts, no duplicate row', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.importSessions.saveSession({
      id: 'sess-upsert',
      source: 'clue',
      status: 'pending',
      startedAt: '2026-03-10T08:00:00.000Z',
      importedLogCount: 0,
      skippedLogCount: 0,
    });

    await repositories.importSessions.saveSession({
      id: 'sess-upsert',
      source: 'clue',
      status: 'committed',
      startedAt: '2026-03-10T08:00:00.000Z',
      completedAt: '2026-03-10T08:01:00.000Z',
      importedLogCount: 42,
      skippedLogCount: 3,
    });

    expect(
      sqlite.prepare('SELECT count(*) as n FROM import_sessions').get(),
    ).toEqual({ n: 1 });

    const session = await repositories.importSessions.getSession('sess-upsert');
    expect(session?.status).toBe('committed');
    expect(session?.importedLogCount).toBe(42);
    expect(session?.skippedLogCount).toBe(3);
    expect(session?.completedAt).toBe('2026-03-10T08:01:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. wipeLocalData followed by restoreSnapshot is clean
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: wipe then restore', () => {
  it('wipe + restore with a full snapshot produces exactly the snapshot data — no ghost rows', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Pre-populate with data that should be fully replaced
    await repositories.importSessions.saveSession({
      id: 'old-sess',
      source: 'flo',
      status: 'committed',
      startedAt: '2025-12-01T00:00:00.000Z',
      importedLogCount: 10,
      skippedLogCount: 2,
    });
    await repositories.dailyLogs.saveEntry({
      id: 'old-log',
      logDate: '2025-12-01',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      importSessionId: 'old-sess',
    });
    await repositories.userProfile.saveProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos', 'pmdd'],
    });

    await repositories.localDataMaintenance.wipeLocalData();

    const snapshot = minimalSnapshot({
      userProfile: {
        goals: ['trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      dailyLogs: [
        {
          id: 'new-log-1',
          logDate: '2026-05-01',
          bleeding: 'light' as const,
          symptoms: [],
        },
        {
          id: 'new-log-2',
          logDate: '2026-05-02',
          bleeding: 'none' as const,
          symptoms: ['fatigue'],
        },
      ],
    });

    await repositories.backupData.restoreSnapshot(snapshot);

    // Exactly the snapshot's daily logs, no old data
    const allLogs = await repositories.dailyLogs.listAll();
    expect(allLogs.map((e) => e.id)).toEqual(['new-log-1', 'new-log-2']);

    // Old import session must be gone
    expect(
      sqlite.prepare('SELECT count(*) as n FROM import_sessions').get(),
    ).toEqual({ n: 0 });

    // Profile from snapshot
    const profile = await repositories.userProfile.getProfile();
    expect(profile?.goals).toEqual(['trying-to-conceive']);
    expect(profile?.conditionTags).toEqual([]);

    // Symptom child rows: only new-log-2's 'fatigue'
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. PRIVACY: after wipe, prior notes cannot bleed into new entries
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: privacy — no bleed after wipe', () => {
  it('notes written before wipe are completely absent after wipe + new entry on same date', async () => {
    const { repositories } = createTestHarness();

    const sensitiveNotes = 'Very personal health information - MUST NOT survive wipe';

    await repositories.dailyLogs.saveEntry({
      id: 'log-sensitive',
      logDate: '2026-06-01',
      bleeding: 'heavy',
      symptoms: ['cramps'],
      notes: sensitiveNotes,
    });

    await repositories.localDataMaintenance.wipeLocalData();

    // Write a new clean entry on the same date
    await repositories.dailyLogs.saveEntry({
      id: 'log-clean',
      logDate: '2026-06-01',
      bleeding: 'none',
      symptoms: [],
    });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-01');
    expect(entry?.notes).toBeUndefined();
    expect(entry?.id).toBe('log-clean');

    // Verify via range query too
    const range = await repositories.dailyLogs.listByDateRange('2026-05-01', '2026-07-01');
    expect(range).toHaveLength(1);
    expect(range[0]?.notes).toBeUndefined();
  });

  it('TTC observation written before wipe cannot be retrieved after wipe', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-ttc-sensitive',
      logDate: '2026-06-10',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        cervicalMucus: 'egg-white',
        ovulationTest: 'peak',
        basalBodyTemperatureCelsius: 36.8,
        sexLogged: true,
      },
    });

    await repositories.localDataMaintenance.wipeLocalData();

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-10');
    expect(entry).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. PRIVACY: restoreSnapshot with null userProfile wipes prior profile
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: privacy — restore with null userProfile', () => {
  it('restoring a snapshot with userProfile=null wipes the prior profile — no stale reproductive data', async () => {
    const { repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['endometriosis'],
      cycleLengthDays: 30,
      periodLengthDays: 6,
      birthControlMethod: 'pill',
    });

    // Restore a snapshot that explicitly has no user profile
    await repositories.backupData.restoreSnapshot(minimalSnapshot({ userProfile: null }));

    const profile = await repositories.userProfile.getProfile();
    expect(profile).toBeNull();
  });

  it('after restore with null userProfile, conditionTags from prior profile are gone', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.userProfile.saveProfile({
      goals: ['trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos', 'pmdd', 'endometriosis'],
    });

    await repositories.backupData.restoreSnapshot(minimalSnapshot({ userProfile: null }));

    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_conditions').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM user_profile_goals').get(),
    ).toEqual({ n: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. listByDates ordering
// ─────────────────────────────────────────────────────────────────────────────

describe('persistenceWipe probe: listByDates ordering', () => {
  it('listByDates returns entries in ascending logDate order regardless of insert order', async () => {
    const { repositories } = createTestHarness();

    // Insert in reverse order
    await repositories.dailyLogs.saveEntry({
      id: 'log-z',
      logDate: '2026-07-10',
      bleeding: 'none',
      symptoms: [],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-a',
      logDate: '2026-07-01',
      bleeding: 'light',
      symptoms: [],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-m',
      logDate: '2026-07-05',
      bleeding: 'medium',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDates([
      '2026-07-10',
      '2026-07-01',
      '2026-07-05',
    ]);

    expect(result.map((e) => e.logDate)).toEqual([
      '2026-07-01',
      '2026-07-05',
      '2026-07-10',
    ]);
  });

  it('listByDates with a mix of present and absent dates returns only the present ones, in order', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-present-a',
      logDate: '2026-08-03',
      bleeding: 'heavy',
      symptoms: [],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-present-b',
      logDate: '2026-08-01',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDates([
      '2026-08-01',
      '2026-08-02', // absent
      '2026-08-03',
      '2026-08-04', // absent
    ]);

    expect(result.map((e) => e.logDate)).toEqual(['2026-08-01', '2026-08-03']);
    expect(result).toHaveLength(2);
  });
});
