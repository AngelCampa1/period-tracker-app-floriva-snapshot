/* global waitFor, system */

// Calendar-redesign gallery sweep (Phase 2b of the 2026-07 UI lift).
//
// Drives the dev-only /dev-calendar-gallery route through the full
// variant x fixture-state matrix (Classic + Quiet Bands, 4 states each),
// applies a clean status bar, and captures one consistently framed PNG per
// combo. Originally used for the three-direction contact sheet the user
// picked Quiet Bands from (archived in docs/qa/2026-07-22-calendar-redesign/).
//
// Run (Metro must already be serving the calendar worktree with any seeded
// preset; the gallery renders deterministic fixtures, not app data):
//   FLORIVA_GALLERY_SWEEP=1 npx detox test -c ios.sim.debug \
//     e2e/calendar-gallery-sweep.e2e.js --reuse
//
// Gated behind FLORIVA_GALLERY_SWEEP=1 so it never runs in the normal suite.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const adbBinary = process.env.ADB_BINARY ?? 'adb';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const shouldRun = process.env.FLORIVA_GALLERY_SWEEP === '1';
const describeSweep = shouldRun ? describe : describe.skip;

const repoRoot = path.resolve(__dirname, '..');
const outRoot = process.env.FLORIVA_GALLERY_OUT_ROOT
  ? path.resolve(process.env.FLORIVA_GALLERY_OUT_ROOT)
  : path.join(repoRoot, 'docs', 'qa', '2026-07-22-calendar-redesign', 'gallery');

const VARIANTS = ['classic', 'quiet-bands'];
const STATES = ['standard', 'overlap', 'todayInBand', 'stale'];
const STATE_FILE_NAMES = {
  standard: 'standard',
  overlap: 'overlap',
  todayInBand: 'today-in-band',
  stale: 'stale',
};

const SCREEN_ID = 'dev-calendar-gallery-screen';
const SCROLL_ID = `${SCREEN_ID}-scroll`;
const GRID_ID = 'dev-calendar-gallery-grid';

// Fixed offset that pushes the chip groups off the top so the grid card fills
// the frame identically for every combo (framing consistency > completeness;
// a -b capture picks up the legend/description below the grid).
const CARD_SCROLL_DY = 330;

function settle(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function outDir() {
  return path.join(outRoot, device.getPlatform() === 'android' ? 'android' : 'ios');
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

async function openGalleryRoute(query = '') {
  const url = `floriva:///dev-calendar-gallery?disableOnboarding=1${query}`;
  if (device.getPlatform() === 'android') {
    // adb shell re-parses the joined args on the device shell, so the `&`
    // between query params must be quoted or it backgrounds the command.
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

function captureScreen(fileBaseName) {
  const target = path.join(outDir(), `${fileBaseName}.png`);
  if (device.getPlatform() === 'android') {
    const png = execFileSync(adbBinary, ['exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(target, png);
    return;
  }
  execFileSync('xcrun', ['simctl', 'io', device.id, 'screenshot', target]);
}

async function scrollToTopBestEffort() {
  try {
    await element(by.id(SCROLL_ID)).scrollTo('top');
  } catch {
    // Already at top / not scrollable; ignore.
  }
}

async function scrollDownBestEffort(dy) {
  try {
    await element(by.id(SCROLL_ID)).scroll(dy, 'down');
  } catch {
    // Container shorter than the requested scroll; ignore.
  }
}

async function scrollToBottomBestEffort() {
  try {
    await element(by.id(SCROLL_ID)).scrollTo('bottom');
    return true;
  } catch {
    return false;
  }
}

describeSweep('Calendar gallery sweep', () => {
  // Android needs ~100s per combo (8 combos); iOS ~7s. 45 min headroom.
  jest.setTimeout(2700000);

  beforeAll(async () => {
    mkdirSync(outDir(), { recursive: true });

    // Mirror e2e/ui-lift-sweep.e2e.js exactly: fresh install + explicit
    // dev-client URL handoff (Metro must run with --dev-client). The gallery
    // renders fixtures, not app data, so the wipe costs nothing.
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

    await openGalleryRoute();
    await waitFor(element(by.id(SCREEN_ID))).toBeVisible().withTimeout(60000);

    applyCleanStatusBar();
    await settle(500);
  });

  afterAll(async () => {
    clearCleanStatusBar();
  });

  it('captures every direction x state combo', async () => {
    for (const variant of VARIANTS) {
      for (const state of STATES) {
        // Combos are driven by deep-link params (no chip taps): re-opening
        // the route updates the already-mounted screen's params.
        await openGalleryRoute(`&variant=${variant}&state=${state}`);
        await settle(700);

        await waitFor(element(by.id(GRID_ID))).toExist().withTimeout(10000);
        await scrollToTopBestEffort();
        await settle(500);
        await scrollDownBestEffort(CARD_SCROLL_DY);
        await settle(500);

        const baseName = `${variant}--${STATE_FILE_NAMES[state]}`;
        captureScreen(baseName);

        const scrolled = await scrollToBottomBestEffort();
        if (scrolled) {
          await settle(400);
          captureScreen(`${baseName}-b`);
        }
      }
    }
  });
});
