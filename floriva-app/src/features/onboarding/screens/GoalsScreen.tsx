import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { validateGoalsStep, type GoalsErrors } from '@/src/features/onboarding/model';
import {
  ChoiceChip,
  ChoicePanel,
  OnboardingAlert,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import { testIds } from '@/src/testing/testIds';

export function GoalsScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLocalization();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setSupportsIrregularCycles, toggleConditionTag, toggleGoal } =
    useOnboarding();
  const [errors, setErrors] = useState<GoalsErrors>({});
  const canContinue = Object.keys(validateGoalsStep(draft)).length === 0;
  const validationMessages = [
    errors.goals,
    errors.supportsIrregularCycles,
  ]
    .filter((message): message is string => Boolean(message))
    .map((message) => t(message as Parameters<typeof t>[0]));
  const selectedGoalLabel = draft.goals[0]
    ? t(`onboarding.goals.options.${draft.goals[0] === 'trying-to-conceive' ? 'tryingToConceive' : draft.goals[0]}.title`)
    : null;

  return (
    <Screen
      eyebrow={t('onboarding.goals.eyebrow')}
      footerPlacement="inline"
      progress={{
        current: 2,
        total: draft.goals.includes('trying-to-conceive') ? 4 : 3,
        variant: 'bar',
      }}
      title={t('onboarding.goals.title')}
      description={t('onboarding.goals.description')}
      footer={
        <View style={sharedOnboardingStyles.stack}>
          <Text style={styles.footerHelper}>{t('onboarding.goals.footer.helper')}</Text>
          {selectedGoalLabel ? (
            <Text style={styles.footerSelection}>
              {t('onboarding.goals.footer.selectedGoalPrefix')}
              {selectedGoalLabel}
            </Text>
          ) : null}
          <View style={sharedOnboardingStyles.footerActions}>
            <ActionButton
              appearance="secondary"
              onPress={() => router.back()}
              style={sharedOnboardingStyles.secondaryAction}
            >
              {t('onboarding.goals.backLabel')}
            </ActionButton>
            <ActionButton
              disabled={!canContinue}
              onPress={() => {
                const nextErrors = validateGoalsStep(draft);

                setErrors(nextErrors);

                if (Object.keys(nextErrors).length === 0) {
                  router.push(
                    draft.goals.includes('trying-to-conceive')
                      ? './ttc-setup'
                      : './setup-later',
                  );
                }
              }}
              style={sharedOnboardingStyles.primaryAction}
              testID={testIds.onboarding.goals.continueButton}
            >
              {t('common.actions.continue')}
            </ActionButton>
          </View>
        </View>
      }
      testID={testIds.onboarding.goals.screen}
    >
      <SectionCard
        title={t('onboarding.goals.section.title')}
        description={t('onboarding.goals.section.body')}
      >
        <View style={sharedOnboardingStyles.stack}>
          <ChoicePanel
            description={t('onboarding.goals.options.period.description')}
            onPress={() => {
              toggleGoal('period');
              setErrors((current) => ({ ...current, goals: undefined }));
            }}
            selected={draft.goals.includes('period')}
            testID={testIds.onboarding.goals.goalPeriodToggle}
            title={t('onboarding.goals.options.period.title')}
          />
          <ChoicePanel
            description={t('onboarding.goals.options.symptoms.description')}
            onPress={() => {
              toggleGoal('symptoms');
              setErrors((current) => ({ ...current, goals: undefined }));
            }}
            selected={draft.goals.includes('symptoms')}
            testID={testIds.onboarding.goals.goalSymptomsToggle}
            title={t('onboarding.goals.options.symptoms.title')}
          />
          <ChoicePanel
            description={t('onboarding.goals.options.tryingToConceive.description')}
            onPress={() => {
              toggleGoal('trying-to-conceive');
              setErrors((current) => ({ ...current, goals: undefined }));
            }}
            selected={draft.goals.includes('trying-to-conceive')}
            testID={testIds.onboarding.goals.goalTryingToConceiveToggle}
            title={t('onboarding.goals.options.tryingToConceive.title')}
          />
        </View>
        {errors.goals ? (
          <Text style={styles.error}>{t(errors.goals as Parameters<typeof t>[0])}</Text>
        ) : null}
      </SectionCard>
      <SectionCard
        title={t('onboarding.goals.irregularCycle.title')}
        description={t('onboarding.goals.irregularCycle.body')}
      >
        <View style={sharedOnboardingStyles.stack}>
          <ChoicePanel
            description={t('onboarding.goals.irregularCycle.yes.description')}
            onPress={() => {
              setSupportsIrregularCycles(true);
              setErrors((current) => ({ ...current, supportsIrregularCycles: undefined }));
            }}
            selected={draft.supportsIrregularCycles === true}
            testID={testIds.onboarding.goals.irregularCyclesYes}
            title={t('onboarding.goals.irregularCycle.yes.title')}
          />
          <ChoicePanel
            description={t('onboarding.goals.irregularCycle.no.description')}
            onPress={() => {
              setSupportsIrregularCycles(false);
              setErrors((current) => ({ ...current, supportsIrregularCycles: undefined }));
            }}
            selected={draft.supportsIrregularCycles === false}
            testID={testIds.onboarding.goals.irregularCyclesNo}
            title={t('onboarding.goals.irregularCycle.no.title')}
          />
        </View>
        {errors.supportsIrregularCycles ? (
          <Text style={styles.error}>
            {t(errors.supportsIrregularCycles as Parameters<typeof t>[0])}
          </Text>
        ) : null}
      </SectionCard>
      <SectionCard
        title={t('onboarding.goals.conditions.title')}
        description={t('onboarding.goals.conditions.body')}
      >
        <View style={sharedOnboardingStyles.rowWrap}>
          <ChoiceChip
            label={t('onboarding.goals.tags.pcos')}
            onPress={() => toggleConditionTag('pcos')}
            selected={draft.conditionTags.includes('pcos')}
            testID={testIds.onboarding.goals.conditionPcos}
          />
          <ChoiceChip
            label={t('onboarding.goals.tags.pmdd')}
            onPress={() => toggleConditionTag('pmdd')}
            selected={draft.conditionTags.includes('pmdd')}
            testID={testIds.onboarding.goals.conditionPmdd}
          />
          <ChoiceChip
            label={t('onboarding.goals.tags.endometriosis')}
            onPress={() => toggleConditionTag('endometriosis')}
            selected={draft.conditionTags.includes('endometriosis')}
            testID={testIds.onboarding.goals.conditionEndometriosis}
          />
        </View>
      </SectionCard>
      <OnboardingAlert
        messages={validationMessages}
        title={t('onboarding.goals.validation.alertTitle')}
      />
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    error: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
    footerHelper: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    footerSelection: {
      color: theme.colors.text,
      ...theme.typography.body,
    },
  });
}
