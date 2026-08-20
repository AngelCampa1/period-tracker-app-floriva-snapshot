import { useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { buildCalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { addDays } from '@/src/lib/predictions/dateMath';
import { formatMonthDayLabelWithYearIfNotCurrent } from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { TranslationKey } from '@/src/localization/translations';
import type { DailyLogEntry } from '@/src/types/domain';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type CalendarHistoryScreenProps = {
  todayIso?: string;
};

/**
 * UL-15: every non-spotting row used to carry the identical "Period day"
 * subtitle. Rows now reuse the timeline's localized per-intensity bleeding
 * strings so a heavy day reads differently from a light one.
 */
const historyBleedingLabelKeys: Partial<Record<NonNullable<DailyLogEntry['bleeding']>, TranslationKey>> = {
  spotting: 'calendar.timeline.rows.bleedingSpotting',
  light: 'calendar.timeline.rows.bleedingLight',
  medium: 'calendar.timeline.rows.bleedingMedium',
  heavy: 'calendar.timeline.rows.bleedingHeavy',
};

export function CalendarHistoryScreen({
  todayIso = getLocalTodayLogDate(),
}: CalendarHistoryScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const [historyItems, setHistoryItems] = useState<
    ReturnType<typeof buildCalendarScreenModel>['historyItems']
  >([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateHistory() {
      try {
        const [profile, logEntries] = await Promise.all([
          repositories.userProfile.getProfile(),
          repositories.dailyLogs.listByDateRange(addDays(todayIso, -365), addDays(todayIso, 62)),
        ]);

        if (isCancelled) {
          return;
        }

        const model = buildCalendarScreenModel({
          todayIso,
          monthIso: `${todayIso.slice(0, 7)}-01`,
          profile: profile ?? defaultUserProfile,
          logEntries,
          locale: resolvedLocale,
        });

        setHistoryItems(model.historyItems);
      } catch {
        if (!isCancelled) {
          setLoadErrorMessage(t('calendar.monthlyView.error'));
        }
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateHistory();

    return () => {
      isCancelled = true;
    };
  }, [repositories.dailyLogs, repositories.userProfile, resolvedLocale, t, todayIso]);

  return (
    <Screen
      backAction={{
        label: t('calendar.screen.backLabel'),
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace('/calendar' as Href);
        },
        testID: testIds.calendar.historyBackButton,
      }}
      testID={testIds.calendar.historyScreen}
      eyebrow={`${t('calendar.screen.eyebrow')} · History`}
      title={<ItalicTitle prefix="Cycles " accent="logged" suffix="." />}
      stickyTitle="Cycles logged."
      description={t('calendar.history.description')}
    >
      {isHydrating ? <Text style={styles.body}>{t('calendar.monthlyView.loading')}</Text> : null}
      {loadErrorMessage ? <Text style={styles.body}>{loadErrorMessage}</Text> : null}
      {!isHydrating && !loadErrorMessage ? (
        <View style={styles.stack}>
          {historyItems.length > 0 ? (
            historyItems.map((item) => (
              <View key={`${item.date}-${item.bleeding}`} style={styles.historyRow}>
                <Text style={styles.historyDate}>
                  {formatMonthDayLabelWithYearIfNotCurrent(item.date, todayIso, resolvedLocale)}
                </Text>
                <Text style={styles.body}>
                  {(() => {
                    const labelKey = item.bleeding
                      ? historyBleedingLabelKeys[item.bleeding]
                      : undefined;
                    return labelKey ? t(labelKey) : item.label;
                  })()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.body}>{t('calendar.history.empty')}</Text>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
    },
    historyRow: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderPrimary,
    },
    historyDate: {
      // UL-43: ledger dates wear the mono numeral voice the rest of the
      // system promises for dates/figures (matching recentCycleDays on the
      // calendar root).
      color: theme.colors.textPrimary,
      ...theme.typography.numeral,
      fontSize: 14,
      lineHeight: 18,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
