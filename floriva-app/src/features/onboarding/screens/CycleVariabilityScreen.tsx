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

export function CycleVariabilityScreen() {
  const router = useRouter();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setSupportsIrregularCycles } = useOnboarding();

  return (
    <Screen
      // UL-52: this step was missing the top back pill every sibling step has.
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Cycle variability"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 5)}
      title="Does your cycle timing usually stay steady?"
      description="This helps Floriva show a wider estimate range when your timing varies."
      footer={
        <OnboardingFooter
          continueDisabled={draft.supportsIrregularCycles === null}
          continueTestID={testIds.onboarding.cycleVariability.continueButton}
          onContinue={() => router.push('./symptom-logging')}
        />
      }
      testID={testIds.onboarding.cycleVariability.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <ChoicePanel
          description="Floriva can use a steady baseline for estimates."
          onPress={() => setSupportsIrregularCycles(false)}
          selected={draft.supportsIrregularCycles === false}
          testID={testIds.onboarding.cycleVariability.steadyOption}
          title="Usually steady"
        />
        <ChoicePanel
          description="Floriva can show a wider estimate range instead of a tight guess."
          onPress={() => setSupportsIrregularCycles(true)}
          selected={draft.supportsIrregularCycles === true}
          testID={testIds.onboarding.cycleVariability.variableOption}
          title="Can vary"
        />
      </View>
    </Screen>
  );
}
