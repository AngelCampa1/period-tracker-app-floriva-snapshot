# Manual E2E QA Summary - 2026-05-05

## Devices

- iOS: iPhone 17 simulator, iOS 26.4, Floriva debug dev client.
- Android: Pixel_9_API_35 emulator, Floriva debug dev client.

## Android Result

Pass.

Covered fresh install launch, Expo dev-client handoff, onboarding fresh path, last-period calendar, cycle length, period length, cycle variability, symptom logging, TTC choice, Android billing fallback paywall, restore and refresh controls, preview completion, Today, daily log save, Calendar, Insights, Settings, Privacy & lock, and Data & import.

The missing-Saturday regression is fixed on Android. Evidence: `android/23-calendar.png` shows the May 2026 calendar with the rightmost Saturday column visible, including May 2, 9, 16, 23, and 30.

## iOS Result

Pass with one expected sandbox limitation.

Covered fresh install launch, onboarding fresh path, last-period calendar, cycle length, period length, cycle variability, symptom logging, TTC choice, StoreKit paywall product display, restore Apple Account prompt, refresh billing status, seeded main app launch via `qa-rich-history`, Today, daily log save, Calendar, Insights, Settings, Privacy & lock, and Data & import.

The iOS paywall loaded real StoreKit product data and did not expose the Android-only preview bypass. I did not complete a purchase. Main-app coverage was completed through the existing `qa-rich-history` dev preset.

## Evidence

- iOS screenshots: 19 PNGs in `ios/`.
- Android screenshots: 31 PNGs in `android/`, with UI XML dumps for key Android states.
- Logs: `logs/ios-launch.log` and `logs/android-launch.log`.

## Open Issues

No new blocker or high issues found during this manual E2E pass.
