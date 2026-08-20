import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import {
  loadPersistedOnboardingDraft,
  persistOnboardingDraft,
} from '@/src/features/onboarding/draftStorage';
import {
  createDefaultOnboardingDraft,
  type OnboardingStartPath,
  type OnboardingDraft,
  type SetupLaterChoice,
  type TtcTrackingPreset,
} from '@/src/features/onboarding/model';
import type { ConditionKey, TrackingGoal, TtcTrackingPreferences } from '@/src/types/domain';

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setStartPath: (value: OnboardingStartPath | null) => void;
  setHasSelectedFreshPath: (value: boolean) => void;
  setCycleLengthInput: (value: string) => void;
  confirmCycleLength: () => void;
  setPeriodLengthInput: (value: string) => void;
  confirmPeriodLength: () => void;
  setLastPeriodStartDate: (value: string) => void;
  setSymptomLoggingEnabled: (value: boolean) => void;
  setTtcEnabled: (value: boolean) => void;
  setTtcTrackingPreset: (value: TtcTrackingPreset) => void;
  setHasCompletedTtcSetupStep: (value: boolean) => void;
  setHasCompletedTtcExpectationsStep: (value: boolean) => void;
  setHasCompletedAccessStep: (value: boolean) => void;
  toggleGoal: (goal: TrackingGoal) => void;
  setSupportsIrregularCycles: (value: boolean) => void;
  toggleConditionTag: (conditionTag: ConditionKey) => void;
  setTtcTrackingPreference: (
    key: keyof TtcTrackingPreferences,
    value: boolean,
  ) => void;
  setSetupChoice: (
    key: 'reminderSetupChoice' | 'importSetupChoice' | 'biometricsSetupChoice',
    value: SetupLaterChoice,
  ) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type OnboardingProviderProps = PropsWithChildren<{
  initialDraft?: Partial<OnboardingDraft>;
  persistDraft?: boolean;
}>;

function mergeInitialDraft(initialDraft?: Partial<OnboardingDraft>) {
  const defaults = createDefaultOnboardingDraft();

  if (!initialDraft) {
    return defaults;
  }

  return {
    ...defaults,
    ...initialDraft,
    goals: initialDraft.goals ? [...initialDraft.goals] : defaults.goals,
    conditionTags: initialDraft.conditionTags
      ? [...initialDraft.conditionTags]
      : defaults.conditionTags,
    ttcTrackingPreferences: initialDraft.ttcTrackingPreferences
      ? { ...initialDraft.ttcTrackingPreferences }
      : { ...defaults.ttcTrackingPreferences },
  };
}

export function OnboardingProvider({
  children,
  initialDraft,
  persistDraft = false,
}: OnboardingProviderProps) {
  const [draft, setDraft] = useState(() => mergeInitialDraft(initialDraft));
  const [isHydrated, setIsHydrated] = useState(() => !persistDraft || Boolean(initialDraft));

  useEffect(() => {
    if (!persistDraft || initialDraft) {
      setIsHydrated(true);
      return;
    }

    let isCancelled = false;

    async function hydratePersistedDraft() {
      const persistedDraft = await loadPersistedOnboardingDraft();

      if (isCancelled) {
        return;
      }

      setDraft(mergeInitialDraft(persistedDraft ?? undefined));
      setIsHydrated(true);
    }

    void hydratePersistedDraft();

    return () => {
      isCancelled = true;
    };
  }, [initialDraft, persistDraft]);

  useEffect(() => {
    if (!persistDraft || !isHydrated) {
      return;
    }

    void persistOnboardingDraft(draft);
  }, [draft, isHydrated, persistDraft]);

  if (!isHydrated) {
    return null;
  }

  return (
    <OnboardingContext.Provider
      value={{
        draft,
        setStartPath: (value) => {
          setDraft((current) => ({
            ...current,
            startPath: value,
            ttcTrackingPreset: value === 'fresh' ? current.ttcTrackingPreset : null,
          }));
        },
        setHasSelectedFreshPath: (value) => {
          setDraft((current) => ({ ...current, hasSelectedFreshPath: value }));
        },
        setCycleLengthInput: (value) => {
          setDraft((current) => ({ ...current, cycleLengthInput: value }));
        },
        confirmCycleLength: () => {
          setDraft((current) => ({ ...current, hasConfirmedCycleLength: true }));
        },
        setPeriodLengthInput: (value) => {
          setDraft((current) => ({ ...current, periodLengthInput: value }));
        },
        confirmPeriodLength: () => {
          setDraft((current) => ({ ...current, hasConfirmedPeriodLength: true }));
        },
        setLastPeriodStartDate: (value) => {
          setDraft((current) => ({ ...current, lastPeriodStartDate: value }));
        },
        setSymptomLoggingEnabled: (value) => {
          setDraft((current) => ({ ...current, symptomLoggingEnabled: value }));
        },
        setTtcEnabled: (value) => {
          setDraft((current) => ({
            ...current,
            ttcEnabled: value,
            ttcTrackingPreset: value ? current.ttcTrackingPreset : null,
          }));
        },
        setTtcTrackingPreset: (value) => {
          setDraft((current) => ({ ...current, ttcTrackingPreset: value }));
        },
        setHasCompletedTtcSetupStep: (value) => {
          setDraft((current) => ({ ...current, hasCompletedTtcSetupStep: value }));
        },
        setHasCompletedTtcExpectationsStep: (value) => {
          setDraft((current) => ({ ...current, hasCompletedTtcExpectationsStep: value }));
        },
        setHasCompletedAccessStep: (value) => {
          setDraft((current) => ({ ...current, hasCompletedAccessStep: value }));
        },
        toggleGoal: (goal) => {
          setDraft((current) => ({
            ...current,
            goals: current.goals.includes(goal)
              ? current.goals.filter((currentGoal) => currentGoal !== goal)
              : [...current.goals, goal],
          }));
        },
        setSupportsIrregularCycles: (value) => {
          setDraft((current) => ({ ...current, supportsIrregularCycles: value }));
        },
        toggleConditionTag: (conditionTag) => {
          setDraft((current) => ({
            ...current,
            conditionTags: current.conditionTags.includes(conditionTag)
              ? current.conditionTags.filter((currentCondition) => currentCondition !== conditionTag)
              : [...current.conditionTags, conditionTag],
          }));
        },
        setTtcTrackingPreference: (key, value) => {
          setDraft((current) => ({
            ...current,
            ttcTrackingPreferences: {
              ...current.ttcTrackingPreferences,
              [key]: value,
            },
          }));
        },
        setSetupChoice: (key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
        },
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }

  return context;
}

export function useOptionalOnboarding() {
  return useContext(OnboardingContext);
}
