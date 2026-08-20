/* global waitFor */

// Manual-QA automation for the app-level Lifetime free trial.
//
// Runs against the grandfathered-expired preset, which lands the app fully
// locked on /subscribe with an `expired` snapshot that carries NO
// lifetimeTrialStartedAt marker -- so the Lifetime plan is trial-eligible.
//
// Requires the same Metro launch env as paywall-enforcement.e2e.js Flow 2:
//   EXPO_PUBLIC_DEV_LAUNCH_PRESET=grandfathered-expired
//   EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success

const launchPreset = process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null;
const describeLifetimeTrial =
  launchPreset === 'grandfathered-expired' ? describe : describe.skip;

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(8000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function connectDevelopmentClient() {
  // On Android the dev-client URL is supplied via launchApp's `url` option (see
  // launchOptions below); calling device.openURL with the exp+floriva URL there
  // throws a null-object-reference in the native bridge.
  if (device.getPlatform() !== 'android') {
    await device.openURL({ url: devClientUrl });
  }
  await dismissDeveloperMenuIntroIfNeeded();
}

function launchOptions(deleteApp) {
  return device.getPlatform() === 'android'
    ? { newInstance: true, delete: deleteApp, url: devClientUrl }
    : { newInstance: true, delete: deleteApp };
}

async function tapVisibleElementById(testID) {
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(8000);
  await element(by.id(testID)).tap();
}

describeLifetimeTrial('Lifetime free trial (app-level)', () => {
  beforeAll(async () => {
    await device.launchApp(launchOptions(true));
    await connectDevelopmentClient();
    await device.disableSynchronization();
    await dismissDeveloperMenuIntroIfNeeded();
  });

  it('offers a free trial on the Lifetime plan, starts it without paying, and unlocks the app', async () => {
    // 1) Fully locked on the paywall (expired grandfather trial).
    await waitFor(element(by.id('billing-screen'))).toBeVisible().withTimeout(30000);
    await device.takeScreenshot('lifetime-trial-01-paywall-locked');

    // 2) Select the Lifetime plan card. Because the trial is eligible, its card
    //    leads with the trial framing and the shared CTA becomes a trial start.
    await waitFor(element(by.id('billing-plan-card-lifetime')))
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(240, 'down');
    await tapVisibleElementById('billing-plan-card-lifetime');
    await delay(500);

    // 3) The selected Lifetime card leads with the no-auto-charge trial framing,
    //    and the shared CTA below reads "Start free trial". The UI-lift grew the
    //    billing layout, so the framing sits in the card and the CTA below it can
    //    both fall past the fold when the card scrolls into view — walk down to
    //    each rather than asserting them in place.
    await waitFor(
      element(by.text('Try 1 month free, then a one-time purchase. No auto-charge — access ends unless you unlock lifetime.')),
    )
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(120, 'down', NaN, 0.5);
    await waitFor(element(by.text('Start free trial')))
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(120, 'down', NaN, 0.5);
    await device.takeScreenshot('lifetime-trial-02-lifetime-selected-start-trial');

    // 4) Start the trial via the shared CTA. No store purchase is made; the
    //    app-level trial grants access and routes into /today.
    await waitFor(element(by.id('billing-purchase-selected-button')))
      .toBeVisible()
      .whileElement(by.id('billing-screen-scroll'))
      .scroll(240, 'down');
    await tapVisibleElementById('billing-purchase-selected-button');

    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
    await device.takeScreenshot('lifetime-trial-03-unlocked-today');
  }, 240000);

  it('keeps the trial access after a cold relaunch (no re-purchase, no re-lock)', async () => {
    // Relaunch WITHOUT deleting local data: the persisted trial_active snapshot
    // must survive the automatic store refresh (the derive-preservation branch)
    // and keep the app unlocked instead of collapsing to the expired lock.
    await device.launchApp(launchOptions(false));
    await connectDevelopmentClient();
    await device.disableSynchronization();
    await dismissDeveloperMenuIntroIfNeeded();

    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(60000);
    await expect(element(by.id('billing-screen'))).not.toBeVisible();
    await device.takeScreenshot('lifetime-trial-04-relaunch-still-unlocked');
  }, 240000);
});
