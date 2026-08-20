# Phase 1 — Native Liquid-Glass Tab Bar — On-Device Evidence

**Date:** 2026-07-22
**Build:** iOS 26.4 simulator (iPhone 17 Pro), Floriva dev client, JS from Metro
(branch `feat/native-glass-phase-1`), paywall bypassed via
`EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success`, onboarding via
`disableOnboarding=1`.

## What was verified on-device

`ios-01-initial.png` (Today, light):
- ✅ Native iOS 26 tab bar renders as a floating **Liquid Glass capsule**.
- ✅ Icons are coherent SF Symbols: **day-circle Today** (`smallcircle.filled.circle`,
  the discreet option B), `calendar`, `chart.line.uptrend.xyaxis`, `gearshape`.
- ✅ Labels: Today / Calendar / Insights / Settings.
- ✅ Selected tab (Today) tinted with the accent (`accentPrimary`).
- ✅ Content clearance works — the TODAY'S LOG card sits fully above the bar,
  nothing clipped. This resolves the device-dependent unknown: the native bar
  reserves space correctly (no double-inset or occlusion observed).

`ios-02-today-dark.png`: identical to light — the app self-manages its warm
theme (system dark appearance does not switch it). Dark-palette verification
should instead toggle the in-app theme in Settings.

`android-01-today.png` (Settings tab, Android emulator):
- ✅ Native **Material 3** bottom bar — edge-to-edge, **no faux glass** (matches
  the cross-platform rule).
- ✅ Correct Material icons (day-circle Today, calendar, insights, settings).
- ✅ **Material 3 active-indicator pill** with accent tint on the selected
  Settings tab; selected-only labels is native Android behavior.
- ✅ Settings content clears the bar cleanly.

## Navigation confirmed

iOS renders with **Today** selected on the Today screen; Android renders with
**Settings** selected on the Settings screen. The native tabs track selection
and route correctly on both platforms, so tab navigation is demonstrated
cross-run (a scripted single-session tap wasn't performed — no desktop tap
tooling in the build shell — but the two Detox flows cover label-based tab taps
on-device).

## Observations to confirm on a physical device (simulator quirks)

- The tab bar shows a **warm/pink cast and a faint mirrored-text refraction** of
  the content above it. This is genuine Liquid Glass lensing the app's warm
  palette (the red "Log today" link + period bar) — expected behavior, not a
  drawing bug — but the simulator's glass approximation exaggerates it. Confirm
  it reads cleanly on hardware; if the cast is too heavy, evaluate a fixed
  `blurEffect` / material on `NativeTabs` rather than relying on default glass.
- The thin dark-red hairline at the capsule's top edge — confirm it's the system
  scroll-edge separator (tinted), not an artifact.

## Automated verification (ran green)

- Full Jest suite: 273 suites / 4384 tests pass.
- `tsc --noEmit`: clean. ESLint on touched files: clean.
- Touched-file coverage: `tabBarItems.tsx` 100%, `_layout.tsx` 100%,
  `Screen.tsx` 100% lines / 96.6% branch.
