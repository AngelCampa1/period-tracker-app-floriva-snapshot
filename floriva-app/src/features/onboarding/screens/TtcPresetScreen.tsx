import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoicePanel,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';

export function TtcPresetScreen() {
  const router = useRouter();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { t } = useLocalization();
  const { draft, setTtcTrackingPreset } = useOnboarding();

  return (
    <Screen
      // UL-52: this step was missing the top back pill every sibling step has.
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Conception preset"
      footerPlacement="fixed"
      headerActions={
        <HelpTooltip
          body={t('common.help.sensitiveLogging.body')}
          closeLabel={t('common.actions.close')}
          testID="onboarding-conception-preset-help"
          title={t('common.help.sensitiveLogging.title')}
        />
      }
      progress={buildFreshOnboardingProgress(draft, 7)}
      title="How much trying-to-conceive detail do you want ready?"
      description="Pick a preset now. You can adjust specific fields later in Settings."
      footer={
        <OnboardingFooter
          continueDisabled={!draft.ttcTrackingPreset}
          continueTestID={testIds.onboarding.ttcPreset.continueButton}
          onContinue={() => router.push('./notifications')}
        />
      }
      testID={testIds.onboarding.ttcPreset.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <ChoicePanel
          description="Track sex and ovulation tests. Add more detail later if you want."
          onPress={() => setTtcTrackingPreset('basic')}
          selected={draft.ttcTrackingPreset === 'basic'}
          testID={testIds.onboarding.ttcPreset.basicOption}
          title="Basic conception"
        />
        <ChoicePanel
          description="Track sex, ovulation tests, cervical mucus, and basal body temperature from the start."
          onPress={() => setTtcTrackingPreset('full')}
          selected={draft.ttcTrackingPreset === 'full'}
          testID={testIds.onboarding.ttcPreset.fullOption}
          title="Detailed conception"
        />
      </View>
    </Screen>
  );
}
