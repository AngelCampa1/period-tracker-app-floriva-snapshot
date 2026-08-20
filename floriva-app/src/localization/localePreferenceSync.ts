const localePreferenceListeners = new Set<() => void>();

export function subscribeToLocalePreferenceChanges(listener: () => void) {
  localePreferenceListeners.add(listener);

  return () => {
    localePreferenceListeners.delete(listener);
  };
}

export function notifyLocalePreferenceChanged() {
  for (const listener of localePreferenceListeners) {
    listener();
  }
}
