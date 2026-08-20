import { useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { useSharedOnboardingStyles } from '@/src/features/onboarding/screens/shared';
import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';
import { useLocalization } from '@/src/localization/localizationContext';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type TtcExpectationsScreenProps = {
  nextHref?: string;
  continueLabel?: string;
  onContinue?: () => Promise<void> | void;
};

function summarizePreferences(
  preferences: ReturnType<typeof useOnboarding>['draft']['ttcTrackingPreferences'],
  locale: string,
  t: ReturnType<typeof useLocalization>['t'],
) {
  const enabled = [
    preferences.sex ? t('onboarding.ttcSetup.chips.sex') : null,
    preferences.ovulationTest ? t('onboarding.ttcSetup.chips.ovulationTest') : null,
    preferences.cervicalMucus ? t('onboarding.ttcSetup.chips.cervicalMucus') : null,
    preferences.basalBodyTemperature ? t('onboarding.ttcSetup.chips.basalBodyTemperature') : null,
  ].filter(Boolean);

  if (enabled.length === 0) {
    return t('onboarding.ttcExpectations.summary.disabled');
  }

  const separator = locale === 'ja' || locale === 'zh-Hans' ? '、' : ', ';

  return `${t('onboarding.ttcExpectations.summary.enabledPrefix')}${enabled.join(
    separator,
  )}${t('onboarding.ttcExpectations.summary.enabledSuffix')}`;
}

export function TtcExpectationsScreen({
  continueLabel,
  nextHref = './setup-later',
  onContinue,
}: TtcExpectationsScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { resolvedLocale, t } = useLocalization();
  const { draft } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleContinue() {
    if (!onContinue) {
      router.push(nextHref as Href);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onContinue();
    } catch (error) {
      logSensitiveRuntimeFailure({
        event: 'ttc_expectations_save_failed',
        error,
      });
      setSaveError(t('onboarding.ttcExpectations.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // VF-10b: the \u00A0 in the title suffix binds "cannot do." so the closing
    // word never wraps alone under this full-sentence serif title.
    <Screen
      eyebrow={t('onboarding.ttcExpectations.eyebrow')}
      footerPlacement="inline"
      title={<ItalicTitle prefix="What Floriva " accent="can" suffix={' and cannot\u00A0do.'} />}
      stickyTitle="What Floriva can and cannot do."
      description={t('onboarding.ttcExpectations.description')}
      footer={
        <View style={sharedOnboardingStyles.footerActions}>
          <ActionButton
            appearance="secondary"
            onPress={() => router.back()}
            style={sharedOnboardingStyles.secondaryAction}
          >
            {t('onboarding.ttcExpectations.backLabel')}
          </ActionButton>
          <ActionButton
            onPress={() => {
              void handleContinue();
            }}
            style={sharedOnboardingStyles.primaryAction}
            testID={testIds.onboarding.ttcExpectations.continueButton}
          >
            {isSaving ? t('onboarding.ttcExpectations.saving') : continueLabel ?? t('common.actions.continue')}
          </ActionButton>
        </View>
      }
      testID={testIds.onboarding.ttcExpectations.screen}
    >
      <SectionCard
        description={t('onboarding.ttcExpectations.sections.privateByDefault.body')}
        title={t('onboarding.ttcExpectations.sections.usedForTracking.title')}
      >
        <Text style={styles.summaryText}>
          {t('onboarding.ttcExpectations.sections.usedForTracking.body')}
        </Text>
        <Text style={styles.helperText}>
          {t('onboarding.ttcExpectations.sections.estimatesOnly.body')}
        </Text>
      </SectionCard>
      <SectionCard
        description={t('onboarding.ttcExpectations.sections.currentSetup.body')}
        title={t('onboarding.ttcExpectations.sections.currentSetup.title')}
      >
        <Text style={styles.summaryText}>
          {summarizePreferences(draft.ttcTrackingPreferences, resolvedLocale, t)}
        </Text>
      </SectionCard>
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    summaryText: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    errorText: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
  });
}
