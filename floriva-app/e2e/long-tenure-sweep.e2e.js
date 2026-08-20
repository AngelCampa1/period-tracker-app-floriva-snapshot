/* global waitFor, system */

// Long-tenure visual sweep harness (1.2.0 bug hunt, Phase 3).
//
// Adapted from e2e/store-screenshots.e2e.js: drives a tenure-preset-seeded
// dev-client build to every sweep surface, applies a clean status bar, and
// captures a top-of-screen PNG plus an after-scroll-to-bottom PNG (`-b.png`)
// per surface. Per-surface open-route-to-first-visible timings are appended
// to a shared timings.csv (variant, platform, surface, ms).
//
// Run (driven by scripts/run-tenure-sweep.sh, one Metro restart per variant):
//   FLORIVA_TENURE_SWEEP=1 \
//   FLORIVA_SWEEP_VARIANT=tenure-12mo-regular \
//   FLORIVA_SWEEP_OLDEST_DATE=2025-07-24 \
//   FLORIVA_SWEEP_SET=full \
//   FLORIVA_SWEEP_VIDEO=1 \
//   EXPO_PUBLIC_DEV_LAUNCH_PRESET=tenure-12mo-regular \
//   npx detox test -c ios.sim.debug e2e/long-tenure-sweep.e2e.js --reuse
//
// Gated behind FLORIVA_TENURE_SWEEP=1 so it never runs in the normal suite.

const { execFileSync, spawn } = require('node:child_process');
const { appendFileSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const adbBinary = process.env.ADB_BINARY ?? 'adb';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const shouldRun = process.env.FLORIVA_TENURE_SWEEP === '1';
const describeSweep = shouldRun ? describe : describe.skip;

const variant =
  process.env.FLORIVA_SWEEP_VARIANT ?? process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? 'unknown-variant';
const oldestDate = process.env.FLORIVA_SWEEP_OLDEST_DATE ?? null;
const sweepSet = process.env.FLORIVA_SWEEP_SET === 'reduced' ? 'reduced' : 'full';
const shouldRecordVideo = process.env.FLORIVA_SWEEP_VIDEO === '1';

const repoRoot = path.resolve(__dirname, '..');
const outRoot = process.env.FLORIVA_SWEEP_OUT_ROOT
  ? path.resolve(process.env.FLORIVA_SWEEP_OUT_ROOT)
  : path.join(repoRoot, 'docs', 'qa', '2026-07-06-long-tenure-sweep');
const timingsCsvPath = process.env.FLORIVA_SWEEP_TIMINGS
  ? path.resolve(process.env.FLORIVA_SWEEP_TIMINGS)
  : path.join(outRoot, 'timings.csv');
const videoDir = path.join(outRoot, 'video');

// One entry per sweep surface. `monthsBack` taps the calendar previous-month
// button that many times before capturing. `extraScrollStops` captures an
// additional mid-scroll frame (used for the private timeline top/mid/bottom
// triple). Every surface gets a top capture and a `-b.png` bottom capture.
const FULL_SURFACES = [
  { name: 'today', route: '/(app)/(tabs)/today', waitId: 'today-screen' },
  {
    name: 'calendar-current',
    route: '/(app)/(tabs)/calendar',
    waitId: 'calendar-screen',
    monthsBack: 0,
  },
  {
    name: 'calendar-minus-1mo',
    route: '/(app)/(tabs)/calendar',
    waitId: 'calendar-screen',
    monthsBack: 1,
  },
  {
    name: 'calendar-minus-6mo',
    route: '/(app)/(tabs)/calendar',
    waitId: 'calendar-screen',
    monthsBack: 6,
  },
  {
    name: 'oldest-day',
    route: () => (oldestDate ? `/(app)/calendar/day/${oldestDate}` : null),
    waitId: 'calendar-day-screen',
  },
  { name: 'calendar-history', route: '/(app)/calendar/history', waitId: 'calendar-history-screen' },
  { name: 'insights', route: '/(app)/(tabs)/insights', waitId: 'insights-screen' },
  {
    name: 'condition-pcos',
    route: '/(app)/insights/condition/pcos',
    waitId: 'insights-condition-screen',
    conditionKey: 'pcos',
  },
  {
    name: 'condition-pmdd',
    route: '/(app)/insights/condition/pmdd',
    waitId: 'insights-condition-screen',
    conditionKey: 'pmdd',
  },
  {
    name: 'condition-endometriosis',
    route: '/(app)/insights/condition/endometriosis',
    waitId: 'insights-condition-screen',
    conditionKey: 'endometriosis',
  },
  {
    name: 'monthly-briefing',
    route: '/(app)/insights/monthly-briefing',
    waitId: 'insights-monthly-briefing-screen',
  },
  {
    name: 'timeline',
    route: '/(app)/calendar/timeline',
    waitId: 'calendar-timeline-screen',
    extraScrollStops: true,
  },
  { name: 'settings', route: '/(app)/(tabs)/settings', waitId: 'settings-screen' },
  {
    name: 'birth-control',
    route: '/(app)/settings/birth-control',
    waitId: 'settings-birth-control-screen',
  },
  { name: 'privacy', route: '/(app)/privacy', waitId: 'privacy-explainer-screen' },
  { name: 'backup', route: '/(app)/backup/export', waitId: 'backup-screen' },
  // iOS-only paywall surface (same convention as e2e/store-screenshots.e2e.js).
  { name: 'paywall', route: '/(app)/subscribe', waitId: 'billing-screen', iosOnly: true },
];

// LT-16: `InsightsConditionScreen` deliberately self-redirects to /insights
// for any conditionKey the profile does not tag (`shouldRedirectToInsights`).
// Deep-linking an untagged condition therefore must expect the INSIGHTS hub,
// not the condition screen — the Phase 3 sweep misread that redirect as
// "condition-endometriosis never mounts" (20s timeout) and silently captured
// the insights hub as "condition-pmdd.png" (false positive). This map mirrors
// each tenure variant's `profile.conditionTags` in
// src/testing/tenureFixtures.ts; only the full-set (12-month) variants visit
// condition surfaces at all.
const TAGGED_CONDITIONS_BY_VARIANT = {
  'tenure-12mo-regular': ['pcos', 'pmdd', 'endometriosis'],
  'tenure-12mo-irregular': ['pcos'],
};

function conditionSurfaceExpectsRedirect(surface) {
  if (!surface.conditionKey) {
    return false;
  }

  const taggedConditions = TAGGED_CONDITIONS_BY_VARIANT[variant] ?? [];
  return !taggedConditions.includes(surface.conditionKey);
}

const REDUCED_SURFACE_NAMES = new Set([
  'today',
  'calendar-current',
  'insights',
  'timeline',
  'settings',
  'oldest-day',
  'backup',
]);

// Optional comma-separated deny-list of surface names, e.g.
// FLORIVA_SWEEP_SKIP=oldest-day when a surface is known to hang the app
// (capture the defect separately and let the rest of the sweep proceed).
const skippedSurfaceNames = new Set(
  (process.env.FLORIVA_SWEEP_SKIP ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const surfaces = (
  sweepSet === 'reduced'
    ? FULL_SURFACES.filter((surface) => REDUCED_SURFACE_NAMES.has(surface.name))
    : FULL_SURFACES
).filter((surface) => !skippedSurfaceNames.has(surface.name));

// Scroll-video surfaces (12-month variants only, gated by FLORIVA_SWEEP_VIDEO).
// The FLORIVA_SWEEP_SKIP deny-list applies here too, so a surface that hangs
// the app can be excluded from both the capture loop and the video pass.
const VIDEO_SURFACES = [
  { name: 'timeline', route: '/(app)/calendar/timeline', waitId: 'calendar-timeline-screen' },
  {
    name: 'calendar-history',
    route: '/(app)/calendar/history',
    waitId: 'calendar-history-screen',
  },
].filter((surface) => !skippedSurfaceNames.has(surface.name));

function settle(ms = 1200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function platformName() {
  return device.getPlatform();
}

function outDir() {
  return path.join(outRoot, variant, platformName());
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
  if (device.getPlatform() !== 'ios') {
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

// iOS shows a one-time "Open in “Floriva”?" SpringBoard confirmation the
// first time a custom-scheme URL is opened after a fresh install (the
// `delete: true` launch below reinstalls the app every run). Detox's
// system-level interaction API (XCUITest-backed, detox >= 20.9) can tap it;
// best-effort because the alert only appears on the first open.
async function acceptOpenInAppAlertIfNeeded() {
  if (device.getPlatform() !== 'ios' || typeof system === 'undefined') {
    return;
  }

  try {
    await waitFor(system.element(by.system.label('Open'))).toExist().withTimeout(2000);
    await system.element(by.system.label('Open')).tap();
  } catch {
    // No confirmation alert pending — the scheme was already approved.
  }
}

async function openRoute(routePath) {
  const normalizedPath = routePath
    .replace(/^\/\(app\)\/\(tabs\)\//, '')
    .replace(/^\/\(app\)\//, '')
    .replace(/^\//, '');
  const url = `floriva:///${normalizedPath}?disableOnboarding=1`;

  if (device.getPlatform() === 'android') {
    execFileSync(adbBinary, [
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
  await acceptOpenInAppAlertIfNeeded();
}

function applyCleanStatusBarIos() {
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

function clearCleanStatusBarIos() {
  try {
    execFileSync('xcrun', ['simctl', 'status_bar', device.id, 'clear']);
  } catch {
    // Best-effort restore; nothing to do if the simulator is already gone.
  }
}

// Android equivalent of the iOS 9:41 status-bar override: SystemUI demo mode
// (clean clock, full battery/wifi, no notification icons). Best-effort — a
// failure here must not abort the sweep.
function applyCleanStatusBarAndroid() {
  const demoBroadcast = (extras) =>
    execFileSync(adbBinary, [
      'shell',
      'am',
      'broadcast',
      '-a',
      'com.android.systemui.demo',
      ...extras,
    ]);
  try {
    execFileSync(adbBinary, ['shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1']);
    demoBroadcast(['-e', 'command', 'enter']);
    demoBroadcast(['-e', 'command', 'clock', '-e', 'hhmm', '0941']);
    demoBroadcast(['-e', 'command', 'battery', '-e', 'plugged', 'false', '-e', 'level', '100']);
    demoBroadcast(['-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4']);
    demoBroadcast(['-e', 'command', 'notifications', '-e', 'visible', 'false']);
  } catch {
    // Demo mode unavailable on this image; captures keep the real status bar.
  }
}

function clearCleanStatusBarAndroid() {
  try {
    execFileSync(adbBinary, [
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
    // Best-effort restore; nothing to do if the emulator is already gone.
  }
}

function captureScreen(fileBaseName) {
  const target = path.join(outDir(), `${fileBaseName}.png`);
  if (device.getPlatform() === 'android') {
    const { writeFileSync } = require('node:fs');
    const png = execFileSync(adbBinary, ['exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(target, png);
    return;
  }
  execFileSync('xcrun', ['simctl', 'io', device.id, 'screenshot', target]);
}

function recordTiming(surfaceName, ms) {
  if (!existsSync(timingsCsvPath)) {
    appendFileSync(timingsCsvPath, 'variant,platform,surface,ms\n');
  }
  appendFileSync(timingsCsvPath, `${variant},${platformName()},${surfaceName},${ms}\n`);
}

async function scrollToBottomBestEffort(waitId) {
  try {
    await element(by.id(`${waitId}-scroll`)).scrollTo('bottom');
  } catch {
    // Content may fit on one screen; the bottom capture then equals the top.
  }
}

async function scrollDownBestEffort(waitId, dy) {
  try {
    await element(by.id(`${waitId}-scroll`)).scroll(dy, 'down');
  } catch {
    // Container shorter than the requested scroll; ignore.
  }
}

async function scrollToTopBestEffort(waitId) {
  try {
    await element(by.id(`${waitId}-scroll`)).scrollTo('top');
  } catch {
    // Already at top / not scrollable; ignore.
  }
}

// The calendar screen keeps its month offset when its route is re-opened via
// deep link (same mounted screen), so month navigation must be relative to
// wherever the previous calendar surface left it.
let calendarMonthOffset = 0;

// Opens the surface route, waits for its first visible assertion (recording
// the elapsed ms), then runs any post-navigation steps (month taps).
async function openSurface(surface) {
  const route = typeof surface.route === 'function' ? surface.route() : surface.route;
  if (!route) {
    return false;
  }

  // LT-16: an untagged condition deep link redirects to the insights hub by
  // design — wait for (and capture) THAT, instead of timing out on a
  // condition screen that legitimately never stays mounted.
  const expectsRedirect = conditionSurfaceExpectsRedirect(surface);
  const effectiveWaitId = expectsRedirect ? 'insights-screen' : surface.waitId;

  const startedAt = Date.now();
  await openRoute(route);
  await waitFor(element(by.id(effectiveWaitId))).toBeVisible().withTimeout(20000);
  recordTiming(
    expectsRedirect ? `${surface.name}-redirected` : surface.name,
    Date.now() - startedAt,
  );

  // LT-14/LT-15: Detox's scrollTo (ScrollToEdgeAction) runs synchronously on
  // the app's MAIN thread and can spin for minutes (or wedge outright)
  // against a screen whose layout is still settling — the Phase 3 "app
  // freezes" were this action, not app JS (see docs/qa/
  // 2026-07-06-long-tenure-sweep/triage/timeline-freeze-mainthread-sample.txt).
  // Let entering animations finish before issuing any scroll action.
  await settle(800);

  // Re-opening a route that is already mounted keeps its previous scroll
  // offset (e.g. the calendar left at the bottom by the prior surface's
  // bottom capture), so reset to the top before interacting/capturing.
  await scrollToTopBestEffort(effectiveWaitId);
  await settle(400);

  if (surface.monthsBack != null) {
    const taps = surface.monthsBack - calendarMonthOffset;
    const buttonId = taps >= 0 ? 'calendar-previous-month-button' : 'calendar-next-month-button';
    // Android drops a tap now and then if it lands while the previous month
    // transition is still settling (Phase 4 hit this once: a 6-tap sequence
    // landed on February instead of January), so give it a longer settle.
    const monthTapSettleMs = device.getPlatform() === 'android' ? 700 : 400;
    for (let i = 0; i < Math.abs(taps); i += 1) {
      await waitFor(element(by.id(buttonId))).toBeVisible().withTimeout(5000);
      await element(by.id(buttonId)).tap();
      await settle(monthTapSettleMs);
    }
    calendarMonthOffset = surface.monthsBack;
  }

  return expectsRedirect ? 'redirected' : true;
}

async function stopVideoRecording(recording) {
  if (!recording) {
    return;
  }
  const exited = new Promise((resolve) => {
    recording.once('exit', resolve);
    recording.once('error', resolve);
  });
  recording.kill('SIGINT');
  await Promise.race([exited, settle(15000)]);
}

// Android: screenrecord runs ON the device and hard-caps each file at 3 min
// (--time-limit max 180 s); the scroll pass below finishes well inside that,
// so a single file per surface suffices. Stop with an on-device SIGINT so the
// recorder finalizes the MP4 (killing the local adb client corrupts it), then
// pull the file off the emulator.
async function stopAndroidScreenRecording(recording, devicePath, videoPath) {
  try {
    execFileSync(adbBinary, ['shell', 'pkill', '-INT', 'screenrecord']);
  } catch {
    // Recorder already exited (e.g. hit its --time-limit).
  }
  const exited = new Promise((resolve) => {
    recording.once('exit', resolve);
    recording.once('error', resolve);
  });
  await Promise.race([exited, settle(15000)]);
  await settle(1000);
  execFileSync(adbBinary, ['pull', devicePath, videoPath]);
  execFileSync(adbBinary, ['shell', 'rm', '-f', devicePath]);
}

describeSweep(`Long-tenure sweep (${variant})`, () => {
  // The full 17-surface loop (open + wait + settle + double capture each)
  // legitimately runs past the suite-wide 200s testTimeout.
  jest.setTimeout(900000);

  beforeAll(async () => {
    if (!oldestDate) {
      throw new Error(
        'FLORIVA_SWEEP_OLDEST_DATE is required (see scripts/print-tenure-oldest-date.ts).',
      );
    }

    mkdirSync(outDir(), { recursive: true });
    if (shouldRecordVideo) {
      mkdirSync(videoDir, { recursive: true });
    }

    const launchOptions =
      device.getPlatform() === 'android'
        ? { newInstance: true, delete: true, url: devClientUrl }
        : { newInstance: true, delete: true };

    await device.launchApp(launchOptions);
    await device.disableSynchronization();
    await blacklistDevServerIfNeeded();
    if (device.getPlatform() !== 'android') {
      await device.openURL({ url: devClientUrl });
      await acceptOpenInAppAlertIfNeeded();
    }
    await dismissDeveloperMenuIntroIfNeeded();

    // Wait for the JS bundle + seeded landing screen (Today for every tenure
    // preset) to mount before applying the status-bar override.
    try {
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(120000);
    } catch {
      await settle(4000);
    }

    if (device.getPlatform() === 'ios') {
      applyCleanStatusBarIos();
    } else {
      applyCleanStatusBarAndroid();
    }
  });

  afterAll(async () => {
    if (device.getPlatform() === 'ios') {
      clearCleanStatusBarIos();
    } else {
      clearCleanStatusBarAndroid();
    }
  });

  it('captures every sweep surface top and bottom', async () => {
    // One misbehaving surface (e.g. a screen that stalls the JS thread and
    // never mounts) must not abort the rest of the sweep: capture what we
    // can, then fail at the end with the aggregated per-surface errors.
    const failures = [];

    for (const surface of surfaces) {
      if (surface.iosOnly && device.getPlatform() === 'android') {
        continue;
      }
      try {
        const opened = await openSurface(surface);
        if (!opened) {
          continue;
        }

        await settle();

        // LT-16: an untagged condition surface lands on the insights hub by
        // design — capture that single redirect frame under an explicit name
        // so it can never masquerade as a condition-screen capture.
        if (opened === 'redirected') {
          captureScreen(`${surface.name}-redirected-to-insights`);
          continue;
        }

        captureScreen(surface.name);

        if (surface.extraScrollStops) {
          await scrollDownBestEffort(surface.waitId, 1200);
          await settle(800);
          captureScreen(`${surface.name}-mid`);
        }

        await scrollToBottomBestEffort(surface.waitId);
        await settle(800);
        captureScreen(`${surface.name}-b`);
      } catch (error) {
        failures.push(`${surface.name}: ${error.message ?? error}`);
      }
    }

    if (failures.length) {
      throw new Error(`Sweep surfaces failed:\n${failures.join('\n')}`);
    }
  });

  (shouldRecordVideo ? it : it.skip)(
    'records timeline and calendar history scroll videos',
    async () => {
      const isAndroid = device.getPlatform() === 'android';

      for (const surface of VIDEO_SURFACES) {
        await openRoute(surface.route);
        await waitFor(element(by.id(surface.waitId))).toBeVisible().withTimeout(20000);
        await scrollToTopBestEffort(surface.waitId);
        await settle();

        // Suffix Android files so they never clobber the iOS recordings that
        // share this directory.
        const videoPath = path.join(
          videoDir,
          `${variant}-${surface.name}${isAndroid ? '-android' : ''}.mp4`,
        );
        const devicePath = `/sdcard/floriva-sweep-${surface.name}.mp4`;
        const recording = isAndroid
          ? spawn(adbBinary, ['shell', 'screenrecord', '--time-limit', '180', devicePath], {
              stdio: 'ignore',
            })
          : spawn(
              'xcrun',
              ['simctl', 'io', device.id, 'recordVideo', '--codec', 'h264', '--force', videoPath],
              { stdio: 'ignore' },
            );
        await settle(1500);

        for (let i = 0; i < 8; i += 1) {
          await scrollDownBestEffort(surface.waitId, 500);
          await settle(500);
        }
        await scrollToBottomBestEffort(surface.waitId);
        await settle(1500);

        if (isAndroid) {
          await stopAndroidScreenRecording(recording, devicePath, videoPath);
        } else {
          await stopVideoRecording(recording);
        }
      }
    },
  );
});
