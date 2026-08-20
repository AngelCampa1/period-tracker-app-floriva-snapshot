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
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type CalendarAboutEstimatesScreenProps = {
  todayIso?: string;
};

export function CalendarAboutEstimatesScreen({
  todayIso = getLocalTodayLogDate(),
}: CalendarAboutEstimatesScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const [limitations, setLimitations] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateEstimateNotes() {
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

        setLimitations(model.predictionSummary.limitations);
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

    void hydrateEstimateNotes();

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
        testID: testIds.calendar.estimateBackButton,
      }}
      testID={testIds.calendar.estimateScreen}
      eyebrow={`${t('calendar.screen.eyebrow')} · About estimates`}
      title={<ItalicTitle prefix="How Floriva " accent="predicts" suffix="." />}
      stickyTitle="How Floriva predicts."
      description={t('calendar.estimate.description')}
    >
      {isHydrating ? <Text style={styles.body}>{t('calendar.monthlyView.loading')}</Text> : null}
      {loadErrorMessage ? <Text style={styles.body}>{loadErrorMessage}</Text> : null}
      {!isHydrating && !loadErrorMessage ? (
        <View style={styles.stack}>
          {limitations.map((limitation) => (
            <View key={limitation} style={styles.limitCard}>
              <View style={styles.limitDot} />
              <Text style={styles.body}>{limitation}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.md,
    },
    // UL-42: these are editorial bullets, not ledger rows — the hairline
    // separator under each one read web-like. The accent dot + breathing
    // room carries the rhythm on its own.
    limitCard: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'flex-start',
      paddingVertical: theme.spacing.xs,
    },
    limitDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
      marginTop: theme.spacing.xs,
    },
    body: {
      flex: 1,
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
