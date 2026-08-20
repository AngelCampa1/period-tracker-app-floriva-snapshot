import Constants from 'expo-constants';

import {
  defaultAppPreferences,
  defaultBillingSnapshot,
  defaultPrivacyPreference,
  defaultReminderPreferences,
} from '@/src/db/domainDefaults';
import type { DomainRepositories } from '@/src/db/contracts';
import {
  clearPersistedPostOnboardingRoute,
  persistPostOnboardingRoute,
} from '@/src/features/app-shell/postOnboardingRouteStorage';
import { clearPersistedOnboardingDraft } from '@/src/features/onboarding/draftStorage';
import { armBiometricLock, clearBiometricLock } from '@/src/lib/security/biometricLock';
import { buildQaRichHistoryDataset } from '@/src/testing/qaFixtures';
import {
  buildTenureDataset,
  tenureFixtureVariantValues,
  type TenureFixtureVariant,
} from '@/src/testing/tenureFixtures';
import { resolveQaFixtureToday } from '@/src/testing/qaFixtureClock';
import type {
  BillingSnapshot,
  DailyLogEntry,
  DevLaunchPreset,
  ReminderPreference,
  PostOnboardingRoute,
  SubscriptionPlanId,
  UserProfile,
} from '@/src/types/domain';

const supportedDevLaunchPresets = new Set<DevLaunchPreset>([
  'fresh-install',
  'seeded-tracker',
  'qa-rich-history',
  'locked-app',
  'import-ready',
  'backup-ready',
  'billing-fallback',
  'grandfathered-expired',
  'save-offer-monthly-active',
  'save-offer-monthly-trial',
  'save-offer-annual-active',
  'save-offer-annual-trial',
  'save-offer-lifetime',
  ...tenureFixtureVariantValues,
]);

const tenureFixtureVariantSet = new Set<DevLaunchPreset>(tenureFixtureVariantValues);

function isTenureFixturePreset(preset: DevLaunchPreset): preset is TenureFixtureVariant {
  return tenureFixtureVariantSet.has(preset);
}

const GRANDFATHERED_ONBOARDING_AGE_DAYS = 45;

// QA-only save-offer presets: each seeds an onboarded user whose billing
// snapshot lands the human directly in one cancellation save-offer scenario.
const saveOfferPresetSeeds: Partial<
  Record<DevLaunchPreset, { accessState: BillingSnapshot['accessState']; planId: SubscriptionPlanId }>
> = {
  'save-offer-monthly-active': { accessState: 'subscribed', planId: 'monthly' },
  'save-offer-monthly-trial': { accessState: 'trial_active', planId: 'monthly' },
  'save-offer-annual-active': { accessState: 'subscribed', planId: 'annual' },
  'save-offer-annual-trial': { accessState: 'trial_active', planId: 'annual' },
  'save-offer-lifetime': { accessState: 'subscribed', planId: 'lifetime' },
};

const seededUserProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-02',
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: true,
  conditionTags: ['pmdd'],
  ttcTrackingPreferences: {
    sex: false,
    ovulationTest: false,
    cervicalMucus: false,
    basalBodyTemperature: false,
  },
};

const seededDailyLogs: DailyLogEntry[] = [
  {
    id: 'daily-log-2026-04-02',
    logDate: '2026-04-02',
    bleeding: 'medium',
    symptoms: ['cramps'],
    mood: 'low',
    notes: 'Preset seed day 1',
  },
  {
    id: 'daily-log-2026-04-03',
    logDate: '2026-04-03',
    bleeding: 'light',
    symptoms: ['fatigue'],
    mood: 'steady',
    notes: 'Preset seed day 2',
  },
];

export function isDevLaunchPresetAllowed({
  candidate,
  isDev,
  nodeEnv,
  screenshotCandidateEnabled,
}: {
  candidate?: string | null;
  isDev: boolean;
  nodeEnv?: string;
  screenshotCandidateEnabled: boolean;
}) {
  if (nodeEnv === 'test') {
    return candidate != null;
  }

  return isDev || (screenshotCandidateEnabled && candidate != null);
}

function buildSeededBillingSnapshot(
  accessState: BillingSnapshot['accessState'],
  planId?: SubscriptionPlanId,
): BillingSnapshot {
  if (accessState === 'trial_active') {
    const now = new Date(Date.now());
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    return {
      accessState: 'trial_active',
      planId: planId ?? 'annual',
      trialEndsAt: trialEndsAt.toISOString(),
      firstChargeAt: trialEndsAt.toISOString(),
      expiresAt: trialEndsAt.toISOString(),
      lastSyncedAt: now.toISOString(),
    };
  }

  if (accessState === 'subscribed') {
    const now = new Date(Date.now());

    // Lifetime has no expiry/trial fields; recurring plans expire ~30 days out.
    if (planId === 'lifetime') {
      return {
        accessState: 'subscribed',
        planId: 'lifetime',
        lastSyncedAt: now.toISOString(),
      };
    }

    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    return {
      accessState: 'subscribed',
      planId: planId ?? 'annual',
      expiresAt: expiresAt.toISOString(),
      lastSyncedAt: now.toISOString(),
    };
  }

  return {
    ...defaultBillingSnapshot,
    accessState,
  };
}

async function seedCompletedUser(
  repositories: DomainRepositories,
  accessState: BillingSnapshot['accessState'],
  planId: SubscriptionPlanId | undefined = undefined,
  seedProfile: UserProfile = seededUserProfile,
  seedDailyLogs: DailyLogEntry[] = seededDailyLogs,
  seedReminderPreferences: ReminderPreference[] = [
    {
      ...defaultReminderPreferences[0],
      enabled: true,
    },
    ...defaultReminderPreferences.slice(1),
  ],
) {
  await repositories.onboarding.completeOnboarding(seedProfile, {
    ...defaultAppPreferences,
    hasCompletedOnboarding: true,
    deferredBiometricsSetup: true,
    deferredReminderSetup: true,
    deferredImportSetup: false,
  });
  await repositories.billingSnapshot.saveSnapshot(buildSeededBillingSnapshot(accessState, planId));
  await repositories.reminderPreferences.savePreferences(seedReminderPreferences);

  for (const dailyLog of seedDailyLogs) {
    await repositories.dailyLogs.saveEntry(dailyLog);
  }
}

async function resetDevLaunchArtifacts(repositories: DomainRepositories) {
  await repositories.localDataMaintenance.wipeLocalData();
  await Promise.all([
    clearPersistedPostOnboardingRoute(),
    clearPersistedOnboardingDraft(),
    clearBiometricLock(),
  ]);
}

async function queuePostOnboardingRoute(route: PostOnboardingRoute) {
  await persistPostOnboardingRoute(route);
}

export function resolveDevLaunchPreset(candidate?: string | null): DevLaunchPreset | null {
  const extra = Constants.expoConfig?.extra as
    | { devLaunchPreset?: string | null; screenshotCandidateEnabled?: boolean }
    | undefined;

  const configuredCandidate =
    candidate ??
    (extra?.devLaunchPreset ?? process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null);

  const accessCandidate = process.env.NODE_ENV === 'test' ? candidate : configuredCandidate;
  if (
    !isDevLaunchPresetAllowed({
      candidate: accessCandidate,
      isDev: __DEV__,
      nodeEnv: process.env.NODE_ENV,
      screenshotCandidateEnabled: extra?.screenshotCandidateEnabled === true,
    })
  ) {
    return null;
  }

  return configuredCandidate && supportedDevLaunchPresets.has(configuredCandidate as DevLaunchPreset)
    ? (configuredCandidate as DevLaunchPreset)
    : null;
}

export async function applyDevLaunchPreset({
  preset,
  repositories,
}: {
  preset: DevLaunchPreset;
  repositories: DomainRepositories;
}) {
  // Preservation guard for the expired-billing presets. `grandfathered-expired`
  // and `billing-fallback` seed a fully-locked `needs_purchase` state. The
  // preset re-runs on every DatabaseProvider mount, so a cold relaunch that
  // preserves the container (Detox `delete: false`, or a real process death)
  // would otherwise wipe a trial/subscription the user started in a prior
  // session -- destroying exactly the persisted access the app is expected to
  // keep. Production never re-seeds a preset, so mirror that: if the persisted
  // snapshot already shows active access, treat the re-apply as a no-op. A
  // fresh/relocked container (needs_purchase / expired / delete:true wipe) is
  // unaffected and still seeds normally.
  if (preset === 'grandfathered-expired' || preset === 'billing-fallback') {
    const existingSnapshot = await repositories.billingSnapshot.getSnapshot();

    if (
      existingSnapshot.accessState === 'trial_active' ||
      existingSnapshot.accessState === 'subscribed'
    ) {
      return;
    }
  }

  await resetDevLaunchArtifacts(repositories);

  if (preset === 'fresh-install') {
    return;
  }

  const saveOfferSeed = saveOfferPresetSeeds[preset];

  let accessState: BillingSnapshot['accessState'];
  let planId: SubscriptionPlanId | undefined;
  if (saveOfferSeed) {
    accessState = saveOfferSeed.accessState;
    planId = saveOfferSeed.planId;
  } else if (preset === 'billing-fallback' || preset === 'grandfathered-expired') {
    accessState = 'needs_purchase';
    planId = undefined;
  } else {
    accessState = 'trial_active';
    planId = undefined;
  }

  // Long-tenure QA presets (workstream E, 1.2.0): deterministic multi-month
  // seeded histories built from `buildTenureDataset`, anchored on the
  // runtime "today" (never a hardcoded date) so the seeded data always looks
  // current when the dev build is actually launched.
  // `resolveQaFixtureToday()` is the runtime today for interactive launches, or
  // a pinned reference under Detox (EXPO_PUBLIC_QA_FIXTURE_TODAY) so e2e runs are
  // deterministic and date-embedded testIDs stay stable.
  const fixtureToday = resolveQaFixtureToday();
  const tenureDataset = isTenureFixturePreset(preset)
    ? buildTenureDataset(preset, fixtureToday)
    : null;

  // The rich-history QA preset is also anchored on the fixture "today" (never a
  // hardcoded date) so the seeded history always looks current when the dev
  // build is actually launched, mirroring the tenure presets above.
  const qaRichHistoryDataset =
    preset === 'qa-rich-history' ? buildQaRichHistoryDataset(fixtureToday) : null;

  await seedCompletedUser(
    repositories,
    accessState,
    planId,
    tenureDataset
      ? tenureDataset.profile
      : qaRichHistoryDataset
        ? qaRichHistoryDataset.profile
        : seededUserProfile,
    tenureDataset
      ? tenureDataset.dailyLogs
      : qaRichHistoryDataset
        ? qaRichHistoryDataset.dailyLogs
        : seededDailyLogs,
    tenureDataset
      ? tenureDataset.reminderPreferences
      : qaRichHistoryDataset
        ? qaRichHistoryDataset.reminderPreferences
        : [
            {
              ...defaultReminderPreferences[0],
              enabled: true,
            },
            ...defaultReminderPreferences.slice(1),
          ],
  );

  if (tenureDataset) {
    return;
  }

  if (preset === 'grandfathered-expired') {
    // Anchor onboarding completion ~45 days ago so the grandfather backfill
    // seeds a trial_active snapshot whose 30-day window has already elapsed,
    // which normalizeBillingSnapshot then downgrades to `expired` (full lock).
    const anchoredCompletedAt = new Date(
      Date.now() - GRANDFATHERED_ONBOARDING_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    await repositories.reviewPromptState.seedOnboardingCompletion(anchoredCompletedAt);
    return;
  }

  if (preset === 'locked-app') {
    await repositories.privacyPreferences.savePreference({
      ...defaultPrivacyPreference,
      biometricsEnabled: true,
      // Relock immediately on resume so e2e can deterministically observe the
      // fail-closed resume path without waiting out the production grace window.
      relockAfterSeconds: 0,
    });
    await armBiometricLock();
    return;
  }

  if (preset === 'import-ready') {
    await queuePostOnboardingRoute('/import/review');
    return;
  }

  if (preset === 'backup-ready') {
    await queuePostOnboardingRoute('/backup/restore');
  }
}
