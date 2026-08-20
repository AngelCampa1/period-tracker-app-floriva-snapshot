/* global waitFor */

const { execFileSync } = require('node:child_process');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const describeImportConcierge =
  process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET === 'import-ready' ? describe : describe.skip;

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

async function openImportReviewRoute() {
  if (device.getPlatform() === 'android') {
    execFileSync(process.env.ADB_BINARY ?? 'adb', [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'floriva://import/review?disableOnboarding=1',
      'app.floriva',
    ]);
    return;
  }

  await device.openURL({ url: 'floriva://import/review?disableOnboarding=1' });
}

async function scrollReviewUntilVisible(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible(35).withTimeout(3000);
    return;
  } catch {
    await waitFor(element(by.id(testID)))
      .toBeVisible(35)
      .whileElement(by.id('import-review-screen-scroll'))
      .scroll(220, 'down');
  }
}

describeImportConcierge('Floriva import concierge smoke', () => {
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

    await openImportReviewRoute();
    await dismissDeveloperMenuIntroIfNeeded();
  });

  it('reviews, edits, and commits a seeded import preview', async () => {
    await waitFor(element(by.id('import-review-screen'))).toBeVisible().withTimeout(30000);
    await scrollReviewUntilVisible('import-preview-entry-2026-04-12');
    await scrollReviewUntilVisible('import-preview-entry-2026-04-13');

    await scrollReviewUntilVisible('import-remove-preview-entry-2026-04-13');
    await element(by.id('import-remove-preview-entry-2026-04-13')).tap();
    await expect(element(by.id('import-preview-entry-2026-04-13'))).not.toExist();

    await element(by.id('import-commit-button')).tap();
    await waitFor(element(by.id('import-complete-screen'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('import-result-summary'))).toBeVisible().withTimeout(10000);
  });
});
