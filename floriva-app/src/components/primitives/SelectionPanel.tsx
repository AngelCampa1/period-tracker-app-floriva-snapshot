import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type SelectionPanelProps = {
  description: string;
  kicker?: string;
  onPress: () => void;
  reducedMotionEnabled?: boolean;
  selected?: boolean;
  selectedBadgeLabel?: string;
  testID?: string;
  title: string;
};

export function SelectionPanel({
  description,
  kicker,
  onPress,
  reducedMotionEnabled,
  selected = false,
  selectedBadgeLabel,
  testID,
  title,
}: SelectionPanelProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <MotionPressableSurface
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      feedbackType="selection"
      motionVariant="secondary"
      onPress={onPress}
      pressedStyle={styles.pressed}
      reducedMotionEnabled={reducedMotionEnabled}
      revealPreset="cardReveal"
      style={[styles.base, selected ? styles.selected : null]}
      testID={testID}
    >
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {selected && selectedBadgeLabel ? (
          <Text style={styles.badge}>{selectedBadgeLabel}</Text>
        ) : null}
      </View>
      <Text style={styles.description}>{description}</Text>
    </MotionPressableSurface>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    base: {
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: theme.colors.surfacePrimary,
      padding: theme.spacing.lg,
    },
    selected: {
      borderColor: theme.colors.accentPrimary,
      backgroundColor: theme.colors.chipSelectedFill,
    },
    pressed: {
      opacity: 0.96,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    badge: {
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      color: theme.colors.chipSelectedText,
      backgroundColor: theme.colors.buttonQuietFill,
      ...theme.typography.caption,
    },
    kicker: {
      ...theme.typography.eyebrow,
      color: theme.colors.accentPrimary,
    },
    description: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
