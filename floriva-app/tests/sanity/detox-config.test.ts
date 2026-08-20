const detoxConfig = require('@/detox.config.js');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

describe('detox config sanity', () => {
  it('can target a specific iOS simulator by UUID for diagnostic reruns', () => {
    const previousDeviceId = process.env.DETOX_IOS_DEVICE_ID;
    process.env.DETOX_IOS_DEVICE_ID = 'TEST-SIMULATOR-UUID';
    jest.resetModules();

    const configWithDeviceId = require('@/detox.config.js');

    expect(configWithDeviceId.devices.simulator.device).toEqual({
      id: 'TEST-SIMULATOR-UUID',
    });

    if (previousDeviceId === undefined) {
      delete process.env.DETOX_IOS_DEVICE_ID;
    } else {
      process.env.DETOX_IOS_DEVICE_ID = previousDeviceId;
    }
    jest.resetModules();
  });

  it('builds only app-owned Android debug artifacts for Detox', () => {
    expect(detoxConfig.apps['android.debug'].build).toContain('app:assembleDebug');
    expect(detoxConfig.apps['android.debug'].build).toContain('app:assembleDebugAndroidTest');
    expect(detoxConfig.apps['android.debug'].build).not.toContain(
      './gradlew assembleDebug assembleAndroidTest',
    );
  });

  it('builds standalone release-candidate screenshot apps without changing production schemes', () => {
    const iosCandidate = detoxConfig.apps['ios.screenshotCandidate'];
    const androidCandidate = detoxConfig.apps['android.screenshotCandidate'];

    expect(iosCandidate.binaryPath).toContain('Release-iphonesimulator/Floriva.app');
    expect(iosCandidate.build).toContain('-scheme Floriva');
    expect(iosCandidate.build).toContain('-configuration Release');
    expect(iosCandidate.build).toContain('FLORIVA_SCREENSHOT_CANDIDATE=1');
    expect(iosCandidate.build).toContain('tenure-12mo-regular');
    expect(iosCandidate.build).toContain('billing-fallback');
    expect(iosCandidate.build).not.toContain('FlorivaStoreKit');

    expect(androidCandidate.binaryPath).toContain('screenshotCandidate');
    expect(androidCandidate.build).toContain('assembleScreenshotCandidate');
    expect(androidCandidate.build).toContain('assembleScreenshotCandidateAndroidTest');
    expect(androidCandidate.build).toContain('FLORIVA_SCREENSHOT_CANDIDATE=1');
    expect(androidCandidate.build).toContain('tenure-12mo-regular');
    expect(androidCandidate.build).toContain('billing-fallback');
  });

  it('exposes standalone screenshot configurations separately from debug dev-client runs', () => {
    expect(detoxConfig.configurations['ios.sim.screenshotCandidate']).toEqual({
      device: 'simulator',
      app: 'ios.screenshotCandidate',
    });
    expect(detoxConfig.configurations['android.emu.screenshotCandidate']).toEqual({
      device: 'emulator',
      app: 'android.screenshotCandidate',
    });
  });

  it('keeps Android Detox instrumentation wired to the Expo dev client', () => {
    const appBuildGradle = fs.readFileSync(
      path.join(projectRoot, 'android/app/build.gradle'),
      'utf8',
    );
    const rootBuildGradle = fs.readFileSync(
      path.join(projectRoot, 'android/build.gradle'),
      'utf8',
    );
    const detoxRunner = fs.readFileSync(
      path.join(
        projectRoot,
        'android/app/src/androidTest/java/app/floriva/DetoxTest.java',
      ),
      'utf8',
    );

    expect(appBuildGradle).toContain(
      'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"',
    );
    expect(appBuildGradle).toContain('testBuildType System.getProperty("testBuildType", "debug")');
    expect(appBuildGradle).toContain("androidTestImplementation(project(':detox'))");
    expect(appBuildGradle).not.toContain('androidTestImplementation("com.wix:detox:+")');
    expect(rootBuildGradle).toContain('../node_modules/detox/Detox-android');
    expect(detoxRunner).toContain('ActivityTestRule<MainActivity>');
    expect(detoxRunner).toContain('getReactHost');
    expect(detoxRunner).toContain('expo.modules.devlauncher.recentyopenedapps');
    expect(detoxRunner).toContain('detoxFlorivaDevServerUrl');
    expect(detoxRunner).toContain('Detox.runTests');
  });

  it('allows the local Detox websocket only in the Android screenshot candidate', () => {
    const candidateManifestPath = path.join(
      projectRoot,
      'android/app/src/screenshotCandidate/AndroidManifest.xml',
    );
    const candidateManifest = fs.existsSync(candidateManifestPath)
      ? fs.readFileSync(candidateManifestPath, 'utf8')
      : '';
    const productionManifest = fs.readFileSync(
      path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );

    expect(candidateManifest).toContain('android:usesCleartextTraffic="true"');
    expect(productionManifest).not.toContain('android:usesCleartextTraffic="true"');
  });
});
