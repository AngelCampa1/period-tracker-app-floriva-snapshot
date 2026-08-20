const path = require('node:path');
const fs = require('node:fs');

const {
  buildAndroidAppLocaleArgs,
  captureLocaleConfigs,
  resolveAndroidEmulatorDetoxServerUrl,
  validateCaptureScreenPreset,
  resolveStoreScreenshotLoggingRoute,
  resolveCaptureConfiguration,
  supportedCaptureLocales,
} = require('@/e2e/store-screenshot-config.js');

describe('store screenshot configuration', () => {
  it('defines native locale mappings for every supported store locale', () => {
    expect(supportedCaptureLocales).toEqual([
      'en',
      'es',
      'de',
      'fr',
      'ja',
      'zh-Hans',
      'pt',
      'ru',
    ]);
    expect(captureLocaleConfigs.es).toEqual({
      ios: { language: 'es', locale: 'es_MX' },
      android: 'es-MX',
    });
    expect(captureLocaleConfigs['zh-Hans']).toEqual({
      ios: { language: 'zh-Hans', locale: 'zh_CN' },
      android: 'zh-CN',
    });
  });

  it('routes default output into platform and locale-specific raw folders', () => {
    const config = resolveCaptureConfiguration({
      env: {
        FLORIVA_CAPTURE: '1',
        FLORIVA_CAPTURE_LOCALE: 'pt',
        FLORIVA_CAPTURE_STANDALONE: '1',
        FLORIVA_SCREENSHOT_CANDIDATE: '1',
        EXPO_PUBLIC_DEV_LAUNCH_PRESET: 'qa-rich-history',
      },
      repoRoot: '/repo',
    });

    expect(config.outDirIos).toBe(
      path.resolve('/repo/floriva-marketing/public/screenshots/ios/pt'),
    );
    expect(config.outDirAndroid).toBe(
      path.resolve('/repo/floriva-marketing/public/screenshots/android/pt'),
    );
    expect(config.standalone).toBe(true);
  });

  it('anchors release rich-history logging captures to local today without changing the legacy QA route', () => {
    expect(
      resolveStoreScreenshotLoggingRoute('tenure-12mo-regular', '2026-07-15'),
    ).toBe('/(app)/calendar/day/2026-07-15');
    expect(
      resolveStoreScreenshotLoggingRoute('qa-rich-history', '2026-07-15'),
    ).toBe('/(app)/calendar/day/2026-04-13');

    expect(
      resolveCaptureConfiguration({
        env: {
          FLORIVA_CAPTURE: '1',
          FLORIVA_CAPTURE_LOCALE: 'en',
          FLORIVA_CAPTURE_STANDALONE: '1',
          FLORIVA_SCREENSHOT_CANDIDATE: '1',
          EXPO_PUBLIC_DEV_LAUNCH_PRESET: 'tenure-12mo-regular',
        },
        repoRoot: '/repo',
      }).launchPreset,
    ).toBe('tenure-12mo-regular');
  });

  it('allows the needs-purchase fixture only for a filtered paywall capture', () => {
    const config = resolveCaptureConfiguration({
      env: {
        FLORIVA_CAPTURE: '1',
        FLORIVA_CAPTURE_LOCALE: 'en',
        FLORIVA_CAPTURE_STANDALONE: '1',
        FLORIVA_SCREENSHOT_CANDIDATE: '1',
        EXPO_PUBLIC_DEV_LAUNCH_PRESET: 'billing-fallback',
      },
      repoRoot: '/repo',
    });

    expect(config.launchPreset).toBe('billing-fallback');
    expect(() =>
      validateCaptureScreenPreset({
        launchPreset: config.launchPreset,
        screenFilter: ['paywall'],
      }),
    ).not.toThrow();
    expect(() =>
      validateCaptureScreenPreset({
        launchPreset: config.launchPreset,
        screenFilter: [],
      }),
    ).toThrow('FLORIVA_CAPTURE_SCREENS=paywall');
  });

  it('keeps import and paywall screenshot fixtures separated', () => {
    expect(() =>
      validateCaptureScreenPreset({
        launchPreset: 'tenure-12mo-regular',
        screenFilter: ['import'],
      }),
    ).toThrow('EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready');
    expect(() =>
      validateCaptureScreenPreset({
        launchPreset: 'tenure-12mo-regular',
        screenFilter: ['paywall'],
      }),
    ).toThrow('EXPO_PUBLIC_DEV_LAUNCH_PRESET=billing-fallback');
  });

  // This is the only assertion in the suite that reaches outside floriva-app/,
  // into the sibling marketing package. That package is not always present —
  // it is absent from the published portfolio snapshot, for one — so the check
  // is skipped rather than failed when the guide cannot be found. A test should
  // not depend on a sibling repo being checked out next to it.
  const storeAssetGuidePath = path.resolve(
    __dirname,
    '../../../floriva-marketing/STORE_ASSET_GUIDE.md',
  );
  const hasStoreAssetGuide = fs.existsSync(storeAssetGuidePath);

  (hasStoreAssetGuide ? it : it.skip)(
    'documents a separate iOS billing-fallback paywall pass',
    () => {
      const guideSource = fs.readFileSync(storeAssetGuidePath, 'utf8');

      expect(guideSource).toContain('EXPO_PUBLIC_DEV_LAUNCH_PRESET=billing-fallback');
      expect(guideSource).toContain('FLORIVA_CAPTURE_SCREENS=paywall');
      expect(guideSource).toContain('ios.sim.screenshotCandidate');
      expect(guideSource).not.toContain('--reuse');
    },
  );

  it('fails closed for missing or unsupported locales', () => {
    expect(() =>
      resolveCaptureConfiguration({
        env: { FLORIVA_CAPTURE: '1' },
        repoRoot: '/repo',
      }),
    ).toThrow('FLORIVA_CAPTURE_LOCALE');

    expect(() =>
      resolveCaptureConfiguration({
        env: { FLORIVA_CAPTURE: '1', FLORIVA_CAPTURE_LOCALE: 'it' },
        repoRoot: '/repo',
      }),
    ).toThrow('Unsupported screenshot locale');
  });

  it('requires the compiled capture flag for standalone candidate runs', () => {
    expect(() =>
      resolveCaptureConfiguration({
        env: {
          FLORIVA_CAPTURE: '1',
          FLORIVA_CAPTURE_LOCALE: 'en',
          FLORIVA_CAPTURE_STANDALONE: '1',
        },
        repoRoot: '/repo',
      }),
    ).toThrow('FLORIVA_SCREENSHOT_CANDIDATE=1');
  });

  it('keeps standalone capture off the Expo dev-client URL and applies Android app locales', () => {
    const harnessSource = fs.readFileSync(
      path.resolve(__dirname, '../../e2e/store-screenshots.e2e.js'),
      'utf8',
    );

    expect(harnessSource).toContain('captureConfiguration.standalone');
    expect(harnessSource).toContain('buildAndroidAppLocaleArgs(');
    expect(harnessSource).toContain('resolveAndroidEmulatorDetoxServerUrl()');
    expect(harnessSource).toContain('detoxServer:');
    expect(harnessSource).toContain(
      "if (!captureConfiguration.standalone && device.getPlatform() !== 'android')",
    );
  });

  it('passes Android the complete app-locale command in the required order', () => {
    expect(buildAndroidAppLocaleArgs('zh-CN')).toEqual([
      'shell',
      'cmd',
      'locale',
      'set-app-locales',
      'app.floriva',
      '--user',
      '0',
      '--locales',
      'zh-CN',
    ]);
  });

  it('routes the dynamic Detox session port through the Android emulator host alias', () => {
    const readFileSync = jest.fn(() =>
      JSON.stringify({
        detoxConfig: {
          session: { server: 'ws://localhost:58997' },
        },
      }),
    );

    expect(
      resolveAndroidEmulatorDetoxServerUrl({
        env: { DETOX_CONFIG_SNAPSHOT_PATH: '/tmp/detox-session.json' },
        readFileSync,
      }),
    ).toBe('ws://10.0.2.2:58997');
    expect(readFileSync).toHaveBeenCalledWith(
      '/tmp/detox-session.json',
      'utf8',
    );
  });

  it('allows an explicit Android host alias without hard-coding the session port', () => {
    expect(
      resolveAndroidEmulatorDetoxServerUrl({
        env: {
          DETOX_ANDROID_HOST: '192.0.2.10',
          DETOX_CONFIG_SNAPSHOT_PATH: '/tmp/detox-session.json',
        },
        readFileSync: () =>
          JSON.stringify({
            detoxConfig: {
              session: { server: 'ws://localhost:43123' },
            },
          }),
      }),
    ).toBe('ws://192.0.2.10:43123');
  });
});
