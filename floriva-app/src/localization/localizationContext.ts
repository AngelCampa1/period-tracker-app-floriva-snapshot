import { createContext, useContext } from 'react';

import type { TranslationKey } from '@/src/localization/translations';
import type { LocalePreference, SupportedLocale } from '@/src/types/domain';

export type LocalizationContextValue = {
  isHydrated: boolean;
  localePreference: LocalePreference;
  resolvedLocale: SupportedLocale;
  setLocalePreference: (nextPreference: LocalePreference) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function useLocalization() {
  const context = useContext(LocalizationContext);

  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }

  return context;
}
