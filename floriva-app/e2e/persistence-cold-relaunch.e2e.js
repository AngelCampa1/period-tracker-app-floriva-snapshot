/* global waitFor */

const { execFileSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Cold-relaunch persistence coverage (SQLite + SecureStore).
//
// Unit tests mock `expo-sqlite` and `expo-secure-store`, so they can never
// prove that data written on one process actually survives a full app kill and
// cold relaunch. This suite does exactly that against the real native stores:
//
//   1. Drive a minimal real onboarding so SQLite holds a completed profile.
//   2. Write a uniquely-identifiable daily-log note through the UI.
//   3. Relaunch with `delete: false` (process death, container preserved).
//   4. Assert onboarding does NOT reappear and the note is still readable.
//
// This must run WITHOUT a dev-launch preset: the preset machinery wipes and
// re-seeds local data on every boot (`resetDevLaunchArtifacts` ->
// `wipeLocalData`), which would mask a real persistence regression. It is gated
// to the default / fresh-install run, matching the smoke suite.
//
//   pnpm detox:test:ios -- persistence-cold-relaunch
//   pnpm detox:test:android -- persistence-cold-relaunch

const describePersistence =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET == null ||
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'fresh-install'
    ? describe
    : describe.skip;

// A note string unique to this run so a stale container can't produce a false
// pass. Derived from the spec name + a fixed marker (Date.now is unavailable in
// some Detox setups and would also defeat reproducibility).
const PERSISTED_NOTE = 'floriva-persist-probe-cold-relaunch';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const androidDevServerHost = process.env.EXPO_ANDROID_DEV_SERVER_HOST ?? '10.0.2.2';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const androidDevServerUrl = `http://${androidDevServerHost}:${devServerPort}`;

// The Expo dev-client holds a persistent Metro connection that keeps the app's
// run loop "busy", making Detox's internal `waitForActive` hang on launch.
// Blacklisting the dev-server endpoints lets Detox treat the app as idle; the
// blacklist persists across relaunches once set, so one call covers the suite.
async function blacklistDevServer() {
  if (device.getPlatform() === 'android') {
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

async function dismissDeveloperMenuIntroIfNeeded() {
  if (device.getPlatform() === 'android') {
    await delay(1000);
    const didContinue = androidUiTreeIncludesText('This is the developer menu.')
      ? await tapAndroidTextIfVisible('Continue')
      : false;

    if (didContinue) {
      await delay(1000);
    }

    if (androidUiTreeIncludesText('Connected to:')) {
      const closeCenter = findAndroidContentDescriptionCenter('Close');

      if (closeCenter) {
        tapAndroidPoint(closeCenter.x, closeCenter.y);
      }
      await delay(1000);
    }

    return;
  }

  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

// Load the JS bundle into the dev-client. A bare `launchApp` only shows the Expo
// dev launcher; opening the dev-client URL connects to Metro and renders the app.
async function connectDevelopmentClient() {
  if (device.getPlatform() === 'android') {
    return;
  }

  await device.openURL({ url: devClientUrl });
  await dismissDeveloperMenuIntroIfNeeded();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function firstElementById(testID) {
  return element(by.id(testID)).atIndex(0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAndroidDeviceSerial() {
  return process.env.ANDROID_SERIAL ?? device?.id ?? device?._deviceId;
}

function runAdb(args) {
  const serial = getAndroidDeviceSerial();
  const resolvedArgs = serial ? ['-s', serial, ...args] : args;

  return execFileSync(process.env.ADB_BINARY ?? 'adb', resolvedArgs);
}

function getAndroidViewportBounds() {
  const sizeOutput = runAdb(['shell', 'wm', 'size']).toString();
  const match = sizeOutput.match(/Physical size:\s*(\d+)x(\d+)/);

  if (!match) {
    return { width: 1080, height: 2424 };
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function resolveVisibleAndroidCenter({ left, top, right, bottom }) {
  const viewport = getAndroidViewportBounds();

  if (right <= 0 || bottom <= 0 || left >= viewport.width || top >= viewport.height) {
    return null;
  }

  return {
    x: Math.round((Math.max(left, 0) + Math.min(right, viewport.width)) / 2),
    y: Math.round((Math.max(top, 0) + Math.min(bottom, viewport.height)) / 2),
  };
}

function findAndroidElementCenter(testID) {
  const uiTree = runAdb(['exec-out', 'uiautomator', 'dump', '/dev/tty']).toString();
  const nodePattern = new RegExp(
    `resource-id="${escapeRegExp(testID)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'g',
  );

  for (const match of uiTree.matchAll(nodePattern)) {
    const [, left, top, right, bottom] = match.map(Number);
    const center = resolveVisibleAndroidCenter({ left, top, right, bottom });

    if (center) {
      return center;
    }
  }

  return null;
}

function findAndroidTextCenter(text) {
  const uiTree = runAdb(['exec-out', 'uiautomator', 'dump', '/dev/tty']).toString();
  const nodePattern = new RegExp(
    `text="${escapeRegExp(text)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'g',
  );

  for (const match of uiTree.matchAll(nodePattern)) {
    const [, left, top, right, bottom] = match.map(Number);
    const center = resolveVisibleAndroidCenter({ left, top, right, bottom });

    if (center) {
      return center;
    }
  }

  return null;
}

function findAndroidContentDescriptionCenter(description) {
  const uiTree = runAdb(['exec-out', 'uiautomator', 'dump', '/dev/tty']).toString();
  const nodePattern = new RegExp(
    `content-desc="${escapeRegExp(description)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'g',
  );

  for (const match of uiTree.matchAll(nodePattern)) {
    const [, left, top, right, bottom] = match.map(Number);
    const center = resolveVisibleAndroidCenter({ left, top, right, bottom });

    if (center) {
      return center;
    }
  }

  return null;
}

function androidUiTreeIncludesText(text) {
  return findAndroidTextCenter(text) !== null;
}

function tapAndroidPoint(x, y) {
  runAdb(['shell', 'input', 'tap', String(x), String(y)]);
}

async function tapAndroidTextIfVisible(text) {
  const center = findAndroidTextCenter(text);

  if (!center) {
    return false;
  }

  tapAndroidPoint(center.x, center.y);
  await delay(500);
  return true;
}

function swipeAndroidUp() {
  runAdb(['shell', 'input', 'swipe', '540', '2200', '540', '1350', '500']);
}

function openAndroidUrl(url) {
  const shellSafeUrl = `'${url.replace(/'/g, "'\\''")}'`;

  runAdb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    shellSafeUrl,
    'app.floriva',
  ]);
}

function clearAndroidAppData() {
  for (const legacyPackageName of ['com.anonymous.floriva', 'com.anonymous.floriva.test']) {
    try {
      runAdb(['shell', 'pm', 'uninstall', legacyPackageName]);
    } catch {
      // Ignore absent legacy dev-client packages.
    }
  }

  runAdb(['shell', 'pm', 'clear', 'app.floriva']);
}

async function launchAndroidAppIntoDevClient({ deleteApp }) {
  await device.launchApp({
    newInstance: true,
    delete: deleteApp,
    launchArgs: { detoxFlorivaDevServerUrl: androidDevServerUrl },
  });
  runAdb(['shell', 'am', 'start', '-n', 'app.floriva/.MainActivity']);
  await delay(3000);

  if (androidUiTreeIncludesText(androidDevServerUrl)) {
    const didTapServerText = await tapAndroidTextIfVisible(androidDevServerUrl);
    if (!didTapServerText || androidUiTreeIncludesText(androidDevServerUrl)) {
      tapAndroidPoint(540, 690);
    }
    await delay(5000);
  }

  await dismissDeveloperMenuIntroIfNeeded();
}

async function waitForAndroidElementById(testID, timeoutMs = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (findAndroidElementCenter(testID)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found.`);
}

async function tapAndroidElementById(testID, timeoutMs = 10000) {
  const startTime = Date.now();
  let center = null;

  while (Date.now() - startTime < timeoutMs) {
    center = findAndroidElementCenter(testID);

    if (center) {
      tapAndroidPoint(center.x, center.y);
      await delay(500);
      return;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found.`);
}

async function tapAndroidElementByIdWithScroll(testID, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      tapAndroidPoint(center.x, center.y);
      await delay(500);
      return;
    }

    swipeAndroidUp();
    await delay(600);
  }

  throw new Error(`Android element ${testID} was not found after scrolling.`);
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function queryAndroidDailyLogCount(logDate) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-detox-db-'));
  const dbPath = path.join(tempDir, 'floriva.db');

  try {
    const databaseBytes = runAdb([
      'exec-out',
      'run-as',
      'app.floriva',
      'cat',
      'files/SQLite/floriva.db',
    ]);

    if (
      databaseBytes.length === 0 ||
      !databaseBytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))
    ) {
      throw new Error('Android Floriva SQLite database was not readable at files/SQLite/floriva.db.');
    }

    fs.writeFileSync(dbPath, databaseBytes);

    const output = execFileSync(process.env.SQLITE3_BINARY ?? 'sqlite3', [
      dbPath,
      `SELECT COUNT(*) FROM daily_logs WHERE log_date = ${quoteSqlString(logDate)};`,
    ]).toString();

    return Number(output.trim() || '0');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function expectAndroidDailyLogCount(logDate, expectedCount, timeoutMs = 10000) {
  const startTime = Date.now();
  let lastCount = -1;

  while (Date.now() - startTime < timeoutMs) {
    lastCount = queryAndroidDailyLogCount(logDate);

    if (lastCount === expectedCount) {
      return;
    }

    await delay(500);
  }

  throw new Error(
    `Expected ${expectedCount} Android daily log rows for ${logDate}, found ${lastCount}.`,
  );
}

async function firstById(testID) {
  return firstElementById(testID);
}

// Tap the visible instance of a testID, falling back to the first match. Some
// native stacks expose duplicate nodes under `disableSynchronization()`.
async function tapVisibleElementById(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(5000);
    await element(by.id(testID)).tap();
  } catch {
    await waitFor(firstElementById(testID)).toBeVisible().withTimeout(5000);
    await firstElementById(testID).tap();
  }
}

// Retry a navigation action across brief disabled windows that occur with
// synchronization off, trying a duplicate action node before giving up.
async function tapDuplicatedActionUntilVisible(actionTestID, nextScreenTestID) {
  if (device.getPlatform() === 'android') {
    await tapAndroidElementById(actionTestID);
    if (nextScreenTestID) {
      await waitForAndroidElementById(nextScreenTestID, 30000);
    } else {
      await delay(1200);
    }
    return;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await tapVisibleElementById(actionTestID);
      if (!nextScreenTestID) {
        await delay(1200);
        return;
      }
      await waitFor(element(by.id(nextScreenTestID))).toBeVisible().withTimeout(3000);
      return;
    } catch {
      try {
        await element(by.id(actionTestID)).atIndex(1).tap();
        if (!nextScreenTestID) {
          await delay(1200);
          return;
        }
        await waitFor(element(by.id(nextScreenTestID))).toBeVisible().withTimeout(3000);
        return;
      } catch {
        // Some native stacks expose only one action node.
      }
    }
  }
  throw new Error(`${actionTestID} could not be tapped after 4 attempts`);
}

async function chooseOnboardingDecisionAndContinue({
  screenTestID,
  optionTestID,
  continueTestID,
  nextScreenTestID,
}) {
  if (device.getPlatform() === 'android') {
    await waitForAndroidElementById(screenTestID, 10000);
    await tapAndroidElementById(optionTestID);
    await delay(500);
    await tapAndroidElementById(continueTestID);
    await waitForAndroidElementById(nextScreenTestID, 30000);
    return;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitFor(element(by.id(screenTestID))).toBeVisible().withTimeout(10000);
    await tapVisibleElementById(optionTestID);
    await delay(500);
    await waitFor(element(by.id(continueTestID))).toBeVisible().withTimeout(10000);

    try {
      await tapVisibleElementById(continueTestID);
      await waitFor(element(by.id(nextScreenTestID))).toBeVisible().withTimeout(3000);
      return;
    } catch {
      try {
        await element(by.id(continueTestID)).atIndex(1).tap();
        await waitFor(element(by.id(nextScreenTestID))).toBeVisible().withTimeout(3000);
        return;
      } catch {
        // Retry from the option tap so a missed selection does not leave us
        // repeatedly tapping a disabled Continue button.
      }
    }
  }

  throw new Error(`${optionTestID} could not advance to ${nextScreenTestID}.`);
}

// Minimal fresh setup: fresh path -> last period today -> steady cycle ->
// default lengths -> no symptom logging -> not TTC -> skip notifications ->
// annual plan -> completion -> today. Mirrors the iOS smoke flow exactly.
async function completeMinimalOnboarding() {
  if (device.getPlatform() === 'android') {
    await tapAndroidElementById('onboarding-welcome-start-button');
    await delay(1000);
    await tapAndroidElementById('onboarding-start-path-fresh-option');
    await delay(500);
    await tapAndroidElementById('onboarding-start-path-continue-button');
    await delay(1000);
    await tapAndroidElementById('onboarding-last-period-start-today');
    await delay(500);
    swipeAndroidUp();
    await delay(500);
    await tapAndroidElementById('onboarding-last-period-start-continue-button');
    await delay(1500);
    swipeAndroidUp();
    await delay(500);
    await tapAndroidElementById('onboarding-cycle-variability-steady-option');
    await delay(500);
    await tapAndroidElementById('onboarding-cycle-length-continue-button');
    await delay(1500);
    await tapAndroidElementById('onboarding-period-length-continue-button');
    await delay(1500);
    await tapAndroidElementById('onboarding-symptom-logging-no-option');
    await delay(500);
    await tapAndroidElementById('onboarding-symptom-logging-continue-button');
    await delay(1500);
    await tapAndroidElementById('onboarding-ttc-no-option');
    await delay(500);
    await tapAndroidElementById('onboarding-ttc-continue-button');
    await tapAndroidElementById('onboarding-notifications-skip-button', 20000);
    await tapAndroidElementById('onboarding-paywall-screen', 20000);
    await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-annual-button');
    await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-selected-button');
    await tapAndroidElementById('onboarding-completion-continue-button', 20000);
    await waitForAndroidElementById('today-screen', 30000);
    return;
  }

  await tapVisibleElementById('onboarding-welcome-start-button');
  await waitFor(element(by.id('onboarding-start-path-screen')))
    .toBeVisible()
    .withTimeout(10000);
  await tapVisibleElementById('onboarding-start-path-fresh-option');
  try {
    await waitFor(element(by.text('Selected'))).toBeVisible().withTimeout(8000);
  } catch {
    // The selection chrome may render without a literal "Selected" label.
  }
  await tapDuplicatedActionUntilVisible(
    'onboarding-start-path-continue-button',
    'onboarding-last-period-start-today',
  );
  await tapVisibleElementById('onboarding-last-period-start-today');
  await waitFor(element(by.id('onboarding-last-period-start-continue-button')))
    .toBeVisible()
    .whileElement(by.id('onboarding-last-period-start-screen-scroll'))
    .scroll(240, 'down');
  await tapDuplicatedActionUntilVisible(
    'onboarding-last-period-start-continue-button',
    'onboarding-cycle-length-input',
  );
  await waitFor(element(by.id('onboarding-cycle-variability-steady-option')))
    .toBeVisible()
    .whileElement(by.id('onboarding-cycle-length-screen-scroll'))
    .scroll(320, 'down');
  await tapVisibleElementById('onboarding-cycle-variability-steady-option');
  await tapDuplicatedActionUntilVisible(
    'onboarding-cycle-length-continue-button',
    'onboarding-period-length-input',
  );
  await tapDuplicatedActionUntilVisible(
    'onboarding-period-length-continue-button',
    'onboarding-symptom-logging-no-option',
  );
  await chooseOnboardingDecisionAndContinue({
    screenTestID: 'onboarding-symptom-logging-screen',
    optionTestID: 'onboarding-symptom-logging-no-option',
    continueTestID: 'onboarding-symptom-logging-continue-button',
    nextScreenTestID: 'onboarding-ttc-no-option',
  });
  await chooseOnboardingDecisionAndContinue({
    screenTestID: 'onboarding-ttc-screen',
    optionTestID: 'onboarding-ttc-no-option',
    continueTestID: 'onboarding-ttc-continue-button',
    nextScreenTestID: 'onboarding-notifications-skip-button',
  });
  await tapDuplicatedActionUntilVisible(
    'onboarding-notifications-skip-button',
    'onboarding-paywall-screen',
  );
  await waitFor(element(by.id('onboarding-paywall-purchase-annual-button')))
    .toBeVisible()
    .whileElement(by.id('onboarding-paywall-screen-scroll'))
    .scroll(240, 'down');
  await tapVisibleElementById('onboarding-paywall-purchase-annual-button');
  // The commit CTA sits below the plan cards, off-screen after the cards scroll
  // into view. Bring it up before tapping or the tap target is never visible.
  await waitFor(element(by.id('onboarding-paywall-purchase-selected-button')))
    .toBeVisible()
    .whileElement(by.id('onboarding-paywall-screen-scroll'))
    .scroll(240, 'down');
  await tapDuplicatedActionUntilVisible(
    'onboarding-paywall-purchase-selected-button',
    'onboarding-completion-continue-button',
  );
  await tapDuplicatedActionUntilVisible('onboarding-completion-continue-button', 'today-screen');
  await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
}

// A fixed log date so write and read target the same DailyLogEntry. Any valid
// date works -- persistence is what we're proving, not date arithmetic -- and a
// constant keeps the spec reproducible (Date.now is unavailable under Detox).
const LOG_DATE = '2026-06-10';

// Deep-link straight to the day-logging screen. The notes field does not live
// inline on Today; tapping through the Today card is unreliable because the
// "Log today" button clips behind the tab bar. The `/calendar/day/<date>` route
// renders the same logging form directly.
async function openTodayLoggingScreen() {
  if (device.getPlatform() === 'android') {
    openAndroidUrl(`floriva://calendar/day/${LOG_DATE}?disableOnboarding=1`);
    await waitForAndroidElementById('calendar-day-screen', 15000);
    return;
  }

  await device.openURL({ url: `floriva://calendar/day/${LOG_DATE}?disableOnboarding=1` });
  await waitFor(element(by.id('calendar-day-screen'))).toBeVisible().withTimeout(15000);
  // The notes field sits near the bottom of the logging form.
  await element(by.id('calendar-day-screen-scroll')).swipe('up', 'fast', 0.85);
  await element(by.id('calendar-day-screen-scroll')).swipe('up', 'slow', 0.35);
  await waitFor(element(by.id('today-notes-input'))).toBeVisible().withTimeout(10000);
}

// Write a note for today and save it. This commits a DailyLogEntry to SQLite.
async function writePersistedNote() {
  if (device.getPlatform() === 'android') {
    await openTodayLoggingScreen();
    await tapAndroidElementById('today-logging-chip-bleeding-light');
    await delay(500);
    await tapAndroidElementByIdWithScroll('today-save-button');
    await waitForAndroidElementById('today-feedback-message', 10000);
    await expectAndroidDailyLogCount(LOG_DATE, 1);
    return;
  }

  await openTodayLoggingScreen();
  await element(by.id('today-notes-input')).tap();
  await element(by.id('today-notes-input')).typeText(PERSISTED_NOTE);
  // The notes field is multiline, so the return key inserts a newline rather
  // than dismissing the keyboard, which keeps the save button occluded. A swipe
  // gesture needs the ScrollView fully visible (blocked by the keyboard), so
  // scroll programmatically to the bottom instead. keyboardShouldPersistTaps=
  // "always" keeps the subsequent save tap landing despite the open keyboard.
  await element(by.id('calendar-day-screen-scroll')).scrollTo('bottom');
  await waitFor(element(by.id('today-save-button'))).toBeVisible().withTimeout(10000);
  await tapVisibleElementById('today-save-button');
  await waitFor(element(by.id('today-feedback-message'))).toBeVisible().withTimeout(10000);
}

describePersistence('Floriva cold-relaunch persistence', () => {
  beforeAll(async () => {
    if (device.getPlatform() === 'android') {
      clearAndroidAppData();
      await launchAndroidAppIntoDevClient({ deleteApp: true });
    } else {
      // Start from a genuinely empty container so onboarding runs for real.
      await device.launchApp({ newInstance: true, delete: true });
      await connectDevelopmentClient();
    }

    await device.disableSynchronization();
    await blacklistDevServer();

    if (device.getPlatform() === 'android') {
      // Triple slash: floriva://welcome parses `welcome` as the URL host (empty
      // path) and never routes via `adb am start`; floriva:///welcome routes to
      // the /welcome onboarding screen.
      openAndroidUrl('floriva:///welcome');
      await delay(1500);
    } else {
      await device.openURL({ url: 'floriva://welcome' });
    }

    await dismissDeveloperMenuIntroIfNeeded();
    // The dev-client may land on the start-path screen; step back to welcome.
    if (device.getPlatform() === 'android') {
      try {
        await waitForAndroidElementById('onboarding-welcome-screen', 8000);
      } catch {
        await waitForAndroidElementById('onboarding-start-path-screen', 30000);
        await tapAndroidElementById('onboarding-start-path-back-button');
        await waitForAndroidElementById('onboarding-welcome-screen', 10000);
      }
    } else {
      try {
        await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(8000);
      } catch {
        await waitFor(element(by.id('onboarding-start-path-screen'))).toBeVisible().withTimeout(30000);
        await (await firstById('onboarding-start-path-back-button')).tap();
        await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(10000);
      }
    }
    await completeMinimalOnboarding();
    await writePersistedNote();
  }, 300000);

  it('keeps the completed profile across a cold relaunch (SQLite survives process death)', async () => {
    if (device.getPlatform() === 'android') {
      await launchAndroidAppIntoDevClient({ deleteApp: false });
      await device.disableSynchronization();
      await waitForAndroidElementById('today-screen', 30000);

      if (findAndroidElementCenter('onboarding-welcome-screen')) {
        throw new Error('Onboarding welcome must not be visible after Android cold relaunch.');
      }
      return;
    }
    // Kill and relaunch WITHOUT deleting the container. A persisted
    // `hasCompletedOnboarding` profile must route straight past onboarding.
    await device.launchApp({ newInstance: true, delete: false });
    await connectDevelopmentClient();
    await device.disableSynchronization();
    await blacklistDevServer();

    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(60000);
    await expect(element(by.id('onboarding-welcome-screen'))).not.toBeVisible();
  });

  it('keeps the written daily-log note across a cold relaunch', async () => {
    if (device.getPlatform() === 'android') {
      await launchAndroidAppIntoDevClient({ deleteApp: false });
      await device.disableSynchronization();
      await waitForAndroidElementById('today-screen', 30000);
      await expectAndroidDailyLogCount(LOG_DATE, 1);
      return;
    }
    await device.launchApp({ newInstance: true, delete: false });
    await connectDevelopmentClient();
    await device.disableSynchronization();
    await blacklistDevServer();

    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(60000);
    // The previously saved note must still be present in today's logging form,
    // proving the DailyLogEntry round-tripped through real SQLite storage.
    await openTodayLoggingScreen();
    await expect(element(by.text(PERSISTED_NOTE))).toBeVisible();
  });
});
