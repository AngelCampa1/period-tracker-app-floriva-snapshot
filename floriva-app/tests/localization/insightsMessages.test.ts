import { insightsMessages } from '@/src/localization/messages/insights';
import { supportedLocaleValues } from '@/src/types/domain';

import { bannedMedicalTermsByLocale } from '../helpers/bannedMedicalTerms';

// LT-18: cycle-length consistency copy-guard. The Insights cycle-length card
// used to show a single hardcoded English "Consistent on average / Within
// +/- 2 days..." pair regardless of data or locale (see the findings
// ledger). It is now driven by CycleLengthConsistencyLevel with a dedicated
// subtitle+footnote pair per level, in every supported locale -- this test
// pins that catalog contract so a future locale addition or catalog edit
// cannot silently drop a level's copy.
const cycleLengthConsistencyLevels = [
  'Consistent',
  'SomewhatVariable',
  'VariesWidely',
  'NotEnoughData',
] as const;

describe('insightsMessages.cycleLength (LT-18 copy guard)', () => {
  it('defines every supported locale', () => {
    for (const locale of supportedLocaleValues) {
      expect(insightsMessages).toHaveProperty(locale);
    }
    expect(Object.keys(insightsMessages)).toHaveLength(supportedLocaleValues.length);
  });

  it('defines a non-empty subtitle and footnote for every consistency level in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const { cycleLength } = insightsMessages[locale].insights;

      for (const level of cycleLengthConsistencyLevels) {
        const subtitleKey = `subtitle${level}` as const;
        const footnoteKey = `footnote${level}` as const;

        expect(typeof cycleLength[subtitleKey]).toBe('string');
        expect(cycleLength[subtitleKey].trim().length).toBeGreaterThan(0);
        expect(typeof cycleLength[footnoteKey]).toBe('string');
        expect(cycleLength[footnoteKey].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates a {days} placeholder in both "variable" footnotes (the only levels that cite a number) in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const { cycleLength } = insightsMessages[locale].insights;

      expect(cycleLength.footnoteConsistent).toContain('{days}');
      expect(cycleLength.footnoteSomewhatVariable).toContain('{days}');
      // 'varies-widely' and 'not-enough-data' describe a pattern, not a
      // specific day count, so they must NOT reference the placeholder.
      expect(cycleLength.footnoteVariesWidely).not.toContain('{days}');
      expect(cycleLength.footnoteNotEnoughData).not.toContain('{days}');
    }
  });

  // UL-02 pluralization sibling: a rounded ~1-day spread used to render
  // "Within about +/- 1 days". Every locale now carries a dedicated
  // singular variant for the one-day consistent footnote (used when the
  // rounded/floored spread is exactly 1), with no {days} placeholder.
  it('defines a non-empty singular one-day consistent footnote in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const { cycleLength } = insightsMessages[locale].insights;

      expect(typeof cycleLength.footnoteConsistentOne).toBe('string');
      expect(cycleLength.footnoteConsistentOne.trim().length).toBeGreaterThan(0);
      expect(cycleLength.footnoteConsistentOne).not.toContain('{days}');
    }
  });

  it('never implies diagnosis or medical certainty in any cycle-length consistency copy', () => {
    for (const locale of supportedLocaleValues) {
      const { cycleLength } = insightsMessages[locale].insights;
      const allCopy = cycleLengthConsistencyLevels
        .flatMap((level) => [
          cycleLength[`subtitle${level}` as const],
          cycleLength[`footnote${level}` as const],
        ])
        .join(' ');

      expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
    }
  });

  it('the not-enough-data subtitle never claims regularity or a steady cycle (en)', () => {
    const { cycleLength } = insightsMessages.en.insights;

    expect(cycleLength.subtitleNotEnoughData.toLowerCase()).not.toContain('consistent');
    expect(cycleLength.subtitleNotEnoughData.toLowerCase()).not.toContain('regular');
  });
});

// LT-22: monthly briefing "so far" gating. `leadPastMonth` is the copy used
// when the briefing's month has already ended (see isBriefingForCurrentMonth
// in buildInsightsScreenModel.ts) -- it must exist in every locale and must
// interpolate the same {month}/{periodDays}/{symptomDays} placeholders as
// the current-month `lead`, but without any "so far"-equivalent phrasing
// that would wrongly imply the month is still in progress.
describe('insightsMessages.monthlyBriefing.leadPastMonth (LT-22 copy guard)', () => {
  it('defines a non-empty leadPastMonth string with the same placeholders as lead, in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const { monthlyBriefing } = insightsMessages[locale].insights;

      expect(typeof monthlyBriefing.leadPastMonth).toBe('string');
      expect(monthlyBriefing.leadPastMonth.trim().length).toBeGreaterThan(0);

      for (const placeholder of ['{month}', '{periodDays}', '{symptomDays}']) {
        expect(monthlyBriefing.lead).toContain(placeholder);
        expect(monthlyBriefing.leadPastMonth).toContain(placeholder);
      }
    }
  });

  it('leadPastMonth never says "so far" (en) -- a past month is not still in progress', () => {
    expect(insightsMessages.en.insights.monthlyBriefing.leadPastMonth).not.toMatch(/so far/i);
  });
});
