# Floriva Dual-Platform Release-Pass Summary

Date: 2026-05-05

## Result

Original release-pass failed because the requested full E2E sweep could not enter the Floriva product UI on either platform.

Fix verification on 2026-05-05 unblocked both platforms:

- iOS: local simulator debug build now succeeds and reaches Floriva UI.
- Android: debug APK builds, installs, loads Metro, and reaches Floriva UI.
- Preflight: `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` pass.

Release-pass status remains incomplete because the full 23-product-screenshots-per-OS matrix has not yet been rerun after the blocker fixes.

## Environment

- Repo: `~/Code/floriva`
- App: `~/Code/floriva/floriva-app`
- iOS target attempted: `iPhone 17` simulator, iOS 26.4 runtime
- Android target attempted: `Pixel_9_API_35`, serial `emulator-5554`, 1080x2424 viewport
- Bundle/package id checked from config: `app.floriva`
- App version/build checked from config: `1.0.0`, iOS build `9`

Full environment details are in `preflight.md`.

## Verification Commands

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test:ci`: passed after Reanimated mock fixes
- iOS `xcodebuild` debug simulator build: passed after dependency/CocoaPods repair
- `pod install`: passed
- Android Gradle debug build: passed
- Android APK install and app data clear: passed
- Android dev-client Metro launch: passed after pnpm/Metro resolver repair

## Screenshot Evidence

Expected screenshot quota: 23 screenshots per OS, 46 total product screenshots.

Original product screenshot coverage:

- iOS: 0/23 product screenshots captured because the app did not build.
- Android: 0/23 product screenshots captured because the app could not load the Metro bundle.
- Android blocker evidence: 6 extra OS/dev-launcher screenshots captured.

Fix-verification product screenshot coverage:

- iOS: 5/23 product screenshots captured.
- Android: 4/23 product screenshots captured.
- Full release-pass quota: still open.

Android blocker screenshots were captured during the original failed pass because Android reached visible launch/error states:

- `android/screenshots/001-launch.png`: Android resolver sheet for Floriva deep link.
- `android/screenshots/002-after-link-always.png`: Bundle loading screen.
- `android/screenshots/003-after-bundle-wait.png`: Dev-launcher project load error.
- `android/screenshots/004-after-metro-repair-reload.png`: Error screen plus Android not-responding dialog.
- `android/screenshots/005-fresh-metro-retry.png`: Fresh Metro retry still failing.
- `android/screenshots/006-symlink-retry.png`: Final symlink repair retry still failing.

Fix-verification screenshots are under `fix-verification/`.

See `screenshot-manifest.md` for the full 23-per-OS expected screenshot matrix.

## Bugs

See `bugs.md` for the release-blocking bug ledger:

- `RP-001`: iOS debug simulator build fails in ExpoSQLite.
- `RP-002`: Android dev-client launch fails to load Metro bundle.
- `RP-003`: Jest CI fails routed import flow.

See `all-issues-found.md` for the complete issue register, including lower-severity environment/tooling issues found during the pass.

## Release Recommendation

Do not release yet. The original blocker bugs are fixed, but RP-004 is still open until the full 23-screenshot-per-OS product matrix and click/scroll release-pass are completed on the now-working builds.
