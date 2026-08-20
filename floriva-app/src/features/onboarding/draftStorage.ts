import * as SecureStore from 'expo-secure-store';

import { defaultTtcTrackingPreferences } from '@/src/db/domainDefaults';
import type { OnboardingDraft } from '@/src/features/onboarding/model';
import {
  conditionKeyValues,
  trackingGoalValues,
} from '@/src/types/domain';

const ONBOARDING_DRAFT_STORAGE_KEY = 'floriva.onboarding-draft.v1';
const onboardingStartPathValues = ['fresh', 'import', 'restore'] as const;
const setupLaterChoiceValues = ['skip', 'later', 'now'] as const;
const ttcTrackingPresetValues = ['basic', 'full'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function readBooleanOrNull(value: unknown) {
  return value === null ? null : readBoolean(value);
}

function readStringArray<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): T[number][] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is T[number] =>
    typeof item === 'string' && allowedValues.includes(item as T[number]),
  );
}

function readEnumValue<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): T[number] | undefined {
  return typeof value === 'string' && allowedValues.includes(value as T[number])
    ? (value as T[number])
    : undefined;
}

function sanitizePersistedOnboardingDraft(value: unknown): Partial<OnboardingDraft> | null {
  if (!isRecord(value)) {
    return null;
  }

  const ttcTrackingPreferences = isRecord(value.ttcTrackingPreferences)
    ? {
        sex:
          typeof value.ttcTrackingPreferences.sex === 'boolean'
            ? value.ttcTrackingPreferences.sex
            : defaultTtcTrackingPreferences.sex,
        ovulationTest:
          typeof value.ttcTrackingPreferences.ovulationTest === 'boolean'
            ? value.ttcTrackingPreferences.ovulationTest
            : defaultTtcTrackingPreferences.ovulationTest,
        cervicalMucus:
          typeof value.ttcTrackingPreferences.cervicalMucus === 'boolean'
            ? value.ttcTrackingPreferences.cervicalMucus
            : defaultTtcTrackingPreferences.cervicalMucus,
        basalBodyTemperature:
          typeof value.ttcTrackingPreferences.basalBodyTemperature === 'boolean'
            ? value.ttcTrackingPreferences.basalBodyTemperature
            : defaultTtcTrackingPreferences.basalBodyTemperature,
      }
    : undefined;

  const sanitizedDraft: Partial<OnboardingDraft> = {
    cycleLengthInput: readString(value.cycleLengthInput),
    hasConfirmedCycleLength: readBoolean(value.hasConfirmedCycleLength),
    periodLengthInput: readString(value.periodLengthInput),
    hasConfirmedPeriodLength: readBoolean(value.hasConfirmedPeriodLength),
    lastPeriodStartDate: readString(value.lastPeriodStartDate),
    goals: readStringArray(value.goals, trackingGoalValues),
    supportsIrregularCycles: readBooleanOrNull(value.supportsIrregularCycles),
    conditionTags: readStringArray(value.conditionTags, conditionKeyValues),
    ttcTrackingPreferences,
    reminderSetupChoice: readEnumValue(value.reminderSetupChoice, setupLaterChoiceValues),
    importSetupChoice: readEnumValue(value.importSetupChoice, setupLaterChoiceValues),
    biometricsSetupChoice: readEnumValue(value.biometricsSetupChoice, setupLaterChoiceValues),
    startPath: readEnumValue(value.startPath, onboardingStartPathValues),
    hasSelectedFreshPath: readBoolean(value.hasSelectedFreshPath),
    symptomLoggingEnabled: readBooleanOrNull(value.symptomLoggingEnabled),
    ttcEnabled: readBooleanOrNull(value.ttcEnabled),
    ttcTrackingPreset: readEnumValue(value.ttcTrackingPreset, ttcTrackingPresetValues),
    hasCompletedTtcSetupStep: readBoolean(value.hasCompletedTtcSetupStep),
    hasCompletedTtcExpectationsStep: readBoolean(value.hasCompletedTtcExpectationsStep),
    hasCompletedAccessStep: readBoolean(value.hasCompletedAccessStep),
  };

  return Object.fromEntries(
    Object.entries(sanitizedDraft).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<OnboardingDraft>;
}

export async function loadPersistedOnboardingDraft() {
  try {
    const serializedDraft = await SecureStore.getItemAsync(ONBOARDING_DRAFT_STORAGE_KEY);

    if (!serializedDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(serializedDraft) as unknown;

    return sanitizePersistedOnboardingDraft(parsedDraft);
  } catch {
    return null;
  }
}

export async function persistOnboardingDraft(draft: OnboardingDraft) {
  try {
    await SecureStore.setItemAsync(
      ONBOARDING_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
  } catch {
    return;
  }
}

export async function clearPersistedOnboardingDraft() {
  try {
    await SecureStore.deleteItemAsync(ONBOARDING_DRAFT_STORAGE_KEY);
  } catch {
    return;
  }
}
