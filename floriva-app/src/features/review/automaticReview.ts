import type { DomainRepositories } from '@/src/db/contracts';
import type { ReviewPromptSaveEvent } from '@/src/types/domain';

import { getAutomaticReviewEligibility } from '@/src/features/review/policy';
import { nativeReviewApi } from '@/src/features/review/storeReview';

type AutomaticReviewResult = {
  requested: boolean;
  reason: string;
};

type AttemptAutomaticReviewPromptOptions = {
  repositories: Pick<DomainRepositories, 'reviewPromptState'>;
  reviewApi?: typeof nativeReviewApi;
  nowIso?: string;
};

function countDistinctSavedLogDays(saveEvents: ReviewPromptSaveEvent[]) {
  return new Set(saveEvents.map((saveEvent) => saveEvent.logDate)).size;
}

export async function attemptAutomaticReviewPrompt({
  repositories,
  reviewApi = nativeReviewApi,
  nowIso = new Date().toISOString(),
}: AttemptAutomaticReviewPromptOptions): Promise<AutomaticReviewResult> {
  const reviewAvailable = await reviewApi.isAvailable();

  if (!reviewAvailable) {
    return {
      requested: false,
      reason: 'review-unavailable',
    };
  }

  const state = await repositories.reviewPromptState.getState();
  const onboardingCompletedAt = state.onboardingCompletedAt;

  const saveEventsSinceOnboarding = onboardingCompletedAt
    ? await repositories.reviewPromptState.listSuccessfulSaveEventsSince(onboardingCompletedAt)
    : [];
  const saveEventsSinceLastPrompt = state.lastAutomaticPromptAt
    ? await repositories.reviewPromptState.listSuccessfulSaveEventsSince(
        state.lastAutomaticPromptAt,
      )
    : saveEventsSinceOnboarding;

  const eligibility = getAutomaticReviewEligibility({
    state,
    nowIso,
    reviewAvailable,
    successfulSaveCountSinceLastPrompt: saveEventsSinceLastPrompt.length,
    distinctSavedLogDaysSinceLastPrompt: countDistinctSavedLogDays(saveEventsSinceLastPrompt),
    distinctSavedLogDaysSinceOnboarding: countDistinctSavedLogDays(saveEventsSinceOnboarding),
  });

  if (!eligibility.eligible) {
    return {
      requested: false,
      reason: eligibility.reason,
    };
  }

  await repositories.reviewPromptState.recordAutomaticPrompt(nowIso);
  await reviewApi.requestReview();

  return {
    requested: true,
    reason: 'requested',
  };
}
