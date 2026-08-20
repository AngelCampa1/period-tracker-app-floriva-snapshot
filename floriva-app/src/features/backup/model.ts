import type {
  BackupRestorePreview,
  BackupRestoreResult,
  BackupSnapshot,
} from '@/src/types/domain';
import type { DomainRepositories } from '@/src/db/contracts';

import {
  createBackupPackage as createEncryptedBackupPackage,
  decryptBackupPackage as decryptEncryptedBackupPackage,
} from '@/src/features/backup/backupPackage';

type CreateBackupWorkflowOptions = {
  repositories: Pick<DomainRepositories, 'backupData'> & Partial<Pick<DomainRepositories, 'backupEvents'>>;
  createBackupPackage?: typeof createEncryptedBackupPackage;
  decryptBackupPackage?: typeof decryptEncryptedBackupPackage;
  now?: () => string;
};

function defaultNow() {
  return new Date().toISOString();
}

function buildBackupFileName(isoTimestamp: string) {
  return `floriva-backup-${isoTimestamp.slice(0, 10)}.floriva`;
}

function requiresBillingRevalidation(snapshot: BackupSnapshot) {
  return (
    snapshot.billingSnapshot.accessState === 'trial_active' ||
    snapshot.billingSnapshot.accessState === 'subscribed'
  );
}

function countTrackedPeriodDays(snapshot: BackupSnapshot) {
  return snapshot.dailyLogs.filter((entry) => entry.bleeding !== 'none').length;
}

function getLogDateRange(snapshot: BackupSnapshot) {
  const sortedLogDates = snapshot.dailyLogs
    .map((entry) => entry.logDate)
    .sort((left, right) => left.localeCompare(right));

  return {
    firstLogDate: sortedLogDates[0],
    lastLogDate: sortedLogDates.at(-1),
  };
}

function buildBackupEventId(action: 'exported' | 'restored', timestamp: string) {
  return `backup-${action}-${timestamp.replace(/[^0-9]/g, '')}`;
}

async function recordBackupEventBestEffort(
  repositories: CreateBackupWorkflowOptions['repositories'],
  event: Parameters<NonNullable<CreateBackupWorkflowOptions['repositories']['backupEvents']>['recordEvent']>[0],
) {
  try {
    await repositories.backupEvents?.recordEvent(event);
  } catch {
    // Backup packages and restores are the source of truth; timeline history is best-effort.
  }
}

function sanitizeSnapshotForRestore(snapshot: BackupSnapshot): BackupSnapshot {
  return {
    ...snapshot,
    billingSnapshot: requiresBillingRevalidation(snapshot)
      ? {
          accessState: 'needs_purchase',
          lastSyncedAt: snapshot.billingSnapshot.lastSyncedAt,
        }
      : snapshot.billingSnapshot,
    privacyPreference: {
      ...snapshot.privacyPreference,
      biometricsEnabled: false,
    },
  };
}

export function createBackupWorkflow({
  repositories,
  createBackupPackage = createEncryptedBackupPackage,
  decryptBackupPackage = decryptEncryptedBackupPackage,
  now = defaultNow,
}: CreateBackupWorkflowOptions) {
  async function createExportPackage({ passphrase }: { passphrase: string }) {
    const snapshot = await repositories.backupData.exportSnapshot();
    const serializedPackage = await createBackupPackage({
      snapshot,
      passphrase,
    });
    const exportedAt = now();

    return {
      exportedAt,
      fileName: buildBackupFileName(exportedAt),
      serializedPackage,
    };
  }

  async function recordExportEvent(exportedAt: string) {
    await recordBackupEventBestEffort(repositories, {
      id: buildBackupEventId('exported', exportedAt),
      action: 'exported',
      occurredAt: exportedAt,
      detail: 'backup_exported',
    });
  }

  async function previewRestore({
    serializedPackage,
    passphrase,
  }: {
    serializedPackage: string;
    passphrase: string;
  }): Promise<BackupRestorePreview> {
    const snapshot = await decryptBackupPackage({
      serializedPackage,
      passphrase,
    });

    return {
      snapshot,
      importedLogCount: snapshot.dailyLogs.length,
      importSessionCount: snapshot.importSessions.length,
      periodStartCount: countTrackedPeriodDays(snapshot),
      exportedDate: snapshot.exportedAt.slice(0, 10),
      ...getLogDateRange(snapshot),
      reminderCount: snapshot.reminderPreferences.filter((reminder) => reminder.enabled).length,
      hasCycleProfile: Boolean(snapshot.userProfile),
      willDisableBiometrics: snapshot.privacyPreference.biometricsEnabled,
      requiresBillingRevalidation: requiresBillingRevalidation(snapshot),
    };
  }

  async function commitRestore(preview: BackupRestorePreview): Promise<BackupRestoreResult> {
    const restoredSnapshot = sanitizeSnapshotForRestore(preview.snapshot);

    await repositories.backupData.restoreSnapshot(restoredSnapshot);
    const timestamp = now();

    await recordBackupEventBestEffort(repositories, {
      id: buildBackupEventId('restored', timestamp),
      action: 'restored',
      occurredAt: timestamp,
      detail: 'backup_restored',
    });

    return {
      restoredSnapshot,
      importedLogCount: preview.importedLogCount,
      importSessionCount: preview.importSessionCount,
      biometricRearmRequired: preview.willDisableBiometrics,
      billingRevalidationRequired: preview.requiresBillingRevalidation,
    };
  }

  return {
    createExportPackage,
    recordExportEvent,
    previewRestore,
    commitRestore,
  };
}
