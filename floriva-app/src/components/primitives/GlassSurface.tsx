import { Platform, StyleSheet, View } from 'react-native';
import type { ColorValue, ViewProps } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/**
 * Liquid Glass availability, guarded. `isLiquidGlassAvailable()` calls into the
 * native ExpoGlassEffect module; if that module is missing (e.g. a dev client
 * built before the dependency was added) or ever throws, we must degrade to the
 * solid fallback rather than crash the whole screen. A period tracker should
 * never white-screen over a presentation effect.
 */
function liquidGlassAvailable() {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export type GlassSurfaceProps = ViewProps & {
  /** iOS 26 UIGlassEffect material. `regular` for chrome, `clear` for lighter overlays. */
  material?: 'regular' | 'clear';
  /** Optional accent wash — applied over genuine glass only. */
  tint?: ColorValue;
  /** Corner radius. Defaults to the large editorial radius. */
  radius?: number;
  /** Enables pressable/hover glass on iOS 26. */
  interactive?: boolean;
  /**
   * Android Material elevation. Defaults to `true` (a raised, shadowed surface)
   * for floating chrome like the sticky header and tooltip sheet. Pass `false`
   * for a full-bleed *backdrop* that must sit BEHIND its sibling content: on
   * Android, elevation controls sibling draw order, so an elevated absolute-fill
   * backdrop would composite over — and hide — later siblings (e.g. the fixed
   * footer's action buttons). No effect on iOS.
   */
  elevated?: boolean;
  /** Draws a hairline edge (theme.glass.border) around the surface. */
  bordered?: boolean;
  /** Solid color used when Liquid Glass is unavailable (iOS < 26 / reduce transparency). */
  fallbackColor?: ColorValue;
};

/**
 * Shared Liquid Glass surface. Renders Apple's real UIGlassEffect on iOS 26,
 * and degrades to a readable solid everywhere else:
 *   - Android → clean Material 3 elevated surface (no faux glass)
 *   - iOS < 26 / glass unavailable → flat solid fallback
 *
 * All other `ViewProps` (onLayout, testID, accessibility*, pointerEvents, …) pass
 * through to the underlying surface so headers, cards, buttons, and modals can
 * drive it without wrapping. Presentation-only; no data collection (see Phase 2
 * privacy review).
 */
export function GlassSurface({
  material = 'regular',
  tint,
  radius,
  interactive = false,
  bordered = false,
  elevated = true,
  fallbackColor,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const theme = useFlorivaTheme();
  const resolvedRadius = radius ?? theme.radii.lg;
  const resolvedFallback = fallbackColor ?? theme.glass.fallback[material];
  const edge = bordered
    ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glass.border }
    : null;

  // iOS 26 Liquid Glass: OS-rendered material. `tint` washes glass only.
  if (Platform.OS === 'ios' && liquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={material}
        tintColor={tint as string | undefined}
        isInteractive={interactive}
        {...rest}
        style={[styles.glass, { borderRadius: resolvedRadius }, edge, style]}
      >
        {children}
      </GlassView>
    );
  }

  // Android: clean Material 3 — solid elevated surface, deliberately no glass.
  if (Platform.OS === 'android') {
    return (
      <View
        testID="glass-surface-fallback"
        {...rest}
        style={[
          {
            backgroundColor: resolvedFallback,
            borderRadius: resolvedRadius,
            elevation: elevated ? theme.glass.elevation.raised : 0,
          },
          edge,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS < 26 / Liquid Glass unavailable: flat solid fallback (no elevation).
  return (
    <View
      testID="glass-surface-fallback"
      {...rest}
      style={[
        { backgroundColor: resolvedFallback, borderRadius: resolvedRadius },
        edge,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
  },
});
