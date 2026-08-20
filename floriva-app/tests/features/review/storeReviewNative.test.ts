const mockRequireOptionalNativeModule = jest.fn();
const mockStoreReviewModule = {
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  requestReview: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}));

jest.mock('expo-store-review', () => mockStoreReviewModule);

describe('storeReviewNative', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRequireOptionalNativeModule.mockReset();
    mockStoreReviewModule.isAvailableAsync.mockClear();
    mockStoreReviewModule.requestReview.mockClear();
  });

  it('returns the native store review module when available', () => {
    mockRequireOptionalNativeModule.mockReturnValue({});

    jest.isolateModules(() => {

      const { getNativeStoreReviewModule } = require('@/src/features/review/storeReviewNative');

      expect(getNativeStoreReviewModule()).toBe(mockStoreReviewModule);
    });
  });

  it('returns null when expo-store-review is unavailable', () => {
    mockRequireOptionalNativeModule.mockReturnValue(null);

    jest.isolateModules(() => {

      const { getNativeStoreReviewModule } = require('@/src/features/review/storeReviewNative');

      expect(getNativeStoreReviewModule()).toBeNull();
    });
  });
});
