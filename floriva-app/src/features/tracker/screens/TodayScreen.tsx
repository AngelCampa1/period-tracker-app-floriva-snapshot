import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { AnomalyNudge } from '@/src/components/primitives/AnomalyNudge';
import { ConfidenceChip } from '@/src/components/primitives/ConfidenceChip';
import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { Arc } from '@/src/components/editorial/ornaments/Arc';
import { CycleRibbon } from '@/src/components/editorial/CycleRibbon';
import { EditorialRule } from '@/src/components/editorial/EditorialRule';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { appendDismissedAnomalyId } from '@/src/db/repositories';
import {
  createDefaultPredictionSnapshot,
  defaultUserProfile,
} from '@/src/features/app-shell/defaults';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { LogTodayButton } from '@/src/features/logging/components/LogTodayButton';
import { TodaySummaryCard } from '@/src/features/logging/screens/TodaySummaryCard';
import { NoRemindersNudge } from '@/src/features/tracker/components/NoRemindersNudge';
import { ConfidenceImprovementList } from '@/src/components/primitives/ConfidenceImprovementList';
import { QuickLogPeriodButton } from '@/src/features/tracker/components/QuickLogPeriodButton';
import { buildTodaySnapshot } from '@/src/features/tracker/buildTodaySnapshot';
import { openInfoModal } from '@/src/features/navigation/infoModal';
import { useFocusRefreshVersion } from '@/src/lib/navigation/useOptionalFocusEffect';
import { buildConfidenceInfoModalContent } from '@/src/lib/predictions/buildConfidenceInfoModalContent';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type { PredictionSnapshot } from '@/src/types/domain';

type TodayScreenProps = {
  todayIso?: string;
};

export function TodayScreen() {
  return <TodayScreenContent todayIso={getLocalTodayLogDate()} />;
}

export function TodayScreenContent({ todayIso = getLocalTodayLogDate() }: TodayScreenProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { repositories } = useDatabase();
  const { clearPendingEntryRoute, state } = useAppShell();
  const { resolvedLocale, t } = useLocalization();
  const [snapshot, setSnapshot] = useState<PredictionSnapshot>(() =>
    createDefaultPredictionSnapshot(resolvedLocale),
  );
  const [isSnapshotHydrating, setIsSnapshotHydrating] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const focusRefreshVersion = useFocusRefreshVersion();
  const [quickLogVersion, setQuickLogVersion] = useState(0);
  // Both addends only ever increment, so their sum strictly increases
  // whenever either source fires — it can never revisit an earlier value,
  // which is all a dependency-array refresh key needs.
  const refreshVersion = focusRefreshVersion + quickLogVersion;
  const [hasActiveReminders, setHasActiveReminders] = useState<boolean>(true);
  const [reminderNudgeDismissed, setReminderNudgeDismissed] = useState(false);
  const [showFertilityEstimates, setShowFertilityEstimates] = useState(true);
  // B5: the anomaly nudge shown right now, separate from `snapshot.anomaly`
  // so dismissal can hide it INSTANTLY (mirroring reminderNudgeDismissed)
  // without waiting for a full re-hydrate round trip to confirm the write.
  const [visibleAnomaly, setVisibleAnomaly] = useState<PredictionSnapshot['anomaly']>(undefined);

  useEffect(() => {
    if (state.pendingEntryRoute !== '/today') {
      return;
    }

    if (state.billingAccessState === 'sync_error') {
      return;
    }

    void clearPendingEntryRoute();
  }, [clearPendingEntryRoute, state.billingAccessState, state.pendingEntryRoute]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSnapshot() {
      setIsSnapshotHydrating(true);
      setSnapshot(createDefaultPredictionSnapshot(resolvedLocale));

      try {
        const [profile, logEntries, reminderPreferences, appPreferences] = await Promise.all([
          repositories.userProfile.getProfile(),
          // LT-23: was listByDateRange(todayIso - 365, todayIso) -- a
          // 365-day window that could silently drop old period starts from
          // "N cycles" (buildTodaySnapshot -> prediction.history.startDates
          // .length), disagreeing with Calendar/Settings on long-tenure
          // history. Widened to listAll() (same fix + rationale as LT-06 on
          // Insights) so all three surfaces report "total period starts on
          // record" from the SAME unbounded read. The engine's own
          // statistics still self-window to the most recent 12 intervals
          // for the cycle-length ESTIMATE (MAX_INTERVAL_WINDOW,
          // cycleStatistics.ts) -- only the read window changed, not the
          // engine's behavior.
          repositories.dailyLogs.listAll(),
          repositories.reminderPreferences.getPreferences(),
          repositories.appPreferences?.getPreferences?.() ?? Promise.resolve(defaultAppPreferences),
        ]);

        if (isCancelled) {
          return;
        }

        const nextSnapshot = buildTodaySnapshot({
          todayIso,
          profile: profile ?? defaultUserProfile,
          logEntries,
          locale: resolvedLocale,
          dismissedAnomalyIds: appPreferences.dismissedAnomalyIds ?? [],
        });

        setSnapshot(nextSnapshot);
        setVisibleAnomaly(nextSnapshot.anomaly);
        setShowFertilityEstimates(appPreferences.showFertilityEstimates ?? true);
        setSnapshotError(null);
        setHasActiveReminders(
          reminderPreferences.some((preference) => preference.enabled),
        );
      } catch {
        if (isCancelled) {
          return;
        }

        setSnapshot(createDefaultPredictionSnapshot(resolvedLocale));
        setSnapshotError(t('tracker.snapshot.error'));
      } finally {
        if (!isCancelled) {
          setIsSnapshotHydrating(false);
        }
      }
    }

    void hydrateSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [
    refreshVersion,
    repositories.dailyLogs,
    repositories.reminderPreferences,
    repositories.appPreferences,
    repositories.userProfile,
    resolvedLocale,
    t,
    todayIso,
  ]);

  // B5: mirrors NoRemindersNudge's dismissal exactly -- hide the nudge
  // immediately (no waiting on the write) while persisting in the
  // background via appendDismissedAnomalyId's structural 50-cap, so a
  // dismissed anomaly never resurfaces on a later focus/hydrate (see
  // TodayScreen.test.tsx's "does not resurrect" case). Unlike the reminder
  // nudge (session-only `reminderNudgeDismissed` state), this dismissal
  // must survive across focuses, so it is written to AppPreferences rather
  // than kept purely in local state.
  async function handleDismissAnomaly(anomalyId: string) {
    setVisibleAnomaly(undefined);

    if (!repositories.appPreferences) {
      return;
    }

    try {
      const preferences = await repositories.appPreferences.getPreferences();

      await repositories.appPreferences.savePreferences({
        ...preferences,
        dismissedAnomalyIds: appendDismissedAnomalyId(
          preferences.dismissedAnomalyIds ?? [],
          anomalyId,
        ),
      });
    } catch {
      // Best-effort persistence: the nudge is already hidden for this
      // session (setVisibleAnomaly above). If the write fails, the same
      // anomaly may resurface on the next hydrate -- an acceptable
      // degradation matching how the rest of this screen already handles
      // repository failures (see the hydrate effect's catch block).
    }
  }

  // LT-24: same staleness signal as LT-04/LT-09/LT-27 (`stale-history` on
  // confidence.reasonCodes) -- see buildTodaySnapshot.ts for why the
  // headline/caption strings themselves already swap to a neutral
  // acknowledgment; this screen-level flag additionally suppresses the
  // phase-ribbon block below.
  const isStale = snapshot.confidenceReasonCodes.includes('stale-history');

  return (
    <Screen
      eyebrow={t('tracker.screen.eyebrow')}
      title="Floriva"
      testID={testIds.today.screen}
    >
      <SectionCard
        presentation="unframed"
        testID={testIds.today.snapshotCard}
      >
        <View style={styles.stack}>
          {isSnapshotHydrating ? <Text style={styles.body}>{t('tracker.snapshot.loading')}</Text> : null}
          {snapshotError ? <Text style={styles.body}>{snapshotError}</Text> : null}
          {isSnapshotHydrating ? null : (
            <>
              {/* Hero: big cycle day numeral + label stack with Arc ornament */}
              <View style={styles.heroZone}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                  style={styles.heroArc}
                >
                  <Arc color={theme.colors.accentPrimary} size={160} opacity={0.55} />
                </View>
                <View style={styles.eyebrowRow}>
                  <View style={styles.eyebrowAccentLine} />
                  <Text style={styles.metricLabel}>{t('tracker.snapshot.rightNowLabel')}</Text>
                </View>
                {/* LT-30 (residual of LT-24): the hero numeral/label were
                    the last place on Today still asserting "13 / Cycle
                    day 13 of 29" -- a confident present-tense claim built
                    on the same rolled synthetic anchor the hedged
                    headline below (and the suppressed "This cycle" ribbon
                    further down) already refuse to assert while stale.
                    UL-08 (supersedes LT-30's en-dash placeholder): the
                    en-dash at hero-numeral size rendered as a solid oxblood
                    rectangle -- a redaction bar/broken asset -- in the
                    comeback moment. The stale hero now drops the numeral
                    glyph entirely and lets the existing neutral "Awaiting
                    an update" label carry the hero slot in the serif
                    display voice. */}
                {isStale ? (
                  <View style={styles.heroRow}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={styles.heroStaleLabel}
                      testID={testIds.today.heroLabel}
                    >
                      {t('predictions.today.staleHeroLabel')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroRow}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={styles.heroNumeral}
                      testID={testIds.today.heroNumeral}
                    >
                      {snapshot.cycleDay}
                    </Text>
                    <View style={styles.heroLabelStack}>
                      <Text style={styles.heroLabel} testID={testIds.today.heroLabel}>
                        {snapshot.cycleDayLabel}
                      </Text>
                      <Text style={styles.heroSubLabel}>
                        {t('tracker.snapshot.cycleLengthTotal', {
                          count: snapshot.cycleLengthDays,
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Serif headline with italic last word + caption */}
              {showFertilityEstimates ? (
                <View style={styles.headlinePanel}>
                  <View style={styles.inlineHelpRow}>
                    <ItalicHeadline label={snapshot.fertileWindowLabel} styles={styles} />
                    <HelpTooltip
                      body={t('common.help.fertileWindow.body')}
                      closeLabel={t('common.actions.close')}
                      testID="today-fertile-window-help"
                      title={t('common.help.fertileWindow.title')}
                    />
                  </View>
                  {snapshot.fertileWindowCaption ? (
                    <Text style={styles.caption}>{snapshot.fertileWindowCaption}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Two chips: confidence (filled dark) + history (outlined) */}
              <View style={styles.chipRow}>
                <ConfidenceChip
                  accessibilityHint={t('tracker.confidence.chipHint')}
                  accessibilityLabel={t('tracker.confidence.chipLabel', {
                    confidenceLabel: snapshot.confidenceLabel,
                  })}
                  label={snapshot.confidenceLabel}
                  onPress={() =>
                    openInfoModal(
                      router,
                      buildConfidenceInfoModalContent(snapshot, resolvedLocale),
                    )
                  }
                  // UL-20: the filled variant is warm espresso by default in
                  // the ConfidenceChip primitive now — the Wave B call-site
                  // color override has been promoted into the component.
                  testID={testIds.today.confidenceChipButton}
                  variant="filled"
                />
                {snapshot.historyChipLabel ? (
                  <View style={styles.chipOutlined}>
                    <Text style={styles.chipOutlinedText}>{snapshot.historyChipLabel}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.confidenceSummary} testID={testIds.today.confidenceSummary}>
                <Text style={styles.confidenceBasis}>{snapshot.confidenceBasisLabel}</Text>
                <ConfidenceImprovementList improvements={snapshot.improvements ?? []} />
              </View>

              {/* Phase ribbon -- LT-24: hidden while the prediction is stale.
                  The ribbon's cycle-day marker and phase segments are built
                  from the same rolled synthetic anchor as the fertile-window
                  claim above; showing a confident "day 13 of 29" breakdown
                  right above the missed-period nudge would be the same trust
                  violation the headline swap above already fixes. Suppressed
                  outright (matching LT-09's calendar-shading precedent)
                  rather than relabeled "estimate" -- there is no real
                  in-cycle position to estimate once the anchor has rolled
                  forward past actual logged history. */}
              {isStale ? null : (
                <>
                  <EditorialRule mark={t('tracker.snapshot.thisCycleLabel')} />
                  <CycleRibbon
                    cycleDay={snapshot.cycleDay}
                    cycleLengthDays={snapshot.cycleLengthDays}
                    periodLengthDays={snapshot.periodLengthDays}
                    showFertilityEstimates={showFertilityEstimates}
                    fertileWindowStartOffsetDays={snapshot.fertileWindowStartOffsetDays}
                    locale={resolvedLocale}
                  />
                </>
              )}
            </>
          )}
        </View>
      </SectionCard>

      {!hasActiveReminders && !reminderNudgeDismissed ? (
        <NoRemindersNudge onDismiss={() => setReminderNudgeDismissed(true)} />
      ) : null}

      {visibleAnomaly ? (
        <AnomalyNudge anomaly={visibleAnomaly} onDismiss={handleDismissAnomaly} />
      ) : null}

      <QuickLogPeriodButton
        todayIso={todayIso}
        snapshot={snapshot}
        refreshVersion={refreshVersion}
        onLogged={() => setQuickLogVersion((currentVersion) => currentVersion + 1)}
      />

      <LogTodayButton logDate={todayIso} />

      <TodaySummaryCard
        logDate={todayIso}
        locale={resolvedLocale}
        refreshKey={refreshVersion}
      />
    </Screen>
  );
}

type HeadlineStyles = ReturnType<typeof createStyles>;

function ItalicHeadline({ label, styles }: { label: string; styles: HeadlineStyles }) {
  const words = label.split(' ');
  const lastWord = words.length > 1 ? words[words.length - 1] : null;
  const rest = words.length > 1 ? words.slice(0, -1).join(' ') : label;

  return (
    <Text style={styles.snapshotHeadline}>
      {/* VF-10b: a non-breaking space binds the final italic word to the word
          before it, so when the headline wraps the emphasized word can never
          strand alone on the last line (e.g. italic "days" / "today"). */}
      {lastWord ? `${rest}\u00A0` : rest}
      {lastWord ? <Text style={styles.snapshotHeadlineEmphasis}>{lastWord}</Text> : null}
    </Text>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    heroNumeral: {
      ...theme.typography.numeral,
      fontSize: 88,
      lineHeight: 96,
      color: theme.colors.accentPrimary,
    },
    heroLabelStack: {
      flex: 1,
      gap: 2,
    },
    heroLabel: {
      ...theme.typography.body,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    // UL-08: stale-state hero — the calm serif voice at a hero-adjacent
    // size, in secondary ink so it reads as a quiet status, not a claim.
    heroStaleLabel: {
      ...theme.typography.title,
      fontSize: 24,
      lineHeight: 30,
      color: theme.colors.textSecondary,
    },
    heroSubLabel: {
      ...theme.typography.body,
      fontSize: 11,
      color: theme.colors.textTertiary,
    },
    metricLabel: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
    },
    heroZone: {
      position: 'relative',
      gap: theme.spacing.sm,
    },
    heroArc: {
      position: 'absolute',
      top: -30,
      right: -90,
      zIndex: 0,
    },
    headlinePanel: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    inlineHelpRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eyebrowAccentLine: {
      width: 14,
      height: 1,
      backgroundColor: theme.colors.accentPrimary,
    },
    snapshotHeadline: {
      flex: 1,
      color: theme.colors.textPrimary,
      ...theme.typography.title,
      fontSize: 26,
      lineHeight: 30,
    },
    snapshotHeadlineEmphasis: {
      color: theme.colors.accentPrimary,
      ...theme.typography.title,
      // UL-70: true italic serif face, applied after the spread so it wins over
      // the roman family in `typography.title` (was `fontStyle: 'italic'`).
      fontFamily: fontFamilies.serifMediumItalic,
      fontSize: 26,
      lineHeight: 30,
    },
    caption: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
      fontSize: 15,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    confidenceSummary: {
      gap: 4,
      paddingTop: theme.spacing.xs,
    },
    confidenceBasis: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    chipOutlined: {
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: 'transparent',
    },
    chipOutlinedText: {
      color: theme.colors.textPrimary,
      ...theme.typography.caption,
    },
  });
}
