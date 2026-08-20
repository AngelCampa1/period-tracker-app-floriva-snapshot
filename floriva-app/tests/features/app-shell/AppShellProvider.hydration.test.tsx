import path from 'node:path';

import Database from 'better-sqlite3';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { defaultAppPreferences } from '@/src/db/domainDefaults';
import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';

const migrationDirectory = path.resolve(__dirname, '../../../drizzle');

let mockRepositories: ReturnType<typeof createDomainRepositories>;
const mockIsBiometricLockArmed = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  isBiometricLockArmed: () => mockIsBiometricLockArmed(),
  clearBiometricLock: jest.fn(),
  armBiometricLock: jest.fn(),
}));

jest.mock('@/src/features/app-shell/postOnboardingRouteStorage', () => ({
  persistPostOnboardingRoute: jest.fn(),
  clearPersistedPostOnboardingRoute: jest.fn(),
  loadPersistedPostOnboardingRoute: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/src/features/onboarding/draftStorage', () => ({
  clearPersistedOnboardingDraft: jest.fn(),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  cancelAllReminderNotifications: jest.fn(),
  reconcileReminderNotifications: jest.fn(),
  reconcileBillingReminderNotification: jest.fn(),
}));

// eslint-disable-next-line import/first
import { reconcileBillingReminderNotification } from '@/src/lib/notifications/reminderScheduler';

const mockReconcileBillingReminderNotification =
  reconcileBillingReminderNotification as jest.MockedFunction<
    typeof reconcileBillingReminderNotification
  >;

beforeEach(() => {
  mockReconcileBillingReminderNotification.mockClear();
});

// eslint-disable-next-line import/first
import { AppShellProvider, useAppShell } from '@/src/features/app-shell/AppShellProvider';
// eslint-disable-next-line import/first
import { applyDevLaunchPreset } from '@/src/testing/devLaunchPreset';

function createRepositoryHarness() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return {
    repositories: createDomainRepositories(db),
    sqlite,
  };
}

function AppEntryProbe() {
  const { isHydrated, state } = useAppShell();

  return <Text>{isHydrated ? resolveAppEntry(state) : 'loading'}</Text>;
}

describe('AppShellProvider repository hydration', () => {
  it('lands completed users in the main app after repository-backed onboarding completion without a purchase snapshot', async () => {
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    harness.sqlite.close();
  });

  it('lands completed users in the main app when a trial-active billing snapshot is cached locally', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'trial_active',
      planId: 'annual',
      firstChargeAt: '2026-06-09T10:00:00.000Z',
      trialEndsAt: '2026-06-09T10:00:00.000Z',
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    harness.sqlite.close();
    dateNowSpy.mockRestore();
  });

  it('keeps completed users in the app when the cached trial access already expired locally', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'trial_active',
      planId: 'annual',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
      trialEndsAt: '2026-05-09T10:00:00.000Z',
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('lands completed users in the main app when paid access is cached locally', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('keeps completed users in the app when cached paid access expired locally', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'expired',
      planId: 'annual',
      expiresAt: '2026-05-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('keeps completed users in the app when a cached recurring subscription already expired locally', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-05-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('keeps legacy complimentary snapshots usable until their cached end date passes', async () => {
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    harness.sqlite
      .prepare(
        "UPDATE billing_snapshot SET access_state = ?, expires_at = ?, last_synced_at = ? WHERE id = ?",
      )
      .run(
        'complimentary_active',
        '2026-06-09T10:00:00.000Z',
        '2026-04-10T12:00:00.000Z',
        'billing-snapshot',
      );

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    harness.sqlite.close();
  });

  it('persists a cleaned grandfather snapshot before reconciling billing reminders', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-06T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'trial_active',
      trialEndsAt: '2026-05-31T00:00:00.000Z',
      firstChargeAt: '2026-05-31T00:00:00.000Z',
      grandfatherTrialApplied: true,
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    expect(mockReconcileBillingReminderNotification).toHaveBeenCalledTimes(1);
    const snapshotArg = mockReconcileBillingReminderNotification.mock.calls[0][0].snapshot;
    expect(snapshotArg.accessState).toBe('trial_active');
    expect(snapshotArg.trialEndsAt).toBe('2026-05-31T00:00:00.000Z');
    expect(snapshotArg.firstChargeAt).toBeUndefined();

    const persistedSnapshot = await mockRepositories.billingSnapshot.getSnapshot();
    expect(persistedSnapshot.trialEndsAt).toBe('2026-05-31T00:00:00.000Z');
    expect(persistedSnapshot.firstChargeAt).toBeUndefined();

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('reconciles with an expired snapshot when the grandfather anchor is older than the trial window', async () => {
    const onboardingCompletedAt = '2026-04-01T00:00:00.000Z';
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      // 40 days after onboarding completion → past the 30-day grandfather trial.
      .mockReturnValue(new Date('2026-05-11T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    await mockRepositories.reviewPromptState.seedOnboardingCompletion(onboardingCompletedAt);

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    expect(mockReconcileBillingReminderNotification).toHaveBeenCalledTimes(1);
    const snapshotArg = mockReconcileBillingReminderNotification.mock.calls[0][0].snapshot;
    expect(snapshotArg.accessState).toBe('expired');

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('reconciles the billing reminder on every hydrate even when no grandfather backfill is applied', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-10T00:00:00.000Z').getTime());
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await mockRepositories.onboarding.completeOnboarding(
      {
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
      },
      {
        ...defaultAppPreferences,
        hasCompletedOnboarding: true,
        deferredReminderSetup: true,
      },
    );
    // An active trial snapshot with a planId is a no-op for the grandfather
    // backfill (grandfathered.changed === false), but the parent must still
    // self-heal the trial-ending reminder on this launch.
    await mockRepositories.billingSnapshot.saveSnapshot({
      accessState: 'trial_active',
      planId: 'annual',
      firstChargeAt: '2026-06-09T10:00:00.000Z',
      trialEndsAt: '2026-06-09T10:00:00.000Z',
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    expect(mockReconcileBillingReminderNotification).toHaveBeenCalledTimes(1);
    const snapshotArg = mockReconcileBillingReminderNotification.mock.calls[0][0].snapshot;
    expect(snapshotArg.accessState).toBe('trial_active');
    expect(snapshotArg.firstChargeAt).toBe('2026-06-09T10:00:00.000Z');

    dateNowSpy.mockRestore();
    harness.sqlite.close();
  });

  it('routes the grandfathered-expired dev launch preset into the app (lock retired)', async () => {
    const harness = createRepositoryHarness();
    mockRepositories = harness.repositories;
    mockIsBiometricLockArmed.mockResolvedValue(false);

    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });

    render(
      <AppShellProvider>
        <AppEntryProbe />
      </AppShellProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('/today')).toBeTruthy();
    });

    const snapshotArg =
      mockReconcileBillingReminderNotification.mock.calls.at(-1)?.[0].snapshot;
    expect(snapshotArg?.accessState).toBe('expired');

    harness.sqlite.close();
  });
});
