import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { useInsightsModel } from '@/src/features/insights/useInsightsModel';
import { formatMonthDayLabel } from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InsightsTtcScreenProps = {
  todayIso?: string;
};

export function InsightsTtcScreen({ todayIso = getLocalTodayLogDate() }: InsightsTtcScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { resolvedLocale, t } = useLocalization();
  const { hydrationError, isHydrating, model } = useInsightsModel(todayIso);
  const isTtcModeEnabled = Boolean(model.ttcSummary);
  const visibleTtcSummary = model.showFertilityEstimates ? model.ttcSummary : null;
  const shouldShowTtcShell = isTtcModeEnabled;

  useEffect(() => {
    if (!isHydrating && !hydrationError && !isTtcModeEnabled) {
      router.replace('/insights' as Href);
    }
  }, [hydrationError, isHydrating, isTtcModeEnabled, router]);

  if (!isHydrating && !hydrationError && !isTtcModeEnabled) {
    return null;
  }

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
        testID: testIds.insights.ttcBackButton,
      }}
      testID={testIds.insights.ttcScreen}
      eyebrow={t('insights.screen.eyebrow')}
      title={shouldShowTtcShell ? t('insights.ttcSummary.title') : t('insights.screen.title')}
      description={
        isHydrating || !shouldShowTtcShell
          ? t('insights.screen.description')
          : visibleTtcSummary
          ? t('insights.ttcSummary.description', {
              loggedDays: visibleTtcSummary.currentWindowLoggedDays,
              windowDays: visibleTtcSummary.currentWindowLengthDays,
            })
          : !model.showFertilityEstimates && isTtcModeEnabled
            ? 'Fertility estimates are hidden in Settings. Your trying-to-conceive logs are still saved.'
          : t('insights.screen.description')
      }
    >
      {isHydrating ? <Text style={styles.body}>{t('insights.screen.description')}</Text> : null}
      {hydrationError ? <Text style={styles.body}>{hydrationError}</Text> : null}
      {!isHydrating && !hydrationError && visibleTtcSummary ? (
        <SectionCard presentation="unframed" title={t('insights.ttcSummary.currentWindowLabel')}>
          <View style={styles.stack}>
            <Text style={styles.headline}>{visibleTtcSummary.fertileWindowLabel}</Text>
            {visibleTtcSummary.latestHighlights.map((highlight) => (
              <View key={`${highlight.kind}-${highlight.date}`} style={styles.highlightCard}>
                <Text style={styles.highlightDate}>{formatMonthDayLabel(highlight.date, resolvedLocale)}</Text>
                <Text style={styles.body}>{highlight.label}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}
      {!isHydrating && !hydrationError && visibleTtcSummary ? (
        <SectionCard presentation="unframed" title={t('ttc.insights.recentLogsTitle')}>
          <View style={styles.stack}>
            {visibleTtcSummary.recentLogSummaries.length > 0 ? (
              visibleTtcSummary.recentLogSummaries.map((logSummary) => (
                <View key={logSummary.date} style={styles.highlightCard}>
                  <Text style={styles.highlightDate}>
                    {formatMonthDayLabel(logSummary.date, resolvedLocale)}
                  </Text>
                  <Text style={styles.body}>{logSummary.summary}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.body}>{t('ttc.insights.noRecentLogs')}</Text>
            )}
          </View>
        </SectionCard>
      ) : null}
      {!isHydrating && !hydrationError && !model.showFertilityEstimates ? (
        <SectionCard
          description={t('ttc.insights.estimatesHiddenDescription')}
          presentation="unframed"
          title={t('ttc.insights.estimatesHiddenTitle')}
        >
          <Text style={styles.body}>
            {t('ttc.insights.estimatesHiddenBody')}
          </Text>
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    headline: {
      color: theme.colors.text,
      ...theme.typography.subtitle,
    },
    highlightCard: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    highlightDate: {
      color: theme.colors.accentPrimary,
      ...theme.typography.caption,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
