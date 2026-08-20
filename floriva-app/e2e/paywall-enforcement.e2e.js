/* global beforeEach, waitFor */

// Validates the mandatory post-onboarding paywall and the grandfathered-expired
// full-lock surface on both iOS simulator and Android emulator.
//
// The two flows depend on mutually exclusive Metro launch presets, so they are
// each gated behind EXPO_PUBLIC_DEV_LAUNCH_PRESET (matching the established
// per-preset describe.skip convention used across the e2e suite):
//   - Flow 1 (fresh mandatory paywall): run with NO preset, under
//     EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success.
//   - Flow 2 (grandfathered-expired lock): run with
//     EXPO_PUBLIC_DEV_LAUNCH_PRESET=grandfathered-expired and
//     EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success.

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const androidDevServerUrl = `http://${devServerHost}:${devServerPort}`;

const launchPreset = process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null;
const describeFreshPaywall = launchPreset == null ? describe : describe.skip;
const describeGrandfatheredExpired =
  launchPreset === 'grandfathered-expired' ? describe : describe.skip;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function findAndroidElementCenter(testID) {
  const uiTree = runAdb(['exec-out', 'uiautomator', 'dump', '/dev/tty']).toString();
  const nodePattern = new RegExp(
    `resource-id="${escapeRegExp(testID)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
  );
  const match = uiTree.match(nodePattern);

  if (!match) {
    return null;
  }

  const [, left, top, right, bottom] = match.map(Number);
  return {
    x: Math.round((left + right) / 2),
    y: Math.round((top + bottom) / 2),
  };
}

function androidUiTreeIncludesText(text) {
  const uiTree = runAdb(['exec-out', 'uiautomator', 'dump', '/dev/tty']).toString();

  return uiTree.includes(`text="${text}"`);
}

async function tapAndroidElementById(testID, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      runAdb(['shell', 'input', 'tap', String(center.x), String(center.y)]);
      return;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found in the UI tree.`);
}

function tapAndroidPoint(x, y) {
  runAdb(['shell', 'input', 'tap', String(x), String(y)]);
}

function swipeAndroidUp() {
  runAdb(['shell', 'input', 'swipe', '540', '2200', '540', '1350', '500']);
}

async function tapAndroidElementByIdWithScroll(testID, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt++) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      runAdb(['shell', 'input', 'tap', String(center.x), String(center.y)]);
      return;
    }

    swipeAndroidUp();
    await delay(600);
  }

  throw new Error(`Android element ${testID} was not found after scrolling.`);
}

async function waitForAndroidTextWithScroll(text, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt++) {
    if (androidUiTreeIncludesText(text)) {
      return;
    }

    swipeAndroidUp();
    await delay(600);
  }

  throw new Error(`Android text ${text} was not found after scrolling.`);
}

async function dismissDeveloperMenuIntroIfNeeded() {
  if (device.getPlatform() === 'android') {
    await delay(1000);
    tapAndroidPoint(970, 1848);
    await delay(500);
    return;
  }

  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(10000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function connectDevelopmentClient() {
  await device.openURL({ url: devClientUrl });
  await dismissDeveloperMenuIntroIfNeeded();
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
    await delay(2000);
    return;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
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
        // Some native stacks expose one action node.
      }
    }
  }
  throw new Error(`${actionTestID} could not be tapped after 4 attempts`);
}

async function selectOptionAndContinue(optionTestID, continueTestID, nextScreenTestID) {
  await tapVisibleElementById(optionTestID);
  try {
    await waitFor(element(by.text('Selected'))).toBeVisible().withTimeout(5000);
  } catch {
    await delay(500);
    await waitFor(element(by.id(continueTestID))).toBeVisible().withTimeout(5000);
    await tapDuplicatedActionUntilVisible(continueTestID, nextScreenTestID);
    return;
  }
  await tapDuplicatedActionUntilVisible(continueTestID, nextScreenTestID);
}

async function runAndroidMinimumFreshSetupFlow() {
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
}

async function launchFreshWelcomeScreen() {
  if (device.getPlatform() === 'android') {
    await device.launchApp({
      newInstance: true,
      delete: true,
      launchArgs: { detoxFlorivaDevServerUrl: androidDevServerUrl },
    });
    await dismissDeveloperMenuIntroIfNeeded();
  } else {
    await device.launchApp({ newInstance: true, delete: true });
    await connectDevelopmentClient();
  }

  await device.disableSynchronization();
  if (device.getPlatform() !== 'android') {
    await device.openURL({ url: 'floriva://welcome' });
  }
  await dismissDeveloperMenuIntroIfNeeded();

  try {
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(5000);
    return;
  } catch {
    await waitFor(element(by.id('onboarding-start-path-screen'))).toBeVisible().withTimeout(30000);
    await firstElementById('onboarding-start-path-back-button').tap();
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(10000);
  }
}

async function launchSeededPresetApp() {
  if (device.getPlatform() === 'android') {
    await device.launchApp({
      newInstance: true,
      delete: true,
      url: devClientUrl,
    });
  } else {
    await device.launchApp({ newInstance: true, delete: true });
    await connectDevelopmentClient();
  }

  await device.disableSynchronization();
  await dismissDeveloperMenuIntroIfNeeded();
}

describeFreshPaywall('Mandatory onboarding paywall enforcement', () => {
  beforeEach(async () => {
    await launchFreshWelcomeScreen();
  });

  it('forces a plan selection (no skip) and unlocks /today on purchase', async () => {
    if (device.getPlatform() === 'android') {
      await runAndroidMinimumFreshSetupFlow();
      await tapAndroidElementById('onboarding-paywall-screen', 20000);
      await waitForAndroidTextWithScroll('Start your free trial.');
      if (findAndroidElementCenter('onboarding-paywall-continue-without-trial-button')) {
        throw new Error('Mandatory paywall must not render a continue-without-trial skip button.');
      }
      if (findAndroidElementCenter('onboarding-paywall-continue-preview-button')) {
        throw new Error('Mandatory paywall must not render a continue-preview skip button.');
      }
      await device.takeScreenshot('android-onboarding-paywall-mandatory');
      // Select the annual plan card, then commit via the single shared CTA.
      await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-annual-button');
      await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-selected-button');
      // A successful purchase advances to the onboarding completion screen;
      // "Open Floriva" persists the profile and unlocks /today.
      await tapAndroidElementById('onboarding-completion-continue-button', 20000);
      await tapAndroidElementById('today-screen', 20000);
      return;
    }

    await firstElementById('onboarding-welcome-start-button').tap();

    await waitFor(element(by.id('onboarding-start-path-screen'))).toBeVisible().withTimeout(10000);
    await tapVisibleElementById('onboarding-start-path-fresh-option');
    await waitFor(element(by.text('Selected'))).toBeVisible().withTimeout(10000);
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
    await selectOptionAndContinue(
      'onboarding-symptom-logging-no-option',
      'onboarding-symptom-logging-continue-button',
      'onboarding-ttc-no-option',
    );
    await selectOptionAndContinue(
      'onboarding-ttc-no-option',
      'onboarding-ttc-continue-button',
      'onboarding-notifications-skip-button',
    );
    await tapDuplicatedActionUntilVisible(
      'onboarding-notifications-skip-button',
      'onboarding-paywall-screen',
    );

    await waitFor(element(by.text('Start your free trial.'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('onboarding-paywall-purchase-annual-button')))
      .toBeVisible()
      .whileElement(by.id('onboarding-paywall-screen-scroll'))
      .scroll(240, 'down');

    // The mandatory paywall must NOT render any skip affordance.
    await expect(element(by.id('onboarding-paywall-continue-without-trial-button'))).not.toExist();
    await expect(element(by.id('onboarding-paywall-continue-preview-button'))).not.toExist();

    await device.takeScreenshot('ios-onboarding-paywall-mandatory');

    // Select the annual plan card, then commit via the single shared CTA. Under
    // local-purchase-success this completes a fake purchase and advances to the
    // onboarding completion screen.
    await tapVisibleElementById('onboarding-paywall-purchase-annual-button');
    // The shared CTA sits below the fold once a plan is selected; scroll it into
    // view before tapping (matches the smoke/persistence paywall handling).
    await waitFor(element(by.id('onboarding-paywall-purchase-selected-button')))
      .toBeVisible()
      .whileElement(by.id('onboarding-paywall-screen-scroll'))
      .scroll(240, 'down');
    await tapDuplicatedActionUntilVisible(
      'onboarding-paywall-purchase-selected-button',
      'onboarding-completion-continue-button',
    );
    // "Open Floriva" persists the profile and unlocks /today.
    await tapDuplicatedActionUntilVisible(
      'onboarding-completion-continue-button',
      'today-screen',
    );
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
  }, 240000);
});

describeGrandfatheredExpired('Grandfathered-expired full-lock enforcement', () => {
  beforeAll(async () => {
    await launchSeededPresetApp();
  });

  it('opens locked on /subscribe with expired copy and unlocks /today on purchase', async () => {
    if (device.getPlatform() === 'android') {
      await tapAndroidElementById('billing-screen', 30000);
      await waitForAndroidTextWithScroll(
        'Your free trial has ended. Pick a plan to keep using Floriva.',
      );
      // When fully locked there is no back/dismiss affordance.
      if (findAndroidElementCenter('billing-back-button')) {
        throw new Error('Locked /subscribe must not render a back/dismiss button.');
      }
      await device.takeScreenshot('android-subscribe-lock-expired');
      // Select the annual plan card, then commit via the single shared CTA.
      await tapAndroidElementByIdWithScroll('billing-plan-card-annual');
      await tapAndroidElementByIdWithScroll('billing-purchase-selected-button');
      await tapAndroidElementById('today-screen', 30000);
      return;
    }

    await waitFor(element(by.id('billing-screen'))).toBeVisible().withTimeout(30000);
    await waitFor(
      element(by.text('Your free trial has ended. Pick a plan to keep using Floriva.')),
    )
      .toBeVisible()
      .withTimeout(10000);

    // When fully locked there is no back/dismiss affordance and /today is
    // unreachable until a plan is purchased.
    await expect(element(by.id('billing-back-button'))).not.toExist();
    await expect(element(by.id('today-screen'))).not.toExist();

    await device.takeScreenshot('ios-subscribe-lock-expired');

    await waitFor(element(by.id('billing-plan-card-annual')))
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(240, 'down');
    // Select the annual plan card, then commit via the single shared CTA. The
    // CTA sits below the fold once a plan is selected, so scroll it into view
    // before tapping (matches the onboarding-paywall handling above).
    await tapVisibleElementById('billing-plan-card-annual');
    await waitFor(element(by.id('billing-purchase-selected-button')))
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(240, 'down');
    await tapDuplicatedActionUntilVisible('billing-purchase-selected-button', 'today-screen');
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
  }, 240000);
});
