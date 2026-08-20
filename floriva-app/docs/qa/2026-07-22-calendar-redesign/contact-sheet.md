# Calendar redesign — direction contact sheet (2026-07-22)

Captured on iPhone 17 Pro (iOS 26.4) from the dev gallery
(`floriva:///dev-calendar-gallery`) via `e2e/calendar-gallery-sweep.e2e.js`.
Every combo renders the same deterministic July 2026 fixtures built from the
real prediction engine (`src/testing/calendarDirectionFixture.ts`):

- **standard** — logged period Jul 3–7 (clips at the Jul 4/5 row boundary),
  spotting Jul 10, fertile Jul 5–10, predicted Jul 24–28 (crosses the Jul
  25/26 row boundary), today Jul 22 outside every band.
- **overlap** — predicted Jul 10–14 overlapping fertile Jul 12–17; a second
  predicted cell clips to a single at the Jul 31 month edge.
- **today-in-band** — today Jul 6, the mid cell of the logged period run.
- **stale** — last period start four cycles ago: predicted + fertile fully
  suppressed; the grid shows honest emptiness plus the lone spotting log.

All 32 frames live in `gallery/ios/` (`<direction>--<state>.png`, plus a
`-b` frame showing legend + fixture description). The chip/header collision
at the top of some frames is the dev-gallery harness scroll position, not
part of any direction.

| | standard | overlap | today-in-band | stale |
|---|---|---|---|---|
| **Classic (current)** | ![](gallery/ios/classic--standard.png) | ![](gallery/ios/classic--overlap.png) | ![](gallery/ios/classic--today-in-band.png) | ![](gallery/ios/classic--stale.png) |
| **A — Quiet Bands** | ![](gallery/ios/quiet-bands--standard.png) | ![](gallery/ios/quiet-bands--overlap.png) | ![](gallery/ios/quiet-bands--today-in-band.png) | ![](gallery/ios/quiet-bands--stale.png) |
| **B — Ink Ledger** | ![](gallery/ios/ink-ledger--standard.png) | ![](gallery/ios/ink-ledger--overlap.png) | ![](gallery/ios/ink-ledger--today-in-band.png) | ![](gallery/ios/ink-ledger--stale.png) |
| **C — Soft Heat** | ![](gallery/ios/soft-heat--standard.png) | ![](gallery/ios/soft-heat--overlap.png) | ![](gallery/ios/soft-heat--today-in-band.png) | ![](gallery/ios/soft-heat--stale.png) |

## A — Quiet Bands (the mockup direction)

Continuous soft-rose lozenge for logged period runs, dashed oxblood outline
(+6% wash) for predicted, mossSoft band behind fertile, logged dots, oxblood
today ring (flips to ink on a rose band), thin selected circle. 5-entry
legend.

**Pros**
- Closest to the reference mockup; the calmest surface that still shows
  everything. Runs read as single gestures, not stamped days.
- Logged vs predicted is unmistakable at a glance (solid fill vs dashed
  outline) — no color-memory required.
- Overlap state stays legible: dashed pill sits on top of the sage band
  without blending.
- Today-in-band composes beautifully (ink ring + concentric selected ring).

**Cons**
- Fertile band + period band adjacency (Jul 5–10 standard) reads as one
  continuous two-tone strip — pretty, but the boundary day is subtle.
- The rose/sage fills are close in value; colorblind users lean on the
  dashes and dots (legend still disambiguates).

## B — Ink Ledger (quietest)

No fills except today: hollow 1.5px oxblood lozenge (solid = logged,
dashed = predicted), 2px moss underline rule for fertile, today is the only
solid disc (bone numeral), thin ink selected circle.

**Pros**
- The most editorial and least "app-like"; today as the single filled disc
  is a genuinely strong focal point.
- Predicted vs logged reads purely through line quality — elegant,
  print-like, zero color dependence.
- Stale state is the most honest-looking of the three (near-blank ledger).

**Cons**
- The fertile underline is quiet to a fault — easy to miss entirely at
  arm's length (see standard, Jul 5–10).
- Hollow outlines + underline + rings stack up busy in the overlap state;
  it asks more reading effort than A.
- Least aligned with the mockup you liked.

## C — Soft Heat (warmest)

Rose wash with a tapering opacity ramp + feathered gradient caps for period
runs, sage wash for fertile with a moss "peak" ring (the engine's typical
ovulation day — the only direction surfacing it), flat wash + dotted
baseline for predicted.

**Pros**
- The washes give the month an atmospheric, tonal quality no other
  direction has; the tapering ramp actually encodes flow.
- Peak-day ring adds real information (ovulation) for free.
- Dotted baselines keep predicted distinct without outlines.

**Cons**
- Overlap state goes muddy: predicted wash over sage wash (Jul 12–14)
  blends into an ambiguous grey-green.
- Washes without hard edges make exact run boundaries the least precise of
  the three.
- Single ring slot: when today/peak/selected coincide, only the highest
  priority shows (A composes them instead).

## Open decisions (recorded for the winning direction's 2c build)

- **Spotting inside a band** — recommend dot-only (all three directions
  already do this).
- **Ovulation/peak marker if A or B wins** — recommend as a fast-follow;
  the band model doesn't carry ovulation yet (C derives it row-locally).
- **Today-ring contrast on a rose band** — ink ring (A and C already flip).
- **Out-of-month cells** — stay blank (all directions).

## Verification

- 64 variant/grid Jest tests green; 281 across the calendar feature; tsc +
  eslint clean. Soft Heat renderer at 100% line coverage; all three
  renderers keep classic's pressable/a11y wiring byte-for-byte.
- One defect found on-sim and fixed before this sheet: Ink Ledger's today
  disc/selected ring rendered off-center (percentage-position + negative
  margins); re-captured after the fix.
