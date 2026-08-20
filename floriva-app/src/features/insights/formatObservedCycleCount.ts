import type { SupportedLocale } from '@/src/types/domain';

// UL-36: covers the full 12-interval engine statistics window
// (MAX_INTERVAL_WINDOW, cycleStatistics.ts) -- the chart never shows more
// bars than that, so the headline word never needs to go past "twelve".
// The old list stopped at "nine", silently clamping a fuller chart's
// headline to a wrong count.
const ENGLISH_CYCLE_COUNT_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const;

function formatEnglishCycleCount(count: number): string {
  const word =
    ENGLISH_CYCLE_COUNT_WORDS[
      Math.min(Math.max(count, 1), ENGLISH_CYCLE_COUNT_WORDS.length) - 1
    ];
  return count === 1 ? `${word} cycle` : `${word} cycles`;
}

function russianCycleNoun(count: number): 'цикл' | 'цикла' | 'циклов' {
  const normalizedCount = Math.abs(Math.trunc(count));
  const lastTwoDigits = normalizedCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'циклов';
  }

  const lastDigit = normalizedCount % 10;

  if (lastDigit === 1) {
    return 'цикл';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'цикла';
  }

  return 'циклов';
}

export function formatObservedCycleCount(
  locale: SupportedLocale,
  count: number,
  translatedCount: string,
): string {
  if (locale === 'en') {
    return formatEnglishCycleCount(count);
  }

  if (locale === 'ru') {
    return `${count} ${russianCycleNoun(count)}`;
  }

  return translatedCount;
}
