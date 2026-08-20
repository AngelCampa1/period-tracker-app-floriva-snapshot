import { useEffect, useState } from 'react';

import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
import type { InsightsScreenModel } from '@/src/features/insights/types';
import { useFocusRefreshVersion } from '@/src/lib/navigation/useOptionalFocusEffect';
import { useLocalization } from '@/src/localization/LocalizationProvider';

export function useInsightsModel(todayIso: string) {
  const { repositories } = useDatabase();
  const { resolvedLocale, t } = useLocalization();
  const [model, setModel] = useState<InsightsScreenModel>(() =>
    buildInsightsScreenModel({
      todayIso,
      profile: defaultUserProfile,
      logEntries: [],
      locale: resolvedLocale,
    }),
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  // Re-hydrate when the screen regains focus so insights reflect logs written
  // on other screens instead of staying stale until the next app relaunch.
  const focusRefreshVersion = useFocusRefreshVersion();

  useEffect(() => {
    let isCancelled = false;

    async function hydrateInsights() {
      try {
        // LT-06: the Insights card copy claims "Built from cycle history
        // stored on this device", but this hook used to hydrate only a
        // hardcoded [-120d, today] window via listByDateRange. The
        // prediction engine's own statistics window looks back up to
        // MAX_INTERVAL_WINDOW = 12 completed intervals (cycleStatistics.ts)
        // -- roughly 13 period starts, which for a typical ~28-45 day cycle
        // user is well past 120 days (13 * 45 ~= 585 days), so the 120-day
        // hydration window was starving the engine's own readout, not just
        // rounding it down.
        //
        // Rather than pick a new (still-arbitrary) window size, hydrate the
        // full stored history via listAll() -- the same unbounded read
        // PrivateTimelineScreen already uses. buildInsightsScreenModel's own
        // pure-array-transform cost was measured at <5ms for 341 rows of a
        // 12-month dataset (see buildPrivateTimelineModel.probe.longTenure
        // .test.ts, LT-10), and buildInsightsScreenModel does the same class
        // of work (array filters/reduces over DailyLogEntry[]), so this is
        // the simplest option that actually matches the "stored on this
        // device" claim rather than trading one magic number for another.
        const [profile, logEntries, appPreferences] = await Promise.all([
          repositories.userProfile.getProfile(),
          repositories.dailyLogs.listAll(),
          repositories.appPreferences?.getPreferences?.() ?? Promise.resolve(defaultAppPreferences),
        ]);

        if (isCancelled) {
          return;
        }

        setModel(
          buildInsightsScreenModel({
            todayIso,
            profile: profile ?? defaultUserProfile,
            logEntries,
            locale: resolvedLocale,
            showFertilityEstimates: appPreferences.showFertilityEstimates ?? true,
            dismissedAnomalyIds: appPreferences.dismissedAnomalyIds ?? [],
          }),
        );
      } catch {
        if (!isCancelled) {
          setHydrationError(t('insights.error.load'));
        }
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateInsights();

    return () => {
      isCancelled = true;
    };
  }, [
    focusRefreshVersion,
    refreshVersion,
    repositories.appPreferences,
    repositories.dailyLogs,
    repositories.userProfile,
    resolvedLocale,
    t,
    todayIso,
  ]);

  return {
    hydrationError,
    isHydrating,
    model,
    retry: () => {
      setHydrationError(null);
      setIsHydrating(true);
      setRefreshVersion((currentVersion) => currentVersion + 1);
    },
  };
}
