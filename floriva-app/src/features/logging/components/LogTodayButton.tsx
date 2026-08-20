import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type LogTodayButtonProps = {
  logDate: string;
};

/**
 * Primary "Log today" call to action. Lives above TODAY'S LOG on the Today
 * screen so the main action stays reachable at rest instead of being tucked
 * under the floating native tab bar at the bottom of the scroll view.
 */
export function LogTodayButton({ logDate }: LogTodayButtonProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useLocalization();

  function handleLogToday() {
    router.push(`/calendar/day/${logDate}` as never);
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handleLogToday}
      style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
      testID={testIds.today.logTodayButton}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={styles.ctaText}
      >
        {t('tracker.summary.logToday')}
      </Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={styles.ctaArrow}
      >
        →
      </Text>
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    cta: {
      backgroundColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    ctaPressed: {
      opacity: 0.85,
    },
    ctaText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.buttonPrimaryText,
      fontSize: 17,
      flexShrink: 1,
    },
    ctaArrow: {
      ...theme.typography.bodyStrong,
      color: theme.colors.buttonPrimaryText,
      fontSize: 17,
    },
  });
}
