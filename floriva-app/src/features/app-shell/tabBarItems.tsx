import type { ComponentProps } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

/** Valid `@expo/vector-icons` MaterialIcons glyph names (type-only, no runtime import). */
type MaterialIconName = ComponentProps<
  typeof import('@expo/vector-icons/MaterialIcons').default
>['name'];

export type TabRouteName = 'today' | 'calendar' | 'insights' | 'settings';

export type TabLabelKey =
  | 'navigation.tabs.today'
  | 'navigation.tabs.calendar'
  | 'navigation.tabs.insights'
  | 'navigation.tabs.settings';

export type TabBarItem = {
  routeName: TabRouteName;
  labelKey: TabLabelKey;
  /** SF Symbols for iOS: idle and selected states. */
  ios: { default: SFSymbol; selected: SFSymbol };
  /** `@expo/vector-icons` MaterialIcons glyph name for Android. */
  androidMaterialName: MaterialIconName;
};

/**
 * Declarative bottom-tab configuration consumed by the native tab bar layout.
 * Kept as pure data so ordering, labels, and platform icons are unit-testable
 * without rendering the native navigator.
 */
export const tabBarItems: readonly TabBarItem[] = [
  {
    routeName: 'today',
    labelKey: 'navigation.tabs.today',
    ios: { default: 'circle.circle', selected: 'smallcircle.filled.circle' },
    androidMaterialName: 'radio-button-checked',
  },
  {
    routeName: 'calendar',
    labelKey: 'navigation.tabs.calendar',
    ios: { default: 'calendar', selected: 'calendar' },
    androidMaterialName: 'calendar-month',
  },
  {
    routeName: 'insights',
    labelKey: 'navigation.tabs.insights',
    ios: {
      default: 'chart.line.uptrend.xyaxis',
      selected: 'chart.line.uptrend.xyaxis',
    },
    androidMaterialName: 'insights',
  },
  {
    routeName: 'settings',
    labelKey: 'navigation.tabs.settings',
    ios: { default: 'gearshape', selected: 'gearshape.fill' },
    androidMaterialName: 'settings',
  },
] as const;
