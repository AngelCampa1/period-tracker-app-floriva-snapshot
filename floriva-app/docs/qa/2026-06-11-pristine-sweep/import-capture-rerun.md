# Import Capture Rerun

## 2026-06-11

Purpose: revisit the open iOS filtered import screenshot capture gap.

Harness changes made:

- Added iOS dev-server URL blacklisting to `e2e/store-screenshots.e2e.js` after `device.disableSynchronization()`, matching the busy-state mitigation used by other iOS dev-client E2E suites.
- Added a fast failure for `FLORIVA_CAPTURE_SCREENS=import` unless `EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready`, because the import review screenshot depends on seeded preview state.
- Review found the first guard still ran after app launch; it was moved to the start of `beforeAll` so a misconfigured import capture fails before any simulator/device setup.
- Added `DETOX_IOS_DEVICE_ID` support to `detox.config.js` so diagnostic reruns can target a known fresh simulator UUID instead of relying on named-device selection.

Attempted iOS import-only capture:

```bash
EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready \
EXPO_DEV_SERVER_PORT=8084 \
FLORIVA_CAPTURE=1 \
FLORIVA_CAPTURE_SCREENS=import \
FLORIVA_CAPTURE_OUT_IOS=docs/qa/2026-06-11-pristine-sweep/ios/import-detox-current \
npx detox test -c ios.sim.debug --cleanup \
  --artifacts-location docs/qa/2026-06-11-pristine-sweep/detox-ios-import-capture-current \
  e2e/store-screenshots.e2e.js
```

Result: blocked before the test body. Detox started Jest, booted `iPhone 17`, then hung in `simctl bootstatus` even though `xcrun simctl list devices booted` showed the simulator as Booted.

Attempted alternate simulator:

```bash
DETOX_IOS_DEVICE='iPhone 17 Pro' \
EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready \
EXPO_DEV_SERVER_PORT=8084 \
FLORIVA_CAPTURE=1 \
FLORIVA_CAPTURE_SCREENS=import \
FLORIVA_CAPTURE_OUT_IOS=docs/qa/2026-06-11-pristine-sweep/ios/import-detox-current \
npx detox test -c ios.sim.debug --cleanup \
  --artifacts-location docs/qa/2026-06-11-pristine-sweep/detox-ios-import-capture-current-iphone17pro \
  e2e/store-screenshots.e2e.js
```

Result: blocked before the test body in the same way. Detox started Jest, booted `iPhone 17 Pro`, then hung in `simctl bootstatus` while `simctl list devices booted` showed the simulator as Booted.

Fresh disposable simulator probe:

```bash
xcrun simctl create Floriva-Import-Probe \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-26-4
xcrun simctl boot <fresh-uuid>
xcrun simctl bootstatus <fresh-uuid>
xcrun simctl install <fresh-uuid> ios/build/Build/Products/Debug-iphonesimulator/Floriva.app
xcrun simctl openurl <fresh-uuid> \
  'exp+floriva://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8085&disableOnboarding=1'
xcrun simctl openurl <fresh-uuid> 'floriva:///import/review?disableOnboarding=1'
```

Result: fresh simulator boot/install/launch progressed farther than the stale named devices. `bootstatus` exited successfully after a long wait but reported `Data Migration Failed`; the app installed and launched. The route was then blocked by the iOS system confirmation sheet `Open in "Floriva"?`. AppleScript coordinate tapping failed with `-25204`, and XcodeBuildMCP UI snapshot failed because the full-screen system dialog prevented accessibility hierarchy translation.

Fresh UUID-targeted Detox probe:

```bash
DETOX_IOS_DEVICE_ID=<fresh-uuid> \
EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready \
EXPO_DEV_SERVER_PORT=8085 \
FLORIVA_CAPTURE=1 \
FLORIVA_CAPTURE_SCREENS=import \
FLORIVA_CAPTURE_OUT_IOS=docs/qa/2026-06-11-pristine-sweep/ios/import-ready-detox-current \
npx detox test -c ios.sim.debug e2e/store-screenshots.e2e.js --reuse --loglevel verbose
```

Result: Detox selected the fresh simulator by UUID, installed `Floriva.app`, and launched `app.floriva`. It then stayed busy at the same dev-client confirmation prompt before the harness could call `device.disableSynchronization()`. Screenshot evidence: `ios/import-ready-detox-current/detox-hang.png`.

Validation that did pass:

```bash
node --check e2e/store-screenshots.e2e.js
corepack pnpm test -- --runInBand tests/sanity/detox-config.test.ts
corepack pnpm lint
```

Result: syntax check passed before and after the review fix. Detox config sanity passed after the UUID-targeting addition. Lint passed before and after the review fix with the same 13 existing warnings in unrelated adversarial tests.

Conclusion:

- The harness is now hardened against the previously identified iOS dev-client busy-state and wrong-preset import capture failure modes.
- Stale named iOS simulators are blocked earlier by CoreSimulator/Detox bootstatus hangs, not by the import review screen or route wait.
- A fresh disposable simulator gets past boot/install/launch, but local automation is blocked by the iOS `Open in "Floriva"?` system prompt.
- Existing manual visual evidence for the import surface remains `ios/import-ready-current/import.jpg`; automated iOS import screenshot capture still needs a healthy CoreSimulator/Detox session to prove the fix end-to-end.

## 2026-06-12 Main Checkout Rerun

After merging the recovered sweep branch into `main`, the filtered import capture was rerun against the healthy iPhone 17 simulator already used for the StoreKit rerun.

```bash
DETOX_IOS_DEVICE_ID=2B9F547F-E6A8-409B-85EE-968CBA23DE20 \
EXPO_DEV_SERVER_PORT=8081 \
EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready \
FLORIVA_CAPTURE=1 \
FLORIVA_CAPTURE_SCREENS=import \
FLORIVA_CAPTURE_OUT_IOS=docs/qa/2026-06-11-pristine-sweep/ios/import-ready-main-rerun \
corepack pnpm exec detox test -c ios.sim.debug e2e/store-screenshots.e2e.js \
  --reuse \
  --loglevel info \
  --artifacts-location docs/qa/2026-06-11-pristine-sweep/detox-ios-import-capture-main-rerun
```

Result: passed, 1 suite and 1 test. Detox connected through the Expo dev client and captured `ios/import-ready-main-rerun/import.png`.

Conclusion: the earlier import-capture blocker is cleared on `main`. The captured screen shows the seeded import review state with no system prompt, no visible overlap, and the primary action reachable.
