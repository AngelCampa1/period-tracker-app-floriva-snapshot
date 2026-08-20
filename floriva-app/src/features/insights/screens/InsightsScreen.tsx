import type { Href } from 'expo-router';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { formatObservedCycleCount } from '@/src/features/insights/formatObservedCycleCount';
import { useInsightsModel } from '@/src/features/insights/useInsightsModel';
import type { CycleLengthData, PhaseRhythmData } from '@/src/features/insights/types';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { buildInsightsConditionRowTestId, testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import {
  formatCyclePhaseLabel,
  formatStalePredictionBannerLabel,
} from '@/src/lib/predictions/presentation';
import type { SupportedLocale } from '@/src/types/domain';

type InsightsScreenProps = {
  todayIso?: string;
};

export function InsightsScreen() {
  return <InsightsScreenContent todayIso={getLocalTodayLogDate()} />;
}

export function InsightsScreenContent({ todayIso = getLocalTodayLogDate() }: InsightsScreenProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { resolvedLocale, t } = useLocalization();
  const { hydrationError, isHydrating, model, retry } = useInsightsModel(todayIso);
  const observedCycleCount = model.cycleLengthData.bars.length;
  const observedCycleTitle = {
    prefix: t('insights.screen.observedTitlePrefix'),
    accent: formatObservedCycleCount(
      resolvedLocale,
      observedCycleCount,
      t('insights.screen.observedTitleCount', { count: observedCycleCount }),
    ),
    suffix: t('insights.screen.observedTitleSuffix'),
  };

  return (
    <Screen
      headerVariant="compact"
      title={
        <View style={styles.titleComposite}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowAccentBar} />
            <Text style={styles.eyebrowLabel}>{t('insights.screen.eyebrow')}</Text>
          </View>
          {observedCycleCount > 1 ? (
            <Text style={styles.displayTitle}>
              {observedCycleTitle.prefix}
              <Text style={styles.displayTitleAccent}>
                {observedCycleTitle.accent}
              </Text>
              {observedCycleTitle.suffix}
            </Text>
          ) : observedCycleCount === 1 ? (
            <Text style={styles.displayTitle}>{t('insights.screen.observedTitleOne')}</Text>
          ) : (
            <Text style={styles.displayTitle}>{t('insights.screen.observedTitleEmpty')}</Text>
          )}
        </View>
      }
      testID={testIds.insights.screen}
    >
      {hydrationError ? (
        <SectionCard
          description={t('insights.error.body')}
          testID={testIds.insights.hydrationErrorCard}
          title={t('insights.error.title')}
        >
          <Text>{hydrationError}</Text>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              retry();
            }}
            testID={testIds.insights.retryButton}
          >
            {t('insights.error.retry')}
          </ActionButton>
        </SectionCard>
      ) : null}

      {!isHydrating && !hydrationError ? (
        <>
          {/* UL-09: while history is stale, Today admits it but Insights used
              to present months-old analysis as live. Lead with the same
              honest, action-oriented staleness cue the calendar banner uses
              (existing localized string, all 8 locales). */}
          {model.cyclePattern.confidenceReasonCodes.includes('stale-history') ? (
            <View style={styles.staleNote} testID={testIds.insights.staleNote}>
              <Text style={styles.staleNoteText}>
                {formatStalePredictionBannerLabel(resolvedLocale)}
              </Text>
            </View>
          ) : null}

          {/* Cycle length bar chart card */}
          <SectionCard density="compact" presentation="grouped">
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <Text style={styles.cardEyebrow}>{t('insights.screen.cycleLengthLabel')}</Text>
                {/* LT-18: subtitle is now derived from the engine's robust
                    statistics (see CycleLengthConsistencyLevel), not a
                    hardcoded "Consistent on average" shown regardless of
                    data. */}
                <Text style={styles.cardSubtitle}>{model.cycleLengthData.subtitleLabel}</Text>
              </View>
              <View style={styles.chartHeaderRight}>
                {/* UL-57: while the number is only a seeded estimate, it must
                    not wear the confident oxblood accent next to a "Not enough
                    data yet" subtitle — quiet ink signals provisional. */}
                <Text
                  style={[
                    styles.avgNumeral,
                    model.cycleLengthData.hasObservedHistory
                      ? null
                      : styles.avgNumeralEstimate,
                  ]}
                  testID={testIds.insights.avgNumeral}
                >
                  {String(model.cycleLengthData.avgDays)}
                </Text>
                <Text style={styles.avgLabel}>
                  {model.cycleLengthData.hasObservedHistory
                    ? t('insights.screen.averageAbbreviation')
                    : t('insights.screen.estimateAbbreviation')}
                </Text>
              </View>
            </View>
            <CycleLengthChart
              data={model.cycleLengthData}
              emptyLabel={t('insights.screen.chartEmpty')}
              styles={styles}
              theme={theme}
            />
            {/* LT-18: footnote likewise follows the same honest
                classification instead of an unconditional "+/- 2 days"
                claim. */}
            <Text style={styles.chartFootnote}>{model.cycleLengthData.footnoteLabel}</Text>
          </SectionCard>

          {/* Phase rhythm card */}
          <SectionCard density="compact" presentation="grouped">
            <Text style={styles.cardEyebrow}>{t('insights.screen.phaseRhythmLabel')}</Text>
            <PhaseRhythmRows
              data={model.phaseRhythmData}
              formatDays={(count) => t('insights.screen.phaseDays', { count })}
              locale={resolvedLocale}
              showFertilityEstimates={model.showFertilityEstimates}
              styles={styles}
              theme={theme}
            />
          </SectionCard>

          <SectionCard
            description={model.monthlyBriefing.subtitle}
            presentation="grouped"
            testID={testIds.insights.monthlyBriefingCard}
            title={model.monthlyBriefing.title}
          >
            <View style={styles.briefingStack}>
              <Text style={styles.briefingLead}>{model.monthlyBriefing.lead}</Text>
              <View style={styles.briefingMetrics}>
                <Text style={styles.briefingMetric}>{model.monthlyBriefing.periodDaysLabel}</Text>
                <Text style={styles.briefingMetric}>{model.monthlyBriefing.symptomDaysLabel}</Text>
              </View>
              <Text style={styles.briefingSignals}>{model.monthlyBriefing.topSignalsLabel}</Text>
            </View>
          </SectionCard>

          {/* Explore quick-links */}
          <SectionCard
            presentation="grouped"
            testID={testIds.insights.patternCard}
          >
            <Text style={styles.cardEyebrow}>{'Explore'}</Text>
            <View style={styles.exploreRows}>
              <ExploreRow
                title={'Cycle pattern'}
                subtitle={'How your length and phases change over time'}
                testID={testIds.insights.cyclePatternRow}
                onPress={() => {
                  router.push('/insights/cycle-pattern' as Href);
                }}
                styles={styles}
              />
              <ExploreRow
                title={t('insights.monthlyBriefing.exploreTitle')}
                subtitle={t('insights.monthlyBriefing.exploreSubtitle')}
                testID={testIds.insights.monthlyBriefingRow}
                onPress={() => {
                  router.push('/insights/monthly-briefing' as Href);
                }}
                styles={styles}
              />
              {model.ttcSummary ? (
                <ExploreRow
                  title={t('ttc.insights.exploreTitle')}
                  subtitle={t('ttc.insights.exploreSubtitle')}
                  testID={testIds.insights.ttcSummaryRow}
                  onPress={() => {
                    router.push('/insights/ttc' as Href);
                  }}
                  styles={styles}
                />
              ) : null}
              {model.conditionSummaries.length > 0 ? (
                model.conditionSummaries.map((conditionSummary, index) => (
                  <ExploreRow
                    key={conditionSummary.key}
                    title={conditionSummary.title}
                    subtitle={conditionSummary.summary}
                    testID={buildInsightsConditionRowTestId(conditionSummary.key)}
                    onPress={() => {
                      router.push(`/insights/condition/${conditionSummary.key}` as Href);
                    }}
                    styles={styles}
                    isLast={index === model.conditionSummaries.length - 1}
                  />
                ))
              ) : (
                <ExploreRow
                  title={t('insights.conditionSummary.exploreTitle')}
                  subtitle={t('insights.conditionSummary.exploreSubtitle')}
                  testID={testIds.insights.byConditionRow}
                  onPress={() => {
                    router.push('/settings/tracking-setup' as Href);
                  }}
                  styles={styles}
                  isLast
                />
              )}
            </View>
          </SectionCard>

          {/* UL-03: the privacy promise stays on the screen, but as the quiet
              colophon it is — never inside an insight-content slot (it used to
              masquerade as the "Pattern noticed" pull-quote). */}
          <Text style={styles.privacyFootnote} testID={testIds.insights.privacyFootnote}>
            {t('insights.cyclePattern.localPatternReadout')}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

type StyleMap = ReturnType<typeof createStyles>;

// UL-80: the bar track's fixed height in points. Bars are laid out
// bottom-aligned inside this track with pixel-snapped point heights, so all
// bar bottoms share one baseline on the same device pixel. 42 + label line
// (12) + gap (2) reproduces the chart's previous overall 56pt height exactly.
const CHART_TRACK_HEIGHT = 42;
const CHART_MIN_BAR_HEIGHT = 4;

function CycleLengthChart({
  data,
  emptyLabel,
  styles,
  theme,
}: {
  data: CycleLengthData;
  emptyLabel: string;
  styles: StyleMap;
  theme: FlorivaTheme;
}) {
  if (data.bars.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  const maxDays = Math.max(...data.bars.map((b) => b.days));

  return (
    <View style={styles.chartBars}>
      {data.bars.map((bar, index) => (
        <View key={index} style={styles.chartBar}>
          <View style={styles.chartBarTrack}>
            <View
              style={[
                styles.chartBarFill,
                // UL-80: pixel-snapped point heights from one shared track
                // constant. Independent percentage-string rounding could land
                // the saturated latest bar a device pixel off its pale
                // siblings' baseline, which read as a bar dipping below the
                // chart floor.
                {
                  height: Math.max(
                    PixelRatio.roundToNearestPixel(
                      (CHART_TRACK_HEIGHT * bar.days) / maxDays,
                    ),
                    CHART_MIN_BAR_HEIGHT,
                  ),
                },
                bar.isLatest
                  ? { backgroundColor: theme.colors.accentPrimary }
                  : { backgroundColor: theme.colors.accentSoft },
              ]}
              testID={testIds.insights.chartBarFill(index)}
            />
          </View>
          <Text style={styles.chartBarLabel}>{String(bar.days)}</Text>
        </View>
      ))}
    </View>
  );
}

const PHASE_ROWS = [
  { key: 'period' as const, colorKey: 'accentPrimary' as const },
  { key: 'follicular' as const, colorKey: 'accentSoft' as const },
  { key: 'fertile' as const, colorKey: 'moss' as const },
  { key: 'luteal' as const, colorKey: 'mossSoft' as const },
] as const;

function PhaseRhythmRows({
  data,
  formatDays,
  locale,
  showFertilityEstimates,
  styles,
  theme,
}: {
  data: PhaseRhythmData;
  formatDays: (count: number) => string;
  locale: SupportedLocale;
  showFertilityEstimates: boolean;
  styles: StyleMap;
  theme: FlorivaTheme;
}) {
  const phaseDays = {
    period: data.periodDays,
    follicular: data.follicularDays,
    fertile: data.fertileDays,
    luteal: data.lutealDays,
  };

  // UL-05: a short cycle can clamp a phase to zero days (e.g. no follicular
  // days between a 6-day period and the fertile window on a 25-day cycle --
  // see buildCyclePhaseBreakdown's waterfall). "Follicular 0d" with an empty
  // track read as broken math; the designed treatment (mirroring
  // CycleRibbon's legend) is to list only phases that actually occur in
  // this cycle.
  const visiblePhaseRows = (
    showFertilityEstimates
      ? PHASE_ROWS
      : PHASE_ROWS.filter((phase) => phase.key !== 'fertile')
  ).filter((phase) => phaseDays[phase.key] > 0);

  return (
    <View style={styles.phaseRows}>
      {visiblePhaseRows.map((phase, index) => {
        const days = phaseDays[phase.key];
        const barWidth = (
          data.cycleLengthDays > 0
            ? `${Math.round((days / data.cycleLengthDays) * 100)}%`
            : '0%'
        ) as `${number}%`;

        return (
          <View
            key={phase.key}
            style={[
              styles.phaseRow,
              index < visiblePhaseRows.length - 1 && styles.phaseRowBorder,
            ]}
          >
            <View style={styles.phaseLabelRow}>
              <Text style={styles.phaseLabel}>{formatCyclePhaseLabel(phase.key, locale)}</Text>
              {phase.key === 'fertile' ? (
                <HelpTooltip
                  body="Floriva estimates your fertile window and ovulation timing from your cycle history on this device. These are planning estimates only. They are not medical advice or contraception guidance."
                  testID="insights-fertility-help"
                  title="Fertile / ovulation"
                />
              ) : null}
            </View>
            <Text style={styles.phaseDays}>{formatDays(days)}</Text>
            <View style={styles.phaseBarTrack}>
              <View
                style={[
                  styles.phaseBarFill,
                  { width: barWidth, backgroundColor: theme.colors[phase.colorKey] },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ExploreRow({
  isLast = false,
  onPress,
  styles,
  subtitle,
  testID,
  title,
}: {
  isLast?: boolean;
  onPress: () => void;
  styles: StyleMap;
  subtitle: string;
  testID?: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${title}`}
      accessibilityHint={subtitle}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.exploreRow, !isLast && styles.exploreRowBorder]}
      testID={testID}
    >
      <View style={styles.exploreRowText}>
        <Text style={styles.exploreRowTitle}>{title}</Text>
        <Text style={styles.exploreRowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.exploreRowAction}>{'Open ›'}</Text>
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    titleComposite: {
      gap: theme.spacing.sm,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    eyebrowAccentBar: {
      width: 14,
      height: 1,
      backgroundColor: theme.colors.accentPrimary,
    },
    eyebrowLabel: {
      ...theme.typography.eyebrow,
      color: theme.colors.textSecondary,
    },
    displayTitle: {
      fontFamily: 'Newsreader_400Regular',
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: 0,
      color: theme.colors.textPrimary,
    },
    displayTitleAccent: {
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, which read
      // roman on iOS and faux-slant on Android).
      fontFamily: fontFamilies.serifRegularItalic,
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: 0,
      color: theme.colors.accentPrimary,
    },
    cardEyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    cardSubtitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    chartHeaderLeft: {
      flex: 1,
      gap: 2,
    },
    chartHeaderRight: {
      alignItems: 'flex-end',
    },
    avgNumeral: {
      ...theme.typography.numeral,
      fontSize: 32,
      lineHeight: 38,
      color: theme.colors.accentPrimary,
    },
    avgNumeralEstimate: {
      color: theme.colors.textSecondary,
    },
    avgLabel: {
      ...theme.typography.eyebrow,
      color: theme.colors.textTertiary,
    },
    chartBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    chartBar: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    chartBarTrack: {
      height: CHART_TRACK_HEIGHT,
      width: '100%',
      justifyContent: 'flex-end',
    },
    chartBarFill: {
      width: '100%',
      borderRadius: theme.radii.hairline,
    },
    chartBarLabel: {
      ...theme.typography.numeral,
      fontSize: 9,
      lineHeight: 12,
      color: theme.colors.textTertiary,
    },
    chartFootnote: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.sm,
    },
    chartEmpty: {
      paddingVertical: theme.spacing.md,
    },
    chartEmptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    phaseRows: {
      gap: 0,
    },
    phaseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    phaseRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderPrimary,
    },
    phaseLabel: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
    },
    phaseLabelRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    phaseDays: {
      ...theme.typography.numeral,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
      minWidth: 28,
      textAlign: 'right',
    },
    phaseBarTrack: {
      width: 72,
      height: 6,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.hairline,
      overflow: 'hidden',
    },
    phaseBarFill: {
      height: '100%',
      borderRadius: theme.radii.hairline,
      // Phase-4 contrast pass: the pale phase fills (mossSoft Luteal, accentSoft
      // Follicular) sit ~1.1:1 against the track, so the fill's extent — which
      // encodes the phase duration — was nearly unreadable. A hairline frame in
      // the muted ink gives every fill a legible boundary regardless of its
      // tonal contrast (non-text-contrast via a defined edge). The pale sage
      // tint is shared with the protected calendar fertile band, so it is not
      // recolored here.
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.textTertiary,
    },
    privacyFootnote: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },
    staleNote: {
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.accentPrimary,
      paddingLeft: 14,
    },
    staleNoteText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    briefingStack: {
      gap: theme.spacing.sm,
    },
    briefingLead: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    briefingMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    briefingMetric: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      overflow: 'hidden',
    },
    briefingSignals: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    exploreRows: {
      gap: 0,
    },
    exploreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    exploreRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderPrimary,
    },
    exploreRowText: {
      flex: 1,
      gap: 2,
    },
    exploreRowTitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    exploreRowSubtitle: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    exploreRowAction: {
      ...theme.typography.eyebrow,
      color: theme.colors.accentPrimary,
    },
  });
}
