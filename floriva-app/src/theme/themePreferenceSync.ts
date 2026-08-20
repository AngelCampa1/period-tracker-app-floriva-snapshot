// Floriva is light-only: ThemePreferenceProvider no longer subscribes here, so
// in production this listener set is empty and notifyThemePreferenceChanged is
// a no-op. The module is kept because AppShellProvider still calls notify after
// restore/wipe/onboarding (and its tests mock this path); removing those call
// sites is deferred to a later UI-lift phase.
const themePreferenceListeners = new Set<() => void>();

export function subscribeToThemePreferenceChanges(listener: () => void) {
  themePreferenceListeners.add(listener);

  return () => {
    themePreferenceListeners.delete(listener);
  };
}

export function notifyThemePreferenceChanged() {
  for (const listener of themePreferenceListeners) {
    listener();
  }
}
