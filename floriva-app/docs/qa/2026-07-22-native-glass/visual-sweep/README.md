# Native Glass Refresh — on-device visual sweep (2026-07-22)

Manual visual QA of the merged Liquid Glass refresh on both platforms:
iPhone 17 Pro / iOS 26.4 simulator and Pixel 9 / API 36 Android emulator.
App loaded from Metro (billing E2E unlock) so live JS reflects `main`.

## iOS 26 (real Liquid Glass)

- `ios-01..04` — the four tabs. Floating glass **capsule** tab bar; content
  refracts beneath it. Tab clearance correct (Today's "Log today" clears the bar).
- `ios-probe-*` — onboarding **fixed-footer** screens: Back/Continue render solid
  and prominent over the footer.
- `ios-05-tabbar-after-fix` — confirms the Android tab-bar fix (below) left the
  iOS glass capsule untouched.

## Android (Material fallback)

### P1 fix verified — footer CTAs visible
The pre-merge review found that on Android the fixed-footer glass backdrop
(opaque, elevated Material surface) composited **over** the footer's action
buttons, blanking the primary CTA. The `elevated={false}` fix is confirmed here
across every footer layout:

- `android-01-welcome-footer` — single "Continue" visible.
- `android-02-startpath-footer` — "Back" + "Continue" both visible.
- `android-07-cyclelen` — **the key case**: content scrolls *under* the footer
  ("Sometimes irregular" is cut at the footer edge) while Back/Continue stay solid on top.
- `android-16-periodlen-footer`, `android-22-notifications-footer`
  ("Allow notifications" + "Skip for now"), `android-25-completion-footer`.

### Follow-up fix — tab bar was off-brand (this branch)
`android-29-settings-BEFORE-lavender` shows the defect the sweep surfaced: left
unstyled, `NativeTabs` on Android inherited the **Material You system surface**
(a wallpaper-derived lavender) that clashed with the warm editorial palette.

Fixed in `app/(app)/(tabs)/_layout.tsx` by pinning Android-only surface theming
(paper `backgroundColor`, soft-berry `indicatorColor`, ink-muted inactive
icons/labels); iOS is left unstyled so the glass capsule survives.

- `android-30-today-AFTER-themed`, `android-31-settings-AFTER-themed` — the bar
  now reads as part of Floriva (warm paper + berry active pill).

### Follow-up fix — tab label pop-in animation (this branch)
Material's default `labelVisibilityMode: 'auto'` hides inactive labels with 4+
tabs and pops the selected label in on tap. Set `labelVisibilityMode: 'labeled'`
(Android-only) so every tab always shows icon + label, like iOS.
- `android-32-labeled-bar-and-sticky-header` — all four labels visible at rest.

## Coverage notes / corrections

- **Sticky glass header is NOT dormant** (correcting an earlier claim). `Screen`
  auto-derives `stickyTitle` from any string `title`, so the `ScreenScrollHeader`
  glass collapse bar is live on every titled screen. Visible as the "July 2026"
  bar in `android-32…` (Calendar starts scrolled, so it's revealed). iOS glass
  version was verified on-device in Phase 3 (`../phase-3/ios/`).
- **HelpTooltip sheet:** Android = solid paper Material sheet over a dimmed
  backdrop (`android-33-helptooltip`), text legible. iOS glass sheet verified in
  Phase 5 (`../phase-5/ios/`).
- **Dark mode: N/A.** The app is intentionally light-only right now —
  `useColorScheme()` returns `'light'` and `resolveTheme()` always returns the
  light theme (a `dark` theme exists in tokens but is not wired). Toggling the
  Android system night mode has no effect, by design. So there is no dark variant
  of the glass surfaces to test.
