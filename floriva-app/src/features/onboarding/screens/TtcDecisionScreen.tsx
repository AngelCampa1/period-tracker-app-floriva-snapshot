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

export function TtcDecisionScreen() {
  const router = useRouter();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { t } = useLocalization();
  const { draft, setTtcEnabled } = useOnboarding();

  return (
    <Screen
      // UL-52: this step was missing the top back pill every sibling step has.
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Trying to conceive"
      footerPlacement="fixed"
      headerActions={
        <HelpTooltip
          body={t('common.help.tryingToConceive.body')}
          closeLabel={t('common.actions.close')}
          testID="onboarding-trying-to-conceive-help"
          title={t('common.help.tryingToConceive.title')}
        />
      }
      progress={buildFreshOnboardingProgress(draft, 6)}
      title="Do you want trying-to-conceive tracking turned on?"
      description="Floriva stays in regular cycle mode unless you turn this on."
      footer={
        <OnboardingFooter
          continueDisabled={draft.ttcEnabled === null}
          continueTestID={testIds.onboarding.ttc.continueButton}
          onContinue={() => {
            if (draft.ttcEnabled) {
              router.push('./ttc-preset');
              return;
            }

            router.push('./notifications');
          }}
        />
      }
      testID={testIds.onboarding.ttc.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <ChoicePanel
          description="Adds conception logging fields to your regular cycle tracker."
          onPress={() => setTtcEnabled(true)}
          selected={draft.ttcEnabled === true}
          testID={testIds.onboarding.ttc.yesOption}
          title="Yes, turn it on"
        />
        <ChoicePanel
          description="Stay focused on cycle tracking now. You can turn this on later in Settings."
          onPress={() => setTtcEnabled(false)}
          selected={draft.ttcEnabled === false}
          testID={testIds.onboarding.ttc.noOption}
          title="No, not right now"
        />
      </View>
    </Screen>
  );
}
