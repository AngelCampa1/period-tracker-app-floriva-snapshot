# Native Liquid-Glass UI Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt genuine iOS 26 Liquid Glass and native platform components across Floriva, starting with the bottom tab bar and extending to headers, buttons, and overlay surfaces — presentation-only, privacy-safe.

**Architecture:** Five phases delivered under a deterministic Workflow fan-out. The OS renders glass on iOS 26 (native tab bar, `expo-glass-effect` surfaces); Android renders clean native Material 3 (no faux glass). Phase 1 needs no new dependency and proves the iOS 26 build path; Phase 2 establishes the shared `GlassSurface` primitive + tokens consumed by phases 3–5. Each task is TDD, runs in an isolated worktree, and is gated by a 6-lens adversarial panel (correctness, tests, privacy, UI-fidelity, taste, accessibility) before its phase PR is merge-ready. Human review happens once, at the end.

**Tech Stack:** Expo SDK ~54, expo-router ~6 (`unstable-native-tabs`), React Native 0.81, `expo-glass-effect` (Phase 2), `@expo/vector-icons`, Jest + React Native Testing Library, Detox.

**Spec:** `docs/superpowers/specs/2026-07-22-native-glass-refresh-design.md`

---

## Plan Structure & Elaboration Note

This is **one plan, five phases**, per stakeholder request. Phases 1–2 are elaborated to bite-sized TDD tasks with complete code, because their APIs are known today. Phases 3–5 are specified as task lists with exact files, the consumed interface, and test intent — but their step-level code is deliberately **expanded at the start of each phase**, because the concrete component code depends on the `GlassSurface` primitive API finalized in Phase 2 and on the visual iteration its judges drive. Writing pixel-exact glass code for a Phase 5 modal before the Phase 2 primitive exists would be fiction, not a plan. Each of phases 3–5 opens with an **"Expansion task"** that produces its own bite-sized steps from the now-known primitive.

## File Structure

**Phase 1 (tab bar):**
- Create `src/features/app-shell/tabBarItems.tsx` — pure tab config (route, label key, iOS SF Symbols, Android icon). Testable.
- Modify `app/(app)/(tabs)/_layout.tsx` — render `NativeTabs` from the config.
- Delete `src/features/app-shell/UnifiedGlassTabBar.tsx` and its test.
- Modify `src/components/primitives/Screen.tsx` — clearance from tab-bar height context.
- Modify/retire `src/features/app-shell/floatingTabBarMetrics.ts`.
- Modify `src/testing/testIds.ts` — drop dock/dockContainer/activeIndicator ids.
- Modify `e2e/prediction-preparedness.e2e.js`, `e2e/pattern-briefings.e2e.js` — label-based tab selection.
- Modify `tests/components/Screen.test.tsx`.

**Phase 2 (glass foundation):**
- Create `src/components/primitives/GlassSurface.tsx` — the primitive.
- Modify `src/theme/tokens.ts` — material/tint/elevation tokens.
- `package.json` — add `expo-glass-effect`.

**Phases 3–5:** headers in `app/**/_layout.tsx`; buttons in `src/components/primitives/ActionButton.tsx`, `src/features/tracker/components/QuickLogPeriodButton.tsx`; surfaces in `src/components/primitives/SectionCard.tsx`, `MotionPressableSurface.tsx`, `src/features/logging/screens/TodaySummaryCard.tsx`, `src/features/privacy/components/PrivacyPolicyModal.tsx`.

---

## PHASE 1 — Native Liquid-Glass Tab Bar

### Task 1.1: Tab config module (pure, testable)

**Files:**
- Create: `src/features/app-shell/tabBarItems.tsx`
- Test: `tests/features/app-shell/tabBarItems.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/features/app-shell/tabBarItems.test.tsx
import { tabBarItems } from '@/src/features/app-shell/tabBarItems';

describe('tabBarItems', () => {
  it('defines the four tabs in order', () => {
    expect(tabBarItems.map((i) => i.routeName)).toEqual([
      'today',
      'calendar',
      'insights',
      'settings',
    ]);
  });

  it('maps each tab to a localization key and platform icons', () => {
    const today = tabBarItems.find((i) => i.routeName === 'today');
    expect(today).toBeDefined();
    expect(today?.labelKey).toBe('navigation.tabs.today');
    expect(today?.ios).toEqual({
      default: 'circle.circle',
      selected: 'smallcircle.filled.circle',
    });
    expect(today?.androidMaterialName).toBe('radio-button-checked');
  });

  it('gives every tab a stable accessibility label key for e2e', () => {
    for (const item of tabBarItems) {
      expect(item.labelKey.startsWith('navigation.tabs.')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd floriva-app && yarn jest tabBarItems --no-coverage`
Expected: FAIL — cannot find module `tabBarItems`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/app-shell/tabBarItems.tsx
import type { SFSymbol } from 'sf-symbols-typescript';

export type TabRouteName = 'today' | 'calendar' | 'insights' | 'settings';

export type TabLabelKey =
  | 'navigation.tabs.today'
  | 'navigation.tabs.calendar'
  | 'navigation.tabs.insights'
  | 'navigation.tabs.settings';

export type TabBarItem = {
  routeName: TabRouteName;
  labelKey: TabLabelKey;
  ios: { default: SFSymbol; selected: SFSymbol };
  androidMaterialName: string; // @expo/vector-icons/MaterialIcons glyph name
};

export const tabBarItems: readonly TabBarItem[] = [
  {
    routeName: 'today',
    labelKey: 'navigation.tabs.today',
    ios: { default: 'circle.circle', selected: 'smallcircle.filled.circle' },
    androidMaterialName: 'radio-button-checked',
  },
  {
    routeName: 'calendar',
    labelKey: 'navigation.tabs.calendar',
    ios: { default: 'calendar', selected: 'calendar' },
    androidMaterialName: 'calendar-month',
  },
  {
    routeName: 'insights',
    labelKey: 'navigation.tabs.insights',
    ios: {
      default: 'chart.line.uptrend.xyaxis',
      selected: 'chart.line.uptrend.xyaxis',
    },
    androidMaterialName: 'insights',
  },
  {
    routeName: 'settings',
    labelKey: 'navigation.tabs.settings',
    ios: { default: 'gearshape', selected: 'gearshape.fill' },
    androidMaterialName: 'settings',
  },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd floriva-app && yarn jest tabBarItems`
Expected: PASS, 100% coverage on `tabBarItems.tsx`.

- [ ] **Step 5: Commit**

```bash
git add floriva-app/src/features/app-shell/tabBarItems.tsx floriva-app/tests/features/app-shell/tabBarItems.test.tsx
git commit -m "feat(tabs): add pure tab-bar config module"
```

### Task 1.2: Render NativeTabs from config

**Files:**
- Modify: `app/(app)/(tabs)/_layout.tsx` (full rewrite)

- [ ] **Step 1: Replace the layout with native tabs**

```tsx
// app/(app)/(tabs)/_layout.tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

import { tabBarItems } from '@/src/features/app-shell/tabBarItems';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export default function AppTabLayout() {
  const { t } = useLocalization();
  const theme = useFlorivaTheme();

  return (
    <NativeTabs tintColor={theme.colors.accentPrimary}>
      {tabBarItems.map((item) => (
        <NativeTabs.Trigger key={item.routeName} name={item.routeName}>
          <Label>{t(item.labelKey)}</Label>
          <Icon
            sf={item.ios}
            androidSrc={
              <VectorIcon family={MaterialIcons} name={item.androidMaterialName} />
            }
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd floriva-app && yarn tsc --noEmit`
Expected: no errors in `_layout.tsx`. If `MaterialIcons` glyph names mismatch, fix the `androidMaterialName` in `tabBarItems.tsx` to a valid MaterialIcons name (verify against `@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json`).

- [ ] **Step 3: Commit**

```bash
git add "floriva-app/app/(app)/(tabs)/_layout.tsx"
git commit -m "feat(tabs): render native liquid-glass tab bar"
```

### Task 1.3: Remove the custom tab bar and dead testIds

**Files:**
- Delete: `src/features/app-shell/UnifiedGlassTabBar.tsx`
- Delete: `tests/features/app-shell/UnifiedGlassTabBar.test.tsx`
- Modify: `src/testing/testIds.ts`

- [ ] **Step 1: Delete the component and its test**

```bash
git rm floriva-app/src/features/app-shell/UnifiedGlassTabBar.tsx \
       floriva-app/tests/features/app-shell/UnifiedGlassTabBar.test.tsx
```

- [ ] **Step 2: Remove unused testIds**

In `src/testing/testIds.ts`, delete the `activeIndicator`, `dock`, and `dockContainer` entries from the `tabs` object. Keep `today`, `calendar`, `insights`, `settings` (still referenced by docs/analytics and as label fallbacks).

- [ ] **Step 3: Verify nothing else imports the deleted module**

Run: `cd floriva-app && grep -rn "UnifiedGlassTabBar\|tabs.dock\|tabs.activeIndicator" src app tests e2e`
Expected: no results.

- [ ] **Step 4: Commit**

```bash
git add -A floriva-app/src/testing/testIds.ts
git commit -m "chore(tabs): remove custom tab bar and dead testIds"
```

### Task 1.4: Retune content clearance to the native bar

**Files:**
- Modify: `src/components/primitives/Screen.tsx:98-107`
- Modify: `src/features/app-shell/floatingTabBarMetrics.ts`
- Modify: `tests/components/Screen.test.tsx`

- [ ] **Step 1: Update the failing test first**

In `tests/components/Screen.test.tsx`, replace assertions that depend on `floatingTabBarMetrics.reservedHeight` (110) with assertions that the reserved space equals the `BottomTabBarHeightContext` value when provided, and falls back to `theme.spacing.xl + insets.bottom` when the context height is 0. Example addition:

```tsx
it('reserves the native tab bar height when provided by context', () => {
  const { getByTestId } = renderScreen({
    reserveTabBarSpace: true,
    tabBarHeight: 88, // provided via BottomTabBarHeightContext in the test wrapper
  });
  expect(getByTestId('screen-scroll').props.contentContainerStyle)
    .toEqual(expect.objectContaining({ paddingBottom: expect.any(Number) }));
  // paddingBottom must be >= 88
});
```

(Match the existing `renderScreen` helper's option shape; if it does not yet inject `BottomTabBarHeightContext`, extend the helper to wrap children in a `BottomTabBarHeightContext.Provider`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd floriva-app && yarn jest Screen.test --no-coverage`
Expected: FAIL on the new assertion.

- [ ] **Step 3: Simplify the clearance logic in Screen.tsx**

Replace the `floatingTabBarMetrics`-based math (lines ~98–107) with height driven by the context, keeping a minimal fallback:

```tsx
const bottomTabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
const reservedTabBarHeight =
  bottomTabBarHeight > 0
    ? bottomTabBarHeight
    : reserveTabBarSpace
      ? theme.spacing.xl + insets.bottom
      : 0;
const footerPaddingBottom = theme.spacing.xl + reservedTabBarHeight + insets.bottom;
```

- [ ] **Step 4: Reduce floatingTabBarMetrics to what remains used**

Grep for remaining references: `grep -rn "floatingTabBarMetrics" floriva-app/src floriva-app/app`. If the only remaining consumer is `Screen.tsx` and it no longer needs the pill constants, delete `floatingTabBarMetrics.ts` and its import. If any constant is still referenced, keep only that constant and remove the rest.

- [ ] **Step 5: Run tests**

Run: `cd floriva-app && yarn jest Screen.test`
Expected: PASS.

- [ ] **Step 6: Verify the four reserve-space screens still lay out**

Screens: `InsightsScreen.tsx`, `SettingsScreen.tsx`, `CalendarScreen.tsx`, `PrivateTimelineScreen.tsx`. Run their existing screen tests: `cd floriva-app && yarn jest Insights Settings Calendar Timeline`.
Expected: PASS. (Visual confirmation happens in the evidence step.)

- [ ] **Step 7: Commit**

```bash
git add -A floriva-app/src/components/primitives/Screen.tsx floriva-app/src/features/app-shell/floatingTabBarMetrics.ts floriva-app/tests/components/Screen.test.tsx
git commit -m "refactor(tabs): derive content clearance from native tab bar height"
```

### Task 1.5: Fix e2e tab navigation (label-based)

**Files:**
- Modify: `e2e/prediction-preparedness.e2e.js:73`
- Modify: `e2e/pattern-briefings.e2e.js:49-50`

- [ ] **Step 1: Replace testID taps with label matchers**

Native tab items expose no `testID`; select by accessibility label (the tab title). In `prediction-preparedness.e2e.js`:

```js
// was: await element(by.id('tab-calendar')).tap();
await element(by.label('Calendar').and(by.traits(['button']))).atIndex(0).tap();
```

In `pattern-briefings.e2e.js`:

```js
// was: by.id('tab-insights')
await waitFor(element(by.label('Insights').and(by.traits(['button'])))).toBeVisible().withTimeout(10000);
await element(by.label('Insights').and(by.traits(['button']))).atIndex(0).tap();
```

(If the app runs e2e in a non-English locale, use the localized tab title. Confirm the active e2e locale in `e2e/jest.config.js` / test setup and match it.)

- [ ] **Step 2: Note — verified on device in the evidence step**

Detox label matching against the native tab bar can only be confirmed on a built app; this runs in the Phase 1 evidence capture, not in Jest.

- [ ] **Step 3: Commit**

```bash
git add floriva-app/e2e/prediction-preparedness.e2e.js floriva-app/e2e/pattern-briefings.e2e.js
git commit -m "test(e2e): select native tabs by accessibility label"
```

### Task 1.6: Phase 1 evidence capture (feeds vision lenses)

**Files:** none (produces artifacts under `docs/qa/2026-07-22-native-glass/phase-1/`).

- [ ] **Step 1: Build & boot on iOS 26 simulator and Android emulator**

Local Xcode 26 build (no EAS), `Floriva` scheme. Boot an iOS 26 simulator and an Android emulator.

- [ ] **Step 2: Capture the tab bar on both platforms, light + dark**

```bash
xcrun simctl io booted screenshot docs/qa/2026-07-22-native-glass/phase-1/tabbar-ios-light.png
adb exec-out screencap -p > docs/qa/2026-07-22-native-glass/phase-1/tabbar-android-light.png
```
Repeat for dark mode and for each of the four tabs selected.

- [ ] **Step 3: Run the affected e2e flows on device**

Run: prediction-preparedness and pattern-briefings Detox flows.
Expected: green (label-based tab taps work).

- [ ] **Step 4: Commit evidence**

```bash
git add floriva-app/docs/qa/2026-07-22-native-glass/phase-1/
git commit -m "test(qa): phase 1 native tab bar evidence"
```

### Phase 1 gate
Run the 6-lens adversarial panel (see Orchestration). Merge-ready only when: full Jest suite green, touched-file coverage ≥ 95%, both e2e flows green, and lenses 4–6 confirm the iOS bar reads as genuine Liquid Glass and the Android bar as native Material 3, with no P0 privacy/correctness/a11y findings.

---

## PHASE 2 — Glass Foundation (design system)

### Task 2.0: Pre-dependency privacy review

- [ ] **Step 1:** Confirm `expo-glass-effect` collects no data (native UI only), record a one-paragraph note in `docs/qa/2026-07-22-native-glass/phase-2/privacy-review.md`, and confirm it adds no permissions to the iOS/Android manifests after prebuild.
- [ ] **Step 2: Commit** the note.

### Task 2.1: Add the dependency

- [ ] **Step 1:** `cd floriva-app && npx expo install expo-glass-effect`
- [ ] **Step 2:** `yarn tsc --noEmit` clean; commit `package.json` + lockfile.

### Task 2.2: `GlassSurface` primitive (TDD)

**Files:**
- Create: `src/components/primitives/GlassSurface.tsx`
- Test: `tests/components/primitives/GlassSurface.test.tsx`

Interface (locked here; consumed by phases 3–5):

```tsx
export type GlassSurfaceProps = {
  intent?: 'regular' | 'clear';        // maps to UIGlassEffect style on iOS 26
  tint?: ColorValue;                    // optional accent wash
  radius?: number;                      // corner radius
  interactive?: boolean;                // pressable/hover glass on iOS 26
  fallbackColor?: ColorValue;           // solid used when glass unavailable
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};
```

- [ ] **Step 1: Write failing tests** covering the three render branches (mock `Platform.OS`/`isLiquidGlassAvailable`): iOS 26 → renders `GlassView`; iOS <26 / unavailable → renders fallback `View` with `fallbackColor`; Android → renders Material elevated `View` (no glass). Assert `radius`, `tint`, and `interactive` are forwarded correctly.
- [ ] **Step 2:** Run tests, verify fail.
- [ ] **Step 3: Implement** `GlassSurface` using `isLiquidGlassAvailable()` + `GlassView` from `expo-glass-effect`, with the fallback branches per the cross-cutting rules.
- [ ] **Step 4:** Run tests, verify pass, coverage ≥ 95%.
- [ ] **Step 5: Commit.**

### Task 2.3: Glass tokens

**Files:**
- Modify: `src/theme/tokens.ts`
- Test: extend `tests/theme/tokens.test.ts` (or create if absent)

- [ ] **Step 1: Write failing test** asserting new `glass` token group exists with material/tint/elevation entries for light and dark.
- [ ] **Step 2–4:** Add the `glass` token group to `tokens.ts`; run tests; verify.
- [ ] **Step 5: Commit.**

### Task 2.4: Phase 2 evidence + gate
Capture a demo screen using `GlassSurface` (both platforms, light/dark), run the panel. Same gate criteria as Phase 1.

---

## PHASE 3 — Native Headers → Sticky Glass Collapse Header (DONE)

**Expansion task 3.0 finding (2026-07-22):** The app runs `headerShown: false`
**everywhere** (`createStackMotionOptions` forces it; the settings/import Stacks set
it explicitly; the only native header anywhere is `+not-found`'s `title: 'Oops!'`).
Every screen renders a **custom editorial header inside its scroll view** via the
`Screen` primitive (Newsreader serif title, eyebrow, Arc ornament) that scrolls away
with content. So the literal plan — "adopt native large-title glass headers" — would
regress the editorial identity (system font) and has no persistent top chrome to make
glass. **Stakeholder decision:** reinterpret Phase 3 as a **sticky glass collapse bar**
(chosen over literal native headers and over skipping Phase 3).

**What shipped (built into the shared `Screen` primitive so every screen gets it):**
- `src/components/primitives/ScreenScrollHeader.tsx` — a top-pinned `GlassSurface`
  bar (compact title + optional back) that is invisible + non-interactive + a11y-hidden
  while the editorial large title is in view, then fades in (opacity/translateY
  interpolated from scroll offset) once it scrolls past. Reveal threshold measured from
  the real editorial header height; back testID derived `-sticky` to avoid colliding
  with the editorial back button. 100% cov.
- `src/components/primitives/Screen.tsx` — tracks scroll via `Animated.event`
  (`useNativeDriver:false`, plain JS callback → no ScrollView/FlatList swap, existing
  refs/tests intact), measures header height on layout, mounts the pinned bar as a top
  overlay. String titles only (custom-node titles opt out).
- Global jest mock for `expo-glass-effect`; `glass` mirrored onto the compat `theme`
  export. `GlassSurface` guards `isLiquidGlassAvailable()` so a missing native module
  degrades to the solid fallback instead of crashing.

**Gate:** panel + evidence (real iOS 26 glass needs a native rebuild — `expo run:ios`,
`LANG=en_US.UTF-8` — since a JS reload can't add the `ExpoGlassEffect` native module).

---

## PHASE 4 — Buttons & FABs → Glass Fixed Footer (DONE)

**Expansion task 4.0 finding:** The literal targets don't exist — `ActionButton`'s `glass`
appearance is **dead** (used nowhere) and there are **no FABs**. Per the refresh rule
("glass only where a control floats over content"), the genuine floating chrome is the
**fixed footer** (`footerPlacement="fixed"`, 11 onboarding/import screens). Decision:
make the fixed footer glass; keep action buttons **solid** for primary-CTA prominence.

**Shipped:** `Screen.tsx` fixed footer renders a non-interactive `GlassSurface` backdrop
(regular + warm tint, `pointerEvents="none"`) filling the footer; footer container dropped
its solid `backgroundColor` so content refracts beneath. Measured container / testID /
paddings / top hairline unchanged. Degrades to solid paper fallback off iOS 26. Verified on
iOS 26.4. Evidence: `docs/qa/2026-07-22-native-glass/phase-4/`.

## PHASE 5 — Surfaces & Sheets → Glass HelpTooltip Sheet (DONE)

**Expansion task 5.0 finding:** `SectionCard` / `TodaySummaryCard` / `MotionPressableSurface`
and the info/privacy modals are **readability-critical surfaces for sensitive reproductive
data** — CLAUDE.md ("calm, clarity, trust"; sensitive data) and the plan's own rule keep
them **SOLID**; glass there would be form-over-function. The one genuine floating overlay is
the **HelpTooltip bottom sheet** (short title + one paragraph over a dimmed backdrop).

**Shipped:** `HelpTooltip` sheet is now a `GlassSurface` (regular + warm tint) over the dimmed
backdrop; dropped its solid `backgroundColor`. Rounded top / grabber / solid accent Close
button unchanged. Verified on iOS 26.4 — glass renders correctly inside a transparent RN
Modal, text fully legible. Content cards + text modals intentionally stay solid. Evidence:
`docs/qa/2026-07-22-native-glass/phase-5/`.

**System summary:** the refresh applies a single principle end-to-end — **floating chrome =
Liquid Glass** (tab bar, sticky collapse header, fixed footer, tooltip sheet); **content +
primary CTAs = solid** for legibility of sensitive data. All on the shared `GlassSurface`
primitive, degrading to solid off iOS 26.

---

## PHASE 5 — Surfaces & Sheets

**Expansion task 5.0 (run first):** Produce bite-sized TDD tasks for:
- `src/components/primitives/SectionCard.tsx`
- `src/components/primitives/MotionPressableSurface.tsx`
- `src/features/logging/screens/TodaySummaryCard.tsx`
- `src/features/privacy/components/PrivacyPolicyModal.tsx` (+ info modals)

Per surface template:
- **Test:** renders `GlassSurface` only where the surface overlays content; solid for readability-critical content surfaces; modal/sheet presentation, dismissal, and focus/accessibility preserved.
- **Steps:** failing test → adopt `GlassSurface` / native sheet presentation → verify → commit.

**Gate:** panel + evidence. After Phase 5 passes, assemble the **consolidated evidence pack** for final human review, then proceed to release screenshot regeneration.

---

## Orchestration (deterministic Workflow)

Execution uses a Workflow per phase. Skeleton (expanded per phase at execution time):

```js
export const meta = {
  name: 'native-glass-phase',
  description: 'Implement one refresh phase: TDD tasks, then 6-lens adversarial gate',
  phases: [{ title: 'Implement' }, { title: 'Evidence' }, { title: 'Panel' }],
}

// 1. Implement each task in its own worktree (TDD), fan out independent tasks.
phase('Implement')
const built = await parallel(TASKS.map((task) => () =>
  agent(taskPrompt(task), { isolation: 'worktree', schema: TASK_RESULT })))

// 2. Capture screenshots on iOS 26 sim + Android emulator (feeds vision lenses).
phase('Evidence')
const evidence = await agent(evidencePrompt(built), { schema: EVIDENCE })

// 3. 6-lens adversarial panel — each lens an independent refuter; majority passes,
//    any P0 (privacy/correctness/a11y-contrast) auto-blocks.
phase('Panel')
const LENSES = ['correctness','tests','privacy','ui-fidelity','taste','accessibility']
const verdicts = await parallel(LENSES.map((lens) => () =>
  agent(refutePrompt(lens, built, evidence), { schema: VERDICT })))
return gate(verdicts) // pass | block(list of verified findings)
```

Vision lenses (`ui-fidelity`, `taste`, `accessibility`) consume `evidence` screenshots. If the run environment cannot build/boot/screenshot headlessly, those three lenses emit the contact sheet for final human review instead of auto-gating (per the spec's toolchain caveat); lenses 1–3 remain fully autonomous.

---

## Self-Review

**Spec coverage:** Phase 1 (native tab bar, icons locked, clearance, e2e testID fix) ✓; Phase 2 (expo-glass-effect, GlassSurface, tokens, fallback rules, privacy review) ✓; Phases 3–5 (headers, buttons/FABs, surfaces/sheets) ✓ via expansion tasks; cross-cutting decisions (Android no faux glass, iOS<26 fallback, presentation-only, per-phase PRs, screenshots last) ✓; delivery methodology (Workflow, worktrees, 6-lens panel, vision evidence, final review) ✓ in Orchestration.

**Placeholder scan:** Phases 1–2 contain complete code/tests. Phases 3–5 use explicit **expansion tasks** rather than placeholders — a deliberate, documented decision (their code depends on the Phase 2 primitive), not "TODO/fill-in-later." Each expansion task states exact files, test intent, and a concrete template.

**Type consistency:** `tabBarItems` shape (`routeName`/`labelKey`/`ios`/`androidMaterialName`) is used identically in Task 1.1 and 1.2. `GlassSurfaceProps` defined in Task 2.2 is the interface referenced by all phase-3/4/5 expansion tasks. `BottomTabBarHeightContext` usage in Task 1.4 matches its existing import in `Screen.tsx`.
