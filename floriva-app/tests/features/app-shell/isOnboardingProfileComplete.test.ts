import type { UserProfile } from '@/src/types/domain';
import { isOnboardingProfileComplete } from '@/src/features/app-shell/isOnboardingProfileComplete';

describe('isOnboardingProfileComplete', () => {
  it('requires the Wave 3 onboarding seed fields', () => {
    const incompleteProfile: UserProfile = {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
    };

    expect(isOnboardingProfileComplete(incompleteProfile)).toBe(false);
  });

  it('accepts a profile with the required cycle seed inputs', () => {
    const completeProfile = {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    } as UserProfile;

    expect(isOnboardingProfileComplete(completeProfile)).toBe(true);
  });

  it('rejects a stored profile shape that is missing TTC tracking preferences', () => {
    const legacyShape = {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos'],
    } as UserProfile;

    expect(isOnboardingProfileComplete(legacyShape)).toBe(false);
  });

  it('returns false when no profile is stored yet', () => {
    expect(isOnboardingProfileComplete(null)).toBe(false);
  });

  it('requires the irregular-cycle toggle and conditionTags field to be present', () => {
    const missingShape = {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period'],
    } as UserProfile;

    expect(isOnboardingProfileComplete(missingShape)).toBe(false);
  });
});
