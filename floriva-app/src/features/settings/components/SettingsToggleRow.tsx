import { useMemo } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type SettingsToggleRowProps = {
  title: string;
  summary?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (nextValue: boolean) => void;
  testID?: string;
};

/**
 * UL-63/UL-76: binary settings render as a labeled row with a native switch —
 * the platform idiom on both OSes (Material 3 switch on Android, UISwitch on
 * iOS) — instead of verb-button pills ("Turn off haptics") plus a separate
 * status line. One control communicates state and affordance together.
 */
export function SettingsToggleRow({
  disabled = false,
  onValueChange,
  summary,
  testID,
  title,
  value,
}: SettingsToggleRowProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        ios_backgroundColor={theme.colors.surfaceMuted}
        onValueChange={onValueChange}
        testID={testID}
        thumbColor={theme.colors.surfacePrimary}
        trackColor={{
          false: theme.colors.surfaceMuted,
          true: theme.colors.accentPrimary,
        }}
        value={value}
      />
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: 44,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    summary: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
