import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

import type { DomainRepositories } from '@/src/db/contracts';

type ReviewRuntimeConfig = {
  iosAppStoreId: string | null;
  androidPackageName: string;
};

type ReviewPlatform = 'ios' | 'android';

type NativeReviewApi = {
  isAvailable: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

function normalizeConfiguredString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isTemplatePlaceholder(value: unknown) {
  const normalizedValue = normalizeConfiguredString(value);

  return Boolean(normalizedValue?.startsWith('REPLACE_WITH_'));
}

function getExpoConfig() {
  return Constants.expoConfig;
}

export function getReviewRuntimeConfig(): ReviewRuntimeConfig {
  const expoConfig = getExpoConfig();
  const reviewConfig = (expoConfig?.extra as { review?: { iosAppStoreId?: unknown } } | undefined)
    ?.review;

  return {
    iosAppStoreId: normalizeConfiguredString(
      reviewConfig?.iosAppStoreId ?? process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? null,
    ),
    androidPackageName:
      expoConfig?.android?.package ?? process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME ?? '',
  };
}

export function buildManualStoreReviewUrl(
  config: ReviewRuntimeConfig,
  platform: ReviewPlatform = Platform.OS === 'android' ? 'android' : 'ios',
) {
  if (platform === 'ios') {
    const normalizedIosAppStoreId = normalizeConfiguredString(config.iosAppStoreId);

    return normalizedIosAppStoreId && !isTemplatePlaceholder(normalizedIosAppStoreId)
      ? `https://apps.apple.com/app/apple-store/id${normalizedIosAppStoreId}?action=write-review`
      : null;
  }

  return config.androidPackageName && !isTemplatePlaceholder(config.androidPackageName)
    ? `https://play.google.com/store/apps/details?id=${config.androidPackageName}&showAllReviews=true`
    : null;
}

export function canOpenManualStoreReview(
  platform: ReviewPlatform = Platform.OS === 'android' ? 'android' : 'ios',
) {
  return buildManualStoreReviewUrl(getReviewRuntimeConfig(), platform) !== null;
}

export async function openManualStoreReview(
  repositories: Pick<DomainRepositories, 'reviewPromptState'>,
  platform: ReviewPlatform = Platform.OS === 'android' ? 'android' : 'ios',
) {
  const reviewUrl = buildManualStoreReviewUrl(getReviewRuntimeConfig(), platform);

  if (!reviewUrl) {
    return false;
  }

  try {
    await Linking.openURL(reviewUrl);
    await repositories.reviewPromptState.recordManualStoreOpen(new Date().toISOString());
  } catch {
    return false;
  }

  return true;
}

export const nativeReviewApi: NativeReviewApi = {
  isAvailable: () => StoreReview.isAvailableAsync(),
  requestReview: () => StoreReview.requestReview(),
};
