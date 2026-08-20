import { Platform, StyleSheet, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockIsLiquidGlassAvailable = jest.fn();

jest.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => mockIsLiquidGlassAvailable(),
  GlassView: ({ children, ...props }: Record<string, unknown>) => {
    const RN = require('react-native');
    // testID last so a caller-supplied testID (spread in props) is preserved,
    // while the default lets the fidelity tests still locate the glass surface.
    return (
      <RN.View {...props} testID={(props.testID as string) ?? 'glass-view'}>
        {children as React.ReactNode}
      </RN.View>
    );
  },
}));

// eslint-disable-next-line import/first
import { florivaThemes } from '@/src/theme/tokens';
// eslint-disable-next-line import/first
import { GlassSurface } from '@/src/components/primitives/GlassSurface';

const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('GlassSurface', () => {
  const glass = florivaThemes.light.glass;

  beforeEach(() => {
    mockIsLiquidGlassAvailable.mockReset();
  });

  afterEach(() => {
    setOS(originalOS);
  });

  it('renders real Liquid Glass on iOS 26 and forwards material, tint, interactivity, and radius', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(true);

    render(
      <GlassSurface material="clear" tint="#923030" interactive radius={28}>
        <Text>content</Text>
      </GlassSurface>,
    );

    const glassView = screen.getByTestId('glass-view');
    expect(glassView.props.glassEffectStyle).toBe('clear');
    expect(glassView.props.tintColor).toBe('#923030');
    expect(glassView.props.isInteractive).toBe(true);
    expect(StyleSheet.flatten(glassView.props.style)).toEqual(
      expect.objectContaining({ borderRadius: 28, overflow: 'hidden' }),
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('forwards the default material/interactivity to the glass branch when omitted', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(true);

    render(<GlassSurface><Text>default</Text></GlassSurface>);

    const glassView = screen.getByTestId('glass-view');
    expect(glassView.props.glassEffectStyle).toBe('regular');
    expect(glassView.props.isInteractive).toBe(false);
    // Default radius is the large editorial radius.
    expect(StyleSheet.flatten(glassView.props.style).borderRadius).toBe(
      florivaThemes.light.radii.lg,
    );
  });

  it('renders a solid fallback (no glass) on iOS when Liquid Glass is unavailable', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(false);

    render(
      <GlassSurface material="regular" fallbackColor="#FBF5EB" radius={16}>
        <Text>fallback</Text>
      </GlassSurface>,
    );

    expect(screen.queryByTestId('glass-view')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    expect(style).toEqual(
      expect.objectContaining({ backgroundColor: '#FBF5EB', borderRadius: 16 }),
    );
    // iOS fallback is flat — no Material elevation.
    expect(style.elevation).toBeUndefined();
    expect(screen.getByText('fallback')).toBeTruthy();
  });

  it('renders a Material elevated surface (no glass) on Android even when the helper reports glass', () => {
    setOS('android');
    // Guard the real invariant: Android must never use glass regardless of the
    // native availability helper.
    mockIsLiquidGlassAvailable.mockReturnValue(true);

    render(
      <GlassSurface material="regular">
        <Text>material</Text>
      </GlassSurface>,
    );

    expect(screen.queryByTestId('glass-view')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    expect(style.elevation).toBe(glass.elevation.raised);
    expect(style.backgroundColor).toBe(glass.fallback.regular);
    expect(screen.getByText('material')).toBeTruthy();
  });

  it('drops Android Material elevation when elevated is false, so a backdrop sits behind its siblings', () => {
    setOS('android');
    mockIsLiquidGlassAvailable.mockReturnValue(false);

    render(
      <GlassSurface material="regular" elevated={false}>
        <Text>backdrop</Text>
      </GlassSurface>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    // elevation 0 → the surface composites in declaration order (behind later
    // siblings) instead of Android lifting it above the footer's action buttons.
    expect(style.elevation).toBe(0);
    expect(style.backgroundColor).toBe(glass.fallback.regular);
  });

  it('defaults the fallback color to the theme glass fallback for the material and pins the default radius', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(false);

    render(
      <GlassSurface material="clear">
        <View testID="child" />
      </GlassSurface>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    expect(style.backgroundColor).toBe(glass.fallback.clear);
    expect(style.borderRadius).toBe(florivaThemes.light.radii.lg);
  });

  it('degrades to the solid fallback (no crash) when the native glass module is missing', () => {
    setOS('ios');
    // Simulates a dev client / build without the ExpoGlassEffect native module.
    mockIsLiquidGlassAvailable.mockImplementation(() => {
      throw new Error("Cannot find native module 'ExpoGlassEffect'");
    });

    expect(() =>
      render(
        <GlassSurface material="regular">
          <View testID="child" />
        </GlassSurface>,
      ),
    ).not.toThrow();

    expect(screen.queryByTestId('glass-view')).toBeNull();
    expect(screen.getByTestId('glass-surface-fallback')).toBeTruthy();
  });

  it('never washes tint onto a solid fallback surface', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(false);

    render(
      <GlassSurface material="regular" tint="#923030">
        <View testID="child" />
      </GlassSurface>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    // The accent tint belongs to genuine glass only — the fallback stays the solid.
    expect(style.backgroundColor).toBe(glass.fallback.regular);
  });

  it('draws a hairline edge when bordered, using the glass border token', () => {
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(false);

    render(<GlassSurface bordered><View testID="child" /></GlassSurface>);

    const style = StyleSheet.flatten(screen.getByTestId('glass-surface-fallback').props.style);
    expect(style.borderWidth).toBe(StyleSheet.hairlineWidth);
    expect(style.borderColor).toBe(glass.border);
  });

  it('passes ViewProps (testID, onLayout, accessibility) through on every branch', () => {
    const onLayout = jest.fn();

    // Glass branch: caller testID wins over the default.
    setOS('ios');
    mockIsLiquidGlassAvailable.mockReturnValue(true);
    const glassRender = render(
      <GlassSurface testID="header-glass" onLayout={onLayout} accessibilityRole="summary">
        <View testID="child" />
      </GlassSurface>,
    );
    const glassNode = glassRender.getByTestId('header-glass');
    expect(glassNode.props.onLayout).toBe(onLayout);
    expect(glassNode.props.accessibilityRole).toBe('summary');
    glassRender.unmount();

    // Fallback branch: same passthrough, and the caller testID avoids the
    // default 'glass-surface-fallback' collision between two surfaces.
    setOS('android');
    mockIsLiquidGlassAvailable.mockReturnValue(false);
    render(
      <GlassSurface testID="card-a" onLayout={onLayout} accessibilityRole="summary">
        <View testID="child" />
      </GlassSurface>,
    );
    const fallbackNode = screen.getByTestId('card-a');
    expect(fallbackNode.props.onLayout).toBe(onLayout);
    expect(fallbackNode.props.accessibilityRole).toBe('summary');
  });
});
