import { repairRuntimeSchemaIfNeeded } from '@/src/db/runtimeSchemaRepair';

/**
 * Builds a mock db whose `getAllSync` returns per-table column lists keyed by
 * the table named in the pragma query. Tables not listed report zero columns
 * (i.e. "absent" -- repair skips them).
 */
function mockDbWithTables(columnsByTable: Record<string, string[]>) {
  return {
    getAllSync: jest.fn((query: string) => {
      const table = Object.keys(columnsByTable).find((name) =>
        query.includes(`'${name}'`),
      );
      return (table ? columnsByTable[table]! : []).map((name) => ({ name }));
    }),
    execSync: jest.fn(),
  };
}

describe('repairRuntimeSchemaIfNeeded', () => {
  it('adds missing interaction feedback and fertility estimate columns to app_preferences', async () => {
    const mockDatabase = mockDbWithTables({
      app_preferences: ['id', 'has_completed_onboarding'],
      // user_profile already has iud_type so this test isolates app_preferences
      user_profile: ['id', 'iud_type'],
    });

    await repairRuntimeSchemaIfNeeded(mockDatabase);

    expect(mockDatabase.execSync).toHaveBeenCalledTimes(4);
    expect(mockDatabase.execSync).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE `app_preferences` ADD `haptics_enabled` integer DEFAULT true NOT NULL;',
    );
    expect(mockDatabase.execSync).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE `app_preferences` ADD `tap_sound_enabled` integer DEFAULT false NOT NULL;',
    );
    expect(mockDatabase.execSync).toHaveBeenNthCalledWith(
      3,
      'ALTER TABLE `app_preferences` ADD `show_fertility_estimates` integer DEFAULT true NOT NULL;',
    );
    expect(mockDatabase.execSync).toHaveBeenNthCalledWith(
      4,
      "ALTER TABLE `app_preferences` ADD `dismissed_anomaly_ids` text DEFAULT '[]' NOT NULL;",
    );
  });

  it('adds the iud_type column to user_profile when missing', async () => {
    const mockDatabase = mockDbWithTables({
      app_preferences: [
        'id',
        'haptics_enabled',
        'tap_sound_enabled',
        'show_fertility_estimates',
        'dismissed_anomaly_ids',
      ],
      user_profile: ['id', 'birth_control_method'],
    });

    await repairRuntimeSchemaIfNeeded(mockDatabase);

    expect(mockDatabase.execSync).toHaveBeenCalledTimes(1);
    expect(mockDatabase.execSync).toHaveBeenCalledWith(
      'ALTER TABLE `user_profile` ADD `iud_type` text;',
    );
  });

  it('adds the lifetime_trial_started_at column to billing_snapshot when missing', async () => {
    const mockDatabase = mockDbWithTables({
      app_preferences: [
        'id',
        'haptics_enabled',
        'tap_sound_enabled',
        'show_fertility_estimates',
        'dismissed_anomaly_ids',
      ],
      user_profile: ['id', 'iud_type'],
      billing_snapshot: ['id', 'access_state', 'grandfather_trial_applied'],
    });

    await repairRuntimeSchemaIfNeeded(mockDatabase);

    expect(mockDatabase.execSync).toHaveBeenCalledTimes(1);
    expect(mockDatabase.execSync).toHaveBeenCalledWith(
      'ALTER TABLE `billing_snapshot` ADD `lifetime_trial_started_at` text;',
    );
  });

  it('skips repairs when all columns already exist', async () => {
    const mockDatabase = mockDbWithTables({
      app_preferences: [
        'id',
        'haptics_enabled',
        'tap_sound_enabled',
        'show_fertility_estimates',
        'dismissed_anomaly_ids',
      ],
      user_profile: ['id', 'iud_type'],
    });

    await repairRuntimeSchemaIfNeeded(mockDatabase);

    expect(mockDatabase.execSync).not.toHaveBeenCalled();
  });

  it('no-ops when the tables are unavailable', async () => {
    const mockDatabase = mockDbWithTables({});

    await repairRuntimeSchemaIfNeeded(mockDatabase);

    expect(mockDatabase.execSync).not.toHaveBeenCalled();
  });
});
