import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Arc, EditorialRule, Petal } from '@/src/components/editorial';
import { Screen } from '@/src/components/primitives/Screen';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildImportedOnboardingCompletion,
  buildOnboardingCompletion,
} from '@/src/features/onboarding/model';
import { OnboardingFooter } from '@/src/features/onboarding/screens/shared';
import { useLocalization } from '@/src/localization/localizationContext';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays } from '@/src/lib/predictions/dateMath';
import {
  formatFertileWindowLabel,
  formatNextPeriodExpectedRangeLabel,
} from '@/src/lib/predictions/presentation';
import { testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import type { SupportedLocale } from '@/src/types/domain';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type DataRow = { label: string; value: string };

function buildCompletionDataRows(
  draft: ReturnType<typeof useOnboarding>['draft'],
  locale: SupportedLocale,
): DataRow[] | null {
  const cycleLengthDays = Number.parseInt(draft.cycleLengthInput, 10);
  const periodLengthDays = Number.parseInt(draft.periodLengthInput, 10);

  if (
    !draft.lastPeriodStartDate ||
    !Number.isFinite(cycleLengthDays) ||
    !Number.isFinite(periodLengthDays)
  ) {
    return null;
  }

  const todayIso = getLocalTodayLogDate();
  const profile = {
    cycleLengthDays,
    periodLengthDays,
    lastPeriodStartDate: draft.lastPeriodStartDate,
    goals: [] as import('@/src/types/domain').TrackingGoal[],
    supportsIrregularCycles: false,
    conditionTags: [] as import('@/src/types/domain').ConditionKey[],
  };

  const prediction = buildPredictionResult({ todayIso, profile, logEntries: [] });
  const nextStartIso = prediction.nextPeriod.startDate;
  const nextEndIso = addDays(nextStartIso, prediction.nextPeriod.lengthDays - 1);

  return [
    { label: 'Cycle day', value: `Day ${prediction.current.cycleDay}` },
    {
      label: 'Next period est.',
      value: formatNextPeriodExpectedRangeLabel(nextStartIso, nextEndIso, locale),
    },
    {
      label: 'Fertile window',
      value: formatFertileWindowLabel(
        todayIso,
        prediction.fertileWindow.startDate,
        prediction.fertileWindow.endDate,
        locale,
      ),
    },
  ];
}

export function OnboardingCompletionScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { completeOnboarding } = useAppShell();
  const { draft } = useOnboarding();
  const { resolvedLocale } = useLocalization();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dataRows = buildCompletionDataRows(draft, resolvedLocale);

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      footerPlacement="fixed"
      layout="hero"
      // UL-52: no progress bar here — at 100% it rendered as a thick
      // trackless rule, and the journey is already over on this screen.
      title={
        <View style={styles.titleComposite}>
          <View style={styles.youreSetRow}>
            <View style={styles.youreSetAccentBar} />
            <Text style={styles.youreSetLabel}>{"You're set"}</Text>
          </View>
          <Text style={styles.displayTitle}>
            {'Your almanac\n'}
            <Text style={styles.displayTitlePlain}>{'is '}</Text>
            <Text style={styles.displayTitleAccent}>{'ready.'}</Text>
          </Text>
        </View>
      }
      description="Floriva has enough to start. Estimates get better as you log over time."
      footer={
        <OnboardingFooter
          continueLabel={isSaving ? 'Opening…' : 'Open Floriva'}
          continueTestID={testIds.onboarding.completion.continueButton}
          onContinue={() => {
            setIsSaving(true);
            setErrorMessage(null);

            void (async () => {
              try {
                const completion =
                  draft.startPath === 'fresh'
                    ? buildOnboardingCompletion(draft)
                    : buildImportedOnboardingCompletion(
                        draft,
                        await repositories.userProfile.getProfile(),
                        await repositories.dailyLogs.listByDateRange(
                          '2000-01-01',
                          '2099-12-31',
                        ),
                      );
                await completeOnboarding(completion.profile, completion.preferences, '/today');
                router.replace('/today');
              } catch (error) {
                setErrorMessage(
                  error instanceof Error ? error.message : 'Floriva could not finish setup.',
                );
              } finally {
                setIsSaving(false);
              }
            })();
          }}
        />
      }
      testID={testIds.onboarding.completion.screen}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.arcTopRight}
      >
        <Arc color={theme.colors.accentPrimary} size={320} opacity={0.1} />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.arcBottomLeft}
      >
        <Arc color={theme.colors.accentPrimary} size={240} opacity={0.08} />
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.ornament}
      >
        {/* UL-58: near-opaque (0.95) the petal read as a solid oxblood blob;
            at wash opacity it joins the Arc ornament family (0.08-0.16). */}
        <Petal color={theme.colors.accentPrimary} size={48} opacity={0.14} />
      </View>

      {dataRows ? (
        <View style={styles.dataSection}>
          <EditorialRule mark="Starting point" />
          <View style={styles.dataRows}>
            {dataRows.map((row, index) => (
              <View
                key={row.label}
                style={[styles.dataRow, index < dataRows.length - 1 && styles.dataRowBorder]}
              >
                <Text style={styles.dataLabel}>{row.label}</Text>
                <Text style={styles.dataValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.supportText}>
        Reminders, biometric lock, and more settings are in the app whenever you want them.
      </Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    titleComposite: {
      gap: theme.spacing.sm,
    },
    youreSetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    youreSetAccentBar: {
      width: 24,
      height: 1,
      backgroundColor: theme.colors.accentPrimary,
    },
    youreSetLabel: {
      ...theme.typography.numeral,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.2,
      color: theme.colors.accentPrimary,
    },
    displayTitle: {
      ...theme.typography.displayLg,
      color: theme.colors.textPrimary,
    },
    displayTitlePlain: {
      ...theme.typography.displayLg,
      color: theme.colors.textPrimary,
    },
    displayTitleAccent: {
      ...theme.typography.displayLg,
      color: theme.colors.accentPrimary,
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, divergent).
      fontFamily: fontFamilies.serifRegularItalic,
    },
    arcTopRight: {
      position: 'absolute',
      top: -60,
      right: -60,
      zIndex: 0,
    },
    arcBottomLeft: {
      position: 'absolute',
      bottom: 80,
      left: -40,
      zIndex: 0,
    },
    ornament: {
      alignSelf: 'flex-start',
      paddingBottom: theme.spacing.sm,
    },
    dataSection: {
      gap: theme.spacing.md,
    },
    dataRows: {
      gap: 0,
    },
    dataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    dataRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderPrimary,
    },
    dataLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    dataValue: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    supportText: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    errorText: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
  });
}
