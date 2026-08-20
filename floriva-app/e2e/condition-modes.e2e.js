/* global waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describeConditionModes =
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

async function openRoute(path) {
  const normalizedPath = path
    .replace(/^\/\(app\)\/\(tabs\)\//, '')
    .replace(/^\/\(app\)\//, '')
    .replace(/^\//, '');
  const url = `floriva:///${normalizedPath}?disableOnboarding=1`;

  if (device.getPlatform() === 'android') {
    execFileSync(process.env.ADB_BINARY ?? 'adb', [
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
}

describeConditionModes('Condition modes smoke', () => {
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

  it('shows condition-aware logging, insights rows, and condition detail', async () => {
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);

    await openRoute('/(app)/calendar/day/2026-04-16');
    await waitFor(element(by.id('calendar-day-screen'))).toBeVisible().withTimeout(10000);
    // All three condition-pattern badges render in one wrapping row near the top
    // of the logging screen (inside the symptoms FieldGroup). UL-64 restyled the
    // titles to quiet uppercase eyebrow labels, so match the stable per-condition
    // testIDs rather than by.text (textTransform makes the rendered text uppercase
    // and unmatchable by the source casing).
    await waitFor(element(by.id('today-condition-logging-context')))
      .toBeVisible(30)
      .whileElement(by.id('calendar-day-screen-scroll'))
      .scroll(120, 'down', NaN, 0.5);
    await expect(element(by.id('today-condition-badge-pcos'))).toExist();
    await expect(element(by.id('today-condition-badge-pmdd'))).toExist();
    await expect(element(by.id('today-condition-badge-endometriosis'))).toExist();
    await waitForSettledFrame();
    await device.takeScreenshot('slice-8-condition-logging-context');

    await openRoute('/(app)/(tabs)/insights');
    await waitFor(element(by.id('insights-screen'))).toBeVisible().withTimeout(10000);
    // The three condition rows' existence is the functional proof. Best-effort
    // scroll to frame the pcos row for the screenshot via whileElement (fixed-
    // fraction swipes over/undershoot on Android); don't gate on visibility — at
    // the content end the rows can be clipped by the floating tab bar on iOS.
    await waitFor(element(by.id('insights-condition-row-pcos'))).toExist().withTimeout(10000);
    try {
      await waitFor(element(by.id('insights-condition-row-pcos')))
        .toBeVisible(20)
        .whileElement(by.id('insights-screen-scroll'))
        .scroll(160, 'down', NaN, 0.5);
    } catch {
      // Rows sit at the content end (clipped by the tab bar); existence is proof.
    }
    await waitFor(element(by.id('insights-condition-row-pmdd'))).toExist().withTimeout(5000);
    await waitFor(element(by.id('insights-condition-row-endometriosis')))
      .toExist()
      .withTimeout(5000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-8-condition-insights-rows');

    await openRoute('/(app)/insights/condition/pcos');
    await waitFor(element(by.id('insights-condition-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('insights-condition-summary-card')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('insights-condition-focus-card')))
      .toBeVisible(20)
      .whileElement(by.id('insights-condition-screen-scroll'))
      .scroll(120, 'down', NaN, 0.5);
    await waitFor(element(by.text('Logging focus'))).toBeVisible().withTimeout(5000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-8-condition-detail');
  });
});
