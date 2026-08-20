import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { ConfidenceChip } from '@/src/components/primitives/ConfidenceChip';
import { ConfidenceImprovementList } from '@/src/components/primitives/ConfidenceImprovementList';
import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import {
  buildCalendarScreenModel,
  type CalendarScreenModel,
} from '@/src/features/calendar/buildCalendarScreenModel';
import { buildDayCellAccessibilityLabel } from '@/src/features/calendar/buildDayCellAccessibilityLabel';
import { CalendarGridLegendRow } from '@/src/features/calendar/components/CalendarGridLegendRow';
import { CalendarMonthGrid } from '@/src/features/calendar/components/CalendarMonthGrid';
import { legend as quietBandsLegend } from '@/src/features/calendar/components/gridVariants/quietBands';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { openInfoModal } from '@/src/features/navigation/infoModal';
import { useFocusRefreshVersion } from '@/src/lib/navigation/useOptionalFocusEffect';
import { isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';
import { buildConfidenceInfoModalContent } from '@/src/lib/predictions/buildConfidenceInfoModalContent';
import { formatMonthDayLabel } from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { TranslationKey } from '@/src/localization/translations';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type CalendarScreenProps = {
  todayIso?: string;
  windowHeightOverride?: number;
};

const compactCalendarHeightThreshold = 980;
const compactCalendarWeekScrollOffset = 72;
const compactCalendarBaseScrollOffset = 48;

/**
 * i18n keys for the quiet-bands legend items (the `legend` export from
 * gridVariants/quietBands.tsx carries dev-only English labels; the real
 * screen maps item keys to localized strings).
 */
const legendLabelKeys: Record<string, TranslationKey | undefined> = {
  period: 'calendar.monthlyView.legendLoggedPeriod',
  predicted: 'calendar.monthlyView.legendPredicted',
  fertile: 'calendar.monthlyView.legendFertile',
  logged: 'calendar.monthlyView.legendLogged',
  // UL-34/UL-41: the spotting dot's label was already localized in all 8
  // locales but never wired to a legend item.
  spotting: 'calendar.monthlyView.legendSpotting',
  selected: 'calendar.monthlyView.legendSelected',
};

function buildInitialCalendarScrollOffset({
  todayIso,
  weeks,
  windowHeight,
}: {
  todayIso: string;
  weeks: CalendarScreenModel['weeks'];
  windowHeight: number;
}) {
  // Compact-layout nudge: scroll the current week above the floating dock on
  // shorter windows. Requested unconditionally — the Screen primitive now
  // applies `initialScrollOffsetY` on every platform (imperative scrollTo
  // where RN's `contentOffset` prop is not honored) and no longer pre-seeds
  // its sticky collapse bar with an unapplied offset, which was the root of
  // the UL-71 Android double-title defect that a platform gate here used to
  // work around.
  if (windowHeight > compactCalendarHeightThreshold) {
    return 0;
  }

  const currentWeekIndex = weeks.findIndex((week) =>
    week.some((cell) => cell.date === todayIso && cell.inMonth),
  );

  if (currentWeekIndex < 3) {
    return compactCalendarBaseScrollOffset;
  }

  return (
    compactCalendarBaseScrollOffset +
    (currentWeekIndex - 2) * compactCalendarWeekScrollOffset
  );
}

export function CalendarScreen() {
  return <CalendarScreenContent />;
}

export function CalendarScreenContent({
  todayIso = getLocalTodayLogDate(),
  windowHeightOverride,
}: CalendarScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const windowDimensions = useWindowDimensions();
  const windowHeight = windowHeightOverride ?? windowDimensions.height;
  const isCompactCalendarLayout = windowHeight <= compactCalendarHeightThreshold;
  const [monthIso, setMonthIso] = useState(`${todayIso.slice(0, 7)}-01`);
  const [model, setModel] = useState<CalendarScreenModel>(() =>
    buildCalendarScreenModel({
      todayIso,
      monthIso,
      profile: defaultUserProfile,
      logEntries: [],
      locale: resolvedLocale,
    }),
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const refreshVersion = useFocusRefreshVersion();

  useEffect(() => {
    let isCancelled = false;

    async function hydrateCalendar() {
      setIsHydrating(true);
      setLoadErrorMessage(null);

      try {
        const [profile, logEntries, appPreferences] = await Promise.all([
          repositories.userProfile.getProfile(),
          // LT-23: was listByDateRange(monthIso - 365, monthIso + 62) --
          // anchored to the VIEWED month, not today, so flipping months
          // shifted the whole window and could silently drop old period
          // starts from the grid's prediction/history-derived counts,
          // disagreeing with Today/Settings on long-tenure history.
          // Widened to listAll() (same fix as LT-06 on Insights) so this
          // screen always sees every stored log regardless of which month
          // is being viewed.
          repositories.dailyLogs.listAll(),
          repositories.appPreferences?.getPreferences?.() ?? Promise.resolve(defaultAppPreferences),
        ]);

        if (isCancelled) {
          return;
        }

        setModel(
          buildCalendarScreenModel({
            todayIso,
            monthIso,
            profile: profile ?? defaultUserProfile,
            logEntries,
            locale: resolvedLocale,
            showFertilityEstimates: appPreferences.showFertilityEstimates ?? true,
          }),
        );
      } catch {
        if (isCancelled) {
          return;
        }

        setLoadErrorMessage(t('calendar.monthlyView.error'));
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateCalendar();

    return () => {
      isCancelled = true;
    };
  }, [
    monthIso,
    refreshVersion,
    repositories.appPreferences,
    repositories.dailyLogs,
    repositories.userProfile,
    resolvedLocale,
    t,
    todayIso,
  ]);

  function shiftVisibleMonth(deltaMonths: number) {
    const [yearPart, monthPart] = monthIso.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(yearPart, monthPart - 1 + deltaMonths, 1));

    setMonthIso(nextMonth.toISOString().slice(0, 10));
  }

  const selectedCell = model.weeks.flat().find((c) => c.date === selectedDate) ?? null;
  const selectedDateWeekday = new Intl.DateTimeFormat(resolvedLocale, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(isoDateToUtcMillis(selectedDate) + 12 * 60 * 60 * 1000));
  const selectedDateLabel = formatMonthDayLabel(selectedDate, resolvedLocale);
  const selectedDateTags: string[] = [];
  if (selectedCell?.isToday) selectedDateTags.push(t('calendar.dayCard.tagToday'));
  if (selectedCell?.marker === 'period') selectedDateTags.push(t('calendar.dayCard.tagPeriod'));
  if (selectedCell?.marker === 'spotting') selectedDateTags.push(t('calendar.dayCard.tagSpotting'));
  if (selectedCell?.marker === 'predicted-period') selectedDateTags.push(t('calendar.dayCard.tagPredicted'));
  if (selectedCell?.isFertile) selectedDateTags.push(t('calendar.dayCard.tagFertileWindow'));

  return (
    <Screen
      // Phase 2c chrome: the eyebrow renders above the month title on both
      // platforms via the Screen primitive; Android's divergent native-header
      // treatment is UL-71 and is deliberately not doubled here. The
      // 'standard' header variant styles the month title with the serif
      // typography.title token (Newsreader), the mockup's title treatment.
      eyebrow={t('calendar.screen.eyebrow')}
      headerVariant="standard"
      title={model.monthLabel}
      // UL-21: the chevrons used to float far right in an otherwise-empty
      // band below the title. They now sit in the header actions slot,
      // beside the serif month title — the "deliberate punctuation next to
      // the serif month title" placement the Phase 2c chrome intended.
      headerActions={
        <View style={styles.monthNavButtons}>
          <MotionPressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('calendar.monthlyView.previous')}
            feedbackType="action"
            hitSlop={6}
            motionVariant="secondary"
            onPress={() => {
              shiftVisibleMonth(-1);
            }}
            pressedStyle={styles.monthNavButtonPressed}
            revealPreset="rowShift"
            style={styles.monthNavButton}
            testID={testIds.calendar.previousMonthButton}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.monthNavGlyph}>
              {'‹'}
            </Text>
          </MotionPressableSurface>
          <MotionPressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('calendar.monthlyView.next')}
            feedbackType="action"
            hitSlop={6}
            motionVariant="secondary"
            onPress={() => {
              shiftVisibleMonth(1);
            }}
            pressedStyle={styles.monthNavButtonPressed}
            revealPreset="rowShift"
            style={styles.monthNavButton}
            testID={testIds.calendar.nextMonthButton}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.monthNavGlyph}>
              {'›'}
            </Text>
          </MotionPressableSurface>
        </View>
      }
      initialScrollOffsetY={buildInitialCalendarScrollOffset({
        todayIso,
        weeks: model.weeks,
        windowHeight,
      })}
      testID={testIds.calendar.screen}
    >
      {isHydrating ? <Text style={styles.statusText}>{t('calendar.monthlyView.loading')}</Text> : null}
      {loadErrorMessage ? (
        <Text accessibilityRole="alert" style={styles.statusText}>
          {loadErrorMessage}
        </Text>
      ) : null}
      {isHydrating || loadErrorMessage ? null : (
        <>
          <SectionCard
            presentation="unframed"
            testID={testIds.calendar.monthlyViewCard}
          >
            <View style={styles.legendHeader} testID={testIds.calendar.legendHeader}>
              <Text style={styles.legendTitle}>{t('calendar.monthlyView.legendTitle')}</Text>
              {model.showFertilityEstimates ? (
                <HelpTooltip
                  body={t('common.help.fertileWindow.body')}
                  closeLabel={t('common.actions.close')}
                  testID="calendar-fertile-window-help"
                  title={t('common.help.fertileWindow.title')}
                />
              ) : null}
            </View>
            <View style={styles.legendFrame}>
              <CalendarGridLegendRow
                getItemLabel={(item) => {
                  const labelKey = legendLabelKeys[item.key];
                  return labelKey ? t(labelKey) : item.label;
                }}
                getSwatchTestId={(item) =>
                  item.key === 'selected' ? testIds.calendar.legendSelectedSwatch : undefined
                }
                legend={
                  model.showFertilityEstimates
                    ? quietBandsLegend
                    : {
                        items: quietBandsLegend.items.filter((item) => item.key !== 'fertile'),
                      }
                }
                testID={testIds.calendar.legendRow}
              />
            </View>

            <View style={styles.confidenceSummary} testID={testIds.calendar.confidenceSummary}>
              <Text style={styles.summaryLabel} testID={testIds.calendar.nextPeriodLabel}>
                {model.predictionSummary.nextPeriodLabel}
              </Text>
              <ConfidenceChip
                accessibilityHint={t('tracker.confidence.chipHint')}
                accessibilityLabel={t('tracker.confidence.chipLabel', {
                  confidenceLabel: model.predictionSummary.confidenceLabel,
                })}
                label={model.predictionSummary.confidenceLabel}
                onPress={() =>
                  openInfoModal(
                    router,
                    buildConfidenceInfoModalContent(model.predictionSummary, resolvedLocale),
                  )
                }
                testID={testIds.calendar.confidenceChipButton}
              />
              <Text style={styles.confidenceBasis}>
                {model.predictionSummary.confidenceBasisLabel}
              </Text>
              <ConfidenceImprovementList improvements={model.improvements ?? []} />
            </View>

            <CalendarMonthGrid
              buildDayCellAccessibilityLabel={(date) =>
                buildDayCellAccessibilityLabel({
                  date,
                  // Quiet Bands communicates day states visually (bands,
                  // rings, dots), so the label carries the same facts for
                  // screen readers.
                  cell: model.weeks.flat().find((cell) => cell.date === date) ?? null,
                  t,
                })
              }
              dayCellAccessibilityHint={t('calendar.day.openHint')}
              isCompactLayout={isCompactCalendarLayout}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              // Phase 2c: Quiet Bands won the contact-sheet review
              // (docs/qa/2026-07-22-calendar-redesign/contact-sheet.md) and is
              // now the real calendar. The other variants + the dev gallery
              // stay for the Android parity pass.
              variant="quiet-bands"
              weekdayLabels={model.weekdayLabels}
              weeks={model.weeks}
            />
          </SectionCard>
          <SectionCard presentation="grouped">
            <View style={styles.dayCardHeader}>
              <View>
                <Text style={styles.dayCardWeekday}>{selectedDateWeekday}</Text>
                <Text style={styles.dayCardDate}>{selectedDateLabel}</Text>
              </View>
              {selectedCell?.cycleDay ? (
                <Text style={styles.dayCardCycleDay}>
                  {t('calendar.dayCard.cycleDay', { day: selectedCell.cycleDay })}
                </Text>
              ) : null}
            </View>
            {selectedDateTags.length > 0 ? (
              <View style={styles.dayCardTags}>
                {selectedDateTags.map((tag) => (
                  <View key={tag} style={styles.dayCardTag}>
                    <Text style={styles.dayCardTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.dayCardActions}>
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.push(`/calendar/day/${selectedDate}` as Href);
                }}
                style={styles.dayCardActionButton}
              >
                {t('calendar.dayCard.viewDay')}
              </ActionButton>
              <ActionButton
                onPress={() => {
                  router.push(`/calendar/day/${selectedDate}` as Href);
                }}
                style={styles.dayCardActionButton}
              >
                {t('calendar.dayCard.editLog')}
              </ActionButton>
            </View>
          </SectionCard>
          {model.recentCycles.length > 0 ? (
            <View style={styles.recentCyclesSection} testID={testIds.calendar.recentHistoryCard}>
              <View style={styles.recentCyclesHeaderRow}>
                <View style={styles.recentCyclesEyebrowAccent} />
                <Text style={styles.recentCyclesEyebrow}>
                  {t('calendar.recentCycles.eyebrow')}
                </Text>
              </View>
              {model.recentCycles.map((cycle) => (
                <View key={cycle.startDate} style={styles.recentCycleRow}>
                  <Text style={styles.recentCycleRange}>{cycle.rangeLabel}</Text>
                  <Text style={styles.recentCycleDays}>
                    {t('calendar.recentCycles.days', { count: cycle.lengthDays })}
                  </Text>
                </View>
              ))}
              <View style={styles.recentCyclesActions}>
                <ActionButton
                  appearance="secondary"
                  onPress={() => {
                    router.push('/calendar/timeline' as Href);
                  }}
                  testID={testIds.calendar.timelineOpenButton}
                >
                  {t('calendar.timeline.openButton')}
                </ActionButton>
                <ActionButton
                  appearance="secondary"
                  onPress={() => {
                    router.push('/calendar/history' as Href);
                  }}
                >
                  {t('calendar.history.title')}
                </ActionButton>
                <ActionButton
                  appearance="secondary"
                  onPress={() => {
                    router.push('/calendar/about-estimates' as Href);
                  }}
                >
                  {t('calendar.estimate.title')}
                </ActionButton>
              </View>
            </View>
          ) : (
            <View style={styles.detailActionRow} testID={testIds.calendar.recentHistoryCard}>
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.push('/calendar/timeline' as Href);
                }}
                testID={testIds.calendar.timelineOpenButton}
              >
                {t('calendar.timeline.openButton')}
              </ActionButton>
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.push('/calendar/history' as Href);
                }}
              >
                {t('calendar.history.title')}
              </ActionButton>
              <ActionButton
                appearance="secondary"
                onPress={() => {
                  router.push('/calendar/about-estimates' as Href);
                }}
              >
                {t('calendar.estimate.title')}
              </ActionButton>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    statusText: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    summaryStrip: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
    },
    summaryItem: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    summaryLabel: {
      // UL-06: the payload ("Next period expected Aug 11 to 15") is the
      // banner's reason to exist — it leads. The confidence chip and basis
      // line below stay secondary.
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    confidenceSummary: {
      gap: 4,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    confidenceBasis: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    monthNavButtons: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    monthNavButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      // Thin ink outline circle (Phase 2c chrome) — reads as deliberate
      // punctuation next to the serif month title rather than a faint rule.
      borderColor: theme.colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthNavButtonPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    monthNavGlyph: {
      fontFamily: 'Newsreader_400Regular',
      fontSize: 20,
      lineHeight: 22,
      color: theme.colors.textPrimary,
    },
    monthLabel: {
      flex: 1,
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    detailActionRow: {
      gap: theme.spacing.sm,
    },
    legendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    legendTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.caption,
    },
    legendFrame: {
      paddingBottom: theme.spacing.xs,
    },
    dayCardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    dayCardWeekday: {
      ...theme.typography.eyebrow,
      color: theme.colors.textMuted,
      marginBottom: 2,
    },
    dayCardDate: {
      ...theme.typography.title,
      fontSize: 20,
      lineHeight: 24,
      color: theme.colors.textPrimary,
    },
    dayCardCycleDay: {
      ...theme.typography.numeral,
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textMuted,
    },
    dayCardTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: theme.spacing.sm,
    },
    dayCardTag: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: theme.colors.surfacePrimary,
    },
    dayCardTagText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    dayCardActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    dayCardActionButton: {
      flex: 1,
    },
    recentCyclesSection: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    recentCyclesHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    recentCyclesEyebrowAccent: {
      width: 14,
      height: 1,
      backgroundColor: theme.colors.accentPrimary,
    },
    recentCyclesEyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.textTertiary,
    },
    recentCycleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderPrimary,
    },
    recentCycleRange: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    recentCycleDays: {
      ...theme.typography.numeral,
      fontSize: 13,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },
    recentCyclesActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
  });
}
