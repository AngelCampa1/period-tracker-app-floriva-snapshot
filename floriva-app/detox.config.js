const iosDeviceType = process.env.DETOX_IOS_DEVICE ?? 'iPhone 17';
const iosDeviceId = process.env.DETOX_IOS_DEVICE_ID;
const iosDestination = process.env.DETOX_IOS_DESTINATION
  ?? (iosDeviceId
    ? `platform=iOS Simulator,id=${iosDeviceId}`
    : `platform=iOS Simulator,name=${iosDeviceType}`);
const androidAvdName = process.env.DETOX_ANDROID_AVD ?? 'Pixel_9_API_35';
const expoDevServerPort = Number(process.env.EXPO_DEV_SERVER_PORT ?? '8081');
const iosProjectArg =
  '[ -d ios/Floriva.xcworkspace ] || [ -f ios/Floriva.xcworkspace ]'
  + " && echo '-workspace ios/Floriva.xcworkspace'"
  + " || echo '-project ios/Floriva.xcodeproj'";
const validateScreenshotPreset =
  'case "$EXPO_PUBLIC_DEV_LAUNCH_PRESET" in qa-rich-history|tenure-12mo-regular|import-ready|billing-fallback) ;; '
  + "*) echo 'Set EXPO_PUBLIC_DEV_LAUNCH_PRESET to qa-rich-history, tenure-12mo-regular, import-ready, or billing-fallback.' >&2; exit 1 ;; esac";

/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Floriva.app',
      build:
        `if [ ! -d ios ]; then pnpm prebuild; fi && export RCT_NO_LAUNCH_PACKAGER=true && xcodebuild $( ${iosProjectArg} ) -scheme Floriva -configuration Debug -sdk iphonesimulator -destination "${iosDestination}" -derivedDataPath ios/build`,
    },
    'ios.screenshotCandidate': {
      type: 'ios.app',
      binaryPath:
        'ios/build-screenshots/Build/Products/Release-iphonesimulator/Floriva.app',
      build:
        `${validateScreenshotPreset} && if [ ! -d ios ]; then pnpm prebuild; fi`
        + ' && export RCT_NO_LAUNCH_PACKAGER=true FLORIVA_SCREENSHOT_CANDIDATE=1'
        + ` && xcodebuild $( ${iosProjectArg} ) -scheme Floriva -configuration Release`
        + ` -sdk iphonesimulator -destination "${iosDestination}"`
        + ' -derivedDataPath ios/build-screenshots CODE_SIGNING_ALLOWED=NO',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'if [ ! -d android ]; then pnpm prebuild; fi && cd android && ./gradlew app:assembleDebug app:assembleDebugAndroidTest -DtestBuildType=debug',
      reversePorts: [expoDevServerPort],
    },
    'android.screenshotCandidate': {
      type: 'android.apk',
      binaryPath:
        'android/app/build/outputs/apk/screenshotCandidate/app-screenshotCandidate.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/screenshotCandidate/app-screenshotCandidate-androidTest.apk',
      build:
        `${validateScreenshotPreset} && if [ ! -d android ]; then pnpm prebuild; fi`
        + ' && cd android && export FLORIVA_SCREENSHOT_CANDIDATE=1'
        + ' && ./gradlew app:assembleScreenshotCandidate'
        + ' app:assembleScreenshotCandidateAndroidTest -DtestBuildType=screenshotCandidate',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: iosDeviceId ? { id: iosDeviceId } : { type: iosDeviceType },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: androidAvdName,
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'ios.sim.screenshotCandidate': {
      device: 'simulator',
      app: 'ios.screenshotCandidate',
    },
    'android.emu.screenshotCandidate': {
      device: 'emulator',
      app: 'android.screenshotCandidate',
    },
  },
};
