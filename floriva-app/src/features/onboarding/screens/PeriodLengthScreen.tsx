import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoiceChip,
  InputField,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

function validatePeriodLength(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return 'Enter a period length between 1 and 30 days.';
  }

  const periodLength = Number.parseInt(value, 10);

  if (periodLength < 1 || periodLength > 30) {
    return 'Enter a period length between 1 and 30 days.';
  }

  return null;
}

export function PeriodLengthScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setPeriodLengthInput, confirmPeriodLength } = useOnboarding();
  const [error, setError] = useState<string | undefined>();
  const commonLengths = ['4', '5', '6', '7'];

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow="Period length"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 4)}
      title="How long does your period usually last?"
      description="One number is enough. Floriva just needs a starting point."
      footer={
        <OnboardingFooter
          continueTestID={testIds.onboarding.periodLength.continueButton}
          onContinue={() => {
            const nextError = validatePeriodLength(draft.periodLengthInput);

            if (nextError) {
              setError(nextError);
              return;
            }

            confirmPeriodLength();
            router.push('./symptom-logging');
          }}
        />
      }
      testID={testIds.onboarding.periodLength.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <InputField
          error={error}
          keyboardType="number-pad"
          label="Period length in days"
          onChangeText={(value) => {
            setPeriodLengthInput(value);
            setError(undefined);
          }}
          testID={testIds.onboarding.periodLength.input}
          value={draft.periodLengthInput}
        />
        <View style={sharedOnboardingStyles.rowWrap}>
          {commonLengths.map((length) => (
            <ChoiceChip
              key={length}
              label={`${length} days`}
              onPress={() => {
                setPeriodLengthInput(length);
                setError(undefined);
              }}
              selected={draft.periodLengthInput === length}
            />
          ))}
        </View>
        <Text style={styles.helperText}>
          This helps Floriva show clearer period predictions right away.
        </Text>
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
