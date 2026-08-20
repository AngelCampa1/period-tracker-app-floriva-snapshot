import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  normalizeOnboardingDateInput,
  validateCycleBasicsStep,
  type CycleBasicsErrors,
} from '@/src/features/onboarding/model';
import {
  ChoiceChip,
  InputField,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { useLocalization } from '@/src/localization/localizationContext';
import { addDays } from '@/src/lib/predictions/dateMath';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import { testIds } from '@/src/testing/testIds';

function translateValidationMessage(
  t: ReturnType<typeof useLocalization>['t'],
  message?: string,
) {
  return message ? t(message as Parameters<typeof t>[0]) : undefined;
}

export function CycleBasicsScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLocalization();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const {
    draft,
    setCycleLengthInput,
    setLastPeriodStartDate,
    setPeriodLengthInput,
  } = useOnboarding();
  const [errors, setErrors] = useState<CycleBasicsErrors>({});
  const todayIso = getLocalTodayLogDate();
  const normalizedLastPeriodStartDate = normalizeOnboardingDateInput(draft.lastPeriodStartDate);
  const canContinue = Object.keys(validateCycleBasicsStep(draft)).length === 0;
  const quickDatePicks = [
    {
      id: 'today',
      label: t('onboarding.basics.quickPicks.today'),
      value: todayIso,
    },
    {
      id: 'yesterday',
      label: t('onboarding.basics.quickPicks.yesterday'),
      value: addDays(todayIso, -1),
    },
    {
      id: 'seven',
      label: t('onboarding.basics.quickPicks.sevenDaysAgo'),
      value: addDays(todayIso, -7),
    },
    {
      id: 'fourteen',
      label: t('onboarding.basics.quickPicks.fourteenDaysAgo'),
      value: addDays(todayIso, -14),
    },
    {
      id: 'twentyEight',
      label: t('onboarding.basics.quickPicks.twentyEightDaysAgo'),
      value: addDays(todayIso, -28),
    },
  ];

  function continueToGoals() {
    const nextErrors = validateCycleBasicsStep(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      if (normalizedLastPeriodStartDate && normalizedLastPeriodStartDate !== draft.lastPeriodStartDate) {
        setLastPeriodStartDate(normalizedLastPeriodStartDate);
      }
      router.push('./goals');
    }
  }

  return (
    <Screen
      eyebrow={t('onboarding.basics.eyebrow')}
      footerPlacement="inline"
      progress={{ current: 1, total: 3, variant: 'bar' }}
      title={t('onboarding.basics.title')}
      description={t('onboarding.basics.description')}
      footer={
        <View style={sharedOnboardingStyles.footerActions}>
          <ActionButton
            appearance="secondary"
            onPress={() => router.back()}
            style={sharedOnboardingStyles.secondaryAction}
          >
            {t('onboarding.basics.backLabel')}
          </ActionButton>
          <ActionButton
            disabled={!canContinue}
            onPress={continueToGoals}
            style={sharedOnboardingStyles.primaryAction}
            testID={testIds.onboarding.basics.continueButton}
          >
            {t('common.actions.continue')}
          </ActionButton>
        </View>
      }
      testID={testIds.onboarding.basics.screen}
    >
      <SectionCard
        title={t('onboarding.basics.section.title')}
        description={t('onboarding.basics.section.body')}
      >
        <View style={styles.fieldList}>
          <View style={styles.lengthRow}>
            <View style={styles.lengthField}>
              <InputField
                error={translateValidationMessage(t, errors.cycleLengthInput)}
                keyboardType="number-pad"
                label={t('onboarding.basics.cycleLengthLabel')}
                onChangeText={(value) => {
                  setCycleLengthInput(value);
                  setErrors((current) => ({ ...current, cycleLengthInput: undefined }));
                }}
                testID={testIds.onboarding.basics.cycleLengthInput}
                value={draft.cycleLengthInput}
              />
            </View>
            <View style={styles.lengthField}>
              <InputField
                error={translateValidationMessage(t, errors.periodLengthInput)}
                keyboardType="number-pad"
                label={t('onboarding.basics.periodLengthLabel')}
                onChangeText={(value) => {
                  setPeriodLengthInput(value);
                  setErrors((current) => ({ ...current, periodLengthInput: undefined }));
                }}
                testID={testIds.onboarding.basics.periodLengthInput}
                value={draft.periodLengthInput}
              />
            </View>
          </View>
          <InputField
            error={translateValidationMessage(t, errors.lastPeriodStartDate)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            label={t('onboarding.basics.lastPeriodStartLabel')}
            onChangeText={(value) => {
              setLastPeriodStartDate(value);
              setErrors((current) => ({ ...current, lastPeriodStartDate: undefined }));
            }}
            placeholder={t('onboarding.basics.lastPeriodStartPlaceholder')}
            testID={testIds.onboarding.basics.lastPeriodStartDateInput}
            value={draft.lastPeriodStartDate}
          />
          <View style={styles.quickPickSection}>
            <View style={sharedOnboardingStyles.rowWrap}>
              {quickDatePicks.map((quickDatePick) => (
                <ChoiceChip
                  key={quickDatePick.id}
                  label={quickDatePick.label}
                  onPress={() => {
                    setLastPeriodStartDate(quickDatePick.value);
                    setErrors((current) => ({ ...current, lastPeriodStartDate: undefined }));
                  }}
                  selected={draft.lastPeriodStartDate === quickDatePick.value}
                  testID={
                    quickDatePick.id === 'today'
                      ? testIds.onboarding.basics.quickPickToday
                      : quickDatePick.id === 'yesterday'
                        ? testIds.onboarding.basics.quickPickYesterday
                        : quickDatePick.id === 'seven'
                          ? testIds.onboarding.basics.quickPickSevenDaysAgo
                          : quickDatePick.id === 'fourteen'
                            ? testIds.onboarding.basics.quickPickFourteenDaysAgo
                            : testIds.onboarding.basics.quickPickTwentyEightDaysAgo
                  }
                />
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.note}>
          {t('onboarding.basics.privacyNote.detail')}
        </Text>
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    fieldList: {
      gap: theme.spacing.md,
    },
    lengthRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    lengthField: {
      flex: 1,
    },
    note: {
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
      ...theme.typography.body,
    },
    quickPickSection: {
      gap: theme.spacing.sm,
    },
  });
}
