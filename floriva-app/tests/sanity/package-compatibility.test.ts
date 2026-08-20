const packageJson = require('@/package.json');

describe('package compatibility', () => {
  it('keeps expo-sqlite on the Expo SDK 54 compatible line', () => {
    expect(packageJson.dependencies.expo).toBe('~54.0.34');
    expect(packageJson.dependencies['expo-sqlite']).toBe('~16.0.10');
  });

  it('installs the native expo-audio peer dependency needed outside Expo Go', () => {
    expect(packageJson.dependencies['expo-audio']).toBeDefined();
    expect(packageJson.dependencies['expo-asset']).toBeDefined();
  });

  it('keeps the CI test script compatible with forwarded Jest flags', () => {
    expect(packageJson.scripts['test:ci']).not.toContain('--runInBand');
  });
});
