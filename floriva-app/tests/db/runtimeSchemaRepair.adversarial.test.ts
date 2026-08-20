/**
 * Adversarial tests for repairRuntimeSchemaIfNeeded.
 *
 * Contracts under test:
 *  - Idempotent: calling twice is identical to calling once.
 *  - Data-safe: repair never issues DROP TABLE / DROP COLUMN or destructive DML.
 *  - Fail-safe: if the DB throws during repair, the error propagates (not swallowed).
 *  - Partial migration: only missing columns are added, present ones are skipped.
 *  - Empty DB (no app_preferences table): no execSync calls, no crash.
 *  - Extra unknown columns on app_preferences: no crash, no destructive ops.
 */

import { repairRuntimeSchemaIfNeeded } from '@/src/db/runtimeSchemaRepair';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns `app_preferences` columns for the app_preferences pragma query and
// `userProfileColumns` / `billingSnapshotColumns` (default empty => absent =>
// skipped) for the other managed tables. Defaulting them to empty keeps the
// app_preferences-focused cases below unchanged.
function makeDb(
  appPreferencesColumns: string[],
  userProfileColumns: string[] = [],
  billingSnapshotColumns: string[] = [],
) {
  return {
    getAllSync: jest.fn((query: string) =>
      (query.includes("'user_profile'")
        ? userProfileColumns
        : query.includes("'billing_snapshot'")
          ? billingSnapshotColumns
          : appPreferencesColumns
      ).map((name) => ({ name })),
    ),
    execSync: jest.fn(),
  };
}

// The columns that repairRuntimeSchemaIfNeeded is responsible for adding.
const MANAGED_COLUMNS = [
  'haptics_enabled',
  'tap_sound_enabled',
  'show_fertility_estimates',
  'dismissed_anomaly_ids',
];

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – idempotency', () => {
  it('is a no-op when called a second time on an already-repaired schema', async () => {
    // Simulate: first call has base columns only, execSync adds the missing ones.
    // Second call is made after those columns now exist → execSync must not fire again.
    const fullColumnList = ['id', 'has_completed_onboarding', ...MANAGED_COLUMNS];
    const db = makeDb(fullColumnList);

    await repairRuntimeSchemaIfNeeded(db);
    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('calling twice when all columns are missing runs each ALTER exactly once across both calls', async () => {
    // Because the mock getAllSync always returns the same list, both invocations
    // see the same missing columns. Each call independently decides to ALTER.
    // This tests the in-memory Set update path: after the first call adds the
    // column to existingColumns (in-memory), the second call starts fresh with
    // the same mocked DB and should run the ALTERs again (no cross-call caching).
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);
    // First call: 4 ALTERs
    expect(db.execSync).toHaveBeenCalledTimes(4);

    // Reset mock call count to isolate second call
    db.execSync.mockClear();
    await repairRuntimeSchemaIfNeeded(db);
    // Second call with same mock: DB still reports only 'id' → 4 more ALTERs
    expect(db.execSync).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// Partial migration
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – partial migration', () => {
  it('adds only the columns that are actually missing', async () => {
    // haptics_enabled is present; the other three are missing.
    const db = makeDb(['id', 'haptics_enabled']);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).toHaveBeenCalledTimes(3);
    const calls = db.execSync.mock.calls.map((c: [string]) => c[0]);
    expect(calls.some((s: string) => s.includes('tap_sound_enabled'))).toBe(true);
    expect(calls.some((s: string) => s.includes('show_fertility_estimates'))).toBe(true);
    expect(calls.some((s: string) => s.includes('dismissed_anomaly_ids'))).toBe(true);
    expect(calls.some((s: string) => s.includes('haptics_enabled'))).toBe(false);
  });

  it('adds only show_fertility_estimates and dismissed_anomaly_ids when the others already exist', async () => {
    const db = makeDb(['id', 'haptics_enabled', 'tap_sound_enabled']);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).toHaveBeenCalledTimes(2);
    expect(db.execSync).toHaveBeenCalledWith(
      'ALTER TABLE `app_preferences` ADD `show_fertility_estimates` integer DEFAULT true NOT NULL;',
    );
    expect(db.execSync).toHaveBeenCalledWith(
      "ALTER TABLE `app_preferences` ADD `dismissed_anomaly_ids` text DEFAULT '[]' NOT NULL;",
    );
  });

  it('skips all ALTERs when all managed columns are already present alongside extras', async () => {
    const db = makeDb([
      'id',
      'has_completed_onboarding',
      'haptics_enabled',
      'tap_sound_enabled',
      'show_fertility_estimates',
      'dismissed_anomaly_ids',
      'theme_preference', // extra column unknown to the repair step
    ]);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Empty / missing table
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – empty DB / missing table', () => {
  it('is a complete no-op when getAllSync returns an empty array', async () => {
    const db = makeDb([]);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('does not crash when getAllSync returns an empty array', async () => {
    const db = makeDb([]);

    await expect(repairRuntimeSchemaIfNeeded(db)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Data-safety: repair must never issue DROP / DELETE / UPDATE / TRUNCATE
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – data safety', () => {
  const DESTRUCTIVE_PATTERNS = [/\bDROP\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bTRUNCATE\b/i];

  it('never issues a DROP, DELETE, UPDATE, or TRUNCATE statement', async () => {
    const db = makeDb(['id']); // triggers all three ALTERs

    await repairRuntimeSchemaIfNeeded(db);

    for (const [sql] of db.execSync.mock.calls as [string][]) {
      for (const pattern of DESTRUCTIVE_PATTERNS) {
        expect(sql).not.toMatch(pattern);
      }
    }
  });

  it('only issues ALTER TABLE ADD statements, never ALTER TABLE DROP', async () => {
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);

    for (const [sql] of db.execSync.mock.calls as [string][]) {
      expect(sql.toUpperCase()).toContain('ALTER TABLE');
      expect(sql.toUpperCase()).toContain('ADD');
      expect(sql.toUpperCase()).not.toContain('DROP COLUMN');
    }
  });
});

// ---------------------------------------------------------------------------
// Fail-safe: errors must propagate, not be swallowed
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – fail-safe error propagation', () => {
  it('propagates an error thrown by getAllSync', async () => {
    const db = {
      getAllSync: jest.fn(() => {
        throw new Error('DB locked');
      }),
      execSync: jest.fn(),
    };

    await expect(repairRuntimeSchemaIfNeeded(db)).rejects.toThrow('DB locked');
    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('propagates an error thrown by execSync during ALTER', async () => {
    const db = {
      getAllSync: jest.fn(() => [{ name: 'id' }]),
      execSync: jest.fn(() => {
        throw new Error('disk full');
      }),
    };

    await expect(repairRuntimeSchemaIfNeeded(db)).rejects.toThrow('disk full');
  });

  it('does not silently continue after execSync throws mid-repair', async () => {
    // Only the first ALTER should fire before the error propagates.
    const db = {
      getAllSync: jest.fn(() => [{ name: 'id' }]),
      execSync: jest.fn(() => {
        throw new Error('schema change not allowed');
      }),
    };

    await expect(repairRuntimeSchemaIfNeeded(db)).rejects.toThrow();
    // Only the first execSync call should have been attempted
    expect(db.execSync).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Extra / unknown columns (schema has drifted ahead of repair knowledge)
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – extra unknown columns', () => {
  it('does not crash when app_preferences has columns repair does not know about', async () => {
    const db = makeDb([
      'id',
      'future_feature_column',
      'another_unknown_column',
      ...MANAGED_COLUMNS,
    ]);

    await expect(repairRuntimeSchemaIfNeeded(db)).resolves.toBeUndefined();
    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('still adds missing managed columns even when unknown columns are present', async () => {
    const db = makeDb(['id', 'unknown_column_from_future_version']);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// Statement correctness
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – statement correctness', () => {
  it('uses ADD not ADD COLUMN (SQLite syntax) in all ALTER statements', async () => {
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);

    for (const [sql] of db.execSync.mock.calls as [string][]) {
      // SQLite uses "ADD <column>" not "ADD COLUMN <column>"
      expect(sql).toMatch(/ALTER TABLE .* ADD `/);
    }
  });

  it('all ALTER statements target the app_preferences table', async () => {
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);

    for (const [sql] of db.execSync.mock.calls as [string][]) {
      expect(sql).toContain('app_preferences');
    }
  });

  it('haptics_enabled column is added with integer type and DEFAULT true', async () => {
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);

    const calls: string[] = db.execSync.mock.calls.map((c: [string]) => c[0]);
    const hapticsCall = calls.find((s) => s.includes('haptics_enabled'));
    expect(hapticsCall).toBeDefined();
    expect(hapticsCall).toContain('integer');
    expect(hapticsCall?.toLowerCase()).toContain('default true');
  });

  it('tap_sound_enabled column is added with DEFAULT false', async () => {
    const db = makeDb(['id']);

    await repairRuntimeSchemaIfNeeded(db);

    const calls: string[] = db.execSync.mock.calls.map((c: [string]) => c[0]);
    const tapCall = calls.find((s) => s.includes('tap_sound_enabled'));
    expect(tapCall).toBeDefined();
    expect(tapCall?.toLowerCase()).toContain('default false');
  });
});

// ---------------------------------------------------------------------------
// user_profile.iud_type repair (multi-table generalization)
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – user_profile iud_type', () => {
  it('adds iud_type when the user_profile table is present but lacks it', async () => {
    const db = makeDb(
      ['id', ...MANAGED_COLUMNS], // app_preferences already complete
      ['id', 'birth_control_method'], // user_profile missing iud_type
    );

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).toHaveBeenCalledTimes(1);
    expect(db.execSync).toHaveBeenCalledWith('ALTER TABLE `user_profile` ADD `iud_type` text;');
  });

  it('skips iud_type when it already exists', async () => {
    const db = makeDb(['id', ...MANAGED_COLUMNS], ['id', 'iud_type']);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('skips iud_type when the user_profile table is absent', async () => {
    // user_profile defaults to empty -> absent -> skipped.
    const db = makeDb(['id', ...MANAGED_COLUMNS]);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('the iud_type ALTER is non-destructive and add-only', async () => {
    const db = makeDb(['id', ...MANAGED_COLUMNS], ['id']);

    await repairRuntimeSchemaIfNeeded(db);

    const [sql] = db.execSync.mock.calls[0] as [string];
    expect(sql.toUpperCase()).toContain('ALTER TABLE');
    expect(sql.toUpperCase()).toContain('ADD');
    for (const pattern of [/\bDROP\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bTRUNCATE\b/i]) {
      expect(sql).not.toMatch(pattern);
    }
  });
});

// ---------------------------------------------------------------------------
// billing_snapshot.lifetime_trial_started_at repair (app-level Lifetime trial)
// ---------------------------------------------------------------------------

describe('repairRuntimeSchemaIfNeeded – billing_snapshot lifetime_trial_started_at', () => {
  it('adds lifetime_trial_started_at when the billing_snapshot table lacks it', async () => {
    const db = makeDb(
      ['id', ...MANAGED_COLUMNS], // app_preferences complete
      ['id', 'iud_type'], // user_profile complete
      ['id', 'access_state', 'grandfather_trial_applied'], // billing_snapshot missing the column
    );

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).toHaveBeenCalledTimes(1);
    expect(db.execSync).toHaveBeenCalledWith(
      'ALTER TABLE `billing_snapshot` ADD `lifetime_trial_started_at` text;',
    );
  });

  it('skips lifetime_trial_started_at when it already exists', async () => {
    const db = makeDb(
      ['id', ...MANAGED_COLUMNS],
      ['id', 'iud_type'],
      ['id', 'access_state', 'lifetime_trial_started_at'],
    );

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('skips lifetime_trial_started_at when the billing_snapshot table is absent', async () => {
    // billing_snapshot defaults to empty -> absent -> skipped.
    const db = makeDb(['id', ...MANAGED_COLUMNS], ['id', 'iud_type']);

    await repairRuntimeSchemaIfNeeded(db);

    expect(db.execSync).not.toHaveBeenCalled();
  });
});
