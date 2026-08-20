import { AppState, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { defaultAppPreferences } from '@/src/db/domainDefaults';

const mockGetPreferences = jest.fn();
const mockGetBillingSnapshot = jest.fn();
const mockSaveBillingSnapshot = jest.fn();
const mockGetProfile = jest.fn();
const mockGetPrivacyPreference = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockListByDateRange = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockWipeLocalData = jest.fn();
const mockIsBiometricLockArmed = jest.fn();
const mockClearBiometricLock = jest.fn();
const mockCancelAllReminderNotifications = jest.fn();
const mockReconcileReminderNotifications = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCanGoBack = jest.fn();
const mockRemoveAppStateListener = jest.fn();
const mockLoadPersistedPostOnboardingRoute = jest.fn();
const mockPersistPostOnboardingRoute = jest.fn();
const mockClearPostOnboardingRoute = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockRemoveNotificationSubscription = jest.fn();

let notificationResponseListener: ((response: unknown) => void) | null = null;

const mockRepositories = {
  appPreferences: {
    getPreferences: () => mockGetPreferences(),
  },
  billingSnapshot: {
    getSnapshot: () => mockGetBillingSnapshot(),
    saveSnapshot: (...args: unknown[]) => mockSaveBillingSnapshot(...args),
  },
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  privacyPreferences: {
    getPreference: () => mockGetPrivacyPreference(),
  },
  reminderPreferences: {
    getPreferences: () => mockGetReminderPreferences(),
  },
  dailyLogs: {
    listByDateRange: (...args: unknown[]) => mockListByDateRange(...args),
  },
  onboarding: {
    completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
  },
  reviewPromptState: {
    getState: async () => ({ onboardingCompletedAt: undefined }),
    seedOnboardingCompletion: async () => undefined,
  },
  localDataMaintenance: {
    wipeLocalData: () => mockWipeLocalData(),
  },
};

let mockPathname = '/today';
let mockGlobalSearchParams: {
  disableOnboarding?: string | string[];
} = {};
let latestAppShell: ReturnType<typeof useAppShell> | null = null;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => mockGlobalSearchParams,
  usePathname: () => mockPathname,
  useRouter: () => ({
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  isBiometricLockArmed: () => mockIsBiometricLockArmed(),
  clearBiometricLock: () => mockClearBiometricLock(),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  cancelAllLocalNotifications: () => mockCancelAllReminderNotifications(),
  reconcileReminderNotifications: (...args: unknown[]) =>
    mockReconcileReminderNotifications(...args),
  reconcileBillingReminderNotification: jest.fn(),
}));

jest.mock('@/src/features/app-shell/postOnboardingRouteStorage', () => ({
  loadPersistedPostOnboardingRoute: (...args: unknown[]) =>
    mockLoadPersistedPostOnboardingRoute(...args),
  persistPostOnboardingRoute: (...args: unknown[]) =>
    mockPersistPostOnboardingRoute(...args),
  clearPersistedPostOnboardingRoute: (...args: unknown[]) =>
    mockClearPostOnboardingRoute(...args),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-07-06',
}));

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) =>
    mockAddNotificationResponseReceivedListener(listener),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
}));

// eslint-disable-next-line import/first
import { AppShellProvider, useAppShell } from '@/src/features/app-shell/AppShellProvider';
// eslint-disable-next-line import/first
import { AppShellRouteGuard } from '@/src/features/app-shell/AppShellRouteGuard';
// eslint-disable-next-line import/first
import type { AppPreferences, PrivacyPreference, UserProfile } from '@/src/types/domain';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

const defaultHydrationPreferences: AppPreferences = {
  ...defaultAppPreferences,
  hasCompletedOnboarding: true,
};

const defaultHydrationProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: true,
  conditionTags: [],
  ttcTrackingPreferences: {
    sex: false,
    ovulationTest: false,
    cervicalMucus: false,
    basalBodyTemperature: false,
  },
};

const unlockedPrivacyPreference: PrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
};

const lockedPrivacyPreference: PrivacyPreference = {
  ...unlockedPrivacyPreference,
  biometricsEnabled: true,
};

const dailyLogTapResponse = {
  notification: {
    request: {
      identifier: 'reminder-daily-log',
      content: { title: 'Log today in Floriva', body: '', data: undefined },
    },
  },
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
};

// Routes to '/today' (not a calendar-day intent) — used to prove the guard
// consumes a notification-tagged '/today' the same way it consumes a
// calendar-day route, without disturbing the untagged PostOnboardingRoute
// '/today' handoff contract.
const fertileWindowTapResponse = {
  notification: {
    request: {
      identifier: 'reminder-fertile-window',
      content: { title: 'Floriva reminder', body: '', data: undefined },
    },
  },
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function prepareHydration(overrides: {
  preferences?: Partial<AppPreferences>;
  profile?: UserProfile | null;
  privacyPreference?: PrivacyPreference;
  biometricLockArmed?: boolean;
} = {}) {
  const preferences = createDeferred<AppPreferences>();
  const profile = createDeferred<UserProfile | null>();
  const privacyPreference = createDeferred<PrivacyPreference>();
  const biometricLockArmed = createDeferred<boolean>();

  mockGetPreferences.mockReturnValue(preferences.promise);
  mockGetProfile.mockReturnValue(profile.promise);
  mockGetPrivacyPreference.mockReturnValue(privacyPreference.promise);
  mockIsBiometricLockArmed.mockReturnValue(biometricLockArmed.promise);

  return {
    resolve: async () => {
      await act(async () => {
        preferences.resolve({
          ...defaultHydrationPreferences,
          ...overrides.preferences,
        });
        profile.resolve(overrides.profile ?? defaultHydrationProfile);
        privacyPreference.resolve(overrides.privacyPreference ?? unlockedPrivacyPreference);
        biometricLockArmed.resolve(overrides.biometricLockArmed ?? false);
        await Promise.resolve();
      });
    },
  };
}

function AppShellConsumer() {
  latestAppShell = useAppShell();

  return <Text>guard-probe</Text>;
}

function renderGuard() {
  return render(
    <AppShellProvider>
      <AppShellRouteGuard />
      <AppShellConsumer />
    </AppShellProvider>,
  );
}

function rerenderGuard(view: ReturnType<typeof render>) {
  view.rerender(
    <AppShellProvider>
      <AppShellRouteGuard />
      <AppShellConsumer />
    </AppShellProvider>,
  );
}

async function fireNotificationTap(response: unknown) {
  await act(async () => {
    notificationResponseListener?.(response);
    await Promise.resolve();
  });
}

describe('AppShellRouteGuard notification-tap routing', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockGetBillingSnapshot.mockReset();
    mockSaveBillingSnapshot.mockReset();
    mockGetProfile.mockReset();
    mockGetPrivacyPreference.mockReset();
    mockGetReminderPreferences.mockReset();
    mockListByDateRange.mockReset();
    mockCompleteOnboarding.mockReset();
    mockWipeLocalData.mockReset();
    mockIsBiometricLockArmed.mockReset();
    mockClearBiometricLock.mockReset();
    mockCancelAllReminderNotifications.mockReset();
    mockReconcileReminderNotifications.mockReset();
    mockReplace.mockReset();
    mockPush.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockRemoveAppStateListener.mockReset();
    mockLoadPersistedPostOnboardingRoute.mockReset();
    mockPersistPostOnboardingRoute.mockReset();
    mockClearPostOnboardingRoute.mockReset();
    mockAddNotificationResponseReceivedListener.mockReset();
    mockGetLastNotificationResponseAsync.mockReset();
    mockRemoveNotificationSubscription.mockReset();
    notificationResponseListener = null;
    mockPathname = '/today';
    mockGlobalSearchParams = {};
    latestAppShell = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => {
      return {
        remove: mockRemoveAppStateListener,
      } as ReturnType<typeof AppState.addEventListener>;
    });

    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'subscribed' });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue(null);
    mockPersistPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPostOnboardingRoute.mockResolvedValue(undefined);
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockAddNotificationResponseReceivedListener.mockImplementation(
      (listener: (response: unknown) => void) => {
        notificationResponseListener = listener;

        return { remove: mockRemoveNotificationSubscription };
      },
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('navigates an unlocked user to the calendar day when a live notification tap arrives', async () => {
    const hydration = prepareHydration();
    mockPathname = '/today';

    renderGuard();
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell?.isHydrated).toBe(true);
    });

    expect(mockPush).not.toHaveBeenCalled();

    await fireNotificationTap(dailyLogTapResponse);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-07-06');
    });

    // Consumed routes are cleared once the push is issued so later entry
    // resolutions cannot teleport the user back to a stale calendar day.
    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('routes a cold-start notification tap after the initial index redirect already landed on /today', async () => {
    const lastResponse = createDeferred<unknown>();
    mockGetLastNotificationResponseAsync.mockReturnValue(lastResponse.promise);
    const hydration = prepareHydration();
    mockPathname = '/today';

    renderGuard();
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell?.isHydrated).toBe(true);
    });

    // Startup is not delayed by the notification API: hydration completed and
    // no navigation happened while the last-response lookup is still pending.
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      lastResponse.resolve({
        notification: { request: { identifier: 'reminder-period-start' } },
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-07-06');
    });

    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });
  });

  it('defers a locked tap until unlock, then resolves the calendar day and clears it', async () => {
    const hydration = prepareHydration({
      privacyPreference: lockedPrivacyPreference,
      biometricLockArmed: true,
    });
    mockPathname = '/today';

    const view = renderGuard();
    await hydration.resolve();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/lock');
    });

    await fireNotificationTap(dailyLogTapResponse);

    // Deferred while locked: the pending route is parked, no navigation, no clear.
    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/calendar/day/2026-07-06');
    });
    expect(mockPush).not.toHaveBeenCalled();

    mockReplace.mockClear();
    mockPathname = '/lock';
    mockCanGoBack.mockReturnValue(false);

    act(() => {
      latestAppShell?.unlockApp();
    });

    // Post-unlock entry resolution honors the pending calendar day.
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/calendar/day/2026-07-06');
    });

    // Arrival on the calendar day consumes the route without a duplicate push.
    mockPathname = '/calendar/day/2026-07-06';
    await act(async () => {
      rerenderGuard(view);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not teleport back to the calendar day after the route was consumed', async () => {
    const hydration = prepareHydration();
    mockPathname = '/today';

    const view = renderGuard();
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell?.isHydrated).toBe(true);
    });

    await fireNotificationTap(dailyLogTapResponse);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-07-06');
    });

    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });

    mockPush.mockClear();
    mockReplace.mockClear();

    // A later navigation moment (modal close, settings visit, etc.) must not
    // resurrect the already-consumed calendar route.
    mockPathname = '/settings';
    await act(async () => {
      rerenderGuard(view);
      await Promise.resolve();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('consumes a pending calendar day for a formerly-unpaid user (paid gate retired)', async () => {
    mockGetBillingSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
      grandfatherTrialApplied: true,
    });
    const hydration = prepareHydration();
    mockPathname = '/today';

    renderGuard();
    await hydration.resolve();

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');

    await fireNotificationTap(dailyLogTapResponse);

    // Nothing gates the tap any more: the app is free, so the calendar day is
    // navigated to immediately instead of being parked behind a paywall.
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-07-06');
    });
  });

  it('keeps lock precedence when a tap arrives while locked on a non-lock path', async () => {
    const hydration = prepareHydration({
      privacyPreference: lockedPrivacyPreference,
      biometricLockArmed: true,
    });
    mockPathname = '/calendar';

    renderGuard();
    await hydration.resolve();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/lock');
    });

    mockReplace.mockClear();

    await fireNotificationTap(dailyLogTapResponse);

    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/calendar/day/2026-07-06');
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith('/calendar/day/2026-07-06');
  });

  describe("'/today' consumption (warm tap on a non-calendar-day reminder)", () => {
    it('pushes to /today when a live notification tap resolves there while the user is elsewhere', async () => {
      const hydration = prepareHydration();
      mockPathname = '/settings';

      renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(latestAppShell?.isHydrated).toBe(true);
      });

      expect(mockPush).not.toHaveBeenCalled();

      await fireNotificationTap(fertileWindowTapResponse);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/today');
      });

      // Consumed: cleared once pushed, same contract as calendar-day routes.
      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      });
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('does not push when the guard already resolved /today via some other path (arrival, not a fresh push)', async () => {
      const hydration = prepareHydration();
      mockPathname = '/today';

      renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(latestAppShell?.isHydrated).toBe(true);
      });

      await fireNotificationTap(fertileWindowTapResponse);

      // Already on '/today' when the tap resolves there: cleared without a
      // redundant push, mirroring the calendar-day "arrived some other way" case.
      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('defers a locked warm tap that resolves to /today until unlock', async () => {
      const hydration = prepareHydration({
        privacyPreference: lockedPrivacyPreference,
        biometricLockArmed: true,
      });
      mockPathname = '/settings';

      renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/lock');
      });

      await fireNotificationTap(fertileWindowTapResponse);

      // Deferred while locked: parked, not pushed, not cleared.
      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBe('/today');
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does NOT push an untagged /today PostOnboardingRoute handoff (only notification-tagged /today is force-navigated)', async () => {
      // Simulates the onboarding-completion handoff: pendingEntryRoute is
      // '/today' but it did NOT arrive from a notification tap, so
      // pendingEntryRouteSource stays unset. TodayScreen's own self-clear
      // contract (not the guard) is responsible for clearing this — the guard
      // must leave it alone to avoid a redundant/duplicate navigation on top
      // of completeOnboarding's own state update.
      mockLoadPersistedPostOnboardingRoute.mockResolvedValue('/today');
      const hydration = prepareHydration();
      mockPathname = '/settings';

      renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(latestAppShell?.isHydrated).toBe(true);
      });

      expect(latestAppShell?.state.pendingEntryRoute).toBe('/today');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('quick-log ?quick=period routes (usePathname strips search params)', () => {
    // expo-router's usePathname() never includes the query string, so after
    // navigating to '/calendar/day/D?quick=period' the guard re-runs with
    // pathname '/calendar/day/D'. These tests pin the arrival check to the
    // path portion — full-route equality would miss the arrival and re-push
    // the same screen before the async self-clear lands.
    const quickLogTapResponse = {
      notification: {
        request: {
          identifier: 'reminder-daily-log',
          content: { title: 'Log today in Floriva', body: '', data: undefined },
        },
      },
      actionIdentifier: 'quick-log-period',
    };

    it('pushes the query-bearing route exactly once for a live unlocked quick-action tap', async () => {
      const hydration = prepareHydration();
      mockPathname = '/today';

      const view = renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(latestAppShell?.isHydrated).toBe(true);
      });

      await fireNotificationTap(quickLogTapResponse);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-07-06?quick=period');
      });

      // Simulate arrival: pathname updates WITHOUT the query string. The
      // guard must treat this as arrival (clear, no second push), not as a
      // still-unvisited route.
      mockPathname = '/calendar/day/2026-07-06';
      await act(async () => {
        rerenderGuard(view);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      });
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('defers a locked quick-action tap, then clears on arrival without a duplicate push', async () => {
      const hydration = prepareHydration({
        privacyPreference: lockedPrivacyPreference,
        biometricLockArmed: true,
      });
      mockPathname = '/today';

      const view = renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/lock');
      });

      await fireNotificationTap(quickLogTapResponse);

      // Deferred while locked: parked, no navigation, no clear.
      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBe(
          '/calendar/day/2026-07-06?quick=period',
        );
      });
      expect(mockPush).not.toHaveBeenCalled();

      mockReplace.mockClear();
      mockPathname = '/lock';
      mockCanGoBack.mockReturnValue(false);

      act(() => {
        latestAppShell?.unlockApp();
      });

      // Post-unlock entry resolution honors the pending quick-log route, query
      // string included, so CalendarDayScreen receives the quick param.
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/calendar/day/2026-07-06?quick=period');
      });

      // Arrival: usePathname() reports the path WITHOUT '?quick=period'. The
      // guard must recognize this as the pending route's destination and just
      // clear — before the path-portion fix this re-pushed the same screen.
      mockPathname = '/calendar/day/2026-07-06';
      await act(async () => {
        rerenderGuard(view);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('clears without pushing when the index redirect already landed on the calendar day path', async () => {
      // Cold-start: the pending quick-log route is set while the app's index
      // redirect independently resolves to the calendar day. The guard's
      // first pass sees pathname already at the (query-stripped) destination
      // and must consume by clearing, not push a second copy.
      const lastResponse = createDeferred<unknown>();
      mockGetLastNotificationResponseAsync.mockReturnValue(lastResponse.promise);
      const hydration = prepareHydration();
      mockPathname = '/calendar/day/2026-07-06';

      renderGuard();
      await hydration.resolve();

      await waitFor(() => {
        expect(latestAppShell?.isHydrated).toBe(true);
      });

      await act(async () => {
        lastResponse.resolve(quickLogTapResponse);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
