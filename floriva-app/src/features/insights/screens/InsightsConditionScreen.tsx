import { useEffect } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { useInsightsModel } from '@/src/features/insights/useInsightsModel';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { ConditionKey } from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InsightsConditionScreenProps = {
  conditionKey?: string;
  todayIso?: string;
};

export function InsightsConditionScreen({
  conditionKey,
  todayIso = getLocalTodayLogDate(),
}: InsightsConditionScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { t } = useLocalization();
  const { hydrationError, isHydrating, model } = useInsightsModel(todayIso);
  const summary = model.conditionSummaries.find(
    (item) => item.key === (conditionKey as ConditionKey | undefined),
  );
  const shouldRedirectToInsights = !isHydrating && !hydrationError && !summary;

  useEffect(() => {
    if (!shouldRedirectToInsights) {
      return;
    }

    router.replace('/insights' as Href);
  }, [router, shouldRedirectToInsights]);

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
        testID: testIds.insights.conditionBackButton,
      }}
      testID={testIds.insights.conditionScreen}
      eyebrow={t('insights.screen.eyebrow')}
      title={summary?.title ?? t('insights.screen.title')}
      description={t('insights.conditionSummary.local90DayLabel')}
    >
      {isHydrating ? <Text style={styles.body}>{t('insights.screen.description')}</Text> : null}
      {hydrationError ? <Text style={styles.body}>{hydrationError}</Text> : null}
      {!isHydrating && !hydrationError && summary ? (
        <SectionCard
          description={t('insights.conditionSummary.logsReviewed', {
            count: summary.recentLogCount,
          })}
          testID={testIds.insights.conditionSummaryCard}
          title={summary.title}
        >
          <View style={styles.stack}>
            <Text style={styles.body}>{summary.summary}</Text>
            <Text style={styles.caption}>{summary.emptyState}</Text>
          </View>
        </SectionCard>
      ) : null}
      {!isHydrating && !hydrationError && summary ? (
        <SectionCard
          description={summary.loggingHint}
          testID={testIds.insights.conditionFocusCard}
          title={t('insights.conditionSummary.loggingFocusTitle')}
        >
          <View style={styles.chipRow}>
            {summary.trackedSymptomLabels.map((label) => (
              <View key={label} style={styles.focusChip}>
                <Text style={styles.focusChipText}>{label}</Text>
              </View>
            ))}
          </View>
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    focusChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    focusChipText: {
      color: theme.colors.text,
      ...theme.typography.caption,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    caption: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
  });
}
