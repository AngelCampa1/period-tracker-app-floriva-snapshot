import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

describe('delete-all-data native e2e coverage', () => {
  it('does not skip the Android destructive wipe path', () => {
    const spec = fs.readFileSync(
      path.join(projectRoot, 'e2e/delete-all-data.e2e.js'),
      'utf8',
    );

    expect(spec).not.toContain("if (device.getPlatform() === 'android') {\n      return;");
    expect(spec).toContain('completeAndroidMinimumOnboarding');
    expect(spec).toContain('deleteAllLocalDataFromSettings');
    expect(spec).toContain("runAdb(['shell', 'pm', 'clear', 'app.floriva'])");
    expect(spec).toContain('tapAndroidTextIfVisible');
    expect(spec).toContain("androidUiTreeIncludesText('Connected to:')");
    expect(spec).toContain('matchAll(nodePattern)');
    expect(spec).toContain("runAdb(['shell', 'wm', 'size'])");
    expect(spec).toContain('resolveVisibleAndroidCenter');
    expect(spec).toContain('findAndroidContentDescriptionCenter');
    expect(spec).toContain('writePersistedLogEntry');
    expect(spec).toContain("tapAndroidElementById('today-logging-chip-bleeding-light')");
    expect(spec).toContain("require('./helpers/androidSqliteProbe')");
    expect(spec).toContain('queryAndroidDailyLogCountWithDependencies({ logDate, runAdb })');
    expect(spec).toContain('expectAndroidDailyLogCountWithDependencies({');
    expect(spec).toContain('relaunch: relaunchPreservingContainer');
    expect(spec).toContain('expectAndroidDailyLogCount(LOG_DATE, 1)');
    expect(spec).toContain('expectAndroidDailyLogCount(LOG_DATE, 0)');
    expect(spec).toContain(
      "tapDuplicatedActionUntilVisible(\n    'settings-delete-data-button',\n    'settings-confirm-delete-data-button'",
    );
    expect(spec).toContain('waitForDeletedStateOnboarding');
    expect(spec).toContain("'onboarding-start-path-screen'");
  });
});
