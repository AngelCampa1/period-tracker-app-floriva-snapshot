import { getLocalTodayLogDate } from '@/src/features/logging/date';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves the "today" that anchors the QA dev-launch fixtures (rich-history,
 * tenure, import-ready, backup-ready).
 *
 * - Interactive dev launches use the real runtime today (RJ-2) so seeded data
 *   always looks current when the build is actually opened.
 * - Detox e2e runs must be DETERMINISTIC — a wall-clock-anchored fixture would
 *   make date-embedded testIDs and date-derived copy shift every day the suite
 *   runs. Setting `EXPO_PUBLIC_QA_FIXTURE_TODAY` (a `YYYY-MM-DD` string, baked
 *   into the bundle by the Detox Metro launch) pins the fixture clock to a fixed
 *   reference so those references stay stable.
 *
 * Dev/QA-only, mirroring the existing `EXPO_PUBLIC_DEV_LAUNCH_PRESET` harness.
 * A malformed pin is ignored so a typo can never silently corrupt seeded dates.
 */
export function resolveQaFixtureToday(): string {
  const pinned = process.env.EXPO_PUBLIC_QA_FIXTURE_TODAY?.trim();
  if (pinned && ISO_DATE_PATTERN.test(pinned)) {
    return pinned;
  }
  return getLocalTodayLogDate();
}
