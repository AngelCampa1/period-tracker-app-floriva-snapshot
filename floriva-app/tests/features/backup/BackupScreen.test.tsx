import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';
import { createBackupPackage } from '@/src/features/backup/backupPackage';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import {
  createBackupReadyRestorePreview,
  qaBackupReadySelectedFileLabel,
} from '@/src/testing/qaFixtures';

jest.setTimeout(45000);

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockIsSharingAvailableAsync = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockRehydrateAppShell = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockRefreshBilling = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockClearBiometricLock = jest.fn();
const mockReportRecoverableRuntimeDiagnostic = jest.fn();
const mockLocalizedStrings: Record<string, string> = {
  'backup.screen.backLabel': 'Back to data controls',
  'backup.screen.backToWelcome': 'Back to welcome',
  'backup.screen.eyebrow': 'Backup',
  'backup.screen.title': 'Backup and restore',
  'backup.screen.description':
    'Create an encrypted backup or restore a Floriva file that already lives on this device.',
  'backup.screen.statusCardTitle': 'Backup ready',
  'backup.screen.errorCardTitle': 'Backup needs attention',
  'backup.export.title': 'Export backup',
  'backup.export.description':
    'Choose a passphrase, create the backup file, and move it off this device when you are ready.',
  'backup.export.passphraseLabel': 'Backup passphrase',
  'backup.export.confirmPassphraseLabel': 'Confirm backup passphrase',
  'backup.export.exportButton': 'Create backup file',
  'backup.export.mismatchError': 'Enter the same backup passphrase twice before creating the file.',
  'backup.export.passphraseLengthError':
    'Use at least 12 characters for this backup passphrase.',
  'backup.export.status': 'Encrypted backup ready to move off this device.',
  'backup.export.genericError': 'Backup export could not finish.',
  'backup.export.unavailableError':
    'Backup needs a newer Floriva build on this device before it can finish here.',
  'backup.export.storageUnavailableError':
    'Floriva could not access local document storage on this device.',
  'backup.export.localOnlyNote':
    'Floriva encrypts the file locally before you move it anywhere else.',
  'backup.export.passphraseSafetyNote':
    'Floriva cannot recover this passphrase. Store it somewhere safe.',
  'backup.restore.title': 'Restore backup',
  'backup.restore.description':
    'Choose a Floriva backup file from this device, enter its passphrase, and preview the restore before you commit it.',
  'backup.restore.passphraseLabel': 'Restore passphrase',
  'backup.restore.chooseFileButton': 'Choose backup file',
  'backup.restore.previewButton': 'Preview restore',
  'backup.restore.confirmButton': 'Restore this backup',
  'backup.restore.continueButton': 'Continue',
  'backup.restore.selectedFilePrefix': 'Selected backup file:',
  'backup.restore.missingFileError': 'Choose a Floriva backup file before previewing restore.',
  'backup.restore.missingPassphraseError':
    'Choose a backup file and enter its passphrase before previewing restore.',
  'backup.restore.fileOpenError': 'Floriva could not open that file.',
  'backup.restore.genericPreviewError': 'Floriva could not preview that restore.',
  'backup.restore.wrongPassphraseError':
    'That passphrase did not unlock this backup.',
  'backup.restore.unsupportedFormatError':
    'This backup needs a newer Floriva build before it can be restored here.',
  'backup.restore.invalidFileError':
    'Floriva could not read that backup. Choose a .floriva file exported from Floriva.',
  'backup.restore.status': 'Backup restored on this device.',
  'backup.restore.statusWithFollowUp':
    'Backup restored on this device. Re-enable biometric lock and restore purchases if needed.',
  'backup.restore.reloadError':
    'Backup data was restored locally, but Floriva needs to reload it before you continue. Close and reopen the app.',
  'backup.restore.commitError':
    'Floriva could not finish restoring this backup. Your current data was not replaced.',
  'backup.restore.selectedFileDefault': 'Selected Floriva backup',
  'backup.restore.biometricsNote':
    'Biometric lock will stay off until you re-enable it on this device.',
  'backup.restore.billingNote':
    'Restore purchases after restoring backup if your billing state changed.',
  'backup.restore.noFileSelected': 'No backup file selected yet.',
  'backup.restore.previewTitle': 'Restore preview',
  'backup.restore.previewDescription':
    'Restoring replaces all current Floriva data on this device with the backup contents.',
  'backup.restore.logsToRestore': 'Logs to restore',
  'backup.restore.importSessions': 'Import sessions',
  'backup.restore.trackedPeriodDays': 'Tracked period days',
  'backup.restore.exportedOn': 'Exported on',
  'backup.restore.logDateRange': 'Log date range',
  'backup.restore.noLogsInBackup': 'No logs',
  'backup.restore.reminders': 'Reminders',
  'backup.restore.cycleProfile': 'Cycle setup',
  'backup.restore.cycleProfileReady': 'Included',
  'backup.restore.cycleProfileMissing': 'Not included',
  'backup.restore.replaceDataNote':
    'Review this carefully. Confirming will replace the current local data on this device.',
  'backup.restore.acknowledgeReplaceButton':
    'I understand this replaces current data',
  'backup.restore.chooseDifferentFileButton': 'Choose a different file',
};
const mockFileSystemModule = {
  documentDirectory: 'file:///documents/' as string | null,
};
let mockSharingModuleUnavailable = false;
let mockBackupWorkflowModuleUnavailable = false;
let mockBackupWorkflowUnexpectedError: Error | null = null;
let mockPendingEntryRoute: string | undefined;
type BackupPreviewOverride = (input: {
  serializedPackage: string;
  passphrase: string;
}) => Promise<unknown>;
type BackupCommitOverride = (preview: unknown) => Promise<unknown>;
let mockPreviewRestoreOverride:
  | BackupPreviewOverride
  | null = null;
let mockCommitRestoreOverride:
  | BackupCommitOverride
  | null = null;
const mockResolveDevLaunchPreset = jest.fn();

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;
const asyncWait = { timeout: 15000 };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('expo-file-system/legacy', () => ({
  get documentDirectory() {
    return mockFileSystemModule.documentDirectory;
  },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => {
    if (mockSharingModuleUnavailable) {
      throw new Error('expo-sharing module unavailable');
    }

    return mockIsSharingAvailableAsync(...args);
  },
  shareAsync: (...args: unknown[]) => {
    if (mockSharingModuleUnavailable) {
      throw new Error('expo-sharing module unavailable');
    }

    return mockShareAsync(...args);
  },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('@/src/features/backup/model', () => {
  const actual = jest.requireActual('@/src/features/backup/model');

  return {
    ...actual,
    createBackupWorkflow: (...args: Parameters<typeof actual.createBackupWorkflow>) => {
      if (mockBackupWorkflowModuleUnavailable) {
        throw new Error('expo-crypto unavailable');
      }

      if (mockBackupWorkflowUnexpectedError) {
        throw mockBackupWorkflowUnexpectedError;
      }

      const workflow = actual.createBackupWorkflow(...args);

      return {
        ...workflow,
        previewRestore: (input: { serializedPackage: string; passphrase: string }) =>
          mockPreviewRestoreOverride
            ? mockPreviewRestoreOverride(input)
            : workflow.previewRestore(input),
        commitRestore: (preview: unknown) =>
          mockCommitRestoreOverride
            ? mockCommitRestoreOverride(preview)
            : workflow.commitRestore(preview),
      };
    },
  };
});

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    if (!mockCurrentHarness) {
      throw new Error('BackupScreen test harness has not been initialized');
    }

    return {
      repositories: mockCurrentHarness.repositories,
    };
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    privacyPreference: {
      diagnosticsConsentEnabled: true,
    },
    rehydrateFromStorage: (...args: unknown[]) => mockRehydrateAppShell(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    state: {
      pendingEntryRoute: mockPendingEntryRoute,
    },
  }),
}));

jest.mock('@/src/lib/diagnostics/runtimeDiagnostics', () => ({
  reportRecoverableRuntimeDiagnostic: (...args: unknown[]) =>
    mockReportRecoverableRuntimeDiagnostic(...args),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: jest.fn(),
    t: (key: string) => mockLocalizedStrings[key] ?? key,
  }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => ({
    refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
  }),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  clearBiometricLock: (...args: unknown[]) => mockClearBiometricLock(...args),
}));

jest.mock('@/src/testing/devLaunchPreset', () => ({
  resolveDevLaunchPreset: (...args: unknown[]) => mockResolveDevLaunchPreset(...args),
}));

// eslint-disable-next-line import/first
import { BackupScreen } from '@/src/features/backup/screens/BackupScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('BackupScreen', () => {
  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });

    return {
      promise,
      reject,
      resolve,
    };
  }

  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockWriteAsStringAsync.mockReset();
    mockReadAsStringAsync.mockReset();
    mockShareAsync.mockReset();
    mockIsSharingAvailableAsync.mockReset();
    mockGetDocumentAsync.mockReset();
    mockRehydrateAppShell.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockRefreshBilling.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockClearBiometricLock.mockReset();
    mockReportRecoverableRuntimeDiagnostic.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockFileSystemModule.documentDirectory = 'file:///documents/';
    mockSharingModuleUnavailable = false;
    mockBackupWorkflowModuleUnavailable = false;
    mockBackupWorkflowUnexpectedError = null;
    mockPendingEntryRoute = undefined;
    mockPreviewRestoreOverride = null;
    mockCommitRestoreOverride = null;
    mockResolveDevLaunchPreset.mockReset();
    mockResolveDevLaunchPreset.mockReturnValue(null);

    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockIsSharingAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockRehydrateAppShell.mockResolvedValue(undefined);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockRefreshBilling.mockResolvedValue(undefined);
    mockClearBiometricLock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('creates an encrypted backup file and opens the share handoff flow', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="full" />);

    expect(screen.getByTestId(testIds.backup.exportPassphraseInput).props.secureTextEntry).toBe(
      true,
    );
    expect(screen.getByTestId(testIds.backup.exportPassphraseInput).props.autoCapitalize).toBe(
      'none',
    );
    expect(screen.getByTestId(testIds.backup.exportPassphraseInput).props.autoCorrect).toBe(
      false,
    );

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Encrypted backup ready to move off this device.'),
      ).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.statusCard)).toBeTruthy();
    }, asyncWait);
    expect(screen.getByTestId(testIds.backup.exportPassphraseInput).props.value).toBe('');
    expect(screen.getByTestId(testIds.backup.exportPassphraseConfirmInput).props.value).toBe('');
  });

  it('exposes a stable back action in restore-only mode', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(
      <BackupScreen
        mode="restore-only"
        backHref="/welcome"
        backLabel="Back to welcome"
      />,
    );

    fireEvent.press(screen.getByTestId(testIds.backup.backButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    }, asyncWait);
  });

  it('uses stack back navigation for the top back action when history exists', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockCanGoBack.mockReturnValue(true);

    render(<BackupScreen mode="full" />);

    fireEvent.press(screen.getByTestId(testIds.backup.backButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    }, asyncWait);
  });

  it('clears the pending post-onboarding backup handoff when opened from first-run setup', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockPendingEntryRoute = '/backup';

    render(<BackupScreen mode="full" />);

    await waitFor(() => {
      expect(mockClearPendingEntryRoute).toHaveBeenCalledTimes(1);
    }, asyncWait);
  });

  it('shows an export validation error when the backup passphrases do not match', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'second-passphrase',
    );
    expect(
      screen.getByText('Enter the same backup passphrase twice before creating the file.'),
    ).toBeTruthy();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  it('falls back to the generic export error when the backup workflow throws an unexpected error', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockBackupWorkflowUnexpectedError = new Error('Unexpected workflow failure');

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(screen.getByText('Backup export could not finish.')).toBeTruthy();
    }, asyncWait);
  });

  it('keeps the export CTA disabled until matching passphrases are entered', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="full" />);

    expect(
      screen.getByText('Floriva encrypts the file locally before you move it anywhere else.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Enter the same backup passphrase twice before creating the file.'),
    ).toBeNull();

    expect(screen.getByTestId(testIds.backup.exportButton).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByTestId(testIds.backup.exportPassphraseInput), 'first-pass');

    expect(screen.getByTestId(testIds.backup.exportButton).props.accessibilityState.disabled).toBe(
      true,
    );
    expect(
      screen.getByText('Use at least 12 characters for this backup passphrase.'),
    ).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'strong-passphrase',
    );

    expect(screen.getByTestId(testIds.backup.exportButton).props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'strong-passphrase',
    );

    expect(screen.getByTestId(testIds.backup.exportButton).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('creates a local backup file even when share handoff is unavailable on the device', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockIsSharingAvailableAsync.mockResolvedValue(false);

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).not.toHaveBeenCalled();
      expect(
        screen.getByText('Encrypted backup ready to move off this device.'),
      ).toBeTruthy();
    }, asyncWait);
    await expect(mockCurrentHarness.repositories.backupEvents.listEvents()).resolves.toEqual([
      expect.objectContaining({
        action: 'exported',
        detail: 'backup_exported',
      }),
    ]);
  });

  it('still completes export when expo-sharing cannot be loaded on the device', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockSharingModuleUnavailable = true;

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).not.toHaveBeenCalled();
      expect(
        screen.getByText('Encrypted backup ready to move off this device.'),
      ).toBeTruthy();
    }, asyncWait);
  });

  it('does not record an exported backup event when the share handoff fails', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockShareAsync.mockRejectedValueOnce(new Error('share sheet failed'));

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Backup export could not finish.')).toBeTruthy();
    }, asyncWait);
    await expect(mockCurrentHarness.repositories.backupEvents.listEvents()).resolves.toEqual([]);
  });

  it('shows an export error when local document storage is unavailable', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockFileSystemModule.documentDirectory = null;

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(
        screen.getByText('Floriva could not access local document storage on this device.'),
      ).toBeTruthy();
    }, asyncWait);
  });

  it('falls back to the generic export error when the file write throws a non-Error value', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockWriteAsStringAsync.mockRejectedValueOnce('disk full');

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.errorCard)).toBeTruthy();
      expect(screen.getByText('Backup export could not finish.')).toBeTruthy();
      expect(mockShareAsync).not.toHaveBeenCalled();
    }, asyncWait);
    await expect(mockCurrentHarness.repositories.backupEvents.listEvents()).resolves.toEqual([]);
  });

  it('shows backup guidance instead of crashing when the native backup modules are unavailable', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockBackupWorkflowModuleUnavailable = true;

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(
        screen.getByText('Backup needs a newer Floriva build on this device before it can finish here.'),
      ).toBeTruthy();
      expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    }, asyncWait);
  });

  it('surfaces ordinary workflow errors instead of masking them as missing native support', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error('Disk write exploded'));

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.changeText(
      screen.getByTestId(testIds.backup.exportPassphraseConfirmInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.exportButton));

    await waitFor(() => {
      expect(screen.getByText('Backup export could not finish.')).toBeTruthy();
      expect(
        screen.queryByText('Backup needs a newer Floriva build on this device before it can finish here.'),
      ).toBeNull();
    }, asyncWait);
  });

  it('shows restore validation guidance before previewing a file', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="full" />);

    expect(
      screen.getByText('Choose a backup file and enter its passphrase before previewing restore.'),
    ).toBeTruthy();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue('not-a-real-backup');

    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.selectedFileLabel)).toBeTruthy();
      expect(screen.getByText('Selected backup file: floriva-backup.floriva')).toBeTruthy();
    });

    expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
      { disabled: true },
    );
    expect(
      screen.getByText('Choose a backup file and enter its passphrase before previewing restore.'),
    ).toBeTruthy();
  });

  it('shows the missing-passphrase guidance when a restore file is selected but no passphrase is entered', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue('not-a-real-backup');

    render(<BackupScreen mode="full" />);

    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText('Choose a backup file and enter its passphrase before previewing restore.'),
    ).toBeTruthy();
  });

  it('ignores a canceled restore file picker without trying to read a file', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockGetDocumentAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    render(<BackupScreen mode="restore-only" />);

    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    });
  });

  it('shows an explicit way back to onboarding when restore-only mode is used from first run', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(
      <BackupScreen
        backHref="/welcome"
        backLabel="Back to welcome"
        mode="restore-only"
      />,
    );

    fireEvent.press(screen.getByText('Back to welcome'));

    expect(mockReplace).toHaveBeenCalledWith('/welcome');
  });

  it('uses restore-specific screen framing in restore-only mode without repeating the generic backup hub copy', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="restore-only" />);

    await screen.findByText('Restore backup');

    expect(screen.queryByText('Backup and restore')).toBeNull();
    expect(
      screen.queryByText(
        'Create an encrypted backup or restore a Floriva file that already lives on this device.',
      ),
    ).toBeNull();
  });

  it('uses export-specific screen framing in export-only mode without repeating the generic backup hub copy', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="export-only" />);

    await screen.findByText('Export backup');

    expect(screen.queryByText('Backup and restore')).toBeNull();
    expect(
      screen.queryByText(
        'Create an encrypted backup or restore a Floriva file that already lives on this device.',
      ),
    ).toBeNull();
  });

  it('hydrates a seeded restore preview for the backup-ready dev preset', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockResolveDevLaunchPreset.mockReturnValue('backup-ready');

    render(<BackupScreen mode="restore-only" />);

    await screen.findByText('Restore preview');

    expect(screen.getByTestId(testIds.backup.selectedFileLabel)).toHaveTextContent(
      `Selected backup file: ${qaBackupReadySelectedFileLabel}`,
    );
    expect(screen.getByText('Logs to restore')).toBeTruthy();
    expect(screen.getByText('Exported on')).toBeTruthy();
    expect(screen.getByText('Log date range')).toBeTruthy();
    expect(screen.getByTestId(testIds.backup.replaceDataNote)).toBeTruthy();
    expect(
      screen.getByText(String(createBackupReadyRestorePreview(getLocalTodayLogDate()).importedLogCount)),
    ).toBeTruthy();
    expect(screen.getByTestId(testIds.backup.confirmRestoreButton)).toBeTruthy();
  });

  it('UL-12: keeps the restore preview off the export-only screen', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockResolveDevLaunchPreset.mockReturnValue('backup-ready');

    render(<BackupScreen mode="export-only" />);

    await screen.findByTestId(testIds.backup.screen);

    // The seeded restore preview must not scroll into view under an
    // "Export backup" title — restore lives on its own route.
    expect(screen.queryByText('Restore preview')).toBeNull();
    expect(screen.queryByTestId(testIds.backup.previewCard)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.confirmRestoreButton)).toBeNull();
  });

  it('UL-11: presents the restore consent as a visible checkbox that gates the destructive confirm', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockResolveDevLaunchPreset.mockReturnValue('backup-ready');

    render(<BackupScreen mode="restore-only" />);

    await screen.findByText('Restore preview');

    const consent = screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton);
    // Checkbox semantics: unchecked by default...
    expect(consent.props.accessibilityState.checked).toBe(false);
    expect(
      screen.getByTestId(testIds.backup.confirmRestoreButton).props.accessibilityState,
    ).toEqual({ disabled: true });

    fireEvent.press(consent);

    // ...checked after tapping, which unlocks the confirm button.
    expect(consent.props.accessibilityState.checked).toBe(true);
    expect(
      screen.getByTestId(testIds.backup.confirmRestoreButton).props.accessibilityState,
    ).toEqual({ disabled: false });
  });

  it('hides restore inputs after preview while keeping a file reset path available', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockResolveDevLaunchPreset.mockReturnValue('backup-ready');

    render(<BackupScreen mode="restore-only" />);

    await screen.findByText('Restore preview');

    expect(screen.queryByTestId(testIds.backup.previewRestoreButton)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.chooseRestoreFileButton)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.restorePassphraseInput)).toBeNull();
    expect(screen.getByTestId(testIds.backup.resetRestoreSelectionButton)).toBeTruthy();
    expect(
      screen.queryByText('Choose a backup file and enter its passphrase before previewing restore.'),
    ).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.backup.resetRestoreSelectionButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.restorePassphraseInput).props.value).toBe('');
      expect(screen.getByText('No backup file selected yet.')).toBeTruthy();
    });
  });

  it('shows the local-only reassurance before export passphrases diverge', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    render(<BackupScreen mode="export-only" />);

    await screen.findByText('Export backup');

    expect(
      screen.getByText('Floriva encrypts the file locally before you move it anywhere else.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Floriva cannot recover this passphrase. Store it somewhere safe.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Enter the same backup passphrase twice before creating the file.'),
    ).toBeNull();
  });

  it('shows a file-open error when the restore picker flow fails', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    mockGetDocumentAsync
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://old-backup.floriva', name: 'old-backup.floriva' }],
      })
      .mockRejectedValueOnce(new Error('Picker crashed'));
    mockReadAsStringAsync.mockResolvedValueOnce('old-backup-content');

    render(<BackupScreen mode="restore-only" />);

    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Selected backup file: old-backup.floriva')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );

    expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
      { disabled: false },
    );

    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(screen.getByText('Floriva could not open that file.')).toBeTruthy();
      expect(screen.queryByText('Picker crashed')).toBeNull();
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: true },
      );
    });

  });

  it('shows a restore preview error when the passphrase is wrong', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'correct-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(screen.getByTestId(testIds.backup.restorePassphraseInput), 'wrong-passphrase');
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Selected backup file: floriva-backup.floriva')).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByText('That passphrase did not unlock this backup.')).toBeTruthy();
      expect(screen.queryByText('Backup passphrase did not unlock this file.')).toBeNull();
    }, asyncWait);
  });

  it('maps invalid backup files to safe restore preview copy', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://notes.txt', name: 'notes.txt' }],
    });
    mockReadAsStringAsync.mockResolvedValue('not-a-floriva-backup');

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Floriva could not read that backup. Choose a .floriva file exported from Floriva.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Floriva could not read that backup file.')).toBeNull();
    }, asyncWait);
  });

  it('disables restore preview while the preview is in flight', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });
    const deferred = createDeferred<{
      importedLogCount: number;
      importSessionCount: number;
      periodStartCount: number;
      exportedDate: string;
      firstLogDate?: string;
      lastLogDate?: string;
      reminderCount: number;
      hasCycleProfile: boolean;
      requiresBillingRevalidation: boolean;
      willDisableBiometrics: boolean;
      snapshot: Awaited<ReturnType<typeof mockCurrentHarness.repositories.backupData.exportSnapshot>>;
    }>();

    mockPreviewRestoreOverride = jest.fn(() => deferred.promise);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(mockPreviewRestoreOverride).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: true },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    expect(mockPreviewRestoreOverride).toHaveBeenCalledTimes(1);

    deferred.resolve({
      importedLogCount: 1,
      importSessionCount: 0,
      periodStartCount: 1,
      exportedDate: '2026-04-10',
      firstLogDate: '2026-04-09',
      lastLogDate: '2026-04-09',
      reminderCount: 0,
      hasCycleProfile: true,
      requiresBillingRevalidation: false,
      willDisableBiometrics: false,
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);
  });

  it('previews and restores a backup file, then refreshes app shell and billing state', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.appPreferences.savePreferences({
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: false,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      showFertilityEstimates: true,
    });
    await mockCurrentHarness.repositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'annual',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
      expiresAt: '2027-05-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T10:00:00.000Z',
    });
    await mockCurrentHarness.repositories.userProfile.saveProfile({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    await mockCurrentHarness.repositories.privacyPreferences.savePreference({
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'restore-log-1',
      logDate: '2026-04-09',
      bleeding: 'medium',
      symptoms: ['cramps'],
      notes: 'Restored entry.',
    });

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(<BackupScreen mode="full" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Selected backup file: floriva-backup.floriva')).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    expect(screen.getByText('Logs to restore')).toBeTruthy();
    expect(screen.getByText('Import sessions')).toBeTruthy();
    expect(screen.getByText('Tracked period days')).toBeTruthy();
    expect(screen.getByTestId(testIds.backup.biometricsNote)).toBeTruthy();

    expect(screen.getByTestId(testIds.backup.confirmRestoreButton).props.accessibilityState).toEqual(
      { disabled: true },
    );
    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    expect(screen.getByTestId(testIds.backup.confirmRestoreButton).props.accessibilityState).toEqual(
      { disabled: false },
    );
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Backup restored on this device. Re-enable biometric lock and restore purchases if needed.',
        ),
      ).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.continueAfterRestoreButton)).toBeTruthy();
      expect(mockRehydrateAppShell).toHaveBeenCalledTimes(1);
      expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
      expect(mockRefreshBilling).toHaveBeenCalledTimes(1);
      expect(mockClearBiometricLock).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(testIds.backup.continueAfterRestoreButton));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('hides the restore form and preview card after a successful restore', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.continueAfterRestoreButton)).toBeTruthy();
    });

    expect(screen.queryByTestId(testIds.backup.previewCard)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.chooseRestoreFileButton)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.restorePassphraseInput)).toBeNull();
    expect(screen.queryByTestId(testIds.backup.previewRestoreButton)).toBeNull();
  });

  it('still finishes restore when follow-up refresh work fails after data is committed', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);
    mockRefreshBilling.mockRejectedValueOnce(new Error('Billing refresh failed'));

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Selected backup file: floriva-backup.floriva')).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.previewRestoreButton).props.accessibilityState).toEqual(
        { disabled: false },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(screen.getByText('Backup restored on this device. Re-enable biometric lock and restore purchases if needed.')).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.continueAfterRestoreButton)).toBeTruthy();
      expect(mockRehydrateAppShell).toHaveBeenCalledTimes(1);
      expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
      expect(mockRefreshBilling).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(testIds.backup.continueAfterRestoreButton));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('returns restore-only onboarding users to the onboarding paywall after a successful restore', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(
      <BackupScreen
        backHref="/start-path"
        backLabel="Back to path choice"
        mode="restore-only"
        resultHref="/paywall"
      />,
    );

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(screen.getByText('Backup restored on this device.')).toBeTruthy();
      expect(screen.getByTestId(testIds.backup.continueAfterRestoreButton)).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(testIds.backup.continueAfterRestoreButton));

    expect(mockReplace).toHaveBeenCalledWith('/paywall');
  });

  it('disables restore confirmation while the restore commit is in flight', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });
    const deferred = createDeferred<{ restoredSnapshot: { billingSnapshot: { accessState: 'free' } } }>();

    mockCommitRestoreOverride = jest.fn(() => deferred.promise);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(
      <BackupScreen
        backHref="/start-path"
        backLabel="Back to path choice"
        mode="restore-only"
        resultHref="/paywall"
      />,
    );

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(mockCommitRestoreOverride).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testIds.backup.confirmRestoreButton).props.accessibilityState).toEqual(
        { disabled: true },
      );
    });

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    expect(mockCommitRestoreOverride).toHaveBeenCalledTimes(1);

    deferred.resolve({
      restoredSnapshot: {
        billingSnapshot: {
          accessState: 'free',
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.continueAfterRestoreButton)).toBeTruthy();
    }, asyncWait);
  });

  it('keeps pre-commit restore failures separate from restored-locally reload guidance', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockCommitRestoreOverride = jest.fn(async () => {
      throw new Error('Restore transaction failed');
    });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(mockCommitRestoreOverride).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(
          'Floriva could not finish restoring this backup. Your current data was not replaced.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          'Backup data was restored locally, but Floriva needs to reload it before you continue. Close and reopen the app.',
        ),
      ).toBeNull();
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);
  });

  it('keeps the user on restore when app-shell rehydration fails after the restore commit', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    const serializedPackage = await createBackupPackage({
      snapshot: await mockCurrentHarness.repositories.backupData.exportSnapshot(),
      passphrase: 'privacy-first-passphrase',
    });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://floriva-backup.floriva', name: 'floriva-backup.floriva' }],
    });
    mockReadAsStringAsync.mockResolvedValue(serializedPackage);
    mockRehydrateAppShell.mockRejectedValueOnce(new Error('Shell refresh failed'));

    render(<BackupScreen mode="restore-only" />);

    fireEvent.changeText(
      screen.getByTestId(testIds.backup.restorePassphraseInput),
      'privacy-first-passphrase',
    );
    fireEvent.press(screen.getByTestId(testIds.backup.chooseRestoreFileButton));

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(testIds.backup.previewRestoreButton));

    await waitFor(() => {
      expect(screen.getByTestId(testIds.backup.previewCard)).toBeTruthy();
    }, asyncWait);

    fireEvent.press(screen.getByTestId(testIds.backup.acknowledgeRestoreReplacementButton));
    fireEvent.press(screen.getByTestId(testIds.backup.confirmRestoreButton));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Backup data was restored locally, but Floriva needs to reload it before you continue. Close and reopen the app.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Shell refresh failed')).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
