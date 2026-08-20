import { createContext, useContext } from 'react';

// Floriva is light-only: the context no longer carries a theme preference or a
// resolved color scheme. Only the boot-hydration gate consumed by
// app/_layout.tsx remains.
export type ThemePreferenceContextValue = {
  isHydrated: boolean;
};

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);

  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }

  return context;
}

export function useOptionalThemePreference() {
  return useContext(ThemePreferenceContext);
}
