# Release hardening audit - 2026-05-14

## Objective

Test Floriva end to end, including slices 1-10 and the entire app, fix functional, UI, and UX defects found during the pass, then generate local store builds so the release can be submitted to the Apple App Store and Google Play Store.

## Prompt-to-artifact checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Fix visible numeric clipping | Added line-height and Android font-padding coverage for hero numerals, editorial numerals, inline metrics, calendar, insights, paywall, settings, and completion surfaces. Covered by focused component and screen tests. | Passed |
| Test the whole app shell | Detox smoke tests passed on iOS and Android. App boot/profile fallback is covered by `tests/app/app-layout.test.tsx`. | Passed |
| Test release slices 1-10 | The Floriva Plus ledger marks slices 1-10 done. This hardening pass re-ran the user-facing Detox coverage for slices 2-10 where applicable: private timeline, import concierge, encrypted backup, prediction preparedness, birth-control hub, TTC mode, condition modes, pattern briefings, and flagship integration surfaces. | Passed |
| Fix functional bugs found | Fixed profile-load fallback behavior, TTC setup blocking when profile data is unavailable, birth-control clearing state after reminder refresh failure, backup export retry reliability, Android paywall fallback assertions, and Today summary wrapping. | Passed |
| Re-run automated verification | `pnpm lint`, `pnpm typecheck`, and `pnpm test:coverage:check` passed. Coverage run passed 146 suites and 1143 tests. | Passed |
| Dedicated review agent | Review found three P2 issues. All were fixed. Follow-up review reported no findings on those P2s. | Passed |
| Generate Google Play artifact | Local signed Android release bundle generated at `android/app/build/outputs/bundle/release/app-release.aab`. | Passed |
| Generate App Store artifact | Local iOS archive generated at `build/release/Floriva-1.0.1-11.xcarchive`. App Store export generated `build/release/AppStoreExport/Floriva.ipa` with Cloud Managed Apple Distribution signing. | Passed |
| Ensure release preflight catches blockers | `APP_ENV=production pnpm release:preflight` passes public env, Android signing checks, and the validated App Store export summary when local release env is loaded. | Passed |

## Verification commands

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:coverage:check
APP_ENV=production corepack pnpm release:preflight
```

Additional Detox verification was run on both iOS and Android for smoke, rich-history, import-ready, and backup-ready flows. The QA screenshot set contains 126 PNG artifacts under `docs/qa/screenshots/2026-05-14-release-hardening/`.

## Slice coverage map

| Slice | Ledger status | Release-hardening evidence |
| --- | --- | --- |
| 1. Program foundation | Done | No user-facing simulator pass required by the ledger. Current hardening pass re-ran full lint, typecheck, coverage, and release sanity checks. |
| 2. Private Timeline | Done | Re-run through rich-history Detox coverage and flagship integration private-timeline checks on iOS and Android. |
| 3. Import Concierge | Done | Re-run through import-ready Detox coverage on iOS and Android. |
| 4. Encrypted Backup Productization | Done | Re-run through backup-ready Detox export and restore coverage on iOS and Android. |
| 5. Prediction Confidence and Preparedness | Done | Re-run through rich-history Detox coverage on iOS and Android. |
| 6. Birth-Control Hub | Done | Re-run through rich-history Detox coverage on iOS and Android after fixing below-fold card discovery and settings persistence behavior. |
| 7. TTC Mode | Done | Re-run through rich-history Detox coverage on iOS and Android, with profile-unavailable TTC settings blocking covered by Jest. |
| 8. Condition Modes | Done | Re-run through rich-history Detox coverage on iOS and Android. |
| 9. Personal Pattern Briefings | Done | Re-run through rich-history Detox coverage and flagship integration briefing checks on iOS and Android. |
| 10. Flagship Integration Pass | Done | Re-run through whole-app smoke, private timeline, and pattern briefing integration coverage on iOS and Android. |

## Store artifacts

- Android: `android/app/build/outputs/bundle/release/app-release.aab`
- iOS archive: `build/release/Floriva-1.0.1-11.xcarchive`
- App Store IPA: `build/release/AppStoreExport/Floriva.ipa`

## Store signing validation

The App Store IPA was exported by Xcode using Cloud Managed Apple Distribution signing. Direct IPA validation showed:

```text
application-identifier = TEAMID1234.app.floriva
get-task-allow = false
profile = iOS Team Store Provisioning Profile: app.floriva
Authority = Apple Distribution: Ventora Labs (TEAMID1234)
```

The normalized preflight result is:

```text
Floriva release preflight passed.
```
