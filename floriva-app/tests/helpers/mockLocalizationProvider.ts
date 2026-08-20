import { translate } from '@/src/localization/translations';
import type { SupportedLocale } from '@/src/types/domain';

type MockLocalization = {
  isHydrated: true;
  localePreference: 'en';
  resolvedLocale: SupportedLocale;
  setLocalePreference: (nextPreference: import('@/src/types/domain').LocalePreference) => Promise<void>;
  t: (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => string;
};

const localizationCache = new Map<SupportedLocale, MockLocalization>();

export function createMockLocalization(locale: SupportedLocale = 'en'): MockLocalization {
  const cachedLocalization = localizationCache.get(locale);

  if (cachedLocalization) {
    return cachedLocalization;
  }

  const localization = {
    isHydrated: true,
    localePreference: 'en' as const,
    resolvedLocale: locale,
    setLocalePreference: async () => undefined,
    t: translate.bind(null, locale),
  } satisfies MockLocalization;

  localizationCache.set(locale, localization);

  return localization;
}

export function resetMockLocalizations() {
  localizationCache.clear();
}
