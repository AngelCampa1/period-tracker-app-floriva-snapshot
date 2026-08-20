# Design system

Floriva does not look like a SaaS dashboard. That was a deliberate constraint
from the start, and it is enforced by a token file, a small set of primitives, a
numbered deviation register, and (mostly) by the absence of the escape hatches
that let a design drift.

Three files carry most of the weight:

| | Lines |
| --- | --- |
| [`floriva-app/src/theme/tokens.ts`](../floriva-app/src/theme/tokens.ts) | 596 |
| [`floriva-app/src/components/primitives/`](../floriva-app/src/components/primitives/), 15 components | 2,528 |
| [`floriva-app/src/components/editorial/`](../floriva-app/src/components/editorial/), 6 components + 3 ornaments | 711 |

---

## 1. Tokens

`tokens.ts` is one file, no runtime theming machinery, no CSS-in-JS layer. It
exports plain frozen objects and two resolver functions.

**Palettes are data.** Three are defined: `bone` ("Bone & Berry"), `clay`
("Clay & Sage"), `ink` ("Ink & Cream"). V1 ships `bone` only
(`defaultFlorivaPalette`, `:66`). The other two exist so a future palette switch
is a data change rather than a theme rewrite. Each is 13 keys: `bg`, `bgDeep`,
`paper`, `ink`, `inkSoft`, `inkMute`, `rule`, `accent`, `accentSoft`, `moss`,
`mossSoft`, `danger`, plus a display `name`.

**The palette carries its own audit trail.** Two entries in `bone` have their
reasoning checked in beside the hex value. On `inkMute` (`:12-17`):

```ts
    // Phase-4 contrast pass: darkened from #7A6A5E, which measured 3.97:1 on
    // the card surface (#EAE0D0) and 4.42:1 on the app background — under the
    // 4.5:1 WCAG AA body threshold for the captions/hints that use it. #6A5A4E
    // clears AA on every bone surface (5.05–6.08:1) while staying a clearly
    // muted step below textSecondary (#3D2E26 ~10:1).
    inkMute: '#6A5A4E',
```

And on `danger` (`:23-29`), which had been an alias for `accent`:

```ts
    // VF-5 (prerelease sweep 2026-07-23): danger previously equalled `accent`
    // (#923030), so the one destructive action rendered a pixel-identical pill
    // to every safe primary CTA. A deeper, more saturated crimson stays in the
    // warm editorial family (no generic-SaaS alarm red) but is a clear step off
    // the brick accent
    danger: '#7C1B1B',
```

That second comment is the design system's whole thesis in one token: the fix is
not "use red for danger", it is "find a red that is unmistakably destructive
*and* still inside this palette's temperature".

**The scales:**

- `spacing`: 8 steps, `xs: 4` through `'3xl': 40`.
- `radii`: 7 steps, including `pill: 999` and a `hairline: 3` reserved for
  chart bars, progress tracks and tick marks, with a note that anything circular
  must use `pill` instead.
- `typography`: 10 named styles (see §2).
- `motion`: 4 durations, 3 delays, 3 distances, 3 scales, and **7 named
  presets**: `screenEnter`, `cardReveal`, `heroBloom`, `rowShift`,
  `sensitiveScreenEnter`, `modalFade`, `pressFeedback`. `sensitiveScreenEnter`
  is a distinct, quieter preset (240ms / 10px / 0.992 scale, versus
  `screenEnter`'s 320ms / 16px / 0.985) used where a flourish would be
  inappropriate.
- `glass`: material names, tint washes, fallback solids, Material 3 elevation
  values (see §4).

**Semantic colours are resolved once.** `ThemeColors` is 51 keys: 44 semantic
(`surfacePrimary`, `buttonDestructiveFill`, `chipSelectedBorder`, …) plus a
block of 7 explicitly labelled legacy aliases:

```ts
  // Legacy aliases kept so the app can migrate incrementally.
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  tabInactive: string;
  tabActive: string;
```

A visible, admitted migration seam is better than a silent one, but it is still
a seam: `surface` and `surfacePrimary` both resolve to `editorialPalette.paper`,
and nothing stops a new component from picking the wrong one.

### The measurable part

Tokens only matter if call sites actually use them. Two greps:

```bash
# files reaching for the theme
$ grep -rl "useFlorivaTheme\|@/src/theme/tokens" src | wc -l
74

# raw hex colour literals outside src/theme
$ grep -rnE "'#[0-9a-fA-F]{6}'" src --include='*.ts' --include='*.tsx' | grep -v '^src/theme/' | wc -l
0
```

Zero hex literals in all of `src/` outside `src/theme/`. Widening the search
finds exactly three hardcoded colour values in the whole app: two `rgba()` scrim
constants (`src/features/privacy/components/PrivacyPolicyModal.tsx:151`,
`src/components/primitives/HelpTooltip.tsx:105`) and one hex constant in a route
file (`app/(app)/_layout.tsx:19`, `const legacyInk = '#201A17'`).

---

## 2. Typography

Three families, eleven faces, loaded eagerly at boot in
[`floriva-app/app/_layout.tsx:65-78`](../floriva-app/app/_layout.tsx):

- **Newsreader** (serif): display headlines and editorial accents. Six faces:
  400/500/600, roman and italic.
- **Inter Tight** (sans): body, captions, eyebrows, buttons. Four weights.
- **JetBrains Mono** (mono): numerals only, one weight (500 Medium).

The serif-first direction is what makes the app read as an almanac rather than a
dashboard. Display headlines are Newsreader 400 at 40pt (`display`) or 52pt with
`letterSpacing: -1.3` (`displayLg`); the body underneath is Inter Tight 16/23.
Numbers (cycle day, cycle length, chart labels) are JetBrains Mono with
`letterSpacing: -0.4`, so a column of figures aligns.

Eyebrows carry the editorial signature: 11pt Inter Tight Medium, uppercase, with
`letterSpacing: 1.98`.

Font loading cannot block the app. `app/_layout.tsx:62` sets a 2-second
`FONT_LOAD_TIMEOUT_MS` after which rendering proceeds on the system stack.

### `italicSerifFamily()`: a real cross-platform bug, fixed in the token layer

Editorial headlines set one accent word in italic maroon. The obvious
implementation, `fontStyle: 'italic'`, is broken in opposite directions on the
two platforms. From `tokens.ts:159-164`:

```ts
  // UL-70: true italic serif faces. Editorial accent words are styled italic,
  // but relying on `fontStyle: 'italic'` over a roman-only family diverged
  // across platforms — iOS renders roman (no synthetic italic for a named font
  // without an italic face) while Android fakes a slant. Naming the real italic
  // face renders true italic identically on both; drop the `fontStyle` so
  // Android does not oblique an already-italic font on top of itself.
```

The fix is a 12-line pure function (`:181-192`) mapping each roman serif family
to its true italic face, with non-serif families passing through unchanged. It
is used by exactly one component, which is used by nine screens.

---

## 3. Primitives and the editorial layer

### `src/components/primitives/`: 15 components, 2,528 lines

`ActionButton`, `AnomalyNudge`, `ConfidenceChip`, `ConfidenceImprovementList`,
`GlassSurface`, `HelpTooltip`, `InlineMetric`, `ListRow`,
`MotionPressableSurface`, `Screen`, `ScreenScrollHeader`, `SectionCard`,
`SelectionChip`, `SelectionPanel`, `Text`.

`Text` is 23 lines and does exactly one thing: apply the baseline before
`style` merges over it:

```tsx
export function Text({ style, ...otherProps }: TextProps) {
  const theme = useFlorivaTheme();
  return (
    <NativeText
      style={[{ color: theme.colors.textPrimary }, theme.typography.body, style]}
      {...otherProps}
    />
  );
}
```

Because it is imported everywhere instead of `react-native`'s `Text`, the
default is Inter Tight 16/23 in `textPrimary` and nobody has to remember to set
it.

`Screen` (621 lines) is the workhorse: safe areas, tab-bar clearance, the sticky
glass header, motion wrapping, and an opt-in virtualized mode that swaps the
ScrollView for a FlatList on screens whose row count grows with tenure (the
private timeline reaches roughly 341 rows after a year of daily logging), while
preserving the `${testID}-scroll` contract the e2e suite depends on.

### `src/components/editorial/`: the layer that does the work visually

`CycleRibbon` (259), `EditorialOption` (129), `EditorialProgress` (75),
`EditorialNumeral` (57), `ItalicTitle` (50), `EditorialRule` (44), plus
`ornaments/{Arc, Petal, Seed}` (39 / 42 / 16).

These are the components that would not exist in a generic component library.
`EditorialRule` is 44 lines and draws a hairline with a small tracked mark
centred in it: the printed-page section divider:

```tsx
    <View style={styles.row} testID={testID}>
      <View style={styles.line} />
      {mark ? <Text style={styles.mark}>{mark}</Text> : null}
      <View style={styles.line} />
    </View>
```

`ItalicTitle` is the most-reused of them (9 screens under `src/features`) and is
the API for the app's headline voice: `prefix` + italic maroon `accent` +
`suffix`:

```tsx
<ItalicTitle prefix="How Floriva " accent="predicts" suffix="." />
```

It composes a single `<Text>` with a nested accent span, and gets the true
italic face through `italicSerifFamily(base.fontFamily)` rather than
`fontStyle`.

`Arc` (39 lines) and `Petal` (42 lines) are pure `react-native` `View`s that
build their curves from `borderRadius` and border widths.

**Accuracy note:** `react-native-svg` *is* a dependency (`package.json:79`) and
is used in exactly two places: `ornaments/Seed.tsx` (16 lines, an `<Ellipse>`)
and `src/features/calendar/components/gridVariants/quietBands.tsx`, where the
comment explains the reason: RN's `borderStyle: 'dashed'` combined with a border
radius is unreliable across platforms. The design-deviation register records
removing SVG from the welcome arc (DEV-01), `CycleRibbon` (DEV-02), and
`Petal.tsx` (DEV-19), but it was never eliminated from the app.

---

## 4. iOS and Android: one component, not forty

Floriva uses Apple's real Liquid Glass on iOS 26 and clean Material 3 on
Android. That kind of split usually metastasises into `Platform.select` calls
scattered across every screen. Here it does not:

```bash
$ grep -rn "Platform.OS" src/components
src/components/primitives/GlassSurface.tsx:77   # ios && liquid glass available
src/components/primitives/GlassSurface.tsx:92   # android
src/components/primitives/ScreenScrollHeader.tsx:124
src/components/primitives/Screen.tsx:127        # contentOffset prop support
```

Four sites in the entire component layer, and only the first three are about
appearance. Everything else, every screen, every card, every button, inherits
the platform difference by using `GlassSurface`.

[`GlassSurface.tsx`](../floriva-app/src/components/primitives/GlassSurface.tsx)
is 132 lines with three branches:

1. **iOS 26 with the effect available** → a real `expo-glass-effect`
   `<GlassView>` with `glassEffectStyle`, `tintColor` and `isInteractive`
   (`:77-89`).
2. **Android** → a solid Material 3 surface with `elevation: 3dp`, and
   deliberately no faux glass (`:92-110`). Attempting to fake refraction on
   Android is what makes cross-platform apps look wrong on Android.
3. **Everything else**: iOS < 26, reduce-transparency, or a dev client built
   before the native module existed → flat solid, no elevation (`:113-125`).

Two details in that file are worth more than the branching:

```ts
/**
 * Liquid Glass availability, guarded. `isLiquidGlassAvailable()` calls into the
 * native ExpoGlassEffect module; if that module is missing (e.g. a dev client
 * built before the dependency was added) or ever throws, we must degrade to the
 * solid fallback rather than crash the whole screen. A period tracker should
 * never white-screen over a presentation effect.
 */
function liquidGlassAvailable() {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}
```

And the `elevated` prop, which exists for an Android compositing footgun
(`:31-39`): on Android, elevation controls sibling draw order, so an elevated
absolute-fill backdrop composites *over* later siblings and hides the fixed
footer's buttons. Passing `elevated={false}` is the fix, and the reason is
documented at the prop rather than in a commit message.

The token layer backs this with `glass.material` (the two `glassEffectStyle`
names), `glass.tint` (washes applied over genuine glass **only**),
`glass.fallback` (readability-safe solids), and `glass.elevation`
(`resting: 0`, `raised: 3`).

### The one place the platforms need different tuning

The pinned collapse header. From
[`ScreenScrollHeader.tsx:12-23`](../floriva-app/src/components/primitives/ScreenScrollHeader.tsx):

```ts
/**
 * Opacity of the bone paper scrim layered inside the glass bar on iOS (UL-01).
 * On iOS 26 the GlassView's `tint` wash renders near-clear over light content,
 * letting scrolled text superimpose the bar's title. The prior 0.85 scrim still
 * let high-contrast body text ghost through the collapsed bar and collide with
 * the title (pre-release sweep 2026-07-23: verified on the paywall + backup-
 * restore collapse bars). Bumped to 0.96 — a near-solid bone underlay that
 * guarantees the title and back label stay legible over ANY scrolled content
 * while retaining a whisper of Liquid Glass refraction at the edges. Android
 * needs no scrim: its GlassSurface fallback is already an opaque Material surface.
 */
export const HEADER_SCRIM_OPACITY = 0.96;
```

Real glass over light content is a legibility problem, not a style problem, and
the value that fixes it was found by looking at two specific screens.

---

## 5. There is no dark mode

Stated plainly because the theme types imply otherwise.
[`floriva-app/components/useColorScheme.ts`](../floriva-app/components/useColorScheme.ts)
is two lines:

```ts
export function useColorScheme() {
  return 'light' as const;
}
```

`FlorivaColorScheme` is still typed `'light' | 'dark'`, `florivaThemes` has a
single `light` entry, and `resolveTheme()` ignores its argument entirely:

```ts
/**
 * Always resolves the light theme.
 *
 * @param colorScheme - @deprecated Ignored; kept so legacy call sites that
 * still pass a color scheme keep compiling. Floriva is light-only.
 */
export function resolveTheme(colorScheme?: FlorivaColorScheme | null): FlorivaTheme {
  return florivaThemes.light;
}
```

`getDocumentBackgroundColors()` returns the same light value for both `light`
and `dark` keys. The dead parameter and the vestigial `dark` type are honest
about the history: the app started with the Expo template's scheme plumbing and
the design went light-only. They are dead weight, though, and a reader should not
mistake them for a feature.

---

## 6. The design-review process

[`DESIGN_DEVIATIONS.md`](design-deviations.md) is a numbered register,
DEV-01 through DEV-77, of every place the built app diverged from the design
source. Each row is `ID | Screen | Summary`. The header records the method:

> Screenshots taken: 2026-05-04 via `xcrun simctl io` on iPhone 17 simulator
> (iOS 26.4).

Screen-by-screen capture, compared against the mockup set, each divergence
filed with an ID and closed with a code change. Some representative entries:

| ID | What it caught |
| --- | --- |
| DEV-14 | Snapshot headline 24pt → 26pt, lineHeight 28 → 30 |
| DEV-18 | A stray `fontWeight: '600'` override on the tab bar label |
| DEV-31 | Weekday labels needed to be Sunday-first single letters |
| DEV-50 | Calendar day cells missing `flex: 1`, so a row stacked left instead of distributing |
| DEV-73 | A previously-closed deviation (DEV-04) had **regressed**: the welcome headline was back to a plain string |
| DEV-74 | `/notifications` missing from the route guard's allow-list, bouncing users to `/welcome` mid-onboarding and hiding ~21 mockups from QA capture |

DEV-73 and DEV-74 are the reason the register earns its keep. A visual regression
had silently undone earlier work, and a routing bug was making twenty-one
screens uncapturable. Neither is the kind of thing a design review is supposed
to find, and both were found because someone walked every screen with a camera.

The file also corrects itself in public. The DEV-19 to DEV-47 section opens:

> Verified against the current source tree on 2026-05-04. The earlier "Open
> Issues" list was stale: every item below is implemented in code today.

And it records one deliberate non-implementation: mockup 22, a mid-app upgrade
prompt, "has no matching route and is parked until a product decision specifies
where it should appear." An open item left open, with a reason.

---

## 7. Why this doesn't look like generic SaaS

Not a style claim: a list of specific decisions, each traceable to a file:

- **Serif display type.** Newsreader at 40 to 52pt with negative tracking is the
  first thing on most screens. The default SaaS choice is a geometric sans
  headline; the difference is immediate.
- **A warm paper substrate.** `bg: #F4ECE0`, `paper: #FBF5EB`, `rule: #D9CCBB`.
  Nothing in the palette is `#FFFFFF` or a cool grey.
- **Brick, not blue.** `accent: #923030`. There is no primary blue anywhere in
  `tokens.ts`.
- **Print vocabulary in the component names.** `EditorialRule`,
  `EditorialNumeral`, `ItalicTitle`, `Arc`, `Petal`, `Seed`: the primitives are
  named after page furniture, not UI widgets, and the components match the names.
- **A typographic accent instead of a coloured chip.** The house headline
  pattern is one italic maroon word inside a roman serif sentence
  (`ItalicTitle`), which is a magazine device, not a UI one.
- **Monospace reserved for numerals.** JetBrains Mono appears in exactly one
  typography style, so numbers read as data without a table.
- **Motion that knows where it is.** `sensitiveScreenEnter` is a separate, calmer
  preset from `screenEnter`. A period tracker should not bloom into a screen
  about a missed period.
- **No faux glass on Android.** The platform gets a real Material 3 surface
  rather than a blurred approximation of an iOS effect.

---

## 8. Weaknesses

- **51 colour keys, 7 of them legacy aliases pointing at the same values as
  their modern equivalents.** The migration was started and not finished.
- **Three hardcoded colour values outside the theme** (§1): two `rgba()` scrims
  and `legacyInk` in `app/(app)/_layout.tsx`. Small, but they are the exact
  crack a design system leaks through.
- **A `'dark'` type and a `@deprecated` `colorScheme` parameter that describe a
  feature that does not exist** (§5).
- **`react-native-svg` survived three deviations aimed at removing it** (§3).
  Two files still use it; the dependency is still shipped. Either finish the
  removal or stop describing the ornaments as SVG-free.
- **Two palettes (`clay`, `ink`) are shipped as dead data.** They cost bytes and
  have never been rendered, so they have also never been contrast-audited the
  way `bone` was.
