import type {
  AppPreferences,
  BillingSnapshot,
  PrivacyPreference,
  ReviewPromptState,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';

export const appPreferencesRowId = 'app-preferences';
export const billingSnapshotRowId = 'billing-snapshot';
export const privacyPreferencesRowId = 'privacy-preferences';
export const reviewPromptStateRowId = 'review-prompt-state';
export const userProfileRowId = 'primary-profile';

export const defaultAppPreferences: AppPreferences = {
  hasCompletedOnboarding: false,
  deferredCycleSetup: false,
  deferredTrackingSetup: false,
  deferredBiometricsSetup: false,
  deferredReminderSetup: false,
  deferredImportSetup: false,
  dismissedTailoringChecklist: false,
  showFertilityEstimates: true,
  hapticsEnabled: true,
  tapSoundEnabled: false,
  themePreference: 'system',
  localePreference: 'system',
  dismissedAnomalyIds: [],
};

export const defaultBillingSnapshot: BillingSnapshot = {
  accessState: 'needs_purchase',
};

export const defaultTtcTrackingPreferences = {
  sex: false,
  ovulationTest: false,
  cervicalMucus: false,
  basalBodyTemperature: false,
} as const;

export const defaultUserProfile: UserProfile = {
  cycleLengthDays: 29,
  periodLengthDays: 5,
  goals: ['period', 'symptoms'],
  supportsIrregularCycles: true,
  conditionTags: [],
  ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
  birthControlMethod: undefined,
};

export const defaultReminderPreferences: ReminderPreference[] = [
  {
    kind: 'daily-log',
    enabled: false,
    hour: 20,
    minute: 0,
    schedule: {
      cadence: 'daily',
    },
  },
  {
    kind: 'period-start',
    enabled: false,
    hour: 9,
    minute: 0,
    schedule: {
      cadence: 'cycle-event',
      daysBefore: 0,
    },
  },
  {
    kind: 'fertile-window',
    enabled: false,
    hour: 9,
    minute: 0,
    schedule: {
      cadence: 'cycle-event',
      daysBefore: 1,
    },
  },
  {
    kind: 'birth-control',
    enabled: false,
    hour: 8,
    minute: 0,
    schedule: {
      cadence: 'daily',
    },
  },
];

export function mergeReminderPreferences(preferences: ReminderPreference[]) {
  return defaultReminderPreferences.map(
    (defaultReminder) =>
      preferences.find((preference) => preference.kind === defaultReminder.kind) ??
      defaultReminder,
  );
}

export const defaultPrivacyPreference: PrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
};

export const defaultReviewPromptState: ReviewPromptState = {
  onboardingCompletedAt: undefined,
  automaticPromptCount: 0,
  lastAutomaticPromptAt: undefined,
  suppressAutomaticPrompts: false,
  lastManualStoreOpenAt: undefined,
};
