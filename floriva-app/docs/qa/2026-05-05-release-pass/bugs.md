# Floriva Release-Pass Bug Ledger

Date: 2026-05-05

## Release Recommendation

Do not release yet. The original native, Metro, and Jest blockers are fixed, but the full dual-platform 23-screenshot-per-OS product release-pass still needs to be rerun.

## Bugs Found

### RP-001 - iOS debug simulator build fails in ExpoSQLite

- Platform: iOS Simulator
- Severity: Blocker
- Status: Fixed / verified
- Area: Native build / ExpoSQLite
- Evidence:
  - `logs/ios-xcodebuild.log`
  - `logs/ios-pod-install.log`
  - `logs/ios-xcodebuild-retry.log`
- Reproduction:
  1. Boot `iPhone 17` simulator.
  2. Run a local debug build with `xcodebuild -workspace ios/Floriva.xcworkspace -scheme Floriva -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,id=2B9F547F-E6A8-409B-85EE-968CBA23DE20' -derivedDataPath ios/build`.
  3. Observe build failure.
  4. Run `pod install` in `ios/` to restore the missing ExpoSQLite copied sources.
  5. Retry the same Xcode build.
- Expected: `Floriva.app` builds, installs, and launches on the iOS simulator for E2E QA.
- Actual:
  - First build failed because `node_modules/expo-sqlite/ios/sqlite3.c` was missing.
  - After `pod install`, the copied SQLite source files existed, but the build failed compiling `SQLiteModule.swift`.
  - The retry produced many errors like `cannot find 'exsqlite3_open' in scope`, `cannot find 'exsqlite3_get_autocommit' in scope`, and other missing `exsqlite3_*`/changeset symbols.
- Release impact: Blocks all iOS simulator QA and blocks local iOS debug build confidence.
- Fix verification:
  - iOS debug simulator build now succeeds.
  - Floriva launches on the iPhone 17 simulator and reaches product UI.
  - Evidence: `fix-verification/ios/screenshots/001-ios-first-floriva-screen.png`.

### RP-002 - Android dev-client launch fails to load Metro bundle

- Platform: Android Emulator
- Severity: Blocker
- Status: Fixed / verified
- Area: Dev-client launch / Metro / pnpm dependency resolution
- Evidence:
  - `android/screenshots/001-launch.png`
  - `android/screenshots/002-after-link-always.png`
  - `android/screenshots/003-after-bundle-wait.png`
  - `android/screenshots/004-after-metro-repair-reload.png`
  - `android/screenshots/005-fresh-metro-retry.png`
  - `android/screenshots/006-symlink-retry.png`
  - `logs/android-gradle-build.log`
  - `logs/metro-android.log`
  - `logs/metro-android-retry.log`
  - `logs/metro-android-symlink-retry.log`
  - `logs/android-logcat-after-bundle.txt`
  - `logs/android-logcat-fresh-metro-retry.txt`
  - `logs/android-logcat-symlink-retry.txt`
- Reproduction:
  1. Boot `Pixel_9_API_35` emulator.
  2. Run `cd android && ./gradlew app:assembleDebug app:assembleDebugAndroidTest -DtestBuildType=debug`.
  3. Install `android/app/build/outputs/apk/debug/app-debug.apk`.
  4. Clear app data.
  5. Start Metro with `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history pnpm start --dev-client --port 8081`.
  6. Open `exp+floriva://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081&disableOnboarding=1`.
  7. Choose Floriva in the Android resolver sheet.
- Expected: Floriva loads the Metro bundle and reaches either the QA-seeded app shell or onboarding entry.
- Actual:
  - Android build and install succeeded.
  - The app reached the Expo dev-launcher but failed with `There was a problem loading the project.`
  - Metro failed with `ENOENT: no such file or directory, open '.../react-native/node_modules/metro-runtime/package.json'`.
  - A `pnpm install --frozen-lockfile`, Metro restart, and local node_modules-only symlink repair did not unblock launch.
  - One reload attempt also produced the OS dialog `Floriva isn't responding`.
- Release impact: Blocks all Android product UI QA. The APK can be built, but the local debug/dev-client path cannot load the JS bundle.
- Fix verification:
  - Android debug APK builds and installs.
  - Metro bundles the app without the previous `metro-runtime` / `@radix-ui/react-slot` ENOENT errors.
  - Floriva reaches Android product UI.
  - Evidence: `fix-verification/android/screenshots/003-android-welcome-product-screen.png`.

### RP-003 - Jest CI fails routed import flow

- Platform: Test suite
- Severity: High
- Status: Fixed / verified
- Area: Jest / routed app integration
- Evidence:
  - `logs/pnpm-test-ci.log`
- Reproduction:
  1. Run `pnpm test:ci`.
- Expected: All CI tests pass before release-pass QA.
- Actual: 1 test failed, 985 passed. Failing test:
  - `tests/app/importRoutes.test.tsx`
  - `import routes › commits manual history through the routed app flow and shows it in tracker and calendar`
  - Error: `TypeError: (0 , _reactNativeReanimated.useReducedMotion) is not a function`
- Release impact: The failure is not the same as the native launch blockers, but it breaks the required preflight CI baseline and covers an import-to-tracker/calendar route that is strategically important for Floriva.
- Fix verification:
  - Reanimated mocking is centralized in `tests/jest.setup.ts`.
  - `pnpm test:ci` now passes all suites and tests.

## Remaining Not Covered In Fix Verification

- Full 23-product-screenshots-per-OS matrix.
- Full click/scroll sweep across onboarding, app shell, tabs, settings, backup/import/export, subscription, lock, permission dialogs, purchase/restore flows, and delete-data confirmation.
