/* global waitFor */

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describePatternBriefings =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'qa-rich-history' ? describe : describe.skip;

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function connectDevelopmentClient() {
  await device.openURL({ url: devClientUrl });
  await dismissDeveloperMenuIntroIfNeeded();
}

function waitForSettledFrame() {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
}

// The native tab bar (expo-router native tabs) exposes no testID, so tabs are
// matched by their accessibility label. iOS surfaces the tab title with a
// button trait; Android exposes it as the item's text/content-description.
function tabMatcher(label) {
  return device.getPlatform() === 'ios'
    ? by.label(label).and(by.traits(['button']))
    : by.text(label);
}

describePatternBriefings('Pattern briefings smoke', () => {
  beforeAll(async () => {
    const launchOptions =
      device.getPlatform() === 'android'
        ? { newInstance: true, delete: true, url: devClientUrl }
        : { newInstance: true, delete: true };

    await device.launchApp(launchOptions);
    await device.disableSynchronization();
    if (device.getPlatform() !== 'android') {
      await connectDevelopmentClient();
    }
    await dismissDeveloperMenuIntroIfNeeded();
  });

  it('shows the monthly briefing hub card and detail screen', async () => {
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);

    await waitFor(element(tabMatcher('Insights')).atIndex(0)).toBeVisible().withTimeout(10000);
    await element(tabMatcher('Insights')).atIndex(0).tap();
    await waitFor(element(by.id('insights-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('insights-screen-scroll')).scroll(520, 'down', NaN, 0.5);
    await waitFor(element(by.text('April briefing'))).toBeVisible().withTimeout(5000);
    if (device.getPlatform() === 'android') {
      await element(by.id('insights-screen-scroll')).scroll(220, 'down', NaN, 0.5);
    }
    await waitForSettledFrame();
    await device.takeScreenshot('slice-9-monthly-briefing-hub');

    await element(by.id('insights-screen-scroll')).scroll(
      device.getPlatform() === 'android' ? 360 : 520,
      'down',
      NaN,
      0.5,
    );
    await waitFor(element(by.id('insights-monthly-briefing-row'))).toBeVisible().withTimeout(5000);
    await element(by.id('insights-monthly-briefing-row')).tap();
    await waitFor(element(by.id('insights-monthly-briefing-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('insights-monthly-briefing-screen-title')))
      .toBeVisible()
      .withTimeout(5000);
    await waitFor(element(by.text('Top signals'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.text('Local sources used'))).toBeVisible().withTimeout(5000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-9-monthly-briefing-detail');
  });
});
