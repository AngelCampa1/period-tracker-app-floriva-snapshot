import { useRouter } from 'expo-router';

import { TtcExpectationsScreen } from '@/src/features/onboarding/screens/TtcExpectationsScreen';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile } from '@/src/db/domainDefaults';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import type { OnboardingDraft } from '@/src/features/onboarding/model';
import type { TrackingGoal, UserProfile } from '@/src/types/domain';

function buildUpdatedTtcProfile(
  currentProfile: UserProfile | null,
  draft: OnboardingDraft,
): UserProfile {
  const baseProfile = currentProfile ?? defaultUserProfile;
  const goals: TrackingGoal[] = baseProfile.goals.includes('trying-to-conceive')
    ? baseProfile.goals
    : [...baseProfile.goals, 'trying-to-conceive'];

  return {
    ...baseProfile,
    goals: goals.length > 0 ? goals : ['period', 'trying-to-conceive'],
    ttcTrackingPreferences: draft.ttcTrackingPreferences,
  };
}

export default function SettingsTtcExpectationsRoute() {
  const router = useRouter();
  const { repositories } = useDatabase();
  const { draft } = useOnboarding();

  return (
    <TtcExpectationsScreen
      continueLabel="Save changes"
      onContinue={async () => {
        try {
          const currentProfile = await repositories.userProfile.getProfile();

          await repositories.userProfile.saveProfile(
            buildUpdatedTtcProfile(currentProfile, draft),
          );
          router.replace('/settings');
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error('Unable to save trying-to-conceive setup.');
        }
      }}
    />
  );
}
