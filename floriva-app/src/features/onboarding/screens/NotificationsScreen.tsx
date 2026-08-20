import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { useDatabase } from '@/src/db/DatabaseProvider';
import {
  buildFreshOnboardingProgress,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { ensureReminderPermissions } from '@/src/lib/notifications/reminderScheduler';
import { testIds } from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type ReminderOption = {
  key: 'daily' | 'period' | 'fertile';
  title: string;
  body: string;
};

const REMINDER_OPTIONS: ReminderOption[] = [
  {
    key: 'daily',
    title: 'Daily log nudge',
    body: 'A gentle ping to log today. You pick the time.',
  },
  {
    key: 'period',
    title: 'Period incoming',
    body: 'A heads-up the day before your period is estimated to start.',
  },
  {
    key: 'fertile',
    title: 'Fertile window opening',
    body: 'A heads-up when your estimated fertile window is about to begin.',
  },
];

export function NotificationsScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { draft } = useOnboarding();
  const { repositories } = useDatabase();
  const [isRequesting, setIsRequesting] = useState(false);

  async function handleAllow() {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await ensureReminderPermissions();
      const existing = await repositories.reminderPreferences.getPreferences();
      const updated = existing.map((preference) => ({ ...preference, enabled: true }));
      await repositories.reminderPreferences.savePreferences(updated);
    } catch {
      // Permission denial is non-fatal. Proceed to next step regardless.
    } finally {
      setIsRequesting(false);
      router.push('./completion');
    }
  }

  function handleSkip() {
    router.push('./completion');
  }

  return (
    <Screen
      backAction={{ label: 'Back', onPress: () => router.back() }}
      eyebrow="Notifications"
      footerPlacement="fixed"
      progress={buildFreshOnboardingProgress(draft, draft.ttcEnabled ? 8 : 7)}
      title={
        <Text style={styles.titleRow}>
          {'A quiet '}
          <Text style={styles.titleAccent}>nudge</Text>
          {', when it matters.'}
        </Text>
      }
      description="Floriva can remind you to log and alert you before your next period or estimated fertile window. Reminders stay on your device."
      footer={
        // UL-52: secondary on the left, primary on the bottom-right — the
        // same reading order as every other onboarding footer.
        <View style={sharedOnboardingStyles.footerActions}>
          <ActionButton
            appearance="secondary"
            onPress={handleSkip}
            disabled={isRequesting}
            style={sharedOnboardingStyles.secondaryAction}
            testID={testIds.onboarding.notifications.skipButton}
          >
            Skip for now
          </ActionButton>
          <ActionButton
            onPress={handleAllow}
            disabled={isRequesting}
            style={sharedOnboardingStyles.primaryAction}
            testID={testIds.onboarding.notifications.allowButton}
          >
            {isRequesting ? 'Requesting…' : 'Allow notifications'}
          </ActionButton>
        </View>
      }
      testID={testIds.onboarding.notifications.screen}
    >
      <View style={styles.list}>
        {REMINDER_OPTIONS.map((option) => (
          <View key={option.key} style={styles.option}>
            <View style={styles.iconWrap}>
              <View style={styles.iconDot} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.body}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.footnote}>
          Reminders are scheduled on your device and work offline. You can change or turn them off
          any time in Settings, under Reminders.
        </Text>
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    titleRow: {
      ...theme.typography.display,
      color: theme.colors.textPrimary,
    },
    titleAccent: {
      ...theme.typography.display,
      color: theme.colors.accentPrimary,
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, divergent).
      fontFamily: fontFamilies.serifRegularItalic,
    },
    list: {
      gap: theme.spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surfacePrimary,
      borderColor: theme.colors.borderPrimary,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    iconDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    optionBody: {
      flex: 1,
      gap: 4,
    },
    optionTitle: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    optionDescription: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    footnote: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.sm,
    },
  });
}
