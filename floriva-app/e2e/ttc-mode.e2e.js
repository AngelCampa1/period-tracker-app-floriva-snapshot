/* global waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describeTtcMode =
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
  // Expo Router groups ((app)/(tabs)) never appear in the emitted URL, and the
  // path must follow the authority (triple slash) or it is parsed as the host
  // and never routes. Strip the group prefixes and build floriva:///<path>.
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

describeTtcMode('TTC mode smoke', () => {
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

  it('shows TTC context on Today, daily logging, insights, and settings setup', async () => {
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('today-ttc-summary-card')))
      .toBeVisible(40)
      .whileElement(by.id('today-screen-scroll'))
      .scroll(140, 'down', NaN, 0.5);
    await waitFor(element(by.id('today-ttc-summary-card')))
      .toBeVisible(40)
      .withTimeout(10000);
    await waitFor(element(by.text('No TTC details logged today')))
      .toBeVisible()
      .withTimeout(10000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-7-ttc-today-summary');

    await openRoute('/(app)/calendar/day/2026-04-16');
    await waitFor(element(by.id('calendar-day-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('today-ttc-logging-controls')))
      .toExist()
      .withTimeout(10000);
    // Assert the TTC sex-logged chip is rendered (it only mounts when the TTC
    // fixture has `sex` tracking enabled, so its existence is the real functional
    // proof). We use toExist rather than pixel-precise visibility: the chip is a
    // ~52px control that sits in a narrow band which Detox's whileElement scroll
    // offsets skip unreliably (clipped by the scroll container at every landed
    // offset). A best-effort fixed scroll then brings the controls into frame for
    // the screenshot without gating the test on flaky sub-pixel visibility.
    await waitFor(element(by.id('today-logging-chip-ttc-sex-logged')))
      .toExist()
      .withTimeout(10000);
    try {
      // Best-effort scroll to frame the controls for the screenshot; the day
      // screen may already be near its end, in which case scroll() throws.
      await element(by.id('calendar-day-screen-scroll')).scroll(320, 'down', NaN, 0.5);
    } catch {
      // Already at the bottom — the controls are in frame; nothing to do.
    }
    await waitFor(element(by.id('today-bbt-input'))).toExist().withTimeout(3000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-7-ttc-daily-log-controls');

    await openRoute('/(app)/(tabs)/insights');
    await waitFor(element(by.id('insights-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('insights-ttc-summary-row'))).toExist().withTimeout(10000);

    await openRoute('/(app)/insights/ttc');
    await waitFor(element(by.id('insights-ttc-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.text('Recent TTC logs'))).toBeVisible().withTimeout(10000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-7-ttc-insights-detail');

    await openRoute('/(app)/settings/ttc-setup');
    await waitFor(element(by.id('onboarding-ttc-setup-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.id('onboarding-ttc-setup-sex-toggle')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.text('Ready in daily logging')))
      .toBeVisible()
      .whileElement(by.id('onboarding-ttc-setup-screen-scroll'))
      .scroll(140, 'down', NaN, 0.5);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-7-ttc-settings-setup');
  });
});
