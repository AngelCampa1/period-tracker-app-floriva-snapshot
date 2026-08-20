import {
  formatLocalizedDate,
  formatLocalizedMonthDay,
  formatLocalizedPredictionRange,
  formatLocalizedReminderTime,
} from '@/src/localization/formatters';

describe('localized formatters', () => {
  it('formats month-day labels using the locale ordering and script', () => {
    expect(formatLocalizedMonthDay('2026-04-28', 'en')).toBe('Apr 28');
    expect(formatLocalizedMonthDay('2026-04-28', 'ja')).toBe('4月28日');
  });

  it('formats localized prediction ranges', () => {
    expect(formatLocalizedPredictionRange('2026-04-28', '2026-05-02', 'en')).toBe(
      'Apr 28 to May 2',
    );
    expect(formatLocalizedPredictionRange('2026-04-28', '2026-05-02', 'ja')).toBe(
      '4月28日〜5月2日',
    );
  });

  it('formats reminder times for the resolved locale', () => {
    expect(formatLocalizedReminderTime(20, 0, 'en')).toBe('8:00 PM');
    expect(formatLocalizedReminderTime(20, 0, 'ja')).toBe('20:00');
  });

  it('formats long-form dates for settings and billing surfaces', () => {
    expect(formatLocalizedDate('2026-05-09T10:00:00.000Z', 'en')).toBe('May 9, 2026');
    expect(formatLocalizedDate('2026-05-09T10:00:00.000Z', 'ja')).toBe('2026年5月9日');
  });

  it('returns null for invalid timestamps instead of formatting garbage', () => {
    expect(formatLocalizedDate('not-a-timestamp', 'en')).toBeNull();
  });
});
