import { useEffect } from 'react';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';

import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { resolveOnboardingGuardRedirect } from '@/src/features/onboarding/model';

export function OnboardingRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { draft } = useOnboarding();

  useEffect(() => {
    const redirectTarget = resolveOnboardingGuardRedirect(pathname, draft);

    if (redirectTarget && redirectTarget !== pathname) {
      router.replace(redirectTarget as Href);
    }
  }, [draft, pathname, router]);

  return null;
}
