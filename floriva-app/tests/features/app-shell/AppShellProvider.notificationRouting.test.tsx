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
const mockRemoveAppStateListener = jest.fn();
const mockLoadPersistedPostOnboardingRoute = jest.fn();
const mockPersistPostOnboardingRoute = jest.fn();
const mockClearPostOnboardingRoute = jest.fn();
const mockClearPersistedOnboardingDraft = jest.fn();
const mockNotifyThemePreferenceChanged = jest.fn();
const mockSeedReviewPromptOnboarding = jest.fn();
const mockGetReviewPromptState = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockRemoveNotificationSubscription = jest.fn();
const mockGetLocalTodayLogDate = jest.fn();

let notificationResponseListener:
  | ((response: unknown) => void)
  | null = null;

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
    seedOnboardingCompletion: (...args: unknown[]) => mockSeedReviewPromptOnboarding(...args),
    getState: (...args: unknown[]) => mockGetReviewPromptState(...args),
  },
  localDataMaintenance: {
    wipeLocalData: () => mockWipeLocalData(),
  },
};

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

jest.mock('@/src/features/onboarding/draftStorage', () => ({
  clearPersistedOnboardingDraft: (...args: unknown[]) =>
    mockClearPersistedOnboardingDraft(...args),
}));

jest.mock('@/src/theme/themePreferenceSync', () => ({
  notifyThemePreferenceChanged: (...args: unknown[]) =>
    mockNotifyThemePreferenceChanged(...args),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: (...args: unknown[]) => mockGetLocalTodayLogDate(...args),
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
import type { AppPreferences, PrivacyPreference, UserProfile } from '@/src/types/domain';

let latestAppShell: ReturnType<typeof useAppShell> | null = null;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

type HydrationOverrides = {
  preferences?: Partial<AppPreferences>;
  profile?: UserProfile | null;
  privacyPreference?: PrivacyPreference;
  biometricLockArmed?: boolean;
};

const defaultHydrationPreferences: AppPreferences = {
  ...defaultAppPreferences,
  hasCompletedOnboarding: true,
};

const defaultHydrationPrivacyPreference: PrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
};

const defaultTtcTrackingPreferences = {
  sex: false,
  ovulationTest: false,
  cervicalMucus: false,
  basalBodyTemperature: false,
} as const;

const completedProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: true,
  conditionTags: [],
  ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
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

function prepareHydration(overrides: HydrationOverrides = {}) {
  const preferences = createDeferred<AppPreferences>();
  const profile = createDeferred<UserProfile | null>();
  const privacyPreference = createDeferred<PrivacyPreference>();
  const biometricLockArmed = createDeferred<boolean>();

  mockGetPreferences.mockReturnValue(preferences.promise);
  mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
  mockGetProfile.mockReturnValue(profile.promise);
  mockGetPrivacyPreference.mockReturnValue(privacyPreference.promise);
  mockIsBiometricLockArmed.mockReturnValue(biometricLockArmed.promise);
  mockGetReviewPromptState.mockResolvedValue({ onboardingCompletedAt: undefined });

  return {
    resolve: async () => {
      await act(async () => {
        preferences.resolve({
          ...defaultHydrationPreferences,
          ...overrides.preferences,
        });
        profile.resolve(overrides.profile ?? completedProfile);
        privacyPreference.resolve(
          overrides.privacyPreference ?? defaultHydrationPrivacyPreference,
        );
        biometricLockArmed.resolve(overrides.biometricLockArmed ?? false);
        await Promise.resolve();
      });
    },
  };
}

function AppShellConsumer() {
  const appShell = useAppShell();
  const { isHydrated, state } = appShell;
  latestAppShell = appShell;

  return (
    <>
      <Text>hydrated:{String(isHydrated)}</Text>
      <Text>locked:{String(state.isLocked)}</Text>
      <Text>pendingEntryRoute:{String(state.pendingEntryRoute)}</Text>
    </>
  );
}

async function renderAppShell() {
  render(
    <AppShellProvider>
      <AppShellConsumer />
    </AppShellProvider>,
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

describe('AppShellProvider notification tap routing', () => {
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
    mockRemoveAppStateListener.mockReset();
    mockLoadPersistedPostOnboardingRoute.mockReset();
    mockPersistPostOnboardingRoute.mockReset();
    mockClearPostOnboardingRoute.mockReset();
    mockClearPersistedOnboardingDraft.mockReset();
    mockNotifyThemePreferenceChanged.mockReset();
    mockSeedReviewPromptOnboarding.mockReset();
    mockGetReviewPromptState.mockReset();
    mockAddNotificationResponseReceivedListener.mockReset();
    mockGetLastNotificationResponseAsync.mockReset();
    mockRemoveNotificationSubscription.mockReset();
    mockGetLocalTodayLogDate.mockReset();

    mockGetReviewPromptState.mockResolvedValue({ onboardingCompletedAt: undefined });
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue(null);
    mockPersistPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPersistedOnboardingDraft.mockResolvedValue(undefined);
    mockSeedReviewPromptOnboarding.mockResolvedValue(undefined);
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);
    mockReconcileReminderNotifications.mockResolvedValue([]);
    mockGetLocalTodayLogDate.mockReturnValue('2026-07-06');
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);

    notificationResponseListener = null;
    mockAddNotificationResponseReceivedListener.mockImplementation((listener) => {
      notificationResponseListener = listener;

      return { remove: mockRemoveNotificationSubscription };
    });

    latestAppShell = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({
      remove: jest.fn(),
    }) as ReturnType<typeof AppState.addEventListener>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the notification response listener on mount and removes it on unmount', async () => {
    const hydration = prepareHydration();

    const { unmount } = render(
      <AppShellProvider>
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockRemoveNotificationSubscription).toHaveBeenCalledTimes(1);
  });

  it('sets pendingEntryRoute to /calendar/day/{today} on a live reminder-daily-log tap', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      notificationResponseListener?.(reminderResponse('reminder-daily-log'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:/calendar/day/2026-07-06')).toBeTruthy();
    });
  });

  it('sets pendingEntryRoute to /today on a live tap with an unrecognized identifier', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      notificationResponseListener?.(reminderResponse('reminder-fertile-window'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:/today')).toBeTruthy();
    });
  });

  it('sets pendingEntryRoute to /calendar/day/{today} from a cold-start reminder-period-start response', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(
      reminderResponse('reminder-period-start'),
    );
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:/calendar/day/2026-07-06')).toBeTruthy();
    });
  });

  it('leaves pendingEntryRoute untouched when getLastNotificationResponseAsync resolves to null', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    expect(screen.getByText('pendingEntryRoute:undefined')).toBeTruthy();
  });

  it('exposes setPendingEntryRoute directly on the context for other call sites to reuse', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    await act(async () => {
      latestAppShell?.setPendingEntryRoute('/calendar/day/2026-01-01');
    });

    expect(screen.getByText('pendingEntryRoute:/calendar/day/2026-01-01')).toBeTruthy();
  });

  it('sets pendingEntryRoute on a notification tap even while the app shell is locked, deferring navigation to the route guard', async () => {
    const hydration = prepareHydration({
      privacyPreference: {
        biometricsEnabled: true,
        relockAfterSeconds: 120,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      },
      biometricLockArmed: true,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('locked:true')).toBeTruthy();
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      notificationResponseListener?.(reminderResponse('reminder-daily-log'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('pendingEntryRoute:/calendar/day/2026-07-06')).toBeTruthy();
      // The provider itself does not gate on lock state — AppShellRouteGuard
      // (a separate component) is responsible for deferring navigation.
      expect(screen.getByText('locked:true')).toBeTruthy();
    });
  });
});
