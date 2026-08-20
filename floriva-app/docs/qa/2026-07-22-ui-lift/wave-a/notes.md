# Wave A — Settings + system surfaces — status ledger

Branch: `ui-lift/wave-a`. Evidence: sibling `UL-*/` folders (before/after per platform).
All fixes reproduced live before changing code; token-only styling; no primitive edits;
no testID renames; no privacy copy softened.

## Fixed

| Finding | Commit | Summary |
| --- | --- | --- |
| UL-47 | `2f5b1919` | Settings hub privacy summary now labels each state ("Biometric lock off · Diagnostics off") instead of an unlabeled value string. |
| UL-50 | `b6953e33` | Language / relock / birth-control / IUD selections use `SelectionChip` with dot indicator — selected state no longer color-only. |
| UL-54 | `351ff792` | Removed duplicated labels on language, subscription, and reminder-center cards. |
| UL-55 + UL-16 | `e419e7a9` | Trial/charge/access dates render only in the billing states they belong to; no phantom dates on fallback. |
| UL-56 | `97995670` | Delete-data trigger is destructive-styled at the entry point, not only inside the flow. |
| UL-60 | `f29249aa` | Feedback card email label localized (`settings.feedback.supportEmailLabel`, 8 locales). |
| UL-61 | `77111b86` | Tracking-setup help tooltips sit in labeled rows ("More about …") instead of floating unlabeled icons. |
| UL-63 + UL-76 + UL-72 | `942dd0e0` | Binary settings use native `Switch` rows (`SettingsToggleRow`): sounds, privacy lock, diagnostics, symptoms, fertility estimates; per-reminder rows get switch + "Edit timing", dropping the On/Off badge + verb button. |
| UL-77 | `54724f18` | Privacy-lock copy is platform-aware via `{methods}` placeholder (`getBiometricMethodsLabel`) — no hardcoded "Face ID" on Android, all 8 locales. |
| UL-18 + UL-38 + UL-74 | `3ea35ff5` | Lock screen: removed duplicated description in card, unlock CTA fixed to footer, standalone metric value sentence-cased. |
| UL-11 + UL-12 | `0a5d5c33` | Restore consent is a visible checkbox (`SelectionChip` check indicator, checkbox a11y role); restore preview no longer renders on the export-only route. Verified live: tapping the chip fills the check and enables "Restore this backup". |
| UL-32 | `eb2fe1ff` | Import source list shows the local-only reassurance line ("Imports only open the file you choose…"). Stale test that asserted its absence (April density pass) inverted with comment. |

## Not reproduced

| Finding | Evidence |
| --- | --- |
| UL-13 (import dead-end after file selection) | `UL-13/not-reproduced-review-{ios,android}.png` — file selection auto-navigates to the review screen (`previewFileImport` routes on success); the reported dead-end appears to be a preset artifact. |
| UL-78 (settings bottom inset collision) | `UL-78/not-reproduced-android-privacy-lock-bottom.png` — clean clearance; tab-clearance guard from `770affd` is an ancestor of this branch. |
| UL-04 on settings surfaces | `UL-04-settings/not-reproduced-android-settings-bottom.png` — bottom scroll region clean. |

## Escalate — primitive changes needed (src/components/primitives is frozen)

| Finding | Primitive | Exact change needed |
| --- | --- | --- |
| UL-51 | `Screen.tsx` | Sticky glass collapse header only renders when `typeof title === 'string'` (`stickyTitle` logic). Screens titled with `<ItalicTitle …>` (a ReactNode) silently lose the sticky header. Add an optional `stickyTitle?: string` prop used for the collapse header when `title` is a ReactNode. |
| UL-29 / UL-82 | `Screen.tsx` | Back-pill styling ("Back to …" top action) lives in the primitive's `topActionButton` styles; the oversized pill / inconsistent inset can only be corrected there. |
| UL-37 | `ActionButton.tsx` | Disabled treatment is a flat 0.5 opacity on all appearances — ambiguous against quiet/secondary buttons. Needs a distinct disabled surface/border/label token treatment inside the primitive. |

## Skipped

| Finding | Reason |
| --- | --- |
| UL-66 | Title formula change requires new editorial prefix/accent/suffix strings across 8 locales — editorial decision, out of a polish pass's remit. |
| UL-67 | P3; modal full-height rework is opportunistic-only and touches shared modal behavior. |
| UL-02 / UL-05 / UL-81 / UL-14 / UL-36 | Domain-logic findings per brief. |

## New observations (not fixed — out of scope)

- UL-70 confirmed live: Android renders italic serif title accents (e.g. "nudges." on reminders) in true italics while iOS uses the roman display cut — systemic font-loading difference, spans all waves.
- Minor: on the settings sounds/privacy cards the card title and the switch-row label can read as a duplicate ("Diagnostics" twice) after the switch conversion; acceptable, flagged for the orchestrator.
- Dev-client note: `floriva:///…` deep links do not cold-start the bundle under `CI=1`; open `floriva://expo-development-client/?url=…8081` first, then deep-link.
