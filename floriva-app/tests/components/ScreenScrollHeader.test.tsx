import { Animated, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import {
  HEADER_REVEAL_FADE,
  HEADER_SCRIM_OPACITY,
  ScreenScrollHeader,
  isHeaderRevealed,
} from '@/src/components/primitives/ScreenScrollHeader';
import { florivaThemes, withAlpha } from '@/src/theme/tokens';

const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

afterEach(() => {
  setOS(originalOS);
});

describe('isHeaderRevealed', () => {
  it('stays hidden until the scroll offset reaches the fade-in start', () => {
    expect(isHeaderRevealed(0, 200)).toBe(false);
    expect(isHeaderRevealed(200 - HEADER_REVEAL_FADE - 1, 200)).toBe(false);
    expect(isHeaderRevealed(200 - HEADER_REVEAL_FADE, 200)).toBe(true);
    expect(isHeaderRevealed(999, 200)).toBe(true);
  });

  it('never requires a negative scroll offset for tiny headers', () => {
    // A header shorter than the fade distance must still be revealable from 0.
    expect(isHeaderRevealed(0, 10)).toBe(true);
  });
});

describe('ScreenScrollHeader', () => {
  function renderHeader(overrides: Partial<Parameters<typeof ScreenScrollHeader>[0]> = {}) {
    const scrollY = overrides.scrollY ?? new Animated.Value(0);
    return {
      scrollY,
      ...render(
        <ScreenScrollHeader
          title="Insights"
          scrollY={scrollY}
          revealThreshold={200}
          topInset={47}
          testID="today-sticky-header"
          {...overrides}
        />,
      ),
    };
  }

  const HIDDEN = { includeHiddenElements: true } as const;

  it('renders the compact title', () => {
    renderHeader();

    expect(screen.getByTestId('today-sticky-header-title', HIDDEN).props.children).toBe('Insights');
  });

  it('is non-interactive and hidden from accessibility at rest, then reveals past the threshold', () => {
    const { scrollY } = renderHeader();

    expect(screen.getByTestId('today-sticky-header', HIDDEN).props.pointerEvents).toBe('none');
    expect(screen.getByTestId('today-sticky-header', HIDDEN).props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );

    act(() => {
      scrollY.setValue(200);
    });

    // Once revealed the bar is no longer hidden from accessibility.
    const bar = screen.getByTestId('today-sticky-header');
    expect(bar.props.pointerEvents).toBe('auto');
    expect(bar.props.importantForAccessibility).toBe('auto');
  });

  it('reveals immediately when the reveal threshold is zero', () => {
    renderHeader({ revealThreshold: 0 });

    // No hidden-element option needed — it starts revealed.
    expect(screen.getByTestId('today-sticky-header').props.pointerEvents).toBe('auto');
  });

  it('is revealed at mount when the host starts scrolled past the threshold (no scroll event)', () => {
    // Calendar mounts pre-scrolled: the bar must be interactive + announced
    // before the first scroll fires, matching its opaque appearance.
    renderHeader({
      revealThreshold: 200,
      initialScrollOffset: 260,
      scrollY: new Animated.Value(260),
    });

    const bar = screen.getByTestId('today-sticky-header');
    expect(bar.props.pointerEvents).toBe('auto');
    expect(bar.props.importantForAccessibility).toBe('auto');
  });

  it('renders a back control with a collision-free derived testID that fires onPress when revealed', () => {
    const onPress = jest.fn();
    const { scrollY } = renderHeader({
      revealThreshold: 200,
      backAction: { label: 'Back', onPress, testID: 'insights-back' },
    });

    // The bar is non-interactive at rest; reveal it before pressing.
    act(() => {
      scrollY.setValue(200);
    });

    // Derived testID avoids colliding with the editorial header's back button.
    fireEvent.press(screen.getByTestId('insights-back-sticky'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not throw when a back control without onPress is pressed', () => {
    const { scrollY } = renderHeader({
      revealThreshold: 200,
      backAction: { label: 'Back', testID: 'insights-back' },
    });

    act(() => {
      scrollY.setValue(200);
    });

    expect(() => fireEvent.press(screen.getByTestId('insights-back-sticky'))).not.toThrow();
  });

  it('omits the back control when no backAction is given', () => {
    renderHeader();

    expect(screen.queryByTestId('insights-back-sticky', HIDDEN)).toBeNull();
  });

  describe('legibility scrim (UL-01)', () => {
    it('renders a bone scrim under the bar content on iOS so text stays legible over any scrolled content', () => {
      renderHeader();

      const scrim = screen.getByTestId('today-sticky-header-scrim', HIDDEN);
      const style = StyleSheet.flatten(scrim.props.style);
      // Absolute-fill underlay: covers the whole bar including the status-bar inset.
      expect(style).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }),
      );
      // Bone paper wash at the guaranteed-legibility opacity: on iOS 26 the
      // GlassView tint alone can render near-clear over light content, so the
      // scrim is what makes text readable regardless of how the OS renders glass.
      expect(style.backgroundColor).toBe(
        withAlpha(florivaThemes.light.glass.fallback.regular, HEADER_SCRIM_OPACITY),
      );
      // Never intercepts the back control's touches.
      expect(scrim.props.pointerEvents).toBe('none');
    });

    it('omits the scrim on Android, whose glass surface is already an opaque elevated Material surface', () => {
      setOS('android');
      renderHeader();

      // No double-paint and no extra layer that could stack with Material elevation.
      expect(screen.queryByTestId('today-sticky-header-scrim', HIDDEN)).toBeNull();
    });
  });

  describe('bar layout (UL-69)', () => {
    it('single-lines and ellipsizes both the title and a long back label', () => {
      renderHeader({
        title: 'Export backup',
        backAction: { label: 'Back to data controls', testID: 'export-back' },
      });

      expect(
        screen.getByTestId('today-sticky-header-title', HIDDEN).props.numberOfLines,
      ).toBe(1);
      expect(
        screen.getByText('‹ Back to data controls', HIDDEN).props.numberOfLines,
      ).toBe(1);
    });

    it('constrains the back control inside a shrinkable side column instead of absolute-positioning it over the title', () => {
      renderHeader({
        backAction: { label: 'Back to data controls', testID: 'export-back' },
      });

      const back = screen.getByTestId('export-back-sticky', HIDDEN);
      const backStyle = StyleSheet.flatten(back.props.style);
      // The old layout absolutely positioned the back control, letting long
      // labels run underneath the centered title with zero gap.
      expect(backStyle.position).toBeUndefined();
      expect(backStyle.flexShrink).toBe(1);
      // Keeps the 44pt minimum touch target.
      expect(backStyle.minHeight).toBe(44);
    });

    it('keeps the title centered between equal-flex side columns with a guaranteed gap', () => {
      renderHeader({
        backAction: { label: 'Back to data controls', testID: 'export-back' },
      });

      const row = screen.getByTestId('today-sticky-header-row', HIDDEN);
      const rowStyle = StyleSheet.flatten(row.props.style);
      expect(rowStyle.flexDirection).toBe('row');
      // The guaranteed minimum gap between the back label and the title.
      expect(rowStyle.columnGap).toBe(florivaThemes.light.spacing.sm);

      const titleStyle = StyleSheet.flatten(
        screen.getByTestId('today-sticky-header-title', HIDDEN).props.style,
      );
      // Title shrinks/truncates rather than painting over the side columns,
      // and is capped so a long title can never squeeze the back label out.
      expect(titleStyle.position).toBeUndefined();
      expect(titleStyle.flexShrink).toBe(1);
      expect(titleStyle.maxWidth).toBe('60%');

      // Both side columns flex equally so the title stays optically centered
      // whether or not a back control is present.
      const sides = screen.getAllByTestId('today-sticky-header-side', HIDDEN);
      expect(sides).toHaveLength(2);
      for (const side of sides) {
        const sideStyle = StyleSheet.flatten(side.props.style);
        expect(sideStyle.flex).toBe(1);
        expect(sideStyle.minWidth).toBe(0);
      }
    });
  });

  it('renders without testIDs when none are provided', () => {
    render(
      <ScreenScrollHeader
        title="Calendar"
        scrollY={new Animated.Value(0)}
        revealThreshold={0}
        topInset={47}
        backAction={{ label: 'Back' }}
      />,
    );

    expect(screen.getByText('Calendar')).toBeTruthy();
  });
});
