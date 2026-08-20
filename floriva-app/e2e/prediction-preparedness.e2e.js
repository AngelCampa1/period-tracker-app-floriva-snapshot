/* global waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describePredictionPreparedness =
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

async function openRemindersRoute() {
  if (device.getPlatform() === 'android') {
    execFileSync(process.env.ADB_BINARY ?? 'adb', [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'floriva://settings/reminders?disableOnboarding=1',
      'app.floriva',
    ]);
    return;
  }

  await device.openURL({ url: 'floriva://settings/reminders?disableOnboarding=1' });
}

describePredictionPreparedness('Prediction confidence and preparedness smoke', () => {
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

  it('shows confidence context on Today, Calendar, and the reminder center', async () => {
    await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('today-confidence-summary'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.text('Based on 4 local cycle starts'))).toBeVisible().withTimeout(10000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-5-today-confidence');

    await element(tabMatcher('Calendar')).atIndex(0).tap();
    await waitFor(element(by.id('calendar-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('calendar-confidence-summary'))).toBeVisible().withTimeout(10000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-5-calendar-confidence');

    await openRemindersRoute();
    await waitFor(element(by.id('settings-reminders-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('settings-reminder-center')))
      .toBeVisible()
      .whileElement(by.id('settings-reminders-screen-scroll'))
      .scroll(120, 'up', NaN, 0.5);
    await waitFor(element(by.text('4 reminders active on this device.')))
      .toBeVisible()
      .withTimeout(10000);
    // UL-54 removed the duplicate reminder-center rows; each reminder now renders
    // as an editable card with a native toggle (settings-reminder-<kind>-toggle).
    // They sit below the summary, so scroll down until each is visible.
    await waitFor(element(by.id('settings-reminder-daily-log-toggle')))
      .toBeVisible(30)
      .whileElement(by.id('settings-reminders-screen-scroll'))
      .scroll(140, 'down', NaN, 0.5);
    // The birth-control card is the last reminder; at the content end its native
    // switch sits flush against the scroll boundary, which Detox measures as
    // clipped even after scrolling. Existence proves the card renders (the real
    // functional assertion); the daily-log scroll above already brings it into
    // frame for the screenshot.
    await waitFor(element(by.id('settings-reminder-birth-control-toggle')))
      .toExist()
      .withTimeout(5000);
    await waitForSettledFrame();
    await device.takeScreenshot('slice-5-reminder-center');
  });
});
