# Android API 36 readiness QA — 2026-07-22

## Outcome

The locally built Floriva Android debug candidate passed the automated regression gates and required Android 16/API 36 phone and tablet runtime checks. No blocking crash, broken navigation, inaccessible control, privacy/data-flow failure, or severe large-screen layout failure remains.

Status: **ready at the debug-candidate QA stage. The prior reminder-diagnostics and SQLite-probe follow-up findings are closed; remaining non-blocking warnings are recorded below.**

## Scope and non-goals

This pass verifies the API 36 configuration introduced by commit `75acff7e50dbf8fae51ba12cd0181d77ee07e613` and exercises a local debug candidate on Android 16 phone and tablet AVDs. It covers automated checks, debug assembly, APK manifest inspection, core navigation, reminders/notification routing, billing gates without a real purchase, biometric lock, import, backup export/share handoff, delete-all-data, and large-screen portrait/landscape behavior.

This pass did not upgrade dependencies, change the API 36 configuration, add a restricted-resizability compatibility property, create a signed AAB, bump an app/build version, upload an artifact, start a rollout, or deploy anything.

## Exact tracked changes under test

Commit `75acff7e50dbf8fae51ba12cd0181d77ee07e613` (`chore(android): target API 36`) changed:

- `android/gradle.properties`
- `app.config.ts`
- `docs/phase-4-launch-collateral/store-submission-runbook.md`
- `tests/sanity/release-config.test.ts`

Runtime QA also found and fixed a host-side delete-data verification defect: the Android E2E probe copied only `floriva.db` while SQLite still had active WAL/SHM files. Commit `a236717` (`test(android): quiesce delete-data database probe`) adds a quiesced, fail-closed probe in:

- `e2e/delete-all-data.e2e.js`
- `tests/sanity/delete-all-data-e2e.test.ts`

The initial API 36 runtime pass changed only host-side E2E verification code; no production application code changed in that initial pass.

Follow-up verification fixed the reminder diagnostic reconciliation race in commit `6970b6e` (`fix(reminders): refresh diagnostics after reconciliation`). The settings screen now advances a component-local reconciliation revision only after `refreshReminderSchedules()` succeeds, and the dev-only scheduled-notification diagnostic effect rereads the native schedule when that revision changes. The regression test holds reconciliation pending, verifies the interim billing-only snapshot, then verifies a later diagnostic read and the reconciled user-reminder snapshot after the promise resolves.

Commit `329a143` (`test(android): behaviorally verify SQLite probe`) then extracted the host-only Android SQLite snapshot logic into `e2e/helpers/androidSqliteProbe.js` and added seven direct behavioral helper tests plus a separate suite-wiring sanity test. Those tests exercise force-stop/copy/query ordering, base/WAL/SHM contents, missing-sidecar tolerance, fail-closed base and unexpected-copy errors, SQL escaping and missing-table diagnostics, temporary-directory cleanup, relaunch on success and error, and retry only after relaunch. Direct helper coverage reached 100% statements, 100% functions, and 100% lines. The production app API remained unchanged by this test-quality fix.

## Automated verification

The Task 3 gate and build commands below ran from `floriva-app` and exited `0` on the final worktree state. The behavioral helper-coverage row retains reviewed Task 2 evidence for the former test-quality finding.

| Command | Result |
| --- | --- |
| `corepack pnpm lint` | Pass; 0 lint errors |
| `corepack pnpm typecheck` | Pass; 0 TypeScript errors |
| `corepack pnpm test:ci --runInBand` | Pass; 274 suites, 4,400 tests, 0 snapshots |
| `corepack pnpm test:coverage:check` | Pass; 274 suites, 4,400 tests; 98.82% statements, 90.62% branches, 99.74% functions, 98.84% lines |
| `corepack pnpm android:qa:debug-build` | Pass; `BUILD SUCCESSFUL` in 3m27s; 575 actionable tasks (558 executed, 17 up-to-date) |
| `corepack pnpm test:ci --runInBand tests/sanity/delete-all-data-e2e.test.ts` | Pass after the WAL-safe probe fix; 1 suite, 1 test |
| `corepack pnpm exec jest --ci --runInBand tests/e2e/androidSqliteProbe.test.ts --coverage --collectCoverageFrom=e2e/helpers/androidSqliteProbe.js --coverageReporters=text --coverageThreshold='{"global":{"lines":95,"statements":95,"functions":95}}'` | Pass in Task 2; 1 suite, 7 behavioral tests; 100% statements, functions, and lines |
| `corepack pnpm test:ci --runInBand tests/sanity/release-config.test.ts tests/sanity/phase4-launch-collateral.test.ts tests/e2e/androidSqliteProbe.test.ts tests/sanity/delete-all-data-e2e.test.ts` | Pass; 4 suites, 37 tests, 0 snapshots |

The required full test and coverage commands were run again after the initial E2E probe correction. Independent review then hardened the probe to force-stop the app before copying and fail closed on unexpected sidecar errors; the focused sanity test, lint, JavaScript syntax check, and full 2/2 delete-data Detox scenario passed after that hardening. Follow-up Task 3 verification reran lint, typecheck, all 274 Jest suites, coverage, and the local Android debug/instrumentation build against commits `6970b6e` and `329a143`. Existing non-failing test output included Expo Go remote-notification warnings and React `act(...)` warnings; runtime testing used the development build rather than Expo Go.

## Reproduction commands

The commands below are the exact command shapes used for this QA pass. `QA_DIR` was `/tmp/floriva-api36-qa-20260722.3MOS6A`; each Detox scenario had Metro running separately with the matching preset variables.

### APK inspection

```bash
APK=android/app/build/outputs/apk/debug/app-debug.apk
apkanalyzer manifest application-id "$APK"
apkanalyzer manifest version-name "$APK"
apkanalyzer manifest version-code "$APK"
apkanalyzer manifest min-sdk "$APK"
apkanalyzer manifest target-sdk "$APK"
shasum -a 256 \
  android/app/build/outputs/apk/debug/app-debug.apk \
  android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
```

### API 36 image, AVDs, and runtime identity

```bash
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
sdkmanager --install "system-images;android-36;google_apis_playstore;arm64-v8a"
echo no | avdmanager create avd --name Pixel_9_API_36 --package "system-images;android-36;google_apis_playstore;arm64-v8a" --device pixel_9
echo no | avdmanager create avd --name Pixel_Tablet_API_36 --package "system-images;android-36;google_apis_playstore;arm64-v8a" --device pixel_tablet
avdmanager list avd
sdkmanager --list_installed
```

Each emulator was started by substituting the required AVD name:

```bash
emulator -avd Pixel_9_API_36 -no-snapshot -no-boot-anim -gpu swiftshader_indirect -no-audio -no-window
emulator -avd Pixel_Tablet_API_36 -no-snapshot -no-boot-anim -gpu swiftshader_indirect -no-audio -no-window
adb wait-for-device
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.model
adb shell wm size
adb shell wm density
```

### Phone Detox scenarios

```bash
DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
  corepack pnpm exec detox test -c android.emu.debug e2e/paywall-enforcement.e2e.js --reuse --loglevel info --artifacts-location "$QA_DIR/phone-paywall"

DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS=1 \
  corepack pnpm exec detox test -c android.emu.debug e2e/reminder-scheduling.e2e.js --reuse --loglevel info

DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
  corepack pnpm exec detox test -c android.emu.debug e2e/android-import-picker.e2e.js --reuse --loglevel info --artifacts-location "$QA_DIR/phone-import"

DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
  corepack pnpm exec detox test -c android.emu.debug e2e/backup-export.e2e.js --reuse --loglevel info --artifacts-location "$QA_DIR/phone-backup"

DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
  corepack pnpm exec detox test -c android.emu.debug e2e/delete-all-data.e2e.js --reuse --loglevel info
```

### Phone manual checks

Metro launch variants used for the date-anchored reminder, expired-trial paywall, and biometric checks were:

```bash
EXPO_PUBLIC_DEV_LAUNCH_PRESET=tenure-12mo-regular EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success corepack pnpm exec expo start --dev-client --port 8081 --host localhost
EXPO_PUBLIC_DEV_LAUNCH_PRESET=grandfathered-expired EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success corepack pnpm exec expo start --dev-client --port 8081 --host localhost
EXPO_PUBLIC_DEV_LAUNCH_PRESET=locked-app corepack pnpm exec expo start --dev-client --port 8081 --host localhost
```

The debug candidate was installed and connected to Metro with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell pm grant app.floriva android.permission.POST_NOTIFICATIONS
adb shell am start -a android.intent.action.VIEW -d 'floriva://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' app.floriva
```

Navigation, system back, reminder alarms, notification entry, and runtime errors were checked with:

```bash
adb shell am start -a android.intent.action.VIEW -d 'floriva:///calendar/day/2026-07-22?disableOnboarding=1' app.floriva
adb shell input keyevent KEYCODE_BACK
adb shell am start -a android.intent.action.VIEW -d 'floriva:///settings/reminders?disableOnboarding=1' app.floriva
adb shell input keyevent KEYCODE_BACK
adb shell dumpsys alarm | rg 'app\.floriva|reminder-'
adb shell run-as app.floriva am broadcast --user 0 -a expo.modules.notifications.NOTIFICATION_EVENT -d 'expo-notifications://notifications/scheduled/reminder-period-start/trigger' -n app.floriva/expo.modules.notifications.service.NotificationsService --es type trigger --es identifier reminder-period-start
adb shell cmd statusbar expand-notifications
adb exec-out screencap -p > "$QA_DIR/phone-notification-shade.png"
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:E '*:S'
```

Biometric QA used a disposable uncommitted `QA_PIN`, Android's enrollment screen, and the emulator fingerprint command:

```bash
adb shell locksettings set-pin "$QA_PIN"
adb shell am start -a android.settings.FINGERPRINT_ENROLL
adb emu finger touch 1
```

### Tablet rotation, routes, and evidence

The same installed APK and Metro launch command were used on `Pixel_Tablet_API_36`. Rotation, route checks, screenshot/UI capture, dimension checks, and the error filter used:

```bash
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
adb shell am start -a android.intent.action.VIEW -d 'floriva:///?disableOnboarding=1' app.floriva
adb shell am start -a android.intent.action.VIEW -d 'floriva:///calendar?disableOnboarding=1' app.floriva
adb shell am start -a android.intent.action.VIEW -d 'floriva:///calendar/day/2026-07-22?disableOnboarding=1' app.floriva
adb shell am start -a android.intent.action.VIEW -d 'floriva:///settings?disableOnboarding=1' app.floriva
adb exec-out uiautomator dump /dev/tty > "$QA_DIR/tablet-portrait-settings.xml"
adb exec-out screencap -p > "$QA_DIR/tablet-portrait-settings.png"

adb shell settings put system user_rotation 0
adb exec-out uiautomator dump /dev/tty > "$QA_DIR/tablet-landscape-settings.xml"
adb exec-out screencap -p > "$QA_DIR/tablet-landscape-settings.png"
adb shell wm size
adb shell wm density
sips -g pixelWidth -g pixelHeight "$QA_DIR/tablet-portrait-settings.png"
sips -g pixelWidth -g pixelHeight "$QA_DIR/tablet-landscape-paywall.png"
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:E '*:S'
```

The UI-dump and screenshot pair above was repeated immediately after each Today, Calendar, calendar-day logging, Settings, and paywall navigation, using the matching `tablet-portrait-*` or `tablet-landscape-*` evidence filename listed in the matrix below.

The expired-trial paywall used Metro with `EXPO_PUBLIC_DEV_LAUNCH_PRESET=grandfathered-expired` and `EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success`. Landscape CTA reachability was verified with:

```bash
adb shell pm clear app.floriva
adb reverse tcp:8081 tcp:8081
adb shell pm grant app.floriva android.permission.POST_NOTIFICATIONS
adb shell am start -a android.intent.action.VIEW -d 'floriva://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' app.floriva
adb exec-out uiautomator dump /dev/tty > "$QA_DIR/tablet-portrait-paywall.xml"
adb exec-out screencap -p > "$QA_DIR/tablet-portrait-paywall.png"
adb shell settings put system user_rotation 0
adb exec-out uiautomator dump /dev/tty > "$QA_DIR/tablet-landscape-paywall.xml"
adb exec-out screencap -p > "$QA_DIR/tablet-landscape-paywall.png"
adb shell input swipe 1280 1350 1280 350 500
adb exec-out uiautomator dump /dev/tty > "$QA_DIR/tablet-landscape-paywall-scrolled.xml"
adb exec-out screencap -p > "$QA_DIR/tablet-landscape-paywall-scrolled.png"
rg -o 'resource-id="billing-purchase-selected-button"|text="Choose annual plan"' "$QA_DIR/tablet-landscape-paywall-scrolled.xml"
```

## Resolved Android toolchain and APK values

Gradle configuration/build output resolved:

| Value | Resolved value |
| --- | --- |
| Build Tools | `36.0.0` |
| Compile SDK | `36` |
| Target SDK | `36` |
| Min SDK | `24` |
| Kotlin | `2.1.20` |
| KSP | `2.1.20-2.0.1` |
| NDK | `27.1.12297006` |

`apkanalyzer` inspection of the rebuilt `android/app/build/outputs/apk/debug/app-debug.apk` reported package `app.floriva`, version name `1.2.1`, version code `20`, min SDK `24`, and target SDK `36`.

- Debug APK size: 223,746,500 bytes (213 MiB)
- Debug APK SHA-256: `4dd2ea3232bf4c8078d71b54bc181706a02b6362f983ccc37a5ae514dd9b447d`
- Android test APK size: 3,592,072 bytes (3.4 MiB)
- Android test APK SHA-256: `bb1c8f82ddc474ce6c0f09aa4fc7db6b5c1f3a56d4ff2bff96a079ca6aaf726e`

## API 36 devices

The required `system-images;android-36;google_apis_playstore;arm64-v8a` image (revision 7) was installed. Emulator version was `36.5.10`.

| AVD | Definition | Runtime |
| --- | --- | --- |
| `Pixel_9_API_36` | device `pixel_9`; 1080x2424; density 420; arm64; Android 36 Google APIs Play Store image | Android 16, SDK 36, model `sdk_gphone64_arm64` |
| `Pixel_Tablet_API_36` | device `pixel_tablet`; 2560x1600; density 320; arm64; Android 36 Google APIs Play Store image | Android 16, SDK 36, model `sdk_gphone64_arm64` |

Both AVDs were newly created with the required names and definitions; no existing conflicting AVD was overwritten.

## Phone scenario matrix

Evidence root: `/tmp/floriva-api36-qa-20260722.3MOS6A`.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Cold launch and mandatory onboarding paywall | Pass, not blocking | Detox paywall suite: 1 passed, 1 intentionally skipped; `phone-paywall/.../android-onboarding-paywall-mandatory.png` |
| Today, tabs, nested Calendar day, Settings, Android system back | Pass, not blocking | `phone-today.png`, `phone-calendar.png`, `phone-calendar-day.png`, `phone-calendar-after-system-back.png`, `phone-settings.png`, `phone-settings-after-system-back.png` |
| Reminders and native scheduling | Pass, not blocking | Follow-up Detox: 4/4 passed after the post-reconciliation diagnostic refresh fix. The original date-anchored manual reconciliation evidence remains valid and showed four active user reminders matching app preferences and native alarms; `phone-reminders.png`, `phone-reminders-reconciled.png` |
| Native notification entry and tap routing | Pass, not blocking | Notification used privacy-safe copy on channel `floriva-reminders`; tapping opened the current calendar-day route; `phone-notification-shade.png`, `phone-notification-tap-destination.png` |
| Billing/paywall entry without real purchase | Pass, not blocking | Mandatory-paywall Detox coverage and screenshot above; only the local deterministic purchase harness was used to continue other QA |
| Biometric lock, unlock, and background relock | Pass, not blocking | Android biometric prompt completed with the emulator fingerprint; `phone-biometric-locked.png`, `phone-biometric-prompt.png`, `phone-biometric-unlocked.png`, `phone-biometric-relocked.png` |
| Android import picker | Pass, not blocking | Detox: 5/5 passed (cancel, Clue, Flo, invalid JSON, unsupported media); `phone-import/.../*.png` |
| Backup export/share handoff | Pass, not blocking | Detox: 1 passed, restore case intentionally skipped; `phone-backup/.../backup-export-after-create.png` |
| Delete all data, immediate reset, cold relaunch persistence | Pass, not blocking | Follow-up Detox: 2/2 passed with the extracted, behaviorally tested WAL-safe host probe; onboarding restored, protected Today route unavailable, and native SQLite probe returned zero rows before and after cold relaunch |

All captured phone surfaces were inspected for crashes, unsafe-area overlap, clipping, and unreachable controls. Filtered AndroidRuntime and ReactNativeJS error logs were empty during the manual runtime pass.

## Tablet scenario matrix

The Pixel Tablet was tested in natural landscape at 2560x1600 and rotated portrait at 1600x2560. Android 16 allowed the `sw600dp` device to rotate despite the phone-oriented portrait request; no compatibility escape hatch was added.

| Surface | Portrait | Landscape/resized | Blocker | Evidence |
| --- | --- | --- | --- | --- |
| Today | Pass | Pass | No | `tablet-portrait-today.png`, `tablet-landscape-today.png` |
| Calendar | Pass | Pass | No | `tablet-portrait-calendar.png`, `tablet-landscape-calendar.png` |
| Calendar-day logging | Pass; content scrollable | Pass; content scrollable | No | `tablet-portrait-logging.png`, `tablet-landscape-logging.png` |
| Settings | Pass; content scrollable | Pass; content scrollable | No | `tablet-portrait-settings.png`, `tablet-landscape-settings.png` |
| Expired-trial paywall | Pass; CTA visible | Pass; CTA reachable by normal scroll | No | `tablet-portrait-paywall.png`, `tablet-landscape-paywall.png`, `tablet-landscape-paywall-scrolled.png` |

All tablet screenshots were inspected. Controls remained legible and reachable with no unsafe overlap, severe clipping, crash, or blank surface. Filtered AndroidRuntime and ReactNativeJS error logs were empty.

## Warnings, retries, limitations, and findings

- The original seeded reminder run passed three functional assertions but its final diagnostic read raced the asynchronous native reconciliation. The save status triggered a diagnostic read while `refreshReminderSchedules()` was still pending, so the UI captured only the deterministic billing reminder and had no reconciliation-complete signal that would cause another read. Commit `6970b6e` increments a local revision only after successful reconciliation and makes the diagnostic effect depend on it. The focused deferred-promise regression passed, and the exact API 36 Detox rerun passed 4/4. The original date-anchored manual evidence remains retained: four active user reminder preferences matched native `dumpsys alarm` entries, notification delivery, and tap routing.
- The first delete-data E2E verification copied only the SQLite base file and failed with `database disk image is malformed (11)` while the live WAL held state. The final host probe force-stops the app to close SQLite, copies the base/WAL/SHM set, fails closed on unexpected copy errors, and relaunches the same app container. Commit `329a143` moved that logic behind injectable host boundaries and added seven direct behavioral helper tests plus a separate suite-wiring sanity test; direct helper coverage reached 100% statements, functions, and lines. The exact API 36 delete-data Detox rerun passed 2/2.
- The first post-review Detox retry started before the PIN-protected AVD's credential-encrypted storage was unlocked after cold boot and exited `1` in React Native dev-support initialization. Unlocking the emulator user and rerunning the identical command produced the 2/2 pass; this was an AVD boot-state retry, not an application regression.
- For the final Task 3 rerun, the retained disposable biometric QA PIN was intentionally unavailable and the existing `Pixel_9_API_36` booted with user 0 locked. With explicit authorization, only that dedicated QA AVD's user data was factory-reset by stopping it and relaunching the same definition with `-wipe-data`. No AVD definition was deleted, recreated, or overwritten, and no other AVD or device was touched. The reset data is not recoverable.
- Metro emitted an existing Watchman recrawl warning, a development-only editorial-font timeout fallback warning, and a reduced-motion development warning. Gradle emitted dependency/deprecation warnings. None caused a build or runtime failure.
- Follow-up runtime log inspection after each required suite found no `AndroidRuntime` or `ReactNativeJS` errors and no matching fatal exception, fatal signal, app ANR, process-death, or activity-start crash entries.
- Temp evidence is intentionally outside the repository and may be removed by normal operating-system cleanup.
- No signed AAB, version bump, artifact upload, store rollout, or deployment occurred.
