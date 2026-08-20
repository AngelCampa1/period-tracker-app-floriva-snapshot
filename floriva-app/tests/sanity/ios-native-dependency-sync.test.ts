import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '../..');
const iosPodfileLockPath = path.join(appRoot, 'ios/Podfile.lock');
const iosProjectPath = path.join(appRoot, 'ios/Floriva.xcodeproj/project.pbxproj');
const reactNativePurchasesPath = path.join(appRoot, 'node_modules/react-native-purchases');

describe('iOS native dependency sync', () => {
  it('does not keep removed JavaScript dependencies pinned in checked-in iOS native references', () => {
    const hasReactNativePurchasesInstalled = fs.existsSync(reactNativePurchasesPath);
    const nativeArtifacts = [
      fs.readFileSync(iosProjectPath, 'utf8'),
      ...(fs.existsSync(iosPodfileLockPath)
        ? [fs.readFileSync(iosPodfileLockPath, 'utf8')]
        : []),
    ];

    expect(hasReactNativePurchasesInstalled).toBe(false);
    nativeArtifacts.forEach((nativeArtifact) => {
      expect(nativeArtifact).not.toContain('RNPurchases');
      expect(nativeArtifact).not.toContain('../node_modules/react-native-purchases');
      expect(nativeArtifact).not.toContain('RevenueCat');
      expect(nativeArtifact).not.toContain('PurchasesHybridCommon');
    });
  });
});
