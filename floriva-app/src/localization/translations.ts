import type { SupportedLocale } from '@/src/types/domain';

import { birthControlMessages } from '@/src/localization/messages/birthControl';
import { commonMessages } from '@/src/localization/messages/common';
import { backupMessages } from '@/src/localization/messages/backup';
import { billingMessages } from '@/src/localization/messages/billing';
import { calendarMessages } from '@/src/localization/messages/calendar';
import { importMessages } from '@/src/localization/messages/import';
import { insightsMessages } from '@/src/localization/messages/insights';
import { loggingMessages } from '@/src/localization/messages/logging';
import { notificationsMessages } from '@/src/localization/messages/notifications';
import { onboardingMessages } from '@/src/localization/messages/onboarding';
import { privacyMessages } from '@/src/localization/messages/privacy';
import { navigationMessages } from '@/src/localization/messages/navigation';
import { predictionsMessages } from '@/src/localization/messages/predictions';
import { settingsMessages } from '@/src/localization/messages/settings';
import { trackerMessages } from '@/src/localization/messages/tracker';
import { ttcMessages } from '@/src/localization/messages/ttc';

export const translations = {
  en: {
    ...commonMessages.en,
    ...settingsMessages.en,
    ...importMessages.en,
    ...backupMessages.en,
    ...billingMessages.en,
    ...trackerMessages.en,
    ...loggingMessages.en,
    ...calendarMessages.en,
    ...insightsMessages.en,
    ...onboardingMessages.en,
    ...privacyMessages.en,
    ...navigationMessages.en,
    ...birthControlMessages.en,
    ...ttcMessages.en,
    ...predictionsMessages.en,
    ...notificationsMessages.en,
  },
  es: {
    ...commonMessages.es,
    ...settingsMessages.es,
    ...importMessages.es,
    ...backupMessages.es,
    ...billingMessages.es,
    ...trackerMessages.es,
    ...loggingMessages.es,
    ...calendarMessages.es,
    ...insightsMessages.es,
    ...onboardingMessages.es,
    ...privacyMessages.es,
    ...navigationMessages.es,
    ...birthControlMessages.es,
    ...ttcMessages.es,
    ...predictionsMessages.es,
    ...notificationsMessages.es,
  },
  de: {
    ...commonMessages.de,
    ...settingsMessages.de,
    ...importMessages.de,
    ...backupMessages.de,
    ...billingMessages.de,
    ...trackerMessages.de,
    ...loggingMessages.de,
    ...calendarMessages.de,
    ...insightsMessages.de,
    ...onboardingMessages.de,
    ...privacyMessages.de,
    ...navigationMessages.de,
    ...birthControlMessages.de,
    ...ttcMessages.de,
    ...predictionsMessages.de,
    ...notificationsMessages.de,
  },
  fr: {
    ...commonMessages.fr,
    ...settingsMessages.fr,
    ...importMessages.fr,
    ...backupMessages.fr,
    ...billingMessages.fr,
    ...trackerMessages.fr,
    ...loggingMessages.fr,
    ...calendarMessages.fr,
    ...insightsMessages.fr,
    ...onboardingMessages.fr,
    ...privacyMessages.fr,
    ...navigationMessages.fr,
    ...birthControlMessages.fr,
    ...ttcMessages.fr,
    ...predictionsMessages.fr,
    ...notificationsMessages.fr,
  },
  ja: {
    ...commonMessages.ja,
    ...settingsMessages.ja,
    ...importMessages.ja,
    ...backupMessages.ja,
    ...billingMessages.ja,
    ...trackerMessages.ja,
    ...loggingMessages.ja,
    ...calendarMessages.ja,
    ...insightsMessages.ja,
    ...onboardingMessages.ja,
    ...privacyMessages.ja,
    ...navigationMessages.ja,
    ...birthControlMessages.ja,
    ...ttcMessages.ja,
    ...predictionsMessages.ja,
    ...notificationsMessages.ja,
  },
  'zh-Hans': {
    ...commonMessages['zh-Hans'],
    ...settingsMessages['zh-Hans'],
    ...importMessages['zh-Hans'],
    ...backupMessages['zh-Hans'],
    ...billingMessages['zh-Hans'],
    ...trackerMessages['zh-Hans'],
    ...loggingMessages['zh-Hans'],
    ...calendarMessages['zh-Hans'],
    ...insightsMessages['zh-Hans'],
    ...onboardingMessages['zh-Hans'],
    ...privacyMessages['zh-Hans'],
    ...navigationMessages['zh-Hans'],
    ...birthControlMessages['zh-Hans'],
    ...ttcMessages['zh-Hans'],
    ...predictionsMessages['zh-Hans'],
    ...notificationsMessages['zh-Hans'],
  },
  pt: {
    ...commonMessages.pt,
    ...settingsMessages.pt,
    ...importMessages.pt,
    ...backupMessages.pt,
    ...billingMessages.pt,
    ...trackerMessages.pt,
    ...loggingMessages.pt,
    ...calendarMessages.pt,
    ...insightsMessages.pt,
    ...onboardingMessages.pt,
    ...privacyMessages.pt,
    ...navigationMessages.pt,
    ...birthControlMessages.pt,
    ...ttcMessages.pt,
    ...predictionsMessages.pt,
    ...notificationsMessages.pt,
  },
  ru: {
    ...commonMessages.ru,
    ...settingsMessages.ru,
    ...importMessages.ru,
    ...backupMessages.ru,
    ...billingMessages.ru,
    ...trackerMessages.ru,
    ...loggingMessages.ru,
    ...calendarMessages.ru,
    ...insightsMessages.ru,
    ...onboardingMessages.ru,
    ...privacyMessages.ru,
    ...navigationMessages.ru,
    ...birthControlMessages.ru,
    ...ttcMessages.ru,
    ...predictionsMessages.ru,
    ...notificationsMessages.ru,
  },
} as const;

type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>;
};

type TranslationTree = TranslationShape<(typeof translations)['en']>;

type NestedTranslationKey<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : `${Key}.${NestedTranslationKey<T[Key]>}`;
}[keyof T & string];

export type TranslationKey = NestedTranslationKey<TranslationTree> | (string & {});

function flattenTranslationKeys(
  translationTree: Record<string, unknown>,
  currentPath = '',
): string[] {
  return Object.entries(translationTree).flatMap(([key, value]) => {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;

    if (typeof value === 'string') {
      return [nextPath];
    }

    return flattenTranslationKeys(value as Record<string, unknown>, nextPath);
  });
}

export function buildMissingTranslationKeyReport(
  catalogs: Record<SupportedLocale, TranslationTree>,
) {
  const requiredKeys = new Set(flattenTranslationKeys(catalogs.en));
  const report: Partial<Record<SupportedLocale, string[]>> = {};

  for (const [locale, catalog] of Object.entries(catalogs) as [
    SupportedLocale,
    TranslationTree,
  ][]) {
    if (locale === 'en') {
      continue;
    }

    const localeKeys = new Set(flattenTranslationKeys(catalog));
    const missingKeys = [...requiredKeys].filter((key) => !localeKeys.has(key));

    if (missingKeys.length > 0) {
      report[locale] = missingKeys;
    }
  }

  return report;
}

function interpolateTranslation(
  template: string,
  params: Record<string, string | number> = {},
) {
  return Object.entries(params).reduce((result, [paramName, paramValue]) => {
    return result.replaceAll(`{${paramName}}`, String(paramValue));
  }, template);
}

function getTranslationValue(
  translationTree: Record<string, unknown>,
  translationKey: string,
): string {
  const resolvedValue = translationKey
    .split('.')
    .reduce<unknown>((currentValue, pathSegment) => {
      if (!currentValue || typeof currentValue !== 'object') {
        return undefined;
      }

      return (currentValue as Record<string, unknown>)[pathSegment];
    }, translationTree);

  if (typeof resolvedValue !== 'string') {
    throw new Error(`Missing translation for key "${translationKey}"`);
  }

  return resolvedValue;
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  return interpolateTranslation(getTranslationValue(translations[locale], key), params);
}
