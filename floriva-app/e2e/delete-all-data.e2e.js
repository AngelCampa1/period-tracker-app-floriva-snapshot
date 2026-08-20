/* global waitFor */

const { execFileSync } = require('node:child_process');
const {
  expectAndroidDailyLogCount: expectAndroidDailyLogCountWithDependencies,
  queryAndroidDailyLogCount: queryAndroidDailyLogCountWithDependencies,
} = require('./helpers/androidSqliteProbe');

// Native delete-all-data coverage.
//
// This suite intentionally runs without a dev-launch preset. Presets wipe and
// reseed local state on boot, which would hide whether the Settings destructive
// action actually clears the device stores.

const describeDeleteAllData =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET == null ||
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'fresh-install'
    ? describe
    : describe.skip;

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const androidDevServerUrl = `http://${devServerHost}:${devServerPort}`;
const DELETE_PROBE_NOTE = 'floriva-delete-all-data-probe';
const LOG_DATE = '2026-06-10';

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
  const uiTree = runAdb([
    'exec-out',
    'uiautomator',
    'dump',
    '/dev/tty',
  ]).toString();
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
  const uiTree = runAdb([
    'exec-out',
    'uiautomator',
    'dump',
    '/dev/tty',
  ]).toString();
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
  const uiTree = runAdb([
    'exec-out',
    'uiautomator',
    'dump',
    '/dev/tty',
  ]).toString();
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
  runAdb([
    'shell',
    'input',
    'tap',
    String(x),
    String(y),
  ]);
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
  runAdb([
    'shell',
    'input',
    'swipe',
    '540',
    '2200',
    '540',
    '1350',
    '500',
  ]);
}

function openAndroidUrl(url) {
  runAdb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    url,
    'app.floriva',
  ]);
}

function clearAndroidAppData() {
  runAdb(['shell', 'pm', 'clear', 'app.floriva']);
}

function queryAndroidDailyLogCount(logDate) {
  return queryAndroidDailyLogCountWithDependencies({ logDate, runAdb });
}

async function expectAndroidDailyLogCount(logDate, expectedCount, timeoutMs = 10000) {
  return expectAndroidDailyLogCountWithDependencies({
    logDate,
    expectedCount,
    timeoutMs,
    queryCount: queryAndroidDailyLogCount,
    relaunch: relaunchPreservingContainer,
    delay,
  });
}

async function waitForAndroidElementById(testID, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      return center;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found in the UI tree.`);
}

async function tapAndroidElementById(testID, timeoutMs = 15000) {
  const center = await waitForAndroidElementById(testID, timeoutMs);

  runAdb([
    'shell',
    'input',
    'tap',
    String(center.x),
    String(center.y),
  ]);
}

async function tapAndroidElementByIdWithScroll(testID, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      runAdb([
        'shell',
        'input',
        'tap',
        String(center.x),
        String(center.y),
      ]);
      return;
    }

    swipeAndroidUp();
    await delay(600);
  }

  throw new Error(`Android element ${testID} was not found after scrolling.`);
}

async function waitForAndroidText(text, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (androidUiTreeIncludesText(text)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Android text ${text} was not found in the UI tree.`);
}

async function blacklistDevServer() {
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

async function tapVisibleElementById(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(5000);
    await element(by.id(testID)).tap();
  } catch {
    await waitFor(firstElementById(testID)).toBeVisible().withTimeout(5000);
    await firstElementById(testID).tap();
  }
}

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

async function completeAndroidMinimumOnboarding() {
  await tapAndroidElementById('onboarding-welcome-start-button');
  await waitForAndroidElementById('onboarding-start-path-screen', 10000);
  await tapAndroidElementById('onboarding-start-path-fresh-option');
  await delay(500);
  await tapAndroidElementById('onboarding-start-path-continue-button');
  await waitForAndroidElementById('onboarding-last-period-start-today', 20000);
  await tapAndroidElementById('onboarding-last-period-start-today');
  await delay(500);
  swipeAndroidUp();
  await delay(500);
  await tapAndroidElementById('onboarding-last-period-start-continue-button');
  await waitForAndroidElementById('onboarding-cycle-variability-steady-option', 20000);
  swipeAndroidUp();
  await delay(500);
  await tapAndroidElementById('onboarding-cycle-variability-steady-option');
  await delay(500);
  await tapAndroidElementById('onboarding-cycle-length-continue-button');
  await waitForAndroidElementById('onboarding-period-length-continue-button', 20000);
  await tapAndroidElementById('onboarding-period-length-continue-button');
  await waitForAndroidElementById('onboarding-symptom-logging-no-option', 20000);
  await tapAndroidElementById('onboarding-symptom-logging-no-option');
  await delay(500);
  await tapAndroidElementById('onboarding-symptom-logging-continue-button');
  await waitForAndroidElementById('onboarding-ttc-no-option', 20000);
  await tapAndroidElementById('onboarding-ttc-no-option');
  await delay(500);
  await tapAndroidElementById('onboarding-ttc-continue-button');
  await tapAndroidElementById('onboarding-notifications-skip-button', 20000);
  await waitForAndroidElementById('onboarding-paywall-screen', 20000);
  await waitForAndroidText('Start your free trial.', 10000);
  await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-annual-button');
  await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-selected-button');
  await tapAndroidElementById('onboarding-completion-continue-button', 20000);
  await waitForAndroidElementById('today-screen', 30000);
}

async function completeMinimalOnboarding() {
  if (device.getPlatform() === 'android') {
    await completeAndroidMinimumOnboarding();
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

async function writePersistedLogEntry() {
  if (device.getPlatform() === 'android') {
    openAndroidUrl(`floriva://calendar/day/${LOG_DATE}?disableOnboarding=1`);
    await waitForAndroidElementById('calendar-day-screen', 15000);
    // Android writes a chip-only entry to avoid keyboard focus noise in this
    // destructive-data spec. iOS keeps the richer note-entry path below.
    await tapAndroidElementById('today-logging-chip-bleeding-light');
    await delay(500);
    await tapAndroidElementByIdWithScroll('today-save-button');
    await waitForAndroidElementById('today-feedback-message', 10000);
    await expectAndroidDailyLogCount(LOG_DATE, 1);
    return;
  }

  await device.openURL({ url: `floriva://calendar/day/${LOG_DATE}?disableOnboarding=1` });
  await waitFor(element(by.id('calendar-day-screen'))).toBeVisible().withTimeout(15000);
  await element(by.id('calendar-day-screen-scroll')).swipe('up', 'fast', 0.85);
  await element(by.id('calendar-day-screen-scroll')).swipe('up', 'slow', 0.35);
  await waitFor(element(by.id('today-notes-input'))).toBeVisible().withTimeout(10000);
  await element(by.id('today-notes-input')).tap();
  await element(by.id('today-notes-input')).typeText(DELETE_PROBE_NOTE);
  await element(by.id('calendar-day-screen-scroll')).scrollTo('bottom');
  await waitFor(element(by.id('today-save-button'))).toBeVisible().withTimeout(10000);
  await tapVisibleElementById('today-save-button');
  await waitFor(element(by.id('today-feedback-message'))).toBeVisible().withTimeout(10000);
}

async function deleteAllLocalDataFromSettings() {
  if (device.getPlatform() === 'android') {
    openAndroidUrl('floriva://settings/delete-data?disableOnboarding=1');
    await waitForAndroidElementById('settings-delete-data-button', 15000);
    await tapAndroidElementById('settings-delete-data-button');
    await waitForAndroidElementById('settings-confirm-delete-data-button', 10000);
    await tapAndroidElementById('settings-confirm-delete-data-button');
    await waitForDeletedStateOnboarding();
    await expectAndroidDailyLogCount(LOG_DATE, 0);
    return;
  }

  await device.openURL({ url: 'floriva://settings/delete-data?disableOnboarding=1' });
  await waitFor(element(by.id('settings-delete-data-button'))).toBeVisible().withTimeout(15000);
  await tapDuplicatedActionUntilVisible(
    'settings-delete-data-button',
    'settings-confirm-delete-data-button',
  );
  await tapDuplicatedActionUntilVisible(
    'settings-confirm-delete-data-button',
    'onboarding-welcome-screen',
  );
  await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(30000);
}

async function launchFreshContainer() {
  if (device.getPlatform() === 'android') {
    clearAndroidAppData();
    await device.launchApp({
      newInstance: true,
      delete: true,
      launchArgs: { detoxFlorivaDevServerUrl: androidDevServerUrl },
      url: devClientUrl,
    });
    await dismissDeveloperMenuIntroIfNeeded();
  } else {
    await device.launchApp({ newInstance: true, delete: true });
    await connectDevelopmentClient();
  }

  await device.disableSynchronization();

  if (device.getPlatform() !== 'android') {
    await blacklistDevServer();
    await device.openURL({ url: 'floriva://welcome' });
  }
  await dismissDeveloperMenuIntroIfNeeded();
}

async function relaunchPreservingContainer() {
  if (device.getPlatform() === 'android') {
    await device.launchApp({
      newInstance: true,
      delete: false,
      launchArgs: { detoxFlorivaDevServerUrl: androidDevServerUrl },
    });
    await dismissDeveloperMenuIntroIfNeeded();
  } else {
    await device.launchApp({ newInstance: true, delete: false });
    await connectDevelopmentClient();
    await blacklistDevServer();
  }

  await device.disableSynchronization();
}

async function ensureWelcomeScreen() {
  if (device.getPlatform() === 'android') {
    try {
      await waitForAndroidElementById('onboarding-welcome-screen', 8000);
      return;
    } catch {
      await waitForAndroidElementById('onboarding-start-path-screen', 30000);
      await tapAndroidElementById('onboarding-start-path-back-button');
      await waitForAndroidElementById('onboarding-welcome-screen', 10000);
      return;
    }
  }

  try {
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(8000);
  } catch {
    await waitFor(element(by.id('onboarding-start-path-screen'))).toBeVisible().withTimeout(30000);
    await firstElementById('onboarding-start-path-back-button').tap();
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(10000);
  }
}

async function waitForDeletedStateOnboarding(timeoutMs = 30000) {
  if (device.getPlatform() === 'android') {
    try {
      await waitForAndroidElementById('onboarding-welcome-screen', 8000);
      return;
    } catch {
      await waitForAndroidElementById('onboarding-start-path-screen', timeoutMs);
      return;
    }
  }

  try {
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(8000);
  } catch {
    await waitFor(element(by.id('onboarding-start-path-screen')))
      .toBeVisible()
      .withTimeout(timeoutMs);
  }
}

describeDeleteAllData('Floriva delete all local data', () => {
  beforeAll(async () => {
    await launchFreshContainer();
    await ensureWelcomeScreen();
    await completeMinimalOnboarding();
    await writePersistedLogEntry();
    await deleteAllLocalDataFromSettings();
  }, 360000);

  it('returns to onboarding immediately after deleting local data', async () => {
    if (device.getPlatform() === 'android') {
      await waitForDeletedStateOnboarding();
      if (findAndroidElementCenter('today-screen')) {
        throw new Error('Today screen must not remain visible after deleting local data.');
      }
      return;
    }

    await waitForDeletedStateOnboarding();
    await expect(element(by.id('today-screen'))).not.toBeVisible();
  });

  it('keeps local data deleted after a cold relaunch without clearing the app container', async () => {
    await relaunchPreservingContainer();

    if (device.getPlatform() === 'android') {
      await waitForDeletedStateOnboarding();
      await expectAndroidDailyLogCount(LOG_DATE, 0);
      if (findAndroidElementCenter('today-screen')) {
        throw new Error('Today screen must not be visible after relaunching deleted local data.');
      }
      return;
    }

    await waitForDeletedStateOnboarding();
    await expect(element(by.id('today-screen'))).not.toBeVisible();
    await expect(element(by.text(DELETE_PROBE_NOTE))).not.toBeVisible();
  });
});
