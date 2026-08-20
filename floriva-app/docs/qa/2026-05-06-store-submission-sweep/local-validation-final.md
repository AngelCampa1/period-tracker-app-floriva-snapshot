# Local Validation Final

Date: 2026-05-06

## Result

Local validation is passing for the checks we can run without EAS, App Store Connect, TestFlight, Google Play, or real-money store rails.

Release recommendation: locally ready for store-side validation and submission prep. Real store billing still needs TestFlight/App Store sandbox and Play-capable tester/device validation.

## Fixes Made During Final Validation

- Added iOS keychain access group entitlement to the checked-in entitlements file and guarded it with a release-config test.
- Made biometric lock marker reads fail closed when SecureStore is unavailable in an unentitled local simulator build, preventing an iOS launch redbox.
- Updated the onboarding smoke E2E flow to match the current Cycle Length + Variability and Notifications screens.
- Added notifications and cycle-variability test IDs needed for stable simulator automation.
- Hardened backup export E2E launch behavior:
  - iOS uses a double tap for the export button after secure text entry.
  - Android closes the dev menu and uses `adb am start` for the backup deep link.

## Automated Gates

- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test:ci`: pass, 139 suites, 1010 passing, 1 skipped.
- `pnpm test:coverage:check`: pass, coverage summary written to `coverage/coverage-summary.json`.

Known non-blocking test output:

- Existing React `act(...)` warnings in root layout/calendar route tests.
- Expected local font fallback warnings.
- pnpm warning for a nested Hermes parser `resolutions` field.

## Native Builds

- iOS `Floriva` Debug simulator build: pass.
- iOS `FlorivaStoreKit` Debug simulator build: pass.
- Android QA clean debug + androidTest build: pass.
- Android debug + androidTest install on `emulator-5554`: pass.

## Simulator E2E

- iOS smoke onboarding to paywall: pass.
- Android smoke onboarding to paywall: pass.
- iOS backup export creates `.floriva` file: pass.
- Android backup export creates `.floriva` file: pass.

## Release Metadata Checks

- iOS production archive: `Floriva-1.0.1-10.xcarchive`.
- iOS archive bundle identifier: `app.floriva`.
- iOS archive version/build: `1.0.1` / `10`.
- iOS archive scheme: `Floriva`.
- iOS archive StoreKit check: no `.storekit` file found.
- Android signed release AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
- Android release AAB package: `app.floriva`.
- Android release AAB versionCode: `10`.

Earlier debug simulator evidence in this folder may show `1.0.0` / `9`; those were pre-release validation artifacts and are superseded by the production archive/AAB metadata above.

## Still Not Locally Provable

- App Store sandbox purchase confirmation in TestFlight/real-device environment.
- Google Play Billing purchase availability in a Play-capable tester/device environment.
- App Store Connect / Play Console upload processing and review behavior.
