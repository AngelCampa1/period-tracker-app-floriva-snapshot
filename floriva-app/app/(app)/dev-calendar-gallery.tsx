import { Redirect } from 'expo-router';

import { DevCalendarGalleryScreen } from '@/src/features/calendar/screens/DevCalendarGalleryScreen';

/**
 * Dev-only route for the Phase 2b calendar redesign gallery. There is no
 * navigation entry anywhere -- reach it via the deep link
 * floriva:///dev-calendar-gallery. In production bundles `__DEV__` is
 * compile-time false, so this route statically redirects to the calendar
 * tab (same guard style as the app's other dev-only affordances, e.g. the
 * disableOnboarding bypass in AppShellRouteGuard).
 */
export default function DevCalendarGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/calendar" />;
  }

  return <DevCalendarGalleryScreen />;
}
