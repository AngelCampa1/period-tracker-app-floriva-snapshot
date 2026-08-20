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
const mockCanGoBack = jest.fn();
const mockRemoveAppStateListener = jest.fn();

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

let appStateChangeHandler: ((nextState: string) => void) | null = null;
let mockPathname = '/lock';
let mockLocalSearchParams: {
  returnTo?: string | string[];
  disableOnboarding?: string | string[];
} = {};
let mockGlobalSearchParams: {
  returnTo?: string | string[];
  disableOnboarding?: string | string[];
} = {};
let latestAppShell: { unlockApp: () => void } | null = null;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useGlobalSearchParams: () => mockGlobalSearchParams,
  usePathname: () => mockPathname,
  useRouter: () => ({
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
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
  cancelAllReminderNotifications: () => mockCancelAllReminderNotifications(),
  reconcileReminderNotifications: (...args: unknown[]) =>
    mockReconcileReminderNotifications(...args),
  reconcileBillingReminderNotification: jest.fn(),
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

const defaultHydrationPrivacyPreference: PrivacyPreference = {
  biometricsEnabled: true,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
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
  mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
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
        privacyPreference.resolve(
          overrides.privacyPreference ?? defaultHydrationPrivacyPreference,
        );
        biometricLockArmed.resolve(overrides.biometricLockArmed ?? true);
        await Promise.resolve();
      });
    },
  };
}

function AppShellConsumer() {
  latestAppShell = useAppShell();

  return <Text>guard-probe</Text>;
}

describe('AppShellRouteGuard', () => {
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
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockRemoveAppStateListener.mockReset();
    appStateChangeHandler = null;
    mockPathname = '/today';
    mockLocalSearchParams = {};
    mockGlobalSearchParams = {};
    latestAppShell = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      appStateChangeHandler = listener as unknown as (nextState: string) => void;

      return {
        remove: mockRemoveAppStateListener,
      } as ReturnType<typeof AppState.addEventListener>;
    });

    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes back to /lock after the relock timeout elapses on resume', async () => {
    const hydration = prepareHydration();
    const dateNowSpy = jest.spyOn(Date, 'now');
    let now = 0;
    dateNowSpy.mockImplementation(() => now);

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    mockReplace.mockClear();
    mockPathname = '/today';

    act(() => {
      latestAppShell?.unlockApp();
    });

    act(() => {
      now = 0;
      appStateChangeHandler?.('background');
    });

    act(() => {
      now = 61_000;
      appStateChangeHandler?.('active');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/lock');
    });

    dateNowSpy.mockRestore();
  });

  it('leaves a completed formerly-unpaid user on /today (app is free)', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'expired', grandfatherTrialApplied: true });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not redirect a completed unpaid user away from /backup (data export allowed)', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'expired', grandfatherTrialApplied: true });
    mockPathname = '/backup';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not redirect a completed unpaid user away from /settings', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'expired', grandfatherTrialApplied: true });
    mockPathname = '/settings';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not redirect a trialing user from /today', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'trial_active' });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not redirect a subscribed user from /today', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'subscribed' });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('honors disableOnboarding dev bypass for the paid gate', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'expired', grandfatherTrialApplied: true });
    mockPathname = '/today';
    mockGlobalSearchParams = { disableOnboarding: '1' };

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('does not replace away from /lock after a manual unlock when navigation history exists', async () => {
    const hydration = prepareHydration();
    mockPathname = '/lock';
    mockCanGoBack.mockReturnValue(true);

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    mockReplace.mockClear();

    act(() => {
      latestAppShell?.unlockApp();
    });

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('routes unlocked users away from /lock when there is no navigation history', async () => {
    const hydration = prepareHydration();
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'subscribed' });
    mockPathname = '/lock';
    mockCanGoBack.mockReturnValue(false);

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    mockReplace.mockClear();

    act(() => {
      latestAppShell?.unlockApp();
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('routes users back to onboarding when the app shell hydrates without completed onboarding', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    });
  });

  it('honors the dev-only disableOnboarding query flag for deep links into protected routes', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/backup/export';
    // The guard is mounted at the root layout, where a deep-linked child
    // route's query param is only surfaced through the global params hook,
    // not the local (root-scoped) one.
    mockLocalSearchParams = {};
    mockGlobalSearchParams = { disableOnboarding: '1' };

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('honors the disableOnboarding flag when expo-router surfaces it as a repeated (array) param', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/backup/export';
    // Expo Router can surface a repeated query param as an array; the guard
    // must read the first entry rather than ignoring the bypass.
    mockLocalSearchParams = {};
    mockGlobalSearchParams = { disableOnboarding: ['1'] };

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ignores the disableOnboarding flag in production builds and redirects to welcome', async () => {
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const hydration = prepareHydration({
        preferences: {
          hasCompletedOnboarding: false,
          deferredBiometricsSetup: false,
          deferredReminderSetup: false,
          deferredImportSetup: false,
        },
        biometricLockArmed: false,
        privacyPreference: {
          ...defaultHydrationPrivacyPreference,
          biometricsEnabled: false,
        },
      });
      mockPathname = '/backup/export';
      mockLocalSearchParams = {};
      mockGlobalSearchParams = { disableOnboarding: '1' };

      render(
        <AppShellProvider>
          <AppShellRouteGuard />
          <AppShellConsumer />
        </AppShellProvider>,
      );
      await hydration.resolve();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/welcome');
      });
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    }
  });

  it('allows onboarding screens beyond welcome while onboarding is still incomplete', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/start-path';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/welcome');
  });

  it('keeps incomplete-onboarding users on /notifications instead of bouncing to welcome', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/notifications';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/welcome');
  });

  // Onboarding no longer has a billing step. A mid-onboarding user who lands on
  // any billing surface is returned to the start of the flow, never to the
  // retired /paywall route.
  it.each(['/billing-options', '/subscribe'])(
    'returns an incomplete-onboarding user from %s to /welcome (paywall step retired)',
    async (pathname) => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
      mockGetBillingSnapshot.mockResolvedValue({ accessState: 'trial_active' });
      mockPathname = pathname;

      render(
        <AppShellProvider>
          <AppShellRouteGuard />
          <AppShellConsumer />
        </AppShellProvider>,
      );
      await hydration.resolve();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/welcome');
      });

      expect(mockReplace).not.toHaveBeenCalledWith('/paywall');
    },
  );

  it('sends an incomplete-onboarding user from an app route back to /welcome', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'trial_active' });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/paywall');
  });

  it('allows the onboarding privacy explainer while onboarding is still incomplete', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockPathname = '/privacy-details';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/welcome');
  });

  it('lets entitled users stay on /import without bouncing to subscribe', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'subscribed' });
    mockPathname = '/import';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('allows /subscribe to stay explicitly navigable for entitled users', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: false,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: false,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'trial_active' });
    mockPathname = '/subscribe';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/today');
  });

  it.each(['/import', '/calendar'])(
    'leaves a formerly-unpaid (expired) user on %s (app is free)',
    async (pathname) => {
      const hydration = prepareHydration({
        biometricLockArmed: false,
        privacyPreference: {
          ...defaultHydrationPrivacyPreference,
          biometricsEnabled: false,
        },
      });
      mockGetBillingSnapshot.mockResolvedValue({ accessState: 'expired', grandfatherTrialApplied: true });
      mockPathname = pathname;

      render(
        <AppShellProvider>
          <AppShellRouteGuard />
          <AppShellConsumer />
        </AppShellProvider>,
      );
      await hydration.resolve();

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
    },
  );

  it('/lock beats the paid gate when biometric-locked AND unpaid', async () => {
    const hydration = prepareHydration({
      biometricLockArmed: true,
      privacyPreference: {
        ...defaultHydrationPrivacyPreference,
        biometricsEnabled: true,
      },
    });
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
    mockPathname = '/today';

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/lock');
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it('formerly-unpaid user unlocking from /lock with no navigation history lands in the app', async () => {
    const hydration = prepareHydration();
    mockGetBillingSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
      grandfatherTrialApplied: true,
    });
    mockPathname = '/lock';
    mockCanGoBack.mockReturnValue(false);

    render(
      <AppShellProvider>
        <AppShellRouteGuard />
        <AppShellConsumer />
      </AppShellProvider>,
    );
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell).not.toBeNull();
    });

    mockReplace.mockClear();

    act(() => {
      latestAppShell?.unlockApp();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
  });

  it.each(['trial_active', 'subscribed'] as const)(
    'keeps %s users on core app routes instead of redirecting to billing',
    async (accessState) => {
      const hydration = prepareHydration({
        biometricLockArmed: false,
        privacyPreference: {
          ...defaultHydrationPrivacyPreference,
          biometricsEnabled: false,
        },
      });
      mockGetBillingSnapshot.mockResolvedValue({ accessState });
      mockPathname = '/calendar';

      render(
        <AppShellProvider>
          <AppShellRouteGuard />
          <AppShellConsumer />
        </AppShellProvider>,
      );
      await hydration.resolve();

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockReplace).not.toHaveBeenCalledWith('/subscribe');
    },
  );
});
