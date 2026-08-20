import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import {
  defaultAppPreferences,
  defaultUserProfile,
} from '@/src/db/domainDefaults';

const mockGetPreferences = jest.fn();
const mockGetBillingSnapshot = jest.fn();
const mockSaveBillingSnapshot = jest.fn();
const mockGetProfile = jest.fn();
const mockGetPrivacyPreference = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockListByDateRange = jest.fn();
const mockSavePrivacyPreference = jest.fn();
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

let appStateChangeListener: ((nextState: string) => void) | null = null;
let appStateSpy: jest.SpiedFunction<typeof AppState.addEventListener> | null = null;

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
    savePreference: (...args: unknown[]) => mockSavePrivacyPreference(...args),
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
  billingSnapshot?: {
    accessState: string;
    planId?: string;
    trialEndsAt?: string;
    expiresAt?: string;
    firstChargeAt?: string;
    grandfatherTrialApplied?: boolean;
  };
  profile?: UserProfile | null;
  privacyPreference?: PrivacyPreference;
  biometricLockArmed?: boolean;
  onboardingCompletedAt?: string;
};

const defaultHydrationPreferences: AppPreferences = {
  ...defaultAppPreferences,
  hasCompletedOnboarding: false,
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
  mockGetBillingSnapshot.mockResolvedValue(
    overrides.billingSnapshot ?? { accessState: 'needs_purchase' },
  );
  mockGetProfile.mockReturnValue(profile.promise);
  mockGetPrivacyPreference.mockReturnValue(privacyPreference.promise);
  mockIsBiometricLockArmed.mockReturnValue(biometricLockArmed.promise);
  mockGetReviewPromptState.mockResolvedValue({
    onboardingCompletedAt: overrides.onboardingCompletedAt,
  });

  return {
    resolve: async () => {
      await act(async () => {
        preferences.resolve({
          ...defaultHydrationPreferences,
          ...overrides.preferences,
        });
        profile.resolve(overrides.profile ?? null);
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
      <Text>onboarding:{String(state.hasCompletedOnboarding)}</Text>
      <Text>locked:{String(state.isLocked)}</Text>
      <Text>billing:{state.billingAccessState}</Text>
      <Text>ready:{String(state.mainAppReady)}</Text>
    </>
  );
}

function OutsideProviderConsumer() {
  useAppShell();

  return <Text>outside-provider</Text>;
}

class TestErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <Text>boundary:{this.state.error.message}</Text>;
    }

    return this.props.children;
  }
}

async function renderAppShell() {
  render(
    <AppShellProvider>
      <AppShellConsumer />
    </AppShellProvider>,
  );
}

describe('AppShellProvider', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockGetBillingSnapshot.mockReset();
    mockSaveBillingSnapshot.mockReset();
    mockGetProfile.mockReset();
    mockGetPrivacyPreference.mockReset();
    mockGetReminderPreferences.mockReset();
    mockListByDateRange.mockReset();
    mockSavePrivacyPreference.mockReset();
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
    mockGetReviewPromptState.mockResolvedValue({ onboardingCompletedAt: undefined });
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue(null);
    mockPersistPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPersistedOnboardingDraft.mockResolvedValue(undefined);
    mockSeedReviewPromptOnboarding.mockResolvedValue(undefined);
    latestAppShell = null;
    appStateChangeListener = null;

    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);
    mockSavePrivacyPreference.mockResolvedValue(undefined);
    mockReconcileReminderNotifications.mockResolvedValue([]);
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateChangeListener = listener as (nextState: string) => void;

      return {
        remove: mockRemoveAppStateListener,
      } as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    appStateSpy?.mockRestore();
    appStateSpy = null;
  });

  it('stays unhydrated until persisted app state loads', async () => {
    const hydration = prepareHydration();

    await renderAppShell();

    expect(screen.getByText('hydrated:false')).toBeTruthy();

    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });
  });

  it('hydrates completed onboarding into the ready tracker state when preferences and the required profile seed are present', async () => {
    const hydration = prepareHydration({
      billingSnapshot: { accessState: 'needs_purchase', grandfatherTrialApplied: true },
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: true,
        deferredReminderSetup: false,
        deferredImportSetup: true,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(screen.getByText('billing:needs_purchase')).toBeTruthy();
      expect(screen.getByText('ready:true')).toBeTruthy();
      expect(mockNotifyThemePreferenceChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('rehydrates the running shell after restored local data changes onboarding and billing state', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    mockGetPreferences.mockResolvedValue({
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
    });
    mockGetBillingSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
      planId: 'annual',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
      expiresAt: '2027-05-09T10:00:00.000Z',
    });
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
    });
    mockGetPrivacyPreference.mockResolvedValue({
      biometricsEnabled: false,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
    });
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await act(async () => {
      await latestAppShell?.rehydrateFromStorage();
    });

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(screen.getByText('billing:needs_purchase')).toBeTruthy();
      expect(screen.getByText('ready:true')).toBeTruthy();
    });
  });

  it('expires stale cached billing access locally without locking the tracker shell', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      billingSnapshot: {
        accessState: 'trial_active',
        trialEndsAt: '2026-05-09T10:00:00.000Z',
        expiresAt: '2026-05-09T10:00:00.000Z',
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('billing:expired')).toBeTruthy();
      expect(screen.getByText('ready:true')).toBeTruthy();
    });

    dateNowSpy.mockRestore();
  });

  it('cold-launches into the locked state when biometric lock is enabled and armed', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
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
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(screen.getByText('locked:true')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });
  });

  it('falls back to onboarding when a stored profile predates the required lastPeriodStartDate seed', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });
  });

  it('falls back to onboarding when the persisted profile is incomplete', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        goals: [],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });
  });

  it('does not hydrate onboarding completion when condition tags or the irregular-cycle flag are missing', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period'],
      } as UserProfile,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });
  });

  it('persists onboarding completion atomically before updating the shell state', async () => {
    const hydration = prepareHydration();
    mockCompleteOnboarding.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });

    await act(async () => {
      void latestAppShell?.completeOnboarding({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      });
    });

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        {
          cycleLengthDays: 29,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-01',
          goals: ['period', 'symptoms'],
          supportsIrregularCycles: true,
          conditionTags: [],
          ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
        },
        {
          ...defaultAppPreferences,
          hasCompletedOnboarding: true,
        },
      );
    });

    await waitFor(() => {
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(screen.getByText('ready:true')).toBeTruthy();
    });
  });

  it('hydrates a persisted post-onboarding import handoff before billing unlocks the app', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue('/import');

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(screen.getByText('ready:true')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
    });
  });

  it('persists a post-onboarding handoff route when setup completes into import next', async () => {
    const hydration = prepareHydration();
    mockCompleteOnboarding.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    await act(async () => {
      void latestAppShell?.completeOnboarding(
        {
          cycleLengthDays: 29,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-04-01',
          goals: ['period', 'symptoms'],
          supportsIrregularCycles: true,
          conditionTags: [],
          ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
        },
        undefined,
        '/import',
      );
    });

    await waitFor(() => {
      expect(mockPersistPostOnboardingRoute).toHaveBeenCalledWith('/import');
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
      expect(screen.getByText('ready:true')).toBeTruthy();
    });
  });

  it('clears the pending entry route without deleting the resumable onboarding draft', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue('/import');

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
    });

    await act(async () => {
      void latestAppShell?.clearPendingEntryRoute();
    });

    await waitFor(() => {
      expect(mockClearPostOnboardingRoute).toHaveBeenCalledTimes(1);
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
      expect(mockClearPersistedOnboardingDraft).not.toHaveBeenCalled();
    });
  });

  it('wipes persisted local state when resetting the shell', async () => {
    const hydration = prepareHydration();
    mockWipeLocalData.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    await act(async () => {
      void latestAppShell?.resetAppShell();
    });

    await waitFor(() => {
      expect(mockWipeLocalData).toHaveBeenCalled();
    });
  });

  it('clears reminders and secure lock artifacts when deleting all local data', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });
    mockWipeLocalData.mockResolvedValue(undefined);
    mockCancelAllReminderNotifications.mockResolvedValue(undefined);
    mockClearBiometricLock.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
    });

    await act(async () => {
      void latestAppShell?.deleteAllData();
    });

    await waitFor(() => {
      expect(mockWipeLocalData).toHaveBeenCalledTimes(1);
      expect(mockCancelAllReminderNotifications).toHaveBeenCalledTimes(1);
      expect(mockClearBiometricLock).toHaveBeenCalledTimes(1);
      expect(mockNotifyThemePreferenceChanged).toHaveBeenCalled();
    });
  });

  it('does not mutate shell state if atomic onboarding persistence fails', async () => {
    const hydration = prepareHydration();
    mockCompleteOnboarding.mockRejectedValueOnce(new Error('onboarding failed'));

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });

    let thrown: unknown;
    try {
      await latestAppShell?.completeOnboarding({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('onboarding failed');
    expect(screen.getByText('onboarding:false')).toBeTruthy();
    expect(screen.getByText('ready:false')).toBeTruthy();
  });

  it('rejects incomplete onboarding profiles before persisting completion', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });

    await expect(
      latestAppShell?.completeOnboarding({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        goals: ['period'],
        supportsIrregularCycles: true,
        conditionTags: [],
      }),
    ).rejects.toThrow('Onboarding profile is incomplete');

    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
    expect(screen.getByText('onboarding:false')).toBeTruthy();
    expect(screen.getByText('ready:false')).toBeTruthy();
  });

  it('keeps mainAppReady false when unlocking before onboarding is complete', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('ready:false')).toBeTruthy();
    });

    await act(async () => {
      latestAppShell?.lockApp();
      latestAppShell?.unlockApp();
    });

    expect(screen.getByText('locked:false')).toBeTruthy();
    expect(screen.getByText('ready:false')).toBeTruthy();
  });

  it('refreshes reminder schedules with a default profile when restore leaves no profile on disk', async () => {
    const hydration = prepareHydration();

    mockListByDateRange.mockResolvedValue([
      {
        id: 'restored-log',
        logDate: '2026-04-10',
        bleeding: 'light',
        symptoms: ['fatigue'],
      },
    ]);
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 15,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    await renderAppShell();
    await hydration.resolve();

    await act(async () => {
      await latestAppShell?.refreshReminderSchedules();
    });

    expect(mockReconcileReminderNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: defaultUserProfile,
        logEntries: [
          {
            id: 'restored-log',
            logDate: '2026-04-10',
            bleeding: 'light',
            symptoms: ['fatigue'],
          },
        ],
        preferences: [
          {
            kind: 'daily-log',
            enabled: true,
            hour: 20,
            minute: 15,
            schedule: {
              cadence: 'daily',
            },
          },
        ],
      }),
    );
  });

  it('threads the persisted locale preference into reconcileReminderNotifications', async () => {
    const hydration = prepareHydration({
      preferences: { localePreference: 'de' },
    });

    mockGetReminderPreferences.mockResolvedValue([]);
    mockListByDateRange.mockResolvedValue([]);

    await renderAppShell();
    await hydration.resolve();

    await act(async () => {
      await latestAppShell?.refreshReminderSchedules();
    });

    expect(mockReconcileReminderNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'de',
      }),
    );
  });

  it('clears the biometric lock when saving a privacy preference that disables biometrics', async () => {
    const hydration = prepareHydration({
      privacyPreference: {
        biometricsEnabled: true,
        relockAfterSeconds: 120,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      },
    });
    mockClearBiometricLock.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await act(async () => {
      await latestAppShell?.savePrivacyPreference({
        biometricsEnabled: false,
        relockAfterSeconds: 300,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      });
    });

    expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
      biometricsEnabled: false,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    });
    expect(mockClearBiometricLock).toHaveBeenCalledTimes(1);
  });

  it('unlocks the main app when billing is restored to an active subscription state', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });

    await renderAppShell();
    await hydration.resolve();

    await act(async () => {
      latestAppShell?.applyBillingSnapshot({
        accessState: 'subscribed',
        planId: 'annual',
      });
    });

    expect(screen.getByText('billing:subscribed')).toBeTruthy();
    expect(screen.getByText('ready:true')).toBeTruthy();
  });

  it('seeds review eligibility when onboarding completes', async () => {
    const hydration = prepareHydration();

    await renderAppShell();
    await hydration.resolve();

    await act(async () => {
      await latestAppShell?.completeOnboarding({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      });
    });

    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    expect(mockSeedReviewPromptOnboarding).toHaveBeenCalledWith(expect.any(String));
  });

  it('keeps onboarding completion coherent when review seeding fails after persistence commits', async () => {
    const hydration = prepareHydration();
    mockCompleteOnboarding.mockResolvedValue(undefined);
    mockSeedReviewPromptOnboarding.mockRejectedValueOnce(new Error('review seed failed'));

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latestAppShell?.completeOnboarding(
          {
            cycleLengthDays: 29,
            periodLengthDays: 5,
            lastPeriodStartDate: '2026-04-01',
            goals: ['period', 'symptoms'],
            supportsIrregularCycles: true,
            conditionTags: [],
            ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
          },
          undefined,
          '/import',
        );
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeUndefined();
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    expect(mockPersistPostOnboardingRoute).toHaveBeenCalledWith('/import');
    expect(mockClearPersistedOnboardingDraft).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
    });
  });

  it('rejects onboarding completion before persistence when the post-onboarding route cannot be stored', async () => {
    const hydration = prepareHydration();
    mockPersistPostOnboardingRoute.mockRejectedValueOnce(new Error('route save failed'));

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latestAppShell?.completeOnboarding(
          {
            cycleLengthDays: 29,
            periodLengthDays: 5,
            lastPeriodStartDate: '2026-04-01',
            goals: ['period', 'symptoms'],
            supportsIrregularCycles: true,
            conditionTags: [],
            ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
          },
          undefined,
          '/import',
        );
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('route save failed');
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
    expect(mockClearPersistedOnboardingDraft).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });
  });

  it('surfaces onboarding draft cleanup failures after commit while keeping the shell coherent', async () => {
    const hydration = prepareHydration();
    mockCompleteOnboarding.mockResolvedValue(undefined);
    mockClearPersistedOnboardingDraft.mockRejectedValueOnce(new Error('draft clear failed'));

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:false')).toBeTruthy();
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latestAppShell?.completeOnboarding(
          {
            cycleLengthDays: 29,
            periodLengthDays: 5,
            lastPeriodStartDate: '2026-04-01',
            goals: ['period', 'symptoms'],
            supportsIrregularCycles: true,
            conditionTags: [],
            ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
          },
          undefined,
          '/import',
        );
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('draft clear failed');
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    expect(mockPersistPostOnboardingRoute).toHaveBeenCalledWith('/import');
    expect(mockSeedReviewPromptOnboarding).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
    });
  });

  it('surfaces reminder cleanup failures after local data is wiped and resets the in-memory shell state', async () => {
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
    });
    mockLoadPersistedPostOnboardingRoute.mockResolvedValue('/import');
    mockWipeLocalData.mockResolvedValue(undefined);
    mockCancelAllReminderNotifications.mockRejectedValueOnce(
      new Error('cancel reminders failed'),
    );
    mockClearBiometricLock.mockResolvedValue(undefined);

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('hydrated:true')).toBeTruthy();
      expect(screen.getByText('onboarding:true')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBe('/import');
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latestAppShell?.deleteAllData();
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('cancel reminders failed');
    expect(mockWipeLocalData).toHaveBeenCalledTimes(1);
    expect(mockClearBiometricLock).toHaveBeenCalledTimes(1);
    expect(mockClearPostOnboardingRoute).toHaveBeenCalledTimes(1);
    expect(mockClearPersistedOnboardingDraft).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('onboarding:false')).toBeTruthy();
      expect(latestAppShell?.state.pendingEntryRoute).toBeUndefined();
    });
  });

  it('relocks after the app returns from background past the biometric timeout', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000 + 61_000);
    const hydration = prepareHydration({
      preferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
      },
      billingSnapshot: {
        accessState: 'subscribed',
      },
      profile: {
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
      },
      privacyPreference: {
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      },
      biometricLockArmed: false,
    });

    await renderAppShell();
    await hydration.resolve();

    expect(screen.getByText('ready:true')).toBeTruthy();

    await act(async () => {
      appStateChangeListener?.('background');
      appStateChangeListener?.('active');
    });

    expect(screen.getByText('locked:true')).toBeTruthy();
    expect(screen.getByText('ready:false')).toBeTruthy();
    dateNowSpy.mockRestore();
  });

  it('surfaces hydration failures through the provider boundary', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetPreferences.mockRejectedValueOnce(new Error('hydrate failed'));
    mockGetBillingSnapshot.mockResolvedValue({ accessState: 'needs_purchase' });
    mockGetProfile.mockResolvedValue(null);
    mockGetPrivacyPreference.mockResolvedValue(defaultHydrationPrivacyPreference);
    mockIsBiometricLockArmed.mockResolvedValue(false);

    render(
      <TestErrorBoundary>
        <AppShellProvider>
          <AppShellConsumer />
        </AppShellProvider>
      </TestErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('boundary:hydrate failed')).toBeTruthy();
    });

    consoleErrorSpy.mockRestore();
  });

  const completedProfile: UserProfile = {
    cycleLengthDays: 29,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-04-01',
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: true,
    conditionTags: [],
    ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
  };

  const grandfatheredPreferences = {
    hasCompletedOnboarding: true,
    deferredBiometricsSetup: false,
    deferredReminderSetup: false,
    deferredImportSetup: false,
  };

  it('backfills a 30-day grandfather trial for a recently onboarded user', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const onboardedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const hydration = prepareHydration({
      preferences: grandfatheredPreferences,
      billingSnapshot: { accessState: 'needs_purchase' },
      profile: completedProfile,
      onboardingCompletedAt: onboardedAt,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('billing:trial_active')).toBeTruthy();
    });

    expect(mockSaveBillingSnapshot).toHaveBeenCalledTimes(1);
    const persisted = mockSaveBillingSnapshot.mock.calls[0][0];
    expect(persisted.grandfatherTrialApplied).toBe(true);
    expect(persisted.accessState).toBe('trial_active');
    const expectedTrialEnd = new Date(onboardedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(new Date(persisted.trialEndsAt).getTime()).toBe(expectedTrialEnd);
    expect(persisted.firstChargeAt).toBeUndefined();

    dateNowSpy.mockRestore();
  });

  it('backfills the grandfather marker as expired when onboarding predates the trial window', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const onboardedAt = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const hydration = prepareHydration({
      preferences: grandfatheredPreferences,
      billingSnapshot: { accessState: 'needs_purchase' },
      profile: completedProfile,
      onboardingCompletedAt: onboardedAt,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('billing:expired')).toBeTruthy();
    });

    expect(mockSaveBillingSnapshot).toHaveBeenCalledTimes(1);
    const persisted = mockSaveBillingSnapshot.mock.calls[0][0];
    expect(persisted.grandfatherTrialApplied).toBe(true);
    expect(persisted.accessState).toBe('expired');

    dateNowSpy.mockRestore();
  });

  it('does not re-grant a trial when the grandfather marker is already applied', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const onboardedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const hydration = prepareHydration({
      preferences: grandfatheredPreferences,
      billingSnapshot: { accessState: 'needs_purchase', grandfatherTrialApplied: true },
      profile: completedProfile,
      onboardingCompletedAt: onboardedAt,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('billing:needs_purchase')).toBeTruthy();
    });

    expect(mockSaveBillingSnapshot).not.toHaveBeenCalled();

    dateNowSpy.mockRestore();
  });

  it('leaves an already entitled snapshot untouched during hydration', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const onboardedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const hydration = prepareHydration({
      preferences: grandfatheredPreferences,
      billingSnapshot: { accessState: 'subscribed', planId: 'lifetime' },
      profile: completedProfile,
      onboardingCompletedAt: onboardedAt,
    });

    await renderAppShell();
    await hydration.resolve();

    await waitFor(() => {
      expect(screen.getByText('billing:subscribed')).toBeTruthy();
    });

    expect(mockSaveBillingSnapshot).not.toHaveBeenCalled();

    dateNowSpy.mockRestore();
  });

  it('throws immediately when useAppShell is called outside the provider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <TestErrorBoundary>
          <OutsideProviderConsumer />
        </TestErrorBoundary>,
      );
    }).not.toThrow();

    expect(screen.getByText('boundary:useAppShell must be used within AppShellProvider')).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
