# Detox e2e suite

These are **manual, on-device** end-to-end specs (not CI-gated). They drive the
real app on a simulator/emulator through real testIDs.

## Running

The plain `pnpm detox:test:ios` / `:android` scripts assume Metro is already
running with the right env **baked into the bundle**. Most specs are guarded by a
dev-launch preset and will `describe.skip` unless that preset is set. So each run
has two processes that must share the same env:

1. **Metro** — started with the preset + harness env, which is compiled into the
   JS bundle.
2. **Detox/jest** — the same `EXPO_PUBLIC_DEV_LAUNCH_PRESET` must also be visible
   here, because the `describe` guards read it at the jest-process level.

### Required env

| Variable | Value | Why |
|---|---|---|
| `EXPO_PUBLIC_DEV_LAUNCH_PRESET` | the spec's preset (e.g. `qa-rich-history`, `import-ready`, `backup-ready`, `locked-app`, `seeded-tracker`, `grandfathered-expired`) or unset for `fresh-install`/none specs | seeds the fixture and un-skips the spec's `describe` |
| `EXPO_PUBLIC_BILLING_E2E_MODE` | `local-purchase-success` | synthetic purchases succeed with no StoreKit/Play bridge, so paid routes are reachable |
| `EXPO_PUBLIC_QA_FIXTURE_TODAY` | `2026-04-16` | **pins the QA fixture clock** so date-anchored fixtures are deterministic — see below |

### Determinism: the fixture clock pin

The QA fixtures (`qa-rich-history`, the `tenure-*` presets, `import-ready`,
`backup-ready`) anchor their seeded dates to "today" so an interactive dev build
always looks current (`src/testing/qaFixtureClock.ts` → `resolveQaFixtureToday()`).
For **e2e that would be non-deterministic** — date-embedded testIDs
(`qa-log-2026-04-13`, `private-timeline-item-...-2026-04-13`), deep-link day
routes, and month-derived copy ("April briefing") would shift every day the suite
runs.

Setting `EXPO_PUBLIC_QA_FIXTURE_TODAY=2026-04-16` (the fixtures' reference day,
`QA_RICH_HISTORY_REFERENCE_TODAY_ISO`) pins the clock so those references stay at
their authored 2026-04 values. **The specs assume this pin is set.** Without it,
the date-anchored specs will drift.

## Spec conventions

- Prefer **testIDs** over `by.text(...)`. Screen titles render as a large
  editorial serif title that Detox reads as `<75%` visible, so assert the Screen
  primitive's stable `${screenTestID}-title` id, not the title string.
- Scroll containers follow the `${screenTestID}-scroll` convention. Start scroll
  gestures **mid-screen** (`.scroll(dy, dir, NaN, 0.5)`) — the floating glass tab
  bar / chrome sits over the default ~95%-down start point and Detox reports
  "not scrollable at the given start point".
- To reveal a control before tapping, scroll **until it is visible**
  (`waitFor(...).toBeVisible().whileElement(scrollId).scroll(...)`) rather than
  `scrollTo('top')`, which computes an off-screen gesture start from a deep offset
  on this layout.
