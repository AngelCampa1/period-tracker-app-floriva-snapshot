const mockOpenURL = jest.fn();
const mockRecordManualStoreOpen = jest.fn();
const mockStoreReviewIsAvailableAsync = jest.fn();
const mockStoreReviewRequestReview = jest.fn();
const mockReviewPromptStateRepository = {
  getState: jest.fn(),
  seedOnboardingCompletion: jest.fn(),
  recordSuccessfulSave: jest.fn(),
  listSuccessfulSaveEventsSince: jest.fn(),
  recordAutomaticPrompt: jest.fn(),
  recordManualStoreOpen: (...args: unknown[]) => mockRecordManualStoreOpen(...args),
  reset: jest.fn(),
};

jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    android: {
      package: 'app.floriva',
    },
    extra: {
      review: {},
    },
  },
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: (...args: unknown[]) => mockStoreReviewIsAvailableAsync(...args),
  requestReview: (...args: unknown[]) => mockStoreReviewRequestReview(...args),
}));

// eslint-disable-next-line import/first
import {
  buildManualStoreReviewUrl,
  canOpenManualStoreReview,
  getReviewRuntimeConfig,
  nativeReviewApi,
  openManualStoreReview,
} from '@/src/features/review/storeReview';

describe('buildManualStoreReviewUrl', () => {
  beforeEach(() => {
    mockOpenURL.mockReset();
    mockRecordManualStoreOpen.mockReset();
    mockStoreReviewIsAvailableAsync.mockReset();
    mockStoreReviewRequestReview.mockReset();
    mockReviewPromptStateRepository.getState.mockReset();
    mockReviewPromptStateRepository.seedOnboardingCompletion.mockReset();
    mockReviewPromptStateRepository.recordSuccessfulSave.mockReset();
    mockReviewPromptStateRepository.listSuccessfulSaveEventsSince.mockReset();
    mockReviewPromptStateRepository.recordAutomaticPrompt.mockReset();
    mockReviewPromptStateRepository.reset.mockReset();
  });

  it('builds an App Store write-review URL when an iOS app id is configured', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: '1234567890',
          androidPackageName: 'com.anonymous.floriva',
        },
        'ios',
      ),
    ).toBe('https://apps.apple.com/app/apple-store/id1234567890?action=write-review');
  });

  it('returns null on iOS when no App Store id is configured', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: null,
          androidPackageName: 'com.anonymous.floriva',
        },
        'ios',
      ),
    ).toBeNull();
  });

  it('returns null on iOS when the App Store id is still a checked-in placeholder', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: 'REPLACE_WITH_APP_STORE_ID',
          androidPackageName: 'app.floriva',
        },
        'ios',
      ),
    ).toBeNull();
  });

  it('returns null on iOS when the App Store id is present but not a string', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: 1234567890 as unknown as string,
          androidPackageName: 'app.floriva',
        },
        'ios',
      ),
    ).toBeNull();
  });

  it('builds a Play Store review URL from the Android package name', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: null,
          androidPackageName: 'app.floriva',
        },
        'android',
      ),
    ).toBe(
      'https://play.google.com/store/apps/details?id=app.floriva&showAllReviews=true',
    );
  });

  it('returns null on Android when no package name is configured', () => {
    expect(
      buildManualStoreReviewUrl(
        {
          iosAppStoreId: null,
          androidPackageName: '',
        },
        'android',
      ),
    ).toBeNull();
  });

  it('returns false without recording state when manual store review cannot be opened', async () => {
    await expect(
      openManualStoreReview(
        {
          reviewPromptState: mockReviewPromptStateRepository,
        },
        'ios',
      ),
    ).resolves.toBe(false);

    expect(mockOpenURL).not.toHaveBeenCalled();
    expect(mockRecordManualStoreOpen).not.toHaveBeenCalled();
  });

  it('derives runtime config and manual-open availability from Expo config', () => {
    expect(getReviewRuntimeConfig()).toEqual({
      iosAppStoreId: null,
      androidPackageName: 'app.floriva',
    });
    expect(canOpenManualStoreReview('ios')).toBe(false);
    expect(canOpenManualStoreReview('android')).toBe(true);
  });

  it('opens manual store review links and records the manual store-open timestamp on success', async () => {
    mockOpenURL.mockResolvedValue(undefined);

    await expect(
      openManualStoreReview(
        {
          reviewPromptState: mockReviewPromptStateRepository,
        },
        'android',
      ),
    ).resolves.toBe(true);

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=app.floriva&showAllReviews=true',
    );
    expect(mockRecordManualStoreOpen).toHaveBeenCalledWith(expect.any(String));
  });

  it('returns false without recording state when opening the review url fails', async () => {
    mockOpenURL.mockRejectedValue(new Error('open failed'));

    await expect(
      openManualStoreReview(
        {
          reviewPromptState: mockReviewPromptStateRepository,
        },
        'android',
      ),
    ).resolves.toBe(false);

    expect(mockRecordManualStoreOpen).not.toHaveBeenCalled();
  });

  it('delegates native review availability and request calls to expo-store-review', async () => {
    mockStoreReviewIsAvailableAsync.mockResolvedValue(true);
    mockStoreReviewRequestReview.mockResolvedValue(undefined);

    await expect(nativeReviewApi.isAvailable()).resolves.toBe(true);
    await expect(nativeReviewApi.requestReview()).resolves.toBeUndefined();
  });
});
