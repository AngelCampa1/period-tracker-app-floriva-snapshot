import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { BillingConfig } from '@/src/features/billing/model';

type BillingPlatformKey = 'ios' | 'android';

type BillingStoreConfig = {
  monthlyProductId: string;
  annualProductId: string;
  lifetimeProductId: string;
  managementUrl: string;
};

type SaveOfferPlanConfig = {
  discountedPriceLabel: string;
  iosDiscountedPriceLabel?: string;
  androidDiscountedPriceLabel?: string;
  iosOfferCode: string;
  androidOfferId: string;
};

type SaveOffersConfig = {
  monthly: SaveOfferPlanConfig;
  annual: SaveOfferPlanConfig;
};

type BillingConfigShape = BillingConfig & {
  privacyPolicyUrl: string;
  termsOfUseUrl: string;
  supportUrl: string;
  supportEmail: string;
  saveOffers: SaveOffersConfig;
  ios: BillingStoreConfig;
  android: BillingStoreConfig;
};

type BillingConfigOverrides = Partial<
  Omit<BillingConfigShape, 'ios' | 'android'>
> & {
  ios?: Partial<BillingStoreConfig>;
  android?: Partial<BillingStoreConfig>;
};

export type BillingRuntimeConfig = BillingConfig &
  BillingStoreConfig & {
    privacyPolicyUrl: string;
    termsOfUseUrl: string;
    supportUrl: string;
    supportEmail: string;
    saveOffers: SaveOffersConfig;
  };

function normalizeRuntimeString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function isTemplatePlaceholder(value: unknown) {
  return normalizeRuntimeString(value).startsWith('REPLACE_WITH_');
}

const fallbackBillingConfig: BillingConfigShape = {
  monthlyPriceLabel: '$5.99/month',
  annualPriceLabel: '$39.99/year',
  lifetimePriceLabel: '$59.99',
  saveOffers: {
    monthly: {
      discountedPriceLabel: '$1.20/month',
      iosDiscountedPriceLabel: '$1.19/month',
      androidDiscountedPriceLabel: '$1.20/month',
      iosOfferCode: process.env.EXPO_PUBLIC_IOS_SAVE_MONTHLY_CODE ?? 'SAVEMONTHLY',
      androidOfferId:
        process.env.EXPO_PUBLIC_ANDROID_SAVE_MONTHLY_OFFER_ID ?? 'save-monthly-80-3mo',
    },
    annual: {
      discountedPriceLabel: '$27.99',
      iosOfferCode: process.env.EXPO_PUBLIC_IOS_SAVE_ANNUAL_CODE ?? 'SAVEANNUAL',
      androidOfferId: process.env.EXPO_PUBLIC_ANDROID_SAVE_ANNUAL_OFFER_ID ?? 'save-annual-30',
    },
  },
  reminderLeadDays: 3,
  reminderHour: 9,
  reminderMinute: 0,
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://floriva.app/privacy',
  termsOfUseUrl:
    process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ??
    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://floriva.app/support',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@floriva.app',
  ios: {
    monthlyProductId: process.env.EXPO_PUBLIC_IOS_MONTHLY_PRODUCT_ID ?? 'floriva.plus.monthly',
    annualProductId: process.env.EXPO_PUBLIC_IOS_ANNUAL_PRODUCT_ID ?? 'floriva.plus.annual',
    lifetimeProductId: process.env.EXPO_PUBLIC_IOS_LIFETIME_PRODUCT_ID ?? 'floriva.plus.lifetime',
    managementUrl: 'https://apps.apple.com/account/subscriptions',
  },
  android: {
    monthlyProductId:
      process.env.EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID ?? 'floriva.plus.monthly',
    annualProductId:
      process.env.EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID ?? 'floriva.plus.annual',
    lifetimeProductId:
      process.env.EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID ?? 'floriva.plus.lifetime',
    managementUrl: 'https://play.google.com/store/account/subscriptions',
  },
};

const billingOverrides = (
  Constants.expoConfig?.extra as { billing?: BillingConfigOverrides } | undefined
)?.billing;

export const florivaBillingConfig: BillingConfigShape = {
  ...fallbackBillingConfig,
  ...billingOverrides,
  ios: {
    ...fallbackBillingConfig.ios,
    ...(billingOverrides?.ios ?? {}),
  },
  android: {
    ...fallbackBillingConfig.android,
    ...(billingOverrides?.android ?? {}),
  },
};

export function getBillingStoreConfig(
  platform: BillingPlatformKey = Platform.OS === 'android' ? 'android' : 'ios',
): BillingStoreConfig {
  return florivaBillingConfig[platform];
}

export const florivaRuntimeBillingConfig: BillingRuntimeConfig = {
  monthlyPriceLabel: florivaBillingConfig.monthlyPriceLabel,
  annualPriceLabel: florivaBillingConfig.annualPriceLabel,
  lifetimePriceLabel: florivaBillingConfig.lifetimePriceLabel,
  reminderLeadDays: florivaBillingConfig.reminderLeadDays,
  reminderHour: florivaBillingConfig.reminderHour,
  reminderMinute: florivaBillingConfig.reminderMinute,
  privacyPolicyUrl: florivaBillingConfig.privacyPolicyUrl,
  termsOfUseUrl: florivaBillingConfig.termsOfUseUrl,
  supportUrl: florivaBillingConfig.supportUrl,
  supportEmail: florivaBillingConfig.supportEmail,
  saveOffers: florivaBillingConfig.saveOffers,
  ...getBillingStoreConfig(),
};

export function getManageSubscriptionUrlFallback() {
  return getBillingStoreConfig().managementUrl;
}

export function hasNativeBillingConfig(
  config: Pick<BillingRuntimeConfig, 'monthlyProductId' | 'annualProductId' | 'lifetimeProductId'> = florivaRuntimeBillingConfig,
) {
  const monthlyProductId = normalizeRuntimeString(config.monthlyProductId);
  const annualProductId = normalizeRuntimeString(config.annualProductId);
  const lifetimeProductId = normalizeRuntimeString(config.lifetimeProductId);

  return Boolean(
    monthlyProductId &&
      annualProductId &&
      lifetimeProductId &&
      !isTemplatePlaceholder(monthlyProductId) &&
      !isTemplatePlaceholder(annualProductId) &&
      !isTemplatePlaceholder(lifetimeProductId),
  );
}
