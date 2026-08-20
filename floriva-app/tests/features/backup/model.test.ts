import { defaultAppPreferences } from '@/src/db/domainDefaults';
import type { BackupSnapshot } from '@/src/types/domain';
import { createBackupWorkflow } from '@/src/features/backup/model';

const mockExportSnapshot = jest.fn();
const mockRestoreSnapshot = jest.fn();
const mockCreateBackupPackage = jest.fn();
const mockDecryptBackupPackage = jest.fn();
const mockRecordBackupEvent = jest.fn();

function createSnapshotFixture(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-04-10T15:00:00.000Z',
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
    },
    billingSnapshot: {
      accessState: 'subscribed',
      planId: 'annual',
      trialEndsAt: '2026-04-15T09:00:00.000Z',
      firstChargeAt: '2026-04-15T09:00:00.000Z',
      expiresAt: '2027-04-15T09:00:00.000Z',
      lastSyncedAt: '2026-04-10T09:00:00.000Z',
    },
    userProfile: {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-05',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    },
    reminderPreferences: [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
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
        id: 'import-1',
        source: 'clue',
        status: 'committed',
        startedAt: '2026-04-09T08:00:00.000Z',
        completedAt: '2026-04-09T08:05:00.000Z',
        importedLogCount: 1,
        skippedLogCount: 0,
      },
    ],
    dailyLogs: [
      {
        id: 'backup-log-1',
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: ['cramps'],
        notes: 'Backup fixture entry.',
        importSessionId: 'import-1',
      },
      {
        id: 'backup-log-2',
        logDate: '2026-04-10',
        bleeding: 'light',
        symptoms: ['fatigue'],
      },
    ],
  };
}

describe('backup workflow model', () => {
  beforeEach(() => {
    mockExportSnapshot.mockReset();
    mockRestoreSnapshot.mockReset();
    mockCreateBackupPackage.mockReset();
    mockDecryptBackupPackage.mockReset();
    mockRecordBackupEvent.mockReset();
  });

  it('exports a serialized backup package and suggests a migration-friendly filename', async () => {
    const snapshot = createSnapshotFixture();
    mockExportSnapshot.mockResolvedValue(snapshot);
    mockCreateBackupPackage.mockResolvedValue('encrypted-backup-package');

    const workflow = createBackupWorkflow({
      repositories: {
        backupData: {
          exportSnapshot: () => mockExportSnapshot(),
          restoreSnapshot: (...args: unknown[]) => mockRestoreSnapshot(...args),
        },
        backupEvents: {
          listEvents: jest.fn(),
          recordEvent: (...args: unknown[]) => mockRecordBackupEvent(...args),
        },
      },
      createBackupPackage: (...args: unknown[]) => mockCreateBackupPackage(...args),
      decryptBackupPackage: (...args: unknown[]) => mockDecryptBackupPackage(...args),
      now: () => '2026-04-10T15:20:00.000Z',
    });

    await expect(
      workflow.createExportPackage({ passphrase: 'privacy-first-passphrase' }),
    ).resolves.toEqual({
      exportedAt: '2026-04-10T15:20:00.000Z',
      fileName: 'floriva-backup-2026-04-10.floriva',
      serializedPackage: 'encrypted-backup-package',
    });
    expect(mockRecordBackupEvent).not.toHaveBeenCalled();
    await workflow.recordExportEvent('2026-04-10T15:20:00.000Z');
    expect(mockRecordBackupEvent).toHaveBeenCalledWith({
      id: 'backup-exported-20260410152000000',
      action: 'exported',
      occurredAt: '2026-04-10T15:20:00.000Z',
      detail: 'backup_exported',
    });
  });

  it('previews restore counts and flags before any local data is replaced', async () => {
    const snapshot = createSnapshotFixture();
    mockDecryptBackupPackage.mockResolvedValue(snapshot);

    const workflow = createBackupWorkflow({
      repositories: {
        backupData: {
          exportSnapshot: () => mockExportSnapshot(),
          restoreSnapshot: (...args: unknown[]) => mockRestoreSnapshot(...args),
        },
        backupEvents: {
          listEvents: jest.fn(),
          recordEvent: (...args: unknown[]) => mockRecordBackupEvent(...args),
        },
      },
      createBackupPackage: (...args: unknown[]) => mockCreateBackupPackage(...args),
      decryptBackupPackage: (...args: unknown[]) => mockDecryptBackupPackage(...args),
      now: () => '2026-04-11T09:30:00.000Z',
    });

    await expect(
      workflow.previewRestore({
        serializedPackage: 'encrypted-backup-package',
        passphrase: 'privacy-first-passphrase',
      }),
    ).resolves.toEqual({
      snapshot,
      importedLogCount: 2,
      importSessionCount: 1,
      periodStartCount: 2,
      exportedDate: '2026-04-10',
      firstLogDate: '2026-04-09',
      lastLogDate: '2026-04-10',
      reminderCount: 1,
      hasCycleProfile: true,
      willDisableBiometrics: true,
      requiresBillingRevalidation: true,
    });
  });

  it('restores a sanitized snapshot that disables biometrics and forces billing revalidation', async () => {
    const snapshot = createSnapshotFixture();
    const workflow = createBackupWorkflow({
      repositories: {
        backupData: {
          exportSnapshot: () => mockExportSnapshot(),
          restoreSnapshot: (...args: unknown[]) => mockRestoreSnapshot(...args),
        },
        backupEvents: {
          listEvents: jest.fn(),
          recordEvent: (...args: unknown[]) => mockRecordBackupEvent(...args),
        },
      },
      createBackupPackage: (...args: unknown[]) => mockCreateBackupPackage(...args),
      decryptBackupPackage: (...args: unknown[]) => mockDecryptBackupPackage(...args),
      now: () => '2026-04-11T09:30:00.000Z',
    });

    const preview = {
      snapshot,
      importedLogCount: 2,
      importSessionCount: 1,
      periodStartCount: 2,
      exportedDate: '2026-04-10',
      firstLogDate: '2026-04-09',
      lastLogDate: '2026-04-10',
      reminderCount: 1,
      hasCycleProfile: true,
      willDisableBiometrics: true,
      requiresBillingRevalidation: true,
    } as const;

    await workflow.commitRestore(preview);

    expect(mockRestoreSnapshot).toHaveBeenCalledWith({
      ...snapshot,
      billingSnapshot: {
        accessState: 'needs_purchase',
        lastSyncedAt: '2026-04-10T09:00:00.000Z',
      },
      privacyPreference: {
        ...snapshot.privacyPreference,
        biometricsEnabled: false,
      },
    });
    expect(mockRecordBackupEvent).toHaveBeenCalledWith({
      id: 'backup-restored-20260411093000000',
      action: 'restored',
      occurredAt: '2026-04-11T09:30:00.000Z',
      detail: 'backup_restored',
    });
  });

  it('does not fail completed backup workflows when timeline event recording fails', async () => {
    const snapshot = createSnapshotFixture();
    mockExportSnapshot.mockResolvedValue(snapshot);
    mockCreateBackupPackage.mockResolvedValue('encrypted-backup-package');
    mockRecordBackupEvent.mockRejectedValue(new Error('timeline unavailable'));

    const workflow = createBackupWorkflow({
      repositories: {
        backupData: {
          exportSnapshot: () => mockExportSnapshot(),
          restoreSnapshot: (...args: unknown[]) => mockRestoreSnapshot(...args),
        },
        backupEvents: {
          listEvents: jest.fn(),
          recordEvent: (...args: unknown[]) => mockRecordBackupEvent(...args),
        },
      },
      createBackupPackage: (...args: unknown[]) => mockCreateBackupPackage(...args),
      decryptBackupPackage: (...args: unknown[]) => mockDecryptBackupPackage(...args),
      now: () => '2026-04-10T15:20:00.000Z',
    });

    await expect(
      workflow.createExportPackage({ passphrase: 'privacy-first-passphrase' }),
    ).resolves.toEqual({
      exportedAt: '2026-04-10T15:20:00.000Z',
      fileName: 'floriva-backup-2026-04-10.floriva',
      serializedPackage: 'encrypted-backup-package',
    });
    await expect(workflow.recordExportEvent('2026-04-10T15:20:00.000Z')).resolves.toBeUndefined();
  });
});
