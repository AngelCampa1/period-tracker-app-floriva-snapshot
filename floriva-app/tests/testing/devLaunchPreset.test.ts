import { resolveSaveOffer } from '@/src/features/billing/saveOffer/model';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { buildTenureDataset, tenureFixtureVariantValues } from '@/src/testing/tenureFixtures';
import { buildQaRichHistoryDataset } from '@/src/testing/qaFixtures';
import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';

const mockPersistPostOnboardingRoute = jest.fn();
const mockClearPersistedPostOnboardingRoute = jest.fn();
const mockClearPersistedOnboardingDraft = jest.fn();
const mockArmBiometricLock = jest.fn();
const mockClearBiometricLock = jest.fn();
const environment = process.env as Record<string, string | undefined>;
const originalLaunchPreset = process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET;
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };

jest.mock('@/src/features/app-shell/postOnboardingRouteStorage', () => ({
  persistPostOnboardingRoute: (...args: unknown[]) => mockPersistPostOnboardingRoute(...args),
  clearPersistedPostOnboardingRoute: (...args: unknown[]) =>
    mockClearPersistedPostOnboardingRoute(...args),
}));

jest.mock('@/src/features/onboarding/draftStorage', () => ({
  clearPersistedOnboardingDraft: (...args: unknown[]) =>
    mockClearPersistedOnboardingDraft(...args),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  armBiometricLock: (...args: unknown[]) => mockArmBiometricLock(...args),
  clearBiometricLock: (...args: unknown[]) => mockClearBiometricLock(...args),
}));

// eslint-disable-next-line import/first
import {
  applyDevLaunchPreset,
  isDevLaunchPresetAllowed,
  resolveDevLaunchPreset,
} from '@/src/testing/devLaunchPreset';

describe('devLaunchPreset', () => {
  const originalDevFlag = devGlobal.__DEV__;

  beforeEach(() => {
    mockPersistPostOnboardingRoute.mockReset();
    mockClearPersistedPostOnboardingRoute.mockReset();
    mockClearPersistedOnboardingDraft.mockReset();
    mockArmBiometricLock.mockReset();
    mockClearBiometricLock.mockReset();
    mockPersistPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPersistedPostOnboardingRoute.mockResolvedValue(undefined);
    mockClearPersistedOnboardingDraft.mockResolvedValue(undefined);
    mockArmBiometricLock.mockResolvedValue(undefined);
    mockClearBiometricLock.mockResolvedValue(undefined);
    delete environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET;
    devGlobal.__DEV__ = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalLaunchPreset === undefined) {
      delete environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET;
    } else {
      environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET = originalLaunchPreset;
    }
    devGlobal.__DEV__ = originalDevFlag;
  });

  it('accepts the supported preset names and ignores unknown values', () => {
    expect(resolveDevLaunchPreset('seeded-tracker')).toBe('seeded-tracker');
    expect(resolveDevLaunchPreset('qa-rich-history')).toBe('qa-rich-history');
    expect(resolveDevLaunchPreset('locked-app')).toBe('locked-app');
    expect(resolveDevLaunchPreset('import-ready')).toBe('import-ready');
    expect(resolveDevLaunchPreset('backup-ready')).toBe('backup-ready');
    expect(resolveDevLaunchPreset('billing-fallback')).toBe('billing-fallback');
    expect(resolveDevLaunchPreset('grandfathered-expired')).toBe('grandfathered-expired');
    expect(resolveDevLaunchPreset('save-offer-monthly-active')).toBe('save-offer-monthly-active');
    expect(resolveDevLaunchPreset('save-offer-monthly-trial')).toBe('save-offer-monthly-trial');
    expect(resolveDevLaunchPreset('save-offer-annual-active')).toBe('save-offer-annual-active');
    expect(resolveDevLaunchPreset('save-offer-annual-trial')).toBe('save-offer-annual-trial');
    expect(resolveDevLaunchPreset('save-offer-lifetime')).toBe('save-offer-lifetime');
    expect(resolveDevLaunchPreset('tenure-1mo-new')).toBe('tenure-1mo-new');
    expect(resolveDevLaunchPreset('tenure-3mo-regular')).toBe('tenure-3mo-regular');
    expect(resolveDevLaunchPreset('tenure-6mo-gap')).toBe('tenure-6mo-gap');
    expect(resolveDevLaunchPreset('tenure-12mo-regular')).toBe('tenure-12mo-regular');
    expect(resolveDevLaunchPreset('tenure-12mo-irregular')).toBe('tenure-12mo-irregular');
    expect(resolveDevLaunchPreset('tenure-lapsed')).toBe('tenure-lapsed');
    expect(resolveDevLaunchPreset('unknown')).toBeNull();
  });

  it('ignores ambient launch-preset environment in the Jest test environment', () => {
    environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET = 'locked-app';

    expect(resolveDevLaunchPreset()).toBeNull();
  });

  it('rejects deterministic presets in ordinary non-development builds', () => {
    expect(
      isDevLaunchPresetAllowed({
        candidate: 'qa-rich-history',
        isDev: false,
        nodeEnv: 'production',
        screenshotCandidateEnabled: false,
      }),
    ).toBe(false);
  });

  it('allows deterministic presets in a compiled screenshot-candidate build only', () => {
    expect(
      isDevLaunchPresetAllowed({
        candidate: 'qa-rich-history',
        isDev: false,
        nodeEnv: 'production',
        screenshotCandidateEnabled: true,
      }),
    ).toBe(true);
  });

  it('leaves the device empty for the fresh-install preset', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'fresh-install',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.userProfile.getProfile()).resolves.toBeNull();
    expect(mockPersistPostOnboardingRoute).not.toHaveBeenCalled();
    expect(mockArmBiometricLock).not.toHaveBeenCalled();

    harness.close();
  });

  it('seeds a locked app preset through repositories and lock artifacts', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'locked-app',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.userProfile.getProfile()).resolves.toEqual(
      expect.objectContaining({
        goals: ['period', 'symptoms'],
      }),
    );
    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accessState: 'trial_active',
      }),
    );
    await expect(harness.repositories.privacyPreferences.getPreference()).resolves.toEqual(
      expect.objectContaining({
        biometricsEnabled: true,
      }),
    );
    expect(mockArmBiometricLock).toHaveBeenCalledTimes(1);

    harness.close();
  });

  it('queues backup as the post-onboarding entry route for the backup-ready preset', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'backup-ready',
      repositories: harness.repositories,
    });

    expect(mockPersistPostOnboardingRoute).toHaveBeenCalledWith('/backup/restore');
    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accessState: 'trial_active',
      }),
    );

    harness.close();
  });

  it('queues seeded import review as the post-onboarding entry route for the import-ready preset', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'import-ready',
      repositories: harness.repositories,
    });

    expect(mockPersistPostOnboardingRoute).toHaveBeenCalledWith('/import/review');

    harness.close();
  });

  it('seeds a purchase-required snapshot for the billing-fallback preset', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'billing-fallback',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accessState: 'needs_purchase',
      }),
    );

    harness.close();
  });

  it('seeds an expired grandfathered user for the grandfathered-expired preset', async () => {
    const harness = await createWave5AcceptanceHarness();

    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.userProfile.getProfile()).resolves.toEqual(
      expect.objectContaining({
        goals: ['period', 'symptoms'],
      }),
    );
    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accessState: 'needs_purchase',
      }),
    );
    const snapshot = await harness.repositories.billingSnapshot.getSnapshot();
    expect(snapshot.grandfatherTrialApplied).not.toBe(true);

    const reviewPromptState = await harness.repositories.reviewPromptState.getState();
    expect(reviewPromptState.onboardingCompletedAt).toBeDefined();
    const ageDays =
      (Date.now() - new Date(reviewPromptState.onboardingCompletedAt as string).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(40);
    expect(ageDays).toBeLessThan(50);

    expect(mockArmBiometricLock).not.toHaveBeenCalled();
    expect(mockPersistPostOnboardingRoute).not.toHaveBeenCalled();

    harness.close();
  });

  it('preserves an already-unlocked snapshot when grandfathered-expired is re-applied (cold relaunch after a started trial)', async () => {
    const harness = await createWave5AcceptanceHarness();

    // First apply seeds the expired, fully-locked grandfathered state.
    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });
    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({ accessState: 'needs_purchase' }),
    );

    // The user starts the app-level lifetime trial in-session (Flow 1): the
    // persisted snapshot advances to trial_active with a durable marker.
    await harness.repositories.billingSnapshot.saveSnapshot({
      accessState: 'trial_active',
      planId: 'lifetime',
      lifetimeTrialStartedAt: new Date().toISOString(),
    });

    // A cold relaunch WITHOUT deleting the container re-runs the baked preset. It
    // must NOT wipe the user's unlocked trial back to the expired lock -- that is
    // exactly the state the app's persistence is expected to preserve in
    // production, where there is no preset re-seed.
    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({ accessState: 'trial_active', planId: 'lifetime' }),
    );

    harness.close();
  });

  it('still re-seeds grandfathered-expired when the container never unlocked (no user progress)', async () => {
    const harness = await createWave5AcceptanceHarness();

    // A still-locked container (needs_purchase) must re-seed on re-apply: a
    // relaunch that never unlocked has to remain fully locked, not slip open.
    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });
    await applyDevLaunchPreset({
      preset: 'grandfathered-expired',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.billingSnapshot.getSnapshot()).resolves.toEqual(
      expect.objectContaining({ accessState: 'needs_purchase' }),
    );

    harness.close();
  });

  it('seeds a richer QA tracker preset anchored to runtime-today with TTC, birth-control, and condition history', async () => {
    const harness = await createWave5AcceptanceHarness();
    // The live path anchors the rich-history fixture to runtime-today, so the
    // expectations are derived from the same anchored dataset rather than the
    // fixture's original hardcoded 2026 dates.
    const expectedDataset = buildQaRichHistoryDataset(getLocalTodayLogDate());

    await applyDevLaunchPreset({
      preset: 'qa-rich-history',
      repositories: harness.repositories,
    });

    await expect(harness.repositories.userProfile.getProfile()).resolves.toEqual(
      expect.objectContaining({
        goals: ['period', 'symptoms', 'trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: ['pcos', 'pmdd', 'endometriosis'],
      }),
    );

    const anchoredOpkLog = expectedDataset.dailyLogs.find(
      (entry) => entry.ttcObservation?.ovulationTest === 'positive',
    );
    const anchoredBirthControlLog = expectedDataset.dailyLogs.find(
      (entry) => entry.birthControlEvent?.method === 'pill',
    );
    expect(anchoredOpkLog).toBeDefined();
    expect(anchoredBirthControlLog).toBeDefined();

    const earliestLogDate = expectedDataset.dailyLogs[0]?.logDate;
    const latestLogDate = expectedDataset.dailyLogs.at(-1)?.logDate;
    expect(earliestLogDate).toBeDefined();
    expect(latestLogDate).toBeDefined();

    const seededLogs = await harness.repositories.dailyLogs.listByDateRange(
      earliestLogDate!,
      latestLogDate!,
    );
    expect(seededLogs).toHaveLength(expectedDataset.dailyLogs.length);
    expect(seededLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          logDate: anchoredOpkLog!.logDate,
          ttcObservation: expect.objectContaining({
            sexLogged: true,
            ovulationTest: 'positive',
          }),
        }),
        expect.objectContaining({
          logDate: anchoredBirthControlLog!.logDate,
          birthControlEvent: expect.objectContaining({
            method: 'pill',
          }),
        }),
      ]),
    );
    await expect(harness.repositories.reminderPreferences.getPreferences()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'birth-control',
          enabled: true,
        }),
      ]),
    );

    harness.close();
  });

  const saveOfferConfig = {
    monthlyPriceLabel: '$5.99/month',
    annualPriceLabel: '$39.99/year',
    saveOffers: {
      monthly: {
        discountedPriceLabel: '$1.20/month',
        iosOfferCode: 'SAVEMONTHLY',
        androidOfferId: 'save-monthly-80-3mo',
      },
      annual: {
        discountedPriceLabel: '$27.99',
        iosOfferCode: 'SAVEANNUAL',
        androidOfferId: 'save-annual-30',
      },
    },
  };

  const saveOfferPresetCases = [
    {
      preset: 'save-offer-monthly-active' as const,
      accessState: 'subscribed',
      planId: 'monthly',
      hasTrialFields: false,
      expectedKind: 'monthly80' as const,
    },
    {
      preset: 'save-offer-monthly-trial' as const,
      accessState: 'trial_active',
      planId: 'monthly',
      hasTrialFields: true,
      expectedKind: 'monthly80' as const,
    },
    {
      preset: 'save-offer-annual-active' as const,
      accessState: 'subscribed',
      planId: 'annual',
      hasTrialFields: false,
      expectedKind: 'annual30' as const,
    },
    {
      preset: 'save-offer-annual-trial' as const,
      accessState: 'trial_active',
      planId: 'annual',
      hasTrialFields: true,
      expectedKind: 'annual30trial' as const,
    },
    {
      preset: 'save-offer-lifetime' as const,
      accessState: 'subscribed',
      planId: 'lifetime',
      hasTrialFields: false,
      expectedKind: null,
    },
  ];

  it.each(saveOfferPresetCases)(
    'seeds an onboarded $accessState/$planId user for the $preset preset',
    async ({ preset, accessState, planId, hasTrialFields, expectedKind }) => {
      const harness = await createWave5AcceptanceHarness();

      await applyDevLaunchPreset({
        preset,
        repositories: harness.repositories,
      });

      await expect(harness.repositories.userProfile.getProfile()).resolves.toEqual(
        expect.objectContaining({
          goals: ['period', 'symptoms'],
        }),
      );
      await expect(harness.repositories.appPreferences.getPreferences()).resolves.toEqual(
        expect.objectContaining({
          hasCompletedOnboarding: true,
        }),
      );

      const snapshot = await harness.repositories.billingSnapshot.getSnapshot();
      expect(snapshot.accessState).toBe(accessState);
      expect(snapshot.planId).toBe(planId);
      expect(snapshot.lastSyncedAt).toBeDefined();
      expect(snapshot.saveOfferRedeemedAt).toBeUndefined();
      if (hasTrialFields) {
        expect(snapshot.trialEndsAt).toBeDefined();
        expect(snapshot.firstChargeAt).toBeDefined();
        expect(snapshot.expiresAt).toBeDefined();
      } else {
        expect(snapshot.trialEndsAt).toBeUndefined();
      }
      if (planId === 'lifetime') {
        expect(snapshot.expiresAt).toBeUndefined();
      }

      expect(mockArmBiometricLock).not.toHaveBeenCalled();
      expect(mockPersistPostOnboardingRoute).not.toHaveBeenCalled();

      const offer = resolveSaveOffer(snapshot, 'ios', saveOfferConfig);
      if (expectedKind === null) {
        expect(offer).toBeNull();
      } else {
        expect(offer?.kind).toBe(expectedKind);
      }

      harness.close();
    },
  );

  it.each(tenureFixtureVariantValues)(
    'seeds the %s preset through real repositories using buildTenureDataset',
    async (preset) => {
      const harness = await createWave5AcceptanceHarness();
      const todayIso = getLocalTodayLogDate();
      const expectedDataset = buildTenureDataset(preset, todayIso);

      await applyDevLaunchPreset({
        preset,
        repositories: harness.repositories,
      });

      await expect(harness.repositories.userProfile.getProfile()).resolves.toEqual(
        expect.objectContaining({
          cycleLengthDays: expectedDataset.profile.cycleLengthDays,
          goals: expectedDataset.profile.goals,
        }),
      );

      const earliestLogDate = expectedDataset.dailyLogs[0]?.logDate;
      const latestLogDate = expectedDataset.dailyLogs.at(-1)?.logDate;
      expect(earliestLogDate).toBeDefined();
      expect(latestLogDate).toBeDefined();

      await expect(
        harness.repositories.dailyLogs.listByDateRange(earliestLogDate!, latestLogDate!),
      ).resolves.toHaveLength(expectedDataset.dailyLogs.length);

      await expect(harness.repositories.reminderPreferences.getPreferences()).resolves.toEqual(
        expect.arrayContaining(
          expectedDataset.reminderPreferences.map((reminder) =>
            expect.objectContaining({ kind: reminder.kind, enabled: reminder.enabled }),
          ),
        ),
      );

      await expect(harness.repositories.appPreferences.getPreferences()).resolves.toEqual(
        expect.objectContaining({ hasCompletedOnboarding: true }),
      );

      expect(mockPersistPostOnboardingRoute).not.toHaveBeenCalled();

      harness.close();
    },
  );
});
