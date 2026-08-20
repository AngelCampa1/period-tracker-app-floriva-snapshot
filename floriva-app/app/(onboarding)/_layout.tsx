import { Stack } from 'expo-router';

import {
  createStackMotionOptions,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';
import { OnboardingRouteGuard } from '@/src/features/onboarding/OnboardingRouteGuard';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';

export default function OnboardingLayout() {
  const florivaMotion = useFlorivaMotion();

  return (
    <OnboardingProvider persistDraft>
      <OnboardingRouteGuard />
      <Stack
        screenOptions={createStackMotionOptions(
          florivaMotion.reducedMotionEnabled,
          'onboarding',
        )}
      />
    </OnboardingProvider>
  );
}
