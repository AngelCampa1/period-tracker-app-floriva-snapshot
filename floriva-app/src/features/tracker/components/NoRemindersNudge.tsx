import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type NoRemindersNudgeProps = {
  onDismiss: () => void;
};

export function NoRemindersNudge({ onDismiss }: NoRemindersNudgeProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useLocalization();

  function handleSetUp() {
    router.push('/(app)/settings/reminders' as never);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.iconWrap}>
        <View style={styles.iconDot} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('tracker.noReminders.title')}</Text>
        <Text style={styles.bodyText}>{t('tracker.noReminders.body')}</Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
          onPress={handleSetUp}
        >
          <Text style={styles.cta}>{t('tracker.noReminders.cta')}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={t('tracker.noReminders.dismiss')}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onDismiss}
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    iconWrap: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    iconDot: {
      width: 6,
      height: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    body: {
      flex: 1,
      gap: 4,
    },
    title: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    bodyText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    cta: {
      ...theme.typography.caption,
      color: theme.colors.accentPrimary,
      textDecorationLine: 'underline',
      marginTop: 4,
    },
    dismiss: {
      paddingHorizontal: 4,
    },
    dismissText: {
      fontSize: 22,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
  });
}
