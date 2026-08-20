import {
  appPreferencesSchema,
  backupEventSchema,
  backupSnapshotSchema,
  userProfileSchema,
} from '@/src/db/validators';
import type { BackupSnapshot } from '@/src/types/domain';

const baseProfileInput = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

describe('userProfileSchema iudType', () => {
  it.each(['hormonal', 'copper'] as const)('accepts a valid iudType: %s', (iudType) => {
    const result = userProfileSchema.safeParse({
      ...baseProfileInput,
      birthControlMethod: 'iud',
      iudType,
    });
    expect(result.success).toBe(true);
  });

  it('omits iudType when absent (optional)', () => {
    const result = userProfileSchema.safeParse(baseProfileInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.iudType).toBeUndefined();
    }
  });

  it('rejects an unknown iudType value', () => {
    const result = userProfileSchema.safeParse({
      ...baseProfileInput,
      birthControlMethod: 'iud',
      iudType: 'mirena',
    });
    expect(result.success).toBe(false);
  });
});

function createBackupSnapshotFixture(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-04-10T15:00:00.000Z',
    appPreferences: {
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: false,
      showFertilityEstimates: true,
      hapticsEnabled: true,
      tapSoundEnabled: false,
    },
    billingSnapshot: {
      accessState: 'needs_purchase',
    },
    userProfile: null,
    reminderPreferences: [],
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [
      {
        id: 'import-1',
        source: 'clue',
        status: 'committed',
        startedAt: '2026-04-10T10:00:00.000Z',
        completedAt: '2026-04-10T10:05:00.000Z',
        importedLogCount: 1,
        skippedLogCount: 0,
      },
    ],
    dailyLogs: [
      {
        id: 'log-1',
        logDate: '2026-04-10',
        bleeding: 'light',
        symptoms: ['fatigue'],
      },
    ],
  };
}

describe('backup snapshot validation', () => {
  it('accepts backup event operational history records', () => {
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-1',
        action: 'exported',
        occurredAt: '2026-04-10T10:00:00.000Z',
        detail: '2 local log entries encrypted into a Floriva backup file.',
      }),
    ).not.toThrow();
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-2',
        action: 'restored',
        occurredAt: '2026-04-11T10:00:00.000Z',
        detail: '2 local log entries restored from a Floriva backup file.',
      }),
    ).not.toThrow();
  });

  it('rejects malformed backup event records', () => {
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-1',
        action: 'deleted',
        occurredAt: '2026-04-10T10:00:00.000Z',
        detail: 'Backup event.',
      }),
    ).toThrow();
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-1',
        action: 'exported',
        occurredAt: '2026-04-10',
        detail: 'Backup event.',
      }),
    ).toThrow();
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-1',
        action: 'exported',
        occurredAt: '2026-04-10T10:00:00.000Z',
        detail: '',
      }),
    ).toThrow();
    expect(() =>
      backupEventSchema.parse({
        id: 'backup-event-1',
        action: 'exported',
        occurredAt: '2026-04-10T10:00:00.000Z',
        detail: 'x'.repeat(201),
      }),
    ).toThrow();
  });

  it('requires explicit interaction feedback preferences in app settings snapshots', () => {
    expect(() =>
      appPreferencesSchema.parse({
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      }),
    ).toThrow();
  });

  it('accepts lifetime billing snapshots in backups', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...createBackupSnapshotFixture(),
        billingSnapshot: {
          accessState: 'subscribed',
          planId: 'lifetime',
        },
      }),
    ).not.toThrow();
  });

  it('backfills missing interaction feedback preferences from legacy backups', () => {
    expect(
      backupSnapshotSchema.parse({
        ...createBackupSnapshotFixture(),
        appPreferences: {
          hasCompletedOnboarding: true,
          deferredBiometricsSetup: false,
          deferredReminderSetup: false,
          deferredImportSetup: false,
        },
      }).appPreferences,
    ).toEqual({
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
      dismissedAnomalyIds: [],
    });
  });

  it('accepts legacy complimentary billing snapshots in backups and normalizes them', () => {
    expect(
      backupSnapshotSchema.parse({
        ...createBackupSnapshotFixture(),
        billingSnapshot: {
          accessState: 'complimentary_active',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      }).billingSnapshot,
    ).toEqual({
      accessState: 'subscribed',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
  });

  it('rejects duplicate import session identifiers before restore can collapse them', () => {
    const duplicateSessionSnapshot = {
      ...createBackupSnapshotFixture(),
      importSessions: [
        {
          id: 'import-1',
          source: 'clue',
          status: 'committed',
          startedAt: '2026-04-10T10:00:00.000Z',
          completedAt: '2026-04-10T10:05:00.000Z',
          importedLogCount: 1,
          skippedLogCount: 0,
        },
        {
          id: 'import-1',
          source: 'flo',
          status: 'committed',
          startedAt: '2026-04-10T10:10:00.000Z',
          completedAt: '2026-04-10T10:12:00.000Z',
          importedLogCount: 2,
          skippedLogCount: 0,
        },
      ],
    };

    expect(() => backupSnapshotSchema.parse(duplicateSessionSnapshot)).toThrow(
      'Import session ids must be unique',
    );
  });

  it('rejects duplicate daily log identifiers and dates before restore preview succeeds', () => {
    const duplicateLogSnapshot = {
      ...createBackupSnapshotFixture(),
      dailyLogs: [
        {
          id: 'log-1',
          logDate: '2026-04-10',
          bleeding: 'light',
          symptoms: ['fatigue'],
        },
        {
          id: 'log-1',
          logDate: '2026-04-10',
          bleeding: 'medium',
          symptoms: ['cramps'],
        },
      ],
    };

    expect(() => backupSnapshotSchema.parse(duplicateLogSnapshot)).toThrow(
      'Daily log ids must be unique',
    );
  });

  it('rejects duplicate daily log dates even when the ids differ', () => {
    const duplicateDateSnapshot = {
      ...createBackupSnapshotFixture(),
      dailyLogs: [
        {
          id: 'log-1',
          logDate: '2026-04-10',
          bleeding: 'light',
          symptoms: ['fatigue'],
        },
        {
          id: 'log-2',
          logDate: '2026-04-10',
          bleeding: 'medium',
          symptoms: ['cramps'],
        },
      ],
    };

    expect(() => backupSnapshotSchema.parse(duplicateDateSnapshot)).toThrow(
      'Daily log dates must be unique',
    );
  });
});
