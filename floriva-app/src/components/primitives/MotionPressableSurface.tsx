import { useState, type PropsWithChildren } from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { usePressFeedback } from '@/src/features/feedback/usePressFeedback';
import { MotionView } from '@/src/features/motion/MotionView';
import {
  type FlorivaRevealPresetName,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';

type MotionPressableSurfaceProps = PropsWithChildren<{
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  disableLayoutTransition?: boolean;
  feedbackType?: 'action' | 'selection';
  hitSlop?: Insets | number;
  motionVariant?: 'primary' | 'secondary' | 'destructive';
  onLongPress?: () => void;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  pressedStyle?: StyleProp<ViewStyle>;
  reducedMotionEnabled?: boolean;
  revealPreset?: FlorivaRevealPresetName;
  sequenceIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function MotionPressableSurface({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
  containerStyle,
  disabled = false,
  disableLayoutTransition = false,
  feedbackType = 'action',
  hitSlop,
  motionVariant = 'primary',
  onLongPress,
  onPress,
  onPressIn,
  onPressOut,
  pressedStyle,
  reducedMotionEnabled,
  revealPreset,
  sequenceIndex = 0,
  style,
  testID,
}: MotionPressableSurfaceProps) {
  const [isPressed, setIsPressed] = useState(false);
  const handlePress = usePressFeedback(onPress, feedbackType);
  const florivaMotion = useFlorivaMotion(reducedMotionEnabled);
  const pressMotion = florivaMotion.resolvePressMotion(motionVariant);

  const pressable = (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      hitSlop={hitSlop}
      onLongPress={onLongPress}
      onPress={handlePress}
      onPressIn={() => {
        setIsPressed(true);
        onPressIn?.();
      }}
      onPressOut={() => {
        setIsPressed(false);
        onPressOut?.();
      }}
      style={[
        style,
        isPressed && !disabled ? pressedStyle : null,
        isPressed && !disabled && pressMotion
          ? {
              transform: [
                { scale: pressMotion.scale },
                { translateY: pressMotion.translateY },
              ],
            }
          : null,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );

  if (!revealPreset) {
    return pressable;
  }

  return (
    <MotionView
      disableLayoutTransition={disableLayoutTransition}
      preset={revealPreset}
      reducedMotionEnabled={reducedMotionEnabled}
      sequenceIndex={sequenceIndex}
      style={containerStyle}
    >
      {pressable}
    </MotionView>
  );
}
