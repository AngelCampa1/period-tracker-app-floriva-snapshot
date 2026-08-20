import { useMemo } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { ListRow } from '@/src/components/primitives/ListRow';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { useImportFlow } from '@/src/features/import/ImportFlowProvider';
import { formatImportDateRange } from '@/src/features/import/screens/ImportScreen';
import { useOptionalOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { InputField } from '@/src/features/onboarding/screens/shared';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type {
  ImportConfidence,
  ImportConfidenceLabel,
  ImportDateRange,
  ImportPreview,
  ImportSource,
  SupportedLocale,
} from '@/src/types/domain';

type ImportFlowVariant = 'app' | 'onboarding';

const IMPORT_SOURCE_ORDER = ['clue', 'flo', 'manual'] as const satisfies readonly ImportSource[];

const onboardingImportLabels = {
  en: {
    back: 'Back to path choice',
    skip: 'Skip import for now',
  },
  es: {
    back: 'Volver a la ruta inicial',
    skip: 'Omitir importación por ahora',
  },
  de: {
    back: 'Zurück zur Startoption',
    skip: 'Import vorerst überspringen',
  },
  fr: {
    back: 'Retour au choix de départ',
    skip: 'Passer l’import pour le moment',
  },
  ja: {
    back: '開始方法の選択に戻る',
    skip: '今はインポートをスキップ',
  },
  'zh-Hans': {
    back: '返回开始方式',
    skip: '暂时跳过导入',
  },
  pt: {
    back: 'Voltar à forma de começar',
    skip: 'Ignorar importação por agora',
  },
  ru: {
    back: 'Назад к выбору старта',
    skip: 'Пока пропустить импорт',
  },
} as const;

function buildImportRoute(variant: ImportFlowVariant, path = '') {
  const prefix = variant === 'app' ? '/(app)/import' : '/(onboarding)/import';

  return `${prefix}${path}` as Href;
}

function isImportSource(value: string): value is ImportSource {
  return IMPORT_SOURCE_ORDER.some((source) => source === value);
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    footerActions: {
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

function ImportErrorCard({ errorMessage }: { errorMessage: string | null }) {
  const { t } = useLocalization();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!errorMessage) {
    return null;
  }

  return (
    <SectionCard
      title={t('import.status.attentionTitle')}
      description={t('import.screen.attentionDescription')}
      testID={testIds.import.errorCard}
    >
      <Text accessibilityRole="alert" style={styles.guidanceDescription}>
        {errorMessage}
      </Text>
    </SectionCard>
  );
}

function getDuplicateDetails(preview: ImportPreview) {
  return (
    preview.duplicateSummary?.details ??
    preview.duplicateLocalDates.map((logDate) => ({
      action: 'skipped' as const,
      logDate,
    }))
  );
}

function getDuplicateCount(preview: ImportPreview) {
  return preview.duplicateSummary?.count ?? preview.duplicateLocalDates.length;
}

function getSkippedSummary(preview: ImportPreview) {
  return (
    preview.skippedSummary ?? {
      totalCount: preview.skippedRows.length,
      invalidCount: preview.skippedRows.filter((row) => row.reason === 'invalid').length,
      unsupportedCount: preview.skippedRows.filter((row) => row.reason === 'unsupported').length,
      messages: preview.skippedRows.map((row) => row.message),
    }
  );
}

function getConfidence(preview: ImportPreview): ImportConfidence {
  if (preview.confidence) {
    return preview.confidence;
  }

  if (preview.importableEntries.length === 0) {
    return {
      label: 'low',
      reasons: [{ kind: 'no-reviewed-days-ready', count: 0 }],
    };
  }

  return {
    label: preview.duplicateLocalDates.length > 0 || preview.skippedRows.length > 0 ? 'medium' : 'high',
    reasons: [{ kind: 'reviewed-days-ready', count: preview.importableEntries.length }],
  };
}

function confidenceLabelKey(label: ImportConfidenceLabel) {
  return `import.confidence.${label}` as const;
}

function confidenceReasonKey(reason: ImportConfidence['reasons'][number]) {
  return `import.confidenceReasons.${reason.kind}` as const;
}

function sourceTitleKey(source: ImportSource) {
  return `import.sources.${source}.title` as const;
}

function bleedingLabelKey(bleeding: ImportPreview['importableEntries'][number]['bleeding']) {
  return `logging.options.bleeding.${bleeding}` as const;
}

function formatResultDateRange(
  dateRange: ImportDateRange | null | undefined,
  locale: SupportedLocale,
  t: (key: string) => string,
) {
  return formatImportDateRange(dateRange ?? null, locale, t);
}

export function ImportChooseSourceScreen({ variant }: { variant: ImportFlowVariant }) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { clearPendingEntryRoute, state } = useAppShell();
  const { errorMessage, selectSource } = useImportFlow();
  const onboarding = useOptionalOnboarding();
  const { resolvedLocale, t } = useLocalization();
  const onboardingLabels = onboardingImportLabels[resolvedLocale];

  return (
    <Screen
      backAction={
        variant === 'app'
          ? {
              label: t('import.screen.backLabel'),
              onPress: () => {
                void clearPendingEntryRoute();

                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace(state.pendingEntryRoute === '/import' ? '/today' : '/settings/data');
              },
              testID: testIds.import.backButton,
            }
          : undefined
      }
      eyebrow={t('import.screen.eyebrow')}
      title={
        <ItalicTitle
          prefix={t('import.screen.chooseTitlePrefix')}
          accent={t('import.screen.chooseTitleAccent')}
          suffix={t('import.screen.chooseTitleSuffix')}
        />
      }
      description={t('import.screen.description')}
      footer={
        variant === 'onboarding' ? (
          <View style={styles.footerActions}>
            <ActionButton
              appearance="secondary"
              onPress={() => {
                router.replace('/start-path');
              }}
              testID={testIds.import.backButton}
            >
              {onboardingLabels.back}
            </ActionButton>
            <ActionButton
              appearance="secondary"
              onPress={() => {
                onboarding?.setStartPath('fresh');
                router.replace('/last-period-start');
              }}
              testID={testIds.import.skipButton}
            >
              {onboardingLabels.skip}
            </ActionButton>
          </View>
        ) : undefined
      }
      footerPlacement={variant === 'onboarding' ? 'inline' : 'fixed'}
      testID={testIds.import.screen}
    >
      <SectionCard
        title={t('import.screen.sourceCardTitle')}
        presentation="unframed"
      >
        <View>
          {IMPORT_SOURCE_ORDER.map((source) => (
            <ListRow
              key={source}
              onPress={() => {
                selectSource(source);
                router.push(buildImportRoute(variant, `/source/${source}`));
              }}
              summary={t(`import.sources.${source}.description`)}
              testID={
                source === 'clue'
                  ? testIds.import.sourceClue
                  : source === 'flo'
                    ? testIds.import.sourceFlo
                    : testIds.import.sourceManual
              }
              title={t(`import.sources.${source}.title`)}
            />
          ))}
        </View>
        {/* UL-32: the most sensitive flow carries the privacy reassurance the
            rest of the app already makes — reuses the privacy explainer copy. */}
        <Text style={styles.helperText}>{t('privacy.explainer.imports.body')}</Text>
      </SectionCard>
      <ImportErrorCard errorMessage={errorMessage} />
    </Screen>
  );
}

export function ImportSourceStepScreen({
  source,
  variant,
}: {
  source: string;
  variant: ImportFlowVariant;
}) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    clearError,
    errorMessage,
    manualDatesInput,
    previewFileImport,
    previewManualHistory,
    selectSource,
    selectedFileLabel,
    selectedSource,
    setManualDatesInput,
  } = useImportFlow();
  const { resolvedLocale, t } = useLocalization();
  const onboardingLabels = onboardingImportLabels[resolvedLocale];

  if (!isImportSource(source)) {
    return <Redirect href={buildImportRoute(variant)} />;
  }

  const manualPreviewDisabled = source === 'manual' && manualDatesInput.trim().length === 0;
  const backLabel = variant === 'app' ? t('import.screen.backLabel') : onboardingLabels.back;
  const showManualFallback = source !== 'manual' && selectedSource === source && Boolean(errorMessage);

  return (
    <Screen
      backAction={{
        label: backLabel,
        onPress: () => {
          clearError();
          router.replace(buildImportRoute(variant));
        },
        testID: testIds.import.backButton,
      }}
      eyebrow={t('import.screen.eyebrow')}
      title={t(`import.sources.${source}.title`)}
      description={t(`import.sources.${source}.description`)}
      testID={testIds.import.sourceScreen}
    >
      <SectionCard
        title={source === 'manual' ? t('import.labels.manualDateInput') : t('import.actions.chooseFile')}
        presentation="unframed"
      >
        <View style={styles.guidanceList}>
          {source === 'manual' ? (
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
                  void (async () => {
                    const prepared = await previewManualHistory();

                    if (prepared) {
                      router.push(buildImportRoute(variant, '/review'));
                    }
                  })();
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
                  void (async () => {
                    const prepared = await previewFileImport(source);

                    if (prepared) {
                      router.push(buildImportRoute(variant, '/review'));
                    }
                  })();
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
        </View>
      </SectionCard>

      {selectedSource === source ? <ImportErrorCard errorMessage={errorMessage} /> : null}
      {showManualFallback ? (
        <ActionButton
          appearance="secondary"
          onPress={() => {
            selectSource('manual');
            router.replace(buildImportRoute(variant, '/source/manual'));
          }}
          testID={testIds.import.manualFallbackButton}
        >
          {t('import.actions.useManualHistory')}
        </ActionButton>
      ) : null}
    </Screen>
  );
}

export function ImportReviewStepScreen({ variant }: { variant: ImportFlowVariant }) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    errorMessage,
    commitPreview,
    isCommitting,
    preview,
    removePreviewEntry,
    selectSource,
    selectedSource,
  } = useImportFlow();
  const { resolvedLocale, t } = useLocalization();
  const onboardingLabels = onboardingImportLabels[resolvedLocale];

  if (!selectedSource) {
    return <Redirect href={buildImportRoute(variant)} />;
  }

  if (!preview) {
    return <Redirect href={buildImportRoute(variant, `/source/${selectedSource}`)} />;
  }

  const previewWarnings = preview.warnings.filter((warning) => warning.trim().length > 0);
  const backLabel = variant === 'app' ? t('import.screen.backLabel') : onboardingLabels.back;
  const duplicateDetails = getDuplicateDetails(preview);
  const duplicateCount = getDuplicateCount(preview);
  const skippedSummary = getSkippedSummary(preview);
  const confidence = getConfidence(preview);
  const confidenceLabel = t(confidenceLabelKey(confidence.label));
  const hasImportableEntries = preview.importableEntries.length > 0;
  const canUseManualFallback =
    selectedSource !== 'manual' &&
    (duplicateDetails.length > 0 ||
      skippedSummary.totalCount > 0 ||
      previewWarnings.length > 0);
  const useManualFallback = () => {
    selectSource('manual');
    router.replace(buildImportRoute(variant, '/source/manual'));
  };
  const commitReviewedRows = () => {
    void (async () => {
      const committed = await commitPreview();

      if (committed) {
        router.replace(buildImportRoute(variant, '/complete'));
      }
    })();
  };

  return (
    <Screen
      backAction={{
        label: backLabel,
        onPress: () => {
          router.replace(buildImportRoute(variant, `/source/${selectedSource}`));
        },
        testID: testIds.import.backButton,
      }}
      eyebrow={t('import.screen.reviewEyebrow')}
      title={
        <ItalicTitle
          prefix={t('import.screen.reviewTitlePrefix')}
          accent={t('import.screen.reviewTitleAccent')}
          suffix={t('import.screen.reviewTitleSuffix')}
        />
      }
      description={t('import.screen.previewDescription')}
      footer={
        <View style={styles.footerActions}>
          {hasImportableEntries ? (
            <ActionButton
              disabled={isCommitting}
              onPress={commitReviewedRows}
              testID={testIds.import.commitButton}
            >
              {t('import.actions.commit')}
            </ActionButton>
          ) : null}
          {!hasImportableEntries && canUseManualFallback ? (
            <ActionButton
              appearance="secondary"
              onPress={useManualFallback}
              testID={testIds.import.manualFallbackButton}
            >
              {t('import.actions.useManualHistory')}
            </ActionButton>
          ) : null}
          {hasImportableEntries && canUseManualFallback ? (
            <ActionButton
              appearance="secondary"
              onPress={useManualFallback}
              testID={testIds.import.manualFallbackButton}
            >
              {t('import.actions.useManualHistory')}
            </ActionButton>
          ) : null}
        </View>
      }
      footerPlacement="fixed"
      testID={testIds.import.reviewScreen}
    >
      <ImportErrorCard errorMessage={errorMessage} />
      <SectionCard
        title={t('import.screen.previewCardTitle')}
        presentation="unframed"
        testID={testIds.import.previewCard}
      >
        <View style={styles.guidanceList}>
          <View style={styles.metricRow} testID={testIds.import.reviewMetrics}>
            <InlineMetric
              label={t('import.status.previewTitle')}
              tone="accent"
              value={String(preview.importableEntries.length)}
            />
            <InlineMetric
              label={t('import.labels.localDuplicatesSkipped')}
              value={String(preview.duplicateLocalDates.length)}
            />
            <InlineMetric
              label={t('import.labels.rowsSkipped')}
              value={String(preview.skippedRows.length)}
            />
          </View>
          <View style={styles.guidanceItem} testID={testIds.import.confidenceSummary}>
            <Text style={styles.guidanceTitle}>{t('import.labels.confidenceTitle')}</Text>
            <Text style={styles.guidanceDescription}>{confidenceLabel}</Text>
            {confidence.reasons.length > 0 ? (
              <View style={styles.messageStack}>
                {confidence.reasons.map((reason) => (
                  <View key={reason.kind} style={styles.messageCard}>
                    <Text style={styles.guidanceDescription}>
                      {t(confidenceReasonKey(reason), { count: reason.count })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.guidanceItem}>
            <Text style={styles.guidanceTitle}>{t('import.labels.dateRangeTitle')}</Text>
            <Text style={styles.guidanceDescription}>
              {formatImportDateRange(preview.dateRange, resolvedLocale, t)}
            </Text>
          </View>
          {duplicateDetails.length > 0 ? (
            <View style={styles.guidanceItem} testID={testIds.import.duplicateSummary}>
              <Text style={styles.guidanceTitle}>{t('import.labels.duplicateDatesTitle')}</Text>
              <Text style={styles.guidanceDescription}>
                {t('import.labels.duplicateCountSummary', { count: duplicateCount })}
              </Text>
              <View style={styles.messageStack}>
                {duplicateDetails.slice(0, 5).map((detail) => (
                  <View
                    key={detail.logDate}
                    style={styles.messageCard}
                    testID={testIds.import.duplicateDate(detail.logDate)}
                  >
                    <Text style={styles.guidanceDescription}>{detail.logDate}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {previewWarnings.length > 0 ? (
            <View style={styles.guidanceItem} testID={testIds.import.reviewWarnings}>
              <Text style={styles.guidanceTitle}>{t('import.labels.adjustmentsTitle')}</Text>
              <View style={styles.messageStack}>
                {previewWarnings.map((warning) => (
                  <View key={warning} style={styles.messageCard}>
                    <Text style={styles.guidanceDescription}>
                      {t('import.labels.adjustmentSummary')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {skippedSummary.totalCount > 0 ? (
            <View style={styles.guidanceItem} testID={testIds.import.skippedSummary}>
              <Text style={styles.guidanceTitle}>{t('import.labels.skippedSummaryTitle')}</Text>
              <View style={styles.metricRow}>
                <InlineMetric
                  label={t('import.labels.rowsSkipped')}
                  value={String(skippedSummary.totalCount)}
                />
                <InlineMetric
                  label={t('import.labels.unsupportedRows')}
                  value={String(skippedSummary.unsupportedCount)}
                />
                <InlineMetric
                  label={t('import.labels.invalidRows')}
                  value={String(skippedSummary.invalidCount)}
                />
              </View>
            </View>
          ) : null}
          {preview.skippedRows.length > 0 ? (
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceTitle}>{t('import.labels.skippedRowsTitle')}</Text>
              <View style={styles.messageStack}>
                {preview.skippedRows.map((warning) => (
                  <View
                    key={`${warning.rowNumber}-${warning.message}`}
                    style={styles.messageCard}
                  >
                    <Text style={styles.guidanceDescription}>
                      {t(`import.skippedRows.${warning.reason}`, { rowNumber: warning.rowNumber })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {canUseManualFallback ? (
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceDescription}>
                {hasImportableEntries
                  ? t('import.screen.manualFallbackDescription')
                  : t('import.screen.duplicateOnlyDescription')}
              </Text>
            </View>
          ) : null}
          {hasImportableEntries ? (
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceTitle}>{t('import.labels.editablePreviewTitle')}</Text>
              <Text style={styles.guidanceDescription}>
                {t('import.labels.editablePreviewDescription')}
              </Text>
              <View style={styles.messageStack}>
                {preview.importableEntries.slice(0, 8).map((entry) => (
                  <View
                    key={entry.logDate}
                    style={styles.messageCard}
                    testID={testIds.import.previewEntry(entry.logDate)}
                  >
                    <Text style={styles.guidanceTitle}>{entry.logDate}</Text>
                    <Text style={styles.guidanceDescription}>
                      {t('import.labels.previewEntrySummary', {
                        bleeding: t(bleedingLabelKey(entry.bleeding)),
                        symptomCount: entry.symptoms.length,
                      })}
                    </Text>
                    <ActionButton
                      appearance="secondary"
                      onPress={() => removePreviewEntry(entry.logDate)}
                      testID={testIds.import.removePreviewEntry(entry.logDate)}
                    >
                      {t('import.actions.excludeReviewedRow')}
                    </ActionButton>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </SectionCard>
    </Screen>
  );
}

export function ImportCompleteStepScreen({ variant }: { variant: ImportFlowVariant }) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { result } = useImportFlow();
  const { resolvedLocale, t } = useLocalization();

  if (!result) {
    return <Redirect href={buildImportRoute(variant)} />;
  }

  return (
    <Screen
      eyebrow={t('import.screen.eyebrow')}
      title={t('import.screen.resultTitle')}
      description={t('import.screen.resultDescription')}
      testID={testIds.import.completeScreen}
    >
      <SectionCard
        title={t('import.screen.completionCardTitle')}
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
          <View style={styles.guidanceList} testID={testIds.import.resultSummary}>
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceTitle}>{t('import.labels.sourceTitle')}</Text>
              <Text style={styles.guidanceDescription}>
                {result.source ? t(sourceTitleKey(result.source)) : t('import.screen.title')}
              </Text>
            </View>
            <View style={styles.guidanceItem}>
              <Text style={styles.guidanceTitle}>{t('import.labels.dateRangeTitle')}</Text>
              <Text style={styles.guidanceDescription}>
                {formatResultDateRange(result.dateRange, resolvedLocale, t)}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <InlineMetric
                label={t('import.labels.localDuplicatesSkipped')}
                value={String(result.duplicateSkippedLogCount ?? 0)}
              />
              <InlineMetric
                label={t('import.labels.skippedSummaryTitle')}
                value={String(result.skippedRowCount ?? result.skippedLogCount)}
              />
              <InlineMetric
                label={t('import.labels.unsupportedRows')}
                value={String(result.unsupportedSkippedRowCount ?? 0)}
              />
              <InlineMetric
                label={t('import.labels.invalidRows')}
                value={String(result.invalidSkippedRowCount ?? 0)}
              />
              <InlineMetric
                label={t('import.labels.editedCount')}
                value={String(result.editedEntryCount ?? 0)}
              />
            </View>
          </View>
          <View style={styles.actionColumn}>
            <ActionButton
              onPress={() => {
                router.replace(variant === 'app' ? '/today' : '/notifications');
              }}
              testID={testIds.import.resultTodayButton}
            >
              {variant === 'app' ? t('import.actions.goToToday') : t('common.actions.continue')}
            </ActionButton>
            {variant === 'app' ? (
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.replace('/calendar');
                }}
                testID={testIds.import.resultCalendarButton}
              >
                {t('import.actions.goToCalendar')}
              </ActionButton>
            ) : null}
          </View>
        </View>
      </SectionCard>
    </Screen>
  );
}
