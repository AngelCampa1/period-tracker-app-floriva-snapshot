import { formatObservedCycleCount } from '@/src/features/insights/formatObservedCycleCount';

describe('formatObservedCycleCount', () => {
  it.each([
    [1, '1 цикл'],
    [2, '2 цикла'],
    [3, '3 цикла'],
    [4, '4 цикла'],
    [5, '5 циклов'],
    [10, '10 циклов'],
    [11, '11 циклов'],
    [12, '12 циклов'],
    [13, '13 циклов'],
    [14, '14 циклов'],
    [20, '20 циклов'],
    [21, '21 цикл'],
    [22, '22 цикла'],
  ])('uses the correct Russian cycle form for %i', (count, expected) => {
    expect(formatObservedCycleCount('ru', count, `${count} циклов`)).toBe(expected);
  });

  it('preserves the English word-based headline label', () => {
    expect(formatObservedCycleCount('en', 2, '2 cycles')).toBe('two cycles');
    expect(formatObservedCycleCount('en', 9, '9 cycles')).toBe('nine cycles');
  });

  // UL-36: the chart window now matches the engine's 12-interval statistics
  // window (MAX_INTERVAL_WINDOW, cycleStatistics.ts), so the English word
  // list must cover counts up to twelve instead of silently clamping a
  // 12-bar chart's headline to "nine cycles".
  it('covers the full 12-interval engine window in English', () => {
    expect(formatObservedCycleCount('en', 10, '10 cycles')).toBe('ten cycles');
    expect(formatObservedCycleCount('en', 11, '11 cycles')).toBe('eleven cycles');
    expect(formatObservedCycleCount('en', 12, '12 cycles')).toBe('twelve cycles');
    // Defensive clamp only beyond the window a chart can actually show.
    expect(formatObservedCycleCount('en', 13, '13 cycles')).toBe('twelve cycles');
  });

  it.each(['es', 'de', 'fr', 'ja', 'zh-Hans', 'pt'] as const)(
    'preserves the translated count label for %s',
    (locale) => {
      expect(formatObservedCycleCount(locale, 2, 'translated count')).toBe('translated count');
    },
  );
});
