import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { GlassSurface } from '@/src/components/primitives/GlassSurface';
import { withAlpha, type FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/** Scroll distance over which the pinned bar fades in as the large title leaves. */
export const HEADER_REVEAL_FADE = 48;

/**
 * Opacity of the bone paper scrim layered inside the glass bar on iOS (UL-01).
 * On iOS 26 the GlassView's `tint` wash renders near-clear over light content,
 * letting scrolled text superimpose the bar's title. The prior 0.85 scrim still
 * let high-contrast body text ghost through the collapsed bar and collide with
 * the title (pre-release sweep 2026-07-23: verified on the paywall + backup-
 * restore collapse bars). Bumped to 0.96 — a near-solid bone underlay that
 * guarantees the title and back label stay legible over ANY scrolled content
 * while retaining a whisper of Liquid Glass refraction at the edges. Android
 * needs no scrim: its GlassSurface fallback is already an opaque Material surface.
 */
export const HEADER_SCRIM_OPACITY = 0.96;

/**
 * Whether the pinned header should be revealed at a given scroll offset. The
 * fade-in starts `HEADER_REVEAL_FADE` before the threshold and is clamped so a
 * header shorter than the fade distance is still revealable from offset 0.
 */
export function isHeaderRevealed(
  scrollY: number,
  revealThreshold: number,
  fade = HEADER_REVEAL_FADE,
) {
  return scrollY >= Math.max(revealThreshold - fade, 0);
}

type ScreenScrollHeaderBackAction = {
  label: string;
  onPress?: () => void;
  testID?: string;
};

type ScreenScrollHeaderProps = {
  title: string;
  scrollY: Animated.Value;
  revealThreshold: number;
  topInset: number;
  /** Scroll offset the host mounts at, so the bar's revealed state is correct
   *  before the first scroll event (e.g. Calendar mounts pre-scrolled). */
  initialScrollOffset?: number;
  backAction?: ScreenScrollHeaderBackAction;
  testID?: string;
};

/**
 * The pinned Liquid Glass "collapse bar". It sits over the top of a Screen and
 * stays invisible/non-interactive while the editorial large-title header is in
 * view, then fades in — as a compact glass bar with the screen title and an
 * optional back control — once that header scrolls away. This gives the native
 * large-title-collapses-into-glass feel without replacing Floriva's editorial
 * header. Presentation-only.
 */
export function ScreenScrollHeader({
  title,
  scrollY,
  revealThreshold,
  topInset,
  initialScrollOffset = 0,
  backAction,
  testID,
}: ScreenScrollHeaderProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const latestScrollRef = useRef(initialScrollOffset);
  const [revealed, setRevealed] = useState(() =>
    isHeaderRevealed(initialScrollOffset, revealThreshold),
  );

  const fadeStart = Math.max(revealThreshold - HEADER_REVEAL_FADE, 0);
  const inputRange =
    revealThreshold > fadeStart ? [fadeStart, revealThreshold] : [fadeStart, fadeStart + 1];
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [-6, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    // Animated.Value.addListener only fires on subsequent changes, not the
    // current value — so re-derive on mount and whenever the measured threshold
    // updates. Without this a bar mounted at a non-zero offset (Calendar opens
    // pre-scrolled) would render opaque yet stay non-interactive and
    // screen-reader-hidden until the first scroll.
    setRevealed(isHeaderRevealed(latestScrollRef.current, revealThreshold));
    const id = scrollY.addListener(({ value }) => {
      latestScrollRef.current = value;
      setRevealed(isHeaderRevealed(value, revealThreshold));
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY, revealThreshold]);

  return (
    <Animated.View
      accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
      pointerEvents={revealed ? 'auto' : 'none'}
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
      testID={testID}
    >
      <GlassSurface
        material="regular"
        tint={theme.glass.tint.regular}
        radius={0}
        style={styles.glass}
      >
        {Platform.OS === 'ios' ? (
          // UL-01: legibility scrim. The bone underlay guarantees readable text
          // even when iOS 26 renders the glass material near-clear; Android's
          // fallback surface is already opaque, so no scrim (and no layer that
          // could interact with Material elevation) is added there.
          <View
            pointerEvents="none"
            style={styles.scrim}
            testID={testID ? `${testID}-scrim` : undefined}
          />
        ) : null}
        {/* topInset lives on the row, NOT the GlassSurface: the scrim is an
            absolute-fill child and RN insets absolute children from the padding
            box, so padding on the surface would leave the status-bar strip
            unscrimmed and let scrolled text ghost through there (UL-01 / prerelease
            sweep 2026-07-23). Padding the row keeps the scrim full-bleed. */}
        <View
          style={[styles.row, { paddingTop: topInset }]}
          testID={testID ? `${testID}-row` : undefined}
        >
          {/* UL-69: equal-flex side columns keep the title optically centered
              while giving the back label a bounded column to truncate inside,
              with `columnGap` as the guaranteed gap before the title. */}
          <View style={styles.side} testID={testID ? `${testID}-side` : undefined}>
            {backAction ? (
              <Pressable
                accessibilityLabel={backAction.label}
                accessibilityRole="button"
                hitSlop={8}
                onPress={backAction.onPress ?? (() => undefined)}
                style={styles.back}
                testID={backAction.testID ? `${backAction.testID}-sticky` : undefined}
              >
                <Text numberOfLines={1} style={styles.backLabel}>
                  ‹ {backAction.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={styles.title}
            testID={testID ? `${testID}-title` : undefined}
          >
            {title}
          </Text>
          <View style={styles.side} testID={testID ? `${testID}-side` : undefined} />
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    glass: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.glass.border,
    },
    scrim: {
      // Bone paper wash under the bar's content, over the glass material.
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(theme.glass.fallback.regular, HEADER_SCRIM_OPACITY),
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      columnGap: theme.spacing.sm,
    },
    side: {
      // Equal-flex columns flanking the title: the title stays centered, and
      // the back control truncates inside its column instead of running under
      // the title (UL-69).
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    title: {
      flexShrink: 1,
      // A long title truncates before it can squeeze the back label to zero.
      maxWidth: '60%',
      textAlign: 'center',
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
      fontSize: 16,
    },
    back: {
      flexShrink: 1,
      minWidth: 0,
      minHeight: 44,
      justifyContent: 'center',
    },
    backLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
      fontSize: 15,
    },
  });
}
