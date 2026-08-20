import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  Animated,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/primitives/Text';
import { EditorialProgress } from '@/src/components/editorial/EditorialProgress';
import { GlassSurface } from '@/src/components/primitives/GlassSurface';
import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import { ScreenScrollHeader } from '@/src/components/primitives/ScreenScrollHeader';
import { useTabBarClearance } from '@/src/features/app-shell/tabBarClearance';
import { MotionView } from '@/src/features/motion/MotionView';
import { spacing, type FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/**
 * LT-10: opt-in virtualized rendering for screens whose row count grows with
 * user tenure (e.g. the private timeline: ~341 rows after a year of daily
 * logging). When provided, the Screen's scroll container becomes a FlatList
 * — the header + `children` render as the list header, and `data` rows are
 * mounted through the list's render window instead of eagerly. Everything
 * else (safe areas, tab-bar clearance, `${testID}-scroll` contract for e2e
 * scrolling) is unchanged. Rows deliberately render OUTSIDE the body
 * MotionView, so no LinearTransition layout animation ever spans the whole
 * row set.
 */
type ScreenVirtualizedList<ItemT> = {
  data: readonly ItemT[];
  renderItem: ListRenderItem<ItemT>;
  keyExtractor: (item: ItemT, index: number) => string;
  /** Rendered after the header/children when `data` is empty. */
  ListEmptyComponent?: ReactNode;
};

type ScreenProps<ItemT> = PropsWithChildren<{
  eyebrow?: string;
  title: string | ReactNode;
  /**
   * UL-51: plain-text fallback for the pinned glass collapse header when
   * `title` is a ReactNode (e.g. an editorial `<ItalicTitle />`). Without it,
   * ReactNode-titled screens scroll content under the status bar with no
   * frost/scrim. Ignored when `title` is already a string.
   */
  stickyTitle?: string;
  description?: string;
  backAction?: {
    label: string;
    onPress?: () => void;
    testID?: string;
  };
  layout?: 'plain' | 'hero';
  headerVariant?: 'compact' | 'standard' | 'hero';
  footer?: ReactNode;
  footerPlacement?: 'fixed' | 'inline';
  headerActions?: ReactNode;
  progress?: {
    current: number;
    total: number;
    variant?: 'steps' | 'bar';
  };
  motionVariant?: 'standard' | 'hero' | 'sensitive';
  reducedMotionEnabled?: boolean;
  initialScrollOffsetY?: number;
  testID?: string;
  virtualizedList?: ScreenVirtualizedList<ItemT>;
}>;

const baseContentPaddingBottom = spacing.xxl;

// Pre-measurement reveal threshold for the pinned glass header. Kept high so the
// bar stays hidden until the editorial header's real height is measured on first
// layout, then replaced with that height.
const DEFAULT_HEADER_REVEAL_THRESHOLD = 240;

export function Screen<ItemT = never>({
  backAction,
  children,
  description,
  eyebrow,
  layout,
  headerVariant = 'standard',
  footer,
  footerPlacement = 'inline',
  headerActions,
  initialScrollOffsetY = 0,
  motionVariant,
  progress,
  reducedMotionEnabled,
  stickyTitle: stickyTitleProp,
  testID,
  title,
  virtualizedList,
}: ScreenProps<ItemT>) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedLayout = layout ?? (headerVariant === 'hero' ? 'hero' : 'plain');
  const resolvedMotionVariant =
    motionVariant ?? (resolvedLayout === 'hero' ? 'hero' : 'standard');
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  // UL-71 root fix: React Native honors the ScrollView `contentOffset` prop on
  // iOS only. Elsewhere the same request is applied imperatively right after
  // mount (the offset effect below), mirroring iOS's at-mount semantics — if
  // the content is not yet tall enough (e.g. a screen that hydrates async),
  // the offset clamps instead of deferring, exactly as the prop does on iOS.
  // Scroll tracking (`scrollY`, the sticky collapse bar) is seeded with the
  // offset the platform actually renders on its first frame — never with a
  // request that has not been applied — so the collapse bar can no longer
  // mount revealed over unscrolled content (the Android calendar double-title
  // defect). The imperative scrollTo emits real scroll events, which then
  // drive the tracking as usual.
  const contentOffsetPropApplies = Platform.OS === 'ios';
  const firstFrameScrollOffsetY = contentOffsetPropApplies ? initialScrollOffsetY : 0;
  const lastAppliedScrollOffsetRef = useRef(firstFrameScrollOffsetY);
  // Drives the pinned glass "collapse" header: the editorial large-title header
  // scrolls away, and once it clears the top the compact glass bar fades in.
  // useNativeDriver:false keeps this a plain JS scroll callback, so no Animated
  // ScrollView/FlatList swap is needed — the existing scroll refs/tests are
  // untouched. `revealThreshold` is measured from the real editorial header
  // height (below), defaulting high enough that the bar never flashes in before
  // the first layout pass.
  const scrollY = useRef(new Animated.Value(firstFrameScrollOffsetY)).current;
  const [headerRevealThreshold, setHeaderRevealThreshold] = useState(
    DEFAULT_HEADER_REVEAL_THRESHOLD,
  );
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
      }),
    [scrollY],
  );
  const stickyTitle = typeof title === 'string' ? title : (stickyTitleProp ?? null);
  // Clearance is supplied by the (tabs) layout to every tab screen, so no
  // screen has to opt in by hand. Screens outside the tab navigator receive 0.
  const reservedTabBarHeight = useTabBarClearance();
  const tabBarContentClearance = reservedTabBarHeight;
  const footerPaddingBottom = theme.spacing.xl + reservedTabBarHeight + insets.bottom;
  const usesFixedFooter = footerPlacement === 'fixed' && Boolean(footer);
  const contentPaddingBottom = usesFixedFooter
    ? baseContentPaddingBottom + Math.max(footerHeight, footerPaddingBottom)
    : baseContentPaddingBottom + tabBarContentClearance + insets.bottom;
  const progressVariant = progress?.variant ?? 'steps';
  const progressPercent: `${number}%` = progress
    ? `${Math.min(Math.max((progress.current / progress.total) * 100, 0), 100)}%`
    : '0%';

  // Applies `initialScrollOffsetY` whenever it differs from what has been
  // applied so far: on offset changes after the first render (both platforms),
  // and on mount everywhere the `contentOffset` prop is not honored (UL-71 —
  // `lastAppliedScrollOffsetRef` starts at 0 there, so the first pass lands
  // here).
  useEffect(() => {
    if (lastAppliedScrollOffsetRef.current === initialScrollOffsetY) {
      return;
    }

    const scrollTimer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: 0,
        y: initialScrollOffsetY,
        animated: false,
      });
      lastAppliedScrollOffsetRef.current = initialScrollOffsetY;
    }, 0);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [initialScrollOffsetY]);

  const scrollBodyContent = (
    <>
        <MotionView
          motionSuffix="header-motion"
          preset={
            resolvedMotionVariant === 'hero'
              ? 'heroBloom'
              : resolvedMotionVariant === 'sensitive'
                ? 'sensitiveScreenEnter'
                : 'screenEnter'
          }
          reducedMotionEnabled={reducedMotionEnabled}
          testID={testID}
        >
          <View
            onLayout={(event) => {
              // Reveal the pinned bar once the editorial header has scrolled
              // past — its measured height is that scroll distance.
              const measured = Math.round(event.nativeEvent.layout.height);
              if (measured > 0) {
                setHeaderRevealThreshold(measured);
              }
            }}
            testID={testID ? `${testID}-header-frame` : undefined}
            style={[
              styles.headerFrame,
              resolvedLayout === 'hero' ? styles.headerFrameHero : null,
            ]}
          >
            {backAction ? (
              <View style={styles.topActionRow}>
                <MotionPressableSurface
                  feedbackType="action"
                  motionVariant="secondary"
                  onPress={backAction.onPress ?? (() => undefined)}
                  pressedStyle={styles.topActionButtonPressed}
                  revealPreset="rowShift"
                  style={styles.topActionButton}
                  testID={backAction.testID}
                >
                  {/* UL-29/UL-82: quiet navigation, not a chip — chevron + label
                      mirroring the sticky collapse bar's back treatment. The
                      chevron is its own Text node so label queries stay exact. */}
                  <Text style={styles.topActionChevron}>‹</Text>
                  <Text style={styles.topActionLabel}>{backAction.label}</Text>
                </MotionPressableSurface>
              </View>
            ) : null}
            <View style={[styles.header, resolvedLayout === 'hero' ? styles.headerHero : null]}>
              {progress ? (
                <View style={styles.progressBlock}>
                  {progressVariant === 'steps' ? (
                    <EditorialProgress
                      current={Math.max(progress.current - 1, 0)}
                      total={progress.total}
                      testID={testID ? `${testID}-progress` : 'screen-progress'}
                    />
                  ) : (
                    <View
                      accessibilityLabel="Progress"
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: progress.total, now: progress.current }}
                      style={styles.progressBarTrack}
                      testID="screen-progress-track"
                    >
                      <View
                        style={[styles.progressBarFill, { width: progressPercent }]}
                        testID="screen-progress-fill"
                      />
                    </View>
                  )}
                </View>
              ) : null}
              <View
                style={[
                  styles.headerTopRow,
                  resolvedLayout === 'hero' ? styles.headerTopRowHero : null,
                ]}
              >
                <View
                  accessibilityRole="header"
                  style={[
                    styles.headerCopy,
                    headerVariant === 'compact' ? styles.headerCopyCompact : null,
                    resolvedLayout === 'hero' ? styles.headerCopyHero : null,
                  ]}
                  testID={testID ? `${testID}-header-copy` : 'screen-header-copy'}
                >
                  {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                  {typeof title === 'string' ? (
                    <Text
                      style={
                        resolvedLayout === 'hero'
                          ? styles.titleHero
                          : headerVariant === 'compact'
                            ? styles.titleCompact
                            : styles.title
                      }
                      // A stable handle on the large editorial title itself.
                      // `by.text(...)` on the title copy resolves to the
                      // screen-spanning accessibility container and trips
                      // Detox's <75%-coverage visibility heuristic even when the
                      // title is plainly on screen; a testID on the Text node
                      // lets e2e assert the title deterministically. Distinct
                      // from the collapsed sticky bar's `${testID}-sticky-header-title`.
                      testID={testID ? `${testID}-title` : undefined}
                    >
                      {title}
                    </Text>
                  ) : (
                    title
                  )}
                  {description ? (
                    <Text
                      style={
                        resolvedLayout === 'hero' ? styles.descriptionHero : styles.description
                      }
                    >
                      {description}
                    </Text>
                  ) : null}
                </View>
                {headerActions ? (
                  <View style={styles.headerActions} testID="screen-header-actions">
                    {headerActions}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </MotionView>
        <MotionView
          motionSuffix="body-motion"
          preset="cardReveal"
          reducedMotionEnabled={reducedMotionEnabled}
          sequenceIndex={1}
          testID={testID}
        >
          <View style={[styles.body, resolvedLayout === 'hero' ? styles.bodyHero : null]}>
            {children}
            {footer && footerPlacement === 'inline' ? (
              <View style={styles.inlineFooter}>{footer}</View>
            ) : null}
          </View>
        </MotionView>
    </>
  );

  return (
    <View style={styles.root}>
    <SafeAreaView edges={['top']} style={styles.safeArea} testID={testID}>
      {virtualizedList ? (
        <FlatList
          data={virtualizedList.data as ItemT[]}
          renderItem={virtualizedList.renderItem}
          keyExtractor={virtualizedList.keyExtractor}
          ListHeaderComponent={<>{scrollBodyContent}</>}
          ListEmptyComponent={
            virtualizedList.ListEmptyComponent ? <>{virtualizedList.ListEmptyComponent}</> : null
          }
          keyboardShouldPersistTaps="always"
          style={styles.scrollView}
          testID={testID ? `${testID}-scroll` : undefined}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: contentPaddingBottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
          // Virtualization window (LT-10): render a screenful up front, then
          // small batches while scrolling. removeClippedSubviews keeps
          // off-window rows detached from the native hierarchy so scroll
          // gestures never pay for the whole year of rows at once.
          //
          // D5 (Phase 5 group 3, cheap hardening -- watch item, not a
          // CONFIRMED-fixed bug): one Android capture during the long-tenure
          // sweep showed a fully blank timeline viewport after a programmatic
          // scroll-to-bottom; a recapture was clean, so this is the classic
          // FlatList "blank cell" window on a fast scroll outrunning a narrow
          // windowSize, not a reproducible defect. windowSize raised from 7
          // to 11 (~2 extra screens on each side of the viewport) and
          // maxToRenderPerBatch/updateCellsBatchingPeriod tuned together so a
          // fast scroll has a wider pre-rendered buffer to land in before
          // hitting an unmounted cell. removeClippedSubviews stays on
          // (default-sane on Android; this is what makes the batching window
          // matter in the first place).
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          updateCellsBatchingPeriod={50}
          windowSize={11}
          removeClippedSubviews
        />
      ) : (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          ref={scrollViewRef}
          keyboardShouldPersistTaps="always"
          style={styles.scrollView}
          testID={testID ? `${testID}-scroll` : undefined}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentOffset={{ x: 0, y: initialScrollOffsetY }}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: contentPaddingBottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {scrollBodyContent}
        </ScrollView>
      )}
      {footer && footerPlacement === 'fixed' ? (
        <MotionView
          motionSuffix="footer-motion"
          preset="cardReveal"
          reducedMotionEnabled={reducedMotionEnabled}
          sequenceIndex={2}
          testID={testID}
        >
          <View
            onLayout={(event) => {
              setFooterHeight(Math.ceil(event.nativeEvent.layout.height));
            }}
            style={[styles.footer, { paddingBottom: footerPaddingBottom }]}
            testID={testID ? `${testID}-footer` : 'screen-footer'}
          >
            {/* Liquid Glass backdrop: the fixed footer is floating chrome, so
                content scrolls under a translucent glass bar (matching the tab
                bar + sticky header). Non-interactive so it never blocks the
                action buttons; degrades to the solid paper fallback off iOS 26.
                The action buttons themselves stay solid for prominence. */}
            <GlassSurface
              material="regular"
              tint={theme.glass.tint.regular}
              radius={0}
              elevated={false}
              pointerEvents="none"
              style={styles.footerGlass}
              testID={testID ? `${testID}-footer-glass` : 'screen-footer-glass'}
            />
            {footer}
          </View>
        </MotionView>
      ) : null}
    </SafeAreaView>
      {stickyTitle ? (
        <ScreenScrollHeader
          title={stickyTitle}
          scrollY={scrollY}
          revealThreshold={headerRevealThreshold}
          topInset={insets.top}
          initialScrollOffset={firstFrameScrollOffsetY}
          backAction={backAction}
          testID={testID ? `${testID}-sticky-header` : undefined}
        />
      ) : null}
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: baseContentPaddingBottom,
      gap: theme.spacing.xl,
    },
    headerFrame: {
      gap: theme.spacing.lg,
    },
    headerFrameHero: {
      gap: theme.spacing.xl,
    },
    header: {
      gap: theme.spacing.sm,
    },
    headerHero: {
      gap: theme.spacing.md,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    headerTopRowHero: {
      gap: theme.spacing.lg,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.sm,
    },
    headerCopyHero: {
      gap: theme.spacing.md,
    },
    headerCopyCompact: {
      gap: theme.spacing.xs,
    },
    headerActions: {
      paddingTop: theme.spacing.xs,
      alignSelf: 'flex-start',
      flexShrink: 0,
    },
    topActionRow: {
      alignItems: 'flex-start',
    },
    // UL-29/UL-82: the back control previously wore the selectable-chip
    // costume (paper fill + rule border pill), reading as a filter chip/CTA
    // on both platforms. It is now a quiet text control that mirrors the
    // sticky collapse bar's back treatment — no fill, no border, chevron +
    // secondary-ink label — while keeping the 44pt minimum hit target.
    topActionButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      columnGap: theme.spacing.xs,
      // Pad the trailing edge only, so the chevron stays flush with the
      // content margin while the touch target extends past the label.
      paddingRight: theme.spacing.md,
    },
    topActionButtonPressed: {
      opacity: 0.6,
    },
    topActionChevron: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
      fontSize: 15,
      lineHeight: 20,
    },
    topActionLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
      fontSize: 15,
      lineHeight: 20,
    },
    progressBlock: {
      gap: theme.spacing.sm,
    },
    progressLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    progressTrack: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    progressBarTrack: {
      height: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceMuted,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    progressSegment: {
      flex: 1,
      height: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    progressSegmentActive: {
      backgroundColor: theme.colors.accentPrimary,
    },
    eyebrow: {
      color: theme.colors.textSecondary,
      ...theme.typography.eyebrow,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.title,
    },
    titleCompact: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700',
    },
    titleHero: {
      color: theme.colors.textPrimary,
      ...theme.typography.display,
    },
    description: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    descriptionHero: {
      color: theme.colors.textSecondary,
      ...theme.typography.bodyLarge,
    },
    body: {
      gap: theme.spacing.lg,
    },
    bodyHero: {
      gap: theme.spacing.xl,
    },
    inlineFooter: {
      paddingTop: theme.spacing.md,
    },
    footer: {
      paddingTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      // No solid background: the GlassSurface backdrop below provides the fill
      // (translucent glass on iOS 26, solid paper fallback elsewhere) so the
      // action bar refracts the content scrolling beneath it.
      borderTopWidth: 1,
      borderTopColor: theme.colors.overlay,
    },
    footerGlass: {
      ...StyleSheet.absoluteFillObject,
    },
  });
}
