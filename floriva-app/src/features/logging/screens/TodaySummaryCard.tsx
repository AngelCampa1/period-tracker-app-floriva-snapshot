import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { mergeReminderPreferences } from '@/src/db/domainDefaults';
import {
  hasEnabledTtcMode,
  buildTtcObservationSummary,
} from '@/src/features/ttc/summary';
import {
  getBleedingOptions,
  getBirthControlMethodOptions,
  getMoodOptions,
  getSymptomOptions,
} from '@/src/features/logging/constants';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type { DailyLogEntry, ReminderPreference, SupportedLocale, UserProfile } from '@/src/types/domain';

type TodaySummaryCardProps = {
  logDate: string;
  locale: SupportedLocale;
  refreshKey?: number;
};

function pluck<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | undefined,
) {
  if (!value) return undefined;
  return options.find((option) => option.value === value)?.label;
}

export function TodaySummaryCard({ logDate, locale, refreshKey = 0 }: TodaySummaryCardProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useLocalization();
  const { repositories } = useDatabase();
  const repositoriesRef = useRef(repositories);
  const [entry, setEntry] = useState<DailyLogEntry | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreference[]>(
    () => mergeReminderPreferences([]),
  );

  const bleedingOptions = useMemo(() => getBleedingOptions(locale), [locale]);
  const moodOptions = useMemo(() => getMoodOptions(locale), [locale]);
  const symptomOptions = useMemo(() => getSymptomOptions(locale), [locale]);

  useEffect(() => {
    repositoriesRef.current = repositories;
  }, [repositories]);

  useEffect(() => {
    let cancelled = false;
    const currentRepositories = repositoriesRef.current;

    Promise.all([
      Promise.resolve(currentRepositories.dailyLogs.getEntryByDate(logDate)),
      Promise.resolve(currentRepositories.userProfile?.getProfile?.() ?? null),
      Promise.resolve(
        currentRepositories.reminderPreferences?.getPreferences?.() ?? mergeReminderPreferences([]),
      ),
    ])
      .then(([value, loadedProfile, loadedReminderPreferences]) => {
        if (!cancelled) {
          const normalizedReminderPreferences = mergeReminderPreferences(loadedReminderPreferences);
          const birthControlMethod =
            value?.birthControlEvent?.method ?? loadedProfile?.birthControlMethod;
          const hasEnabledBirthControlReminder = normalizedReminderPreferences.some(
            (preference) => preference.kind === 'birth-control' && preference.enabled,
          );

          setEntry(value ?? null);
          setProfile(loadedProfile);
          if (birthControlMethod || hasEnabledBirthControlReminder) {
            setReminderPreferences(normalizedReminderPreferences);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntry(null);
          setProfile(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [logDate, refreshKey]);

  const flowLabel = pluck(bleedingOptions, entry?.bleeding) ?? t('tracker.summary.empty');
  const moodLabel = pluck(moodOptions, entry?.mood) ?? t('tracker.summary.moodEmpty');
  const energyLabel = entry?.symptoms.includes('fatigue')
    ? t('tracker.summary.energyLow')
    : t('tracker.summary.energyEmpty');
  const sleepLabel = entry?.symptoms.includes('sleep-changes')
    ? pluck(symptomOptions, 'sleep-changes') ?? t('tracker.summary.sleepEmpty')
    : t('tracker.summary.sleepEmpty');
  const birthControlSummary = buildBirthControlSummary({
    entry,
    labels: {
      lateDose: t('birthControl.summary.lateDose'),
      missedDose: t('birthControl.summary.missedDose'),
      reminderOn: t('birthControl.summary.reminderOn'),
    },
    locale,
    profile,
    reminderPreferences,
  });
  const ttcSummary = buildTtcSummary({
    entry,
    locale,
    profile,
  });

  function handleSeeAll() {
    router.push('/calendar/history' as never);
  }

  return (
    <View testID={testIds.today.loggingCard} style={styles.wrapper}>
      <View style={styles.eyebrowRow}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
          style={styles.eyebrow}
        >
          {t('tracker.summary.eyebrow')}
        </Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
          onPress={handleSeeAll}
        >
          <Text numberOfLines={1} style={styles.seeAll}>
            {t('tracker.summary.seeAll')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid} testID="today-summary-grid">
        <SummaryBox
          label={t('tracker.summary.flowLabel')}
          testID="today-summary-flow-box"
          value={flowLabel}
          styles={styles}
        />
        <SummaryBox
          label={t('tracker.summary.moodLabel')}
          testID="today-summary-mood-box"
          value={moodLabel}
          styles={styles}
        />
        <SummaryBox
          label={t('tracker.summary.energyLabel')}
          testID="today-summary-energy-box"
          value={energyLabel}
          styles={styles}
        />
        <SummaryBox
          label={t('tracker.summary.sleepLabel')}
          testID="today-summary-sleep-box"
          value={sleepLabel}
          styles={styles}
        />
      </View>

      {birthControlSummary ? (
        <View style={styles.birthControlSummary} testID={testIds.today.birthControlSummaryCard}>
          <Text style={styles.birthControlSummaryTitle}>{t('birthControl.summary.title')}</Text>
          <Text style={styles.birthControlSummaryDetail}>{birthControlSummary}</Text>
        </View>
      ) : null}

      {ttcSummary ? (
        <View style={styles.birthControlSummary} testID={testIds.today.ttcSummaryCard}>
          <Text style={styles.birthControlSummaryTitle}>{t('ttc.summary.title')}</Text>
          <Text style={styles.birthControlSummaryDetail}>{ttcSummary}</Text>
        </View>
      ) : null}
    </View>
  );
}

function buildBirthControlSummary({
  entry,
  labels,
  locale,
  profile,
  reminderPreferences,
}: {
  entry: DailyLogEntry | null;
  labels: {
    lateDose: string;
    missedDose: string;
    reminderOn: string;
  };
  locale: SupportedLocale;
  profile: UserProfile | null;
  reminderPreferences: ReminderPreference[];
}) {
  const method = entry?.birthControlEvent?.method ?? profile?.birthControlMethod;

  if (!method) {
    return undefined;
  }

  const methodLabel =
    getBirthControlMethodOptions(locale).find((option) => option.value === method)?.label ??
    method;
  const details = [methodLabel];

  if (entry?.birthControlEvent?.missedDose) {
    details.push(labels.missedDose);
  }

  if (entry?.birthControlEvent?.lateDose) {
    details.push(labels.lateDose);
  }

  const reminder = reminderPreferences.find((preference) => preference.kind === 'birth-control');

  if (reminder?.enabled) {
    details.push(labels.reminderOn);
  }

  return details.join(' · ');
}

function buildTtcSummary({
  entry,
  locale,
  profile,
}: {
  entry: DailyLogEntry | null;
  locale: SupportedLocale;
  profile: UserProfile | null;
}) {
  if (!hasEnabledTtcMode(profile)) {
    return undefined;
  }

  return buildTtcObservationSummary({
    locale,
    observation: entry?.ttcObservation,
  });
}

type SummaryStyles = ReturnType<typeof createStyles>;

function SummaryBox({
  label,
  testID,
  value,
  styles,
}: {
  label: string;
  testID?: string;
  value: string;
  styles: SummaryStyles;
}) {
  return (
    <View style={styles.box} testID={testID}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={styles.boxLabel}
      >
        {label}
      </Text>
      <Text style={styles.boxValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    wrapper: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.textTertiary,
      flexShrink: 1,
      marginRight: theme.spacing.sm,
    },
    seeAll: {
      ...theme.typography.caption,
      color: theme.colors.textPrimary,
      textDecorationLine: 'underline',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surfacePrimary,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    box: {
      flex: 1,
      flexBasis: '48%',
      minWidth: 132,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: 4,
      alignItems: 'center',
      gap: 4,
    },
    boxLabel: {
      ...theme.typography.eyebrow,
      fontSize: 9,
      letterSpacing: 1.1,
      color: theme.colors.textTertiary,
      alignSelf: 'stretch',
      textAlign: 'center',
    },
    boxValue: {
      ...theme.typography.bodyStrong,
      fontSize: 15,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    birthControlSummary: {
      gap: 4,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    birthControlSummaryTitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    birthControlSummaryDetail: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
  });
}
