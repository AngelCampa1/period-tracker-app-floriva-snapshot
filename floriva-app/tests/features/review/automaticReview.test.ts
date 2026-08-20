import { defaultReviewPromptState } from '@/src/db/domainDefaults';
import { attemptAutomaticReviewPrompt } from '@/src/features/review/automaticReview';

describe('attemptAutomaticReviewPrompt', () => {
  it('does not consume an attempt when the native review API is unavailable', async () => {
    const getState = jest.fn().mockResolvedValue({
      ...defaultReviewPromptState,
      onboardingCompletedAt: '2026-04-10T10:00:00.000Z',
    });
    const listSuccessfulSaveEventsSince = jest.fn().mockResolvedValue([
      { logDate: '2026-04-11', savedAt: '2026-04-11T10:00:00.000Z' },
      { logDate: '2026-04-12', savedAt: '2026-04-12T10:00:00.000Z' },
    ]);
    const recordAutomaticPrompt = jest.fn();
    const isAvailable = jest.fn().mockResolvedValue(false);
    const requestReview = jest.fn();

    await expect(
      attemptAutomaticReviewPrompt({
        repositories: {
          reviewPromptState: {
            getState,
            listSuccessfulSaveEventsSince,
            recordAutomaticPrompt,
          },
        } as never,
        reviewApi: {
          isAvailable,
          requestReview,
        },
        nowIso: '2026-04-12T10:00:00.000Z',
      }),
    ).resolves.toEqual({
      requested: false,
      reason: 'review-unavailable',
    });

    expect(requestReview).not.toHaveBeenCalled();
    expect(recordAutomaticPrompt).not.toHaveBeenCalled();
  });

  it('records an automatic prompt after an eligible native request succeeds', async () => {
    const getState = jest.fn().mockResolvedValue({
      ...defaultReviewPromptState,
      onboardingCompletedAt: '2026-04-10T10:00:00.000Z',
    });
    const listSuccessfulSaveEventsSince = jest.fn().mockResolvedValue([
      { logDate: '2026-04-11', savedAt: '2026-04-11T10:00:00.000Z' },
      { logDate: '2026-04-12', savedAt: '2026-04-12T10:00:00.000Z' },
    ]);
    const recordAutomaticPrompt = jest.fn().mockResolvedValue(undefined);
    const isAvailable = jest.fn().mockResolvedValue(true);
    const requestReview = jest.fn().mockResolvedValue(undefined);

    await expect(
      attemptAutomaticReviewPrompt({
        repositories: {
          reviewPromptState: {
            getState,
            listSuccessfulSaveEventsSince,
            recordAutomaticPrompt,
          },
        } as never,
        reviewApi: {
          isAvailable,
          requestReview,
        },
        nowIso: '2026-04-12T10:00:00.000Z',
      }),
    ).resolves.toEqual({
      requested: true,
      reason: 'requested',
    });

    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(recordAutomaticPrompt).toHaveBeenCalledWith('2026-04-12T10:00:00.000Z');
    expect(recordAutomaticPrompt.mock.invocationCallOrder[0]).toBeLessThan(
      requestReview.mock.invocationCallOrder[0],
    );
  });

  it('reuses the onboarding save history when no prior prompt timestamp exists and returns the ineligible reason', async () => {
    const getState = jest.fn().mockResolvedValue({
      ...defaultReviewPromptState,
      onboardingCompletedAt: '2026-04-10T10:00:00.000Z',
      automaticPromptCount: 1,
      lastAutomaticPromptAt: undefined,
    });
    const listSuccessfulSaveEventsSince = jest.fn().mockResolvedValue([
      { logDate: '2026-04-11', savedAt: '2026-04-11T10:00:00.000Z' },
      { logDate: '2026-04-11', savedAt: '2026-04-11T12:00:00.000Z' },
    ]);
    const recordAutomaticPrompt = jest.fn();
    const isAvailable = jest.fn().mockResolvedValue(true);
    const requestReview = jest.fn();

    await expect(
      attemptAutomaticReviewPrompt({
        repositories: {
          reviewPromptState: {
            getState,
            listSuccessfulSaveEventsSince,
            recordAutomaticPrompt,
          },
        } as never,
        reviewApi: {
          isAvailable,
          requestReview,
        },
        nowIso: '2026-09-29T10:00:00.000Z',
      }),
    ).resolves.toEqual({
      requested: false,
      reason: 'waiting-after-last-prompt',
    });

    expect(listSuccessfulSaveEventsSince).toHaveBeenCalledTimes(1);
    expect(listSuccessfulSaveEventsSince).toHaveBeenCalledWith('2026-04-10T10:00:00.000Z');
    expect(recordAutomaticPrompt).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('still consumes an automatic attempt when the native review request rejects', async () => {
    const getState = jest.fn().mockResolvedValue({
      ...defaultReviewPromptState,
      onboardingCompletedAt: '2026-04-10T10:00:00.000Z',
    });
    const listSuccessfulSaveEventsSince = jest.fn().mockResolvedValue([
      { logDate: '2026-04-11', savedAt: '2026-04-11T10:00:00.000Z' },
      { logDate: '2026-04-12', savedAt: '2026-04-12T10:00:00.000Z' },
    ]);
    const recordAutomaticPrompt = jest.fn().mockResolvedValue(undefined);
    const isAvailable = jest.fn().mockResolvedValue(true);
    const requestReview = jest.fn().mockRejectedValue(new Error('review-request-failed'));

    await expect(
      attemptAutomaticReviewPrompt({
        repositories: {
          reviewPromptState: {
            getState,
            listSuccessfulSaveEventsSince,
            recordAutomaticPrompt,
          },
        } as never,
        reviewApi: {
          isAvailable,
          requestReview,
        },
        nowIso: '2026-04-12T10:00:00.000Z',
      }),
    ).rejects.toThrow('review-request-failed');

    expect(recordAutomaticPrompt).toHaveBeenCalledWith('2026-04-12T10:00:00.000Z');
    expect(recordAutomaticPrompt.mock.invocationCallOrder[0]).toBeLessThan(
      requestReview.mock.invocationCallOrder[0],
    );
  });
});
