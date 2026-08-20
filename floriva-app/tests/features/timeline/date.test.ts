import {
  formatLocalTimelineDate,
  normalizeTimelineDate,
} from '@/src/features/timeline/date';

describe('timeline date helpers', () => {
  it('formats local Date objects without UTC shifting the calendar day', () => {
    expect(formatLocalTimelineDate(new Date(2026, 3, 21, 9, 0, 0, 0))).toBe(
      '2026-04-21',
    );
  });

  it('normalizes date-only values and timestamps for timeline grouping', () => {
    expect(normalizeTimelineDate('2026-04-21')).toBe('2026-04-21');
    expect(normalizeTimelineDate('2026-04-21T09:00:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
