import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeLocale = {
  languageCode?: string | null;
  languageTag?: string | null;
  regionCode?: string | null;
};

type ExpoLocalizationModule = {
  getLocales: () => NativeLocale[];
};

let cachedLocalizationModule: ExpoLocalizationModule | null | undefined;

function loadOptionalLocalizationModule() {
  if (!requireOptionalNativeModule('ExpoLocalization')) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-localization') as ExpoLocalizationModule;
  } catch {
    return null;
  }
}

export function getSystemLocales() {
  if (cachedLocalizationModule === undefined) {
    cachedLocalizationModule = loadOptionalLocalizationModule();
  }

  return cachedLocalizationModule?.getLocales() ?? [];
}
