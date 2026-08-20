# Native Liquid-Glass UI Refresh — Design

**Date:** 2026-07-22
**Status:** Approved for planning
**Branch:** `design/native-glass-refresh`

## Summary

Modernize Floriva's look and feel by adopting genuine iOS 26 **Liquid Glass**
and native platform components, starting with the bottom navigation and
extending to headers, buttons, and overlay surfaces. On iOS this means using
system-rendered glass materials; on Android it means clean, native Material 3
surfaces (no faux-glass approximation). All work is presentation-only — no new
data flows, no telemetry, no change to stored reproductive data.

The work is delivered as **one plan in five phases**, each an independently
shippable PR. Phase 1 (tab bar) needs no new dependency and proves out the iOS
26 build path; Phase 2 establishes the shared glass design-system layer that
phases 3–5 consume.

## Goals

- Replace the custom floating-pill tab bar with the native tab bar so iOS 26
  renders it with real Liquid Glass (matching the Apple News+ reference the
  stakeholder shared), and Android renders a native Material 3 bar.
- Establish reusable glass primitives and tokens **before** screen surfaces
  diverge, per our "design system early" rule.
- Bring headers, buttons/FABs, and overlay surfaces up to a consistent,
  modern, platform-native feel.
- Preserve all existing behavior, navigation, accessibility, and test
  coverage (95% on touched files).

## Non-Goals

- No cloud/account/social features (unchanged v1 constraints).
- No behavioral analytics or tracking SDKs.
- No redesign of information architecture — same four tabs, same routes.
- No net-new screens.

## Constraints & Context

- **Stack:** Expo SDK `~54.0.34`, expo-router `~6.0.23`, React Native `0.81.5`.
  `expo-router/unstable-native-tabs` is available today.
- **Build:** Real Liquid Glass only renders in a build made with **Xcode 26
  against the iOS 26 SDK**. Builds are local (no EAS), using the `Floriva`
  scheme for archives.
- **Privacy:** Every change is presentation-only. `expo-glass-effect`
  (Phase 2) is an Expo-authored native UI module with no data collection; it
  still gets the standard pre-dependency privacy review.
- **Tests:** Jest + React Native Testing Library; Detox e2e. TDD for touched
  logic; 95% coverage target on touched files; prefer integration-style tests.

## Cross-Cutting Decisions

1. **Android = clean Material 3, no faux glass.** iOS gets real Liquid Glass;
   Android gets native elevated Material surfaces. We do not approximate glass
   on Android (avoids uncanny results, honors platform feel).
2. **Older iOS (<26) degrades gracefully.** `expo-glass-effect` and the native
   tab bar fall back to blur/translucent/solid automatically. No feature
   gating or version branches in product code beyond what the libraries do.
3. **Presentation-only / privacy-safe.** No new data flows or telemetry in any
   phase. Consistent with trust rules.
4. **Per-phase PRs.** Each phase merges independently under this one plan.
5. **Store screenshots regenerated last.** Fresh App Store + Play screenshots
   are produced after the refresh lands (release requirement), not per phase.

---

## Phase 1 — Native Liquid-Glass Tab Bar

### Approach
Replace the custom `tabBar` render prop in `app/(app)/(tabs)/_layout.tsx` with
`expo-router` native tabs (`expo-router/unstable-native-tabs`). The OS renders
the bar: iOS 26 → floating Liquid-Glass capsule; Android → Material 3. The
system owns selection state, motion, haptics, and safe-area insets. No new
dependency.

### Icons & theming (locked)
Day-circle "Today" set:

| Tab | iOS (SF Symbol, idle → selected) | Android (Material) |
|---|---|---|
| Today | `circle.circle` → `smallcircle.filled.circle` | `radio_button_checked` |
| Calendar | `calendar` | `calendar_month` |
| Insights | `chart.line.uptrend.xyaxis` | `insights` |
| Settings | `gearshape` → `gearshape.fill` | `settings` |

- Active tint = existing `accentPrimary`.
- Labels always shown.
- Dark mode via system materials + existing theme tokens.

### Layout / clearance
The floating pill overlaid content and reserved 110/154px via
`floatingTabBarMetrics`. The native bar manages its own inset and exposes real
height through `BottomTabBarHeightContext` (already read in
`src/components/primitives/Screen.tsx`).

- Drive content clearance purely from the context height.
- Retune or retire `floatingTabBarMetrics` and its constants.
- Re-verify the four screens using `reserveTabBarSpace` (Insights, Settings,
  Calendar, PrivateTimeline) so content is neither clipped nor over-padded.

### Tests & e2e
- Delete `src/features/app-shell/UnifiedGlassTabBar.tsx` and
  `tests/features/app-shell/UnifiedGlassTabBar.test.tsx`.
- Remove now-unused `dock`, `dockContainer`, `activeIndicator` testIds.
- **e2e:** `NativeTabTrigger` exposes **no `testID`** (OS-rendered). Update
  `e2e/prediction-preparedness.e2e.js` and `e2e/pattern-briefings.e2e.js` to
  select tabs by accessibility **label/text** (e.g. `by.label('Calendar')`).
  Tab labels become the stable selector.
- Update metric assertions in `tests/components/Screen.test.tsx`.
- Add a native-tabs config/integration test.

### Risks
- `unstable-native-tabs` is shipping but named unstable — pin behavior with a
  smoke test and re-verify on SDK bumps.
- Glass only renders on an iOS 26 SDK build — verify on device/simulator, not
  just in Metro. Android verified separately.

---

## Phase 2 — Glass Foundation (design system)

### Approach
Add `expo-glass-effect` and build the shared layer phases 3–5 consume.

- **Dependency:** `expo-glass-effect` (Expo native UI module, no telemetry).
  Run the standard pre-dependency privacy review and record it.
- **Primitive:** `GlassSurface` and an interactive variant (pressable) wrapping
  `GlassView`, with a clean props API (intent/material, tint, radius,
  interactive). On iOS 26 → real `UIGlassEffect`; below 26 and on Android →
  fallback surface per the cross-cutting rules.
- **Tokens:** extend `src/theme/tokens.ts` with material, glass-tint, and
  elevation tokens so surfaces read as one system in light and dark.
- **Fallback rules defined once** in the primitive: iOS 26 glass → iOS <26
  blur/solid → Android Material elevated.

### Tests
- Unit tests for the primitive's platform/version branching (mocked).
- Snapshot/integration coverage of token application in light and dark.

---

## Phase 3 — Native Headers

### Approach
Adopt native large-title glass headers across the Stack layouts
(`app/_layout.tsx`, settings, import, onboarding, not-found), replacing custom
header configuration. Ensure correct iOS 26 scroll-edge behavior (transparent →
glass on scroll). Android uses native Material top-app-bar treatment.

### Tests
- Header configuration/integration tests per Stack.
- Verify large-title collapse and back-navigation behavior.

---

## Phase 4 — Buttons & FABs

### Approach
Reskin `src/components/primitives/ActionButton.tsx` and
`src/features/tracker/components/QuickLogPeriodButton.tsx` on the Phase 2
primitive where they float over content (glass); keep solid fills where a
glass treatment would hurt legibility or emphasis. Preserve existing press
feedback, haptics, and accessibility roles/labels.

### Tests
- Component tests for each variant (idle/pressed/disabled) and reduced-motion.
- Confirm accessibility labels/roles unchanged.

---

## Phase 5 — Surfaces & Sheets

### Approach
`SectionCard`, `MotionPressableSurface`, `TodaySummaryCard`, and modals
(`PrivacyPolicyModal`, info modals) adopt glass surfaces / native sheet
presentation where they overlay content. Non-overlay content surfaces stay
solid for readability.

### Tests
- Component/integration tests for refreshed surfaces.
- Verify modal/sheet presentation, dismissal, and focus/accessibility.

---

## Delivery & Review Methodology

The build runs as a **fully autonomous, self-gating pipeline**. Human review
happens **once, at the end of all five phases** — not per phase.

### Orchestration
- **Deterministic Workflow fan-out.** A Workflow drives the work with a stage
  per project phase. Per-task pipeline: implement (TDD) → self-verify
  (tests + coverage) → capture evidence → 6-lens adversarial panel → gate.
- **Dependency graph:** Phase 1 → Phase 2 → (Phase 3 ∥ 4 ∥ 5). Within a phase,
  independent tasks fan out.
- **Isolation:** parallel tasks run in their own **git worktrees** to avoid
  file-mutation collisions.

### Execution loop (per task)
An implementation sub-agent runs strict TDD (red → green → refactor) in an
isolated worktree and cannot hand off without: passing tests, touched-file
coverage ≥ 95%, and a short change note.

### Adversarial panel (6 lenses)
Runs before a phase is considered merge-ready. Each lens is an **independent
sub-agent prompted to refute** the work (find why it's wrong); a finding must
be verified before it blocks. **Majority verdict passes**, but any P0 in
privacy, correctness, or accessibility contrast is an automatic block
regardless of vote.

1. **Correctness / reuse** — bugs, dead code, simplification.
2. **Test-integrity** — meaningful tests vs. shallow mocks; real coverage; try
   to break the feature.
3. **Privacy** — new data flows, dependency risk, claim/impl divergence.
4. **UI-fidelity (vision)** — does the rendered result read as genuine iOS 26
   Liquid Glass / native, vs. the Apple News+ reference.
5. **Taste (vision)** — scored against the rubric below.
6. **Accessibility (vision + code)** — contrast on glass, hit targets, dynamic
   type, VoiceOver/TalkBack, reduced motion.

### Vision-judge evidence pipeline
Lenses 4–6 cannot judge from code. After a visual phase is green, an evidence
sub-agent boots the app on an **iOS 26 simulator** and an **Android emulator**,
drives each affected surface, and captures screenshots via
`xcrun simctl io booted screenshot` / `adb exec-out screencap` to known paths —
per surface × platform × light/dark. These feed lenses 4–6.

### Taste rubric (lens 5)
Score each 1–5; pass threshold = mean ≥ 4 with no criterion < 3:
- Reads as genuine iOS 26 Liquid Glass (iOS) / native Material 3 (Android),
  not a blur hack.
- Calm, uncluttered, trustworthy; not generic SaaS.
- Consistent spacing rhythm, clear hierarchy, balanced density.
- Motion is purposeful, not decorative.

### Evidence before done
No phase is marked complete without test output, coverage numbers, and the
screenshot contact sheet attached to the phase result.

### Final human review
After all phases pass their gates, the stakeholder receives **one consolidated
evidence pack** (screenshots per surface/platform/mode, test + coverage
reports, panel verdicts) and the merge-ready branches for final approval,
before release steps.

### Toolchain caveat (honest limitation)
The vision lenses (4–6) require a **runnable iOS 26 build (Xcode 26)** and a
bootable simulator/emulator in the execution environment. Code/test/privacy
lenses (1–3) are fully autonomous regardless. If headless build → boot →
screenshot cannot be fully automated in the run environment, lenses 4–6
**degrade to assembling the contact sheet for the final human review** rather
than auto-gating. This is the one place "fully autonomous" may depend on the
local machine's toolchain.

## Testing Strategy (all phases)

- TDD for any touched logic; 95% coverage on touched files.
- Prefer integration-style tests over shallow mocks.
- e2e: tab selection by label; keep the two affected flows green.
- Manual QA visual sweep with screenshots at each surface (iOS 26 sim +
  Android emulator), per the screenshot guidance.

## Verification

- iOS: build with Xcode 26 / iOS 26 SDK, verify real glass on device/simulator.
- iOS <26: verify graceful fallback.
- Android: verify native Material 3 rendering.
- Full Jest suite + touched-file coverage; Detox flows green.

## Release

- Regenerate App Store + Play screenshots once the refresh is complete (do not
  reuse prior release screenshots).
- Production/review builds created locally (no EAS), `Floriva` scheme.

## Out of Scope

- The optional detached `search` accessory (no search tab exists today).
- Any non-visual behavior change, data model change, or new screen.
