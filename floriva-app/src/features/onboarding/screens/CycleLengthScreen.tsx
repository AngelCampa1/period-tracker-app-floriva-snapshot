import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoiceChip,
  ChoicePanel,
  InputField,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { EditorialRule } from '@/src/components/editorial/EditorialRule';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

function validateCycleLength(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return 'Enter your usual cycle length.';
  }

  const cycleLength = Number.parseInt(value, 10);

  if (cycleLength < 1 || cycleLength > 120) {
    return 'Enter a cycle length between 1 and 120 days.';
  }

  return null;
}

export function CycleLengthScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setCycleLengthInput, confirmCycleLength, setSupportsIrregularCycles } =
    useOnboarding();
  const [error, setError] = useState<string | undefined>();
  const commonLengths = ['26', '28', '29', '30', '32'];

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Cycle length"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 3)}
      title="What is your usual cycle length?"
      description="This gives Floriva a real starting point instead of a generic guess."
      footer={
        <OnboardingFooter
          continueDisabled={draft.supportsIrregularCycles === null}
          continueTestID={testIds.onboarding.cycleLength.continueButton}
          onContinue={() => {
            const nextError = validateCycleLength(draft.cycleLengthInput);

            if (nextError) {
              setError(nextError);
              return;
            }

            confirmCycleLength();
            router.push('./period-length');
          }}
        />
      }
      testID={testIds.onboarding.cycleLength.screen}
    >
      {/* UL-62: no hero numeral panel — it restated the same value a third
          time above the input and the selected chip, and pushed the required
          Variability choice below the fold. */}
      <View style={sharedOnboardingStyles.stack}>
        <InputField
          error={error}
          keyboardType="number-pad"
          label="Cycle length in days"
          onChangeText={(value) => {
            setCycleLengthInput(value);
            setError(undefined);
          }}
          testID={testIds.onboarding.cycleLength.input}
          value={draft.cycleLengthInput}
        />
        <Text style={styles.averageText}>Average: 21-35</Text>
        <View style={sharedOnboardingStyles.rowWrap}>
          {commonLengths.map((length) => (
            <ChoiceChip
              key={length}
              label={`${length} days`}
              onPress={() => {
                setCycleLengthInput(length);
                setError(undefined);
              }}
              selected={draft.cycleLengthInput === length}
            />
          ))}
        </View>
        <Text style={styles.helperText}>
          Floriva uses this to estimate your next period and fertile window. These are estimates, not guarantees.
        </Text>

        <EditorialRule mark="Variability" />
        <ChoicePanel
          description="Within ±2 days month to month"
          onPress={() => setSupportsIrregularCycles(false)}
          selected={draft.supportsIrregularCycles === false}
          testID={testIds.onboarding.cycleVariability.steadyOption}
          title="Pretty regular"
        />
        <ChoicePanel
          description="A few days of drift either way"
          onPress={() => setSupportsIrregularCycles(true)}
          selected={draft.supportsIrregularCycles === true}
          testID={testIds.onboarding.cycleVariability.variableOption}
          title="Sometimes irregular"
        />
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    averageText: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
