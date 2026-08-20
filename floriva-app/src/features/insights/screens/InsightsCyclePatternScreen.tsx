import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ConfidenceChip } from '@/src/components/primitives/ConfidenceChip';
import { ConfidenceImprovementList } from '@/src/components/primitives/ConfidenceImprovementList';
import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { useInsightsModel } from '@/src/features/insights/useInsightsModel';
import { openInfoModal } from '@/src/features/navigation/infoModal';
import type { Anomaly } from '@/src/lib/predictions/anomalyPresentation';
import { buildConfidenceInfoModalContent } from '@/src/lib/predictions/buildConfidenceInfoModalContent';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InsightsCyclePatternScreenProps = {
  todayIso?: string;
};

export function InsightsCyclePatternScreen({
  todayIso = getLocalTodayLogDate(),
}: InsightsCyclePatternScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { resolvedLocale, t } = useLocalization();
  const { hydrationError, isHydrating, model } = useInsightsModel(todayIso);

  return (
    <Screen
      backAction={{
        label: t('insights.screen.backLabel'),
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace('/insights' as Href);
        },
        testID: testIds.insights.cyclePatternBackButton,
      }}
      testID={testIds.insights.cyclePatternScreen}
      eyebrow={t('insights.screen.eyebrow')}
      title={model.cyclePattern.title}
      description={t('insights.cyclePattern.localPatternReadout')}
    >
      {isHydrating ? <Text style={styles.body}>{t('insights.screen.description')}</Text> : null}
      {hydrationError ? <Text style={styles.body}>{hydrationError}</Text> : null}
      {!isHydrating && !hydrationError ? (
        <SectionCard presentation="unframed">
          {/* UL-03: no bold lead here — it verbatim-duplicated the screen
              description (the privacy readout) one line above it. */}
          <View style={styles.stack}>
            {/* UL-26: metricCard stretches both stat cards to the row's
                height so their bottoms align when one value wraps deeper. */}
            <View style={styles.metricGrid}>
              <InlineMetric
                label={t('insights.cyclePattern.historyUsedLabel')}
                style={styles.metricCard}
                value={model.cyclePattern.periodStartsLabel}
              />
              <InlineMetric
                label={t('insights.cyclePattern.timingLabel')}
                style={styles.metricCard}
                value={model.cyclePattern.nextPeriodLabel}
              />
            </View>
            <ConfidenceChip
              accessibilityHint={t('tracker.confidence.chipHint')}
              accessibilityLabel={t('tracker.confidence.chipLabel', {
                confidenceLabel: model.cyclePattern.confidenceLabel,
              })}
              label={model.cyclePattern.confidenceLabel}
              onPress={() =>
                openInfoModal(
                  router,
                  buildConfidenceInfoModalContent(model.cyclePattern, resolvedLocale),
                )
              }
              testID={testIds.insights.cyclePatternConfidenceChipButton}
            />
            <ConfidenceImprovementList improvements={model.improvements ?? []} />
          </View>
        </SectionCard>
      ) : null}
      {/* UL-27: the Observations section keeps its place with a quiet
          all-clear body when there is nothing to report — the page structure
          no longer appears and disappears between presets. */}
      {!isHydrating && !hydrationError ? (
        <SectionCard presentation="unframed">
          <View style={styles.stack} testID={testIds.insights.observationsList}>
            <Text style={styles.observationsTitle}>{t('insights.observations.title')}</Text>
            {model.observations && model.observations.length > 0 ? (
              model.observations.map((anomaly) => (
                <ObservationRow anomaly={anomaly} key={anomaly.id} styles={styles} t={t} />
              ))
            ) : (
              <Text style={styles.observationBody}>
                {t(
                  model.observationsAllClear === 'varies-widely'
                    ? 'insights.observations.allClearVariesWidely'
                    : 'insights.observations.allClear',
                )}
              </Text>
            )}
          </View>
        </SectionCard>
      ) : null}
    </Screen>
  );
}

type ObservationRowProps = {
  anomaly: Anomaly;
  styles: ReturnType<typeof createStyles>;
  t: ReturnType<typeof useLocalization>['t'];
};

/**
 * A single quiet, read-only row in Insights' "Observations" list. Unlike
 * `AnomalyNudge` (Today), this carries no dismiss affordance -- dismissal is
 * Today's job; Insights is a quiet, complete record (see
 * `InsightsScreenModel.observations`'s doc comment) -- so this renders as
 * plain text, not a button.
 */
function ObservationRow({ anomaly, styles, t }: ObservationRowProps) {
  const title = t(`predictions.anomalies.${anomaly.kind}.title` as never);
  const body = t(`predictions.anomalies.${anomaly.kind}.body` as never);

  return (
    <View style={styles.observationRow} testID={testIds.insights.observationRow(anomaly.id)}>
      <Text style={styles.observationTitle}>{title}</Text>
      <Text style={styles.observationBody}>{body}</Text>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: theme.spacing.sm,
    },
    // UL-26: fill the (stretched) shell so sibling stat cards share one
    // bottom edge even when one value wraps to more lines.
    metricCard: {
      flex: 1,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    observationsTitle: {
      ...theme.typography.eyebrow,
      color: theme.colors.textTertiary,
    },
    observationRow: {
      gap: 2,
      paddingVertical: theme.spacing.xs,
    },
    observationTitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textSecondary,
    },
    observationBody: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  });
}
