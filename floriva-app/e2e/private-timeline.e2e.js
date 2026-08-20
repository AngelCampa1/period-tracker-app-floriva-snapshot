/* global waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describePrivateTimeline =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'qa-rich-history' ? describe : describe.skip;

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function scrollTimelineUntilIdVisible(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(5000);
    return;
  } catch {
    await waitFor(element(by.id(testID)))
      .toBeVisible()
      .whileElement(by.id('calendar-timeline-screen-scroll'))
      .scroll(260, 'down', NaN, 0.5);
  }
}

async function selectTimelineFilter(kind) {
  // The wrapped filter row lives at the top of the timeline list, so we must
  // scroll back up to it after a deep item scroll.
  if (device.getPlatform() === 'android') {
    // Walk back to the top filter row with a bounded set of big downward swipes
    // (swiping down scrolls the content up, toward the header). This avoids both
    // whileElement's repeated up-swipe — which intermittently triggers Android's
    // system back gesture and pops the timeline back to Today — and
    // scrollTo('top'), which force-breaks on this long virtualized list.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await waitFor(element(by.id(`private-timeline-filter-${kind}`)))
          .toBeVisible()
          .withTimeout(800);
        break;
      } catch {
        await element(by.id('calendar-timeline-screen-scroll')).swipe('down', 'fast', 0.85);
      }
    }
  } else {
    // iOS: scroll up until the chip is visible rather than scrollTo('top') — from
    // a deep offset Detox computes an off-screen gesture start for scrollTo and
    // fails the visibility check on the floating-chrome layout.
    await waitFor(element(by.id(`private-timeline-filter-${kind}`)))
      .toBeVisible()
      .whileElement(by.id('calendar-timeline-screen-scroll'))
      .scroll(400, 'up', NaN, 0.5);
  }
  await waitFor(element(by.id(`private-timeline-filter-${kind}`)))
    .toBeVisible()
    .withTimeout(8000);
  await element(by.id(`private-timeline-filter-${kind}`)).tap();
}

async function connectDevelopmentClient() {
  await device.openURL({ url: devClientUrl });
  await dismissDeveloperMenuIntroIfNeeded();
}

function runAdb(args) {
  const deviceId = device.id ?? device.deviceId ?? process.env.ADB_SERIAL;
  const resolvedArgs = deviceId ? ['-s', deviceId, ...args] : args;
  execFileSync(process.env.ADB_BINARY ?? 'adb', resolvedArgs);
}

async function openRoute(path) {
  const normalizedPath = path
    .replace(/^\/\(app\)\/\(tabs\)\//, '')
    .replace(/^\/\(app\)\//, '')
    .replace(/^\//, '');
  const url = `floriva:///${normalizedPath}?disableOnboarding=1`;

  if (device.getPlatform() === 'android') {
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
    return;
  }

  await device.openURL({ url });
}

describePrivateTimeline('Floriva private timeline smoke', () => {
  beforeAll(async () => {
    const launchOptions =
      device.getPlatform() === 'android'
        ? { newInstance: true, delete: true, url: devClientUrl }
        : { newInstance: true, delete: true };

    await device.launchApp(launchOptions);
    await device.disableSynchronization();
    if (device.getPlatform() !== 'android') {
      await connectDevelopmentClient();
    } else {
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
    }
    await openRoute('/(app)/(tabs)/calendar/timeline');
    await dismissDeveloperMenuIntroIfNeeded();
  });

  it('opens the seeded private timeline and filters sensitive history', async () => {
    await waitFor(element(by.id('calendar-timeline-screen'))).toBeVisible().withTimeout(30000);
    // The large editorial title is a Screen string-title with a stable testID;
    // assert that rather than by.text (Detox reads the big serif title as <75%
    // visible and times out on a bare text matcher).
    await waitFor(element(by.id('calendar-timeline-screen-title')))
      .toBeVisible()
      .withTimeout(10000);
    await scrollTimelineUntilIdVisible('private-timeline-item-monthly-briefing-2026-04');
    await scrollTimelineUntilIdVisible('private-timeline-item-daily-log-qa-log-2026-04-13');
    await scrollTimelineUntilIdVisible('private-timeline-item-note-qa-log-2026-04-13');
    await scrollTimelineUntilIdVisible('private-timeline-item-ttc-qa-log-2026-04-13');
    await scrollTimelineUntilIdVisible('private-timeline-item-birth-control-qa-log-2026-02-06');

    await selectTimelineFilter('reminder');
    await scrollTimelineUntilIdVisible('private-timeline-item-reminder-daily-log');

    await selectTimelineFilter('ttc');
    await scrollTimelineUntilIdVisible('private-timeline-item-ttc-qa-log-2026-04-13');
    await expect(
      element(by.id('private-timeline-item-birth-control-qa-log-2026-02-06')),
    ).not.toExist();

    await selectTimelineFilter('birth-control');
    await scrollTimelineUntilIdVisible('private-timeline-item-birth-control-qa-log-2026-02-06');
  });
});
