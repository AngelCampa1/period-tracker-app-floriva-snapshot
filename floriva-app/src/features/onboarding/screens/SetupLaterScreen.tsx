import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { buildOnboardingCompletion } from '@/src/features/onboarding/model';
import {
  ChoicePanel,
  OptionCard,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';
import { useLocalization } from '@/src/localization/localizationContext';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import { testIds } from '@/src/testing/testIds';

export function SetupLaterScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { completeOnboarding } = useAppShell();
  const { t } = useLocalization();
  const { draft, setSetupChoice } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  async function finishOnboarding() {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      const completion = buildOnboardingCompletion(draft);

      const postOnboardingRoute = draft.importSetupChoice === 'now' ? '/import' : '/today';

      await completeOnboarding(
        completion.profile,
        completion.preferences,
        postOnboardingRoute,
      );
      router.replace(draft.importSetupChoice === 'now' ? './import' : '/today');
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'onboarding_completion_failed',
        error,
      });
      setSaveError(t('onboarding.setupLater.error'));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Screen
      eyebrow={t('onboarding.setupLater.eyebrow')}
      footerPlacement="inline"
      progress={{
        current: draft.goals.includes('trying-to-conceive') ? 4 : 3,
        total: draft.goals.includes('trying-to-conceive') ? 4 : 3,
        variant: 'bar',
      }}
      title={t('onboarding.setupLater.title')}
      description={t('onboarding.setupLater.description')}
      footer={
        <View style={sharedOnboardingStyles.footerActions}>
          <ActionButton
            appearance="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
            style={sharedOnboardingStyles.secondaryAction}
          >
            {t('onboarding.setupLater.backLabel')}
          </ActionButton>
          <ActionButton
            disabled={isSaving}
            onPress={() => {
              void finishOnboarding();
            }}
            style={sharedOnboardingStyles.primaryAction}
            testID={testIds.onboarding.setupLater.completeButton}
          >
            {isSaving ? t('onboarding.setupLater.saving') : t('onboarding.setupLater.finishSetup')}
          </ActionButton>
        </View>
      }
      testID={testIds.onboarding.setupLater.screen}
    >
      <OptionCard
        description={t('onboarding.setupLater.sections.reminders.body')}
        title={t('onboarding.setupLater.sections.reminders.title')}
      >
        <View style={sharedOnboardingStyles.stack}>
          <ChoicePanel
            description={t('onboarding.setupLater.choices.remindersLater.description')}
            onPress={() => setSetupChoice('reminderSetupChoice', 'later')}
            selected={draft.reminderSetupChoice === 'later'}
            testID={testIds.onboarding.setupLater.reminderLaterChoice}
            title={t('onboarding.setupLater.choices.remindersLater.title')}
          />
          <ChoicePanel
            description={t('onboarding.setupLater.choices.remindersOff.description')}
            onPress={() => setSetupChoice('reminderSetupChoice', 'skip')}
            selected={draft.reminderSetupChoice === 'skip'}
            testID={testIds.onboarding.setupLater.reminderOffChoice}
            title={t('onboarding.setupLater.choices.remindersOff.title')}
          />
        </View>
      </OptionCard>
      <OptionCard
        description={t('onboarding.setupLater.sections.import.body')}
        title={t('onboarding.setupLater.sections.import.title')}
      >
        <View style={sharedOnboardingStyles.stack}>
          <ChoicePanel
            description={t('onboarding.setupLater.choices.importNow.description')}
            onPress={() => setSetupChoice('importSetupChoice', 'now')}
            selected={draft.importSetupChoice === 'now'}
            testID={testIds.onboarding.setupLater.importNowChoice}
            title={t('onboarding.setupLater.choices.importNow.title')}
          />
          <ChoicePanel
            description={t('onboarding.setupLater.choices.importLater.description')}
            onPress={() => setSetupChoice('importSetupChoice', 'later')}
            selected={draft.importSetupChoice === 'later'}
            testID={testIds.onboarding.setupLater.importLaterChoice}
            title={t('onboarding.setupLater.choices.importLater.title')}
          />
          <ChoicePanel
            description={t('onboarding.setupLater.choices.importSkip.description')}
            onPress={() => setSetupChoice('importSetupChoice', 'skip')}
            selected={draft.importSetupChoice === 'skip'}
            testID={testIds.onboarding.setupLater.importSkipChoice}
            title={t('onboarding.setupLater.choices.importSkip.title')}
          />
        </View>
      </OptionCard>
      <OptionCard
        description={t('onboarding.setupLater.sections.biometricLock.body')}
        title={t('onboarding.setupLater.sections.biometricLock.title')}
      >
        <View style={sharedOnboardingStyles.stack}>
          <ChoicePanel
            description={t('onboarding.setupLater.choices.biometricsLater.description')}
            onPress={() => setSetupChoice('biometricsSetupChoice', 'later')}
            selected={draft.biometricsSetupChoice === 'later'}
            testID={testIds.onboarding.setupLater.biometricsLaterChoice}
            title={t('onboarding.setupLater.choices.biometricsLater.title')}
          />
          <ChoicePanel
            description={t('onboarding.setupLater.choices.biometricsSkip.description')}
            onPress={() => setSetupChoice('biometricsSetupChoice', 'skip')}
            selected={draft.biometricsSetupChoice === 'skip'}
            testID={testIds.onboarding.setupLater.biometricsSkipChoice}
            title={t('onboarding.setupLater.choices.biometricsSkip.title')}
          />
        </View>
      </OptionCard>
      <Text style={styles.helperText}>
        {t('onboarding.setupLater.sections.whatHappensAfterThis.body')}
      </Text>
      {saveError ? (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID="onboarding-setup-later-error"
        >
          {saveError}
        </Text>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    error: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
  });
}
