import { useMemo, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { Screen } from '@/src/components/primitives/Screen';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import {
  createImportWorkflow,
  getManualHistoryLookbackStartIso,
} from '@/src/features/import/model';
import { InputField, OptionCard, ChoiceChip } from '@/src/features/onboarding/screens/shared';
import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';
import { UnsupportedImportShapeError } from '@/src/lib/parsing/importParsers';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { formatLocalizedDate, formatLocalizedRange } from '@/src/localization/formatters';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import { testIds } from '@/src/testing/testIds';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportSource,
  SupportedLocale,
} from '@/src/types/domain';

const IMPORT_PICKER_TYPES = [
  'application/json',
  'application/*+json',
  'text/json',
  'text/plain',
  'application/octet-stream',
  'image/*',
  'video/*',
  'audio/*',
] as const;
const UNSUPPORTED_IMPORT_MIME_PREFIXES = ['image/', 'video/', 'audio/'] as const;

const IMPORT_SOURCES = ['clue', 'flo', 'manual'] as const satisfies readonly ImportSource[];

export function getUnsupportedImportMessage(
  mimeType: string | null | undefined,
  t: (key: string) => string,
) {
  if (!mimeType) {
    return null;
  }

  const normalizedMimeType = mimeType.toLowerCase();

  if (
    UNSUPPORTED_IMPORT_MIME_PREFIXES.some((prefix) => normalizedMimeType.startsWith(prefix))
  ) {
    return t('import.errors.unsupportedMedia');
  }

  return null;
}

export function formatImportDateLabel(isoDate: string, locale: SupportedLocale) {
  const date = new Date(`${isoDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return formatLocalizedDate(`${isoDate}T12:00:00`, locale) ?? isoDate;
}

export function formatImportDateRange(
  dateRange: ImportPreview['dateRange'],
  locale: SupportedLocale,
  t: (key: string) => string,
) {
  if (!dateRange) {
    return t('import.labels.dateRangeNone');
  }

  return formatLocalizedRange(
    formatImportDateLabel(dateRange.startIso, locale),
    formatImportDateLabel(dateRange.endIso, locale),
    locale,
  );
}

type ImportScreenProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  backHref?: Href;
  backLabel?: string;
  skipHref?: Href;
  skipLabel?: string;
  resultPrimaryHref?: Href;
  resultPrimaryLabel?: string;
  resultSecondaryHref?: Href | null;
  resultSecondaryLabel?: string;
};

export function ImportScreen({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Back',
  resultPrimaryHref = '/today',
  resultPrimaryLabel = 'Go to Today',
  resultSecondaryHref = '/calendar',
  resultSecondaryLabel = 'Go to Calendar',
  skipHref,
  skipLabel = 'Skip for now',
}: ImportScreenProps = {}) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { resolvedLocale, t } = useLocalization();
  const { repositories } = useDatabase();
  const { clearPendingEntryRoute, refreshReminderSchedules } = useAppShell();
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [manualDatesInput, setManualDatesInput] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const isCommittingRef = useRef(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(null);
  const workflow = createImportWorkflow({ repositories });
  const importReadErrorMessage = t('import.errors.readFile');
  const importCommitErrorMessage = t('import.errors.commit');

  function resetFlow(nextSource: ImportSource) {
    setSelectedSource(nextSource);
    setPreview(null);
    setResult(null);
    setErrorMessage(null);
    setSelectedFileLabel(null);
  }

  function hasPreviewableHistory(nextPreview: ImportPreview) {
    return (
      nextPreview.importableEntries.length > 0 ||
      nextPreview.duplicateLocalDates.length > 0 ||
      nextPreview.skippedRows.length > 0 ||
      (nextPreview.skippedSummary?.totalCount ?? 0) > 0 ||
      nextPreview.warnings.length > 0
    );
  }

  async function previewPayload(source: ImportSource, payload: unknown) {
    try {
      const nextPreview = await workflow.previewImport({ source, payload });

      if (!hasPreviewableHistory(nextPreview)) {
        setPreview(null);
        setResult(null);
        setErrorMessage(t('import.errors.noValidHistory'));
        return;
      }

      setPreview(nextPreview);
      setResult(null);
      setErrorMessage(null);
    } catch (error) {
      setPreview(null);
      setResult(null);
      setErrorMessage(
        error instanceof UnsupportedImportShapeError
          ? t('import.errors.unsupportedShape')
          : t('import.errors.noValidHistory'),
      );
    }
  }

  async function previewManualHistory() {
    const periodStarts = manualDatesInput
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    // LT-07: only the manual quick-entry path applies a 12-month lookback;
    // file imports below (previewFileImport) accept history of any age.
    // This asymmetry is intentional -- see the policy comment on
    // getManualHistoryLookbackStartIso (model.ts) for the full rationale.
    await previewPayload('manual', {
      periodStarts,
      lookbackStartIso: getManualHistoryLookbackStartIso(),
    });
  }

  async function previewFileImport(source: Extract<ImportSource, 'clue' | 'flo'>) {
    try {
      // LT-07: deliberately no lookback/age cutoff here -- file imports
      // (Clue/Flo) accept history of any age. See the policy comment on
      // getManualHistoryLookbackStartIso (model.ts).
      const selection = await DocumentPicker.getDocumentAsync({
        type: [...IMPORT_PICKER_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled || selection.assets.length === 0) {
        return;
      }

      const asset = selection.assets[0];
      const unsupportedMessage = getUnsupportedImportMessage(asset.mimeType, t);

      if (unsupportedMessage) {
        setPreview(null);
        setResult(null);
        setErrorMessage(unsupportedMessage);
        setSelectedFileLabel(asset.name ?? null);
        return;
      }

      const contents = await FileSystem.readAsStringAsync(asset.uri);
      let payload: unknown;

      try {
        payload = JSON.parse(contents) as unknown;
      } catch {
        setPreview(null);
        setResult(null);
        setSelectedFileLabel(asset.name ?? null);
        setErrorMessage(t('import.errors.jsonParse'));
        return;
      }

      setSelectedFileLabel(asset.name ?? t('import.labels.selectedExportFile'));
      await previewPayload(source, payload);
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'import_file_read_failed',
        error,
      });
      setPreview(null);
      setResult(null);
      setSelectedFileLabel(null);
      setErrorMessage(importReadErrorMessage);
    }
  }

  async function commitPreview(nextPreview: ImportPreview) {
    if (isCommittingRef.current) {
      return;
    }

    isCommittingRef.current = true;
    setIsCommitting(true);

    try {
      const nextResult = await workflow.commitImport(nextPreview);
      await clearPendingEntryRoute();
      setResult(nextResult);
      setErrorMessage(null);
      try {
        await refreshReminderSchedules();
      } catch (error) {
        logSensitiveRuntimeFailure({
          event: 'import_follow_up_sync_failed',
          error,
        });
      }
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'import_commit_failed',
        error,
      });
      setErrorMessage(importCommitErrorMessage);
    } finally {
      isCommittingRef.current = false;
      setIsCommitting(false);
    }
  }

  const activeSource = IMPORT_SOURCES.find((source) => source === selectedSource);
  const manualDatesTrimmed = manualDatesInput.trim();
  const manualPreviewDisabled = selectedSource === 'manual' && manualDatesTrimmed.length === 0;
  const previewWarnings =
    preview?.warnings.filter((warning) => warning.trim().length > 0) ?? [];
  const skippedRows = preview?.skippedRows ?? [];
  return (
    <Screen
      backAction={
        !backHref && !skipHref
          ? {
              label: t('import.screen.backLabel'),
              onPress: () => {
                void clearPendingEntryRoute();
                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace('/settings/data');
              },
              testID: testIds.import.backButton,
            }
          : undefined
      }
      eyebrow={eyebrow ?? t('import.screen.eyebrow')}
      title={title ?? t('import.screen.title')}
      description={description ?? t('import.screen.description')}
      footer={
        backHref || skipHref ? (
          <View style={styles.footerActions}>
            {backHref ? (
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.replace(backHref);
                }}
                testID={testIds.import.backButton}
              >
                {backLabel}
              </ActionButton>
            ) : null}
            {skipHref ? (
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  void clearPendingEntryRoute();
                  router.replace(skipHref);
                }}
                testID={testIds.import.skipButton}
              >
                {skipLabel}
              </ActionButton>
            ) : null}
          </View>
        ) : undefined
      }
      footerPlacement={backHref || skipHref ? 'inline' : 'fixed'}
      testID={testIds.import.screen}
    >
      <SectionCard
        title={t('import.screen.sourceStepLabel')}
        description={t('import.screen.sourcePickerDescription')}
        presentation="unframed"
      >
        <View style={styles.sourceChips}>
          <ChoiceChip
            label={t('import.sources.clue.title')}
            onPress={() => resetFlow('clue')}
            selected={selectedSource === 'clue'}
            testID={testIds.import.sourceClue}
          />
          <ChoiceChip
            label={t('import.sources.flo.title')}
            onPress={() => resetFlow('flo')}
            selected={selectedSource === 'flo'}
            testID={testIds.import.sourceFlo}
          />
          <ChoiceChip
            label={t('import.sources.manual.title')}
            onPress={() => resetFlow('manual')}
            selected={selectedSource === 'manual'}
            testID={testIds.import.sourceManual}
          />
        </View>
      </SectionCard>

      {activeSource ? (
        <OptionCard
          title={t(`import.sources.${activeSource}.title`)}
          description={t(`import.sources.${activeSource}.description`)}
        >
          {activeSource === 'manual' ? (
            <>
              <InputField
                label={t('import.labels.manualDateInput')}
                onChangeText={setManualDatesInput}
                multiline
                numberOfLines={4}
                placeholder="YYYY-MM-DD"
                testID={testIds.import.manualDatesInput}
                value={manualDatesInput}
              />
              <Text style={styles.guidanceDescription}>
                {t('import.labels.manualDateHelper')}
              </Text>
              <ActionButton
                disabled={manualPreviewDisabled}
                onPress={() => {
                  void previewManualHistory();
                }}
                testID={testIds.import.previewButton}
              >
                {t('import.actions.preview')}
              </ActionButton>
              {manualPreviewDisabled ? (
                <Text style={styles.helperText}>
                  {t('import.labels.manualDateDisabledHelper')}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <ActionButton
                onPress={() => {
                  void previewFileImport(activeSource);
                }}
                testID={testIds.import.chooseFileButton}
              >
                {t('import.actions.chooseFile')}
              </ActionButton>
              <Text style={styles.guidanceDescription}>
                {selectedFileLabel
                  ? `${t('import.labels.selectedFilePrefix')} ${selectedFileLabel}`
                  : t('import.labels.noFileSelected')}
              </Text>
            </>
          )}
        </OptionCard>
      ) : null}

      {errorMessage ? (
        <SectionCard
          title={t('import.status.attentionTitle')}
          description={t('import.screen.attentionDescription')}
          testID={testIds.import.errorCard}
        >
          <Text accessibilityRole="alert" style={styles.guidanceDescription}>
            {errorMessage}
          </Text>
        </SectionCard>
      ) : null}

      {preview ? (
        <SectionCard
          title={t('import.screen.previewStepLabel')}
          description={t('import.screen.previewDescription')}
          presentation="unframed"
          testID={testIds.import.previewCard}
        >
          <View style={styles.guidanceList}>
            <View style={styles.metricRow}>
              <InlineMetric
                label={t('import.status.previewTitle')}
                tone="accent"
                value={String(preview.importableEntries.length)}
              />
              <InlineMetric
                label={t('import.labels.localDuplicatesSkipped')}
                value={String(preview.duplicateLocalDates.length)}
              />
              <InlineMetric label={t('import.labels.rowsSkipped')} value={String(preview.skippedRows.length)} />
            </View>
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceTitle}>{t('import.labels.dateRangeTitle')}</Text>
              <Text style={styles.guidanceDescription}>
                {formatImportDateRange(preview.dateRange, resolvedLocale, t)}
              </Text>
            </View>
            {previewWarnings.length > 0 ? (
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceTitle}>{t('import.labels.adjustmentsTitle')}</Text>
                <View style={styles.messageStack}>
                  {previewWarnings.map((warning) => (
                    <View key={warning} style={styles.messageCard}>
                      <Text style={styles.guidanceDescription}>{warning}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {skippedRows.length > 0 ? (
              <View style={styles.guidanceItem}>
                <Text style={styles.guidanceTitle}>{t('import.labels.skippedRowsTitle')}</Text>
                <View style={styles.messageStack}>
                  {skippedRows.map((warning) => (
                    <View
                      key={`${warning.rowNumber}-${warning.message}`}
                      style={styles.messageCard}
                    >
                      <Text style={styles.guidanceDescription}>{warning.message}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {preview.importableEntries.length > 0 ? (
              <ActionButton
                disabled={isCommitting}
                onPress={() => {
                  void commitPreview(preview);
                }}
                testID={testIds.import.commitButton}
              >
                {t('import.actions.commit')}
              </ActionButton>
            ) : null}
          </View>
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard
          title={t('import.screen.confirmStepLabel')}
          description={t('import.screen.resultDescription')}
          presentation="unframed"
          testID={testIds.import.resultCard}
        >
          <View style={styles.guidanceList}>
            <View style={styles.metricRow}>
              <InlineMetric
                label={t('import.labels.logsImported')}
                tone="accent"
                value={String(result.importedLogCount)}
              />
              <InlineMetric
                label={t('import.status.resultSubtitle')}
                value={String(result.skippedLogCount)}
              />
            </View>
            <View style={styles.actionColumn}>
              <ActionButton
                onPress={() => {
                  router.replace(resultPrimaryHref);
                }}
                testID={testIds.import.resultTodayButton}
              >
                {resultPrimaryLabel}
              </ActionButton>
              {resultSecondaryHref ? (
                <ActionButton
                  appearance="secondary"
                  onPress={() => {
                    router.replace(resultSecondaryHref);
                  }}
                  testID={testIds.import.resultCalendarButton}
                >
                  {resultSecondaryLabel}
                </ActionButton>
              ) : null}
            </View>
          </View>
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    footerActions: {
      gap: theme.spacing.sm,
    },
    sourceChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    guidanceList: {
      gap: theme.spacing.md,
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    guidanceItem: {
      gap: theme.spacing.xs,
    },
    guidanceTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    guidanceDescription: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    messageStack: {
      gap: theme.spacing.sm,
    },
    messageCard: {
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfacePrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    actionColumn: {
      gap: theme.spacing.sm,
    },
  });
}
