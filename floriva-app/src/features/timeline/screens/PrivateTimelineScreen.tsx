import { useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import {
  buildPrivateTimelineModel,
  type PrivateTimelineCopy,
} from '@/src/features/timeline/buildPrivateTimelineModel';
import {
  formatLocalTimelineDate,
  normalizeTimelineDate,
} from '@/src/features/timeline/date';
import type {
  PrivateTimelineImportSummary,
  PrivateTimelineItem,
  PrivateTimelineItemKind,
  PrivateTimelineModel,
  PrivateTimelineReminderSummary,
} from '@/src/features/timeline/types';
import { buildReminderPlans } from '@/src/lib/notifications/buildReminderPlans';
import {
  formatMonthDayLabel,
  formatMonthDayLabelWithYearIfNotCurrent,
} from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import {
  buildPrivateTimelineFilterTestId,
  buildPrivateTimelineItemTestId,
  testIds,
} from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type {
  BirthControlMethod,
  CervicalMucusValue,
  ImportSource,
  ImportSession,
  OvulationTestValue,
} from '@/src/types/domain';

type PrivateTimelineFilter = 'all' | PrivateTimelineItemKind;

type PrivateTimelineScreenProps = {
  todayIso?: string;
};

const timelineFilters: {
  kind: PrivateTimelineFilter;
  labelKey:
    | 'calendar.timeline.filterAll'
    | 'calendar.timeline.filterLogs'
    | 'calendar.timeline.filterNotes'
    | 'calendar.timeline.filterTtc'
    | 'calendar.timeline.filterBirthControl'
    | 'calendar.timeline.filterImports'
    | 'calendar.timeline.filterReminders'
    | 'calendar.timeline.filterBackups';
}[] = [
  { kind: 'all', labelKey: 'calendar.timeline.filterAll' },
  { kind: 'daily-log', labelKey: 'calendar.timeline.filterLogs' },
  { kind: 'note', labelKey: 'calendar.timeline.filterNotes' },
  { kind: 'ttc', labelKey: 'calendar.timeline.filterTtc' },
  { kind: 'birth-control', labelKey: 'calendar.timeline.filterBirthControl' },
  { kind: 'import', labelKey: 'calendar.timeline.filterImports' },
  { kind: 'reminder', labelKey: 'calendar.timeline.filterReminders' },
  { kind: 'backup', labelKey: 'calendar.timeline.filterBackups' },
];

function goBackOrReplace(
  router: Pick<ReturnType<typeof useRouter>, 'back' | 'canGoBack' | 'replace'>,
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/calendar' as Href);
}

function formatReminderLabel(
  plan: ReturnType<typeof buildReminderPlans>[number],
  t: ReturnType<typeof useLocalization>['t'],
) {
  switch (plan.kind) {
    case 'daily-log':
      return t('calendar.timeline.rows.dailyLogReminderTitle');
    case 'period-start':
      return t('calendar.timeline.rows.periodReminderTitle');
    case 'fertile-window':
      return t('calendar.timeline.rows.fertileWindowReminderTitle');
    case 'birth-control':
      return t('calendar.timeline.rows.birthControlReminderTitle');
  }
}

function buildTimelineCopy(
  t: ReturnType<typeof useLocalization>['t'],
  locale: ReturnType<typeof useLocalization>['resolvedLocale'],
): PrivateTimelineCopy {
  return {
    bleeding: {
      none: t('calendar.timeline.rows.bleedingNone'),
      spotting: t('calendar.timeline.rows.bleedingSpotting'),
      light: t('calendar.timeline.rows.bleedingLight'),
      medium: t('calendar.timeline.rows.bleedingMedium'),
      heavy: t('calendar.timeline.rows.bleedingHeavy'),
    },
    mood: {
      steady: t('calendar.timeline.rows.moodSteady'),
      low: t('calendar.timeline.rows.moodLow'),
      sensitive: t('calendar.timeline.rows.moodSensitive'),
      energized: t('calendar.timeline.rows.moodEnergized'),
    },
    symptoms: {
      cramps: t('calendar.timeline.rows.symptomCramps'),
      headache: t('calendar.timeline.rows.symptomHeadache'),
      bloating: t('calendar.timeline.rows.symptomBloating'),
      fatigue: t('calendar.timeline.rows.symptomFatigue'),
      'breast-tenderness': t('calendar.timeline.rows.symptomBreastTenderness'),
      acne: t('calendar.timeline.rows.symptomAcne'),
      discharge: t('calendar.timeline.rows.symptomDischarge'),
      'sleep-changes': t('calendar.timeline.rows.symptomSleepChanges'),
      'libido-changes': t('calendar.timeline.rows.symptomLibidoChanges'),
      sex: t('calendar.timeline.rows.symptomSex'),
    },
    titles: {
      dailyLog: t('calendar.timeline.rows.dailyLogTitle'),
      note: t('calendar.timeline.rows.noteTitle'),
      ttc: t('calendar.timeline.rows.ttcTitle'),
      birthControl: t('calendar.timeline.rows.birthControlTitle'),
      monthlyBriefing: t('insights.monthlyBriefing.exploreTitle'),
      import: (source) => t('calendar.timeline.rows.importTitle', {
        source: formatImportSourceLabel(source, t),
      }),
      backupExported: t('calendar.timeline.rows.backupExportedTitle'),
      backupRestored: t('calendar.timeline.rows.backupRestoredTitle'),
    },
    meta: {
      importedHistory: t('calendar.timeline.rows.importedHistoryMeta'),
      fertilityContext: t('calendar.timeline.rows.fertilityContextMeta'),
      birthControlTracking: t('calendar.timeline.rows.birthControlTrackingMeta'),
      switchingHistory: t('calendar.timeline.rows.switchingHistoryMeta'),
      monthlyBriefing: t('insights.monthlyBriefing.detailDescription'),
      activeLocalReminder: t('calendar.timeline.rows.activeLocalReminderMeta'),
      reminderAvailable: t('calendar.timeline.rows.reminderAvailableMeta'),
      encryptedBackup: t('calendar.timeline.rows.encryptedBackupMeta'),
    },
    detail: {
      list: (values) => formatLocalizedList(values, t),
      ovulationTest: (value) =>
        t('calendar.timeline.rows.ovulationTestDetail', {
          value: formatOvulationTestLabel(value as OvulationTestValue, t),
        }),
      cervicalMucus: (value) =>
        t('calendar.timeline.rows.cervicalMucusDetail', {
          value: formatCervicalMucusLabel(value as CervicalMucusValue, t),
        }),
      basalBodyTemperature: (value) => t('calendar.timeline.rows.bbtDetail', { value }),
      sexLogged: t('calendar.timeline.rows.sexLoggedDetail'),
      ttcLogged: t('calendar.timeline.rows.ttcLoggedDetail'),
      birthControlMethod: (method) =>
        t('calendar.timeline.rows.birthControlMethodDetail', {
          method: formatBirthControlMethodLabel(method as BirthControlMethod, t),
        }),
      missedDose: t('calendar.timeline.rows.missedDoseDetail'),
      lateDose: t('calendar.timeline.rows.lateDoseDetail'),
      noteSaved: t('calendar.timeline.rows.noteSavedDetail'),
      entriesImported: (count) =>
        t(count === 1 ? 'calendar.timeline.rows.entryImported' : 'calendar.timeline.rows.entriesImported', {
          count,
        }),
      skippedEntries: (count) => t('calendar.timeline.rows.skippedEntries', { count }),
      monthlyBriefing: (count) =>
        locale === 'en' && count === 1
          ? '1 local log reviewed'
          : t('insights.monthlyBriefing.subtitle', { count }),
      backupExported: t('calendar.timeline.rows.backupExportedDetail'),
      backupRestored: t('calendar.timeline.rows.backupRestoredDetail'),
    },
  };
}

function formatOvulationTestLabel(
  value: OvulationTestValue,
  t: ReturnType<typeof useLocalization>['t'],
) {
  switch (value) {
    case 'negative':
      return t('calendar.timeline.rows.ovulationTestNegative');
    case 'positive':
      return t('calendar.timeline.rows.ovulationTestPositive');
    case 'peak':
      return t('calendar.timeline.rows.ovulationTestPeak');
  }
}

function formatCervicalMucusLabel(
  value: CervicalMucusValue,
  t: ReturnType<typeof useLocalization>['t'],
) {
  switch (value) {
    case 'dry':
      return t('calendar.timeline.rows.cervicalMucusDry');
    case 'sticky':
      return t('calendar.timeline.rows.cervicalMucusSticky');
    case 'creamy':
      return t('calendar.timeline.rows.cervicalMucusCreamy');
    case 'egg-white':
      return t('calendar.timeline.rows.cervicalMucusEggWhite');
  }
}

function formatBirthControlMethodLabel(
  method: BirthControlMethod,
  t: ReturnType<typeof useLocalization>['t'],
) {
  switch (method) {
    case 'none':
      return t('calendar.timeline.rows.birthControlMethodNone');
    case 'pill':
      return t('calendar.timeline.rows.birthControlMethodPill');
    case 'iud':
      return t('calendar.timeline.rows.birthControlMethodIud');
    case 'implant':
      return t('calendar.timeline.rows.birthControlMethodImplant');
    case 'ring':
      return t('calendar.timeline.rows.birthControlMethodRing');
    case 'patch':
      return t('calendar.timeline.rows.birthControlMethodPatch');
    case 'other':
      return t('calendar.timeline.rows.birthControlMethodOther');
  }
}

function formatImportSourceLabel(
  source: ImportSource,
  t: ReturnType<typeof useLocalization>['t'],
) {
  switch (source) {
    case 'clue':
      return t('calendar.timeline.rows.sourceClue');
    case 'flo':
      return t('calendar.timeline.rows.sourceFlo');
    case 'manual':
      return t('calendar.timeline.rows.sourceManual');
  }
}

function formatLocalizedList(
  values: string[],
  t: ReturnType<typeof useLocalization>['t'],
) {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0]!;
  }

  return t('calendar.timeline.rows.listJoin', {
    first: values.slice(0, -1).join(', '),
    last: values[values.length - 1]!,
  });
}

function buildReminderSummaries(
  plans: ReturnType<typeof buildReminderPlans>,
  todayIso: string,
  t: ReturnType<typeof useLocalization>['t'],
): PrivateTimelineReminderSummary[] {
  return plans.map((plan) => ({
    kind: plan.kind,
    enabled: true,
    date:
      plan.trigger.type === 'daily'
        ? todayIso
        : formatLocalTimelineDate(plan.trigger.date),
    label: formatReminderLabel(plan, t),
    detail:
      plan.trigger.type === 'daily'
        ? t('calendar.timeline.rows.reminderDailyAt', {
            time: `${String(plan.trigger.hour).padStart(2, '0')}:${String(
              plan.trigger.minute,
            ).padStart(2, '0')}`,
          })
        : plan.kind === 'period-start'
          ? t('calendar.timeline.rows.periodReminderDetail')
          : t('calendar.timeline.rows.fertileWindowReminderDetail'),
  }));
}

function buildImportSummaries(
  importSessions: ImportSession[],
): PrivateTimelineImportSummary[] {
  const uniqueById = new Map<string, PrivateTimelineImportSummary>();

  for (const importSession of importSessions) {
    if (importSession.status !== 'committed') {
      continue;
    }

    uniqueById.set(importSession.id, {
      id: importSession.id,
      source: importSession.source,
      status: importSession.status,
      startedAt: importSession.startedAt,
      completedAt: importSession.completedAt,
      importedLogCount: importSession.importedLogCount,
      skippedLogCount: importSession.skippedLogCount,
    });
  }

  return [...uniqueById.values()];
}

function TimelineItemRow({
  item,
  locale,
  todayIso,
  privateBadgeLabel,
  onPress,
  actionLabel,
}: {
  item: PrivateTimelineItem;
  locale: Parameters<typeof formatMonthDayLabel>[1];
  // LT-20: a bare "Jul 2" is ambiguous once a long-tenure user's timeline
  // spans more than one calendar year -- two entries a year apart render
  // identically. `todayIso` is the reference "current year" -- see
  // formatMonthDayLabelWithYearIfNotCurrent (presentation.ts).
  todayIso: string;
  privateBadgeLabel: string;
  onPress: () => void;
  actionLabel: string;
}) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateLabel = formatMonthDayLabelWithYearIfNotCurrent(item.date, todayIso, locale);
  const accessibilityLabel = [
    dateLabel,
    item.title,
    item.detail,
    item.meta,
    item.sensitive ? privateBadgeLabel : null,
    actionLabel,
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.timelineRow}
      testID={buildPrivateTimelineItemTestId(item.id)}
    >
      <View style={styles.timelineDateFrame}>
        <Text style={styles.timelineDate}>{dateLabel}</Text>
      </View>
      <View style={styles.timelineCopy}>
        <View style={styles.timelineTitleRow}>
          <Text style={styles.timelineTitle}>{item.title}</Text>
          {item.sensitive ? (
            <Text style={styles.sensitiveBadge}>{privateBadgeLabel}</Text>
          ) : null}
        </View>
        <Text
          numberOfLines={item.kind === 'note' ? 2 : undefined}
          style={styles.timelineDetail}
        >
          {item.detail}
        </Text>
        {item.meta ? <Text style={styles.timelineMeta}>{item.meta}</Text> : null}
      </View>
    </Pressable>
  );
}

export function PrivateTimelineScreen({
  todayIso = getLocalTodayLogDate(),
}: PrivateTimelineScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const timelineCopy = useMemo(() => buildTimelineCopy(t, resolvedLocale), [resolvedLocale, t]);
  const [model, setModel] = useState<PrivateTimelineModel>(() =>
    buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
    }),
  );
  const [activeFilter, setActiveFilter] = useState<PrivateTimelineFilter>('all');
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateTimeline() {
      setIsHydrating(true);
      setLoadErrorMessage(null);

      try {
        const dailyLogs = await repositories.dailyLogs.listAll();
        const [profile, reminderPreferences, importSessions, backupEvents] = await Promise.all([
          repositories.userProfile.getProfile(),
          repositories.reminderPreferences.getPreferences(),
          repositories.importSessions.listSessions(),
          repositories.backupEvents.listEvents(),
        ]);

        if (isCancelled) {
          return;
        }

        // LT-05: cycle-event kinds now schedule a horizon of future
        // occurrences (bare identifier for occurrence 1, `#2`/`#3` suffixes
        // for the rest -- see buildReminderPlans.ts). This timeline section
        // summarizes "what reminders exist", one row per reminder kind, so
        // only the nearest occurrence per kind is kept.
        const reminderPlans = buildReminderPlans({
          todayIso,
          profile: profile ?? defaultUserProfile,
          logEntries: dailyLogs,
          preferences: reminderPreferences,
        }).filter((plan) => !plan.identifier.includes('#'));

        setModel(
          buildPrivateTimelineModel({
            dailyLogs,
            imports: buildImportSummaries(importSessions),
            reminders: buildReminderSummaries(reminderPlans, todayIso, t),
            backupEvents: backupEvents.map((event) => ({
              id: event.id,
              action: event.action,
              date: normalizeTimelineDate(event.occurredAt),
              detail: event.detail,
            })),
            copy: timelineCopy,
          }),
        );
      } catch {
        if (!isCancelled) {
          setLoadErrorMessage(t('calendar.timeline.errorDescription'));
        }
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateTimeline();

    return () => {
      isCancelled = true;
    };
  }, [
    repositories.dailyLogs,
    repositories.backupEvents,
    repositories.importSessions,
    repositories.reminderPreferences,
    repositories.userProfile,
    t,
    timelineCopy,
    todayIso,
  ]);

  const visibleItems = model.items.filter(
    (item) => activeFilter === 'all' || item.kind === activeFilter,
  );
  const activeFilterLabel = t(
    timelineFilters.find((filter) => filter.kind === activeFilter)?.labelKey ??
      'calendar.timeline.filterAll',
  );
  // UL-22: the serif metric numeral above this text already carries the
  // count — the unfiltered caption is a plain label ("Private timeline
  // entries"), not "27 private timeline entries" restating the 27. The
  // filtered caption keeps its counts: it says something the metric does
  // not (shown vs total).
  const summaryText =
    activeFilter === 'all'
      ? t('calendar.timeline.entryCountLabel')
      : t('calendar.timeline.filteredEntryCount', {
          count: visibleItems.length,
          filter: activeFilterLabel,
          total: model.items.length,
        });
  const emptyTitle =
    model.items.length > 0
      ? t('calendar.timeline.emptyFilterTitle')
      : t('calendar.timeline.emptyTitle');
  const emptyDescription =
    model.items.length > 0
      ? t('calendar.timeline.emptyFilterDescription')
      : t('calendar.timeline.emptyDescription');

  const showTimelineRows = !isHydrating && !loadErrorMessage;

  return (
    <Screen<PrivateTimelineItem>
      backAction={{
        label: t('calendar.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router);
        },
        testID: testIds.calendar.timelineBackButton,
      }}
      description={t('calendar.timeline.description')}
      eyebrow={t('calendar.screen.eyebrow')}
      testID={testIds.calendar.timelineScreen}
      title={t('calendar.timeline.title')}
      // LT-10: a year of daily logging produces 300+ timeline rows. They are
      // rendered through the Screen's virtualized-list mode (FlatList render
      // window) instead of an eager `.map()` inside the scroll view, so the
      // mounted view count stays bounded regardless of tenure.
      virtualizedList={{
        data: showTimelineRows ? visibleItems : [],
        keyExtractor: (item) => item.id,
        renderItem: ({ item }) => (
          <TimelineItemRow
            item={item}
            locale={resolvedLocale}
            todayIso={todayIso}
            actionLabel={t('calendar.timeline.rowActionLabel', { title: item.title })}
            onPress={() => {
              router.push(item.sourceHref);
            }}
            privateBadgeLabel={t('calendar.timeline.privateBadge')}
          />
        ),
        ListEmptyComponent: showTimelineRows ? (
          <View style={styles.stack} testID={testIds.calendar.timelineEmptyState}>
            <SectionCard description={emptyDescription} title={emptyTitle} />
            {model.items.length > 0 ? (
              <ActionButton
                appearance="quiet"
                onPress={() => {
                  setActiveFilter('all');
                }}
                testID={testIds.calendar.timelineShowAllButton}
              >
                {t('calendar.timeline.showAllButton')}
              </ActionButton>
            ) : null}
          </View>
        ) : null,
      }}
    >
      <SectionCard
        description={t('calendar.timeline.summaryDescription')}
        title={t('calendar.timeline.summaryTitle')}
      >
        <View style={styles.summaryGrid}>
          <Text style={styles.summaryMetric}>{model.items.length}</Text>
          <Text style={styles.summaryText}>{summaryText}</Text>
        </View>
      </SectionCard>

      {/* UL-19: the filters are a selection, not a call to action — "All"
          used to wear the primary-CTA costume (oxblood circle) while its
          siblings rendered as bare bold text. They now speak the shared
          selection-chip grammar (Wave A's UL-50 rule): rule-bordered chips,
          ink outline when selected. */}
      <View style={styles.filterRow}>
        {timelineFilters.map((filter) => (
          <SelectionChip
            key={filter.kind}
            label={t(filter.labelKey)}
            onPress={() => {
              setActiveFilter(filter.kind);
            }}
            selected={activeFilter === filter.kind}
            testID={buildPrivateTimelineFilterTestId(filter.kind)}
          />
        ))}
      </View>

      {isHydrating ? (
        <Text style={styles.statusText}>{t('calendar.timeline.loading')}</Text>
      ) : null}
      {loadErrorMessage ? (
        <SectionCard
          description={loadErrorMessage}
          testID={testIds.calendar.timelineErrorCard}
          title={t('calendar.timeline.errorTitle')}
        />
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    bottomSpacer: {
      height: theme.spacing.xxl,
    },
    summaryGrid: {
      gap: theme.spacing.xs,
    },
    summaryMetric: {
      color: theme.colors.accentPrimary,
      ...theme.typography.title,
    },
    summaryText: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    statusText: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    timelineRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderPrimary,
    },
    timelineDateFrame: {
      width: 64,
      flexShrink: 0,
    },
    timelineDate: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    timelineCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    timelineTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    timelineTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    timelineDetail: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    timelineMeta: {
      color: theme.colors.textTertiary,
      ...theme.typography.caption,
    },
    sensitiveBadge: {
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      color: theme.colors.accentPrimary,
      backgroundColor: theme.colors.buttonQuietFill,
      ...theme.typography.caption,
    },
  });
}
