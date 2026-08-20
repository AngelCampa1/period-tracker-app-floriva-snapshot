import { useMemo, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { usePressFeedback } from '@/src/features/feedback/usePressFeedback';
import { useFlorivaMotion } from '@/src/features/motion/useFlorivaMotion';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type ActionButtonAppearance = 'destructive' | 'glass' | 'primary' | 'quiet' | 'secondary';

type ActionButtonProps = PropsWithChildren<{
  onPress: () => void;
  appearance?: ActionButtonAppearance;
  accessibilitySelected?: boolean;
  motionVariant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  fitLabelToSingleLine?: boolean;
  reducedMotionEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function ActionButton({
  accessibilitySelected,
  appearance = 'primary',
  children,
  disabled = false,
  fitLabelToSingleLine = false,
  motionVariant,
  onPress,
  reducedMotionEnabled,
  style,
  testID,
}: ActionButtonProps) {
  const theme = useFlorivaTheme();
  const florivaMotion = useFlorivaMotion(reducedMotionEnabled);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const handlePress = usePressFeedback(onPress);
  const [isPressed, setIsPressed] = useState(false);
  const resolvedMotionVariant = motionVariant ?? (appearance === 'primary' ? 'primary' : 'secondary');
  const pressMotion = florivaMotion.resolvePressMotion(
    appearance === 'destructive' && !motionVariant ? 'destructive' : resolvedMotionVariant,
  );
  const accessibilityState =
    accessibilitySelected === undefined
      ? { disabled }
      : { disabled, selected: accessibilitySelected };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPressIn={() => {
        setIsPressed(true);
      }}
      onPress={handlePress}
      onPressOut={() => {
        setIsPressed(false);
      }}
      style={[
        styles.base,
        styles[appearance],
        // UL-37: disabled is its own token treatment (muted surface + rule
        // border, or bare for quiet), not a washed 0.5-opacity variant of the
        // enabled fill that read as a "muted style" rather than "disabled".
        disabled ? (appearance === 'quiet' ? styles.disabledQuiet : styles.disabled) : null,
        isPressed && !disabled ? styles.pressed : null,
        isPressed && !disabled && pressMotion
          ? {
              transform: [
                { scale: pressMotion.scale },
                { translateY: pressMotion.translateY },
              ],
            }
          : null,
        style,
      ]}
      testID={testID}
    >
      <Text
        adjustsFontSizeToFit={fitLabelToSingleLine}
        minimumFontScale={fitLabelToSingleLine ? 0.82 : undefined}
        numberOfLines={fitLabelToSingleLine ? 1 : undefined}
        style={[
          styles.label,
          appearance === 'primary' ? styles.primaryText : null,
          appearance === 'secondary' ? styles.secondaryText : null,
          appearance === 'glass' ? styles.glassText : null,
          appearance === 'quiet' ? styles.quietText : null,
          appearance === 'destructive' ? styles.destructiveText : null,
          disabled ? styles.disabledText : null,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    base: {
      minHeight: 56,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    primary: {
      backgroundColor: theme.colors.accentPrimary,
      borderColor: theme.colors.accentPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.buttonSecondaryFill,
      borderColor: theme.colors.buttonSecondaryBorder,
    },
    glass: {
      backgroundColor: theme.colors.buttonGlassFill,
      borderColor: theme.colors.buttonGlassBorder,
    },
    quiet: {
      backgroundColor: theme.colors.buttonQuietFill,
      borderColor: 'transparent',
    },
    destructive: {
      backgroundColor: theme.colors.buttonDestructiveFill,
      borderColor: theme.colors.buttonDestructiveBorder,
    },
    pressed: {
      opacity: 0.9,
    },
    // UL-37: shared disabled surface for every filled appearance (primary,
    // secondary, glass, destructive) — a desaturated muted fill with the rule
    // border, so "can't tap yet" never reads as a washed accent CTA.
    disabled: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.borderPrimary,
    },
    // Quiet buttons have no fill to mute; they signal disabled via the label.
    disabledQuiet: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    disabledText: {
      color: theme.colors.textTertiary,
    },
    label: {
      ...theme.typography.bodyStrong,
    },
    primaryText: {
      color: theme.colors.buttonPrimaryText,
    },
    secondaryText: {
      color: theme.colors.buttonSecondaryText,
    },
    glassText: {
      color: theme.colors.buttonGlassText,
    },
    quietText: {
      color: theme.colors.buttonQuietText,
    },
    destructiveText: {
      color: theme.colors.buttonDestructiveText,
    },
  });
}
