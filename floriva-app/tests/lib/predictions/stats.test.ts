import { median } from '@/src/lib/predictions/stats';

describe('median', () => {
  it('returns 0 for an empty array', () => {
    expect(median([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(median([42])).toBe(42);
  });

  it('returns the middle value for an odd-length array, independent of input order', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([3, 5, 1])).toBe(3);
  });

  it('averages the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the input array', () => {
    const input = [5, 1, 3];
    median(input);
    expect(input).toEqual([5, 1, 3]);
  });
});
