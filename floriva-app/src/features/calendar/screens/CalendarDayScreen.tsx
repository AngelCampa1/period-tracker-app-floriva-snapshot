import { useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { buildCalendarDayRoute } from '@/src/features/app-shell/resolveAppEntry';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { TodayLoggingCard } from '@/src/features/logging/screens/TodayLoggingScreen';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays, diffDays, isoDateToUtcMillis } from '@/src/lib/predictions/dateMath';
import {
  formatCycleDayLabel,
  formatCyclePhaseLabel,
  type CyclePhaseLabelKey,
} from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type CalendarDayScreenProps = {
  selectedDate?: string;
  // `?quick=period` from a "Quick log" notification-action tap (see
  // notificationResponseRouting.ts). Pre-selects medium flow on the logging
  // card below without auto-saving — the user still taps Save.
  quick?: string;
};

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function safelyRefreshReminderSchedules(
  refreshReminderSchedules: () => Promise<void> | void,
) {
  void Promise.resolve(refreshReminderSchedules()).catch(() => undefined);
}

function resolvePhase(cycleDay: number, cycleLengthDays: number): CyclePhaseLabelKey {
  const periodEnd = Math.min(5, cycleLengthDays);
  const follicularEnd = Math.min(11, cycleLengthDays);
  const fertileEnd = Math.min(17, cycleLengthDays);
  if (cycleDay <= periodEnd) return 'period';
  if (cycleDay <= follicularEnd) return 'follicular';
  if (cycleDay <= fertileEnd) return 'fertile';
  return 'luteal';
}

// LT-20: at 12-month+ tenure, a bare "Monday, June 30" is ambiguous once the
// user has logged across more than one calendar year -- the day-view header
// gave no way to tell a 2025 date from a 2026 one. `todayIso` is the
// reference "current year" (mirrors formatMonthDayLabelWithYearIfNotCurrent
// in presentation.ts, applied here with the long month/weekday Intl options
// this header already used instead of the short month-day formatters, so
// the header's existing "Monday, June 30" style is preserved for
// current-year dates and only gains a year suffix otherwise).
function formatWeekdayDateTitle(iso: string, referenceTodayIso: string, locale: string) {
  const date = new Date(isoDateToUtcMillis(iso) + 12 * 60 * 60 * 1000);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(date);
  const entryYear = Number(iso.slice(0, 4));
  const referenceYear = Number(referenceTodayIso.slice(0, 4));
  const monthDay = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    ...(entryYear !== referenceYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(date);
  return `${weekday}, ${monthDay}`;
}

export function CalendarDayScreen({ selectedDate, quick }: CalendarDayScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { clearPendingEntryRoute, refreshReminderSchedules, state } = useAppShell();
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const isValidSelectedDate = isIsoDate(selectedDate);
  const logDate = isValidSelectedDate ? selectedDate : getLocalTodayLogDate();
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [cycleLengthDays, setCycleLengthDays] = useState<number>(28);
  const [showFertilityEstimates, setShowFertilityEstimates] = useState(true);
  // LT-24: same `stale-history` signal as Today/Calendar (LT-04/LT-09/LT-27).
  // Evaluated with the engine pinned to THIS day (todayIso: logDate below,
  // matching this screen's existing per-day re-run convention), so a stale
  // day-detail view reflects staleness as of the day being looked at.
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (isValidSelectedDate) {
      return;
    }

    router.replace('/calendar' as Href);
  }, [isValidSelectedDate, router]);

  // A notification-tap handoff parks `/calendar/day/{date}` (optionally with
  // a `?quick=period` suffix — see the quick-log query param below) on
  // pendingEntryRoute (see AppShellRouteGuard). Arriving here consumes it —
  // mirror TodayScreen's self-clear so entry paths that land on this screen
  // without the guard's consumption pass (e.g. the index redirect resolving
  // straight to this route) still cannot leave a stale route behind. Matches
  // by prefix (not exact equality) so the `?quick=period` variant is cleared
  // too.
  useEffect(() => {
    const expectedRoute = buildCalendarDayRoute(logDate);

    if (
      state.pendingEntryRoute !== expectedRoute &&
      !state.pendingEntryRoute?.startsWith(`${expectedRoute}?`)
    ) {
      return;
    }

    void clearPendingEntryRoute();
  }, [clearPendingEntryRoute, logDate, state.pendingEntryRoute]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      Promise.resolve(repositories.userProfile.getProfile()),
      Promise.resolve(
        repositories.dailyLogs.listByDateRange(addDays(logDate, -365), logDate),
      ),
      Promise.resolve(
        repositories.appPreferences?.getPreferences?.() ?? defaultAppPreferences,
      ),
    ])
      .then(([profile, logEntries, appPreferences]) => {
        if (cancelled) return;
        setShowFertilityEstimates(appPreferences.showFertilityEstimates ?? true);
        const result = buildPredictionResult({
          todayIso: logDate,
          profile: profile ?? defaultUserProfile,
          logEntries: logEntries ?? [],
        });
        const dayNumber = Math.max(
          1,
          diffDays(result.current.cycleStartDate, logDate) + 1,
        );
        setCycleDay(dayNumber);
        setCycleLengthDays(result.cycleLengthDays);
        setIsStale(result.confidence.reasonCodes.includes('stale-history'));
      })
      .catch(() => {
        if (!cancelled) setCycleDay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [logDate, repositories.appPreferences, repositories.dailyLogs, repositories.userProfile]);

  const phase = cycleDay !== null ? resolvePhase(cycleDay, cycleLengthDays) : null;
  // LT-24: a "Fertile" chip built on a rolled synthetic anchor is the same
  // trust violation as Today's fertile-window headline (see
  // buildTodaySnapshot.ts) -- suppress it once the day-level prediction is
  // stale, same as the existing showFertilityEstimates opt-out.
  const visiblePhase =
    phase === 'fertile' && (!showFertilityEstimates || isStale) ? null : phase;

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
        testID: testIds.calendar.dayBackButton,
      }}
      testID={testIds.calendar.dayScreen}
      eyebrow={
        cycleDay !== null
          ? formatCycleDayLabel(cycleDay, resolvedLocale)
          : t('calendar.screen.eyebrow')
      }
      title={formatWeekdayDateTitle(logDate, getLocalTodayLogDate(), resolvedLocale)}
      headerActions={
        visiblePhase ? (
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>
              {formatCyclePhaseLabel(visiblePhase, resolvedLocale)}
            </Text>
          </View>
        ) : undefined
      }
    >
      <TodayLoggingCard
        logDate={logDate}
        locale={resolvedLocale}
        onEntryChanged={() => {
          safelyRefreshReminderSchedules(refreshReminderSchedules);
        }}
        quickPreselectBleeding={quick === 'period' ? 'medium' : undefined}
        surface="selected-day"
      />
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    phasePill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: theme.colors.surfacePrimary,
    },
    phasePillText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
  });
}
