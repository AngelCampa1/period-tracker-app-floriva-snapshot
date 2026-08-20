import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import {
  type FlorivaRevealPresetName,
  createMotionTestId,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';

type MotionViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  motionSuffix?: string;
  preset: FlorivaRevealPresetName;
  sequenceIndex?: number;
  reducedMotionEnabled?: boolean;
  disableLayoutTransition?: boolean;
}>;

export function MotionView({
  children,
  disableLayoutTransition = false,
  motionSuffix = 'motion',
  preset,
  reducedMotionEnabled,
  sequenceIndex = 0,
  style,
  testID,
}: MotionViewProps) {
  const florivaMotion = useFlorivaMotion(reducedMotionEnabled);
  const resolvedPreset = florivaMotion.resolveRevealPreset(preset);
  const entering = florivaMotion.reducedMotionEnabled
    ? undefined
    : FadeIn.duration(resolvedPreset.duration)
        .delay(resolvedPreset.delay + resolvedPreset.delayStep * sequenceIndex)
        .withInitialValues({
          opacity: 0,
          transform: [
            { translateY: resolvedPreset.distance },
            { scale: resolvedPreset.enterScale },
          ],
        });
  const layout = disableLayoutTransition || florivaMotion.reducedMotionEnabled
    ? undefined
    : LinearTransition.duration(florivaMotion.motion.durations.settle);

  return (
    <Animated.View
      entering={entering}
      layout={layout}
      style={style}
      testID={createMotionTestId(testID, motionSuffix)}
    >
      {children}
    </Animated.View>
  );
}
