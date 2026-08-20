import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { tabBarItems } from '@/src/features/app-shell/tabBarItems';
import { TabBarClearanceProvider } from '@/src/features/app-shell/tabBarClearance';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/**
 * Android renders `NativeTabs` as a Material 3 bottom bar. Left unstyled it
 * inherits the system Material You surface — which on Android 12+ is a
 * wallpaper-derived tint (often lavender) that clashes with Floriva's warm
 * editorial palette. Pin the bar to the app's paper surface and give the active
 * indicator a soft berry wash so it reads as part of the app, not the OS.
 *
 * iOS is deliberately left alone: on iOS 26 the bar is a floating Liquid Glass
 * capsule, and setting an opaque `backgroundColor` there would flatten the
 * glass. So the surface theming is Android-only; both platforms still share the
 * accent `tintColor` for the selected tab.
 */
function androidBarTheme(theme: FlorivaTheme) {
  if (Platform.OS !== 'android') {
    return null;
  }

  return {
    backgroundColor: theme.colors.tabBarFill,
    indicatorColor: theme.colors.accentSoft,
    iconColor: theme.colors.tabIconDefault,
    labelStyle: { color: theme.colors.tabIconDefault },
    selectedLabelStyle: { color: theme.colors.accentPrimary },
    // Show every tab's label at all times (like iOS), instead of Material's
    // default 'auto' mode which — with 4+ tabs — hides inactive labels and
    // pops the selected one in on tap.
    labelVisibilityMode: 'labeled' as const,
  };
}

export default function AppTabLayout() {
  const { t } = useLocalization();
  const theme = useFlorivaTheme();

  return (
    <TabBarClearanceProvider>
      <NativeTabs tintColor={theme.colors.accentPrimary} {...androidBarTheme(theme)}>
        {tabBarItems.map((item) => (
          <NativeTabs.Trigger key={item.routeName} name={item.routeName}>
            <Label>{t(item.labelKey)}</Label>
            <Icon
              sf={item.ios}
              androidSrc={<VectorIcon family={MaterialIcons} name={item.androidMaterialName} />}
            />
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </TabBarClearanceProvider>
  );
}
