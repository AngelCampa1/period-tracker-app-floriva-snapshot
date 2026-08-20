import fs from 'node:fs';
import path from 'node:path';

const easBuildGradlePath = path.resolve(
  __dirname,
  '../../android/app/eas-build.gradle',
);
const easConfigPath = path.resolve(__dirname, '../../eas.json');

describe('android EAS build script', () => {
  it('assigns release signing outside tasks.whenTaskAdded', () => {
    if (!fs.existsSync(easBuildGradlePath)) {
      const easConfig = JSON.parse(fs.readFileSync(easConfigPath, 'utf8'));

      expect(easConfig.build?.production?.android?.credentialsSource).toBe('local');
      return;
    }

    const content = fs.readFileSync(easBuildGradlePath, 'utf8');

    expect(content).not.toContain('tasks.whenTaskAdded');
    expect(content).toContain('def credentialsJson');
    expect(content).toContain('signingConfigs.release');
    expect(content).toContain('signingConfig signingConfigs.release');
  });
});
