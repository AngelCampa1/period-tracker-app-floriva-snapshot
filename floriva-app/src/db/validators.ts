import { z } from 'zod';

import { normalizeBillingSnapshot } from '@/src/features/billing/model';
import {
  birthControlMethodValues,
  bleedingIntensityValues,
  cervicalMucusValues,
  conditionKeyValues,
  importSessionStatusValues,
  importSourceValues,
  iudTypeValues,
  localePreferenceValues,
  moodValueValues,
  ovulationTestValues,
  reminderKindValues,
  billingAccessStateValues,
  type BackupEvent,
  symptomKeyValues,
  subscriptionPlanIdValues,
  themePreferenceValues,
  trackingGoalValues,
} from '@/src/types/domain';

const legacyBillingAccessStateValues = [...billingAccessStateValues, 'complimentary_active'] as const;

const isoDateSchema = z.string().regex(/^[1-9]\d{3}-\d{2}-\d{2}$/);
const isoTimestampSchema = z.string().datetime({ offset: true });

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}

function hasUniqueKeyValues<T>(items: T[], getKey: (item: T) => string) {
  return new Set(items.map(getKey)).size === items.length;
}

export const appPreferencesSchema = z.object({
  hasCompletedOnboarding: z.boolean(),
  deferredCycleSetup: z.boolean().default(false),
  deferredTrackingSetup: z.boolean().default(false),
  deferredBiometricsSetup: z.boolean().default(false),
  deferredReminderSetup: z.boolean().default(false),
  deferredImportSetup: z.boolean().default(false),
  dismissedTailoringChecklist: z.boolean().default(false),
  showFertilityEstimates: z.boolean().default(true),
  hapticsEnabled: z.boolean(),
  tapSoundEnabled: z.boolean(),
  themePreference: z.enum(themePreferenceValues).default('system'),
  localePreference: z.enum(localePreferenceValues).default('system'),
  dismissedAnomalyIds: z.array(z.string()).default([]),
});

export const backupAppPreferencesSchema = appPreferencesSchema.extend({
  hapticsEnabled: z.boolean().default(true),
  tapSoundEnabled: z.boolean().default(false),
});

export const userProfileSchema = z.object({
  cycleLengthDays: z.number().int().min(1).max(120).optional(),
  periodLengthDays: z.number().int().min(1).max(30).optional(),
  lastPeriodStartDate: isoDateSchema.optional(),
  goals: z
    .array(z.enum(trackingGoalValues))
    .min(1)
    .refine(hasUniqueValues, 'Goals must be unique'),
  supportsIrregularCycles: z.boolean(),
  conditionTags: z
    .array(z.enum(conditionKeyValues))
    .refine(hasUniqueValues, 'Condition tags must be unique'),
  ttcTrackingPreferences: z
    .object({
      sex: z.boolean(),
      ovulationTest: z.boolean(),
      cervicalMucus: z.boolean(),
      basalBodyTemperature: z.boolean(),
    })
    .optional(),
  birthControlMethod: z
    .enum(birthControlMethodValues)
    .refine((method) => method !== 'none', 'Birth control setup method cannot be none')
    .optional(),
  iudType: z.enum(iudTypeValues).optional(),
});

export const ttcObservationSchema = z.object({
  cervicalMucus: z.enum(cervicalMucusValues).optional(),
  ovulationTest: z.enum(ovulationTestValues).optional(),
  basalBodyTemperatureCelsius: z.number().min(30).max(45).optional(),
  sexLogged: z.boolean().optional(),
});

export const birthControlEventSchema = z.object({
  method: z.enum(birthControlMethodValues),
  missedDose: z.boolean().optional(),
  lateDose: z.boolean().optional(),
});

export const dailyLogEntrySchema = z.object({
  id: z.string().min(1),
  logDate: isoDateSchema,
  bleeding: z.enum(bleedingIntensityValues),
  symptoms: z
    .array(z.enum(symptomKeyValues))
    .refine(hasUniqueValues, 'Symptoms must be unique'),
  mood: z.enum(moodValueValues).optional(),
  notes: z.string().max(500).optional(),
  ttcObservation: ttcObservationSchema.optional(),
  birthControlEvent: birthControlEventSchema.optional(),
  importSessionId: z.string().min(1).optional(),
});

export const reminderPreferenceSchema = z.object({
  kind: z.enum(reminderKindValues),
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  schedule: z.union([
    z.object({
      cadence: z.literal('daily'),
    }),
    z.object({
      cadence: z.literal('cycle-event'),
      daysBefore: z.number().int().min(0).max(30),
    }),
  ]),
});

export const reminderPreferencesSchema = z
  .array(reminderPreferenceSchema)
  .refine(
    (preferences) => hasUniqueValues(preferences.map((preference) => preference.kind)),
    'Reminder kinds must be unique',
  );

export const privacyPreferenceSchema = z.object({
  biometricsEnabled: z.boolean(),
  relockAfterSeconds: z.number().int().min(0).max(86400),
  destructiveActionConfirmationRequired: z.boolean(),
  diagnosticsConsentEnabled: z.boolean(),
});

export const reviewPromptStateSchema = z.object({
  onboardingCompletedAt: isoTimestampSchema.optional(),
  automaticPromptCount: z.number().int().min(0).max(3),
  lastAutomaticPromptAt: isoTimestampSchema.optional(),
  suppressAutomaticPrompts: z.boolean(),
  lastManualStoreOpenAt: isoTimestampSchema.optional(),
});

export const billingSnapshotSchema = z
  .object({
    accessState: z.enum(legacyBillingAccessStateValues),
    planId: z.enum(subscriptionPlanIdValues).optional(),
    trialEndsAt: isoTimestampSchema.optional(),
    firstChargeAt: isoTimestampSchema.optional(),
    expiresAt: isoTimestampSchema.optional(),
    lastSyncedAt: isoTimestampSchema.optional(),
    reminderScheduledFor: isoTimestampSchema.optional(),
    grandfatherTrialApplied: z.boolean().optional(),
    lifetimeTrialStartedAt: isoTimestampSchema.optional(),
  })
  .transform((snapshot) => normalizeBillingSnapshot(snapshot));

export const importSessionSchema = z.object({
  id: z.string().min(1),
  source: z.enum(importSourceValues),
  status: z.enum(importSessionStatusValues),
  startedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.optional(),
  importedLogCount: z.number().int().min(0),
  skippedLogCount: z.number().int().min(0),
});

export const backupEventSchema: z.ZodType<BackupEvent> = z.object({
  id: z.string().min(1),
  action: z.enum(['exported', 'restored']),
  occurredAt: isoTimestampSchema,
  detail: z.string().min(1).max(200),
});

export const backupSnapshotSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: isoTimestampSchema,
  appPreferences: backupAppPreferencesSchema,
  billingSnapshot: billingSnapshotSchema,
  userProfile: userProfileSchema.nullable(),
  reminderPreferences: reminderPreferencesSchema,
  privacyPreference: privacyPreferenceSchema,
  importSessions: z
    .array(importSessionSchema)
    .refine(
      (sessions) => hasUniqueKeyValues(sessions, (session) => session.id),
      'Import session ids must be unique',
    ),
  dailyLogs: z
    .array(dailyLogEntrySchema)
    .refine((logs) => hasUniqueKeyValues(logs, (log) => log.id), 'Daily log ids must be unique')
    .refine(
      (logs) => hasUniqueKeyValues(logs, (log) => log.logDate),
      'Daily log dates must be unique',
    ),
});

export const backupEnvelopeSchema = z.object({
  formatVersion: z.literal(1),
  createdAt: isoTimestampSchema,
  kdf: z.object({
    algorithm: z.literal('pbkdf2-sha256'),
    iterations: z.number().int().positive(),
    saltBase64: z.string().min(1),
  }),
  encryption: z.object({
    algorithm: z.literal('aes-256-gcm'),
    nonceBase64: z.string().min(1),
    ciphertextBase64: z.string().min(1),
    keyCheckBase64: z.string().min(1),
  }),
});
