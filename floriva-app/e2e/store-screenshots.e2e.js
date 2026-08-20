/* global waitFor */

// Store-screenshot capture harness.
//
// Drives a deterministic seeded app to every marketing surface, applies a
// clean status bar (9:41, full battery/signal), and writes native-resolution
// captures straight into floriva-marketing/public/screenshots/{ios,android}.
//
// Run (iOS):
//   EXPO_PUBLIC_DEV_LAUNCH_PRESET=tenure-12mo-regular \
//   FLORIVA_CAPTURE=1 \
//   npx detox test -c ios.sim.debug e2e/store-screenshots.e2e.js
//
// Run (Android): same env with -c android.emu.debug.
//
// Gated behind FLORIVA_CAPTURE=1 + an explicit supported preset so it never
// runs in the normal e2e suite.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const {
  buildAndroidAppLocaleArgs,
  resolveAndroidEmulatorDetoxServerUrl,
  resolveStoreScreenshotLoggingRoute,
  resolveCaptureConfiguration,
  validateCaptureScreenPreset,
} = require('./store-screenshot-config');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const repoRoot = path.resolve(__dirname, '..', '..');
const captureConfiguration = resolveCaptureConfiguration({ repoRoot });
const shouldRun = captureConfiguration.shouldRun;
const describeCapture = shouldRun ? describe : describe.skip;
const launchPreset = captureConfiguration.launchPreset;

function getLocalTodayIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Optional comma-separated allow-list of screen `file` names to capture this
// pass (e.g. FLORIVA_CAPTURE_SCREENS=import for the import-ready preset pass).
const screenFilter = (process.env.FLORIVA_CAPTURE_SCREENS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const outDirIos = captureConfiguration.outDirIos;
const outDirAndroid = captureConfiguration.outDirAndroid;

// One entry per marketing screenshot. `scroll` (optional) drags the named
// scroll container so the most flattering content is in frame before capture.
const SCREENS = [
  { file: 'today', route: '/(app)/(tabs)/today', waitId: 'today-screen' },
  { file: 'calendar', route: '/(app)/(tabs)/calendar', waitId: 'calendar-screen' },
  {
    file: 'logging',
    route: resolveStoreScreenshotLoggingRoute(launchPreset, getLocalTodayIso()),
    waitId: 'calendar-day-screen',
  },
  { file: 'insights', route: '/(app)/(tabs)/insights', waitId: 'insights-screen' },
  { file: 'privacy-settings', route: '/(app)/privacy', waitId: 'privacy-explainer-screen' },
  { file: 'import', route: '/(app)/import/review', waitId: 'import-review-screen', preset: 'import-ready' },
  {
    file: 'condition-aware',
    route: '/(app)/insights/condition/pcos',
    waitId: 'insights-condition-screen',
  },
  {
    file: 'ttc-birth-control',
    route: '/(app)/settings/birth-control',
    waitId: 'settings-birth-control-screen',
  },
  // iOS-only Apple review surface. Keep it out of the rich-history pass: the
  // billing-fallback preset exposes the real needs-purchase plan choices.
  {
    file: 'paywall',
    route: '/(app)/subscribe',
    waitId: 'billing-screen',
    iosOnly: true,
    preset: 'billing-fallback',
  },
];

function validateCaptureConfiguration() {
  if (shouldRun) {
    validateCaptureScreenPreset({ launchPreset, screenFilter });
  }
}

function settle(ms = 1200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function blacklistDevServerIfNeeded() {
  if (captureConfiguration.standalone || device.getPlatform() !== 'ios') {
    return;
  }

  await device.setURLBlacklist([
    '.*127\\.0\\.0\\.1.*',
    '.*localhost.*',
    '.*symbolicate.*',
    '.*/hot.*',
    '.*/message.*',
  ]);
}

function applyAndroidAppLocale() {
  execFileSync(
    process.env.ADB_BINARY ?? 'adb',
    buildAndroidAppLocaleArgs(captureConfiguration.localeConfig.android),
  );
}

function buildLaunchOptions({ deleteApp }) {
  const options = {
    newInstance: true,
    delete: deleteApp,
  };

  if (device.getPlatform() === 'ios') {
    options.languageAndLocale = captureConfiguration.localeConfig.ios;
  } else if (captureConfiguration.standalone) {
    // Detox dynamically chooses the host-side session port. Preserve that port,
    // but use the Android Emulator's direct host alias because adb reverse is
    // unreliable on some Play-enabled AVDs.
    options.launchArgs = {
      detoxServer: resolveAndroidEmulatorDetoxServerUrl(),
    };
  } else if (!captureConfiguration.standalone) {
    options.url = devClientUrl;
  }

  return options;
}

async function openRoute(routePath) {
  const normalizedPath = routePath
    .replace(/^\/\(app\)\/\(tabs\)\//, '')
    .replace(/^\/\(app\)\//, '')
    .replace(/^\//, '');
  const url = `floriva:///${normalizedPath}?disableOnboarding=1`;

  if (device.getPlatform() === 'android') {
    execFileSync(process.env.ADB_BINARY ?? 'adb', [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      url,
      'app.floriva',
    ]);
    return;
  }

  await device.openURL({ url });
}

function applyCleanStatusBarIos() {
  // simctl status_bar override gives the Apple-standard marketing status bar.
  execFileSync('xcrun', [
    'simctl',
    'status_bar',
    device.id,
    'override',
    '--time',
    '9:41',
    '--dataNetwork',
    'wifi',
    '--wifiMode',
    'active',
    '--wifiBars',
    '3',
    '--cellularMode',
    'active',
    '--cellularBars',
    '4',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
  ]);
}

function applyCleanStatusBarAndroid() {
  const adb = process.env.ADB_BINARY ?? 'adb';
  const run = (args) => execFileSync(adb, ['shell', ...args]);
  run(['settings', 'put', 'global', 'sysui_demo_allowed', '1']);
  run(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'enter']);
  run(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'clock', '-e', 'hhmm', '0941']);
  run([
    'am', 'broadcast', '-a', 'com.android.systemui.demo',
    '-e', 'command', 'network', '-e', 'wifi', 'hide',
  ]);
  run([
    'am', 'broadcast', '-a', 'com.android.systemui.demo',
    '-e', 'command', 'network', '-e', 'mobile', 'hide',
  ]);
  run([
    'am', 'broadcast', '-a', 'com.android.systemui.demo',
    '-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false',
  ]);
  run(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'notifications', '-e', 'visible', 'false']);
}

function clearCleanStatusBarIos() {
  try {
    execFileSync('xcrun', ['simctl', 'status_bar', device.id, 'clear']);
  } catch {
    // Best-effort restore; nothing to do if the simulator is already gone.
  }
}

function clearCleanStatusBarAndroid() {
  try {
    execFileSync(process.env.ADB_BINARY ?? 'adb', [
      'shell',
      'am',
      'broadcast',
      '-a',
      'com.android.systemui.demo',
      '-e',
      'command',
      'exit',
    ]);
  } catch {
    // Best-effort restore; ignore if the emulator/demo mode is unavailable.
  }
}

function captureScreen(file) {
  if (device.getPlatform() === 'android') {
    const png = execFileSync(process.env.ADB_BINARY ?? 'adb', ['exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(path.join(outDirAndroid, `${file}.png`), png);
    return;
  }
  execFileSync('xcrun', [
    'simctl',
    'io',
    device.id,
    'screenshot',
    path.join(outDirIos, `${file}.png`),
  ]);
}

describeCapture('Store screenshots', () => {
  beforeAll(async () => {
    validateCaptureConfiguration();

    mkdirSync(outDirIos, { recursive: true });
    mkdirSync(outDirAndroid, { recursive: true });

    if (device.getPlatform() === 'android') {
      // Detox installs the target APK before the test starts. Set the per-app
      // locale before the deterministic preset launches; uninstalling here
      // would clear that locale assignment.
      applyAndroidAppLocale();
      await device.launchApp(buildLaunchOptions({ deleteApp: false }));
    } else {
      await device.launchApp(buildLaunchOptions({ deleteApp: true }));
    }

    await device.disableSynchronization();
    await blacklistDevServerIfNeeded();
    if (!captureConfiguration.standalone && device.getPlatform() !== 'android') {
      await device.openURL({ url: devClientUrl });
    }
    if (!captureConfiguration.standalone) {
      await dismissDeveloperMenuIntroIfNeeded();
    }

    // Wait for the JS bundle + first screen to mount. The landing screen varies
    // by preset (today for rich-history presets, import review for import-ready), so
    // tolerate either before applying the status-bar override.
    try {
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(60000);
    } catch {
      await settle(4000);
    }

    if (device.getPlatform() === 'android') {
      applyCleanStatusBarAndroid();
    } else {
      applyCleanStatusBarIos();
    }
  });

  afterAll(async () => {
    // Restore the simulator/emulator status bar so the override never leaks
    // into later e2e runs or manual use of the same device.
    if (device.getPlatform() === 'android') {
      clearCleanStatusBarAndroid();
    } else {
      clearCleanStatusBarIos();
    }
  });

  it('captures every marketing surface', async () => {
    const isAndroid = device.getPlatform() === 'android';

    for (const screen of SCREENS) {
      if (screen.iosOnly && isAndroid) {
        continue;
      }
      if (screenFilter.length && !screenFilter.includes(screen.file)) {
        continue;
      }
      if (!screenFilter.length && screen.preset && screen.preset !== launchPreset) {
        continue;
      }

      await openRoute(screen.route);
      await waitFor(element(by.id(screen.waitId))).toBeVisible().withTimeout(20000);

      if (screen.scroll) {
        const times = screen.scroll.times ?? 1;
        for (let i = 0; i < times; i += 1) {
          try {
            await element(by.id(screen.scroll.id)).scroll(screen.scroll.dy, 'down');
          } catch {
            // Container may be shorter than the requested scroll; ignore.
          }
        }
      }

      await settle();
      captureScreen(screen.file);
    }
  });
});
