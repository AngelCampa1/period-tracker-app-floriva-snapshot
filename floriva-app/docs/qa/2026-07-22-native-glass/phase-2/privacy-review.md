# Phase 2 pre-dependency privacy review — `expo-glass-effect`

**Dependency:** `expo-glass-effect@~0.1.10`
**Reviewed:** 2026-07-22
**Verdict:** Approved — presentation-only, no privacy impact.

`expo-glass-effect` is a pure rendering module that exposes Apple's `UIGlassEffect`
(iOS 26 Liquid Glass) to React Native. It collects no data, opens no network
connections, and reads no reproductive, device, or user information. Inspection of
the installed package confirms:

- **Native platform is Apple-only.** `expo-module.config.json` declares
  `"platforms": ["apple"]` with a single `GlassEffectModule`; the `android` block is
  empty. On Android (and iOS < 26) `GlassView` degrades to a plain `<View>` and
  `isLiquidGlassAvailable()` returns `false`. No faux glass, no extra code path that
  touches data.
- **No permissions added.** The package ships no `app.plugin.js` / config plugin and
  declares no `NS*UsageDescription`, `INTERNET`, or any other permission. It cannot
  alter the iOS or Android manifests during prebuild.
- **No analytics / networking / storage.** The JS surface is four runtime exports
  only — `GlassView` (a styled native view), `GlassContainer`, and the boolean helpers
  `isLiquidGlassAvailable()` / `isGlassEffectAPIAvailable()` — plus compile-time-only
  type exports that erase at build. There is no telemetry, no identifiers, and no
  persistence.

This aligns with the refresh's cross-cutting rule that the work is **presentation-only
and privacy-safe**: the module renders a material effect and nothing more. It
introduces no third-party tracking and makes no privacy claim the implementation
cannot support.

**Manifest re-check:** confirm after the next `expo prebuild` that neither
`ios/**/Info.plist` nor `android/app/src/main/AndroidManifest.xml` gains a permission
attributable to this package (expected: none, given the empty Android config and
absent config plugin).
