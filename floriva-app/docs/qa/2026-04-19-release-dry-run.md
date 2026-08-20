# Release Dry-Run

Date: 2026-04-19
Branch: `main`

## Scope
- Manual simulator QA on the live `main` workspace with no worktree
- Real user-style onboarding, seeded-flow, privacy, settings, import, and restore checks
- Inline fix-and-verify loop for issues found during the pass
- Screenshot capture for QA evidence
- No Detox

## Devices
- iOS simulator: `iPhone 17`
- Android emulator: `Pixel_9_API_35`

## Automated Verification
- `pnpm lint`
  - passed
- `pnpm typecheck`
  - passed
- `pnpm test:ci`
  - passed
- `pnpm test:coverage`
  - passed
- Targeted regression reruns after fixes:
  - `pnpm jest tests/features/settings/SettingsScreen.test.tsx tests/features/backup/BackupScreen.test.tsx --runInBand`
  - passed

## Manual Coverage
### iOS simulator
- Fresh onboarding to Today
- Settings hub and `Privacy & lock`
- `import-ready` seeded import review
- `backup-ready` seeded restore preview
- Visual review for safe areas, copy rendering, and lower-screen affordances

### Android emulator
- Fresh onboarding to Today
- Settings hub after onboarding
- `qa-rich-history` seeded Today state
- `qa-rich-history` seeded Settings state
- Visual review for floating dock overlap, lower-screen reachability, and seeded render stability

## Screenshots
- iOS settings after fixes: [ios-settings-fixed.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/ios-settings-fixed.png)
- iOS import review: [ios-import-ready.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/ios-import-ready.png)
- iOS backup restore preview after fix: [ios-backup-ready-fixed.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/ios-backup-ready-fixed.png)
- Android welcome: [android-current-welcome.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/android-current-welcome.png)
- Android Today after onboarding: [android-today-after-onboarding.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/android-today-after-onboarding.png)
- Android Settings after onboarding fix: [android-settings-fresh-fixed.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/android-settings-fresh-fixed.png)
- Android seeded Today: [android-qa-rich-history-rendered.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/android-qa-rich-history-rendered.png)
- Android seeded Settings after fix: [android-settings-rich-history-fixed.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-19-release-dry-run/android-settings-rich-history-fixed.png)

## Issues Found And Fixed
1. Privacy relock helper copy rendered the placeholder token instead of the localized duration.
Impact: `Privacy & lock` showed `Floriva relocks after {duration} away from the app.` instead of real copy.
Fix: `SettingsPrivacyLockScreen` now resolves the selected duration label before passing it into the localized helper string, with a regression test covering the rendered text.

2. The Settings hub could scroll under the floating tab dock.
Impact: lower Settings sections were visually clipped and looked partially hidden, especially on Android.
Fix: the Settings hub now reserves tab-bar space and has a regression test that asserts the extra bottom padding contract.

3. The `backup-ready` preset no longer opened on a populated restore preview.
Impact: restore dry-run QA regressed back to the file-selection entry state and could not verify the seeded confirm-restore path.
Fix: `BackupScreen` now hydrates the `backup-ready` dev preset with a selected file label and restore preview, with a regression test covering the seeded state.

## Release Dry-Run Status
- App-side issues found in the simulator pass were fixed and re-verified.
- The current QA evidence set exists under `docs/qa/screenshots/2026-04-19-release-dry-run/`.
- The store-submission screenshot set is not complete yet because the required preview-build capture pass has not happened.

## Remaining Blockers
- The checked-in release path still does not have real App Store / Play product IDs or a configured App Store Connect submission identifier for the production submission path.
- Preview and production billing validation still depend on real `EXPO_PUBLIC_IOS_*` and `EXPO_PUBLIC_ANDROID_*` product IDs being configured for the release environment contract in `release-operations.md`.
- Because those store identifiers are not configured in the checked-in release path, purchase, restore, manage-subscription, and final paywall verification in preview builds remain blocked.
- Floriva is not yet ready for App Store submission until those external billing and submission values are populated and the preview-build screenshot and store-flow pass is rerun.
