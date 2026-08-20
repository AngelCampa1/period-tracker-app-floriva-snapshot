import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import { defaultAppPreferences } from '@/src/db/domainDefaults';

const mockGetPreferences = jest.fn();
const mockGetBillingSnapshot = jest.fn();
const mockGetProfile = jest.fn();
const mockGetPrivacyPreference = jest.fn();
const mockIsBiometricLockArmed = jest.fn();
const mockGetReviewPromptState = jest.fn();
const mockLoadPersistedPostOnboardingRoute = jest.fn();
const mockRegisterNotificationCategories = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockRemoveNotificationSubscription = jest.fn();

let localePreferenceListener: (() => void) | null = null;
const mockUnsubscribeFromLocalePreferenceChanges = jest.fn();

const mockRepositories = {
  appPreferences: {
    getPreferences: () => mockGetPreferences(),
  },
  billingSnapshot: {
    getSnapshot: () => mockGetBillingSnapshot(),
    saveSnapshot: jest.fn(),
  },
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  privacyPreferences: {
    getPreference: () => mockGetPrivacyPreference(),
    savePreference: jest.fn(),
  },
  reminderPreferences: {
    getPreferences: () => Promise.resolve([]),
  },
  dailyLogs: {
    listByDateRange: () => Promise.resolve([]),
  },
  onboarding: {
    completeOnboarding: jest.fn(),
  },
  reviewPromptState: {
    seedOnboardingCompletion: jest.fn(),
    getState: (...args: unknown[]) => mockGetReviewPromptState(...args),
  },
  localDataMaintenance: {
    wipeLocalData: jest.fn(),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  isBiometricLockArmed: () => mockIsBiometricLockArmed(),
  clearBiometricLock: jest.fn(),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  cancelAllLocalNotifications: jest.fn(),
  reconcileReminderNotifications: jest.fn(),
  reconcileBillingReminderNotification: jest.fn(),
}));

jest.mock('@/src/lib/notifications/registerNotificationCategories', () => ({
  registerNotificationCategories: (...args: unknown[]) =>
    mockRegisterNotificationCategories(...args),
}));

jest.mock('@/src/features/app-shell/postOnboardingRouteStorage', () => ({
  loadPersistedPostOnboardingRoute: (...args: unknown[]) =>
    mockLoadPersistedPostOnboardingRoute(...args),
  persistPostOnboardingRoute: jest.fn(),
  clearPersistedPostOnboardingRoute: jest.fn(),
}));

jest.mock('@/src/features/onboarding/draftStorage', () => ({
  clearPersistedOnboardingDraft: jest.fn(),
}));

jest.mock('@/src/theme/themePreferenceSync', () => ({
  notifyThemePreferenceChanged: jest.fn(),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-07-06',
}));

jest.mock('@/src/localization/localePreferenceSync', () => ({
  notifyLocalePreferenceChanged: jest.fn(),
  subscribeToLocalePreferenceChanges: (listener: () => void) => {
    localePreferenceListener = listener;

    return mockUnsubscribeFromLocalePreferenceChanges;
  },
}));

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) =>
    mockAddNotificationResponseReceivedListener(listener),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
}));

// eslint-disable-next-line import/first
import { AppShellProvider } from '@/src/features/app-shell/AppShellProvider';
// eslint-disable-next-line import/first
import type { AppPreferences, PrivacyPreference, UserProfile } from '@/src/types/domain';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

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

const completedProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: true,
  conditionTags: [],
};

function prepareHydration(overrides: { preferences?: Partial<AppPreferences> } = {}) {
  const preferences = createDeferred<AppPreferences>();

  mockGetPreferences.mockReturnValue(preferences.promise);
  mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
  mockGetProfile.mockResolvedValue(completedProfile);
  mockGetPrivacyPreference.mockResolvedValue(defaultHydrationPrivacyPreference);
  mockIsBiometricLockArmed.mockResolvedValue(false);
  mockGetReviewPromptState.mockResolvedValue({ onboardingCompletedAt: undefined });
  mockLoadPersistedPostOnboardingRoute.mockResolvedValue(null);

  return {
    resolve: async () => {
      await act(async () => {
        preferences.resolve({
          ...defaultHydrationPreferences,
          ...overrides.preferences,
        });
        await Promise.resolve();
      });
    },
  };
}

function AppShellConsumer() {
  return <Text>category-registration-probe</Text>;
}

describe('AppShellProvider notification category registration', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockGetBillingSnapshot.mockReset();
    mockGetProfile.mockReset();
    mockGetPrivacyPreference.mockReset();
    mockIsBiometricLockArmed.mockReset();
    mockGetReviewPromptState.mockReset();
    mockLoadPersistedPostOnboardingRoute.mockReset();
    mockRegisterNotificationCategories.mockReset();
    mockRegisterNotificationCategories.mockResolvedValue(undefined);
    mockAddNotificationResponseReceivedListener.mockReset();
    mockAddNotificationResponseReceivedListener.mockReturnValue({
      remove: mockRemoveNotificationSubscription,
    });
    mockGetLastNotificationResponseAsync.mockReset();
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockRemoveNotificationSubscription.mockReset();
    mockUnsubscribeFromLocalePreferenceChanges.mockReset();
    localePreferenceListener = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({
      remove: jest.fn(),
    }) as ReturnType<typeof AppState.addEventListener>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers notification categories for the resolved locale on mount', async () => {
    const hydration = prepareHydration({ preferences: { localePreference: 'es' } });

    render(
      <AppShellProvider>
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockRegisterNotificationCategories).toHaveBeenCalledWith('es');
    });
  });

  it('defaults to system locale resolution when no locale preference is stored', async () => {
    const hydration = prepareHydration({ preferences: { localePreference: undefined } });

    render(
      <AppShellProvider>
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockRegisterNotificationCategories).toHaveBeenCalledTimes(1);
    });
    // 'system' resolves through resolveLocalePreference to some concrete
    // SupportedLocale — the exact value depends on the test device locale
    // mock, so just assert a string was passed rather than pinning 'en'.
    expect(typeof mockRegisterNotificationCategories.mock.calls[0]![0]).toBe('string');
  });

  it('re-registers when a locale-preference change is broadcast', async () => {
    const hydration = prepareHydration({ preferences: { localePreference: 'en' } });

    render(
      <AppShellProvider>
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockRegisterNotificationCategories).toHaveBeenCalledWith('en');
    });

    mockRegisterNotificationCategories.mockClear();
    mockGetPreferences.mockResolvedValue({
      ...defaultHydrationPreferences,
      localePreference: 'fr',
    });

    await act(async () => {
      localePreferenceListener?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockRegisterNotificationCategories).toHaveBeenCalledWith('fr');
    });
  });

  it('unsubscribes from locale-preference changes on unmount', async () => {
    const hydration = prepareHydration();

    const { unmount } = render(
      <AppShellProvider>
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockRegisterNotificationCategories).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockUnsubscribeFromLocalePreferenceChanges).toHaveBeenCalledTimes(1);
  });
});
