# All Issues Found During Release-Pass

Date: 2026-05-05

Latest fix verification: 2026-05-05.

Result after fixes: native build, Metro launch, dependency, and Jest blockers are fixed on `main`. Both platforms now reach Floriva product UI from local debug/dev-client builds. RP-004 remains open because the full 23-product-screenshots-per-OS matrix was not completed in the fix-verification pass.

## Issue Index

| ID | Severity | Area | Summary | Release impact |
|---|---|---|---|---|
| RP-001 | Blocker | iOS native build | iOS simulator build fails in ExpoSQLite | Fixed / verified |
| RP-002 | Blocker | Android dev-client / Metro | Android app cannot load Metro bundle | Fixed / verified |
| RP-003 | High | Jest CI | Routed import-flow test fails | Fixed / verified |
| RP-004 | High | Screenshot coverage | Required 23 screenshots per OS were not captured | Open |
| RP-005 | Medium | iOS dependency setup | ExpoSQLite copied sources missing before `pod install` | Fixed / documented |
| RP-006 | Medium | Android dependency resolution | pnpm realpath lacks nested `metro-runtime` expected by Metro | Fixed / verified |
| RP-007 | Medium | Android runtime | Android showed `Floriva isn't responding` on reload | Not reproduced after Metro fix |
| RP-008 | Low | Expo CLI usage | `expo run:ios --simulator` rejected simulator argument | Fixed in runbook |
| RP-009 | Low | Simulator reset | `simctl erase` failed because simulator was already booted | Fixed in runbook |
| RP-010 | Low | Metro process/port | Existing Expo process occupied port 8081 | Fixed in runbook |
| RP-011 | Low | Watchman | Metro reported repeated Watchman recrawls | Fixed in runbook |

See `fix-verification.md` for commands, screenshots, and updated QA procedure.

## Detailed Issues

### RP-001 - iOS simulator build fails in ExpoSQLite

- Severity: Blocker
- Status: Fixed / verified.
- Platform: iOS Simulator
- Evidence:
  - `logs/ios-xcodebuild.log`
  - `logs/ios-pod-install.log`
  - `logs/ios-xcodebuild-retry.log`
- Expected: `Floriva.app` builds for the iPhone 17 simulator and launches for QA.
- Actual:
  - Initial `xcodebuild` failed because `node_modules/expo-sqlite/ios/sqlite3.c` was missing.
  - After `pod install`, the copied SQLite files existed, but the retry failed compiling `SQLiteModule.swift`.
  - The retry reported missing symbols such as `exsqlite3_open`, `exsqlite3_get_autocommit`, and other `exsqlite3_*` / changeset APIs.
- Impact: No iOS product screens could be opened or screenshotted.
- Fix verification:
  - Expo-compatible native dependencies were installed.
  - `pod install` completed after dependency updates.
  - iOS debug simulator build completed with `** BUILD SUCCEEDED **`.
  - Floriva launched on the iPhone 17 simulator and reached the product welcome screen.
  - Evidence: `fix-verification/ios/screenshots/001-ios-first-floriva-screen.png`.

### RP-002 - Android dev-client cannot load Metro bundle

- Severity: Blocker
- Status: Fixed / verified.
- Platform: Android Emulator
- Evidence:
  - `android/screenshots/003-after-bundle-wait.png`
  - `android/screenshots/005-fresh-metro-retry.png`
  - `android/screenshots/006-symlink-retry.png`
  - `logs/metro-android.log`
  - `logs/metro-android-retry.log`
  - `logs/metro-android-symlink-retry.log`
  - `logs/android-logcat-after-bundle.txt`
  - `logs/android-logcat-fresh-metro-retry.txt`
  - `logs/android-logcat-symlink-retry.txt`
- Expected: Android debug app loads the Expo dev-client bundle and reaches Floriva UI.
- Actual:
  - Android Gradle build and APK install succeeded.
  - Launch reached the Expo dev-launcher error screen.
  - Metro failed with `ENOENT: no such file or directory, open '.../react-native/node_modules/metro-runtime/package.json'`.
  - `pnpm install --frozen-lockfile`, fresh Metro restart, and a node_modules-only symlink repair did not unblock launch.
- Impact: No Android product screens could be opened or screenshotted.
- Fix verification:
  - `floriva-app/.npmrc` now uses `node-linker=hoisted`.
  - Metro resolves through the app root `node_modules` and explicit package aliases.
  - Android Gradle debug build and APK install passed.
  - Metro bundled successfully with no `metro-runtime` or `@radix-ui/react-slot` ENOENT errors.
  - Floriva reached the Android product welcome screen.
  - Evidence: `fix-verification/android/screenshots/003-android-welcome-product-screen.png`.

### RP-003 - Jest CI fails routed import flow

- Severity: High
- Status: Fixed / verified.
- Platform: Test suite
- Evidence:
  - `logs/pnpm-test-ci.log`
- Expected: `pnpm test:ci` passes before release-pass QA.
- Actual:
  - 136 suites passed, 1 suite failed.
  - 985 tests passed, 1 test failed.
  - Failing test: `tests/app/importRoutes.test.tsx`.
  - Failure: `TypeError: (0 , _reactNativeReanimated.useReducedMotion) is not a function`.
- Impact: Breaks required preflight and covers an import-to-tracker/calendar flow.
- Fix verification:
  - Reanimated mocking is centralized in `tests/jest.setup.ts`.
  - Duplicate per-test Reanimated mocks were removed.
  - `pnpm test:ci` passed all 137 suites / 986 tests.

### RP-004 - Required screenshot quota was not met

- Severity: High
- Status: Open.
- Area: QA evidence
- Evidence:
  - `screenshot-manifest.md`
  - `release-pass-summary.md`
- Expected: 23 product screenshots per OS, 46 product screenshots total.
- Actual after fixes:
  - iOS fix-verification product screenshots: `5/23`.
  - Android fix-verification product screenshots: `4/23`.
  - Full product matrix: not complete.
- Impact: Release-pass remains incomplete until 23 product screenshots per OS are captured and the requested click/scroll matrix is rerun.

### RP-005 - ExpoSQLite copied source files missing before CocoaPods repair

- Severity: Medium
- Status: Fixed / documented.
- Platform: iOS
- Evidence:
  - `logs/ios-xcodebuild.log`
  - `logs/ios-pod-install.log`
- Expected: ExpoSQLite pod source files required by the Pods project exist before build.
- Actual:
  - `node_modules/expo-sqlite/ios/sqlite3.c` and `sqlite3.h` were absent before `pod install`.
  - The files existed under `node_modules/expo-sqlite/vendor/sqlite3/`.
  - `pod install` copied them into `node_modules/expo-sqlite/ios/`.
- Impact: Causes a deterministic first iOS build failure on this checkout/dependency state.
- Fix verification: Clean native verification must run cleanup before `pod install`; do not delete `ios/build/generated` after `pod install`, because that removes generated ReactCodegen sources needed by the Pods project.

### RP-006 - pnpm realpath dependency layout does not satisfy Metro's nested lookup

- Severity: Medium
- Status: Fixed / verified.
- Platform: Android / Metro
- Evidence:
  - `logs/metro-android-retry.log`
  - `logs/metro-android-symlink-retry.log`
- Expected: Metro resolves `metro-runtime` from the React Native import stack.
- Actual:
  - `node_modules/react-native/node_modules/metro-runtime/package.json` existed after install.
  - Metro still resolved through the pnpm realpath under `.pnpm/react-native@.../node_modules/react-native/node_modules/metro-runtime/package.json`, where the file was missing.
  - A local symlink repair did not unblock the dev-client bundle.
- Impact: Blocks Android JS bundle loading.
- Fix verification: Metro started and bundled Android through the app root package layout without the previous ENOENT failure.

### RP-007 - Android app can become unresponsive during reload from error screen

- Severity: Medium
- Status: Not reproduced after Metro fix.
- Platform: Android Emulator
- Evidence:
  - `android/screenshots/004-after-metro-repair-reload.png`
  - `logs/android-logcat-after-reload.txt`
- Expected: Reload either succeeds or returns to a stable error state.
- Actual: Android displayed `Floriva isn't responding` with `Close app` and `Wait` actions.
- Impact: Confirms the blocked launch path can degrade into an ANR-style user-visible state.
- Fix verification: Android launched to Floriva UI after the Metro/package fix. No ANR dialog appeared during the verification launch.

### RP-008 - Expo iOS CLI rejected simulator argument

- Severity: Low
- Status: Fixed in runbook.
- Platform: iOS tooling
- Evidence:
  - `logs/ios-pnpm-run.log`
  - `logs/ios-expo-run.log`
- Expected: Local Expo command can target the `iPhone 17` simulator.
- Actual:
  - `pnpm ios -- --simulator "iPhone 17"` failed with `Unknown arguments: --simulator`.
  - `pnpm exec expo run:ios --simulator "iPhone 17"` also failed with `Unknown arguments: --simulator`.
- Impact: Not a product bug, but it prevented the faster Expo launch path and forced use of raw `xcodebuild`.
- Fix verification: Updated QA procedure now uses `pnpm exec expo run:ios --device "iPhone 17"`.

### RP-009 - Simulator erase failed while booted

- Severity: Low
- Status: Fixed in runbook.
- Platform: iOS tooling
- Evidence:
  - Terminal output captured during preflight run, summarized in `preflight.md`
- Expected: Clean simulator state before QA.
- Actual: `xcrun simctl erase` failed with `Unable to erase contents and settings in current state: Booted`.
- Impact: Required fallback to app-level data reset/uninstall strategy for subsequent attempts.
- Fix verification: Updated QA procedure documents shutting down the simulator before erase.

### RP-010 - Existing Metro process occupied port 8081

- Severity: Low
- Status: Fixed in runbook.
- Platform: Local tooling
- Evidence:
  - `logs/metro-android.log`
- Expected: `pnpm start --dev-client --port 8081` starts Metro for the Android pass.
- Actual:
  - Expo reported port 8081 was already running this app in another window.
  - Non-interactive Expo could not ask whether to use port 8082 and skipped starting the dev server.
- Impact: First Android launch attempt used a stale server state and had to be retried after process cleanup.
- Fix verification: Updated QA procedure documents clearing the stale port 8081 process before starting Metro.

### RP-011 - Watchman recrawled the repo repeatedly

- Severity: Low
- Status: Fixed in runbook.
- Platform: Local tooling
- Evidence:
  - `logs/metro-android-retry.log`
- Expected: Metro starts without repeated Watchman recrawl warnings.
- Actual: Metro logged that the watch had recrawled 17 times and recommended `watchman watch-del` / `watchman watch-project`.
- Impact: Does not directly block release, but it can slow or destabilize local bundling and should be cleaned up before another QA pass.
- Fix verification: Updated QA procedure documents `watchman watch-del ~/Code/floriva` followed by `watchman watch-project ~/Code/floriva`.

## Non-Issues / Passed Checks

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- Android Gradle debug build: passed.
- Android APK install: passed.
- Android app data clear: passed.
- Android OS resolver sheet appeared and Floriva could be selected.
