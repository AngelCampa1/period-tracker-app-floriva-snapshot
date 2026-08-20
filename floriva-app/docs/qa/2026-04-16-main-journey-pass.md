# Main Journey Device QA Pass

Date: 2026-04-16
Branch: `codex/main-journey-qa-pass`

## Scope
- iOS deep journey pass on simulator `iPhone 17`
- Android smoke follow-up on emulator `Pixel_9_API_35`
- Mixed fresh-install and seeded preset coverage
- No Detox and no worktree for this pass

## Journey Coverage
### iOS deep pass
- Fresh install onboarding: welcome, privacy explainer, return path, onboarding continuation into Today
- Core use: Today, logging affordances, Calendar, Insights, Settings
- Sensitive/support presets:
  - `qa-rich-history`
  - `locked-app`
  - `import-ready`
  - `backup-ready`
  - Settings delete-data confirmation

### Android smoke follow-up
- Fresh launch to onboarding
- Minimum onboarding path to Today
- Tab navigation to Calendar and Settings
- `qa-rich-history` seeded launch to Today
- Sensitive settings spot-check: Privacy & lock screen

## Screenshots
- iOS welcome: [ios-onboarding-welcome.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-onboarding-welcome.jpg)
- iOS privacy explainer: [ios-privacy-explainer.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-privacy-explainer.jpg)
- iOS rich Today: [ios-today-rich-history.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-today-rich-history.jpg)
- iOS rich Calendar: [ios-calendar-rich-history.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-calendar-rich-history.jpg)
- iOS rich Insights: [ios-insights-rich-history.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-insights-rich-history.jpg)
- iOS rich Settings: [ios-settings-rich-history.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-settings-rich-history.jpg)
- iOS lock screen: [ios-lock-screen.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-lock-screen.jpg)
- iOS import source selection: [ios-import-source-selection.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-import-source-selection.jpg)
- iOS import review summary: [ios-import-review.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-import-review.jpg)
- iOS backup/restore entry: [ios-backup-restore-entry.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-backup-restore-entry.jpg)
- iOS backup/restore preview: [ios-backup-restore-preview.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-backup-restore-preview.jpg)
- iOS delete-data confirmation: [ios-delete-data-confirmation.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-delete-data-confirmation.jpg)
- iOS pre-fix settings crash: [ios-settings-crash-store-review.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-settings-crash-store-review.jpg)
- Android fresh launch: [android-fresh-launch.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-fresh-launch.png)
- Android onboarding/home: [android-onboarding-or-home.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-onboarding-or-home.png)
- Android Today after onboarding: [android-today-after-onboarding.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-today-after-onboarding.png)
- Android rich Today after fix: [android-qa-rich-history-fixed.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-qa-rich-history-fixed.png)
- Android rich Settings: [android-settings-rich-history.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-settings-rich-history.png)
- Android privacy screen: [android-privacy-lock-rich-history.png](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/android-privacy-lock-rich-history.png)

## Issues
### Fixed
1. Stale iOS CocoaPods references blocked simulator launch.
Impact: iOS journey testing could not begin because the native project still referenced removed `react-native-purchases` / RevenueCat pod files.
Repro: Build the current iOS app before refreshing pods.
Fix: Added a regression test to catch stale removed iOS pod references and refreshed the native pod state with `pod install`.

2. Settings crashed on iOS when review and billing config values were not strings.
Impact: Opening Settings in seeded states could crash with `value.trim is not a function`.
Repro: Launch `qa-rich-history` on iOS and enter Settings before hardening runtime config normalization.
Fix: Hardened runtime string normalization in the review and billing config helpers and added regression tests.

3. Android preview build was out of sync with checked-in app config and billing plugin setup.
Impact: The emulator initially launched a stale `com.anonymous.floriva` build and missed current Android privacy and billing configuration, including the in-app purchase module.
Repro: Install and launch the pre-fix Android app, then inspect package identity and billing module availability.
Fix: Updated Expo config to include `expo-iap`, bumped Android `minSdkVersion` to 24, disabled Android backup explicitly, blocked legacy storage permissions, and regenerated native Android files with Expo prebuild.

4. Android EAS Gradle release-signing script crashed Gradle task configuration.
Impact: `./gradlew :app:tasks --all` and downstream Android build/install work could fail before QA started.
Repro: Run the Android Gradle task listing with the old `tasks.whenTaskAdded` release-signing hook.
Fix: Reworked `/android/app/eas-build.gradle` to use `gradle.projectsEvaluated` and an explicit release signing config reference.

5. Seeded Android QA presets still tried to initialize Play Billing on mount.
Impact: `qa-rich-history` booted with a developer-visible `[Expo-IAP] initConnection failed` error even though the preset only needed local seeded access.
Repro: Launch Android with `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history` before gating the live billing bridge.
Fix: Split seeded QA presets onto a static billing path that preserves seeded access and offerings without mounting the live IAP hook, then added a regression test to assert the live store bridge does not mount for those presets.

6. `import-ready` stopped at source selection instead of opening a seeded import review summary.
Impact: The QA preset could not verify the review-stage journey or capture the expected screenshot.
Repro: Launch iOS with `EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready` before seeding review preview state.
Fix: Added a seeded import preview fixture, routed the preset to `/import/review`, hydrated the review provider from the preset, and captured the fixed simulator state at [ios-import-review.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-import-review.jpg).

7. `backup-ready` stopped at restore entry instead of opening a populated restore preview.
Impact: The QA preset could not verify the restore-preview journey or destructive confirm affordance.
Repro: Launch iOS with `EXPO_PUBLIC_DEV_LAUNCH_PRESET=backup-ready` before seeding restore preview state.
Fix: Added a seeded backup restore fixture, hydrated the restore preview and selected-file state from the preset, and captured the fixed simulator state at [ios-backup-restore-preview.jpg](~/Desktop/floriva/floriva-app/docs/qa/screenshots/2026-04-16-main-journey-pass/ios-backup-restore-preview.jpg).

8. Dev-client simulator launches could still fail on stale optional native modules or stale `app_preferences` columns.
Impact: QA presets could crash before routing when a dev client or database lagged behind the current JS bundle.
Repro: Reload the app in a simulator with an older native module set or pre-0011 `app_preferences` table.
Fix: Added runtime schema repair for `app_preferences`, moved localization and store-review access behind safe native helpers, and made tap-sound playback no-op in dev clients while keeping the rest of the interaction feedback flow alive.

## Verification Log
### Targeted regression checks
- `pnpm jest tests/sanity/ios-native-dependency-sync.test.ts --runInBand`
- `pnpm jest tests/features/review/storeReview.test.ts tests/features/billing/config.test.ts --runInBand`
- `pnpm jest tests/sanity/release-config.test.ts tests/sanity/android-eas-build-script.test.ts --runInBand`
- `pnpm jest tests/features/billing/BillingProvider.test.tsx --runInBand`

### Native and device verification
- `pod install` refreshed the iOS native project and removed stale RevenueCat references
- `./gradlew :app:tasks --all` passed after the Android signing-script fix
- `./gradlew :app:installDebug` passed after the Android config sync and `minSdkVersion` bump
- iOS simulator flows were rerun after each iOS fix
- Android emulator fresh onboarding and `qa-rich-history` were rerun after the Android fixes

### Final verification
- `pnpm typecheck`
  - passed
- `pnpm test:smoke -- --runInBand`
  - passed
  - console-noise warnings from TTC save-error coverage and `@expo/vector-icons` were cleaned up in this pass

## Outcome
- All planned iOS journeys were exercised end to end.
- Android smoke coverage reached onboarding, Today, Calendar, Settings, and Privacy & lock.
- All blocking issues found during this pass were fixed inline.
- `import-ready` and `backup-ready` now both land on their seeded review/preview states.
- Dev-client reloads now tolerate missing optional feedback, localization, and store-review modules without blocking the main app shell.
