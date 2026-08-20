/* global waitFor */

const { execFileSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const os = require('node:os');
const pathModule = require('node:path');

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;
const androidDevServerUrl = `http://${devServerHost}:${devServerPort}`;
const launchPreset = process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function adb(args) {
  return execFileSync(process.env.ADB_BINARY ?? 'adb', args).toString();
}

function adbBuffer(args) {
  return execFileSync(process.env.ADB_BINARY ?? 'adb', args);
}

function getIosSimulatorId() {
  if (process.env.DETOX_IOS_DEVICE_ID) {
    return process.env.DETOX_IOS_DEVICE_ID;
  }

  const selectedSimulatorName = process.env.DETOX_IOS_DEVICE;

  if (!selectedSimulatorName) {
    return 'booted';
  }

  const simulatorList = JSON.parse(
    execFileSync('xcrun', ['simctl', 'list', 'devices', '--json']).toString(),
  );
  const selectedSimulator = Object.values(simulatorList.devices)
    .flat()
    .find(
      (simulator) =>
        simulator.name === selectedSimulatorName && simulator.state === 'Booted',
    );

  return selectedSimulator?.udid ?? 'booted';
}

function getIosAppContainerPath() {
  return execFileSync('xcrun', [
    'simctl',
    'get_app_container',
    getIosSimulatorId(),
    'app.floriva',
    'data',
  ])
    .toString()
    .trim();
}

function listBackupFiles() {
  if (device.getPlatform() === 'android') {
    return adb([
      'shell',
      'run-as',
      'app.floriva',
      'find',
      'files',
      '-maxdepth',
      '1',
      '-name',
      'floriva-backup-*.floriva',
      '-print',
    ])
      .trim()
      .split('\n')
      .filter(Boolean);
  }

  const containerPath = getIosAppContainerPath();

  return execFileSync('find', [
    `${containerPath}/Documents`,
    '-maxdepth',
    '1',
    '-name',
    'floriva-backup-*.floriva',
    '-print',
  ])
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
}

function removeBackupFiles() {
  for (const backupFile of listBackupFiles()) {
    if (device.getPlatform() === 'android') {
      adb(['shell', 'run-as', 'app.floriva', 'rm', '-f', backupFile]);
    } else {
      execFileSync('rm', ['-f', backupFile]);
    }
  }
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function copyAndroidSqliteDatabase(tempDir) {
  for (const fileName of ['floriva.db', 'floriva.db-wal', 'floriva.db-shm']) {
    try {
      const databaseBytes = adbBuffer([
        'exec-out',
        'run-as',
        'app.floriva',
        'cat',
        `files/SQLite/${fileName}`,
      ]);

      if (fileName === 'floriva.db') {
        if (
          databaseBytes.length === 0 ||
          !databaseBytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))
        ) {
          throw new Error('Android Floriva SQLite database was not readable at files/SQLite/floriva.db.');
        }
      } else if (databaseBytes.length === 0 || databaseBytes.toString().startsWith('cat:')) {
        continue;
      }

      fs.writeFileSync(pathModule.join(tempDir, fileName), databaseBytes);
    } catch (error) {
      if (fileName === 'floriva.db') {
        throw error;
      }
    }
  }
}

function copyIosSqliteDatabase(tempDir) {
  const sqliteDirectory = pathModule.join(getIosAppContainerPath(), 'Documents/SQLite');
  const iosDbPath = pathModule.join(sqliteDirectory, 'floriva.db');

  if (!fs.existsSync(iosDbPath)) {
    throw new Error(`iOS Floriva SQLite database was not readable at ${iosDbPath}.`);
  }

  for (const fileName of ['floriva.db', 'floriva.db-wal', 'floriva.db-shm']) {
    const sourcePath = pathModule.join(sqliteDirectory, fileName);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, pathModule.join(tempDir, fileName));
    }
  }
}

function queryDailyLogCount(logDate) {
  const tempDir = fs.mkdtempSync(pathModule.join(os.tmpdir(), 'floriva-backup-db-'));
  const dbPath = pathModule.join(tempDir, 'floriva.db');

  try {
    if (device.getPlatform() === 'android') {
      copyAndroidSqliteDatabase(tempDir);
    } else {
      copyIosSqliteDatabase(tempDir);
    }

    const output = execFileSync(process.env.SQLITE3_BINARY ?? 'sqlite3', [
      dbPath,
      `SELECT COUNT(*) FROM daily_logs WHERE log_date = ${quoteSqlString(logDate)};`,
    ]).toString();

    return Number(output.trim() || '0');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function expectRestoredBackupRows(logDate, expectedCount, timeoutMs = 10000) {
  const startTime = Date.now();
  let lastCount = -1;

  while (Date.now() - startTime < timeoutMs) {
    lastCount = queryDailyLogCount(logDate);

    if (lastCount === expectedCount) {
      return;
    }

    await delay(500);
  }

  throw new Error(
    `Expected ${expectedCount} restored daily log rows for ${logDate}, found ${lastCount}.`,
  );
}

async function waitForBackupFile(timeoutMs = 90000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const backupFiles = listBackupFiles();

    if (backupFiles.length > 0) {
      return backupFiles;
    }

    await delay(500);
  }

  throw new Error('Backup export did not create a .floriva file.');
}

// Encrypting a backup derives a key with 210k PBKDF2 iterations, which is
// intentionally slow and can take well over a minute in the unoptimized
// debug dev-client (it is far faster in release builds). Allow generous
// headroom so the suite asserts on functionality, not debug-build CPU speed.
async function waitForBackupFileAfterTapExport(timeoutMs = 90000) {
  try {
    return await waitForBackupFile(timeoutMs);
  } catch (error) {
    if (device.getPlatform() === 'ios') {
      await element(by.id('backup-export-button')).tap();
      return waitForBackupFile(15000);
    }

    throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAndroidElementCenter(testID) {
  const uiTree = adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
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

async function tapAndroidElementById(testID, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      adb(['shell', 'input', 'tap', String(center.x), String(center.y)]);
      return;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found in the UI tree.`);
}

function tapAndroidPoint(x, y) {
  adb(['shell', 'input', 'tap', String(x), String(y)]);
}

async function scrollBackupUntilVisible(testID) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible(35).withTimeout(5000);
    return;
  } catch {
    await waitFor(element(by.id(testID)))
      .toBeVisible(35)
      .whileElement(by.id('backup-screen-scroll'))
      .scroll(260, 'down');
  }
}

async function launchBackupRoute(path) {
  if (device.getPlatform() === 'android') {
    await device.launchApp({
      newInstance: true,
      delete: false,
      launchArgs: { detoxFlorivaDevServerUrl: androidDevServerUrl },
    });
    await delay(2000);
    tapAndroidPoint(540, 2275);
    await delay(500);
    tapAndroidPoint(970, 245);
    await delay(500);
  } else {
    await device.launchApp({
      newInstance: true,
      delete: false,
    });
    await device.openURL({ url: devClientUrl });
  }

  await device.disableSynchronization();
  if (device.getPlatform() === 'android') {
    adb([
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      `floriva://${path}?disableOnboarding=1`,
      'app.floriva',
    ]);
  } else {
    await device.openURL({ url: `floriva://${path}?disableOnboarding=1` });
  }
}

async function launchBackupExportScreen() {
  await launchBackupRoute('backup/export');
}

async function tapBackupAction(testID) {
  await scrollBackupUntilVisible(testID);

  if (device.getPlatform() === 'android') {
    await tapAndroidElementById(testID);
    return;
  }

  await element(by.id(testID)).tap();
}

const backupExportDescribe = launchPreset == null ? describe : describe.skip;

backupExportDescribe('Backup export handoff', () => {
  it('creates a backup package and reaches the native share handoff path', async () => {
    await launchBackupExportScreen();

    await waitFor(element(by.id('backup-export-passphrase-input')))
      .toBeVisible()
      .withTimeout(20000);
    removeBackupFiles();

    await element(by.id('backup-export-passphrase-input')).replaceText(
      'qaexportpassphrase2026',
    );
    await element(by.id('backup-export-passphrase-confirm-input')).replaceText(
      'qaexportpassphrase2026',
    );
    await scrollBackupUntilVisible('backup-export-button');

    if (device.getPlatform() === 'android') {
      await tapAndroidElementById('backup-export-button');
    } else {
      await element(by.id('backup-export-button')).tap();
    }

    await waitForBackupFileAfterTapExport();
    await delay(2000);
    await device.takeScreenshot('backup-export-after-create');
  });
});

const backupReadyDescribe = launchPreset === 'backup-ready' ? describe : describe.skip;

backupReadyDescribe('Backup restore preview', () => {
  it('shows productized restore preview details and commits the seeded backup', async () => {
    await launchBackupRoute('backup/restore');

    await scrollBackupUntilVisible('backup-preview-card');
    await scrollBackupUntilVisible('backup-replace-data-note');
    await scrollBackupUntilVisible('backup-reset-restore-selection-button');
    await device.takeScreenshot('backup-restore-preview-productized');
    await expectRestoredBackupRows('2026-04-13', 0);
    await expectRestoredBackupRows('2026-04-03', 1);
    await tapBackupAction('backup-acknowledge-restore-replacement-button');
    await tapBackupAction('backup-confirm-restore-button');
    await waitFor(element(by.id('backup-status-card'))).toBeVisible().withTimeout(30000);
    await expectRestoredBackupRows('2026-04-13', 1);
    await expectRestoredBackupRows('2026-04-03', 0);
    await device.takeScreenshot('backup-restore-committed');
  });
});
