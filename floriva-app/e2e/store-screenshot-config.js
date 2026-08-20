const path = require('node:path');
const { readFileSync: readFileSyncFromFs } = require('node:fs');

const supportedCaptureLocales = [
  'en',
  'es',
  'de',
  'fr',
  'ja',
  'zh-Hans',
  'pt',
  'ru',
];

const captureLocaleConfigs = {
  en: { ios: { language: 'en', locale: 'en_US' }, android: 'en-US' },
  es: { ios: { language: 'es', locale: 'es_MX' }, android: 'es-MX' },
  de: { ios: { language: 'de', locale: 'de_DE' }, android: 'de-DE' },
  fr: { ios: { language: 'fr', locale: 'fr_FR' }, android: 'fr-FR' },
  ja: { ios: { language: 'ja', locale: 'ja_JP' }, android: 'ja-JP' },
  'zh-Hans': {
    ios: { language: 'zh-Hans', locale: 'zh_CN' },
    android: 'zh-CN',
  },
  pt: { ios: { language: 'pt', locale: 'pt_BR' }, android: 'pt-BR' },
  ru: { ios: { language: 'ru', locale: 'ru_RU' }, android: 'ru-RU' },
};

const supportedCapturePresets = [
  'qa-rich-history',
  'tenure-12mo-regular',
  'import-ready',
  'billing-fallback',
];

function validateCaptureScreenPreset({ launchPreset, screenFilter }) {
  const isSingleScreenPass = (screen) =>
    screenFilter.length === 1 && screenFilter[0] === screen;

  if (launchPreset === 'billing-fallback' && !isSingleScreenPass('paywall')) {
    throw new Error(
      'The billing-fallback screenshot preset requires FLORIVA_CAPTURE_SCREENS=paywall.',
    );
  }
  if (screenFilter.includes('paywall') && launchPreset !== 'billing-fallback') {
    throw new Error(
      'The paywall screenshot requires EXPO_PUBLIC_DEV_LAUNCH_PRESET=billing-fallback so Apple review sees the needs-purchase plan choices.',
    );
  }
  if (screenFilter.includes('import') && launchPreset !== 'import-ready') {
    throw new Error(
      'The import screenshot requires EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready so the seeded review preview exists.',
    );
  }
}

function resolveStoreScreenshotLoggingRoute(launchPreset, todayIso) {
  return launchPreset === 'tenure-12mo-regular'
    ? `/(app)/calendar/day/${todayIso}`
    : '/(app)/calendar/day/2026-04-13';
}

function buildAndroidAppLocaleArgs(locale) {
  return [
    'shell',
    'cmd',
    'locale',
    'set-app-locales',
    'app.floriva',
    '--user',
    '0',
    '--locales',
    locale,
  ];
}

function resolveAndroidEmulatorDetoxServerUrl({
  env = process.env,
  readFileSync = readFileSyncFromFs,
} = {}) {
  const snapshotPath = env.DETOX_CONFIG_SNAPSHOT_PATH;
  if (!snapshotPath) {
    throw new Error(
      'DETOX_CONFIG_SNAPSHOT_PATH is required for standalone Android screenshot capture.',
    );
  }

  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const server = snapshot.detoxConfig?.session?.server;
  if (!server) {
    throw new Error('The Detox config snapshot does not contain a session server URL.');
  }

  const serverUrl = new URL(server);
  serverUrl.hostname = env.DETOX_ANDROID_HOST ?? '10.0.2.2';

  const pathAndQuery = serverUrl.pathname === '/'
    ? `${serverUrl.search}${serverUrl.hash}`
    : `${serverUrl.pathname}${serverUrl.search}${serverUrl.hash}`;
  return `${serverUrl.protocol}//${serverUrl.host}${pathAndQuery}`;
}

function resolveConfiguredOutput(configuredPath, fallbackPath) {
  return path.resolve(configuredPath ?? fallbackPath);
}

function resolveCaptureConfiguration({ env = process.env, repoRoot }) {
  const shouldRun = env.FLORIVA_CAPTURE === '1';
  const locale = env.FLORIVA_CAPTURE_LOCALE ?? (shouldRun ? null : 'en');

  if (!locale) {
    throw new Error(
      `FLORIVA_CAPTURE_LOCALE is required. Choose one of: ${supportedCaptureLocales.join(', ')}.`,
    );
  }
  if (!supportedCaptureLocales.includes(locale)) {
    throw new Error(
      `Unsupported screenshot locale "${locale}". Choose one of: ${supportedCaptureLocales.join(', ')}.`,
    );
  }

  const standalone = env.FLORIVA_CAPTURE_STANDALONE === '1';
  if (shouldRun && standalone && env.FLORIVA_SCREENSHOT_CANDIDATE !== '1') {
    throw new Error(
      'Standalone capture requires a binary compiled with FLORIVA_SCREENSHOT_CANDIDATE=1.',
    );
  }

  const launchPreset = env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? 'qa-rich-history';
  if (shouldRun && !supportedCapturePresets.includes(launchPreset)) {
    throw new Error(
      `Unsupported screenshot preset "${launchPreset}". Choose one of: ${supportedCapturePresets.join(', ')}.`,
    );
  }

  const screenshotRoot = path.join(repoRoot, 'floriva-marketing', 'public', 'screenshots');

  return {
    shouldRun,
    locale,
    localeConfig: captureLocaleConfigs[locale],
    launchPreset,
    standalone,
    outDirIos: resolveConfiguredOutput(
      env.FLORIVA_CAPTURE_OUT_IOS,
      path.join(screenshotRoot, 'ios', locale),
    ),
    outDirAndroid: resolveConfiguredOutput(
      env.FLORIVA_CAPTURE_OUT_ANDROID,
      path.join(screenshotRoot, 'android', locale),
    ),
  };
}

module.exports = {
  buildAndroidAppLocaleArgs,
  captureLocaleConfigs,
  resolveAndroidEmulatorDetoxServerUrl,
  resolveStoreScreenshotLoggingRoute,
  resolveCaptureConfiguration,
  supportedCaptureLocales,
  supportedCapturePresets,
  validateCaptureScreenPreset,
};
