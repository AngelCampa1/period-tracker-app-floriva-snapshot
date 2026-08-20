import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { useInsightsModel } from '@/src/features/insights/useInsightsModel';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InsightsMonthlyBriefingScreenProps = {
  todayIso?: string;
};

export function InsightsMonthlyBriefingScreen({
  todayIso = getLocalTodayLogDate(),
}: InsightsMonthlyBriefingScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { t } = useLocalization();
  const { hydrationError, isHydrating, model } = useInsightsModel(todayIso);
  const briefing = model.monthlyBriefing;

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
        testID: testIds.insights.monthlyBriefingBackButton,
      }}
      description={t('insights.monthlyBriefing.detailDescription')}
      eyebrow={t('insights.screen.eyebrow')}
      testID={testIds.insights.monthlyBriefingScreen}
      title={t('insights.monthlyBriefing.detailTitle')}
    >
      {isHydrating ? <Text style={styles.body}>{t('insights.screen.description')}</Text> : null}
      {hydrationError ? <Text style={styles.body}>{hydrationError}</Text> : null}
      {!isHydrating && !hydrationError ? (
        <>
          <SectionCard
            description={briefing.subtitle}
            presentation="grouped"
            title={briefing.title}
          >
            <View style={styles.stack}>
              <Text style={styles.lead}>{briefing.lead}</Text>
              {/* UL-33: the card labels already name the unit, so the values
                  are bare counts — "PERIOD DAYS / 2", never "PERIOD DAYS /
                  2 period days". UL-26: metricCard stretches both cards to
                  the row's height so their bottoms align. */}
              <View style={styles.metricGrid}>
                <InlineMetric
                  label={t('insights.monthlyBriefing.periodDaysMetric')}
                  style={styles.metricCard}
                  value={String(briefing.periodDaysCount)}
                />
                <InlineMetric
                  label={t('insights.monthlyBriefing.symptomDaysMetric')}
                  style={styles.metricCard}
                  value={String(briefing.symptomDaysCount)}
                />
              </View>
            </View>
          </SectionCard>
          {/* UL-33: the "keep logging" coaching only leads this card when
              there is actually nothing to show — it used to preface a full
              list of signals with empty-state copy. */}
          <SectionCard
            description={briefing.hasTopSignals ? undefined : briefing.emptyState}
            presentation="grouped"
            title={t('insights.monthlyBriefing.topSignalsLabel')}
          >
            <Text style={styles.body}>{briefing.topSignalsLabel}</Text>
          </SectionCard>
          {briefing.sourceLabels.length > 0 ? (
            <SectionCard
              description={t('insights.monthlyBriefing.sourceDescription')}
              presentation="grouped"
              title={t('insights.monthlyBriefing.sourceTitle')}
            >
              <View style={styles.stack}>
                {briefing.sourceLabels.map((label) => (
                  <Text key={label} style={styles.body}>{label}</Text>
                ))}
              </View>
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    lead: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: theme.spacing.sm,
    },
    // UL-26: fill the (stretched) shell so sibling stat cards share one
    // bottom edge even when one label wraps to more lines.
    metricCard: {
      flex: 1,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
