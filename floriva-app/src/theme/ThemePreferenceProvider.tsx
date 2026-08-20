import { PropsWithChildren } from 'react';

import {
  ThemePreferenceContext,
  type ThemePreferenceContextValue,
} from '@/src/theme/themePreferenceContext';

export { useOptionalThemePreference, useThemePreference } from '@/src/theme/themePreferenceContext';

// Floriva is light-only: the stored themePreference row is legacy data that no
// longer drives rendering, so the provider neither reads nor writes it and
// hydration resolves synchronously. It stays a provider (rather than a bare
// constant) so useThemePreference keeps gating boot in app/_layout.tsx.
const staticThemePreferenceValue: ThemePreferenceContextValue = {
  isHydrated: true,
};

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  return (
    <ThemePreferenceContext.Provider value={staticThemePreferenceValue}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}
