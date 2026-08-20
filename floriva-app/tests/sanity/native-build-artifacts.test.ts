import { execFileSync } from 'node:child_process';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '../..');

describe('native build artifacts', () => {
  it('does not track generated native build outputs', () => {
    const trackedBuildFiles = execFileSync(
      'git',
      ['ls-files', 'ios/build*', 'android/build', 'android/app/build'],
      {
        cwd: appRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 8,
      },
    )
      .split('\n')
      .filter(Boolean);

    expect(trackedBuildFiles).toEqual([]);
  });
});
