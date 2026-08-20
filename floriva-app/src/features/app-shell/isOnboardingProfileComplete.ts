import type { UserProfile } from '@/src/types/domain';

export function isOnboardingProfileComplete(profile: UserProfile | null): profile is UserProfile {
  return Boolean(
    profile &&
      profile.cycleLengthDays &&
      profile.periodLengthDays &&
      profile.lastPeriodStartDate &&
      profile.goals.length >= 1 &&
      typeof profile.supportsIrregularCycles === 'boolean' &&
      Array.isArray(profile.conditionTags) &&
      profile.ttcTrackingPreferences &&
      typeof profile.ttcTrackingPreferences.sex === 'boolean' &&
      typeof profile.ttcTrackingPreferences.ovulationTest === 'boolean' &&
      typeof profile.ttcTrackingPreferences.cervicalMucus === 'boolean' &&
      typeof profile.ttcTrackingPreferences.basalBodyTemperature === 'boolean',
  );
}
