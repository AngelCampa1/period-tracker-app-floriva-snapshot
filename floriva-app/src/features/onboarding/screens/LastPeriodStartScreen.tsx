import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoiceChip,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { addDays } from '@/src/lib/predictions/dateMath';
import { formatMonthDayLabel } from '@/src/lib/predictions/presentation';
import { useLocalization } from '@/src/localization/localizationContext';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

function normalizeLastPeriodStart(value: string) {
  const trimmedValue = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    const parsedDate = new Date(`${trimmedValue}T00:00:00.000Z`);

    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(trimmedValue)
      ? trimmedValue
      : null;
  }

  const parts = trimmedValue.split('/');

  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  const year = Number.parseInt(parts[2], 10);
  const isoDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`;
  const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);

  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(isoDate)
    ? isoDate
    : null;
}

function isoToLocalDate(value: string) {
  const normalizedValue = normalizeLastPeriodStart(value);

  if (!normalizedValue) {
    return null;
  }

  const [year, month, day] = normalizedValue.split('-').map((part) => Number.parseInt(part, 10));

  return new Date(year, month - 1, day);
}

function localDateToIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function formatSelectedDateLabel(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function getMonthWeeks(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  const weeks: (Date | null)[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function getMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function LastPeriodStartScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { resolvedLocale } = useLocalization();
  const { draft, setLastPeriodStartDate } = useOnboarding();
  const [error, setError] = useState<string | undefined>();
  const todayIso = getLocalTodayLogDate();
  const todayDate = useMemo(() => isoToLocalDate(todayIso) ?? new Date(), [todayIso]);
  const normalizedDate = normalizeLastPeriodStart(draft.lastPeriodStartDate);
  const selectedDate = useMemo(
    () => isoToLocalDate(draft.lastPeriodStartDate) ?? todayDate,
    [draft.lastPeriodStartDate, todayDate],
  );
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => getMonthStart(selectedDate));
  const currentMonthDate = useMemo(() => getMonthStart(todayDate), [todayDate]);
  const calendarWeeks = useMemo(() => getMonthWeeks(visibleMonthDate), [visibleMonthDate]);
  const monthLabel = new Intl.DateTimeFormat(resolvedLocale, {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonthDate);
  const selectedIso = localDateToIso(selectedDate);
  const canGoToNextMonth = visibleMonthDate < currentMonthDate;
  const quickDatePicks = [
    { label: 'Today', value: todayIso, testID: testIds.onboarding.lastPeriodStart.quickPickToday },
    {
      label: 'Yesterday',
      value: addDays(todayIso, -1),
      testID: testIds.onboarding.lastPeriodStart.quickPickYesterday,
    },
    {
      label: '7 days ago',
      value: addDays(todayIso, -7),
      testID: testIds.onboarding.lastPeriodStart.quickPickSevenDaysAgo,
    },
    {
      label: '14 days ago',
      value: addDays(todayIso, -14),
      testID: testIds.onboarding.lastPeriodStart.quickPickFourteenDaysAgo,
    },
  ];

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Last period start"
      // UL-52: every onboarding step shares the same fixed-footer chrome; this
      // was the lone inline holdout.
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 2)}
      title="When did your last period start?"
      description="Pick the closest date you remember. Floriva uses it as your starting point."
      footer={
        <OnboardingFooter
          continueTestID={testIds.onboarding.lastPeriodStart.continueButton}
          onContinue={() => {
            const nextDate =
              normalizeLastPeriodStart(draft.lastPeriodStartDate) ||
              (draft.lastPeriodStartDate.trim() ? null : localDateToIso(selectedDate));

            if (!nextDate) {
              setError('Pick a date from the calendar or the quick options below.');
              return;
            }

            if (nextDate > todayIso) {
              setError('The start date cannot be in the future.');
              return;
            }

            setLastPeriodStartDate(nextDate);
            router.push('./cycle-length');
          }}
        />
      }
      testID={testIds.onboarding.lastPeriodStart.screen}
    >
      <View style={styles.formStack}>
        <View
          accessibilityLabel="Last period start date picker"
          style={styles.calendar}
          testID={testIds.onboarding.lastPeriodStart.datePicker}
        >
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{monthLabel}</Text>
            <View style={styles.monthArrows}>
              <Pressable
                accessibilityLabel="Show previous month"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => {
                  setVisibleMonthDate((monthDate) => addMonths(monthDate, -1));
                }}
                style={styles.monthArrowButton}
                testID="last-period-calendar-prev-month"
              >
                <Text style={styles.monthArrow}>{'‹'}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Show next month"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canGoToNextMonth }}
                disabled={!canGoToNextMonth}
                hitSlop={6}
                onPress={() => {
                  setVisibleMonthDate((monthDate) => addMonths(monthDate, 1));
                }}
                style={styles.monthArrowButton}
                testID="last-period-calendar-next-month"
              >
                <Text style={canGoToNextMonth ? styles.monthArrow : styles.monthArrowMuted}>
                  {'›'}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
              <Text key={weekday} style={styles.weekdayLabel}>
                {weekday}
              </Text>
            ))}
          </View>
          <View style={styles.dayGrid}>
            {calendarWeeks.map((week, weekIndex) => (
              <View
                key={`week-${weekIndex}`}
                style={styles.dayWeekRow}
                testID={`last-period-calendar-week-${weekIndex}`}
              >
                {week.map((calendarDate, dayIndex) => {
                  if (!calendarDate) {
                    return (
                      <View
                        key={`blank-${weekIndex}-${dayIndex}`}
                        style={styles.dayCell}
                      />
                    );
                  }

                  const dateIso = localDateToIso(calendarDate);
                  const isSelected = dateIso === selectedIso;
                  const isFuture = dateIso > todayIso;

                  return (
                    <Pressable
                      accessibilityLabel={formatSelectedDateLabel(calendarDate, resolvedLocale)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isFuture, selected: isSelected }}
                      disabled={isFuture}
                      hitSlop={4}
                      key={dateIso}
                      onPress={() => {
                        setLastPeriodStartDate(dateIso);
                        setError(undefined);
                      }}
                      style={[
                        styles.dayCell,
                        isSelected ? styles.dayCellSelected : null,
                        isFuture ? styles.dayCellDisabled : null,
                      ]}
                      testID={`last-period-calendar-day-${dateIso}`}
                    >
                      <Text style={[styles.dayText, isSelected ? styles.dayTextSelected : null]}>
                        {calendarDate.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={styles.selectedDateLabel}>
            {formatSelectedDateLabel(selectedDate, resolvedLocale)}
          </Text>
        </View>
        <View style={sharedOnboardingStyles.rowWrap}>
          {quickDatePicks.map((quickDatePick) => (
            <ChoiceChip
              key={quickDatePick.label}
              label={quickDatePick.label}
              onPress={() => {
                setLastPeriodStartDate(quickDatePick.value);
                const quickDate = isoToLocalDate(quickDatePick.value);

                if (quickDate) {
                  setVisibleMonthDate(getMonthStart(quickDate));
                }

                setError(undefined);
              }}
              selected={draft.lastPeriodStartDate === quickDatePick.value}
              testID={quickDatePick.testID}
            />
          ))}
        </View>
        <Text style={[styles.helperText, error ? styles.errorText : null]}>
          {error ||
            (normalizedDate
              ? `Floriva will start from ${formatMonthDayLabel(normalizedDate, resolvedLocale)}.`
              : 'Tap a date on the calendar or use a quick option below.')}
        </Text>
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    formStack: {
      gap: theme.spacing.md,
    },
    calendar: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
    },
    monthTitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    monthArrows: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
    },
    monthArrowButton: {
      minWidth: 32,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthArrow: {
      ...theme.typography.title,
      color: theme.colors.accentPrimary,
    },
    monthArrowMuted: {
      ...theme.typography.title,
      color: theme.colors.borderStrong,
    },
    weekdayRow: {
      flexDirection: 'row',
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
      fontSize: 10,
    },
    dayGrid: {
      rowGap: theme.spacing.sm,
    },
    dayWeekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.accentPrimary,
    },
    dayCellDisabled: {
      opacity: 0.28,
    },
    dayText: {
      ...theme.typography.numeral,
      fontSize: 20,
      lineHeight: 24,
      color: theme.colors.textPrimary,
    },
    dayTextSelected: {
      color: theme.colors.bone,
    },
    selectedDateLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    errorText: {
      color: theme.colors.danger,
    },
  });
}
