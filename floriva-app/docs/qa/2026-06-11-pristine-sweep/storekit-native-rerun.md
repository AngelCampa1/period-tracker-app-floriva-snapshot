# StoreKit Native Rerun

## 2026-06-11

Purpose: continue the open Apple purchase-validation gap from the pristine sweep.

What was verified:

- `ios/Floriva.xcodeproj/xcshareddata/xcschemes/FlorivaStoreKit.xcscheme` has a `StoreKitConfigurationFileReference` pointing at `../Floriva.storekit`.
- `ios/Floriva.storekit` contains the configured Floriva product IDs:
  - `floriva.plus.annual`
  - `floriva.plus.monthly`
  - `floriva.plus.lifetime`
- `xcrun storekit` is unavailable in this Xcode install:

```text
xcrun: error: unable to find utility "storekit", not a developer tool or in PATH
```

- XcodeBuildMCP defaults were set to:
  - workspace: `ios/Floriva.xcworkspace`
  - scheme: `FlorivaStoreKit`
  - configuration: `Debug`
  - bundle id: `app.floriva`
- A fresh `FlorivaStoreKit` native build completed after the XcodeBuildMCP call timed out at the tool boundary:

```text
ios/build/Build/Products/Debug-iphonesimulator/Floriva.app
```

Current blocker:

- The original configured `iPhone 17` simulator failed to boot through CoreSimulator launchd.
- Switching to `iPhone 17 Pro` booted successfully, but `simctl install` for the fresh `Floriva.app` hung until manually terminated.
- A follow-up `simctl get_app_container` probe also hung, confirming CoreSimulator install/container services were unstable in this run.

Conclusion:

- This pass strengthened the local setup evidence and produced a fresh `FlorivaStoreKit` build, but still did not verify entitlement completion after native purchase.
- There is no repo-provided headless StoreKit completion path; the fake `EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success` path remains useful for deterministic app flow testing, but it intentionally bypasses native StoreKit.

Next safest verification step:

- Use the Xcode GUI with the `FlorivaStoreKit` scheme and `ios/Floriva.storekit` attached on a healthy simulator session, then complete the StoreKit purchase UI and verify the app unlocks.
- If simulator StoreKit or CoreSimulator remains unstable, use a real-device/TestFlight sandbox pass with the sandbox tester from `.env.local` without printing credentials.

## 2026-06-12

Purpose: rerun the StoreKit native path from `main` after the machine restart and after merging the recovered pristine-sweep worktree.

What was verified:

- XcodeBuildMCP was configured for:
  - workspace: `ios/Floriva.xcworkspace`
  - scheme: `FlorivaStoreKit`
  - configuration: `Debug`
  - simulator: `iPhone 17` (`2B9F547F-E6A8-409B-85EE-968CBA23DE20`)
  - bundle id: `app.floriva`
- First `build_run_sim` failed because the CocoaPods sandbox was out of sync with `Podfile.lock`.
- `pod install` completed locally and only changed the Hermes checksum in `ios/Podfile.lock`.
- The follow-up XcodeBuildMCP `build_run_sim` succeeded:

```text
app: ios/build/Build/Products/Debug-iphonesimulator/Floriva.app
build log: ~/Library/Developer/XcodeBuildMCP/workspaces/floriva-c959e432fa22/logs/build_run_sim_2026-06-12T13-23-44-972Z_pid5656_3959c441.log
runtime log: ~/Library/Developer/XcodeBuildMCP/workspaces/floriva-c959e432fa22/logs/app.floriva_2026-06-12T13-25-02-654Z_helperpid50143_ownerpid5656_0d06044e.log
```

- Metro was restarted without `EXPO_PUBLIC_BILLING_E2E_MODE` or a seeded dev preset so the app would not use the fake purchase path.
- The launched dev client connected to `http://localhost:8081`.
- The StoreKit paywall rendered the annual CTA correctly. Evidence:
  - `ios/storekit-rerun-main/paywall-annual-cta.jpg`
- Tapping `Choose annual plan` opened the native Apple Account sign-in sheet. Evidence:
  - `ios/storekit-rerun-main/apple-account-sign-in.jpg`
- The stale welcome evidence was refreshed after reinstalling the local build on the same simulator and reconnecting to a clean Metro session. Evidence:
  - `ios/storekit-rerun-main/welcome-tracker-copy.png`
- Sandbox credentials were loaded from `.env.local` without printing the password. Pasteboard and keystroke entry both dismissed the Apple Account sheet but did not advance to a purchase confirmation or unlock the app.
- App/runtime logs did not record an app-side purchase error during this attempt.

Current blocker:

- The app now builds, installs, launches, and reaches native Apple Account handoff under `FlorivaStoreKit`, but local simulator entitlement completion remains unverified. The remaining blocker is StoreKit/account completion in this local simulator flow, not build/install or app navigation.

Next safest verification step:

- Use Xcode GUI StoreKit controls with the `FlorivaStoreKit` scheme and `ios/Floriva.storekit` attached, or a real-device/TestFlight sandbox pass, then verify the app unlocks after transaction completion.
