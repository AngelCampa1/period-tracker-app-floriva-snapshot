import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

describe('backup restore native e2e coverage', () => {
  it('commits the seeded backup-ready restore and verifies restored SQLite rows', () => {
    const spec = fs.readFileSync(
      path.join(projectRoot, 'e2e/backup-export.e2e.js'),
      'utf8',
    );

    expect(spec).toContain('backupReadyDescribe');
    expect(spec).toContain('backup-acknowledge-restore-replacement-button');
    expect(spec).toContain('backup-confirm-restore-button');
    expect(spec).toContain('backup-status-card');
    expect(spec).toContain('expectRestoredBackupRows');
    expect(spec).toContain("expectRestoredBackupRows('2026-04-13', 0)");
    expect(spec).toContain("expectRestoredBackupRows('2026-04-03', 1)");
    expect(spec).toContain("expectRestoredBackupRows('2026-04-13', 1)");
    expect(spec).toContain("expectRestoredBackupRows('2026-04-03', 0)");
    expect(spec).toContain('copyAndroidSqliteDatabase');
    expect(spec).toContain('floriva.db-wal');
  });
});
