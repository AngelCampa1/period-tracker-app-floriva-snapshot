import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { fallbackLocale } from '@/src/localization/config';
import { LocalizationContext, type LocalizationContextValue } from '@/src/localization/localizationContext';
import { readPersistedLocalePreference, resolveLocalePreference } from '@/src/localization/locale';
import {
  notifyLocalePreferenceChanged,
  subscribeToLocalePreferenceChanges,
} from '@/src/localization/localePreferenceSync';
import { translate } from '@/src/localization/translations';
import type { LocalePreference } from '@/src/types/domain';

export { useLocalization } from '@/src/localization/localizationContext';

export function LocalizationProvider({ children }: PropsWithChildren) {
  const { repositories } = useDatabase();
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(
    defaultAppPreferences.localePreference ?? 'system',
  );
  const [isHydrated, setIsHydrated] = useState(false);

  const hydrateLocalePreference = useCallback(async () => {
    const nextLocalePreference = await readPersistedLocalePreference(repositories.appPreferences);

    setLocalePreferenceState(nextLocalePreference);
    setIsHydrated(true);
  }, [repositories.appPreferences]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateIfActive() {
      const nextLocalePreference = await readPersistedLocalePreference(
        repositories.appPreferences,
      );

      if (isCancelled) {
        return;
      }

      setLocalePreferenceState(nextLocalePreference);
      setIsHydrated(true);
    }

    void hydrateIfActive();

    return () => {
      isCancelled = true;
    };
  }, [repositories.appPreferences]);

  useEffect(() => {
    return subscribeToLocalePreferenceChanges(() => {
      void hydrateLocalePreference();
    });
  }, [hydrateLocalePreference]);

  const setLocalePreference = useCallback(
    async (nextPreference: LocalePreference) => {
      const preferences = await repositories.appPreferences.getPreferences();

      await repositories.appPreferences.savePreferences({
        ...preferences,
        localePreference: nextPreference,
      });

      setLocalePreferenceState(nextPreference);
      setIsHydrated(true);
      notifyLocalePreferenceChanged();
    },
    [repositories.appPreferences],
  );

  const resolvedLocale = useMemo(
    () => resolveLocalePreference(localePreference) ?? fallbackLocale,
    [localePreference],
  );

  const value = useMemo<LocalizationContextValue>(
    () => ({
      isHydrated,
      localePreference,
      resolvedLocale,
      setLocalePreference,
      t: (key, params) => translate(resolvedLocale, key, params),
    }),
    [isHydrated, localePreference, resolvedLocale, setLocalePreference],
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}
