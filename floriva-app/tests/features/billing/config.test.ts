describe('billing config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = originalEnv;
  });

  it('uses the iOS native product ids for preview builds', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'preview',
      EXPO_PUBLIC_IOS_MONTHLY_PRODUCT_ID: 'floriva.ios.monthly.preview',
      EXPO_PUBLIC_IOS_ANNUAL_PRODUCT_ID: 'floriva.ios.annual.preview',
      EXPO_PUBLIC_IOS_LIFETIME_PRODUCT_ID: 'floriva.ios.lifetime.preview',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.monthlyProductId).toBe('floriva.ios.monthly.preview');
      expect(florivaRuntimeBillingConfig.annualProductId).toBe('floriva.ios.annual.preview');
      expect(florivaRuntimeBillingConfig.lifetimeProductId).toBe('floriva.ios.lifetime.preview');
      expect(florivaRuntimeBillingConfig.termsOfUseUrl).toBe(
        'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
      );
    });
  });

  it('allows the legal document URLs to be configured for release builds', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://floriva.example/privacy',
      EXPO_PUBLIC_TERMS_OF_USE_URL: 'https://floriva.example/terms',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.privacyPolicyUrl).toBe(
        'https://floriva.example/privacy',
      );
      expect(florivaRuntimeBillingConfig.termsOfUseUrl).toBe(
        'https://floriva.example/terms',
      );
    });
  });

  it('uses platform-specific native product ids for production builds', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
      EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID: 'floriva.android.monthly.prod',
      EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID: 'floriva.android.annual.prod',
      EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID: 'floriva.android.lifetime.prod',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.monthlyProductId).toBe('floriva.android.monthly.prod');
      expect(florivaRuntimeBillingConfig.annualProductId).toBe('floriva.android.annual.prod');
      expect(florivaRuntimeBillingConfig.lifetimeProductId).toBe('floriva.android.lifetime.prod');
    });
  });

  it('treats checked-in placeholder product ids as not production-ready config', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
      EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID: 'REPLACE_WITH_ANDROID_MONTHLY_PRODUCT_ID',
      EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID: 'REPLACE_WITH_ANDROID_ANNUAL_PRODUCT_ID',
      EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID: 'REPLACE_WITH_ANDROID_LIFETIME_PRODUCT_ID',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
        hasNativeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.monthlyProductId).toBe(
        'REPLACE_WITH_ANDROID_MONTHLY_PRODUCT_ID',
      );
      expect(hasNativeBillingConfig(florivaRuntimeBillingConfig)).toBe(false);
    });
  });

  it('resolves the save-offer codes, offer ids, and discounted price labels', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.saveOffers.monthly.iosOfferCode).toBe('SAVEMONTHLY');
      expect(florivaRuntimeBillingConfig.saveOffers.monthly.androidOfferId).toBe(
        'save-monthly-80-3mo',
      );
      expect(florivaRuntimeBillingConfig.saveOffers.monthly.discountedPriceLabel).toBe(
        '$1.20/month',
      );
      expect(florivaRuntimeBillingConfig.saveOffers.monthly.iosDiscountedPriceLabel).toBe(
        '$1.19/month',
      );
      expect(florivaRuntimeBillingConfig.saveOffers.monthly.androidDiscountedPriceLabel).toBe(
        '$1.20/month',
      );
      expect(florivaRuntimeBillingConfig.saveOffers.annual.iosOfferCode).toBe('SAVEANNUAL');
      expect(florivaRuntimeBillingConfig.saveOffers.annual.androidOfferId).toBe('save-annual-30');
      expect(florivaRuntimeBillingConfig.saveOffers.annual.discountedPriceLabel).toBe('$27.99');
    });
  });

  it('returns the platform-specific store management URL fallback', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
        },
      }));

      const {
        getManageSubscriptionUrlFallback,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(getManageSubscriptionUrlFallback()).toBe(
        'https://play.google.com/store/account/subscriptions',
      );
    });
  });

  it('uses checked-in Android product ids when release env does not override them', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
        },
      }));

      const {
        florivaRuntimeBillingConfig,
        hasNativeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(florivaRuntimeBillingConfig.monthlyProductId).toBe('floriva.plus.monthly');
      expect(florivaRuntimeBillingConfig.annualProductId).toBe('floriva.plus.annual');
      expect(florivaRuntimeBillingConfig.lifetimeProductId).toBe('floriva.plus.lifetime');
      expect(hasNativeBillingConfig(florivaRuntimeBillingConfig)).toBe(true);
    });
  });

  it('does not crash when runtime billing ids are not strings', () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
    };

    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {},
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
        },
      }));

      const {
        hasNativeBillingConfig,
      } = jest.requireActual('@/src/features/billing/config') as typeof import('@/src/features/billing/config');

      expect(
        hasNativeBillingConfig({
          monthlyProductId: 101 as unknown as string,
          annualProductId: null as unknown as string,
          lifetimeProductId: 'floriva.lifetime',
        }),
      ).toBe(false);
    });
  });
});
