import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

/**
 * Amount of bottom space (in points, ON TOP of the safe-area inset) that
 * content inside the native tab navigator must reserve so it is not covered by
 * the floating tab bar.
 *
 * Why a context instead of per-screen opt-in: the native tab bar
 * (expo-router native tabs) does not publish its height via
 * `BottomTabBarHeightContext`, so screens previously had to set
 * `reserveTabBarSpace` by hand — and any screen that forgot (e.g. Today) let
 * its bottom CTA slide under the bar. The `(tabs)` layout now provides this
 * value to every tab screen automatically; screens outside the tab navigator
 * receive the default (0) because there is no bar to clear.
 *
 * The iOS value accounts for the floating Liquid Glass capsule (bar height +
 * the gap it floats above the safe area); Android's docked Material 3 bar is a
 * little shorter. Tuned on-device — see docs/qa/2026-07-22-native-glass.
 */
export const nativeTabBarClearance = Platform.select({
  ios: 72,
  android: 72,
  default: 72,
}) as number;

const TabBarClearanceContext = createContext(0);

export function TabBarClearanceProvider({
  children,
  value = nativeTabBarClearance,
}: PropsWithChildren<{ value?: number }>) {
  return (
    <TabBarClearanceContext.Provider value={value}>{children}</TabBarClearanceContext.Provider>
  );
}

/** Points of bottom clearance a Screen should reserve for the tab bar (0 outside tabs). */
export function useTabBarClearance(): number {
  return useContext(TabBarClearanceContext);
}
