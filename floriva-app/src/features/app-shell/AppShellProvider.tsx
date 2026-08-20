import {
  useCallback,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  defaultAppPreferences,
  defaultBillingSnapshot,
  defaultPrivacyPreference,
  defaultUserProfile,
} from '@/src/db/domainDefaults';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { createDefaultAppShellState } from '@/src/features/app-shell/defaults';
import { isOnboardingProfileComplete } from '@/src/features/app-shell/isOnboardingProfileComplete';
import {
  clearPersistedPostOnboardingRoute,
  loadPersistedPostOnboardingRoute,
  persistPostOnboardingRoute,
} from '@/src/features/app-shell/postOnboardingRouteStorage';
import { shouldRelockAfterResume } from '@/src/features/app-shell/shouldRelockAfterResume';
import { useNotificationSetup } from '@/src/features/app-shell/useNotificationSetup';
import { buildGrandfatheredBillingSnapshot } from '@/src/features/billing/grandfatherTrial';
import { normalizeBillingSnapshot } from '@/src/features/billing/model';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { clearPersistedOnboardingDraft } from '@/src/features/onboarding/draftStorage';
import {
  cancelAllLocalNotifications,
  reconcileBillingReminderNotification,
  reconcileReminderNotifications,
} from '@/src/lib/notifications/reminderScheduler';
import { clearBiometricLock, isBiometricLockArmed } from '@/src/lib/security/biometricLock';
import { addDays } from '@/src/lib/predictions/dateMath';
import { resolveCurrentLocale } from '@/src/localization/locale';
import { notifyLocalePreferenceChanged } from '@/src/localization/localePreferenceSync';
import { notifyThemePreferenceChanged } from '@/src/theme/themePreferenceSync';
import type {
  AppPreferences,
  AppShellState,
  BillingSnapshot,
  PendingEntryRoute,
  PostOnboardingRoute,
  PrivacyPreference,
  UserProfile,
} from '@/src/types/domain';

type AppShellContextValue = {
  isHydrated: boolean;
  state: AppShellState;
  privacyPreference: PrivacyPreference;
  rehydrateFromStorage: () => Promise<void>;
  savePrivacyPreference: (preference: PrivacyPreference) => Promise<void>;
  completeOnboarding: (
    profile: UserProfile,
    preferenceOverrides?: Partial<AppPreferences>,
    postOnboardingRoute?: PostOnboardingRoute,
  ) => Promise<void>;
  clearPendingEntryRoute: () => Promise<void>;
  setPendingEntryRoute: (route: PendingEntryRoute) => void;
  applyBillingSnapshot: (snapshot: BillingSnapshot) => void;
  lockApp: () => void;
  unlockApp: () => void;
  deleteAllData: () => Promise<void>;
  refreshReminderSchedules: () => Promise<void>;
  resetAppShell: () => Promise<void>;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

function resolveMainAppReady({
  hasCompletedOnboarding,
  isLocked,
}: Pick<AppShellState, 'hasCompletedOnboarding' | 'isLocked'>) {
  return hasCompletedOnboarding && !isLocked;
}

async function runBestEffortCleanup(steps: (() => Promise<unknown>)[]) {
  for (const step of steps) {
    try {
      await step();
    } catch {
      // Keep the shell aligned with the committed state when non-critical cleanup fails.
    }
  }
}

export function AppShellProvider({ children }: PropsWithChildren) {
  const { repositories } = useDatabase();
  const appPreferencesRepository = repositories.appPreferences;
  const billingSnapshotRepository = repositories.billingSnapshot;
  const userProfileRepository = repositories.userProfile;
  const privacyPreferencesRepository = repositories.privacyPreferences;
  const reviewPromptStateRepository = repositories.reviewPromptState;
  const reminderPreferencesRepository = repositories.reminderPreferences;
  const dailyLogRepository = repositories.dailyLogs;
  const onboardingRepository = repositories.onboarding;
  const localDataMaintenanceRepository = repositories.localDataMaintenance;
  const [state, setState] = useState<AppShellState>(createDefaultAppShellState());
  const [preferences, setPreferences] = useState(defaultAppPreferences);
  const [privacyPreference, setPrivacyPreference] =
    useState<PrivacyPreference>(defaultPrivacyPreference);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<Error | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);

  const hydrateFromStorage = useCallback(async () => {
    const [
      nextPreferences,
      billingSnapshot,
      profile,
      persistedPrivacyPreference,
      biometricLockArmed,
      pendingEntryRoute,
      reviewPromptState,
    ] = await Promise.all([
      appPreferencesRepository.getPreferences(),
      billingSnapshotRepository.getSnapshot(),
      userProfileRepository.getProfile(),
      privacyPreferencesRepository.getPreference(),
      isBiometricLockArmed(),
      loadPersistedPostOnboardingRoute(),
      reviewPromptStateRepository.getState(),
    ]);

    const hasCompletedOnboarding =
      nextPreferences.hasCompletedOnboarding && isOnboardingProfileComplete(profile);
    const shouldStartLocked =
      hasCompletedOnboarding &&
      persistedPrivacyPreference.biometricsEnabled &&
      biometricLockArmed;

    const grandfathered = buildGrandfatheredBillingSnapshot({
      snapshot: billingSnapshot,
      hasCompletedOnboarding,
      onboardingCompletedAt: reviewPromptState?.onboardingCompletedAt,
      earliestCreatedAt: undefined,
      now: new Date(Date.now()),
    });
    const normalizedBillingSnapshot = normalizeBillingSnapshot(grandfathered.snapshot);
    const billingAccessState =
      normalizedBillingSnapshot.accessState ?? defaultBillingSnapshot.accessState;

    const billingSnapshotChanged =
      grandfathered.changed ||
      normalizedBillingSnapshot.accessState !== billingSnapshot.accessState ||
      normalizedBillingSnapshot.grandfatherTrialApplied !== billingSnapshot.grandfatherTrialApplied;

    if (billingSnapshotChanged) {
      await billingSnapshotRepository.saveSnapshot(normalizedBillingSnapshot);
    }

    await reconcileBillingReminderNotification({ snapshot: normalizedBillingSnapshot });

    setPreferences(nextPreferences);
    setPrivacyPreference(persistedPrivacyPreference);
    setState({
      hasCompletedOnboarding,
      isLocked: shouldStartLocked,
      billingAccessState,
      mainAppReady: resolveMainAppReady({
        hasCompletedOnboarding,
        isLocked: shouldStartLocked,
      }),
      pendingEntryRoute:
        hasCompletedOnboarding && !shouldStartLocked ? pendingEntryRoute ?? undefined : undefined,
    });
    setIsHydrated(true);
    notifyThemePreferenceChanged();
  }, [
    appPreferencesRepository,
    billingSnapshotRepository,
    privacyPreferencesRepository,
    reviewPromptStateRepository,
    userProfileRepository,
  ]);

  async function refreshReminderSchedules() {
    const todayIso = getLocalTodayLogDate();
    const [profile, logEntries, reminderPreferences, locale] = await Promise.all([
      userProfileRepository.getProfile(),
      dailyLogRepository.listByDateRange(addDays(todayIso, -365), todayIso),
      reminderPreferencesRepository.getPreferences(),
      resolveCurrentLocale(appPreferencesRepository),
    ]);

    await reconcileReminderNotifications({
      todayIso,
      profile: profile ?? defaultUserProfile,
      logEntries,
      preferences: reminderPreferences,
      locale,
    });
  }

  async function deleteAllData() {
    await localDataMaintenanceRepository.wipeLocalData();
    let reminderCleanupError: unknown;

    try {
      await cancelAllLocalNotifications();
    } catch (error) {
      reminderCleanupError = error;
    }

    await runBestEffortCleanup([
      () => clearBiometricLock(),
      () => clearPersistedPostOnboardingRoute(),
      () => clearPersistedOnboardingDraft(),
    ]);

    setPreferences(defaultAppPreferences);
    setPrivacyPreference(defaultPrivacyPreference);
    setState(createDefaultAppShellState());
    setIsHydrated(true);
    notifyLocalePreferenceChanged();
    notifyThemePreferenceChanged();

    if (reminderCleanupError) {
      throw reminderCleanupError;
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function hydrateFromRepositories() {
      try {
        await hydrateFromStorage();

        if (isCancelled) {
          return;
        }
      } catch (error) {
        if (!isCancelled) {
          setHydrationError(
            error instanceof Error ? error : new Error('App shell hydration failed'),
          );
        }
      }
    }

    hydrateFromRepositories();

    return () => {
      isCancelled = true;
    };
  }, [
    hydrateFromStorage,
  ]);

  // Notification category registration, live-tap routing, and cold-start
  // launch check all live in this hook — see useNotificationSetup.ts for the
  // full rationale (extracted verbatim out of this provider, no behavior
  // change).
  useNotificationSetup({
    repositories: { appPreferences: appPreferencesRepository },
    isHydrated,
    onNotificationRoute: (route, source) => {
      setState((current) => ({
        ...current,
        pendingEntryRoute: route,
        pendingEntryRouteSource: source,
      }));
    },
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
        return;
      }

      if (
        nextState === 'active' &&
        shouldRelockAfterResume({
          biometricsEnabled: privacyPreference.biometricsEnabled,
          relockAfterSeconds: privacyPreference.relockAfterSeconds,
          backgroundedAt: backgroundedAtRef.current,
          resumedAt: Date.now(),
        })
      ) {
        setState((current) => ({
          ...current,
          isLocked: true,
          mainAppReady: false,
        }));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [privacyPreference.biometricsEnabled, privacyPreference.relockAfterSeconds]);

  if (hydrationError) {
    throw hydrationError;
  }

  function syncCompletedOnboardingState(
    nextPreferences: AppPreferences,
    postOnboardingRoute: PostOnboardingRoute,
  ) {
    setPreferences(nextPreferences);
    setState({
      hasCompletedOnboarding: true,
      isLocked: false,
      billingAccessState: state.billingAccessState,
      mainAppReady: resolveMainAppReady({
        hasCompletedOnboarding: true,
        isLocked: false,
      }),
      pendingEntryRoute: postOnboardingRoute,
    });
    setIsHydrated(true);
    notifyThemePreferenceChanged();
  }

  const value: AppShellContextValue = {
    isHydrated,
    state,
    privacyPreference,
    rehydrateFromStorage: hydrateFromStorage,
    savePrivacyPreference: async (nextPrivacyPreference) => {
      await privacyPreferencesRepository.savePreference(nextPrivacyPreference);

      if (!nextPrivacyPreference.biometricsEnabled) {
        await clearBiometricLock();
      }

      setPrivacyPreference(nextPrivacyPreference);
    },
    completeOnboarding: async (
      profile,
      preferenceOverrides = {},
      postOnboardingRoute = '/today',
    ) => {
      if (!isOnboardingProfileComplete(profile)) {
        throw new Error('Onboarding profile is incomplete');
      }

      const nextPreferences = {
        ...preferences,
        ...preferenceOverrides,
        hasCompletedOnboarding: true,
      };

      await persistPostOnboardingRoute(postOnboardingRoute);

      let didCommitOnboarding = false;

      try {
        await onboardingRepository.completeOnboarding(profile, nextPreferences);
        didCommitOnboarding = true;
        await clearPersistedOnboardingDraft();
      } catch (error) {
        if (!didCommitOnboarding) {
          await runBestEffortCleanup([() => clearPersistedPostOnboardingRoute()]);
        } else {
          syncCompletedOnboardingState(nextPreferences, postOnboardingRoute);
        }

        throw error;
      }

      await runBestEffortCleanup([
        () => reviewPromptStateRepository.seedOnboardingCompletion(new Date().toISOString()),
      ]);

      syncCompletedOnboardingState(nextPreferences, postOnboardingRoute);
    },
    clearPendingEntryRoute: async () => {
      await clearPersistedPostOnboardingRoute();

      setState((current) => ({
        ...current,
        pendingEntryRoute: undefined,
        pendingEntryRouteSource: undefined,
      }));
    },
    setPendingEntryRoute: (route) => {
      setState((current) => ({
        ...current,
        pendingEntryRoute: route,
        pendingEntryRouteSource: undefined,
      }));
    },
    applyBillingSnapshot: (snapshot) => {
      const normalizedSnapshot = normalizeBillingSnapshot(snapshot);

      setState((current) => ({
        ...current,
        billingAccessState: normalizedSnapshot.accessState,
        mainAppReady: resolveMainAppReady({
          hasCompletedOnboarding: current.hasCompletedOnboarding,
          isLocked: current.isLocked,
        }),
      }));
    },
    lockApp: () => {
      setState((current) => ({
        ...current,
        isLocked: true,
        mainAppReady: false,
      }));
    },
    unlockApp: () => {
      setState((current) => ({
        ...current,
        isLocked: false,
        mainAppReady: resolveMainAppReady({
          hasCompletedOnboarding: current.hasCompletedOnboarding,
          isLocked: false,
        }),
      }));
    },
    deleteAllData,
    refreshReminderSchedules,
    resetAppShell: deleteAllData,
  };

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }

  return context;
}
