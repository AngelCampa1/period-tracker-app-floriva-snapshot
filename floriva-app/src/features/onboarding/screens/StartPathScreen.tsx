import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  buildFreshOnboardingProgress,
  ChoicePanel,
  OnboardingFooter,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export function StartPathScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft, setStartPath } = useOnboarding();

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
        // UL-53: the e2e suites drive backward navigation through this ID; it
        // moved here from the (removed) duplicate footer Back button.
        testID: testIds.onboarding.startPath.backButton,
      }}
      eyebrow="How to begin"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, 1)}
      title={
        <Text style={styles.titleText}>
          {'Choose the easiest way '}
          <Text style={styles.titleAccent}>{'to start.'}</Text>
        </Text>
      }
      description="Pick one path. Floriva will keep the next steps short."
      footer={
        <OnboardingFooter
          continueDisabled={!draft.startPath}
          continueTestID={testIds.onboarding.startPath.continueButton}
          onContinue={() => {
            if (draft.startPath === 'import') {
              router.push('./import');
              return;
            }

            if (draft.startPath === 'restore') {
              router.push('./restore');
              return;
            }

            router.push('./last-period-start');
          }}
        />
      }
      testID={testIds.onboarding.startPath.screen}
    >
      <View style={sharedOnboardingStyles.stack}>
        <ChoicePanel
          description="Answer a few setup questions and open your tracker."
          kicker="Recommended"
          onPress={() => setStartPath('fresh')}
          selected={draft.startPath === 'fresh'}
          testID={testIds.onboarding.startPath.freshOption}
          title="Start fresh"
        />
        <ChoicePanel
          description="Bring your history from Flo or Clue before you open Floriva."
          onPress={() => setStartPath('import')}
          selected={draft.startPath === 'import'}
          testID={testIds.onboarding.startPath.importOption}
          title="Import from Flo or Clue"
        />
        <ChoicePanel
          description="Restore a Floriva backup from another device or a manual export file."
          onPress={() => setStartPath('restore')}
          selected={draft.startPath === 'restore'}
          testID={testIds.onboarding.startPath.restoreOption}
          title="Restore Floriva backup"
        />
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    titleText: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    titleAccent: {
      ...theme.typography.title,
      color: theme.colors.accentPrimary,
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, divergent).
      fontFamily: fontFamilies.serifMediumItalic,
    },
  });
}
