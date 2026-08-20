import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type EditorialOptionProps = {
  label: string;
  description?: string;
  kicker?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  suffix?: ReactNode;
};

export function EditorialOption({
  label,
  description,
  kicker,
  selected = false,
  disabled = false,
  onPress,
  testID,
  suffix,
}: EditorialOptionProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : null,
        pressed && !disabled ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
      testID={testID}
    >
      <View style={[styles.bullet, selected ? styles.bulletSelected : null]}>
        {selected ? <View style={styles.bulletInner} /> : null}
      </View>
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {suffix ? <View style={styles.suffix}>{suffix}</View> : null}
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: 'transparent',
    },
    rowSelected: {
      borderColor: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfacePrimary,
    },
    rowPressed: {
      opacity: 0.86,
    },
    rowDisabled: {
      opacity: 0.55,
    },
    bullet: {
      width: 18,
      height: 18,
      borderRadius: theme.radii.pill,
      borderWidth: 1.4,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: 'transparent',
      marginTop: 2,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletSelected: {
      borderColor: theme.colors.textPrimary,
      backgroundColor: theme.colors.textPrimary,
    },
    bulletInner: {
      width: 6,
      height: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.background,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    kicker: {
      ...theme.typography.eyebrow,
      color: theme.colors.accentPrimary,
      fontSize: 10,
    },
    label: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    description: {
      ...theme.typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    suffix: {
      flexShrink: 0,
      paddingTop: 2,
    },
  });
}
