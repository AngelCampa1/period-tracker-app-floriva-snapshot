import type { SupportedLocale } from '@/src/types/domain';

import { translate } from '@/src/localization/translations';

let mockLocale: SupportedLocale = 'en';

export function setMockLocale(locale: SupportedLocale) {
  mockLocale = locale;
}

export function resetMockLocale() {
  mockLocale = 'en';
}

export function useLocalization() {
  return {
    isHydrated: true,
    localePreference: mockLocale,
    resolvedLocale: mockLocale,
    setLocalePreference: async () => undefined,
    t: translate.bind(null, mockLocale),
  };
}

export function t(
  key: Parameters<typeof translate>[1],
  locale: SupportedLocale = 'en',
) {
  return translate(locale, key);
}
