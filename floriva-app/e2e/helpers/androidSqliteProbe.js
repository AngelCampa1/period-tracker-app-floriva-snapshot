const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ANDROID_PACKAGE = 'app.floriva';
const SQLITE_DATABASE_FILES = ['floriva.db', 'floriva.db-wal', 'floriva.db-shm'];
const SQLITE_HEADER = 'SQLite format 3\0';

function defaultRunAdb(args) {
  return execFileSync(process.env.ADB_BINARY ?? 'adb', args);
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isMissingAndroidSqliteSidecar(error) {
  const diagnostic = [error?.message, error?.stderr, error?.stdout]
    .filter(Boolean)
    .map((value) => value.toString())
    .join('\n');

  return /No such file or directory/i.test(diagnostic);
}

function copyAndroidSqliteDatabase({
  tempDir,
  runAdb = defaultRunAdb,
  writeFileSync = fs.writeFileSync,
}) {
  for (const fileName of SQLITE_DATABASE_FILES) {
    let databaseBytes;

    try {
      databaseBytes = runAdb([
        'exec-out',
        'run-as',
        ANDROID_PACKAGE,
        'cat',
        `files/SQLite/${fileName}`,
      ]);
    } catch (error) {
      if (fileName !== 'floriva.db' && isMissingAndroidSqliteSidecar(error)) {
        continue;
      }

      throw error;
    }

    if (
      fileName === 'floriva.db' &&
      (databaseBytes.length === 0 || databaseBytes.subarray(0, 16).toString() !== SQLITE_HEADER)
    ) {
      throw new Error(
        'Android Floriva SQLite database was not readable at files/SQLite/floriva.db.',
      );
    }

    writeFileSync(path.join(tempDir, fileName), databaseBytes);
  }
}

function queryAndroidDailyLogCount({
  logDate,
  runAdb = defaultRunAdb,
  execSqlite = execFileSync,
  fileSystem = fs,
  tempRoot = os.tmpdir(),
  sqliteBinary = process.env.SQLITE3_BINARY ?? 'sqlite3',
}) {
  const tempDir = fileSystem.mkdtempSync(path.join(tempRoot, 'floriva-detox-db-'));
  const dbPath = path.join(tempDir, 'floriva.db');

  try {
    // Close Expo SQLite before copying so a transaction or checkpoint cannot
    // change the base/WAL/SHM set mid-snapshot.
    runAdb(['shell', 'am', 'force-stop', ANDROID_PACKAGE]);
    copyAndroidSqliteDatabase({
      tempDir,
      runAdb,
      writeFileSync: fileSystem.writeFileSync,
    });

    const output = execSqlite(sqliteBinary, [
      dbPath,
      `SELECT COUNT(*) FROM daily_logs WHERE log_date = ${quoteSqlString(logDate)};`,
    ]).toString();

    return Number(output.trim() || '0');
  } catch (error) {
    if (String(error.stderr ?? '').includes('no such table: daily_logs')) {
      throw new Error('Android Floriva SQLite database did not contain the daily_logs table.');
    }

    throw error;
  } finally {
    fileSystem.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function expectAndroidDailyLogCount({
  logDate,
  expectedCount,
  queryCount = queryAndroidDailyLogCount,
  relaunch,
  delay: wait,
  now = Date.now,
  timeoutMs = 10000,
}) {
  const startTime = now();
  let lastCount = -1;

  while (now() - startTime < timeoutMs) {
    try {
      lastCount = await queryCount(logDate);
    } finally {
      // Resume the same container after every quiesced snapshot. Any retry
      // therefore observes work performed after the app has relaunched.
      await relaunch();
    }

    if (lastCount === expectedCount) {
      return;
    }

    await wait(500);
  }

  throw new Error(
    `Expected ${expectedCount} Android daily log rows for ${logDate}, found ${lastCount}.`,
  );
}

module.exports = {
  copyAndroidSqliteDatabase,
  expectAndroidDailyLogCount,
  queryAndroidDailyLogCount,
};
