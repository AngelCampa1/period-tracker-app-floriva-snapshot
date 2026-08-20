import { Platform, ScrollView, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import {
  nativeTabBarClearance,
  TabBarClearanceProvider,
} from '@/src/features/app-shell/tabBarClearance';
import { florivaThemes, theme } from '@/src/theme/tokens';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({
      top: 0,
      right: 0,
      bottom: 24,
      left: 0,
    }),
  };
});

describe('Screen', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('keeps keyboard-friendly scroll props and expands scroll padding after the footer is measured', () => {
    const view = render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        testID="footer-screen"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('footer-screen-scroll')).toBeTruthy();
    const footer = view.getByTestId('footer-screen-footer');
    const scrollView = view.UNSAFE_getByType(ScrollView);

    fireEvent(footer, 'layout', {
      nativeEvent: {
        layout: {
          height: 160,
        },
      },
    });

    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(scrollView.props.keyboardShouldPersistTaps).toBe('always');
    expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 160);
  });

  it('keeps footer spacing in the footer container instead of inflating scroll padding', () => {
    const view = render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        testID="footer-screen"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const footer = view.getByTestId('footer-screen-footer');
    const footerStyle = Array.isArray(footer.props.style)
      ? Object.assign({}, ...footer.props.style)
      : footer.props.style;

    expect(footerStyle.paddingTop).toBe(theme.spacing.lg);
    expect(footerStyle.paddingBottom).toBe(theme.spacing.xl + 24);
  });

  it('keeps default padding and omits optional header copy when no footer metadata is provided', () => {
    const view = render(
      <Screen title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 24);
    expect(screen.queryByText('Footer action')).toBeNull();
  });

  it('renders inline footers by default and avoids reserving fixed-footer space', () => {
    const view = render(
      <Screen
        footer={<Text>Footer action</Text>}
        progress={{ current: 2, total: 4 }}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(screen.getByText('02 / 04')).toBeTruthy();
    expect(screen.getByText('Footer action')).toBeTruthy();
    expect(screen.queryByTestId('screen-footer')).toBeNull();
    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 24);
  });

  it('supports bar-only progress without revealing the total step count', () => {
    render(
      <Screen
        footer={<Text>Footer action</Text>}
        progress={{ current: 2, total: 4, variant: 'bar' }}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const progressTrack = screen.getByTestId('screen-progress-track');
    const progressFill = screen.getByTestId('screen-progress-fill');
    const progressFillStyle = Array.isArray(progressFill.props.style)
      ? Object.assign({}, ...progressFill.props.style)
      : progressFill.props.style;

    expect(screen.queryByText('Step 2 of 4')).toBeNull();
    expect(progressTrack.props.accessibilityRole).toBe('progressbar');
    expect(progressTrack.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 2 });
    expect(progressFillStyle.width).toBe('50%');
  });

  it('adds tab bar inset to scroll content and fixed footers when rendered inside tabs', () => {
    const view = render(
      <TabBarClearanceProvider value={72}>
        <Screen
          footer={<Text>Footer action</Text>}
          footerPlacement="fixed"
          testID="tab-screen"
          title="Screen title"
        >
          <Text>Body content</Text>
        </Screen>
      </TabBarClearanceProvider>,
    );

    const footer = view.getByTestId('tab-screen-footer');
    const scrollView = view.UNSAFE_getByType(ScrollView);

    const footerStyleBeforeLayout = Array.isArray(footer.props.style)
      ? Object.assign({}, ...footer.props.style)
      : footer.props.style;

    expect(footerStyleBeforeLayout.paddingBottom).toBe(theme.spacing.xl + 72 + 24);

    fireEvent(footer, 'layout', {
      nativeEvent: {
        layout: {
          height: 220,
        },
      },
    });

    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 220);
  });

  it('uses the tab layout clearance for inline content when wrapped by the provider', () => {
    const view = render(
      <TabBarClearanceProvider value={72}>
        <Screen title="Screen title">
          <Text>Body content</Text>
        </Screen>
      </TabBarClearanceProvider>,
    );

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 72 + 24);
  });

  it('reserves the tab layout default clearance for every wrapped tab screen', () => {
    const view = render(
      <TabBarClearanceProvider>
        <Screen title="Screen title">
          <Text>Body content</Text>
        </Screen>
      </TabBarClearanceProvider>,
    );

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(contentContainerStyle.paddingBottom).toBe(
      theme.spacing.xxl + nativeTabBarClearance + 24,
    );
  });

  it('reserves no tab space for screens outside the tab navigator', () => {
    const view = render(
      <Screen title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 24);
  });

  it('supports a hero layout for onboarding-first screens', () => {
    render(
      <Screen
        description="A more expressive intro keeps first-run screens feeling intentional."
        layout="hero"
        title="Hero title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const title = screen.getByText('Hero title');
    const description = screen.getByText(
      'A more expressive intro keeps first-run screens feeling intentional.',
    );

    const titleStyle = Array.isArray(title.props.style)
      ? Object.assign({}, ...title.props.style)
      : title.props.style;
    const descriptionStyle = Array.isArray(description.props.style)
      ? Object.assign({}, ...description.props.style)
      : description.props.style;

    expect(titleStyle.fontSize).toBe(40);
    expect(titleStyle.lineHeight).toBe(42);
    expect(descriptionStyle.fontSize).toBe(18);
    expect(descriptionStyle.lineHeight).toBe(26);
  });

  it('supports a compact native header for dense utility screens', () => {
    render(
      <Screen headerVariant="compact" testID="compact-screen" title="Settings">
        <Text>Body content</Text>
      </Screen>,
    );

    const title = screen.getByText('Settings');
    const headerCopy = screen.getByTestId('compact-screen-header-copy');
    const titleStyle = StyleSheet.flatten(title.props.style);
    const headerCopyStyle = StyleSheet.flatten(headerCopy.props.style);

    expect(titleStyle.fontSize).toBeLessThanOrEqual(florivaThemes.light.typography.title.fontSize);
    expect(titleStyle.lineHeight).toBeLessThanOrEqual(
      florivaThemes.light.typography.title.lineHeight,
    );
    expect(headerCopyStyle.gap).toBe(florivaThemes.light.spacing.xs);
  });

  it('exposes the large string title under `${testID}-title` for deterministic e2e assertions', () => {
    render(
      <Screen testID="paywall-screen" title="Start your free trial.">
        <Text>Body content</Text>
      </Screen>,
    );

    // Distinct from the collapsed sticky bar's own title handle, so an e2e
    // matcher targets exactly one visible element (see Screen.tsx / smoke.e2e.js).
    const title = screen.getByTestId('paywall-screen-title');
    expect(title.props.children).toBe('Start your free trial.');
    expect(screen.queryByTestId('paywall-screen-sticky-header-title')).not.toBe(title);
  });

  it('renders shared motion regions so screen choreography stays in one primitive', () => {
    render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        testID="motion-screen"
        title="Motion title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('motion-screen-header-motion')).toBeTruthy();
    expect(screen.getByTestId('motion-screen-body-motion')).toBeTruthy();
    expect(screen.getByTestId('motion-screen-footer-motion')).toBeTruthy();
  });

  it('supports a sensitive motion variant for trust-heavy screens', () => {
    render(
      <Screen motionVariant="sensitive" testID="sensitive-screen" title="Sensitive title">
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('sensitive-screen-header-motion')).toBeTruthy();
    expect(screen.getByTestId('sensitive-screen-body-motion')).toBeTruthy();
  });

  it('renders fixed footers only when explicitly requested', () => {
    render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        testID="fixed-footer-screen"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('fixed-footer-screen-footer')).toBeTruthy();
  });

  it('scrolls to a requested offset when it becomes available after the first render', () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());
    jest.useFakeTimers();
    const view = render(
      <Screen title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    view.rerender(
      <Screen
        initialScrollOffsetY={72}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    jest.runAllTimers();

    expect(scrollToSpy).toHaveBeenCalledWith({
      animated: false,
      x: 0,
      y: 72,
    });

    scrollToSpy.mockRestore();
    jest.useRealTimers();
  });

  it('UL-71: applies the initial offset imperatively on Android, where the contentOffset prop is not honored', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());
    jest.useFakeTimers();
    try {
      const view = render(
        <Screen initialScrollOffsetY={72} title="Screen title">
          <Text>Body content</Text>
        </Screen>,
      );

      jest.runAllTimers();

      expect(scrollToSpy).toHaveBeenCalledWith({
        animated: false,
        x: 0,
        y: 72,
      });

      const scrollView = view.UNSAFE_getByType(ScrollView);
      // The prop is still passed through (harmless where unsupported), so the
      // imperative path is an addition, not a swap.
      expect(scrollView.props.contentOffset).toEqual({ x: 0, y: 72 });
    } finally {
      scrollToSpy.mockRestore();
      jest.useRealTimers();
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('UL-71: never pre-seeds the sticky collapse bar with an offset Android has not rendered yet', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    // Fake timers so the mount-time imperative scrollTo (tested above) cannot
    // leak into later tests; this test only cares about pre-scroll state.
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());
    jest.useFakeTimers();
    try {
      render(
        // 400 is past the default reveal threshold: with the old pre-seeding
        // the bar mounted opaque over unscrolled content (the UL-71 defect).
        <Screen initialScrollOffsetY={400} testID="android-offset-screen" title="Offset title">
          <Text>Body content</Text>
        </Screen>,
      );

      const bar = screen.getByTestId('android-offset-screen-sticky-header', {
        includeHiddenElements: true,
      });
      expect(bar.props.pointerEvents).toBe('none');

      // Once real scroll events arrive (e.g. after the imperative scrollTo
      // lands), the bar reveal follows the actual offset as usual.
      fireEvent.scroll(screen.getByTestId('android-offset-screen-scroll'), {
        nativeEvent: { contentOffset: { x: 0, y: 400 } },
      });
      expect(screen.getByTestId('android-offset-screen-sticky-header').props.pointerEvents).toBe(
        'auto',
      );

      jest.runAllTimers();
    } finally {
      scrollToSpy.mockRestore();
      jest.useRealTimers();
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('UL-71: keeps the iOS mount path on the contentOffset prop with no imperative scroll', () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());
    jest.useFakeTimers();
    try {
      const view = render(
        <Screen initialScrollOffsetY={72} title="Screen title">
          <Text>Body content</Text>
        </Screen>,
      );

      jest.runAllTimers();

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect(view.UNSAFE_getByType(ScrollView).props.contentOffset).toEqual({ x: 0, y: 72 });
    } finally {
      scrollToSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('resets the scroll position when the requested offset returns to the top', () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());
    jest.useFakeTimers();
    const view = render(
      <Screen
        initialScrollOffsetY={72}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    view.rerender(
      <Screen title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    jest.runAllTimers();

    expect(scrollToSpy).toHaveBeenCalledWith({
      animated: false,
      x: 0,
      y: 0,
    });

    scrollToSpy.mockRestore();
    jest.useRealTimers();
  });

  it('renders an optional back action above the screen header', () => {
    const onPress = jest.fn();

    render(
      <Screen
        backAction={{ label: 'Back to settings', onPress, testID: 'back-action' }}
        description="Standard description"
        eyebrow="Privacy-first"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    fireEvent.press(screen.getByText('Back to settings'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
    expect(screen.getByText('Privacy-first')).toBeTruthy();
    expect(screen.getByText('Standard description')).toBeTruthy();

    expect(screen.getByTestId('back-action')).toBeTruthy();
  });

  it('UL-29/UL-82: styles the back action as quiet navigation, not a selectable chip', () => {
    render(
      <Screen
        backAction={{ label: 'Back to settings', onPress: jest.fn(), testID: 'quiet-back' }}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const backAction = screen.getByTestId('quiet-back');
    const backActionStyle = StyleSheet.flatten(backAction.props.style);

    // No chip costume: no fill, no border — quiet text control.
    expect(backActionStyle.backgroundColor).toBeUndefined();
    expect(backActionStyle.borderWidth).toBeUndefined();
    // Hit target stays at least 44pt tall.
    expect(backActionStyle.minHeight).toBeGreaterThanOrEqual(44);

    // Label matches the sticky collapse bar's back treatment: leading chevron
    // plus a secondary-ink 15pt body label — one back grammar everywhere.
    expect(screen.getByText('‹')).toBeTruthy();
    const label = screen.getByText('Back to settings');
    const labelStyle = StyleSheet.flatten(label.props.style);
    expect(labelStyle.color).toBe(florivaThemes.light.colors.textSecondary);
    expect(labelStyle.fontSize).toBe(15);
  });

  it('falls back to a no-op back handler when callers omit the callback', () => {
    render(
      <Screen
        backAction={{ label: 'Back to settings' } as never}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(() => {
      fireEvent.press(screen.getByText('Back to settings'));
    }).not.toThrow();
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
  });

  it('renders optional header actions inside the shared header chrome cluster', () => {
    render(
      <Screen
        headerActions={<Text testID="screen-header-custom-action">Quick action</Text>}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('screen-header-actions')).toBeTruthy();
    expect(screen.getByTestId('screen-header-custom-action')).toBeTruthy();
  });

  it('keeps back actions, header copy, and actions in non-overlapping flexible rows', () => {
    render(
      <Screen
        backAction={{
          label: 'Back',
          onPress: jest.fn(),
          testID: 'screen-back-action',
        }}
        headerActions={<Text testID="screen-header-custom-action">Quick action</Text>}
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const headerActions = screen.getByTestId('screen-header-actions');
    const headerActionsStyle = Array.isArray(headerActions.props.style)
      ? Object.assign({}, ...headerActions.props.style)
      : headerActions.props.style;
    const headerCopy = screen.getByTestId('screen-header-copy');
    const headerCopyStyle = Array.isArray(headerCopy?.props.style)
      ? Object.assign({}, ...headerCopy?.props.style)
      : headerCopy?.props.style;

    expect(screen.getByTestId('screen-back-action')).toBeTruthy();
    expect(headerActionsStyle).toEqual(
      expect.objectContaining({
        alignSelf: 'flex-start',
        flexShrink: 0,
      }),
    );
    expect(headerCopyStyle).toEqual(expect.objectContaining({ minWidth: 0 }));
  });

  it('uses the resolved light background color for app shells', () => {
    render(
      <Screen testID="dark-shell" title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('dark-shell').props.style).toEqual(
      expect.objectContaining({
        backgroundColor: florivaThemes.light.colors.background,
      }),
    );
  });

  it('uses the default fixed-footer test id when no screen test id is supplied', () => {
    render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('screen-footer')).toBeTruthy();
  });

  it('gives the fixed footer a non-interactive glass backdrop that floats over content', () => {
    render(
      <Screen
        footer={<Text>Footer action</Text>}
        footerPlacement="fixed"
        testID="glass-footer-screen"
        title="Screen title"
      >
        <Text>Body content</Text>
      </Screen>,
    );

    const footerGlass = screen.getByTestId('glass-footer-screen-footer-glass');
    // Non-interactive so it never blocks the action buttons in the footer.
    expect(footerGlass.props.pointerEvents).toBe('none');
    // The footer container no longer paints its own solid background — the glass
    // provides the fill so content refracts beneath it.
    const footerStyle = Array.isArray(screen.getByTestId('glass-footer-screen-footer').props.style)
      ? Object.assign(
          {},
          ...screen.getByTestId('glass-footer-screen-footer').props.style,
        )
      : screen.getByTestId('glass-footer-screen-footer').props.style;
    expect(footerStyle.backgroundColor).toBeUndefined();
  });

  it('keeps the footer glass backdrop un-elevated on Android so it never hides the action buttons', () => {
    // On Android the glass fallback is an opaque paper surface, and elevation —
    // not declaration order — decides sibling draw order. An elevated absolute-
    // fill backdrop would composite OVER the footer's (elevation-0) action
    // buttons and blank them out. The footer must pass elevated={false}.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      render(
        <Screen
          footer={<Text>Continue</Text>}
          footerPlacement="fixed"
          testID="android-footer-screen"
          title="Screen title"
        >
          <Text>Body content</Text>
        </Screen>,
      );

      const footerGlass = screen.getByTestId('android-footer-screen-footer-glass');
      const glassStyle = StyleSheet.flatten(footerGlass.props.style);
      expect(glassStyle.elevation).toBe(0);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('does not render a footer glass backdrop for inline footers', () => {
    render(
      <Screen footer={<Text>Footer action</Text>} testID="inline-footer-screen" title="Screen title">
        <Text>Body content</Text>
      </Screen>,
    );

    expect(
      screen.queryByTestId('inline-footer-screen-footer-glass', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('D5: tunes the virtualizedList FlatList window wide enough to survive a fast scroll without a blank-cell gap', () => {
    // LT-10 introduced virtualizedList mode; D5 (Phase 5 group 3) is cheap
    // hardening after one intermittent Android capture showed a blank
    // timeline viewport after a programmatic scroll-to-bottom (classic
    // FlatList blank-cell window on fast scroll). This pins the tuned
    // values so a future edit can't silently narrow the window back down.
    render(
      <Screen
        testID="virtualized-screen"
        title="Screen title"
        virtualizedList={{
          data: ['a', 'b', 'c'],
          renderItem: ({ item }) => <Text>{item}</Text>,
          keyExtractor: (item) => item,
        }}
      >
        <Text>Header content</Text>
      </Screen>,
    );

    const list = screen.getByTestId('virtualized-screen-scroll');

    expect(list.props.windowSize).toBe(11);
    expect(list.props.initialNumToRender).toBe(12);
    expect(list.props.maxToRenderPerBatch).toBe(16);
    expect(list.props.updateCellsBatchingPeriod).toBe(50);
    expect(list.props.removeClippedSubviews).toBe(true);
  });

  it('mounts a pinned glass header that stays hidden at rest and reveals once the editorial header scrolls away', () => {
    render(
      <Screen testID="tracker-screen" title="Floriva">
        <Text>Body content</Text>
      </Screen>,
    );

    // The pinned bar exists but is hidden from accessibility (and thus default
    // queries) while the editorial large title is in view.
    expect(screen.queryByTestId('tracker-screen-sticky-header')).toBeNull();
    const bar = screen.getByTestId('tracker-screen-sticky-header', {
      includeHiddenElements: true,
    });
    expect(bar.props.pointerEvents).toBe('none');

    // Scrolling well past the default reveal threshold fades the bar in.
    const scrollView = screen.getByTestId('tracker-screen-scroll');
    fireEvent.scroll(scrollView, {
      nativeEvent: { contentOffset: { x: 0, y: 400 } },
    });

    const revealedBar = screen.getByTestId('tracker-screen-sticky-header');
    expect(revealedBar.props.pointerEvents).toBe('auto');
    expect(screen.getByTestId('tracker-screen-sticky-header-title').props.children).toBe('Floriva');
  });

  it('omits the pinned glass header when the title is a custom node without a stickyTitle', () => {
    render(
      <Screen testID="node-screen" title={<Text>Custom node title</Text>}>
        <Text>Body content</Text>
      </Screen>,
    );

    expect(
      screen.queryByTestId('node-screen-sticky-header', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('UL-51: uses stickyTitle for the pinned glass header when the title is a custom node', () => {
    render(
      <Screen
        backAction={{ label: 'Back to settings', onPress: jest.fn(), testID: 'node-back' }}
        stickyTitle="Choose your language."
        testID="node-sticky-screen"
        title={<Text>Custom node title</Text>}
      >
        <Text>Body content</Text>
      </Screen>,
    );

    // Hidden at rest, exactly like string-title screens.
    const bar = screen.getByTestId('node-sticky-screen-sticky-header', {
      includeHiddenElements: true,
    });
    expect(bar.props.pointerEvents).toBe('none');

    // Scrolling past the reveal threshold fades the bar in with the fallback text.
    fireEvent.scroll(screen.getByTestId('node-sticky-screen-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 400 } },
    });

    expect(screen.getByTestId('node-sticky-screen-sticky-header').props.pointerEvents).toBe('auto');
    expect(screen.getByTestId('node-sticky-screen-sticky-header-title').props.children).toBe(
      'Choose your language.',
    );
    // The `-sticky` back-control testID convention is preserved.
    expect(screen.getByTestId('node-back-sticky')).toBeTruthy();
  });

  it('UL-51: prefers the string title over stickyTitle when both are provided', () => {
    render(
      <Screen stickyTitle="Fallback title" testID="string-wins-screen" title="Real title">
        <Text>Body content</Text>
      </Screen>,
    );

    fireEvent.scroll(screen.getByTestId('string-wins-screen-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 400 } },
    });

    expect(screen.getByTestId('string-wins-screen-sticky-header-title').props.children).toBe(
      'Real title',
    );
  });

  it('reveals the pinned glass header from the virtualizedList (FlatList) scroll path too', () => {
    render(
      <Screen
        testID="timeline-screen"
        title="Timeline"
        virtualizedList={{
          data: ['a', 'b', 'c'],
          renderItem: ({ item }) => <Text>{item}</Text>,
          keyExtractor: (item) => item,
        }}
      >
        <Text>Header content</Text>
      </Screen>,
    );

    expect(
      screen.getByTestId('timeline-screen-sticky-header', { includeHiddenElements: true }).props
        .pointerEvents,
    ).toBe('none');

    // Scrolling the FlatList must drive the same reveal as the ScrollView path.
    // FlatList's internal onScroll needs a full payload (layoutMeasurement/contentSize).
    fireEvent.scroll(screen.getByTestId('timeline-screen-scroll'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 400 },
        contentSize: { height: 2000, width: 320 },
        layoutMeasurement: { height: 800, width: 320 },
      },
    });

    expect(screen.getByTestId('timeline-screen-sticky-header').props.pointerEvents).toBe('auto');
  });

  it('anchors the pinned-header reveal to the measured editorial header height', () => {
    render(
      <Screen testID="measured-screen" title="Measured">
        <Text>Body content</Text>
      </Screen>,
    );

    // Before layout, the default threshold (240) governs: a 120px scroll is not
    // enough to reveal.
    const scrollView = screen.getByTestId('measured-screen-scroll');
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 0, y: 120 } } });
    expect(
      screen.getByTestId('measured-screen-sticky-header', { includeHiddenElements: true }).props
        .pointerEvents,
    ).toBe('none');

    // Measure a short editorial header, then the same 120px scroll clears it.
    fireEvent(screen.getByTestId('measured-screen-header-frame'), 'layout', {
      nativeEvent: { layout: { height: 80, width: 320, x: 0, y: 0 } },
    });
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 0, y: 120 } } });
    expect(screen.getByTestId('measured-screen-sticky-header').props.pointerEvents).toBe('auto');
  });
});
