import type { SupportedLocale } from '@/src/types/domain';

export const fallbackLocale: SupportedLocale = 'en';

export const supportedLocales = [
  'en',
  'es',
  'de',
  'fr',
  'ja',
  'zh-Hans',
  'pt',
  'ru',
] as const satisfies readonly SupportedLocale[];

export const supportedLocaleSet = new Set<SupportedLocale>(supportedLocales);

export const localeDisplayLabels: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
  'zh-Hans': '简体中文',
  pt: 'Português',
  ru: 'Русский',
};
