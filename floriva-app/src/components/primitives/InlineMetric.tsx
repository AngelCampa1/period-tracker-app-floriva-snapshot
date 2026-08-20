import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { MotionView } from '@/src/features/motion/MotionView';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type InlineMetricProps = {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'accent';
  /**
   * Accent values default to the tabular numeral typeface, which suits stats like "42".
   * Set false for prose accent values (e.g. a language name) so they render in the serif
   * title face instead of the monospaced numeral face.
   */
  numeric?: boolean;
  testID?: string;
};

export function InlineMetric({
  label,
  numeric = true,
  style,
  testID,
  tone = 'default',
  value,
}: InlineMetricProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const accentValueStyle =
    tone === 'accent' ? (numeric ? styles.valueAccent : styles.valueAccentProse) : null;

  return (
    <MotionView preset="rowShift" style={styles.layoutShell} testID={testID}>
      <View
        style={[
          styles.base,
          tone === 'accent' ? styles.accentShell : null,
          style,
        ]}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, accentValueStyle]}>{value}</Text>
      </View>
    </MotionView>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    layoutShell: {
      flex: 1,
      minWidth: 132,
    },
    base: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    accentShell: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.borderStrong,
    },
    label: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
    },
    value: {
      color: theme.colors.textPrimary,
      ...theme.typography.title,
      fontSize: 22,
      lineHeight: 24,
    },
    valueAccent: {
      ...theme.typography.numeral,
      fontSize: 30,
      lineHeight: 36,
      color: theme.colors.accentPrimary,
    },
    valueAccentProse: {
      ...theme.typography.title,
      fontSize: 22,
      lineHeight: 28,
      color: theme.colors.accentPrimary,
    },
  });
}
