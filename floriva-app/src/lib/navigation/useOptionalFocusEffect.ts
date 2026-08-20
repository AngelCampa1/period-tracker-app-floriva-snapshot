import { useCallback, useState } from 'react';
import * as ExpoRouter from 'expo-router';

type FocusEffectHook = (effect: () => void) => void;

/**
 * Runs `effect` whenever the screen regains focus, when Expo Router's
 * `useFocusEffect` is available (it is in the app, but not always in test
 * harnesses). Falls back to a no-op so screens stay testable in isolation.
 */
export function useOptionalFocusEffect(effect: () => void) {
  const focusEffect = (ExpoRouter as { useFocusEffect?: FocusEffectHook }).useFocusEffect;

  if (typeof focusEffect === 'function') {
    focusEffect(effect);
  }
}

/**
 * Returns a monotonically increasing counter that increments every time the
 * screen regains focus. Screens add it to a hydration effect's dependency list
 * so predictions recompute from freshly written logs instead of showing stale
 * data until a full app relaunch.
 */
export function useFocusRefreshVersion() {
  const [refreshVersion, setRefreshVersion] = useState(0);

  useOptionalFocusEffect(
    useCallback(() => {
      setRefreshVersion((currentVersion) => currentVersion + 1);
    }, []),
  );

  return refreshVersion;
}
