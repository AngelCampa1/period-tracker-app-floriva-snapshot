import { defaultReviewPromptState } from '@/src/db/domainDefaults';
import { getAutomaticReviewEligibility } from '@/src/features/review/policy';

describe('automatic review policy', () => {
  const seededState = {
    ...defaultReviewPromptState,
    onboardingCompletedAt: '2026-04-10T10:00:00.000Z',
  };

  it('requires the native review prompt to be available', () => {
    expect(
      getAutomaticReviewEligibility({
        state: seededState,
        nowIso: '2026-04-12T10:00:00.000Z',
        reviewAvailable: false,
        successfulSaveCountSinceLastPrompt: 9,
        distinctSavedLogDaysSinceLastPrompt: 5,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'review-unavailable',
    });
  });

  it('requires a valid onboarding completion timestamp before prompting', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          onboardingCompletedAt: undefined,
        },
        nowIso: '2026-04-12T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 9,
        distinctSavedLogDaysSinceLastPrompt: 5,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'onboarding-not-complete',
    });

    expect(
      getAutomaticReviewEligibility({
        state: seededState,
        nowIso: 'not-a-date',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 9,
        distinctSavedLogDaysSinceLastPrompt: 5,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'onboarding-not-complete',
    });
  });

  it('does not ask before the onboarding cooldown finishes', () => {
    expect(
      getAutomaticReviewEligibility({
        state: seededState,
        nowIso: '2026-04-12T09:59:59.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 2,
        distinctSavedLogDaysSinceLastPrompt: 2,
        distinctSavedLogDaysSinceOnboarding: 2,
      }),
    ).toEqual({
      eligible: false,
      reason: 'waiting-after-onboarding',
    });
  });

  it('does not ask after only one distinct saved log day', () => {
    expect(
      getAutomaticReviewEligibility({
        state: seededState,
        nowIso: '2026-04-12T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 1,
        distinctSavedLogDaysSinceLastPrompt: 1,
        distinctSavedLogDaysSinceOnboarding: 1,
      }),
    ).toEqual({
      eligible: false,
      reason: 'needs-two-distinct-saved-days',
    });
  });

  it('allows the first ask after 48 hours and two distinct saved days', () => {
    expect(
      getAutomaticReviewEligibility({
        state: seededState,
        nowIso: '2026-04-12T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 2,
        distinctSavedLogDaysSinceLastPrompt: 2,
        distinctSavedLogDaysSinceOnboarding: 2,
      }),
    ).toEqual({
      eligible: true,
      reason: 'eligible-first-ask',
    });
  });

  it('blocks retries during the 90-day cooldown', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          automaticPromptCount: 1,
          lastAutomaticPromptAt: '2026-07-01T10:00:00.000Z',
        },
        nowIso: '2026-09-28T09:59:59.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 5,
        distinctSavedLogDaysSinceLastPrompt: 3,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'waiting-after-last-prompt',
    });
  });

  it('blocks retries until five successful saves have happened since the last prompt', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          automaticPromptCount: 1,
          lastAutomaticPromptAt: '2026-07-01T10:00:00.000Z',
        },
        nowIso: '2026-09-29T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 4,
        distinctSavedLogDaysSinceLastPrompt: 3,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'needs-five-successful-saves',
    });
  });

  it('blocks retries until those saves cover at least three distinct days', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          automaticPromptCount: 1,
          lastAutomaticPromptAt: '2026-07-01T10:00:00.000Z',
        },
        nowIso: '2026-09-29T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 5,
        distinctSavedLogDaysSinceLastPrompt: 2,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'needs-three-distinct-days-since-last-prompt',
    });
  });

  it('stops asking after automatic prompts are suppressed manually', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          suppressAutomaticPrompts: true,
        },
        nowIso: '2026-09-29T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 9,
        distinctSavedLogDaysSinceLastPrompt: 5,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: false,
      reason: 'suppressed',
    });
  });

  it('stops after the third automatic prompt', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          automaticPromptCount: 3,
          lastAutomaticPromptAt: '2026-07-01T10:00:00.000Z',
        },
        nowIso: '2026-12-01T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 6,
        distinctSavedLogDaysSinceLastPrompt: 4,
        distinctSavedLogDaysSinceOnboarding: 12,
      }),
    ).toEqual({
      eligible: false,
      reason: 'max-prompts-reached',
    });
  });

  it('allows a retry after the cooldown, enough saves, and enough distinct saved days', () => {
    expect(
      getAutomaticReviewEligibility({
        state: {
          ...seededState,
          automaticPromptCount: 1,
          lastAutomaticPromptAt: '2026-07-01T10:00:00.000Z',
        },
        nowIso: '2026-09-29T10:00:00.000Z',
        reviewAvailable: true,
        successfulSaveCountSinceLastPrompt: 5,
        distinctSavedLogDaysSinceLastPrompt: 3,
        distinctSavedLogDaysSinceOnboarding: 8,
      }),
    ).toEqual({
      eligible: true,
      reason: 'eligible-retry',
    });
  });
});
