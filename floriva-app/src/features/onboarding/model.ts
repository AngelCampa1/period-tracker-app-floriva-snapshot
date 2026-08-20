import {
  defaultTtcTrackingPreferences,
  defaultUserProfile,
} from '@/src/db/domainDefaults';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import type {
  AppPreferences,
  ConditionKey,
  DailyLogEntry,
  TrackingGoal,
  TtcTrackingPreferences,
  UserProfile,
} from '@/src/types/domain';

export type SetupLaterChoice = 'skip' | 'later' | 'now';
export type OnboardingStartPath = 'fresh' | 'import' | 'restore';
export type TtcTrackingPreset = 'basic' | 'full';

export type OnboardingDraft = {
  cycleLengthInput: string;
  hasConfirmedCycleLength: boolean;
  periodLengthInput: string;
  hasConfirmedPeriodLength: boolean;
  lastPeriodStartDate: string;
  goals: TrackingGoal[];
  supportsIrregularCycles: boolean | null;
  conditionTags: ConditionKey[];
  ttcTrackingPreferences: TtcTrackingPreferences;
  reminderSetupChoice: SetupLaterChoice;
  importSetupChoice: SetupLaterChoice;
  biometricsSetupChoice: SetupLaterChoice;
  startPath: OnboardingStartPath | null;
  hasSelectedFreshPath: boolean;
  symptomLoggingEnabled: boolean | null;
  ttcEnabled: boolean | null;
  ttcTrackingPreset: TtcTrackingPreset | null;
  hasCompletedTtcSetupStep: boolean;
  hasCompletedTtcExpectationsStep: boolean;
  /** User has reviewed or skipped the onboarding billing offer. */
  hasCompletedAccessStep: boolean;
};

export type CycleBasicsErrors = Partial<
  Record<'cycleLengthInput' | 'periodLengthInput' | 'lastPeriodStartDate', string>
>;

export type GoalsErrors = Partial<Record<'goals' | 'supportsIrregularCycles', string>>;

const onboardingRoutes = {
  welcome: '/welcome',
  startPath: '/start-path',
  lastPeriodStart: '/last-period-start',
  cycleLength: '/cycle-length',
  periodLength: '/period-length',
  cycleVariability: '/cycle-variability',
  symptomLogging: '/symptom-logging',
  ttc: '/ttc',
  ttcPreset: '/ttc-preset',
  notifications: '/notifications',
  import: '/import',
  restore: '/restore',
  paywall: '/paywall',
  billingOptions: '/billing-options',
  completion: '/completion',
  privacy: '/privacy-details',
} as const;

// Floriva is now free. `billingOptions` and `paywall` are gone from every flow
// order: a fresh install must never reach a paywall, because no product is
// purchasable any more. The routes themselves still exist so old deep links
// resolve rather than 404.
const freshFlowRouteOrder = [
  onboardingRoutes.startPath,
  onboardingRoutes.lastPeriodStart,
  onboardingRoutes.cycleLength,
  onboardingRoutes.periodLength,
  onboardingRoutes.cycleVariability,
  onboardingRoutes.symptomLogging,
  onboardingRoutes.ttc,
  onboardingRoutes.ttcPreset,
  onboardingRoutes.notifications,
  onboardingRoutes.completion,
] as const;
// Note: cycleVariability stays in freshFlowRouteOrder so the standalone
// /cycle-variability route still resolves (deep links, step-validator fallback),
// but resolveFreshStartIncompleteRoute no longer redirects users to it.
// Variability is captured inline on /cycle-length per mockup 04.

const importFlowRouteOrder = [
  onboardingRoutes.startPath,
  onboardingRoutes.import,
  onboardingRoutes.notifications,
  onboardingRoutes.completion,
] as const;

const restoreFlowRouteOrder = [
  onboardingRoutes.startPath,
  onboardingRoutes.restore,
  onboardingRoutes.notifications,
  onboardingRoutes.completion,
] as const;

function normalizeOnboardingPathname(pathname: string) {
  const normalizedPathname = pathname.replace(/\/\([^/]+\)/g, '');

  return normalizedPathname.length > 0 ? normalizedPathname : '/';
}

function shouldAllowCurrentOnboardingRoute(
  pathname: string,
  targetRoute: string,
  allowedRouteOrder: readonly string[],
) {
  const currentRouteIndex = allowedRouteOrder.indexOf(pathname);
  const targetRouteIndex = allowedRouteOrder.indexOf(targetRoute);

  if (currentRouteIndex === -1 || targetRouteIndex === -1) {
    return false;
  }

  return currentRouteIndex <= targetRouteIndex;
}

export function createDefaultOnboardingDraft(): OnboardingDraft {
  return {
    cycleLengthInput: String(defaultUserProfile.cycleLengthDays ?? 29),
    hasConfirmedCycleLength: false,
    periodLengthInput: String(defaultUserProfile.periodLengthDays ?? 5),
    hasConfirmedPeriodLength: false,
    lastPeriodStartDate: '',
    goals: [],
    supportsIrregularCycles: null,
    conditionTags: [],
    ttcTrackingPreferences: { ...defaultTtcTrackingPreferences },
    reminderSetupChoice: 'skip',
    importSetupChoice: 'skip',
    biometricsSetupChoice: 'skip',
    startPath: null,
    hasSelectedFreshPath: false,
    symptomLoggingEnabled: null,
    ttcEnabled: null,
    ttcTrackingPreset: null,
    hasCompletedTtcSetupStep: false,
    hasCompletedTtcExpectationsStep: false,
    hasCompletedAccessStep: false,
  };
}

export function createOnboardingDraftFromProfile(
  profile?: UserProfile | null,
): OnboardingDraft {
  const defaults = createDefaultOnboardingDraft();

  if (!profile) {
    return defaults;
  }

  return {
    ...defaults,
    cycleLengthInput: String(profile.cycleLengthDays ?? defaultUserProfile.cycleLengthDays ?? 29),
    hasConfirmedCycleLength: true,
    periodLengthInput: String(profile.periodLengthDays ?? defaultUserProfile.periodLengthDays ?? 5),
    hasConfirmedPeriodLength: true,
    lastPeriodStartDate: profile.lastPeriodStartDate ?? '',
    goals: profile.goals.length > 0 ? [...profile.goals] : defaults.goals,
    supportsIrregularCycles:
      typeof profile.supportsIrregularCycles === 'boolean'
        ? profile.supportsIrregularCycles
        : defaults.supportsIrregularCycles,
    conditionTags: profile.conditionTags.length > 0 ? [...profile.conditionTags] : [],
    ttcTrackingPreferences: profile.ttcTrackingPreferences
      ? { ...profile.ttcTrackingPreferences }
      : { ...defaultTtcTrackingPreferences },
    startPath: 'fresh',
    hasSelectedFreshPath: false,
    symptomLoggingEnabled: profile.goals.includes('symptoms'),
    ttcEnabled: profile.goals.includes('trying-to-conceive'),
    ttcTrackingPreset: profile.goals.includes('trying-to-conceive')
      ? profile.ttcTrackingPreferences?.basalBodyTemperature ||
        profile.ttcTrackingPreferences?.cervicalMucus
        ? 'full'
        : 'basic'
      : null,
    hasCompletedTtcSetupStep: profile.goals.includes('trying-to-conceive'),
    hasCompletedTtcExpectationsStep: profile.goals.includes('trying-to-conceive'),
    hasCompletedAccessStep: false,
  };
}

function parseWholeNumber(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function toIsoCalendarDate(parts: {
  year: number;
  month: number;
  day: number;
}) {
  const isoDate = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(
    2,
    '0',
  )}-${String(parts.day).padStart(2, '0')}`;
  const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);

  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(isoDate)
    ? isoDate
    : null;
}

export function normalizeOnboardingDateInput(value: string) {
  const trimmedValue = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return toIsoCalendarDate({
      year: Number.parseInt(trimmedValue.slice(0, 4), 10),
      month: Number.parseInt(trimmedValue.slice(5, 7), 10),
      day: Number.parseInt(trimmedValue.slice(8, 10), 10),
    });
  }

  const slashSeparatedParts = trimmedValue.split('/');

  if (slashSeparatedParts.length !== 3) {
    return null;
  }

  if (slashSeparatedParts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  if (slashSeparatedParts[0].length === 4) {
    return toIsoCalendarDate({
      year: Number.parseInt(slashSeparatedParts[0], 10),
      month: Number.parseInt(slashSeparatedParts[1], 10),
      day: Number.parseInt(slashSeparatedParts[2], 10),
    });
  }

  return toIsoCalendarDate({
    month: Number.parseInt(slashSeparatedParts[0], 10),
    day: Number.parseInt(slashSeparatedParts[1], 10),
    year: Number.parseInt(slashSeparatedParts[2], 10),
  });
}

export function validateCycleBasicsStep(draft: OnboardingDraft): CycleBasicsErrors {
  const errors: CycleBasicsErrors = {};
  const cycleLength = parseWholeNumber(draft.cycleLengthInput);
  const periodLength = parseWholeNumber(draft.periodLengthInput);
  const normalizedLastPeriodStartDate = normalizeOnboardingDateInput(draft.lastPeriodStartDate);

  if (cycleLength === null) {
    errors.cycleLengthInput = 'onboarding.basics.validation.cycleLengthRequired';
  } else if (cycleLength < 1 || cycleLength > 120) {
    errors.cycleLengthInput = 'onboarding.basics.validation.cycleLengthRange';
  }

  if (periodLength === null || periodLength < 1 || periodLength > 30) {
    errors.periodLengthInput = 'onboarding.basics.validation.periodLengthRange';
  }

  if (!normalizedLastPeriodStartDate) {
    errors.lastPeriodStartDate = 'onboarding.basics.validation.lastPeriodStartInvalid';
  } else if (normalizedLastPeriodStartDate > getLocalTodayLogDate()) {
    errors.lastPeriodStartDate = 'onboarding.basics.validation.lastPeriodStartFuture';
  }

  return errors;
}

export function validateGoalsStep(draft: OnboardingDraft): GoalsErrors {
  const errors: GoalsErrors = {};

  if (draft.goals.length === 0) {
    errors.goals = 'onboarding.goals.validation.goalsRequired';
  }

  if (draft.supportsIrregularCycles === null) {
    errors.supportsIrregularCycles =
      'onboarding.goals.validation.irregularCyclesRequired';
  }

  return errors;
}

function validateLastPeriodStartStep(draft: OnboardingDraft) {
  const normalizedLastPeriodStartDate = normalizeOnboardingDateInput(draft.lastPeriodStartDate);

  if (!normalizedLastPeriodStartDate) {
    return 'Enter a valid date. You can also type MM/DD/YYYY.';
  }

  if (normalizedLastPeriodStartDate > getLocalTodayLogDate()) {
    return 'The start date cannot be in the future.';
  }

  return null;
}

function deriveGoalsFromOneDecisionFlow(draft: OnboardingDraft): TrackingGoal[] {
  const goals: TrackingGoal[] = ['period'];

  if (draft.symptomLoggingEnabled) {
    goals.push('symptoms');
  }

  if (draft.ttcEnabled) {
    goals.push('trying-to-conceive');
  }

  return goals;
}

function buildTtcTrackingPreferencesFromPreset(
  preset: TtcTrackingPreset | null,
  enabled: boolean | null,
) {
  if (!enabled || !preset) {
    return { ...defaultTtcTrackingPreferences };
  }

  if (preset === 'basic') {
    return {
      sex: true,
      ovulationTest: true,
      cervicalMucus: false,
      basalBodyTemperature: false,
    } satisfies TtcTrackingPreferences;
  }

  return {
    sex: true,
    ovulationTest: true,
    cervicalMucus: true,
    basalBodyTemperature: true,
  } satisfies TtcTrackingPreferences;
}

function resolveFreshStartIncompleteRoute(draft: OnboardingDraft) {
  if (!draft.startPath) {
    return onboardingRoutes.startPath;
  }

  if (draft.startPath !== 'fresh') {
    return onboardingRoutes.completion;
  }

  if (validateLastPeriodStartStep(draft)) {
    return onboardingRoutes.lastPeriodStart;
  }

  if (!draft.hasConfirmedCycleLength) {
    return onboardingRoutes.cycleLength;
  }

  if (!draft.hasConfirmedPeriodLength) {
    return onboardingRoutes.periodLength;
  }

  if (draft.supportsIrregularCycles === null) {
    // Variability is captured inline on cycle-length; if it's still null the
    // user shortcut past the inline ChoicePanels, so send them back there.
    return onboardingRoutes.cycleLength;
  }

  if (draft.symptomLoggingEnabled === null) {
    return onboardingRoutes.symptomLogging;
  }

  if (draft.ttcEnabled === null) {
    return onboardingRoutes.ttc;
  }

  if (draft.ttcEnabled && !draft.ttcTrackingPreset) {
    return onboardingRoutes.ttcPreset;
  }

  return onboardingRoutes.completion;
}

export function resolveOnboardingGuardRedirect(pathname: string, draft: OnboardingDraft) {
  const normalizedPathname = normalizeOnboardingPathname(pathname);

  if (
    normalizedPathname === onboardingRoutes.welcome ||
    normalizedPathname === onboardingRoutes.privacy
  ) {
    return null;
  }

  if (!draft.startPath) {
    return normalizedPathname === onboardingRoutes.startPath ? null : onboardingRoutes.startPath;
  }

  if (draft.startPath === 'import') {
    if (
      normalizedPathname === onboardingRoutes.import ||
      normalizedPathname.startsWith(`${onboardingRoutes.import}/`)
    ) {
      return null;
    }

    const targetRoute = onboardingRoutes.completion;

    if (
      shouldAllowCurrentOnboardingRoute(normalizedPathname, targetRoute, importFlowRouteOrder)
    ) {
      return null;
    }

    return targetRoute;
  }

  if (draft.startPath === 'restore') {
    const targetRoute = onboardingRoutes.completion;

    if (
      shouldAllowCurrentOnboardingRoute(normalizedPathname, targetRoute, restoreFlowRouteOrder)
    ) {
      return null;
    }

    return targetRoute;
  }

  const targetRoute = resolveFreshStartIncompleteRoute(draft);

  if (
    normalizedPathname === onboardingRoutes.ttcPreset &&
    draft.ttcEnabled === false
  ) {
    return onboardingRoutes.completion;
  }

  if (
    shouldAllowCurrentOnboardingRoute(normalizedPathname, targetRoute, freshFlowRouteOrder)
  ) {
    return null;
  }

  return targetRoute;
}

export function buildOnboardingCompletion(draft: OnboardingDraft): {
  profile: UserProfile;
  preferences: Pick<
    AppPreferences,
    | 'deferredCycleSetup'
    | 'deferredTrackingSetup'
    | 'deferredBiometricsSetup'
    | 'deferredReminderSetup'
    | 'deferredImportSetup'
    | 'dismissedTailoringChecklist'
  >;
} {
  const isImportedCompletionFlow =
    draft.startPath === 'import' || draft.startPath === 'restore';
  // `hasCompletedAccessStep` is no longer consulted anywhere in completion:
  // the billing step it tracked has been removed from every flow, so gating on
  // it would reject every otherwise-valid draft.
  const isFreshOnboardingCompletion = draft.startPath === 'fresh';
  const usesGoalDecisionFields =
    draft.symptomLoggingEnabled !== null ||
    draft.ttcEnabled !== null ||
    draft.ttcTrackingPreset !== null;
  const goals = usesGoalDecisionFields ? deriveGoalsFromOneDecisionFlow(draft) : draft.goals;
  const ttcTrackingPreferences = usesGoalDecisionFields
    ? buildTtcTrackingPreferencesFromPreset(draft.ttcTrackingPreset, draft.ttcEnabled)
    : { ...draft.ttcTrackingPreferences };
  const lastPeriodStartError = validateLastPeriodStartStep(draft);
  const normalizedLastPeriodStartDate = normalizeOnboardingDateInput(
    draft.lastPeriodStartDate || getLocalTodayLogDate(),
  );

  if (isFreshOnboardingCompletion) {
    if (
      !draft.startPath ||
      lastPeriodStartError ||
      !draft.hasConfirmedCycleLength ||
      !draft.hasConfirmedPeriodLength ||
      draft.supportsIrregularCycles === null ||
      draft.symptomLoggingEnabled === null ||
      draft.ttcEnabled === null ||
      (draft.ttcEnabled && !draft.ttcTrackingPreset) ||
      !normalizedLastPeriodStartDate
    ) {
      throw new Error('Onboarding draft is incomplete');
    }
  } else if (isImportedCompletionFlow) {
    throw new Error('Import and restore onboarding must finish from persisted data.');
  } else if (
    Object.keys(validateCycleBasicsStep(draft)).length > 0 ||
    Object.keys(validateGoalsStep(draft)).length > 0 ||
    draft.supportsIrregularCycles === null ||
    !normalizedLastPeriodStartDate
  ) {
    throw new Error('Onboarding draft is incomplete');
  }

  if (!normalizedLastPeriodStartDate) {
    throw new Error('Onboarding draft is incomplete');
  }

  const cycleLengthDays = Number.parseInt(draft.cycleLengthInput, 10);
  const periodLengthDays = Number.parseInt(draft.periodLengthInput, 10);

  return {
    profile: {
      cycleLengthDays:
        Number.isFinite(cycleLengthDays) && cycleLengthDays > 0
          ? cycleLengthDays
          : (defaultUserProfile.cycleLengthDays ?? 29),
      periodLengthDays:
        Number.isFinite(periodLengthDays) && periodLengthDays > 0
          ? periodLengthDays
          : (defaultUserProfile.periodLengthDays ?? 5),
      lastPeriodStartDate: normalizedLastPeriodStartDate,
      goals,
      supportsIrregularCycles:
        draft.supportsIrregularCycles ?? defaultUserProfile.supportsIrregularCycles,
      conditionTags: draft.conditionTags,
      ttcTrackingPreferences,
    },
    preferences: {
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: draft.biometricsSetupChoice === 'later',
      deferredReminderSetup: draft.reminderSetupChoice === 'later',
      deferredImportSetup: draft.importSetupChoice === 'later',
      dismissedTailoringChecklist: false,
    },
  };
}

export function buildImportedOnboardingCompletion(
  draft: OnboardingDraft,
  persistedProfile: UserProfile | null,
  logEntries: DailyLogEntry[],
): {
  profile: UserProfile;
  preferences: Pick<
    AppPreferences,
    | 'deferredCycleSetup'
    | 'deferredTrackingSetup'
    | 'deferredBiometricsSetup'
    | 'deferredReminderSetup'
    | 'deferredImportSetup'
    | 'dismissedTailoringChecklist'
  >;
} {
  if (draft.startPath !== 'import' && draft.startPath !== 'restore') {
    throw new Error('Imported completion is only available for import and restore onboarding.');
  }

  if (persistedProfile?.lastPeriodStartDate && persistedProfile.cycleLengthDays && persistedProfile.periodLengthDays) {
    return {
      profile: {
        cycleLengthDays: persistedProfile.cycleLengthDays,
        periodLengthDays: persistedProfile.periodLengthDays,
        lastPeriodStartDate: persistedProfile.lastPeriodStartDate,
        goals: persistedProfile.goals.length > 0 ? persistedProfile.goals : ['period'],
        supportsIrregularCycles: persistedProfile.supportsIrregularCycles,
        conditionTags: persistedProfile.conditionTags,
        ttcTrackingPreferences:
          persistedProfile.ttcTrackingPreferences ?? { ...defaultTtcTrackingPreferences },
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: draft.biometricsSetupChoice === 'later',
        deferredReminderSetup: draft.reminderSetupChoice === 'later',
        deferredImportSetup: draft.importSetupChoice === 'later',
        dismissedTailoringChecklist: false,
      },
    };
  }

  if (logEntries.length === 0) {
    throw new Error('Floriva could not find any imported history to finish setup.');
  }

  const hasLoggedPeriodEvidence = logEntries.some(
    (entry) =>
      entry.bleeding === 'light' ||
      entry.bleeding === 'medium' ||
      entry.bleeding === 'heavy',
  );
  const hasSpottingEvidence = logEntries.some((entry) => entry.bleeding === 'spotting');

  const seedProfile: UserProfile = {
    goals: persistedProfile?.goals.length ? persistedProfile.goals : ['period'],
    supportsIrregularCycles: persistedProfile?.supportsIrregularCycles ?? false,
    conditionTags: persistedProfile?.conditionTags ?? [],
    ttcTrackingPreferences:
      persistedProfile?.ttcTrackingPreferences ?? { ...defaultTtcTrackingPreferences },
    lastPeriodStartDate: persistedProfile?.lastPeriodStartDate ?? getLocalTodayLogDate(),
  };

  if (!hasLoggedPeriodEvidence && !hasSpottingEvidence) {
    throw new Error('Floriva could not find any logged period days in that imported history.');
  }

  if (!hasLoggedPeriodEvidence) {
    return {
      profile: {
        cycleLengthDays: persistedProfile?.cycleLengthDays ?? defaultUserProfile.cycleLengthDays,
        periodLengthDays:
          persistedProfile?.periodLengthDays ?? defaultUserProfile.periodLengthDays,
        lastPeriodStartDate: seedProfile.lastPeriodStartDate,
        goals: seedProfile.goals,
        supportsIrregularCycles: seedProfile.supportsIrregularCycles,
        conditionTags: seedProfile.conditionTags,
        ttcTrackingPreferences: seedProfile.ttcTrackingPreferences,
      },
      preferences: {
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: draft.biometricsSetupChoice === 'later',
        deferredReminderSetup: draft.reminderSetupChoice === 'later',
        deferredImportSetup: draft.importSetupChoice === 'later',
        dismissedTailoringChecklist: false,
      },
    };
  }

  const prediction = buildPredictionResult({
    todayIso: getLocalTodayLogDate(),
    profile: seedProfile,
    logEntries,
  });

  return {
    profile: {
      cycleLengthDays: persistedProfile?.cycleLengthDays ?? prediction.cycleLengthDays,
      periodLengthDays: persistedProfile?.periodLengthDays ?? prediction.nextPeriod.lengthDays,
      lastPeriodStartDate: persistedProfile?.lastPeriodStartDate ?? prediction.current.cycleStartDate,
      goals: seedProfile.goals,
      supportsIrregularCycles: seedProfile.supportsIrregularCycles,
      conditionTags: seedProfile.conditionTags,
      ttcTrackingPreferences: seedProfile.ttcTrackingPreferences,
    },
    preferences: {
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: draft.biometricsSetupChoice === 'later',
      deferredReminderSetup: draft.reminderSetupChoice === 'later',
      deferredImportSetup: draft.importSetupChoice === 'later',
      dismissedTailoringChecklist: false,
    },
  };
}
