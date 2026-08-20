# Release-Pass Fix Verification

Date: 2026-05-05

## Result

The original build, Metro, dependency, and Jest blockers are fixed on `main`. Both platforms now reach Floriva product UI from local debug/dev-client builds.

This was a blocker-fix verification pass, not the full release-pass rerun. The required 23 product screenshots per OS are still incomplete and must be captured before RP-004 can be marked fixed.

## Commands Verified

The top-level `logs/` directory in this QA folder contains original failure evidence from the failed release-pass. The pass statuses below refer to the post-fix verification commands rerun after the fixes on `main`; runtime launch artifacts captured during that pass live under `fix-verification/logs/`.

- `pnpm install --frozen-lockfile`: passed.
- `pnpm exec expo install --check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test:ci`: passed, 137 suites / 986 tests.
- `cd ios && pod install`: passed.
- iOS simulator debug build with `xcodebuild`: passed.
- Android debug build with `./gradlew app:assembleDebug app:assembleDebugAndroidTest --console=plain`: passed.
- Android APK install and app data clear: passed.
- Metro dev-client launch on port 8081: passed for Android and iOS.

## Fixed Blockers

### RP-001 / RP-005 - iOS ExpoSQLite Native Build

Status: fixed and verified.

Fixes applied:

- Updated Expo/native package versions to the Expo-compatible set reported by `expo install --check`.
- Re-ran CocoaPods after dependency updates.
- Preserved CocoaPods-generated codegen output before building. Deleting `ios/build/generated` after `pod install` causes ReactCodegen source references to disappear; the clean sequence is to clean first, then run `pod install`, then build.

Evidence:

- iOS build completed with `** BUILD SUCCEEDED **`.
- iOS product screen captured at `fix-verification/ios/screenshots/001-ios-first-floriva-screen.png`.

### RP-002 / RP-006 / RP-007 / RP-010 / RP-011 - Android Metro Launch

Status: fixed and verified.

Fixes applied:

- Added `floriva-app/.npmrc` with `node-linker=hoisted`.
- Updated `metro.config.js` to resolve packages through the app root `node_modules`.
- Added explicit Metro aliases for `metro-runtime` and `@radix-ui/react-slot` without using blocked package-export subpaths.
- Cleared stale port 8081 and Watchman state before relaunching Metro.

Evidence:

- Android Gradle debug build passed.
- Android app installed and reached Floriva product UI.
- Metro bundled `node_modules/expo-router/entry.js` without `metro-runtime` or `@radix-ui/react-slot` ENOENT errors.
- Android product screen captured at `fix-verification/android/screenshots/003-android-welcome-product-screen.png`.

Known local-dev observation:

- Android dev-client first-run can show the Expo developer menu over the app. Dismiss it before counting product screenshots.
- Android logs still show expected sandbox/dev IAP connection failures on emulator without Play billing configuration. That is not the original Metro blocker.

### RP-003 - Jest Reanimated Mock

Status: fixed and verified.

Fixes applied:

- Centralized the Reanimated mock in `tests/jest.setup.ts`.
- Removed duplicate per-test Reanimated mocks.
- Made app-shell imports tolerant of environments where `useReducedMotion` is absent.

Evidence:

- `pnpm test:ci` passed all suites and tests.

## QA Procedure Updates

Use this sequence for the next full release-pass:

1. Confirm branch and status: `git branch --show-current && git status --short`.
2. Stop stale Metro: `lsof -nP -iTCP:8081 -sTCP:LISTEN` and stop the old process when it belongs to this app.
3. Clean Watchman recrawls: `watchman watch-del ~/Code/floriva || true` then `watchman watch-project ~/Code/floriva`.
4. For iOS data reset, shut down before erase: `xcrun simctl shutdown <device-id>` then `xcrun simctl erase <device-id>`.
5. For iOS clean native verification, clean stale build output before `pod install`; do not remove generated codegen output after `pod install`.
6. Use current Expo iOS syntax: `pnpm exec expo run:ios --device "iPhone 17"`.
7. Use `pnpm exec expo start --dev-client --port 8081 --clear --host lan` for local dev-client QA.
8. For Android emulator deep links, use host `10.0.2.2`, for example `exp+floriva://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081`.

## Screenshot Evidence Captured In This Fix Pass

### iOS

- `fix-verification/ios/screenshots/001-ios-first-floriva-screen.png`
- `fix-verification/ios/screenshots/002-ios-privacy-policy-modal-top.png`
- `fix-verification/ios/screenshots/003-ios-start-path-selector.png`
- `fix-verification/ios/screenshots/004-ios-last-period-start.png`
- `fix-verification/ios/screenshots/005-ios-cycle-length.png`

### Android

- `fix-verification/android/screenshots/001-android-first-floriva-screen.png`
- `fix-verification/android/screenshots/002-android-welcome-after-dev-menu-dismiss.png`
- `fix-verification/android/screenshots/003-android-welcome-product-screen.png`
- `fix-verification/android/screenshots/004-android-start-path-selector.png`

## Remaining Release-Pass Gap

RP-004 remains open. The app is no longer blocked from the 23-screenshot-per-OS product QA matrix, but the full matrix has not yet been completed in this fix pass.
