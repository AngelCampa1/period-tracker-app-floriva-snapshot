# Paywall enforcement QA sweep — 2026-06-09

Visual + e2e evidence for the mandatory post-onboarding paywall and the
grandfathered-expired full-lock surface, captured on both platforms.

## Detox results

All flows green (post-fix):

| Flow | iOS sim (iPhone 17, iOS 26.4) | Android emu (Pixel 9, API 35) |
| --- | --- | --- |
| Mandatory onboarding paywall (no skip → purchase unlocks `/today`) | ✓ | ✓ |
| Grandfathered-expired full lock (expired copy, no back, purchase → `/today`) | ✓ | ✓ |
| Launch smoke (welcome + reach onboarding paywall) | ✓ | n/a (run earlier) |

Run config: `EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success`, with
`EXPO_PUBLIC_DEV_LAUNCH_PRESET=grandfathered-expired` for the grandfathered flow.

## Screenshots

- `ios-onboarding-paywall-mandatory.png` — post-onboarding paywall, plan selection forced (Back returns to onboarding, no skip-into-app).
- `ios-subscribe-lock-expired.png` — `/subscribe` full lock with "Your free trial has ended" copy and no back affordance.
- `android-onboarding-paywall-mandatory.png` — same surface on Android.
- `android-subscribe-lock-expired.png` — same expired lock on Android (selected plan card uses accent fill).

## Aesthetic notes

Both platforms render consistently: serif display headings, warm bone
background, deep-red accent, calm/trust tone per the design system. The
expired lock correctly omits any dismiss/back/skip control.
