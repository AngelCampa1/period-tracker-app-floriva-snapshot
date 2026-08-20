import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { Arc } from '@/src/components/editorial';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { OnboardingFooter } from '@/src/features/onboarding/screens/shared';
import { PrivacyPolicyModal } from '@/src/features/privacy/components/PrivacyPolicyModal';
import { testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export function WelcomeScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isPrivacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);

  return (
    <Screen
      eyebrow="Your data stays with you"
      title={
        <Text style={styles.displayTitle}>
          {'A private '}
          <Text style={styles.displayTitleAccent}>{'tracker'}</Text>
          {' for your cycle.'}
        </Text>
      }
      description="Pick a path, answer a few questions, and open Floriva. No account needed."
      footerPlacement="fixed"
      footer={
        <View style={styles.footerStack}>
          <OnboardingFooter
            continueLabel="Continue"
            continueTestID={testIds.onboarding.welcome.startButton}
            onContinue={() => router.push('./start-path')}
          />
          <Text
            accessibilityRole="button"
            onPress={() => setPrivacyPolicyVisible(true)}
            style={styles.footerPrivacyLink}
            testID={testIds.onboarding.welcome.privacyButton}
          >
            Read privacy details
          </Text>
        </View>
      }
      testID={testIds.onboarding.welcome.screen}
    >
      <View style={styles.heroRow}>
        <View style={styles.logoMarkWrap}>
          {/* UL-59: bare logo mark — the bordered app-icon tile read as a
              stray UI element rather than a brand mark. */}
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require('../../../../assets/images/logo-mark.png')}
            style={styles.logoMark}
          />
          <Text style={styles.logoLabel}>Floriva</Text>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.ornament}
        >
          <Arc color={theme.colors.accentPrimary} size={120} opacity={0.16} />
        </View>
      </View>

      <SectionCard
        description="Setup is short. These things are always true."
        title="What stays true"
      >
        <View style={styles.numberedList}>
          {(['On-device by default', 'No account required', 'Fully usable offline'] as const).map(
            (item) => (
              <Text key={item} style={styles.numberedText}>{item}</Text>
            ),
          )}
        </View>
      </SectionCard>

      <PrivacyPolicyModal
        visible={isPrivacyPolicyVisible}
        onClose={() => {
          setPrivacyPolicyVisible(false);
        }}
      />
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.lg,
    },
    ornament: {
      flexShrink: 0,
    },
    logoMark: {
      width: 56,
      height: 56,
    },
    logoMarkWrap: {
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    logoLabel: {
      color: theme.colors.textPrimary,
      letterSpacing: 0.3,
      ...theme.typography.caption,
    },
    numberedList: {
      gap: theme.spacing.sm,
    },
    numberedText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    footerStack: {
      gap: theme.spacing.sm,
    },
    footerCaption: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    footerPrivacyLink: {
      ...theme.typography.caption,
      color: theme.colors.accentPrimary,
      textAlign: 'center',
    },
    displayTitle: {
      ...theme.typography.displayLg,
      color: theme.colors.textPrimary,
    },
    displayTitleAccent: {
      ...theme.typography.displayLg,
      color: theme.colors.accentPrimary,
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, divergent).
      fontFamily: fontFamilies.serifRegularItalic,
    },
  });
}
