import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';

import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';

export default function IndexRoute() {
  const { isHydrated, state } = useAppShell();

  if (!isHydrated) {
    return (
      <View accessibilityRole="progressbar">
        <Text>Loading Floriva...</Text>
      </View>
    );
  }

  return <Redirect href={resolveAppEntry(state)} />;
}
