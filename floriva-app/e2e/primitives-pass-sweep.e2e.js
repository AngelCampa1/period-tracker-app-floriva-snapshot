/* global waitFor, system */

// Primitives-pass visual spot-check sweep (Phase 3 serialized PRIMITIVES task
// of the 2026-07-22 UI lift).
//
// Captures the four ripple-containment proofs on the running platform:
//   1. italic-title-scrolled  — /settings/language scrolled (UL-51: sticky bar
//                               absent before the fix, present after).
//   2. string-title-scrolled  — /today scrolled with the sticky bar revealed
//                               (must be IDENTICAL before and after).
//   3. back-pill              — /settings/language at rest (UL-29/UL-82
//                               treatment of the "Back to settings" control).
//   4. disabled-primary       — /backup/export with the empty-passphrase
//                               disabled "Create backup file" CTA (UL-37).
//
// Run from a checkout that has debug binaries (Metro must already serve the
// primitives worktree with the seeded-tracker preset):
//   FLORIVA_PRIMITIVES_SWEEP=1 FLORIVA_PRIMITIVES_PHASE=before \
//     FLORIVA_PRIMITIVES_OUT_ROOT=<abs path to primitives-pass evidence dir> \
//     npx detox test -c ios.sim.debug e2e/primitives-pass-sweep.e2e.js --reuse
//
// Gated behind FLORIVA_PRIMITIVES_SWEEP=1 so it never runs in the normal suite.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const adbBinary = process.env.ADB_BINARY ?? 'adb';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const shouldRun = process.env.FLORIVA_PRIMITIVES_SWEEP === '1';
const describeSweep = shouldRun ? describe : describe.skip;

const phase = process.env.FLORIVA_PRIMITIVES_PHASE ?? 'before';

const repoRoot = path.resolve(__dirname, '..');
const outRoot = process.env.FLORIVA_PRIMITIVES_OUT_ROOT
  ? path.resolve(process.env.FLORIVA_PRIMITIVES_OUT_ROOT)
  : path.join(repoRoot, 'docs', 'qa', '2026-07-22-ui-lift', 'primitives-pass');

const LANGUAGE_SCREEN_ID = 'settings-language-screen';
const REMINDERS_SCREEN_ID = 'settings-reminders-screen';
const TODAY_SCREEN_ID = 'today-screen';
const BACKUP_SCREEN_ID = 'backup-screen';

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

async function scrollToTopBestEffort(scrollId) {
  try {
    await element(by.id(scrollId)).scrollTo('top');
  } catch {
    // Already at top / not scrollable; ignore.
  }
}

async function scrollDownBestEffort(scrollId, dy) {
  try {
    await element(by.id(scrollId)).scroll(dy, 'down');
  } catch {
    // Container shorter than the requested scroll; ignore.
  }
}

describeSweep('Primitives pass spot-check sweep', () => {
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

    // Let the JS bundle finish loading (the seeded preset lands on Today)
    // before deep-linking — a link fired mid-load gets dropped.
    try {
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(180000);
    } catch {
      await settle(4000);
    }

    applyCleanStatusBar();
    await settle(500);
  });

  afterAll(async () => {
    clearCleanStatusBar();
  });

  it('captures the back pill at rest (settings/language)', async () => {
    await openRoute('settings/language');
    await waitFor(element(by.id(LANGUAGE_SCREEN_ID))).toBeVisible().withTimeout(60000);
    // No scroll gesture here: the screen opens at the top, and a touch-down on
    // the (short, non-scrollable) screen can leave a transient press highlight
    // on the back control in the frame.
    await settle(1700);
    captureScreen('back-pill');
  });

  it('captures ItalicTitle scrolled state (settings/reminders)', async () => {
    // settings/language fits on one screen post-Wave-A, so the naked-scroll-
    // edge proof uses the long reminders screen (also ItalicTitle-titled).
    await openRoute('settings/reminders');
    await waitFor(element(by.id(REMINDERS_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1200);

    await scrollToTopBestEffort(`${REMINDERS_SCREEN_ID}-scroll`);
    await settle(500);
    await scrollDownBestEffort(`${REMINDERS_SCREEN_ID}-scroll`, 400);
    await settle(600);
    captureScreen('italic-title-scrolled');
  });

  it('captures string-title scrolled state (today)', async () => {
    // The privacy explainer is too short to collapse its editorial header, so
    // the string-title sticky-bar proof uses the long seeded Today screen
    // (title="Floriva") — it must look IDENTICAL before and after the
    // primitives change.
    await openRoute('today');
    await waitFor(element(by.id(TODAY_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1200);

    await element(by.id(`${TODAY_SCREEN_ID}-scroll`)).scrollTo('top');
    await settle(500);
    await element(by.id(`${TODAY_SCREEN_ID}-scroll`)).scroll(400, 'down', NaN, 0.7);
    await settle(600);
    captureScreen('string-title-scrolled');
  });

  it('captures disabled primary CTA (backup export)', async () => {
    await openRoute('backup/export');
    await waitFor(element(by.id(BACKUP_SCREEN_ID))).toBeVisible().withTimeout(60000);
    await settle(1200);

    await scrollToTopBestEffort(`${BACKUP_SCREEN_ID}-scroll`);
    await settle(500);
    await scrollDownBestEffort(`${BACKUP_SCREEN_ID}-scroll`, 250);
    await settle(600);
    captureScreen('disabled-primary');
  });
});
