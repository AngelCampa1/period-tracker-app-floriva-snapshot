import type { AppPreferencesRepository } from '@/src/db/contracts';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { fallbackLocale, supportedLocaleSet } from '@/src/localization/config';
import { getSystemLocales } from '@/src/localization/localizationNative';
import type { LocalePreference, SupportedLocale } from '@/src/types/domain';

function normalizeLocaleTag(value?: string | null) {
  return value?.trim().replace(/_/g, '-').toLowerCase() ?? '';
}

function normalizeChineseLanguageTag(languageTag?: string | null) {
  const loweredTag = normalizeLocaleTag(languageTag);

  if (loweredTag.includes('hant')) {
    return fallbackLocale;
  }

  return 'zh-Hans' as const;
}

export function resolveSupportedLocale(languageTag?: string | null, languageCode?: string | null) {
  const normalizedLanguageTag = normalizeLocaleTag(languageTag);

  if (normalizedLanguageTag) {
    if (normalizedLanguageTag.startsWith('zh')) {
      return normalizeChineseLanguageTag(normalizedLanguageTag);
    }

    if (supportedLocaleSet.has(normalizedLanguageTag as SupportedLocale)) {
      return normalizedLanguageTag as SupportedLocale;
    }

    const baseLanguageCode = normalizedLanguageTag.split('-')[0];
    if (supportedLocaleSet.has(baseLanguageCode as SupportedLocale)) {
      return baseLanguageCode as SupportedLocale;
    }
  }

  const normalizedLanguageCode = normalizeLocaleTag(languageCode);

  if (normalizedLanguageCode) {
    if (normalizedLanguageCode === 'zh') {
      return 'zh-Hans';
    }

    if (supportedLocaleSet.has(normalizedLanguageCode as SupportedLocale)) {
      return normalizedLanguageCode as SupportedLocale;
    }
  }

  return fallbackLocale;
}

export function resolveDeviceLocale() {
  const primaryLocale = getSystemLocales()[0];

  return resolveSupportedLocale(primaryLocale?.languageTag, primaryLocale?.languageCode);
}

export function resolveLocalePreference(localePreference: LocalePreference) {
  if (localePreference === 'system') {
    return resolveDeviceLocale();
  }

  return localePreference;
}

// Shared fallback chain for reading the persisted locale preference: prefer
// what's stored, fall back to the default app preferences' value, and fall
// back to 'system' if even that is somehow missing. Used anywhere a
// LocalePreference needs to be read from repositories.appPreferences without
// duplicating this three-step chain inline.
export async function readPersistedLocalePreference(
  appPreferencesRepository: Pick<AppPreferencesRepository, 'getPreferences'>,
): Promise<LocalePreference> {
  const preferences = await appPreferencesRepository.getPreferences();

  return preferences.localePreference ?? defaultAppPreferences.localePreference ?? 'system';
}

// Resolves the persisted locale preference to a concrete SupportedLocale for
// code that runs outside React (no LocalizationProvider context available):
// notification category registration and reminder scheduling both use this.
// Same resolution chain as LocalizationProvider — read the persisted
// preference, fall back to 'system', resolve via resolveLocalePreference.
export async function resolveCurrentLocale(
  appPreferencesRepository: Pick<AppPreferencesRepository, 'getPreferences'>,
): Promise<SupportedLocale> {
  const localePreference = await readPersistedLocalePreference(appPreferencesRepository);

  return resolveLocalePreference(localePreference);
}
