import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockNativeTabs = jest.fn();
const mockTrigger = jest.fn();
const mockIcon = jest.fn();

jest.mock('expo-router/unstable-native-tabs', () => {
  const { Text: MockText } = require('react-native');

  function NativeTabs({ children, ...props }: { children: React.ReactNode }) {
    // The tab navigator is a descendant of TabBarClearanceProvider, so reading
    // the clearance context here proves the layout actually wraps it. Without
    // the provider the context falls back to its default (0). We also capture
    // every styling prop so tests can assert the Android surface theming.
    const { useTabBarClearance } = require('@/src/features/app-shell/tabBarClearance');
    mockNativeTabs({ ...props, clearance: useTabBarClearance() });

    return <>{children}</>;
  }
  function NativeTabsTrigger({
    name,
    children,
  }: {
    name: string;
    children: React.ReactNode;
  }) {
    mockTrigger({ name });

    return <>{children}</>;
  }
  NativeTabs.Trigger = NativeTabsTrigger;

  function Label({ children }: { children: React.ReactNode }) {
    return <MockText>{children}</MockText>;
  }
  function Icon(props: unknown) {
    mockIcon(props);

    return null;
  }
  function VectorIcon() {
    return null;
  }

  return { __esModule: true, NativeTabs, Label, Icon, VectorIcon };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/src/theme/useFlorivaTheme', () => ({
  useFlorivaTheme: () => ({
    colors: {
      accentPrimary: '#e0567f',
      accentSoft: '#E8D2CB',
      tabBarFill: '#FBF5EB',
      tabIconDefault: '#7A6A5E',
    },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import AppTabLayout from '@/app/(app)/(tabs)/_layout';

describe('AppTabLayout (native tabs)', () => {
  beforeEach(() => {
    mockNativeTabs.mockClear();
    mockTrigger.mockClear();
    mockIcon.mockClear();
  });

  it('renders a trigger for each tab route in order', () => {
    render(<AppTabLayout />);

    expect(mockTrigger.mock.calls.map((call) => call[0].name)).toEqual([
      'today',
      'calendar',
      'insights',
      'settings',
    ]);
  });

  it('passes the localized tab labels', () => {
    render(<AppTabLayout />);

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Insights')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('tints the native bar with the accent color', () => {
    render(<AppTabLayout />);

    expect(mockNativeTabs).toHaveBeenCalledWith(
      expect.objectContaining({ tintColor: '#e0567f' }),
    );
  });

  it('wraps the tab navigator in TabBarClearanceProvider so every tab screen reserves space for the floating bar', () => {
    // Regression guard: all per-screen tab-bar clearance was centralized into
    // this single provider wrapper. If it is ever dropped from the layout, tab
    // screens fall back to clearance 0 and their bottom CTAs (e.g. Today's "Log
    // today") slide under the floating native tab bar. Assert the real context
    // value reaches the navigator.
    const { nativeTabBarClearance } = require('@/src/features/app-shell/tabBarClearance');

    render(<AppTabLayout />);

    expect(mockNativeTabs).toHaveBeenCalledWith(
      expect.objectContaining({ clearance: nativeTabBarClearance }),
    );
    expect(nativeTabBarClearance).toBeGreaterThan(0);
  });

  it('themes the Android Material bar to the app palette instead of the system surface', () => {
    // Left unstyled, NativeTabs on Android inherits the Material You system
    // surface (a wallpaper-derived lavender that clashes with the warm paper
    // palette). Pin it to the app's surface + a soft berry active indicator.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      render(<AppTabLayout />);

      expect(mockNativeTabs).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: '#FBF5EB',
          indicatorColor: '#E8D2CB',
          iconColor: '#7A6A5E',
          selectedLabelStyle: { color: '#e0567f' },
          tintColor: '#e0567f',
          // Always show every tab's label (like iOS), not Material's default
          // 'auto' mode that hides inactive labels and pops the selected one in.
          labelVisibilityMode: 'labeled',
        }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('leaves the iOS tab bar without an opaque background so the Liquid Glass capsule survives', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    try {
      render(<AppTabLayout />);

      const props = mockNativeTabs.mock.calls[0][0];
      // No opaque surface theming on iOS — the glass capsule provides the fill.
      expect(props.backgroundColor).toBeUndefined();
      expect(props.indicatorColor).toBeUndefined();
      // The accent tint still drives the selected tab on both platforms.
      expect(props.tintColor).toBe('#e0567f');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('passes SF Symbols for each tab, including the discreet day-circle Today icon', () => {
    render(<AppTabLayout />);

    const sfSets = mockIcon.mock.calls.map((call) => call[0].sf);
    expect(sfSets[0]).toEqual({
      default: 'circle.circle',
      selected: 'smallcircle.filled.circle',
    });
    expect(sfSets).toContainEqual({ default: 'calendar', selected: 'calendar' });
  });
});
