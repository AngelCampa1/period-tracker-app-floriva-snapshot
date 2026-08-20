/**
 * Adversarial probe tests for src/features/backup/model.ts
 *
 * These tests assert CORRECT behavior. Genuine bugs are kept FAILING and
 * annotated with "SUSPECTED BUG".
 *
 * The crypto/repository layers are mocked; this file targets only the
 * orchestration logic in createBackupWorkflow.
 */

import type {
  BackupRestorePreview,
  BackupSnapshot,
  BillingSnapshot,
  PrivacyPreference,
  DailyLogEntry,
  ReminderPreference,
  UserProfile,
  ImportSession,
  AppPreferences,
} from '@/src/types/domain';

import { createBackupWorkflow } from '@/src/features/backup/model';

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

function makePrivacyPreference(overrides: Partial<PrivacyPreference> = {}): PrivacyPreference {
  return {
    biometricsEnabled: false,
    relockAfterSeconds: 0,
    destructiveActionConfirmationRequired: false,
    diagnosticsConsentEnabled: false,
    ...overrides,
  };
}

function makeAppPreferences(overrides: Partial<AppPreferences> = {}): AppPreferences {
  return {
    hasCompletedOnboarding: true,
    deferredCycleSetup: false,
    deferredTrackingSetup: false,
    deferredBiometricsSetup: false,
    deferredReminderSetup: false,
    deferredImportSetup: false,
    dismissedTailoringChecklist: false,
    showFertilityEstimates: false,
    hapticsEnabled: true,
    tapSoundEnabled: false,
    ...overrides,
  };
}

function makeBillingSnapshot(
  accessState: BillingSnapshot['accessState'] = 'needs_purchase',
): BillingSnapshot {
  return { accessState, lastSyncedAt: '2026-01-01T00:00:00.000Z' };
}

function makeDailyLog(
  id: string,
  logDate: string,
  bleeding: DailyLogEntry['bleeding'] = 'none',
): DailyLogEntry {
  return { id, logDate, bleeding, symptoms: [] };
}

function makeImportSession(id: string): ImportSession {
  return {
    id,
    source: 'clue',
    status: 'committed',
    startedAt: '2026-01-01T00:00:00.000Z',
    importedLogCount: 1,
    skippedLogCount: 0,
  };
}

function makeReminderPreference(enabled: boolean): ReminderPreference {
  return {
    kind: 'daily-log',
    enabled,
    hour: 8,
    minute: 0,
    schedule: { cadence: 'daily' },
  };
}

function makeSnapshot(overrides: Partial<BackupSnapshot> = {}): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-06-10T12:00:00.000Z',
    appPreferences: makeAppPreferences(),
    billingSnapshot: makeBillingSnapshot(),
    userProfile: null,
    reminderPreferences: [],
    privacyPreference: makePrivacyPreference(),
    importSessions: [],
    dailyLogs: [],
    ...overrides,
  };
}

function makeRestorePreview(snapshot: BackupSnapshot): BackupRestorePreview {
  const enabledReminders = snapshot.reminderPreferences.filter((r) => r.enabled).length;
  const periodDays = snapshot.dailyLogs.filter((e) => e.bleeding !== 'none').length;
  const sortedDates = snapshot.dailyLogs.map((e) => e.logDate).sort((a, b) => a.localeCompare(b));

  return {
    snapshot,
    importedLogCount: snapshot.dailyLogs.length,
    importSessionCount: snapshot.importSessions.length,
    periodStartCount: periodDays,
    exportedDate: snapshot.exportedAt.slice(0, 10),
    firstLogDate: sortedDates[0],
    lastLogDate: sortedDates.at(-1),
    reminderCount: enabledReminders,
    hasCycleProfile: snapshot.userProfile !== null,
    willDisableBiometrics: snapshot.privacyPreference.biometricsEnabled,
    requiresBillingRevalidation:
      snapshot.billingSnapshot.accessState === 'trial_active' ||
      snapshot.billingSnapshot.accessState === 'subscribed',
  };
}

// ---------------------------------------------------------------------------
// Repository / crypto mock factories
// ---------------------------------------------------------------------------

function makeRepositories(snapshotToExport: BackupSnapshot = makeSnapshot()) {
  const restoreSnapshot = jest.fn().mockResolvedValue(undefined);
  const exportSnapshot = jest.fn().mockResolvedValue(snapshotToExport);
  const recordEvent = jest.fn().mockResolvedValue(undefined);
  const listEvents = jest.fn().mockResolvedValue([]);

  return {
    backupData: { exportSnapshot, restoreSnapshot },
    backupEvents: { recordEvent, listEvents },
    _mocks: { restoreSnapshot, exportSnapshot, recordEvent, listEvents },
  };
}

function makeCreateBackupPackage(result = 'serialized-encrypted-package') {
  return jest.fn().mockResolvedValue(result);
}

function makeDecryptBackupPackage(snapshot: BackupSnapshot) {
  return jest.fn().mockResolvedValue(snapshot);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBackupWorkflow — createExportPackage', () => {
  it('passes the snapshot from the repository to the crypto layer', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories(snapshot);
    const mockCreatePkg = makeCreateBackupPackage('pkg-123');

    const workflow = createBackupWorkflow({
      repositories: repos,
      createBackupPackage: mockCreatePkg,
    });

    await workflow.createExportPackage({ passphrase: 'my-passphrase' });

    expect(mockCreatePkg).toHaveBeenCalledWith({ snapshot, passphrase: 'my-passphrase' });
  });

  it('returns the serialized package produced by the crypto layer', async () => {
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      createBackupPackage: makeCreateBackupPackage('custom-pkg'),
    });

    const { serializedPackage } = await workflow.createExportPackage({ passphrase: 'pass' });
    expect(serializedPackage).toBe('custom-pkg');
  });

  it('builds a filename from the ISO date component of exportedAt', async () => {
    const repos = makeRepositories();
    const fixedNow = jest.fn().mockReturnValue('2026-06-10T15:30:00.000Z');
    const workflow = createBackupWorkflow({
      repositories: repos,
      createBackupPackage: makeCreateBackupPackage(),
      now: fixedNow,
    });

    const { fileName } = await workflow.createExportPackage({ passphrase: 'pass' });
    expect(fileName).toBe('floriva-backup-2026-06-10.floriva');
  });

  it('includes the exportedAt timestamp in the returned value', async () => {
    const repos = makeRepositories();
    const fixedNow = jest.fn().mockReturnValue('2026-06-10T15:30:00.000Z');
    const workflow = createBackupWorkflow({
      repositories: repos,
      createBackupPackage: makeCreateBackupPackage(),
      now: fixedNow,
    });

    const { exportedAt } = await workflow.createExportPackage({ passphrase: 'pass' });
    expect(exportedAt).toBe('2026-06-10T15:30:00.000Z');
  });

  it('does not call restoreSnapshot during export', async () => {
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      createBackupPackage: makeCreateBackupPackage(),
    });

    await workflow.createExportPackage({ passphrase: 'pass' });
    expect(repos._mocks.restoreSnapshot).not.toHaveBeenCalled();
  });
});

describe('createBackupWorkflow — recordExportEvent', () => {
  it('records an exported backup event with the given timestamp', async () => {
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.recordExportEvent('2026-06-10T15:30:00.000Z');

    expect(repos._mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exported',
        detail: 'backup_exported',
        occurredAt: '2026-06-10T15:30:00.000Z',
      }),
    );
  });

  it('does not throw when backupEvents is omitted', async () => {
    const repos = makeRepositories();
    const reposWithoutEvents = { backupData: repos.backupData };
    const workflow = createBackupWorkflow({ repositories: reposWithoutEvents });

    await expect(workflow.recordExportEvent('2026-06-10T00:00:00.000Z')).resolves.not.toThrow();
  });

  it('does not throw when backupEvents.recordEvent rejects', async () => {
    const repos = makeRepositories();
    repos._mocks.recordEvent.mockRejectedValueOnce(new Error('DB write failed'));

    const workflow = createBackupWorkflow({ repositories: repos });

    await expect(workflow.recordExportEvent('2026-06-10T00:00:00.000Z')).resolves.not.toThrow();
  });

  it('event id encodes only digits from the timestamp', async () => {
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.recordExportEvent('2026-06-10T15:30:00.000Z');

    const call = repos._mocks.recordEvent.mock.calls[0][0] as { id: string };
    // id should be "backup-exported-" followed by digits only
    expect(call.id).toMatch(/^backup-exported-\d+$/);
  });
});

describe('createBackupWorkflow — previewRestore', () => {
  it('decrypts the package with the supplied passphrase', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const mockDecrypt = makeDecryptBackupPackage(snapshot);

    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: mockDecrypt,
    });

    await workflow.previewRestore({ serializedPackage: 'pkg', passphrase: 'secret' });

    expect(mockDecrypt).toHaveBeenCalledWith({ serializedPackage: 'pkg', passphrase: 'secret' });
  });

  it('counts ALL daily log entries regardless of bleeding value', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [
        makeDailyLog('a', '2026-01-01', 'none'),
        makeDailyLog('b', '2026-01-02', 'medium'),
        makeDailyLog('c', '2026-01-03', 'none'),
      ],
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.importedLogCount).toBe(3);
  });

  it('counts only entries with non-none bleeding as periodStartCount', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [
        makeDailyLog('a', '2026-01-01', 'none'),
        makeDailyLog('b', '2026-01-02', 'medium'),
        makeDailyLog('c', '2026-01-03', 'spotting'),
        makeDailyLog('d', '2026-01-04', 'none'),
      ],
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.periodStartCount).toBe(2);
  });

  it('counts only enabled reminders', async () => {
    const snapshot = makeSnapshot({
      reminderPreferences: [
        makeReminderPreference(true),
        makeReminderPreference(false),
        makeReminderPreference(true),
      ],
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.reminderCount).toBe(2);
  });

  it('sets hasCycleProfile true when userProfile is populated', async () => {
    const profile: UserProfile = {
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };
    const snapshot = makeSnapshot({ userProfile: profile });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.hasCycleProfile).toBe(true);
  });

  it('sets hasCycleProfile false when userProfile is null', async () => {
    const snapshot = makeSnapshot({ userProfile: null });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.hasCycleProfile).toBe(false);
  });

  it('derives exportedDate as just the date portion of exportedAt', async () => {
    const snapshot = makeSnapshot({ exportedAt: '2026-03-15T08:45:00.000Z' });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.exportedDate).toBe('2026-03-15');
  });

  it('returns first/last log dates in ascending order regardless of input order', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [
        makeDailyLog('c', '2026-03-10'),
        makeDailyLog('a', '2026-01-01'),
        makeDailyLog('b', '2026-06-15'),
      ],
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.firstLogDate).toBe('2026-01-01');
    expect(preview.lastLogDate).toBe('2026-06-15');
  });

  it('leaves firstLogDate and lastLogDate undefined when there are no daily logs', async () => {
    const snapshot = makeSnapshot({ dailyLogs: [] });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.firstLogDate).toBeUndefined();
    expect(preview.lastLogDate).toBeUndefined();
  });

  it('sets willDisableBiometrics true when biometrics are enabled in the snapshot', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: true }),
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.willDisableBiometrics).toBe(true);
  });

  it('sets willDisableBiometrics false when biometrics are disabled in the snapshot', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: false }),
    });

    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.willDisableBiometrics).toBe(false);
  });

  it('sets requiresBillingRevalidation true for trial_active access state', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('trial_active') });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.requiresBillingRevalidation).toBe(true);
  });

  it('sets requiresBillingRevalidation true for subscribed access state', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('subscribed') });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.requiresBillingRevalidation).toBe(true);
  });

  it('sets requiresBillingRevalidation false for needs_purchase access state', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('needs_purchase') });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.requiresBillingRevalidation).toBe(false);
  });

  it('sets requiresBillingRevalidation false for expired access state', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('expired') });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.requiresBillingRevalidation).toBe(false);
  });

  it('sets requiresBillingRevalidation false for sync_error access state', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('sync_error') });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.requiresBillingRevalidation).toBe(false);
  });

  it('propagates errors thrown by decryptBackupPackage', async () => {
    const repos = makeRepositories();
    const err = new Error('wrong_passphrase');
    const mockDecrypt = jest.fn().mockRejectedValue(err);

    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: mockDecrypt,
    });

    await expect(
      workflow.previewRestore({ serializedPackage: 'bad', passphrase: 'wrong' }),
    ).rejects.toThrow('wrong_passphrase');
  });

  it('includes the raw snapshot in the preview so commitRestore can use it', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.snapshot).toBe(snapshot);
  });
});

describe('createBackupWorkflow — commitRestore', () => {
  it('calls restoreSnapshot with the sanitized snapshot', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    expect(repos._mocks.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(repos._mocks.restoreSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ formatVersion: 1 }),
    );
  });

  it('always disables biometrics in the restored snapshot regardless of backup value', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: true }),
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.privacyPreference.biometricsEnabled).toBe(false);
  });

  it('leaves biometrics disabled when they were already disabled in the backup', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: false }),
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.privacyPreference.biometricsEnabled).toBe(false);
  });

  it('rewrites billing to needs_purchase when access state was trial_active', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('trial_active') });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.billingSnapshot.accessState).toBe('needs_purchase');
  });

  it('rewrites billing to needs_purchase when access state was subscribed', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('subscribed') });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.billingSnapshot.accessState).toBe('needs_purchase');
  });

  it('preserves billing as-is when access state is needs_purchase', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('needs_purchase') });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.billingSnapshot.accessState).toBe('needs_purchase');
  });

  it('preserves billing as-is when access state is expired', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('expired') });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.billingSnapshot.accessState).toBe('expired');
  });

  it('preserves lastSyncedAt when billing is rewritten to needs_purchase', async () => {
    const billingSnapshot: BillingSnapshot = {
      accessState: 'subscribed',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
    };
    const snapshot = makeSnapshot({ billingSnapshot });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    expect(restoredArg.billingSnapshot.lastSyncedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('returns biometricRearmRequired true when backup had biometrics enabled', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: true }),
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    expect(result.biometricRearmRequired).toBe(true);
  });

  it('returns biometricRearmRequired false when backup had biometrics disabled', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: false }),
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    expect(result.biometricRearmRequired).toBe(false);
  });

  it('returns billingRevalidationRequired true when access state required revalidation', async () => {
    const snapshot = makeSnapshot({ billingSnapshot: makeBillingSnapshot('subscribed') });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    expect(result.billingRevalidationRequired).toBe(true);
  });

  it('returns the importedLogCount and importSessionCount from the preview', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [makeDailyLog('a', '2026-01-01'), makeDailyLog('b', '2026-01-02')],
      importSessions: [makeImportSession('s1')],
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    expect(result.importedLogCount).toBe(2);
    expect(result.importSessionCount).toBe(1);
  });

  it('records a restored backup event after successfully committing', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);
    const fixedNow = jest.fn().mockReturnValue('2026-06-10T20:00:00.000Z');

    const workflow = createBackupWorkflow({ repositories: repos, now: fixedNow });

    await workflow.commitRestore(preview);

    expect(repos._mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'restored',
        detail: 'backup_restored',
        occurredAt: '2026-06-10T20:00:00.000Z',
      }),
    );
  });

  it('still resolves when the restored event recording fails', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    repos._mocks.recordEvent.mockRejectedValueOnce(new Error('event store down'));
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await expect(workflow.commitRestore(preview)).resolves.not.toThrow();
    expect(repos._mocks.restoreSnapshot).toHaveBeenCalledTimes(1);
  });

  it('propagates errors thrown by restoreSnapshot', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    repos._mocks.restoreSnapshot.mockRejectedValueOnce(new Error('DB write failed'));
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await expect(workflow.commitRestore(preview)).rejects.toThrow('DB write failed');
  });

  it('does not call exportSnapshot during restore', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    expect(repos._mocks.exportSnapshot).not.toHaveBeenCalled();
  });

  it('does not call decryptBackupPackage during commitRestore', async () => {
    const snapshot = makeSnapshot();
    const repos = makeRepositories();
    const mockDecrypt = jest.fn();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: mockDecrypt,
    });

    await workflow.commitRestore(preview);

    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('does not mutate the snapshot object stored in the preview', async () => {
    const snapshot = makeSnapshot({
      privacyPreference: makePrivacyPreference({ biometricsEnabled: true }),
      billingSnapshot: makeBillingSnapshot('subscribed'),
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    // The original snapshot on the preview must remain unmodified.
    expect(preview.snapshot.privacyPreference.biometricsEnabled).toBe(true);
    expect(preview.snapshot.billingSnapshot.accessState).toBe('subscribed');
  });

  // BY DESIGN (security): sanitizeSnapshotForRestore deliberately strips planId,
  // expiresAt, firstChargeAt and every other subscription-derived field when
  // rewriting a subscribed/trial_active billing snapshot to needs_purchase,
  // carrying forward ONLY lastSyncedAt. A backup file is portable and
  // untrusted — it must never be able to grant paid entitlement. Entitlement is
  // re-validated against the App Store / Play after restore; retaining a stale
  // or forged expiresAt/planId from the file could wrongly unlock paid features
  // (a violation of Floriva's trust rules). So the drop is the correct,
  // fail-closed behaviour, not a bug.
  it('drops all subscription-derived billing fields when rewriting subscribed to needs_purchase (untrusted backup must re-validate entitlement)', async () => {
    const billingSnapshot: BillingSnapshot = {
      accessState: 'subscribed',
      planId: 'annual',
      firstChargeAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:00.000Z',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
    };
    const snapshot = makeSnapshot({ billingSnapshot });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    await workflow.commitRestore(preview);

    const restoredArg = repos._mocks.restoreSnapshot.mock.calls[0][0] as BackupSnapshot;
    // accessState must be reset so entitlement is re-derived from the store.
    expect(restoredArg.billingSnapshot.accessState).toBe('needs_purchase');
    // Only lastSyncedAt is carried forward; every entitlement-granting field is
    // dropped so a restored backup cannot unlock paid access on its own.
    expect(restoredArg.billingSnapshot.lastSyncedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(restoredArg.billingSnapshot.planId).toBeUndefined();
    expect(restoredArg.billingSnapshot.expiresAt).toBeUndefined();
    expect(restoredArg.billingSnapshot.firstChargeAt).toBeUndefined();
  });
});

describe('createBackupWorkflow — round-trip invariants', () => {
  it('preview importedLogCount equals length of dailyLogs in snapshot', async () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      makeDailyLog(`id-${i}`, `2026-0${Math.floor(i / 9) + 1}-${String(i + 1).padStart(2, '0')}`),
    );
    const snapshot = makeSnapshot({ dailyLogs: logs });
    const repos = makeRepositories();
    const workflow = createBackupWorkflow({
      repositories: repos,
      decryptBackupPackage: makeDecryptBackupPackage(snapshot),
    });

    const preview = await workflow.previewRestore({ serializedPackage: 'p', passphrase: 's' });

    expect(preview.importedLogCount).toBe(logs.length);
  });

  it('commitRestore passes exactly the sanitized snapshot to restoreSnapshot', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [makeDailyLog('a', '2026-01-01', 'heavy')],
      importSessions: [makeImportSession('s1')],
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    // The result's restoredSnapshot should be what was passed to restoreSnapshot
    expect(repos._mocks.restoreSnapshot).toHaveBeenCalledWith(result.restoredSnapshot);
  });

  it('importedLogCount in result matches what was in the preview', async () => {
    const snapshot = makeSnapshot({
      dailyLogs: [makeDailyLog('a', '2026-01-01'), makeDailyLog('b', '2026-01-02')],
    });
    const repos = makeRepositories();
    const preview = makeRestorePreview(snapshot);
    // Mutate preview count to a different value to check the model reads it correctly
    (preview as { importedLogCount: number }).importedLogCount = 42;

    const workflow = createBackupWorkflow({ repositories: repos });

    const result = await workflow.commitRestore(preview);

    expect(result.importedLogCount).toBe(42);
  });
});
