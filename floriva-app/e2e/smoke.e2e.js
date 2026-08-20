/* global beforeEach, waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const androidDevServerUrl = `http://${devServerHost}:${devServerPort}`;

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
  const uiTree = runAdb([
    'exec-out',
    'uiautomator',
    'dump',
    '/dev/tty',
  ]).toString();
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
  const uiTree = runAdb([
    'exec-out',
    'uiautomator',
    'dump',
    '/dev/tty',
  ]).toString();

  return uiTree.includes(`text="${text}"`);
}

async function tapAndroidElementById(testID, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
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

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found in the UI tree.`);
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

async function tapAndroidElementByIdWithScroll(testID, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt++) {
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
  // Retry up to 4 times with short windows before a final long wait. Handles brief
  // disabled states that can occur when disableSynchronization() is active.
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

async function tapDuplicatedActionUntilAnyVisible(actionTestID, nextScreenTestIDs) {
  if (device.getPlatform() === 'android') {
    await tapAndroidElementById(actionTestID);
    await delay(2000);
    return nextScreenTestIDs[0];
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    for (const tapTarget of [
      () => tapVisibleElementById(actionTestID),
      () => element(by.id(actionTestID)).atIndex(1).tap(),
    ]) {
      try {
        await tapTarget();
        for (const nextScreenTestID of nextScreenTestIDs) {
          try {
            await waitFor(element(by.id(nextScreenTestID))).toBeVisible().withTimeout(3000);
            return nextScreenTestID;
          } catch {
            // Check the other allowed branch before retrying the action.
          }
        }
      } catch {
        // Some native stacks expose one action node.
      }
    }
  }

  throw new Error(
    `${actionTestID} could not reach any expected screen: ${nextScreenTestIDs.join(', ')}`,
  );
}

async function chooseOnboardingDecisionAndContinue({
  screenTestID,
  optionTestID,
  continueTestID,
  nextScreenTestID,
}) {
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

async function assertAndroidPaywallContent() {
  await tapAndroidElementById('onboarding-paywall-screen', 20000);
  await waitForAndroidTextWithScroll('Start your free trial.');
  // The mandatory paywall no longer renders a skip affordance.
  if (findAndroidElementCenter('onboarding-paywall-continue-without-trial-button')) {
    throw new Error('Mandatory paywall must not render a continue-without-trial skip button.');
  }
  if (findAndroidElementCenter('onboarding-paywall-continue-preview-button')) {
    throw new Error('Mandatory paywall must not render a continue-preview skip button.');
  }
  // Picking a plan under local-purchase-success completes a fake purchase and
  // advances to the onboarding completion screen. Tapping "Open Floriva" there
  // persists the profile and lands the user on /today.
  // Select the annual plan card, then commit via the single shared CTA.
  await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-annual-button');
  await tapAndroidElementByIdWithScroll('onboarding-paywall-purchase-selected-button');
  await tapAndroidElementById('onboarding-completion-continue-button', 20000);
  await tapAndroidElementById('today-screen', 20000);
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

const describeFreshInstallSmoke =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'qa-rich-history' ? describe.skip : describe;

describeFreshInstallSmoke('Floriva launch smoke', () => {
  beforeEach(async () => {
    await launchFreshWelcomeScreen();
  });

  it('shows the onboarding welcome screen on a fresh launch', async () => {
    await waitFor(element(by.id('onboarding-welcome-screen'))).toBeVisible().withTimeout(30000);
  });

  it('reaches the onboarding paywall from the minimum fresh setup flow', async () => {
    if (device.getPlatform() === 'android') {
      await runAndroidMinimumFreshSetupFlow();
      await assertAndroidPaywallContent();
      return;
    }

    await firstElementById('onboarding-welcome-start-button').tap();

    await waitFor(element(by.id('onboarding-start-path-screen'))).toBeVisible().withTimeout(10000);
    await chooseOnboardingDecisionAndContinue({
      screenTestID: 'onboarding-start-path-screen',
      optionTestID: 'onboarding-start-path-fresh-option',
      continueTestID: 'onboarding-start-path-continue-button',
      nextScreenTestID: 'onboarding-last-period-start-today',
    });
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
    const postNotificationScreen = await tapDuplicatedActionUntilAnyVisible(
      'onboarding-notifications-skip-button',
      ['onboarding-paywall-screen', 'onboarding-completion-continue-button'],
    );

    if (postNotificationScreen === 'onboarding-completion-continue-button') {
      await tapDuplicatedActionUntilVisible('onboarding-completion-continue-button', 'today-screen');
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
      return;
    }

    // Assert the paywall via the title's own testID rather than by.text: the
    // large editorial title's text matcher resolves to the screen-spanning
    // accessibility container, which trips Detox's <75%-coverage visibility
    // heuristic even though the title is plainly on screen (Screen.tsx).
    await waitFor(element(by.id('onboarding-paywall-screen-title')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('onboarding-paywall-purchase-annual-button')))
      .toBeVisible()
      .whileElement(by.id('onboarding-paywall-screen-scroll'))
      .scroll(240, 'down');
    // The mandatory paywall no longer renders skip affordances.
    await expect(element(by.id('onboarding-paywall-continue-without-trial-button'))).not.toExist();
    await expect(element(by.id('onboarding-paywall-continue-preview-button'))).not.toExist();
    // Select the annual plan card, then commit via the single shared CTA. Under
    // local-purchase-success this completes a fake purchase and advances to the
    // onboarding completion screen; "Open Floriva" lands on /today.
    await tapVisibleElementById('onboarding-paywall-purchase-annual-button');
    // The commit CTA sits below the plan cards, off-screen once the cards have
    // scrolled into view. Bring it up before tapping or the target is never
    // visible and the purchase never fires.
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
  }, 240000);
});
