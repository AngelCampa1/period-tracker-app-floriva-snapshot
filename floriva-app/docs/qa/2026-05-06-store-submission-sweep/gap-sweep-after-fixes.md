# Gap Sweep After Fixes

Date: 2026-05-06

## Result

The post-fix gap sweep covered the release areas that were explicitly unfinished in the original manual sweep:

- Today save/edit/delete freshness on both platforms.
- Delete-all-data confirmation and post-delete reset on both platforms.
- Settings subflows on iOS for cycle setup, tracking setup, TTC setup, app lock, reminders, data controls, backup export entry, delete data, subscription, language, and feedback.
- Android restore file picker path, Android delete-all-data, Android back behavior from onboarding, and Android logcat tail.
- iOS notification permission dialog and denied-reminders state.

## iOS Evidence

Computer Use was used against the visible iPhone 17 iOS 26.4 simulator.

- `fix-smoke/ios/gap-001-day-editor-saved-values.png`: saved daily log opens with selected Light and Sleep changes values.
- `fix-smoke/ios/gap-002-delete-entry-confirmation.png`: daily-log delete confirmation appears.
- `fix-smoke/ios/gap-003-entry-deleted.png`: entry deletion completes and disables save until new content is added.
- `fix-smoke/ios/gap-004-today-after-delete-summary-cleared.png`: Today summary clears after returning from deleted entry.
- `fix-smoke/ios/gap-006-settings-cycle-setup.png`: cycle setup route opens.
- `fix-smoke/ios/gap-007-settings-tracking.png`: tracking setup route opens.
- `fix-smoke/ios/gap-008-settings-ttc.png`: TTC setup route opens.
- `fix-smoke/ios/gap-010-settings-lock-no-biometrics-message.png`: biometric setup reports no enrolled biometric method instead of hanging.
- `fix-smoke/ios/gap-012-ios-notification-permission-dialog.png`: native notification permission dialog appears.
- `fix-smoke/ios/gap-013-reminders-denied-state.png`: reminders screen reports denied notifications.
- `fix-smoke/ios/gap-014-settings-data.png`: data controls route opens.
- `fix-smoke/ios/gap-015-backup-export-empty.png`: backup export starts disabled with empty passphrases.
- `fix-smoke/ios/gap-016-backup-export-filled-button.png`: backup export enables after matching passphrases.
- `fix-smoke/ios/gap-017-delete-all-data-entry.png`: delete-all-data route opens.
- `fix-smoke/ios/gap-018-delete-all-data-confirmation.png`: explicit destructive confirmation appears.
- `fix-smoke/ios/gap-019-after-delete-all-data-onboarding-reset.png`: confirmed delete resets to onboarding.
- `fix-smoke/ios/gap-021-settings-subscription.png`: subscription route opens with restore/refresh/manage actions.
- `fix-smoke/ios/gap-022-settings-language.png`: language route opens with all supported locale choices.
- `fix-smoke/ios/gap-023-settings-feedback.png`: feedback preferences route opens with haptics and tap-sound controls.
- `fix-smoke/detox-ios-backup-export-after-screen-fix/.../backup-export-after-create.png`: a fresh backup export creates `floriva-backup-2026-05-06.floriva` and opens the native iOS share sheet.

Resolved follow-up: the backup export/share-sheet open item was reproduced as a first-tap keyboard handoff problem in the shared `Screen` scroll wrapper. Updating the scroll tap policy to `keyboardShouldPersistTaps="always"` allowed the iOS Detox pass to create a fresh `.floriva` backup and present the native share sheet from a single Create backup file tap.

Note: after destructive delete reset the iOS app to onboarding, I directly re-seeded the local simulator SQLite rows to reach Settings again for the subscription/language/feedback route-open smoke. Those screenshots prove the routes render; the subscription billing state text in that seeded pass should not be treated as billing truth.

## Android Evidence

The Android emulator window was not exposed as a Computer Use app, so the Android pass used ADB, UIAutomator XML dumps, screenshots, and logcat.

- `fix-smoke/android/gap-001-log-day-open.png` and `.xml`: day logging opens from Today.
- `fix-smoke/android/gap-002-log-day-selected-scrolled.png` and `.xml`: Light, Fatigue, Sleep changes, and Low mood are selected.
- `fix-smoke/android/gap-003-log-saved.png`: save path completes.
- `fix-smoke/android/gap-004-today-after-save.png` and `.xml`: Today summary immediately shows Light, Low, Fatigue, and Sleep changes.
- `fix-smoke/android/gap-006-settings-data.png` and `.xml`: data controls route opens.
- `fix-smoke/android/gap-008-android-file-picker.png` and `.xml`: Android system file picker opens from restore Choose backup file.
- `fix-smoke/android/gap-011-delete-all-confirm-expanded.png` and `.xml`: delete-all-data confirmation expands with explicit irreversible warning and keep-data action.
- `fix-smoke/android/gap-012-after-delete-all-data.png` and `.xml`: confirmed delete resets to onboarding.
- `fix-smoke/android/gap-013-android-back-from-onboarding.png`: Android Back from onboarding keeps Floriva focused.
- `fix-smoke/android/gap-logcat-tail.txt`: no fatal crash was observed in the filtered tail after the gap pass.
- `fix-smoke/android/backup-export-screen-fix-second-tap.png` and `.xml`: Android backup export writes `files/floriva-backup-2026-05-06.floriva`, shows the Backup ready status, and launches the Android chooser.
- `fix-smoke/android/backup-export-screen-fix-second-tap-logcat.txt`: chooser launch is visible from `app.floriva`; no app fatal crash was observed.
- `fix-smoke/detox-android-backup-export-no-launch-url/.../backup-export-after-create.png`: focused Android Detox export pass creates a fresh `.floriva` file and opens the Android share sheet.

## New Bugs

No new app crash, hang, broken navigation, or persistence regression was found in this gap pass.

Backup export/share-sheet completion is now verified on iOS with Detox/native simulator evidence and on Android with both ADB/UIAutomator/file-system/logcat evidence and a focused Detox pass. The failed Android Detox attempt was traced to launching the test with the deep-link URL directly into stale dev-launcher/chooser task state; removing that launch URL and opening the deep link after the dev client attached made the focused test pass.
