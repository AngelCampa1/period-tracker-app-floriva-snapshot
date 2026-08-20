/**
 * Adversarial data-integrity tests for src/db/repositories.ts.
 *
 * Targets the repository layer only — schema.ts and validators.ts are out of scope.
 * All fixes for failing tests live in src/db/repositories.ts.
 *
 * Harness pattern follows dailyLogRepository.test.ts and domainDataLayer.test.ts.
 */

import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import type { DailyLogEntry } from '@/src/types/domain';

const migrationDirectory = path.resolve(__dirname, '../../drizzle');

function createTestHarness() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationDirectory });
  const repositories = createDomainRepositories(db);
  return { sqlite, db, repositories };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPSERT / DEDUP
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — upsert / dedup', () => {
  it('create-then-update with same id replaces cleanly: no duplicate rows', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-05-01',
      logDate: '2026-05-01',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      notes: 'First save',
      ttcObservation: { ovulationTest: 'negative' },
    });

    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-05-01',
      logDate: '2026-05-01',
      bleeding: 'light',
      symptoms: ['bloating'],
      notes: 'Second save overwrites',
    });

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 1 });
    // ttcObservation removed on update — cascade should have deleted it
    expect(
      sqlite.prepare('SELECT count(*) as n FROM ttc_observations').get(),
    ).toEqual({ n: 0 });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-05-01');
    expect(entry).toEqual({
      id: 'log-2026-05-01',
      logDate: '2026-05-01',
      bleeding: 'light',
      symptoms: ['bloating'],
      notes: 'Second save overwrites',
    });
  });

  it('saving a new id for an existing date replaces the old entry entirely', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-a',
      logDate: '2026-05-02',
      bleeding: 'medium',
      symptoms: ['cramps'],
      birthControlEvent: { method: 'pill', lateDose: true },
    });

    await repositories.dailyLogs.saveEntry({
      id: 'log-b',
      logDate: '2026-05-02',
      bleeding: 'light',
      symptoms: [],
    });

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });
    // birthControlEvent from old entry must be gone
    expect(
      sqlite.prepare('SELECT count(*) as n FROM birth_control_events').get(),
    ).toEqual({ n: 0 });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-05-02');
    expect(entry?.id).toBe('log-b');
    expect(entry?.bleeding).toBe('light');
    expect(entry?.birthControlEvent).toBeUndefined();
  });

  it('partial update preserves unrelated fields from the new entry and removes old children', async () => {
    const { sqlite, repositories } = createTestHarness();

    // V1: rich entry with all optional fields populated
    const v1: DailyLogEntry = {
      id: 'log-2026-05-03',
      logDate: '2026-05-03',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue', 'bloating'],
      mood: 'sensitive',
      notes: 'Very heavy day',
      ttcObservation: {
        cervicalMucus: 'creamy',
        ovulationTest: 'positive',
        basalBodyTemperatureCelsius: 36.6,
        sexLogged: true,
      },
      birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
    };

    await repositories.dailyLogs.saveEntry(v1);

    // V2: same id, same date — removes ttcObservation, keeps birthControlEvent, changes symptoms
    const v2: DailyLogEntry = {
      id: 'log-2026-05-03',
      logDate: '2026-05-03',
      bleeding: 'light',
      symptoms: ['fatigue'],
      mood: 'low',
      notes: 'Better day',
      birthControlEvent: { method: 'pill', missedDose: false, lateDose: false },
    };

    await repositories.dailyLogs.saveEntry(v2);

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 1 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM ttc_observations').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM birth_control_events').get(),
    ).toEqual({ n: 1 });

    const entry = await repositories.dailyLogs.getEntryByDate('2026-05-03');
    expect(entry).toEqual(v2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROUND-TRIP FIDELITY
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — round-trip fidelity', () => {
  it('round-trips a fully-populated entry with unicode / emoji / newlines exactly', async () => {
    const { repositories } = createTestHarness();

    const richEntry: DailyLogEntry = {
      id: 'log-rich-2026-05-04',
      logDate: '2026-05-04',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue', 'bloating'],
      mood: 'sensitive',
      notes: 'Feeling 🌸 today.\nCramps at 09:00.\nDrank 2L 💧 — unicode: こんにちは',
      ttcObservation: {
        cervicalMucus: 'egg-white',
        ovulationTest: 'positive',
        basalBodyTemperatureCelsius: 36.55,
        sexLogged: true,
      },
      birthControlEvent: {
        method: 'pill',
        missedDose: false,
        lateDose: true,
      },
    };

    await repositories.dailyLogs.saveEntry(richEntry);
    const readBack = await repositories.dailyLogs.getEntryByDate('2026-05-04');

    expect(readBack).toEqual(richEntry);
  });

  it('round-trips empty symptoms array without converting to null', async () => {
    const { repositories } = createTestHarness();

    const entry: DailyLogEntry = {
      id: 'log-empty-syms',
      logDate: '2026-05-05',
      bleeding: 'none',
      symptoms: [],
    };

    await repositories.dailyLogs.saveEntry(entry);
    const readBack = await repositories.dailyLogs.getEntryByDate('2026-05-05');

    expect(readBack).not.toBeNull();
    expect(Array.isArray(readBack!.symptoms)).toBe(true);
    expect(readBack!.symptoms).toHaveLength(0);
  });

  it('preserves boolean false values (not coerced to null/undefined)', async () => {
    const { repositories } = createTestHarness();

    const entry: DailyLogEntry = {
      id: 'log-bools',
      logDate: '2026-05-06',
      bleeding: 'light',
      symptoms: [],
      ttcObservation: {
        sexLogged: false,
        ovulationTest: 'negative',
      },
      birthControlEvent: {
        method: 'pill',
        missedDose: false,
        lateDose: false,
      },
    };

    await repositories.dailyLogs.saveEntry(entry);
    const readBack = await repositories.dailyLogs.getEntryByDate('2026-05-06');

    expect(readBack!.ttcObservation!.sexLogged).toBe(false);
    expect(readBack!.birthControlEvent!.missedDose).toBe(false);
    expect(readBack!.birthControlEvent!.lateDose).toBe(false);
  });

  it('preserves numeric precision for basal body temperature', async () => {
    const { repositories } = createTestHarness();

    const entry: DailyLogEntry = {
      id: 'log-bbt',
      logDate: '2026-05-07',
      bleeding: 'none',
      symptoms: [],
      ttcObservation: {
        basalBodyTemperatureCelsius: 36.45,
      },
    };

    await repositories.dailyLogs.saveEntry(entry);
    const readBack = await repositories.dailyLogs.getEntryByDate('2026-05-07');

    // SQLite REAL is IEEE-754 double — 36.45 must survive exactly
    expect(readBack!.ttcObservation!.basalBodyTemperatureCelsius).toBe(36.45);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE / CLEAR
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — delete / clear', () => {
  it('deleting one date does not affect its neighbours', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-05-10',
      logDate: '2026-05-10',
      bleeding: 'light',
      symptoms: ['fatigue'],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-05-11',
      logDate: '2026-05-11',
      bleeding: 'medium',
      symptoms: ['cramps'],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-2026-05-12',
      logDate: '2026-05-12',
      bleeding: 'heavy',
      symptoms: ['bloating'],
    });

    await repositories.dailyLogs.deleteEntry('log-2026-05-11');

    const all = await repositories.dailyLogs.listByDateRange('2026-05-10', '2026-05-12');
    expect(all.map((e) => e.logDate)).toEqual(['2026-05-10', '2026-05-12']);
  });

  it('deleting an entry with all child types cascades cleanly — no orphan rows', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-to-delete',
      logDate: '2026-05-13',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      ttcObservation: { ovulationTest: 'positive', sexLogged: true },
      birthControlEvent: { method: 'pill', lateDose: false },
    });

    await repositories.dailyLogs.deleteEntry('log-to-delete');

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM ttc_observations').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM birth_control_events').get(),
    ).toEqual({ n: 0 });
  });

  it('deleting a non-existent row is a no-op and does not throw', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-survivor',
      logDate: '2026-05-14',
      bleeding: 'light',
      symptoms: [],
    });

    await expect(
      repositories.dailyLogs.deleteEntry('does-not-exist'),
    ).resolves.not.toThrow();

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 1 });
  });

  it('wipeLocalData leaves zero rows in every table including child tables', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-wipe-1',
      logDate: '2026-05-15',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue'],
      ttcObservation: { cervicalMucus: 'creamy', sexLogged: true },
      birthControlEvent: { method: 'pill' },
    });

    await repositories.localDataMaintenance.wipeLocalData();

    const tables = [
      'daily_logs',
      'daily_log_symptoms',
      'ttc_observations',
      'birth_control_events',
      'user_profile',
      'user_profile_goals',
      'user_profile_conditions',
      'reminder_preferences',
      'privacy_preferences',
      'review_prompt_state',
      'review_prompt_save_events',
      'billing_snapshot',
      'app_preferences',
      'import_sessions',
      'backup_events',
    ];

    for (const table of tables) {
      expect(
        sqlite.prepare(`SELECT count(*) as n FROM ${table}`).get(),
      ).toEqual({ n: 0 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. QUERY RANGES
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — query ranges', () => {
  it('listByDateRange with start > end (inverted) returns empty array, not an error', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-range-1',
      logDate: '2026-05-20',
      bleeding: 'light',
      symptoms: [],
    });

    await expect(
      repositories.dailyLogs.listByDateRange('2026-05-25', '2026-05-20'),
    ).resolves.toEqual([]);
  });

  it('listByDateRange with start === end returns exactly that one entry', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-single',
      logDate: '2026-05-21',
      bleeding: 'medium',
      symptoms: ['cramps'],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-neighbour',
      logDate: '2026-05-22',
      bleeding: 'light',
      symptoms: [],
    });

    const result = await repositories.dailyLogs.listByDateRange('2026-05-21', '2026-05-21');
    expect(result).toHaveLength(1);
    expect(result[0]?.logDate).toBe('2026-05-21');
  });

  it('listByDateRange bounds are inclusive on both sides', async () => {
    const { repositories } = createTestHarness();

    for (const [id, logDate] of [
      ['log-05-19', '2026-05-19'],
      ['log-05-20', '2026-05-20'],
      ['log-05-21', '2026-05-21'],
      ['log-05-22', '2026-05-22'],
      ['log-05-23', '2026-05-23'],
    ] as const) {
      await repositories.dailyLogs.saveEntry({
        id,
        logDate,
        bleeding: 'light',
        symptoms: [],
      });
    }

    const result = await repositories.dailyLogs.listByDateRange('2026-05-20', '2026-05-22');
    expect(result.map((e) => e.logDate)).toEqual([
      '2026-05-20',
      '2026-05-21',
      '2026-05-22',
    ]);
  });

  it('listByDateRange returns results in ascending logDate order', async () => {
    const { repositories } = createTestHarness();

    // Insert out of order
    for (const [id, logDate] of [
      ['log-05-25', '2026-05-25'],
      ['log-05-23', '2026-05-23'],
      ['log-05-24', '2026-05-24'],
    ] as const) {
      await repositories.dailyLogs.saveEntry({
        id,
        logDate,
        bleeding: 'none',
        symptoms: [],
      });
    }

    const result = await repositories.dailyLogs.listByDateRange('2026-05-23', '2026-05-25');
    expect(result.map((e) => e.logDate)).toEqual([
      '2026-05-23',
      '2026-05-24',
      '2026-05-25',
    ]);
  });

  it('listByDateRange on far-past / far-future boundary dates returns correct subset', async () => {
    const { repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-historical',
      logDate: '1990-01-15',
      bleeding: 'light',
      symptoms: [],
    });
    await repositories.dailyLogs.saveEntry({
      id: 'log-future',
      logDate: '2099-12-31',
      bleeding: 'medium',
      symptoms: [],
    });

    const past = await repositories.dailyLogs.listByDateRange('1990-01-01', '1990-12-31');
    expect(past.map((e) => e.id)).toEqual(['log-historical']);

    const future = await repositories.dailyLogs.listByDateRange('2099-01-01', '2099-12-31');
    expect(future.map((e) => e.id)).toEqual(['log-future']);

    const empty = await repositories.dailyLogs.listByDateRange('2050-01-01', '2050-12-31');
    expect(empty).toEqual([]);
  });

  it('listAll returns every entry in ascending logDate order', async () => {
    const { repositories } = createTestHarness();

    for (const [id, logDate] of [
      ['log-c', '2026-06-03'],
      ['log-a', '2026-06-01'],
      ['log-b', '2026-06-02'],
    ] as const) {
      await repositories.dailyLogs.saveEntry({ id, logDate, bleeding: 'none', symptoms: [] });
    }

    const all = await repositories.dailyLogs.listAll();
    expect(all.map((e) => e.id)).toEqual(['log-a', 'log-b', 'log-c']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MALFORMED INPUT
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — malformed input', () => {
  it('rejects an entry with an invalid date string (month=13)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-bad-date',
        logDate: '2026-13-01',
        bleeding: 'light',
        symptoms: [],
      }),
    ).rejects.toThrow();

    // No row should have been persisted
    const entry = await repositories.dailyLogs.getEntryByDate('2026-13-01');
    expect(entry).toBeNull();
  });

  it('rejects an entry with an invalid date string (day=99)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-bad-day',
        logDate: '2026-01-99',
        bleeding: 'light',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects an entry with a completely non-date string', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-garbage-date',
        logDate: 'not-a-date',
        bleeding: 'light',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  // Valid calendar boundary dates that assertLogDateIsCalendarValid must NOT reject
  it.each([
    ['2024-02-29', 'leap day on an actual leap year'],
    ['2026-01-31', 'January has 31 days'],
    ['2026-03-31', 'March has 31 days'],
    ['2026-04-30', 'April has 30 days'],
    ['2026-12-31', 'December 31'],
    ['2026-02-28', 'February 28 on a non-leap year'],
  ])('accepts the valid calendar date %s (%s)', async (logDate, _label) => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: `log-valid-${logDate}`,
        logDate,
        bleeding: 'light',
        symptoms: [],
      }),
    ).resolves.not.toThrow();

    const entry = await repositories.dailyLogs.getEntryByDate(logDate);
    expect(entry?.logDate).toBe(logDate);
  });

  it('rejects 2026-02-30 (February overflow — must not silently roll to March 2)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-feb-overflow',
        logDate: '2026-02-30',
        bleeding: 'light',
        symptoms: [],
      }),
    ).rejects.toThrow(/invalid logDate/i);

    // Must not have silently landed on March 2
    const entry = await repositories.dailyLogs.getEntryByDate('2026-03-02');
    expect(entry).toBeNull();
  });

  it('rejects 2025-02-29 (Feb 29 on a non-leap year)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-non-leap-feb29',
        logDate: '2025-02-29',
        bleeding: 'none',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects 2026-04-31 (April has only 30 days)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-apr-overflow',
        logDate: '2026-04-31',
        bleeding: 'none',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  it('restoreSnapshot rejects the entire batch when any single log has an invalid date — no partial write', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Build a minimal valid snapshot with one bad log in the middle
    const snapshot = {
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      appPreferences: {
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
      },
      billingSnapshot: { accessState: 'needs_purchase' as const },
      userProfile: null,
      reminderPreferences: [],
      privacyPreference: {
        biometricsEnabled: false,
        relockAfterSeconds: 0,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      },
      importSessions: [],
      dailyLogs: [
        { id: 'log-good-1', logDate: '2026-05-01', bleeding: 'light' as const, symptoms: [] },
        { id: 'log-bad',    logDate: '2026-13-01', bleeding: 'light' as const, symptoms: [] },
        { id: 'log-good-2', logDate: '2026-05-03', bleeding: 'none'  as const, symptoms: [] },
      ],
    };

    await expect(
      repositories.backupData.restoreSnapshot(snapshot),
    ).rejects.toThrow();

    // No daily_logs row from the snapshot must survive
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 0 });
  });

  it('rejects an entry with a negative basalBodyTemperatureCelsius', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-neg-temp',
        logDate: '2026-06-10',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          basalBodyTemperatureCelsius: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects an entry with an out-of-range basalBodyTemperatureCelsius (> 45)', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-high-temp',
        logDate: '2026-06-11',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          basalBodyTemperatureCelsius: 100,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects notes that exceed 500 characters', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-long-notes',
        logDate: '2026-06-12',
        bleeding: 'light',
        symptoms: [],
        notes: 'x'.repeat(501),
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate symptoms in a single entry', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-dup-sym',
        logDate: '2026-06-13',
        bleeding: 'light',
        symptoms: ['cramps', 'cramps'],
      }),
    ).rejects.toThrow();

    const entry = await repositories.dailyLogs.getEntryByDate('2026-06-13');
    expect(entry).toBeNull();
  });

  it('rejects an unknown bleeding value', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-bad-bleeding',
        logDate: '2026-06-14',
        bleeding: 'torrential' as 'heavy',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects an entry with empty string id', async () => {
    const { repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: '',
        logDate: '2026-06-15',
        bleeding: 'light',
        symptoms: [],
      }),
    ).rejects.toThrow();
  });

  it('recovers to an empty dismissedAnomalyIds list when the stored JSON is corrupted', async () => {
    const { sqlite, repositories } = createTestHarness();

    // Save once through the normal path so the singleton row exists, then
    // corrupt the column directly to simulate on-disk data that predates or
    // otherwise doesn't match the JSON-array contract.
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
    });

    sqlite
      .prepare("UPDATE app_preferences SET dismissed_anomaly_ids = 'not-json' WHERE id = 'app-preferences'")
      .run();

    const preferences = await repositories.appPreferences.getPreferences();

    expect(preferences.dismissedAnomalyIds).toEqual([]);
  });

  it('drops non-string entries when the stored JSON array contains mixed types', async () => {
    const { sqlite, repositories } = createTestHarness();

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
    });

    sqlite
      .prepare(
        `UPDATE app_preferences SET dismissed_anomaly_ids = '["valid-id",42,null]' WHERE id = 'app-preferences'`,
      )
      .run();

    const preferences = await repositories.appPreferences.getPreferences();

    expect(preferences.dismissedAnomalyIds).toEqual(['valid-id']);
  });

  it('recovers to an empty dismissedAnomalyIds list when the stored JSON is valid but not an array', async () => {
    const { sqlite, repositories } = createTestHarness();

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
    });

    sqlite
      .prepare("UPDATE app_preferences SET dismissed_anomaly_ids = '{}' WHERE id = 'app-preferences'")
      .run();

    const preferences = await repositories.appPreferences.getPreferences();

    expect(preferences.dismissedAnomalyIds).toEqual([]);
  });

  it('clamps an oversized stored dismissedAnomalyIds array to the newest 50 on read', async () => {
    const { sqlite, repositories } = createTestHarness();

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
    });

    // Bypass appendDismissedAnomalyId entirely: write 60 ids straight into
    // the column to prove the cap is structural (enforced on read), not just
    // a property of the append helper.
    const oversized = Array.from({ length: 60 }, (_, i) => `short-cycle:2026-01-${String(i + 1).padStart(2, '0')}`);
    sqlite
      .prepare(
        `UPDATE app_preferences SET dismissed_anomaly_ids = '${JSON.stringify(oversized)}' WHERE id = 'app-preferences'`,
      )
      .run();

    const preferences = await repositories.appPreferences.getPreferences();

    expect(preferences.dismissedAnomalyIds).toHaveLength(50);
    // Oldest entries sit at the front, so the first 10 are dropped.
    expect(preferences.dismissedAnomalyIds).toEqual(oversized.slice(10));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRANSACTIONS — atomicity on failure
// ─────────────────────────────────────────────────────────────────────────────

describe('repositories adversarial — transaction atomicity', () => {
  it('saveEntry rolls back: failed write leaves the previous valid entry intact', async () => {
    const { repositories } = createTestHarness();

    const initial: DailyLogEntry = {
      id: 'log-atomic',
      logDate: '2026-06-20',
      bleeding: 'heavy',
      symptoms: ['cramps', 'fatigue'],
      mood: 'sensitive',
      notes: 'Day one',
      ttcObservation: {
        ovulationTest: 'negative',
        sexLogged: false,
      },
      birthControlEvent: { method: 'pill', lateDose: false },
    };

    await repositories.dailyLogs.saveEntry(initial);

    // duplicate symptoms forces zod to throw before any DB write
    const badUpdate: DailyLogEntry = {
      ...initial,
      symptoms: ['cramps', 'cramps'],
      notes: 'This should never land',
    };

    await expect(repositories.dailyLogs.saveEntry(badUpdate)).rejects.toThrow();

    const readBack = await repositories.dailyLogs.getEntryByDate('2026-06-20');
    expect(readBack).toEqual(initial);
  });

  it('saveEntryIfDateAbsent is atomic: concurrent-ish same-date insert only persists the first', async () => {
    const { repositories } = createTestHarness();

    const first = repositories.dailyLogs.saveEntryIfDateAbsent({
      id: 'log-race-a',
      logDate: '2026-06-21',
      bleeding: 'light',
      symptoms: [],
    });

    const second = repositories.dailyLogs.saveEntryIfDateAbsent({
      id: 'log-race-b',
      logDate: '2026-06-21',
      bleeding: 'heavy',
      symptoms: ['cramps'],
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    // Exactly one should have succeeded
    const successes = [firstResult, secondResult].filter(Boolean);
    expect(successes).toHaveLength(1);

    const entries = await repositories.dailyLogs.listByDateRange('2026-06-21', '2026-06-21');
    expect(entries).toHaveLength(1);
  });

  it('wipeLocalData is atomic: all tables are empty or the wipe did not happen', async () => {
    const { sqlite, repositories } = createTestHarness();

    await repositories.dailyLogs.saveEntry({
      id: 'log-pre-wipe',
      logDate: '2026-06-22',
      bleeding: 'medium',
      symptoms: ['fatigue'],
      ttcObservation: { sexLogged: true },
      birthControlEvent: { method: 'pill' },
    });

    await repositories.localDataMaintenance.wipeLocalData();

    // All tables that were seeded must be empty
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM ttc_observations').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM birth_control_events').get(),
    ).toEqual({ n: 0 });
  });

  it('saveEntry with invalid date does not partially write any child rows', async () => {
    const { sqlite, repositories } = createTestHarness();

    await expect(
      repositories.dailyLogs.saveEntry({
        id: 'log-partial-fail',
        logDate: '2026-13-01',
        bleeding: 'light',
        symptoms: ['cramps', 'fatigue'],
        ttcObservation: { ovulationTest: 'positive' },
      }),
    ).rejects.toThrow();

    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_logs').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM daily_log_symptoms').get(),
    ).toEqual({ n: 0 });
    expect(
      sqlite.prepare('SELECT count(*) as n FROM ttc_observations').get(),
    ).toEqual({ n: 0 });
  });
});
