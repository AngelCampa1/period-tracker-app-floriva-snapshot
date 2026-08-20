# Backup Export Follow-up

Date: 2026-05-06

## Result

Backup export/share handoff is verified after fixing the shared screen tap behavior.

## Root Cause

The backup export form lives inside the shared `Screen` scroll wrapper. With secure text inputs focused, the first tap on `Create backup file` could be consumed as a keyboard/scroll-view handoff instead of reliably reaching the button. This matched the manual Computer Use symptom: matching passphrases enabled the button, but the first tap did not always start export.

## Fix

- `src/components/primitives/Screen.tsx`: changed the shared `ScrollView` from `keyboardShouldPersistTaps="handled"` to `keyboardShouldPersistTaps="always"`.
- `tests/components/Screen.test.tsx`: updated the shared screen expectation.
- `e2e/backup-export.e2e.js`: added focused simulator coverage for the backup export path. The test clears old `.floriva` files, fills matching passphrases, taps export, waits for a new backup file, and captures a screenshot.

## Evidence

- iOS Detox/native simulator:
  - `fix-smoke/detox-ios-backup-export-after-screen-fix/.../backup-export-after-create.png`
  - Fresh file observed in simulator container: `Documents/floriva-backup-2026-05-06.floriva`
  - Native iOS share sheet visible with the `.floriva` file.
- Android ADB/UIAutomator:
  - `fix-smoke/android/backup-export-screen-fix-second-tap.png`
  - `fix-smoke/android/backup-export-screen-fix-second-tap-ui.xml`
  - `fix-smoke/android/backup-export-screen-fix-second-tap-files.txt`
  - `fix-smoke/android/backup-export-screen-fix-second-tap-logcat.txt`
  - Fresh file observed: `files/floriva-backup-2026-05-06.floriva`
  - Android chooser launch observed in logcat from `app.floriva`.
- Android Detox/native emulator:
  - `fix-smoke/detox-android-backup-export-no-launch-url/.../backup-export-after-create.png`
  - Focused test passed after launching the dev client first and opening `floriva://backup/export` after attachment.

## Verification

- `pnpm jest tests/components/Screen.test.tsx tests/features/backup/BackupScreen.test.tsx --runInBand`: pass.
- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test:ci`: pass.
- `pnpm test:coverage:check`: pass.
- `pnpm exec detox test -c ios.sim.debug e2e/backup-export.e2e.js --reuse --no-start --take-screenshots all --record-logs all`: pass after the fix.
- `pnpm exec detox test -c android.emu.debug e2e/backup-export.e2e.js --reuse --no-start --take-screenshots all --record-logs all`: pass after removing the direct Android launch URL from the focused e2e.
- Android manual emulator export: pass via ADB/UIAutomator/file-system/logcat evidence.

## Notes

The first Android Detox attempt exposed two harness issues: the emulator still had stale `com.anonymous.floriva.test` instrumentation installed, and launching the test directly with the backup deep-link URL could strand the run in dev-launcher/chooser task state. Installing the current `app.floriva.test` instrumentation and opening the backup deep link only after the dev client attached fixed the focused Android e2e.
