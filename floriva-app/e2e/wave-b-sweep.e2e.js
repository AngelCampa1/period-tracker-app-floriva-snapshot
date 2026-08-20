/* global waitFor, system */

// Wave B scrolled-state capture sweep (Phase 3 Wave B of the 2026-07-22 UI
// lift: Today + logging + calendar sub-routes).
//
// Captures the scrolled-state evidence frames that static deep-link
// screenshots cannot reach, on the running platform:
//   1. today-bottom    — /today scrolled to the bottom (UL-04: tab-bar
//                        content bleed / clipped actions near the floating
//                        glass pill).
//   2. timeline-rows   — /calendar/timeline scrolled into the daily-log rows
//                        (UL-28: per-row privacy-reassurance repetition).
//   3. day-log-bottom  — /calendar/day/<today> scrolled to the bottom
//                        (UL-64: symptom chip grid + Save region, UL-73:
//                        Android chip label alignment).
//
// Run from a checkout that has debug binaries (Metro must already serve the
// wave-b worktree with the qa-rich-history preset):
//   FLORIVA_WAVE_B_SWEEP=1 FLORIVA_WAVE_B_PHASE=before \
//     FLORIVA_WAVE_B_OUT_ROOT=<abs path to wave-b evidence dir> \
//     npx detox test -c ios.sim.debug e2e/wave-b-sweep.e2e.js --reuse
//
// Gated behind FLORIVA_WAVE_B_SWEEP=1 so it never runs in the normal suite.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const adbBinary = process.env.ADB_BINARY ?? 'adb';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const shouldRun = process.env.FLORIVA_WAVE_B_SWEEP === '1';
const describeSweep = shouldRun ? describe : describe.skip;

const phase = process.env.FLORIVA_WAVE_B_PHASE ?? 'before';

const repoRoot = path.resolve(__dirname, '..');
const outRoot = process.env.FLORIVA_WAVE_B_OUT_ROOT
  ? path.resolve(process.env.FLORIVA_WAVE_B_OUT_ROOT)
  : path.join(repoRoot, 'docs', 'qa', '2026-07-22-ui-lift', 'wave-b');

const TODAY_SCREEN_ID = 'today-screen';
const TIMELINE_SCREEN_ID = 'calendar-timeline-screen';
const DAY_SCREEN_ID = 'calendar-day-screen';

function localTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function settle(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function platformName() {
  return device.getPlatform() === 'android' ? 'android' : 'ios';
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
  const url = `floriva:///${routePath}?disableOnboarding=1`;
  if (device.getPlatform() === 'android') {
    // adb shell re-parses the joined args on the device shell, so the URL must
    // be quoted or `&` would background the command.
    execFileSync(adbBinary, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      `'${url}'`,
      'app.floriva',
    ]);
    return;
  }
  await device.openURL({ url });
  await acceptOpenInAppAlertIfNeeded();
}

function applyCleanStatusBar() {
  if (device.getPlatform() === 'ios') {
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
    return;
  }
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

function clearCleanStatusBar() {
  try {
    if (device.getPlatform() === 'ios') {
      execFileSync('xcrun', ['simctl', 'status_bar', device.id, 'clear']);
    } else {
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
    }
  } catch {
    // Best-effort restore.
  }
}

function captureScreen(name) {
  const target = path.join(outRoot, `${phase}-${name}-${platformName()}.png`);
  if (device.getPlatform() === 'android') {
    const png = execFileSync(adbBinary, ['exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(target, png);
    return;
  }
  execFileSync('xcrun', ['simctl', 'io', device.id, 'screenshot', target]);
}

async function scrollToBottomBestEffort(scrollId) {
  try {
    await element(by.id(scrollId)).scrollTo('bottom');
  } catch {
    // Not scrollable; ignore.
  }
}

async function scrollDownBestEffort(scrollId, dy) {
  try {
    await element(by.id(scrollId)).scroll(dy, 'down', NaN, 0.7);
  } catch {
    // Container shorter than the requested scroll; ignore.
  }
}

describeSweep('Wave B scrolled-state sweep', () => {
  jest.setTimeout(1200000);

  beforeAll(async () => {
    mkdirSync(outRoot, { recursive: true });

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

    // Let the JS bundle finish loading (the preset lands on Today) before
    // deep-linking — a link fired mid-load gets dropped.
    try {
      await waitFor(element(by.id(TODAY_SCREEN_ID))).toBeVisible().withTimeout(180000);
    } catch {
      await settle(4000);
    }

    applyCleanStatusBar();
    await settle(500);
  });

  afterAll(async () => {
    clearCleanStatusBar();
  });

  it('captures Today scrolled to the bottom (UL-04)', async () => {
    await openRoute('today');
    await waitFor(element(by.id(TODAY_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1200);

    // A bare scrollTo('bottom') can silently no-op on this screen (observed
    // during the before-phase run), so nudge with gesture scrolls first.
    await scrollDownBestEffort(`${TODAY_SCREEN_ID}-scroll`, 800);
    await settle(400);
    await scrollDownBestEffort(`${TODAY_SCREEN_ID}-scroll`, 800);
    await settle(400);
    await scrollToBottomBestEffort(`${TODAY_SCREEN_ID}-scroll`);
    await settle(800);
    captureScreen('today-bottom');
  });

  it('captures timeline daily-log rows (UL-28)', async () => {
    await openRoute('calendar/timeline');
    await waitFor(element(by.id(TIMELINE_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1500);

    await scrollDownBestEffort(`${TIMELINE_SCREEN_ID}-scroll`, 1100);
    await settle(800);
    captureScreen('timeline-rows');
  });

  it('captures day-log scrolled to the bottom (UL-64 / UL-73)', async () => {
    await openRoute(`calendar/day/${localTodayIso()}`);
    await waitFor(element(by.id(DAY_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1500);

    await scrollDownBestEffort(`${DAY_SCREEN_ID}-scroll`, 900);
    await settle(700);
    captureScreen('day-log-mid');

    await scrollToBottomBestEffort(`${DAY_SCREEN_ID}-scroll`);
    await settle(700);
    captureScreen('day-log-bottom');
  });
});
