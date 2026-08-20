import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoicePanel,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { testIds } from '@/src/testing/testIds';

export function SymptomLoggingScreen() {
  const router = useRouter();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setSymptomLoggingEnabled } = useOnboarding();

  return (
    <Screen
      // UL-52: this step was missing the top back pill every sibling step has.
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Symptom logging"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 5)}
      title="Do you want symptom and mood logging ready from day one?"
      description="This only changes what Floriva puts in front of you. You can still turn it on later."
      footer={
        <OnboardingFooter
          continueDisabled={draft.symptomLoggingEnabled === null}
          continueTestID={testIds.onboarding.symptomLogging.continueButton}
          onContinue={() => router.push('./ttc')}
        />
      }
      testID={testIds.onboarding.symptomLogging.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <ChoicePanel
          description="Symptoms, mood, and daily notes will be ready in the logging flow."
          onPress={() => setSymptomLoggingEnabled(true)}
          selected={draft.symptomLoggingEnabled === true}
          testID={testIds.onboarding.symptomLogging.yesOption}
          title="Yes, include it"
        />
        <ChoicePanel
          description="Keep Floriva focused on cycle timing for now."
          onPress={() => setSymptomLoggingEnabled(false)}
          selected={draft.symptomLoggingEnabled === false}
          testID={testIds.onboarding.symptomLogging.noOption}
          title="No, keep it simpler"
        />
      </View>
    </Screen>
  );
}
