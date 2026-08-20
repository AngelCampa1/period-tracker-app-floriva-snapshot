import { selectImprovementCodes } from '@/src/lib/predictions/confidenceImprovements';

describe('selectImprovementCodes', () => {
  it('selects onboarding-seed as actionable', () => {
    expect(selectImprovementCodes(['onboarding-seed'])).toEqual(['onboarding-seed']);
  });

  it('selects limited-bleeding-history as actionable', () => {
    expect(selectImprovementCodes(['limited-bleeding-history'])).toEqual([
      'limited-bleeding-history',
    ]);
  });

  it('selects one-observed-interval as actionable', () => {
    expect(selectImprovementCodes(['one-observed-interval'])).toEqual(['one-observed-interval']);
  });

  it('excludes irregular-cycle-support-enabled (no actionable follow-up)', () => {
    expect(selectImprovementCodes(['irregular-cycle-support-enabled'])).toEqual([]);
  });

  it('excludes consistent-recent-bleeding-history (no actionable follow-up)', () => {
    expect(selectImprovementCodes(['consistent-recent-bleeding-history'])).toEqual([]);
  });

  it('excludes the three A5 ovulation-derived codes (descriptive, not actionable)', () => {
    expect(selectImprovementCodes(['hormonal-birth-control'])).toEqual([]);
    expect(selectImprovementCodes(['signals-disagree'])).toEqual([]);
    expect(selectImprovementCodes(['ovulation-signal-confirmed'])).toEqual([]);
  });

  it('preserves order across multiple actionable codes', () => {
    expect(
      selectImprovementCodes(['onboarding-seed', 'limited-bleeding-history']),
    ).toEqual(['onboarding-seed', 'limited-bleeding-history']);
  });

  it('filters non-actionable codes out of a mixed list, preserving order of survivors', () => {
    expect(
      selectImprovementCodes([
        'irregular-cycle-support-enabled',
        'limited-bleeding-history',
        'consistent-recent-bleeding-history',
      ]),
    ).toEqual(['limited-bleeding-history']);
  });

  it('returns an empty array for an empty input', () => {
    expect(selectImprovementCodes([])).toEqual([]);
  });
});
