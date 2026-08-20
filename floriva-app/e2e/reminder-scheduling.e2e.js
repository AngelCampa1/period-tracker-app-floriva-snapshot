/* global waitFor */

// Reminder / notification scheduling coverage.
//
// Toggling a reminder runs the full real path:
//   toggleReminder -> ensureReminderPermissions (real OS permission) ->
//   persistReminderPreferences -> SQLite write -> refreshReminderSchedules ->
//   reconcileReminderNotifications -> expo-notifications scheduling.
//
// The reminder center UI is derived from persisted preferences + profile + logs
// (`buildReminderCenterModel`), so the assertions here prove the
// permission -> persist -> reconcile -> render loop end-to-end against real
// native storage and the real notifications module.
//
// With EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS=1 the app exposes a hidden
// dev-only element containing a redacted
// `Notifications.getAllScheduledNotificationsAsync()` snapshot. This lets the
// spec prove the OS schedule, while keeping the hook out of production builds.
//
// Requires the `seeded-tracker` preset (completed user, `daily-log` reminder
// pre-enabled) and granted notification permission:
//
//   EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker pnpm detox:test:ios -- reminder-scheduling

const describeReminders =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'seeded-tracker'
    ? describe
    : describe.skip;

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

// The Expo dev-client holds a persistent Metro connection that keeps the app's
// run loop "busy", making Detox's internal `waitForActive` hang on launch.
// Blacklisting the dev-server endpoints lets Detox treat the app as idle.
async function blacklistDevServer() {
  if (device.getPlatform() !== 'ios') {
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

function runAdb(args) {
  const deviceId = device.id ?? device.deviceId ?? process.env.ADB_SERIAL;
  const resolvedArgs = deviceId ? ['-s', deviceId, ...args] : args;
  execFileSync(process.env.ADB_BINARY ?? 'adb', resolvedArgs);
}

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function openRoute(path) {
  const url = `floriva:///${path.replace(/^\//, '')}?disableOnboarding=1`;
  if (device.getPlatform() === 'android') {
    runAdb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, 'app.floriva']);
    return;
  }
  await device.openURL({ url });
}

async function scrollRemindersUntilVisible(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(4000);
  } catch {
    await waitFor(element(by.id(testID)))
      .toBeVisible()
      .whileElement(by.id('settings-reminders-screen-scroll'))
      .scroll(260, 'down');
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readDiagnosticLabel(attributes) {
  if (typeof attributes?.label === 'string') return attributes.label;
  if (typeof attributes?.text === 'string') return attributes.text;
  if (typeof attributes?.value === 'string') return attributes.value;

  return '';
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function isOneShotTrigger(trigger) {
  if (trigger?.type === 'date') {
    return Boolean(trigger.date) || trigger.repeats === false;
  }

  if (trigger?.type === 'timeInterval') {
    return typeof trigger.seconds === 'number' && trigger.seconds > 0 && trigger.repeats !== true;
  }

  return false;
}

async function readScheduledNotifications() {
  const attributes = await element(by.id('e2e-scheduled-notifications')).getAttributes();
  const label = readDiagnosticLabel(attributes);

  return JSON.parse(label || '[]');
}

async function readScheduledNotificationsUntil(predicate) {
  let latest = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    latest = await readScheduledNotifications();

    if (predicate(latest)) {
      return latest;
    }

    await delay(500);
  }

  throw new Error(`Scheduled notification diagnostics did not match. Latest: ${JSON.stringify(latest)}`);
}

describeReminders('Floriva reminder scheduling', () => {
  beforeAll(async () => {
    const launchOptions = {
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    };
    if (device.getPlatform() === 'android') {
      launchOptions.url = devClientUrl;
    }

    await device.launchApp(launchOptions);
    await blacklistDevServer();
    await device.disableSynchronization();

    if (device.getPlatform() === 'android') {
      await waitFor(element(by.id('today-screen'))).toBeVisible().withTimeout(30000);
    } else {
      await device.openURL({ url: devClientUrl });
      await dismissDeveloperMenuIntroIfNeeded();
    }

    // Use the canonical path WITHOUT the `(app)` Expo Router group: groups are
    // transparent in URLs, and the literal `(` breaks `adb shell am start` on
    // Android (the device shell parses it as a syntax error).
    await openRoute('settings/reminders');
    await dismissDeveloperMenuIntroIfNeeded();
    await waitFor(element(by.id('settings-reminders-screen'))).toBeVisible().withTimeout(30000);
  });

  // UL-54 removed the per-reminder "center rows" that duplicated the editable
  // reminder cards. Active state is now the always-present card's native toggle
  // plus the reminder-center summary count ("N reminders active on this
  // device."). These specs therefore assert the summary count rather than the
  // presence/absence of a row. The count lives in the summary at the top of the
  // screen, so scroll back up to it before asserting.
  async function scrollToReminderCenterSummary() {
    await waitFor(element(by.id('settings-reminder-center')))
      .toBeVisible()
      .whileElement(by.id('settings-reminders-screen-scroll'))
      .scroll(220, 'up', NaN, 0.5);
  }

  it('shows the seeded daily-log reminder as active in the reminder center', async () => {
    // The seeded-tracker preset persists `daily-log` enabled (and only that), so
    // its card renders and the center summary reports exactly one active reminder.
    await waitFor(element(by.id('settings-reminder-center'))).toBeVisible().withTimeout(10000);
    await scrollRemindersUntilVisible('settings-reminder-daily-log-toggle');
    await expect(element(by.id('settings-reminder-daily-log-toggle'))).toBeVisible();
    await scrollToReminderCenterSummary();
    await expect(element(by.text('1 reminder active on this device.'))).toBeVisible();
  });

  it('schedules a newly enabled reminder and reflects it in the reminder center', async () => {
    // Turn ON period-start. This persists the preference and reconciles the OS
    // schedule; the center summary count must rise from 1 to 2.
    await scrollRemindersUntilVisible('settings-reminder-period-start-toggle');
    await element(by.id('settings-reminder-period-start-toggle')).tap();

    await scrollToReminderCenterSummary();
    await expect(element(by.text('2 reminders active on this device.'))).toBeVisible();
  });

  it('cancels a reminder when toggled off and drops it from the reminder center', async () => {
    // Turn OFF the seeded daily-log reminder. Reconcile cancels its OS schedule;
    // the card stays but the summary count falls back from 2 to 1 (period-start,
    // enabled above, remains active).
    await scrollRemindersUntilVisible('settings-reminder-daily-log-toggle');
    await element(by.id('settings-reminder-daily-log-toggle')).tap();

    await scrollToReminderCenterSummary();
    await expect(element(by.text('1 reminder active on this device.'))).toBeVisible();
  });

  it('matches the OS scheduled-notification set without leaking reproductive details', async () => {
    await waitFor(element(by.id('e2e-scheduled-notifications')))
      .toExist()
      .withTimeout(10000);

    const userReminderIdentifiers = new Set([
      'reminder-daily-log',
      'reminder-period-start',
      'reminder-fertile-window',
      'reminder-birth-control',
    ]);
    const scheduled = await readScheduledNotificationsUntil((notifications) => {
      const userReminderIds = notifications
        .map((notification) => notification.identifier)
        .filter((identifier) => userReminderIdentifiers.has(identifier))
        .sort();

      return JSON.stringify(userReminderIds) === JSON.stringify(['reminder-period-start']);
    });
    const userReminders = scheduled.filter((notification) =>
      userReminderIdentifiers.has(notification.identifier),
    );
    const sensitiveTerms =
      /period|fertile|ovulat|birth[- ]?control|contracept|cycle|symptom|mood|cramp|bleed/i;

    assertEqual(userReminders.length, 1, 'Expected exactly one user reminder to remain scheduled');
    assertEqual(
      userReminders[0].identifier,
      'reminder-period-start',
      'Expected only the period-start reminder to remain scheduled',
    );
    assert(
      isOneShotTrigger(userReminders[0].trigger),
      `Expected period-start reminder to use a one-shot trigger. Received ${JSON.stringify(userReminders[0].trigger)}`,
    );

    for (const notification of scheduled) {
      assert(
        !sensitiveTerms.test(notification.title ?? ''),
        `Scheduled notification title leaked sensitive wording: ${notification.identifier}`,
      );
      assert(
        !sensitiveTerms.test(notification.body ?? ''),
        `Scheduled notification body leaked sensitive wording: ${notification.identifier}`,
      );
    }
  });
});
