import { useMemo } from 'react';
import * as Reanimated from 'react-native-reanimated';

import { resolveTheme, type FlorivaMotion, type FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export type FlorivaMotionMode = 'full' | 'reduced';

export type FlorivaScreenMotionVariant = 'standard' | 'hero' | 'sensitive';

export type FlorivaRevealPresetName =
  | 'screenEnter'
  | 'cardReveal'
  | 'heroBloom'
  | 'rowShift'
  | 'sensitiveScreenEnter'
  | 'modalFade';

function reducePreset(
  preset: FlorivaMotion['presets'][FlorivaRevealPresetName],
): FlorivaMotion['presets'][FlorivaRevealPresetName] {
  return {
    ...preset,
    delay: 0,
    delayStep: 0,
    distance: 0,
    duration: Math.min(preset.duration, 140),
    enterScale: 1,
  };
}

export function resolveRevealPreset(
  motion: FlorivaMotion,
  presetName: FlorivaRevealPresetName,
  reducedMotionEnabled: boolean,
) {
  const preset = motion.presets[presetName];

  return reducedMotionEnabled ? reducePreset(preset) : preset;
}

export function resolveScreenMotionPreset(
  motion: FlorivaMotion,
  variant: FlorivaScreenMotionVariant,
  reducedMotionEnabled: boolean,
) {
  if (variant === 'hero') {
    return resolveRevealPreset(motion, 'heroBloom', reducedMotionEnabled);
  }

  if (variant === 'sensitive') {
    return resolveRevealPreset(motion, 'sensitiveScreenEnter', reducedMotionEnabled);
  }

  return resolveRevealPreset(motion, 'screenEnter', reducedMotionEnabled);
}

export function resolvePressMotion(
  motion: FlorivaMotion,
  reducedMotionEnabled: boolean,
  variant: 'primary' | 'secondary' | 'destructive' = 'primary',
) {
  if (reducedMotionEnabled) {
    return null;
  }

  if (variant === 'destructive') {
    return {
      scale: 0.985,
      translateY: 0,
    };
  }

  return {
    scale: motion.presets.pressFeedback.pressedScale,
    translateY: motion.presets.pressFeedback.pressedTranslateY,
  };
}

export function createStackMotionOptions(
  reducedMotionEnabled: boolean,
  variant: 'root' | 'app' | 'onboarding',
) {
  if (reducedMotionEnabled) {
    return {
      animation: 'fade' as const,
      animationDuration: 120,
      headerShown: false,
    };
  }

  if (variant === 'onboarding') {
    return {
      animation: 'slide_from_right' as const,
      animationDuration: 360,
      headerShown: false,
    };
  }

  return {
    animation: 'fade_from_bottom' as const,
    animationDuration: variant === 'root' ? 300 : 320,
    headerShown: false,
  };
}

export function useFlorivaMotion(reducedMotionEnabledOverride?: boolean) {
  const theme = useFlorivaTheme();
  const fallbackTheme = resolveTheme('light');
  const resolvedTheme = ('motion' in theme ? theme : fallbackTheme) as FlorivaTheme;
  const reducedMotionHook = Reanimated.useReducedMotion;
  const systemReducedMotionEnabled =
    typeof reducedMotionHook === 'function' ? reducedMotionHook() : false;
  const reducedMotionEnabled = reducedMotionEnabledOverride ?? systemReducedMotionEnabled;

  return useMemo(
    () => ({
      mode: reducedMotionEnabled ? ('reduced' as FlorivaMotionMode) : ('full' as FlorivaMotionMode),
      reducedMotionEnabled,
      theme: resolvedTheme,
      motion: resolvedTheme.motion,
      resolveRevealPreset: (presetName: FlorivaRevealPresetName) =>
        resolveRevealPreset(resolvedTheme.motion, presetName, reducedMotionEnabled),
      resolveScreenPreset: (variant: FlorivaScreenMotionVariant) =>
        resolveScreenMotionPreset(resolvedTheme.motion, variant, reducedMotionEnabled),
      resolvePressMotion: (
        variant: 'primary' | 'secondary' | 'destructive' = 'primary',
      ) => resolvePressMotion(resolvedTheme.motion, reducedMotionEnabled, variant),
    }),
    [reducedMotionEnabled, resolvedTheme],
  );
}

export function createMotionTestId(baseTestId: string | undefined, suffix: string) {
  return baseTestId ? `${baseTestId}-${suffix}` : undefined;
}

export type MotionThemeContext = {
  motion: FlorivaMotion;
  theme: FlorivaTheme;
};
