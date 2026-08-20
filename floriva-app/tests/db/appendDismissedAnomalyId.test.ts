import { appendDismissedAnomalyId } from '@/src/db/repositories';

describe('appendDismissedAnomalyId', () => {
  it('appends a new id to an empty list', () => {
    expect(appendDismissedAnomalyId([], 'short-cycle:2026-04-01')).toEqual([
      'short-cycle:2026-04-01',
    ]);
  });

  it('appends a new id after existing ids, preserving order', () => {
    expect(
      appendDismissedAnomalyId(['long-cycle:2026-03-01'], 'short-cycle:2026-04-01'),
    ).toEqual(['long-cycle:2026-03-01', 'short-cycle:2026-04-01']);
  });

  it('does not duplicate an id that is already present', () => {
    expect(
      appendDismissedAnomalyId(
        ['long-cycle:2026-03-01', 'short-cycle:2026-04-01'],
        'short-cycle:2026-04-01',
      ),
    ).toEqual(['long-cycle:2026-03-01', 'short-cycle:2026-04-01']);
  });

  it('keeps exactly 50 ids untouched when appending a 50th new id', () => {
    const fortyNineIds = Array.from({ length: 49 }, (_, index) => `anomaly-${index}`);

    const result = appendDismissedAnomalyId(fortyNineIds, 'anomaly-49');

    expect(result).toHaveLength(50);
    expect(result[0]).toBe('anomaly-0');
    expect(result[49]).toBe('anomaly-49');
  });

  it('drops the oldest id once appending would exceed 50 entries', () => {
    const fiftyIds = Array.from({ length: 50 }, (_, index) => `anomaly-${index}`);

    const result = appendDismissedAnomalyId(fiftyIds, 'anomaly-50');

    expect(result).toHaveLength(50);
    expect(result).not.toContain('anomaly-0');
    expect(result[0]).toBe('anomaly-1');
    expect(result[49]).toBe('anomaly-50');
  });

  it('drops multiple oldest ids when starting far over the cap (defensive/never-expected input)', () => {
    const sixtyIds = Array.from({ length: 60 }, (_, index) => `anomaly-${index}`);

    const result = appendDismissedAnomalyId(sixtyIds, 'anomaly-60');

    expect(result).toHaveLength(50);
    expect(result[0]).toBe('anomaly-11');
    expect(result[49]).toBe('anomaly-60');
  });
});
