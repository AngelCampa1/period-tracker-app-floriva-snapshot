import type { ConfigContext, ExpoConfig } from 'expo/config';

const iosInfoPlist = {
  ITSAppUsesNonExemptEncryption: false,
  CFBundleLocalizations: ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'],
  // Required so `Linking.canOpenURL('mailto:')` returns true on iOS when a mail
  // client is installed; without it the support "Email us" flow always falls
  // back to showing the address instead of opening the composer.
  LSApplicationQueriesSchemes: ['mailto'],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Floriva',
  slug: 'floriva',
  version: '1.4.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'floriva',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F4ECE0',
  },
  ios: {
    supportsTablet: false,
    requireFullScreen: true,
    bundleIdentifier: 'app.floriva',
    buildNumber: '22',
    infoPlist: iosInfoPlist,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#F4ECE0',
    },
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: 'app.floriva',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-asset',
    'expo-audio',
    'expo-localization',
    'expo-secure-store',
    'expo-web-browser',
    'expo-iap',
    '@react-native-community/datetimepicker',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Allow Floriva to use Face ID to unlock your cycle history on this device.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    autolinkingModuleResolution: true,
  },
  extra: {
    devLaunchPreset: process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null,
    ...(process.env.FLORIVA_SCREENSHOT_CANDIDATE === '1'
      ? { screenshotCandidateEnabled: true }
      : {}),
    eas: {
      projectId: '00000000-0000-0000-0000-000000000000',
    },
    billing: {
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
          androidOfferId:
            process.env.EXPO_PUBLIC_ANDROID_SAVE_ANNUAL_OFFER_ID ?? 'save-annual-30',
        },
      },
      reminderLeadDays: 3,
      reminderHour: 9,
      reminderMinute: 0,
      privacyPolicyUrl:
        process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://floriva.app/privacy',
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
    },
    review: {
      iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? null,
    },
  },
});
