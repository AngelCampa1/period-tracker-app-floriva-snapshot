import { useEffect, useMemo, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import type { DomainRepositories } from '@/src/db/contracts';
import { BackupPackageError } from '@/src/features/backup/backupPackage';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { useBilling } from '@/src/features/billing/BillingProvider';
import { InputField } from '@/src/features/onboarding/screens/shared';
import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';
import { clearBiometricLock } from '@/src/lib/security/biometricLock';
import {
  formatLocalizedDate,
  formatLocalizedMonthDay,
  formatLocalizedPredictionRange,
} from '@/src/localization/formatters';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import {
  createBackupReadyRestorePreview,
  qaBackupReadySelectedFileLabel,
} from '@/src/testing/qaFixtures';
import { resolveQaFixtureToday } from '@/src/testing/qaFixtureClock';
import { resolveDevLaunchPreset } from '@/src/testing/devLaunchPreset';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type {
  BackupRestorePreview,
  BillingSnapshot,
  SupportedLocale,
} from '@/src/types/domain';

type BackupScreenProps = {
  mode: 'full' | 'export-only' | 'restore-only';
  backHref?: Href;
  backLabel?: string;
  resultHref?: Href;
};

function buildTargetFileUri(fileName: string) {
  if (!FileSystem.documentDirectory) {
    throw new Error(backupDocumentStorageUnavailableMessage);
  }

  return `${FileSystem.documentDirectory}${fileName}`;
}

type BackupWorkflow = {
  createExportPackage: (input: { passphrase: string }) => Promise<{
    exportedAt: string;
    fileName: string;
    serializedPackage: string;
  }>;
  recordExportEvent: (exportedAt: string) => Promise<void>;
  previewRestore: (input: {
    serializedPackage: string;
    passphrase: string;
  }) => Promise<BackupRestorePreview>;
  commitRestore: (preview: BackupRestorePreview) => Promise<{
    restoredSnapshot: {
      billingSnapshot: BillingSnapshot;
    };
    biometricRearmRequired: boolean;
    billingRevalidationRequired: boolean;
  }>;
};

type BackupWorkflowModule = {
  createBackupWorkflow: (input: { repositories: DomainRepositories }) => BackupWorkflow;
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string) => Promise<void>;
};

const backupUnavailableMessage =
  'Backup is not available on this version of Floriva. Please update the app and try again.';
const backupDocumentStorageUnavailableMessage =
  'Floriva could not access storage on this device.';
const backupMinimumPassphraseLength = 12;

async function getBackupWorkflow(repositories: DomainRepositories) {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createBackupWorkflow } =
      require('../model') as BackupWorkflowModule;
    /* eslint-enable @typescript-eslint/no-require-imports */

    return createBackupWorkflow({ repositories });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('expo-crypto unavailable') ||
        error.message.includes('Cannot find module') ||
        error.message.includes('Cannot resolve'))
    ) {
      throw new Error(backupUnavailableMessage);
    }

    throw error;
  }
}

async function tryShareBackupFile(targetUri: string) {
  let sharing: SharingModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharing = require('expo-sharing') as SharingModule;
  } catch {
    return;
  }

  try {
    if (!(await sharing.isAvailableAsync())) {
      return;
    }
  } catch {
    return;
  }

  await sharing.shareAsync(targetUri);
}

function buildDevLaunchBackupSeed() {
  if (resolveDevLaunchPreset() !== 'backup-ready') {
    return null;
  }

  return {
    restorePreview: createBackupReadyRestorePreview(resolveQaFixtureToday()),
    selectedRestoreFileLabel: qaBackupReadySelectedFileLabel,
  };
}

function formatRestoreDateRange(
  preview: BackupRestorePreview,
  noLogsLabel: string,
  locale: SupportedLocale,
) {
  if (!preview.firstLogDate || !preview.lastLogDate) {
    return noLogsLabel;
  }

  if (preview.firstLogDate === preview.lastLogDate) {
    return formatLocalizedMonthDay(preview.firstLogDate, locale);
  }

  return formatLocalizedPredictionRange(
    preview.firstLogDate,
    preview.lastLogDate,
    locale,
  );
}

function isPassphraseStrongEnough(passphrase: string) {
  return passphrase.trim().length >= backupMinimumPassphraseLength;
}

async function clearBiometricLockBestEffort() {
  try {
    await clearBiometricLock();
  } catch {
    // Restored preferences disable biometric lock; the next settings save can repair SecureStore.
  }
}

function PreviewDetailRow({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  tone?: 'accent' | 'default';
  value: string;
}) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.detailRow, tone === 'accent' ? styles.detailRowAccent : null]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, tone === 'accent' ? styles.detailValueAccent : null]}>
        {value}
      </Text>
    </View>
  );
}

export function BackupScreen({
  backHref,
  backLabel,
  mode,
  resultHref = '/',
}: BackupScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { resolvedLocale, t } = useLocalization();
  const { repositories } = useDatabase();
  const { clearPendingEntryRoute, rehydrateFromStorage, refreshReminderSchedules, state } =
    useAppShell();
  const { refreshBilling } = useBilling();
  const devLaunchSeed = useMemo(() => buildDevLaunchBackupSeed(), []);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<string | null>(
    null,
  );
  const [selectedRestoreFileLabel, setSelectedRestoreFileLabel] = useState<
    string | null
  >(devLaunchSeed?.selectedRestoreFileLabel ?? null);
  const [restorePreview, setRestorePreview] =
    useState<BackupRestorePreview | null>(devLaunchSeed?.restorePreview ?? null);
  const [pendingRestoreNavigationHref, setPendingRestoreNavigationHref] =
    useState<Href | null>(null);
  const [restoreReplacementAcknowledged, setRestoreReplacementAcknowledged] =
    useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewingRestore, setIsPreviewingRestore] = useState(false);
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const isPreviewingRestoreRef = useRef(false);
  const isConfirmingRestoreRef = useRef(false);
  const showExportMismatchMessage =
    exportPassphrase.trim().length > 0 &&
    exportPassphraseConfirm.trim().length > 0 &&
    exportPassphrase !== exportPassphraseConfirm;
  const showExportLengthMessage =
    exportPassphrase.trim().length > 0 &&
    !isPassphraseStrongEnough(exportPassphrase);
  const exportReady =
    isPassphraseStrongEnough(exportPassphrase) &&
    isPassphraseStrongEnough(exportPassphraseConfirm) &&
    exportPassphrase === exportPassphraseConfirm;
  const restorePreviewReady =
    Boolean(selectedRestoreFile) && restorePassphrase.trim().length > 0;
  const backupExportErrorMessage = t('backup.export.genericError');
  const backupOpenFileErrorMessage = t('backup.restore.fileOpenError');
  const restorePreviewErrorMessage = (error: unknown) => {
    if (error instanceof BackupPackageError && error.code === 'wrong_passphrase') {
      return t('backup.restore.wrongPassphraseError');
    }

    if (error instanceof BackupPackageError && error.code === 'unsupported_backup_format') {
      return t('backup.restore.unsupportedFormatError');
    }

    if (error instanceof BackupPackageError && error.code === 'invalid_backup_file') {
      return t('backup.restore.invalidFileError');
    }

    return t('backup.restore.genericPreviewError');
  };
  const screenTitle =
    mode === 'export-only'
      ? t('backup.export.title')
      : mode === 'restore-only'
        ? t('backup.restore.title')
        : t('backup.screen.title');
  const screenDescription =
    mode === 'export-only'
      ? t('backup.export.description')
      : mode === 'restore-only'
        ? t('backup.restore.description')
        : t('backup.screen.description');

  useEffect(() => {
    if (
      state.pendingEntryRoute !== '/backup/restore' &&
      state.pendingEntryRoute !== '/backup'
    ) {
      return;
    }

    void clearPendingEntryRoute();
  }, [clearPendingEntryRoute, state.pendingEntryRoute]);

  async function exportBackupPackage() {
    try {
      const workflow = await getBackupWorkflow(repositories);
      const { exportedAt, fileName, serializedPackage } =
        await workflow.createExportPackage({
          passphrase: exportPassphrase,
        });
      const targetUri = buildTargetFileUri(fileName);

      await FileSystem.writeAsStringAsync(targetUri, serializedPackage);
      await tryShareBackupFile(targetUri);
      await workflow.recordExportEvent(exportedAt);

      setStatusMessage(t('backup.export.status'));
      setErrorMessage(null);
      setExportPassphrase('');
      setExportPassphraseConfirm('');
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'backup_export_failed',
        error,
      });
      setErrorMessage(
        error instanceof Error &&
          (error.message === backupUnavailableMessage ||
            error.message === backupDocumentStorageUnavailableMessage)
          ? error.message === backupUnavailableMessage
            ? t('backup.export.unavailableError')
            : t('backup.export.storageUnavailableError')
          : backupExportErrorMessage,
      );
      setStatusMessage(null);
    }
  }

  async function chooseRestoreFile() {
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled || selection.assets.length === 0) {
        return;
      }

      const fileContents = await FileSystem.readAsStringAsync(
        selection.assets[0].uri,
      );
      setSelectedRestoreFile(fileContents);
      setSelectedRestoreFileLabel(
        selection.assets[0].name ?? t('backup.restore.selectedFileDefault'),
      );
      setRestorePreview(null);
      setRestoreReplacementAcknowledged(false);
      setPendingRestoreNavigationHref(null);
      setErrorMessage(null);
      setStatusMessage(null);
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'backup_restore_file_selection_failed',
        error,
      });
      setSelectedRestoreFile(null);
      setSelectedRestoreFileLabel(null);
      setRestorePreview(null);
      setPendingRestoreNavigationHref(null);
      setErrorMessage(backupOpenFileErrorMessage);
      setStatusMessage(null);
    }
  }

  async function previewRestoreFile() {
    if (
      !selectedRestoreFile ||
      restorePassphrase.trim().length === 0 ||
      isPreviewingRestoreRef.current
    ) {
      return;
    }

    isPreviewingRestoreRef.current = true;
    setIsPreviewingRestore(true);

    try {
      const workflow = await getBackupWorkflow(repositories);
      const preview = await workflow.previewRestore({
        serializedPackage: selectedRestoreFile!,
        passphrase: restorePassphrase!,
      });

      setRestorePreview(preview);
      setRestoreReplacementAcknowledged(false);
      setPendingRestoreNavigationHref(null);
      setErrorMessage(null);
      setStatusMessage(null);
      setRestorePassphrase('');
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'backup_restore_preview_failed',
        error,
      });
      setRestorePreview(null);
      setRestoreReplacementAcknowledged(false);
      setPendingRestoreNavigationHref(null);
      setErrorMessage(restorePreviewErrorMessage(error));
      setStatusMessage(null);
    } finally {
      isPreviewingRestoreRef.current = false;
      setIsPreviewingRestore(false);
    }
  }

  async function confirmRestore() {
    if (
      !restorePreview ||
      !restoreReplacementAcknowledged ||
      isConfirmingRestoreRef.current
    ) {
      return;
    }

    isConfirmingRestoreRef.current = true;
    setIsConfirmingRestore(true);

    try {
      const workflow = await getBackupWorkflow(repositories);
      const restoreResult = await workflow.commitRestore(restorePreview!);
      await clearBiometricLockBestEffort();
      const [rehydrateResult, reminderResult, billingResult] =
        await Promise.allSettled([
          rehydrateFromStorage(),
          refreshReminderSchedules(),
          refreshBilling(),
        ]);

      if (rehydrateResult.status === 'rejected') {
        setErrorMessage(t('backup.restore.reloadError'));
        setPendingRestoreNavigationHref(null);
        setStatusMessage(null);
        setRestoreCompleted(true);
        setRestorePreview(null);
        setRestoreReplacementAcknowledged(false);
        setSelectedRestoreFile(null);
        setSelectedRestoreFileLabel(null);
        setRestorePassphrase('');
        return;
      }

      setStatusMessage(
        restoreResult.biometricRearmRequired ||
          restoreResult.billingRevalidationRequired ||
          reminderResult.status === 'rejected' ||
          billingResult.status === 'rejected'
          ? t('backup.restore.statusWithFollowUp')
          : t('backup.restore.status'),
      );
      setPendingRestoreNavigationHref(resultHref);
      setErrorMessage(null);
      setRestoreCompleted(true);
      setRestorePreview(null);
      setRestoreReplacementAcknowledged(false);
      setSelectedRestoreFile(null);
      setSelectedRestoreFileLabel(null);
      setRestorePassphrase('');
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'backup_restore_commit_failed',
        error,
      });
      setErrorMessage(t('backup.restore.commitError'));
      setPendingRestoreNavigationHref(null);
      setStatusMessage(null);
    } finally {
      isConfirmingRestoreRef.current = false;
      setIsConfirmingRestore(false);
    }
  }

  return (
    <Screen
      backAction={{
        label: backHref
          ? (backLabel ?? t('backup.screen.backLabel'))
          : t('backup.screen.backLabel'),
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace((backHref ?? '/settings/data') as Href);
        },
        testID: testIds.backup.backButton,
      }}
      eyebrow={t('backup.screen.eyebrow')}
      title={
        mode === 'export-only' || mode === 'restore-only' ? (
          screenTitle
        ) : (
          <ItalicTitle prefix="Your data, " accent="portable" suffix="." />
        )
      }
      description={screenDescription}
      testID={testIds.backup.screen}
    >
      {statusMessage ? (
        <SectionCard
          title={t('backup.screen.statusCardTitle')}
          description={statusMessage}
          testID={testIds.backup.statusCard}
          presentation="unframed"
        >
          {pendingRestoreNavigationHref ? (
            <ActionButton
              onPress={() => {
                router.replace(pendingRestoreNavigationHref);
              }}
              testID={testIds.backup.continueAfterRestoreButton}
            >
              {t('backup.restore.continueButton')}
            </ActionButton>
          ) : null}
        </SectionCard>
      ) : null}
      {errorMessage ? (
        <SectionCard
          title={t('backup.screen.errorCardTitle')}
          description={errorMessage}
          testID={testIds.backup.errorCard}
          presentation="unframed"
        />
      ) : null}

      {mode === 'full' || mode === 'export-only' ? (
        <SectionCard
          density="compact"
          title={mode === 'export-only' ? undefined : t('backup.export.title')}
          description={
            mode === 'export-only' ? undefined : t('backup.export.description')
          }
          presentation="unframed"
        >
          <View style={styles.sectionContent}>
            <InputField
              label={t('backup.export.passphraseLabel')}
              value={exportPassphrase}
              onChangeText={setExportPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              testID={testIds.backup.exportPassphraseInput}
            />
            <InputField
              label={t('backup.export.confirmPassphraseLabel')}
              value={exportPassphraseConfirm}
              onChangeText={setExportPassphraseConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              testID={testIds.backup.exportPassphraseConfirmInput}
            />
            <ActionButton
              disabled={!exportReady}
              onPress={() => {
                void exportBackupPackage();
              }}
              testID={testIds.backup.exportButton}
            >
              {t('backup.export.exportButton')}
            </ActionButton>
            {showExportLengthMessage ? (
              <Text style={styles.helperText}>
                {t('backup.export.passphraseLengthError')}
              </Text>
            ) : showExportMismatchMessage ? (
              <Text style={styles.helperText}>
                {t('backup.export.mismatchError')}
              </Text>
            ) : (
              <Text style={styles.helperText}>
                {t('backup.export.localOnlyNote')}
              </Text>
            )}
            <Text style={styles.helperText}>
              {t('backup.export.passphraseSafetyNote')}
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {(mode === 'full' || mode === 'restore-only') && !restoreCompleted ? (
        <SectionCard
          density="compact"
          title={
            mode === 'restore-only' ? undefined : t('backup.restore.title')
          }
          description={
            mode === 'restore-only'
              ? undefined
              : t('backup.restore.description')
          }
          presentation="unframed"
        >
          <View style={styles.sectionContent}>
            {restorePreview ? (
              <Text
                style={styles.helperText}
                testID={testIds.backup.selectedFileLabel}
              >
                {selectedRestoreFileLabel
                  ? `${t('backup.restore.selectedFilePrefix')} ${selectedRestoreFileLabel}`
                  : t('backup.restore.noFileSelected')}
              </Text>
            ) : (
              <>
                <InputField
                  label={t('backup.restore.passphraseLabel')}
                  value={restorePassphrase}
                  onChangeText={setRestorePassphrase}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  testID={testIds.backup.restorePassphraseInput}
                />
                <ActionButton
                  appearance="secondary"
                  onPress={() => {
                    void chooseRestoreFile();
                  }}
                  testID={testIds.backup.chooseRestoreFileButton}
                >
                  {t('backup.restore.chooseFileButton')}
                </ActionButton>
                <Text
                  style={styles.helperText}
                  testID={testIds.backup.selectedFileLabel}
                >
                  {selectedRestoreFileLabel
                    ? `${t('backup.restore.selectedFilePrefix')} ${selectedRestoreFileLabel}`
                    : t('backup.restore.noFileSelected')}
                </Text>
                <ActionButton
                  disabled={!restorePreviewReady || isPreviewingRestore}
                  onPress={() => {
                    void previewRestoreFile();
                  }}
                  testID={testIds.backup.previewRestoreButton}
                >
                  {t('backup.restore.previewButton')}
                </ActionButton>
                {!restorePreviewReady ? (
                  <Text style={styles.helperText}>
                    {restorePassphrase
                      ? t('backup.restore.missingFileError')
                      : t('backup.restore.missingPassphraseError')}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </SectionCard>
      ) : null}

      {/* UL-12: the restore preview (and its destructive confirm flow) never
          renders on the export-only route — restore lives on /backup/restore. */}
      {(mode === 'full' || mode === 'restore-only') && restorePreview ? (
        <SectionCard
          title={t('backup.restore.previewTitle')}
          description={t('backup.restore.previewDescription')}
          testID={testIds.backup.previewCard}
        >
          <View style={styles.sectionContent}>
            <View style={styles.previewDetailList}>
              <PreviewDetailRow
                label={t('backup.restore.exportedOn')}
                value={
                  formatLocalizedDate(restorePreview.snapshot.exportedAt, resolvedLocale) ??
                  restorePreview.exportedDate
                }
              />
              <PreviewDetailRow
                label={t('backup.restore.logDateRange')}
                value={formatRestoreDateRange(
                  restorePreview,
                  t('backup.restore.noLogsInBackup'),
                  resolvedLocale,
                )}
              />
              <PreviewDetailRow
                label={t('backup.restore.logsToRestore')}
                tone="accent"
                value={String(restorePreview.importedLogCount)}
              />
              <PreviewDetailRow
                label={t('backup.restore.importSessions')}
                value={String(restorePreview.importSessionCount)}
              />
              <PreviewDetailRow
                label={t('backup.restore.trackedPeriodDays')}
                value={String(restorePreview.periodStartCount)}
              />
              <PreviewDetailRow
                label={t('backup.restore.reminders')}
                value={String(restorePreview.reminderCount)}
              />
              <PreviewDetailRow
                label={t('backup.restore.cycleProfile')}
                value={
                  restorePreview.hasCycleProfile
                    ? t('backup.restore.cycleProfileReady')
                    : t('backup.restore.cycleProfileMissing')
                }
              />
            </View>
            <View style={styles.noteCard} testID={testIds.backup.replaceDataNote}>
              <Text style={styles.noteText}>
                {t('backup.restore.replaceDataNote')}
              </Text>
            </View>
            {/* UL-11: the consent gate is a visible checkbox — the previous
                quiet/secondary button flip left the acknowledged state
                illegible from the pixels on a destructive flow. */}
            <SelectionChip
              disabled={isConfirmingRestore}
              indicatorTestID={testIds.backup.acknowledgeRestoreReplacementIndicator}
              label={t('backup.restore.acknowledgeReplaceButton')}
              onPress={() => {
                setRestoreReplacementAcknowledged((current) => !current);
              }}
              selected={restoreReplacementAcknowledged}
              selectionIndicator="check"
              size="tall"
              testID={testIds.backup.acknowledgeRestoreReplacementButton}
            />
            {restorePreview.willDisableBiometrics ? (
              <View
                style={styles.noteCard}
                testID={testIds.backup.biometricsNote}
              >
                <Text style={styles.noteText}>
                  {t('backup.restore.biometricsNote')}
                </Text>
              </View>
            ) : null}
            {restorePreview.requiresBillingRevalidation ? (
              <View style={styles.noteCard} testID={testIds.backup.billingNote}>
                <Text style={styles.noteText}>
                  {t('backup.restore.billingNote')}
                </Text>
              </View>
            ) : null}
            <ActionButton
              appearance="destructive"
              disabled={isConfirmingRestore || !restoreReplacementAcknowledged}
              onPress={() => {
                void confirmRestore();
              }}
              testID={testIds.backup.confirmRestoreButton}
            >
              {t('backup.restore.confirmButton')}
            </ActionButton>
            <ActionButton
              appearance="secondary"
              disabled={isConfirmingRestore}
              onPress={() => {
                setRestorePreview(null);
                setRestoreReplacementAcknowledged(false);
                setPendingRestoreNavigationHref(null);
                setSelectedRestoreFile(null);
                setSelectedRestoreFileLabel(null);
                setRestorePassphrase('');
              }}
              testID={testIds.backup.resetRestoreSelectionButton}
            >
              {t('backup.restore.chooseDifferentFileButton')}
            </ActionButton>
          </View>
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    sectionContent: {
      gap: theme.spacing.sm,
    },
    previewDetailList: {
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceSecondary,
    },
    detailRow: {
      minHeight: 50,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderPrimary,
      gap: theme.spacing.xs,
    },
    detailRowAccent: {
      backgroundColor: theme.colors.accentSoft,
    },
    detailLabel: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
    },
    detailValue: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    detailValueAccent: {
      color: theme.colors.accentPrimary,
    },
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    noteCard: {
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    noteText: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
