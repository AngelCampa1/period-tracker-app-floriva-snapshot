import type { SupportedLocale } from '@/src/types/domain';

function createMiddayDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

const localizedRangeSeparators = {
  en: ' to ',
  es: ' a ',
  de: ' bis ',
  fr: ' au ',
  ja: '〜',
  'zh-Hans': '至',
  pt: ' a ',
  ru: ' — ',
} satisfies Record<SupportedLocale, string>;

export function formatLocalizedRange(
  startLabel: string,
  endLabel: string,
  locale: SupportedLocale,
) {
  return `${startLabel}${localizedRangeSeparators[locale]}${endLabel}`;
}

export function formatLocalizedMonthDay(isoDate: string, locale: SupportedLocale) {
  const date = createMiddayDate(isoDate);

  return new Intl.DateTimeFormat(locale, {
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
  }).format(date);
}

export function formatLocalizedPredictionRange(
  startIso: string,
  endIso: string,
  locale: SupportedLocale,
) {
  return formatLocalizedRange(
    formatLocalizedMonthDay(startIso, locale),
    formatLocalizedMonthDay(endIso, locale),
    locale,
  );
}

export function formatLocalizedReminderTime(
  hour: number,
  minute: number,
  locale: SupportedLocale,
) {
  const date = new Date(2026, 0, 1, hour, minute);

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatLocalizedDate(isoTimestamp: string, locale: SupportedLocale) {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    day: 'numeric',
  }).format(date);
}
