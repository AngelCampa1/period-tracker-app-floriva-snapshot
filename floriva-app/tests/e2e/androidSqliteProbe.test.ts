import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mockExecFileSync = jest.fn();

jest.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

const {
  copyAndroidSqliteDatabase,
  expectAndroidDailyLogCount,
  queryAndroidDailyLogCount,
} = require('../../e2e/helpers/androidSqliteProbe');

const SQLITE_HEADER = Buffer.from('SQLite format 3\0');

function createFixtureDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-sqlite-probe-test-'));
}

function sqliteBytes(suffix = '') {
  return Buffer.concat([SQLITE_HEADER, Buffer.from(suffix)]);
}

function fileNameFromAdbArgs(args: string[]) {
  return args.at(-1)?.split('/').at(-1);
}

describe('Android SQLite snapshot probe', () => {
  const fixtureDirectories: string[] = [];

  afterEach(() => {
    mockExecFileSync.mockReset();
    for (const directory of fixtureDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('force-stops before copying the base, WAL, and SHM files and cleans up afterward', () => {
    const tempRoot = createFixtureDirectory();
    const calls: string[] = [];
    let snapshotDirectory = '';
    fixtureDirectories.push(tempRoot);

    const runAdb = (args: string[]) => {
      const command = args.join(' ');
      calls.push(command);
      if (command === 'shell am force-stop app.floriva') {
        return Buffer.alloc(0);
      }

      const fileName = fileNameFromAdbArgs(args);
      return fileName === 'floriva.db' ? sqliteBytes('base') : Buffer.from(fileName ?? '');
    };
    const execSqlite = (_binary: string, args: string[]) => {
      snapshotDirectory = path.dirname(args[0]);
      calls.push('sqlite');
      expect(fs.readFileSync(args[0]).subarray(0, 16)).toEqual(SQLITE_HEADER);
      expect(fs.existsSync(path.join(snapshotDirectory, 'floriva.db-wal'))).toBe(true);
      expect(fs.existsSync(path.join(snapshotDirectory, 'floriva.db-shm'))).toBe(true);
      return Buffer.from('2\n');
    };

    expect(
      queryAndroidDailyLogCount({
        logDate: '2026-06-10',
        runAdb,
        execSqlite,
        fileSystem: fs,
        tempRoot,
        sqliteBinary: '/usr/local/bin/sqlite3',
      }),
    ).toBe(2);
    expect(calls).toEqual([
      'shell am force-stop app.floriva',
      'exec-out run-as app.floriva cat files/SQLite/floriva.db',
      'exec-out run-as app.floriva cat files/SQLite/floriva.db-wal',
      'exec-out run-as app.floriva cat files/SQLite/floriva.db-shm',
      'sqlite',
    ]);
    expect(fs.existsSync(snapshotDirectory)).toBe(false);

    const sqliteError = new Error('sqlite failed');
    let failedSnapshotDirectory = '';
    expect(() =>
      queryAndroidDailyLogCount({
        logDate: '2026-06-10',
        runAdb,
        execSqlite: (_binary: string, args: string[]) => {
          failedSnapshotDirectory = path.dirname(args[0]);
          throw sqliteError;
        },
        fileSystem: fs,
        tempRoot,
        sqliteBinary: '/usr/local/bin/sqlite3',
      }),
    ).toThrow(sqliteError);
    expect(fs.existsSync(failedSnapshotDirectory)).toBe(false);

    const missingTableError = new Error('sqlite failed') as Error & { stderr?: Buffer };
    missingTableError.stderr = Buffer.from('Error: no such table: daily_logs');
    expect(() =>
      queryAndroidDailyLogCount({
        logDate: '2026-06-10',
        runAdb,
        execSqlite: () => {
          throw missingTableError;
        },
        fileSystem: fs,
        tempRoot,
        sqliteBinary: '/usr/local/bin/sqlite3',
      }),
    ).toThrow('Android Floriva SQLite database did not contain the daily_logs table.');
  });

  it('uses the host filesystem and process defaults when dependencies are omitted', () => {
    let snapshotDirectory = '';
    mockExecFileSync.mockImplementation((_binary: string, args: string[]) => {
      if (args[0] === 'shell') {
        return Buffer.alloc(0);
      }
      if (args[0] === 'exec-out') {
        return fileNameFromAdbArgs(args) === 'floriva.db'
          ? sqliteBytes('base')
          : Buffer.alloc(0);
      }

      snapshotDirectory = path.dirname(args[0]);
      return Buffer.from('3\n');
    });

    expect(
      queryAndroidDailyLogCount({
        logDate: '2026-06-10',
        sqliteBinary: '/usr/local/bin/sqlite3',
      }),
    ).toBe(3);
    expect(mockExecFileSync).toHaveBeenCalledTimes(5);
    expect(fs.existsSync(snapshotDirectory)).toBe(false);
  });

  it('tolerates only missing SQLite sidecars and rejects missing or invalid base files', () => {
    const tempDir = createFixtureDirectory();
    fixtureDirectories.push(tempDir);

    const missingSidecar = new Error('cat failed') as Error & { stderr?: Buffer };
    missingSidecar.stderr = Buffer.from('No such file or directory');
    const runWithMissingSidecars = (args: string[]) => {
      const fileName = fileNameFromAdbArgs(args);
      if (fileName !== 'floriva.db') {
        throw missingSidecar;
      }
      return sqliteBytes('base');
    };

    expect(() =>
      copyAndroidSqliteDatabase({
        tempDir,
        runAdb: runWithMissingSidecars,
        writeFileSync: fs.writeFileSync,
      }),
    ).not.toThrow();
    expect(fs.existsSync(path.join(tempDir, 'floriva.db'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'floriva.db-wal'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'floriva.db-shm'))).toBe(false);

    const missingBase = new Error('No such file or directory');
    expect(() =>
      copyAndroidSqliteDatabase({
        tempDir,
        runAdb: () => {
          throw missingBase;
        },
        writeFileSync: fs.writeFileSync,
      }),
    ).toThrow(missingBase);

    expect(() =>
      copyAndroidSqliteDatabase({
        tempDir,
        runAdb: () => Buffer.from('not-a-sqlite-database'),
        writeFileSync: fs.writeFileSync,
      }),
    ).toThrow('Android Floriva SQLite database was not readable');
  });

  it('rejects unexpected sidecar copy errors', () => {
    const tempDir = createFixtureDirectory();
    const unexpectedError = new Error('run-as permission denied');
    fixtureDirectories.push(tempDir);

    expect(() =>
      copyAndroidSqliteDatabase({
        tempDir,
        runAdb: (args: string[]) => {
          if (fileNameFromAdbArgs(args) === 'floriva.db') {
            return sqliteBytes('base');
          }
          throw unexpectedError;
        },
        writeFileSync: fs.writeFileSync,
      }),
    ).toThrow(unexpectedError);
  });

  it('quotes apostrophes in the daily-log date query', () => {
    const tempRoot = createFixtureDirectory();
    let executedSql = '';
    fixtureDirectories.push(tempRoot);

    queryAndroidDailyLogCount({
      logDate: "2026-06-10' OR '1'='1",
      runAdb: (args: string[]) =>
        fileNameFromAdbArgs(args) === 'floriva.db' ? sqliteBytes('base') : Buffer.alloc(0),
      execSqlite: (_binary: string, args: string[]) => {
        executedSql = args[1];
        return Buffer.from('0\n');
      },
      fileSystem: fs,
      tempRoot,
      sqliteBinary: 'sqlite3',
    });

    expect(executedSql).toBe(
      "SELECT COUNT(*) FROM daily_logs WHERE log_date = '2026-06-10'' OR ''1''=''1';",
    );
  });

  it('relaunches after every snapshot before returning or retrying', async () => {
    const calls: string[] = [];
    const counts = [0, 1];
    let elapsedMs = 0;

    await expectAndroidDailyLogCount({
      logDate: '2026-06-10',
      expectedCount: 1,
      queryCount: () => {
        calls.push('query');
        return counts.shift();
      },
      relaunch: async () => {
        calls.push('relaunch');
      },
      delay: async (milliseconds: number) => {
        calls.push('delay');
        elapsedMs += milliseconds;
      },
      now: () => elapsedMs,
      timeoutMs: 1_000,
    });

    expect(calls).toEqual(['query', 'relaunch', 'delay', 'query', 'relaunch']);

    const timeoutCalls: string[] = [];
    elapsedMs = 0;
    await expect(
      expectAndroidDailyLogCount({
        logDate: '2026-06-10',
        expectedCount: 1,
        queryCount: () => {
          timeoutCalls.push('query');
          return 0;
        },
        relaunch: async () => {
          timeoutCalls.push('relaunch');
        },
        delay: async (milliseconds: number) => {
          timeoutCalls.push('delay');
          elapsedMs += milliseconds;
        },
        now: () => elapsedMs,
        timeoutMs: 500,
      }),
    ).rejects.toThrow('Expected 1 Android daily log rows for 2026-06-10, found 0.');
    expect(timeoutCalls).toEqual(['query', 'relaunch', 'delay']);
  });

  it('relaunches when a snapshot query throws', async () => {
    const calls: string[] = [];
    const snapshotError = new Error('snapshot failed');

    await expect(
      expectAndroidDailyLogCount({
        logDate: '2026-06-10',
        expectedCount: 1,
        queryCount: () => {
          calls.push('query');
          throw snapshotError;
        },
        relaunch: async () => {
          calls.push('relaunch');
        },
        delay: async () => {
          calls.push('delay');
        },
        now: () => 0,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow(snapshotError);
    expect(calls).toEqual(['query', 'relaunch']);
  });
});
