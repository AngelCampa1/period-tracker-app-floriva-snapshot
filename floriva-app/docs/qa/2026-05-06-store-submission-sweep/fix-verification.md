# Store Sweep Fix Verification

Date: 2026-05-06

## Billing QA Defaults

- iOS simulator purchase confirmation should be verified with the local `FlorivaStoreKit` scheme.
- iOS sandbox account purchase validation should be verified on a real device or TestFlight build using the sandbox tester from `.env.local`.
- Android sideloaded debug builds keep native billing disabled by default to avoid false Play Billing failures on emulators without a Play-backed tester context.
- Android native billing QA can opt in explicitly with `EXPO_PUBLIC_BILLING_ANDROID_NATIVE_QA=1`.
- Deterministic local purchase smoke testing can use `EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success`.

## Android Debug Build

Use the clean QA build command when package intermediates may be stale. It removes generated CMake/codegen packaging directories, serializes Gradle, and prepares Worklets/Reanimated prefab packages before app assembly:

```bash
pnpm android:qa:debug-build
```

Equivalent raw command:

```bash
rm -rf android/app/.cxx android/app/build/generated android/app/build/intermediates/cxx android/app/build/intermediates/merged_native_libs
cd android && ./gradlew --no-parallel clean react-native-worklets:prefabDebugPackage react-native-reanimated:prefabDebugPackage app:assembleDebug app:assembleDebugAndroidTest -DtestBuildType=debug
```
