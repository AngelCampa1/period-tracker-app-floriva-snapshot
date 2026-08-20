import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  Newsreader_600SemiBold_Italic,
} from '@expo-google-fonts/newsreader';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DatabaseProvider } from '@/src/db/DatabaseProvider';
import { AppShellProvider } from '@/src/features/app-shell/AppShellProvider';
import { AppShellRouteGuard } from '@/src/features/app-shell/AppShellRouteGuard';
import { BillingProvider } from '@/src/features/billing/BillingProvider';
import {
  InteractionFeedbackProvider,
  useInteractionFeedback,
} from '@/src/features/feedback/InteractionFeedbackProvider';
import {
  createStackMotionOptions,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';
import { LocalizationProvider } from '@/src/localization/LocalizationProvider';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@/src/theme/ThemePreferenceProvider';
import { createNavigationTheme } from '@/src/theme/tokens';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(app)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Editorial redesign fonts — Newsreader (display serif), Inter Tight (sans),
// JetBrains Mono (numerals). Loaded eagerly at boot. If the load stalls beyond
// `FONT_LOAD_TIMEOUT_MS` we proceed with the system fallback stack so the app
// is never blocked behind a font fetch.
const FONT_LOAD_TIMEOUT_MS = 2_000;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Newsreader_600SemiBold_Italic,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    JetBrainsMono_500Medium,
    ...FontAwesome.font,
  });
  const [fontTimeoutElapsed, setFontTimeoutElapsed] = useState(false);

  useEffect(() => {
    if (loaded) {
      return;
    }
    const timer = setTimeout(() => {
      setFontTimeoutElapsed(true);
      if (__DEV__) {
        console.warn(
          `[floriva] Editorial fonts did not load within ${FONT_LOAD_TIMEOUT_MS}ms; rendering with system fallback.`,
        );
      }
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      if (__DEV__) {
        console.warn('[floriva] Font load error; falling back to system fonts.', error);
      }
    }
  }, [error]);

  if (!loaded && !error && !fontTimeoutElapsed) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <DatabaseProvider>
      <LocalizationProvider>
        <ThemePreferenceProvider>
          <InteractionFeedbackProvider>
            <BootstrappedApp />
          </InteractionFeedbackProvider>
        </ThemePreferenceProvider>
      </LocalizationProvider>
    </DatabaseProvider>
  );
}

function BootstrappedApp() {
  const { isHydrated } = useThemePreference();
  const { isHydrated: isInteractionFeedbackHydrated } = useInteractionFeedback();
  const isBootstrapped = isHydrated && isInteractionFeedbackHydrated;

  useEffect(() => {
    if (isBootstrapped) {
      void SplashScreen.hideAsync();
    }
  }, [isBootstrapped]);

  if (!isBootstrapped) {
    return null;
  }

  return (
    <AppShellProvider>
      <BillingProvider>
        <AppShellRouteGuard />
        <RootNavigation />
      </BillingProvider>
    </AppShellProvider>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const navigationTheme = createNavigationTheme(colorScheme);
  const florivaMotion = useFlorivaMotion();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={createStackMotionOptions(florivaMotion.reducedMotionEnabled, 'root')}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="lock" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
