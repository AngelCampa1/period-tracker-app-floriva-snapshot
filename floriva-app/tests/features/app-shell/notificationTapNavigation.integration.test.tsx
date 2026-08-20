import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

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
const mockLoadPersistedPostOnboardingRoute = jest.fn();
const mockPersistPostOnboardingRoute = jest.fn();
const mockClearPostOnboardingRoute = jest.fn();
const mockClearPersistedOnboardingDraft = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockRemoveNotificationSubscription = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCanGoBack = jest.fn();

let notificationResponseListener: ((response: unknown) => void) | null = null;
let mockPathname = '/today';
let mockGlobalSearchParams: { disableOnboarding?: string | string[] } = {};

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
    savePreference: jest.fn(),
  },
  reminderPreferences: {
    getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
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

jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => mockGlobalSearchParams,
  useLocalSearchParams: () => ({}),
  usePathname: () => mockPathname,
  useRouter: () => ({
    back: jest.fn(),
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
  persistPostOnboardingRoute: (...args: unknown[]) => mockPersistPostOnboardingRoute(...args),
  clearPersistedPostOnboardingRoute: (...args: unknown[]) => mockClearPostOnboardingRoute(...args),
}));

jest.mock('@/src/features/onboarding/draftStorage', () => ({
  clearPersistedOnboardingDraft: (...args: unknown[]) =>
    mockClearPersistedOnboardingDraft(...args),
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

jest.mock('@/src/features/logging/screens/TodayLoggingScreen', () => ({
  TodayLoggingCard: () => {
    const { Text: RNText } = require('react-native');

    return <RNText>Mock logging card</RNText>;
  },
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { AppShellProvider, useAppShell } from '@/src/features/app-shell/AppShellProvider';
// eslint-disable-next-line import/first
import { AppShellRouteGuard } from '@/src/features/app-shell/AppShellRouteGuard';
// eslint-disable-next-line import/first
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';
// eslint-disable-next-line import/first
import { CalendarDayScreen } from '@/src/features/calendar/screens/CalendarDayScreen';
// eslint-disable-next-line import/first
import type { AppPreferences, PrivacyPreference, UserProfile } from '@/src/types/domain';

const TODAY_ISO = '2026-07-06';
const CALENDAR_DAY_ROUTE = '/calendar/day/2026-07-06';

let latestAppShell: ReturnType<typeof useAppShell> | null = null;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
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

const defaultHydrationPreferences: AppPreferences = {
  ...defaultAppPreferences,
  hasCompletedOnboarding: true,
};

const unlockedPrivacyPreference: PrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
};

const completedProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-06-01',
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

type HydrationOverrides = {
  preferences?: Partial<AppPreferences>;
};

function prepareHydration(overrides: HydrationOverrides = {}) {
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
        profile.resolve(completedProfile);
        privacyPreference.resolve(unlockedPrivacyPreference);
        biometricLockArmed.resolve(false);
        await Promise.resolve();
      });
    },
  };
}

function AppShellConsumer() {
  const appShell = useAppShell();
  latestAppShell = appShell;

  return (
    <>
      <Text>hydrated:{String(appShell.isHydrated)}</Text>
      <Text>pendingEntryRoute:{String(appShell.state.pendingEntryRoute)}</Text>
    </>
  );
}

function reminderResponse(identifier: string) {
  return {
    notification: {
      request: {
        identifier,
        content: { data: null },
      },
    },
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  };
}

async function fireNotificationTap(identifier: string) {
  await waitFor(() => {
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
  });

  await act(async () => {
    notificationResponseListener?.(reminderResponse(identifier));
    await Promise.resolve();
  });
}

describe('notification tap navigation (guard + provider + calendar day integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    notificationResponseListener = null;
    latestAppShell = null;
    mockPathname = '/today';
    mockGlobalSearchParams = {};

    mockLoadPersistedPostOnboardingRoute.mockResolvedValue(null);
    mockPersistPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPersistedOnboardingDraft.mockResolvedValue(undefined);
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'subscribed' });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);
    mockReconcileReminderNotifications.mockResolvedValue([]);
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockCanGoBack.mockReturnValue(false);

    mockAddNotificationResponseReceivedListener.mockImplementation((listener) => {
      notificationResponseListener = listener;

      return { remove: mockRemoveNotificationSubscription };
    });

    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      () =>
        ({
          remove: jest.fn(),
        }) as unknown as ReturnType<typeof AppState.addEventListener>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lands on the calendar day end-to-end and a later modal-close entry resolution does not teleport back', async () => {
    const hydration = prepareHydration();
    mockPathname = '/today';

    const view = render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await fireNotificationTap('reminder-daily-log');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(CALENDAR_DAY_ROUTE);
    });

    // Arrival: the router lands on the calendar day and the real screen mounts.
    mockPathname = CALENDAR_DAY_ROUTE;
    await act(async () => {
      view.rerender(
        <AppShellProvider>
          <AppShellRouteGuard />
          <AppShellConsumer />
          <CalendarDayScreen selectedDate={TODAY_ISO} />
        </AppShellProvider>,
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:undefined')).toBeTruthy();
    });

    // The exact computation app/modal.tsx and app/+not-found.tsx run when they
    // dismiss without history must no longer resolve to the stale calendar day.
    expect(latestAppShell).not.toBeNull();
    expect(resolveAppEntry(latestAppShell!.state)).toBe('/today');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('does not double-push when an unrelated state change re-runs the guard while the async clear is still in flight', async () => {
    // Park the SecureStore clear so pendingEntryRoute survives past the push,
    // exactly like a slow keychain call on device.
    const clearGate = createDeferred<void>();
    mockClearPostOnboardingRoute.mockReturnValue(clearGate.promise);

    const hydration = prepareHydration();
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await fireNotificationTap('reminder-daily-log');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(CALENDAR_DAY_ROUTE);
    });

    // The route is still pending (clear parked) and the pathname is stale.
    expect(screen.getByText(`pendingEntryRoute:${CALENDAR_DAY_ROUTE}`)).toBeTruthy();

    // Unrelated state change re-runs the guard effect.
    await act(async () => {
      latestAppShell?.applyBillingSnapshot({ accessState: 'subscribed' });
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledTimes(1);

    await act(async () => {
      clearGate.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:undefined')).toBeTruthy();
    });
  });

  it('navigates again for a fresh tap after the previous route was consumed and cleared', async () => {
    const hydration = prepareHydration();
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await fireNotificationTap('reminder-daily-log');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(CALENDAR_DAY_ROUTE);
      expect(screen.getByText('pendingEntryRoute:undefined')).toBeTruthy();
    });

    // Later the same day, back on /today, the user taps the reminder again.
    await act(async () => {
      notificationResponseListener?.(reminderResponse('reminder-daily-log'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(2);
    });
    expect(mockPush).toHaveBeenLastCalledWith(CALENDAR_DAY_ROUTE);
  });

  it('consumes the tap from /settings for an expired user (paid gate retired)', async () => {
    mockGetBillingSnapshot.mockResolvedValue({
      accessState: 'expired',
      grandfatherTrialApplied: true,
    });
    const hydration = prepareHydration();
    mockPathname = '/settings';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await fireNotificationTap('reminder-daily-log');

    // With the paid gate retired there is nothing left to park behind: an
    // expired user's tap navigates straight to the calendar day.
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(CALENDAR_DAY_ROUTE);
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not consume a calendar-day route when the dev bypass falls through with onboarding incomplete', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
    });
    mockGlobalSearchParams = { disableOnboarding: '1' };
    mockPathname = '/backup/export';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await fireNotificationTap('reminder-daily-log');

    await waitFor(() => {
      expect(screen.getByText(`pendingEntryRoute:${CALENDAR_DAY_ROUTE}`)).toBeTruthy();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('leaves non-calendar pending routes to the entry-resolution flow instead of pushing them', async () => {
    const hydration = prepareHydration();
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    await act(async () => {
      latestAppShell?.setPendingEntryRoute('/import');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:/import')).toBeTruthy();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
