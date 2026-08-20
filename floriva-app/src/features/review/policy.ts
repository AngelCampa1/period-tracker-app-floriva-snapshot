import type { ReviewPromptState } from '@/src/types/domain';

type AutomaticReviewEligibilityInput = {
  state: ReviewPromptState;
  nowIso: string;
  reviewAvailable: boolean;
  successfulSaveCountSinceLastPrompt: number;
  distinctSavedLogDaysSinceLastPrompt: number;
  distinctSavedLogDaysSinceOnboarding: number;
};

type AutomaticReviewEligibility =
  | { eligible: true; reason: 'eligible-first-ask' | 'eligible-retry' }
  | {
      eligible: false;
      reason:
        | 'review-unavailable'
        | 'suppressed'
        | 'onboarding-not-complete'
        | 'max-prompts-reached'
        | 'waiting-after-onboarding'
        | 'needs-two-distinct-saved-days'
        | 'waiting-after-last-prompt'
        | 'needs-five-successful-saves'
        | 'needs-three-distinct-days-since-last-prompt';
    };

const ONBOARDING_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const RETRY_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

function getTime(input: string | undefined) {
  if (!input) {
    return null;
  }

  const parsedTime = new Date(input).getTime();

  return Number.isNaN(parsedTime) ? null : parsedTime;
}

export function getAutomaticReviewEligibility({
  state,
  nowIso,
  reviewAvailable,
  successfulSaveCountSinceLastPrompt,
  distinctSavedLogDaysSinceLastPrompt,
  distinctSavedLogDaysSinceOnboarding,
}: AutomaticReviewEligibilityInput): AutomaticReviewEligibility {
  if (!reviewAvailable) {
    return {
      eligible: false,
      reason: 'review-unavailable',
    };
  }

  if (state.suppressAutomaticPrompts) {
    return {
      eligible: false,
      reason: 'suppressed',
    };
  }

  if (state.automaticPromptCount >= 3) {
    return {
      eligible: false,
      reason: 'max-prompts-reached',
    };
  }

  const nowTime = getTime(nowIso);
  const onboardingCompletedAtTime = getTime(state.onboardingCompletedAt);

  if (!nowTime || !onboardingCompletedAtTime) {
    return {
      eligible: false,
      reason: 'onboarding-not-complete',
    };
  }

  if (nowTime - onboardingCompletedAtTime < ONBOARDING_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: 'waiting-after-onboarding',
    };
  }

  if (state.automaticPromptCount === 0) {
    return distinctSavedLogDaysSinceOnboarding >= 2
      ? {
          eligible: true,
          reason: 'eligible-first-ask',
        }
      : {
          eligible: false,
          reason: 'needs-two-distinct-saved-days',
        };
  }

  const lastAutomaticPromptAtTime = getTime(state.lastAutomaticPromptAt);

  if (!lastAutomaticPromptAtTime || nowTime - lastAutomaticPromptAtTime < RETRY_COOLDOWN_MS) {
    return {
      eligible: false,
      reason: 'waiting-after-last-prompt',
    };
  }

  if (successfulSaveCountSinceLastPrompt < 5) {
    return {
      eligible: false,
      reason: 'needs-five-successful-saves',
    };
  }

  if (distinctSavedLogDaysSinceLastPrompt < 3) {
    return {
      eligible: false,
      reason: 'needs-three-distinct-days-since-last-prompt',
    };
  }

  return {
    eligible: true,
    reason: 'eligible-retry',
  };
}
