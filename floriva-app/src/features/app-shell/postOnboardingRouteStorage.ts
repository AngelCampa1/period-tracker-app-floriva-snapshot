import * as SecureStore from 'expo-secure-store';

import type { PostOnboardingRoute } from '@/src/types/domain';

const POST_ONBOARDING_ROUTE_STORAGE_KEY = 'floriva.post-onboarding-route.v1';

export async function loadPersistedPostOnboardingRoute() {
  try {
    const route = await SecureStore.getItemAsync(POST_ONBOARDING_ROUTE_STORAGE_KEY);

    return route === '/today' ||
      route === '/import' ||
      route === '/import/review' ||
      route === '/backup' ||
      route === '/backup/restore'
      ? route
      : null;
  } catch {
    return null;
  }
}

export async function persistPostOnboardingRoute(route: PostOnboardingRoute) {
  try {
    await SecureStore.setItemAsync(POST_ONBOARDING_ROUTE_STORAGE_KEY, route, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    return;
  }
}

export async function clearPersistedPostOnboardingRoute() {
  try {
    await SecureStore.deleteItemAsync(POST_ONBOARDING_ROUTE_STORAGE_KEY);
  } catch {
    return;
  }
}
