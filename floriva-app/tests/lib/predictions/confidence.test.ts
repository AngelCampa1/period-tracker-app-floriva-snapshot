/**
 * Focused unit coverage for `resolveConfidence` / `resolveLimitations`
 * (src/lib/predictions/confidence.ts). These two functions are exercised
 * indirectly by `goldenCharacterization.test.ts`, but that file pins whole
 * `PredictionResult` shapes -- it's a weak substitute for direct coverage of
 * the exhaustive code-emission logic in isolation, so this file tests them
 * directly against every branch.
 */

import { resolveConfidence, resolveLimitations } from '@/src/lib/predictions/confidence';
import type { UserProfile } from '@/src/types/domain';

const BASE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

describe('resolveConfidence', () => {
  it('returns medium with onboarding-seed when historySource is onboarding-seed, regardless of periodStartCount', () => {
    expect(resolveConfidence(BASE_PROFILE, 'onboarding-seed', 0)).toEqual({
      level: 'medium',
      reasonCodes: ['onboarding-seed'],
    });
    // onboarding-seed short-circuits before periodStartCount is even
    // consulted -- a high count should not change the outcome.
    expect(resolveConfidence(BASE_PROFILE, 'onboarding-seed', 10)).toEqual({
      level: 'medium',
      reasonCodes: ['onboarding-seed'],
    });
  });

  it('returns low with limited-bleeding-history when fewer than 2 starts are logged', () => {
    expect(resolveConfidence(BASE_PROFILE, 'bleeding-history', 0)).toEqual({
      level: 'low',
      reasonCodes: ['limited-bleeding-history'],
    });
    expect(resolveConfidence(BASE_PROFILE, 'bleeding-history', 1)).toEqual({
      level: 'low',
      reasonCodes: ['limited-bleeding-history'],
    });
  });

  it('returns medium with irregular-cycle-support-enabled when the profile supports irregular cycles, even with >=2 starts', () => {
    const irregularProfile: UserProfile = { ...BASE_PROFILE, supportsIrregularCycles: true };

    expect(resolveConfidence(irregularProfile, 'bleeding-history', 2)).toEqual({
      level: 'medium',
      reasonCodes: ['irregular-cycle-support-enabled'],
    });
    // Even with a large count, irregular-cycle support caps the level at
    // medium -- it never reaches high.
    expect(resolveConfidence(irregularProfile, 'bleeding-history', 10)).toEqual({
      level: 'medium',
      reasonCodes: ['irregular-cycle-support-enabled'],
    });
  });

  it('returns medium with one-observed-interval for exactly 2 starts (a single interval)', () => {
    expect(resolveConfidence(BASE_PROFILE, 'bleeding-history', 2)).toEqual({
      level: 'medium',
      reasonCodes: ['one-observed-interval'],
    });
  });

  it('returns high with consistent-recent-bleeding-history for 3+ starts (at least 2 intervals)', () => {
    expect(resolveConfidence(BASE_PROFILE, 'bleeding-history', 3)).toEqual({
      level: 'high',
      reasonCodes: ['consistent-recent-bleeding-history'],
    });
    expect(resolveConfidence(BASE_PROFILE, 'bleeding-history', 8)).toEqual({
      level: 'high',
      reasonCodes: ['consistent-recent-bleeding-history'],
    });
  });

  it('always returns exactly one reason code', () => {
    const cases: [UserProfile, 'bleeding-history' | 'onboarding-seed', number][] = [
      [BASE_PROFILE, 'onboarding-seed', 0],
      [BASE_PROFILE, 'bleeding-history', 1],
      [{ ...BASE_PROFILE, supportsIrregularCycles: true }, 'bleeding-history', 2],
      [BASE_PROFILE, 'bleeding-history', 2],
      [BASE_PROFILE, 'bleeding-history', 5],
    ];

    for (const [profile, historySource, count] of cases) {
      expect(resolveConfidence(profile, historySource, count).reasonCodes).toHaveLength(1);
    }
  });
});

describe('resolveLimitations', () => {
  it('always includes the two base limitation codes', () => {
    expect(resolveLimitations(BASE_PROFILE, 'bleeding-history', 5)).toEqual([
      'on-device',
      'not-medical-certainty',
    ]);
  });

  it('adds onboarding-seed-active when historySource is onboarding-seed', () => {
    expect(resolveLimitations(BASE_PROFILE, 'onboarding-seed', 0)).toEqual([
      'on-device',
      'not-medical-certainty',
      'onboarding-seed-active',
    ]);
  });

  it('adds limited-history-shift only when historySource is bleeding-history with fewer than 2 starts', () => {
    expect(resolveLimitations(BASE_PROFILE, 'bleeding-history', 1)).toEqual([
      'on-device',
      'not-medical-certainty',
      'limited-history-shift',
    ]);
    // Onboarding-seed with a low count does NOT add limited-history-shift --
    // that code is scoped to real bleeding history only.
    expect(resolveLimitations(BASE_PROFILE, 'onboarding-seed', 1)).toEqual([
      'on-device',
      'not-medical-certainty',
      'onboarding-seed-active',
    ]);
  });

  it('adds irregular-cycle-broader when the profile supports irregular cycles', () => {
    const irregularProfile: UserProfile = { ...BASE_PROFILE, supportsIrregularCycles: true };

    expect(resolveLimitations(irregularProfile, 'bleeding-history', 5)).toEqual([
      'on-device',
      'not-medical-certainty',
      'irregular-cycle-broader',
    ]);
  });

  it('can stack onboarding-seed-active-equivalent limited-history-shift and irregular-cycle-broader together', () => {
    const irregularProfile: UserProfile = { ...BASE_PROFILE, supportsIrregularCycles: true };

    expect(resolveLimitations(irregularProfile, 'bleeding-history', 1)).toEqual([
      'on-device',
      'not-medical-certainty',
      'limited-history-shift',
      'irregular-cycle-broader',
    ]);
  });

  it('returns a fresh array each call (no shared mutable state across calls)', () => {
    const first = resolveLimitations(BASE_PROFILE, 'onboarding-seed', 0);
    first.push('projected-forward');

    const second = resolveLimitations(BASE_PROFILE, 'onboarding-seed', 0);

    expect(second).toEqual(['on-device', 'not-medical-certainty', 'onboarding-seed-active']);
  });
});
