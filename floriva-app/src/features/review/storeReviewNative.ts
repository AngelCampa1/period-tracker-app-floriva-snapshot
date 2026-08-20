import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeStoreReviewModule = {
  isAvailableAsync: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

let cachedStoreReviewModule: NativeStoreReviewModule | null | undefined;

function loadOptionalStoreReviewModule() {
  if (!requireOptionalNativeModule('ExpoStoreReview')) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-store-review') as NativeStoreReviewModule;
  } catch {
    return null;
  }
}

export function getNativeStoreReviewModule() {
  if (cachedStoreReviewModule === undefined) {
    cachedStoreReviewModule = loadOptionalStoreReviewModule();
  }

  return cachedStoreReviewModule;
}
