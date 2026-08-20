# Onboarding Production Audit

Date: 2026-04-17
Workspace: `~/Desktop/floriva/.worktrees/codex/onboarding-production-audit/floriva-app`
Primary device: iOS Simulator (`iPhone 17`)
Android status: live parity verified on `Pixel_9_API_35` after the Android follow-up fixes described in the closure update below

## Production Readiness Rubric

- iOS manual pass is required for onboarding changes in this wave.
- Android parity remains required before calling the broader app production-ready.
- Every onboarding fix must follow TDD: failing test, verified failure, minimal fix, rerun.
- Touched files must stay at or above the project coverage target.
- No onboarding wave is done until targeted verification and review are rerun after fixes.

## Screen Inventory

Audited or queued in this wave:

- `welcome`
- `privacy`
- `start-path`
- `basics`
- `goals`
- `last-period-start`
- `cycle-length`
- `period-length`
- `cycle-variability`
- `symptom-logging`
- `ttc`
- `ttc-setup`
- `ttc-expectations`
- `ttc-preset`
- `setup-later`
- `import/*`
- `restore`
- `paywall`
- `completion`

## Manual Evidence

- Welcome screen before fix: `<tmp>/T/screenshot_optimized_6fc5c031-871a-4eca-a247-e2bc0fcaa5e5.jpg`
- Start-path screen during audit: `<tmp>/T/screenshot_optimized_2a137783-a098-4b49-abc5-fc1e2b08e20c.jpg`
- Welcome screen after inline-footer fix: `<tmp>/T/screenshot_optimized_a4cd445f-8353-4e4f-b7ff-902f8c5cae8d.jpg`
- Current simulator handoff blocker in Safari/Expo Go chooser: `<tmp>/T/screenshot_optimized_984fa463-75d2-438f-88c8-3eac2d91ed34.jpg`
- Welcome screen in live native build after worktree recovery: `<tmp>/T/screenshot_optimized_34708f7b-f452-49d5-b636-e61a19234e1e.jpg`
- Start-path live native screen with selected fresh branch: `<tmp>/T/screenshot_optimized_a77b5b63-06d7-4325-a637-df8f175b9b7b.jpg`
- Last-period-start live native overlap reproduction: `<tmp>/T/screenshot_optimized_561a8bbc-ba65-4837-820a-672bdacfb048.jpg`
- Welcome screen after compaction fix with CTA inside the first viewport: `<tmp>/T/screenshot_optimized_4d682f36-6772-4e70-9e2e-6fb73ee530b7.jpg`
- Fresh-path completion handoff audit after welcome compaction: `<tmp>/T/screenshot_optimized_552515f6-eb24-4502-a419-b36b151460ca.jpg`
- Import source chooser screen: `<tmp>/T/screenshot_optimized_a5f86eff-5d13-42e4-a197-971230b9bbd7.jpg`
- Restore screen empty state with passphrase and disabled preview CTA: `<tmp>/T/screenshot_optimized_3362f9c0-90dc-462b-a693-2b076e338da6.jpg`
- Native restore file-picker empty state (`Recents`, no recent files): `<tmp>/T/screenshot_optimized_c3466e57-52e5-4eed-9cc0-ff37dddbce5d.jpg`
- Last-period-start after final compaction with footer CTA fully visible on first view: `<tmp>/T/screenshot_optimized_09fd82f3-9f22-4558-a037-3c034e0255e3.jpg`
- Paywall after copy reduction with actions still visible and secondary sections removed: `<tmp>/T/screenshot_optimized_428e9757-343d-46fb-a991-d65d2ba9eccc.jpg`
- Completion screen before entering the tracker: `<tmp>/T/screenshot_optimized_f6f43871-2797-4dcc-a999-9511a047b76d.jpg`
- Today screen after full fresh onboarding handoff: `<tmp>/T/screenshot_optimized_9d81f985-372e-458b-aff8-3f5355c73801.jpg`
- Settings screen after fixing the App Store review crash: `<tmp>/T/screenshot_optimized_b3f4103a-3088-402a-ab98-5f14677283a5.jpg`
- Data & import screen from Settings: `<tmp>/T/screenshot_optimized_292f584b-1b72-4f41-804b-9889f595d1eb.jpg`
- Settings privacy explainer round-trip: `<tmp>/T/screenshot_optimized_01f88965-ce1b-419a-9f6e-cb544e69dcc5.jpg`
- Restore-only backup screen after single-purpose framing cleanup: `<tmp>/T/screenshot_optimized_807ada8a-fa63-417c-910a-de9eacee640d.jpg`
- Export-only backup screen after single-purpose framing cleanup and calm pristine helper state: `<tmp>/T/screenshot_optimized_a86779e2-d68a-45d2-b25a-d3bbdd682dc1.jpg`
- Delete-local-data confirmation screen with explicit cancel/confirm split: `<tmp>/T/screenshot_optimized_4ffa0c95-0d56-4b1f-81bf-cd6f033dcb19.jpg`

## Findings

### Fixed

1. Welcome screen content was visually trapped behind a fixed footer
- Severity: High
- Result: the welcome CTA now renders inline so the trust copy and privacy link live in the natural scroll flow instead of being hidden behind a fixed action bar.

2. Multiple onboarding steps showed two competing back affordances
- Severity: Medium
- Result: onboarding steps that already have footer navigation no longer render an additional top back pill, reducing visual clutter and keeping recovery paths consistent.

3. Final onboarding completion could race on double tap
- Severity: High
- Result: the completion CTA is now disabled while save is in progress and guarded against repeated presses.

4. Condensed onboarding routes were silently rejected by the route guard
- Severity: High
- Result: the guard now recognizes the `basics -> goals -> ttc-setup/ttc-expectations -> setup-later` branch instead of always ejecting those screens back to the path selector.

5. Persisted onboarding draft hydration accepted malformed shapes too loosely
- Severity: High
- Result: persisted drafts are now sanitized field by field before hydration so invalid enums, arrays, and partial TTC preference payloads fall back to safe defaults instead of polluting resumed onboarding state.

6. TTC users in the condensed branch could finish onboarding without completing TTC setup
- Severity: High
- Result: the condensed route guard now requires the TTC setup and expectations steps before `setup-later`, and the TTC screens explicitly mark those steps complete when the user advances.

7. The iOS last-period-start screen overlapped footer actions with date quick picks
- Severity: High
- Result: `LastPeriodStartScreen` now uses an inline footer, matching the other dense onboarding forms so the iOS inline date picker and quick-pick chips keep their own tap space.
- Evidence: in the live simulator, the previous fixed footer occupied the same vertical region as the quick-pick row, and tapping a quick pick could bounce the user back to `start-path` instead of selecting a date.

8. The welcome screen still hid the first-run CTA below the fold after the inline-footer change
- Severity: High
- Result: the welcome screen is now materially shorter: the extra explainer card is gone, the opening copy is tighter, and the primary CTA sits inside the initial `iPhone 17` viewport in the live build instead of requiring a blind first scroll.

9. The iOS last-period-start screen still pushed the continue CTA partially below the fold after the first layout cleanup
- Severity: High
- Result: the redundant helper block under the quick-pick chips has been removed, which pulled the footer up from `y ≈ 846` to `y ≈ 794` in the live simulator and made the continue CTA fully visible on first view without reintroducing the earlier overlap bug.

10. The paywall still read like a policy page after the functional billing fallback was in place
- Severity: Medium
- Result: the redundant `What happens next` and `Billing terms` sections are gone. The paywall now keeps the billing status, the privacy-business-model rationale, and the two real actions without spilling dense explanatory copy far below the fold.

11. TTC expectations still allowed repeated submissions while the save was in flight
- Severity: High
- Result: `TtcExpectationsScreen` now disables both footer actions while saving, blocks repeated continue taps, and shows a stable saving state instead of allowing accidental duplicate submissions.

12. The condensed basics screen still buried its footer CTA below the first viewport
- Severity: High
- Result: the extra privacy card is gone, the hero and section copy are tighter, and the trust note now lives inline with the main form card. In the live `iPhone 17` simulator the condensed `basics` screen now exposes the CTA on first load instead of forcing a blind scroll before the user can continue.

13. The goals screen carried too much explanatory copy for an already long onboarding scroller
- Severity: Medium
- Result: the hero and section copy are now tighter, so the route reaches the first actionable panels faster without dropping any decisions or context.

14. TTC setup and expectations still had avoidable copy and hierarchy friction
- Severity: Medium
- Result: TTC setup now drops the redundant helper paragraph and keeps a shorter intro before the preference chips.
- Result: TTC expectations now uses the correct `Private by default` heading for the privacy card instead of pairing privacy copy under a `Used for tracking` title, and the top-level explainer is shorter.

15. Onboarding import and restore still allowed duplicate commit/restore actions while async work was in flight
- Severity: High
- Result: the onboarding import review CTA now disables immediately after the first tap, so duplicate import commits cannot be queued from repeated taps during the same review session.
- Result: backup restore preview and confirm now disable while the underlying async work is running, which prevents duplicate preview parsing and duplicate restore commits from the onboarding restore route.

16. Onboarding import screens still repeated the same page heading and description inside their content cards
- Severity: Medium
- Result: the onboarding import source-step, review-step, and completion-step screens now let the page header carry hierarchy and remove the redundant card-level title repetition, which makes the flow read faster and reduces unnecessary visual noise.

17. Legacy cycle-length and period-length onboarding steps still repeated the page hierarchy inside their main glass cards
- Severity: Medium
- Result: the cycle-length and period-length screens now let the page-level question own the hierarchy and drop the redundant `Usual cycle length` / `Usual period length` card headers, which reduces setup friction and brings those older onboarding steps in line with the cleaner condensed flow.

18. The in-app App Store review path could crash the live Settings screen when the configured iOS App Store id was missing or not a string at runtime
- Severity: High
- Result: review config is now normalized defensively before URL building, so Settings no longer crashes on `value.trim is not a function` when the App Store id arrives malformed or unset in the live runtime config.

19. Restore-only and export-only backup routes still looked like the generic backup hub
- Severity: Medium
- Result: the single-purpose backup routes now use mode-specific hero framing and remove the repeated inner card title/description, so `Restore backup` and `Export backup` each read like one focused action instead of a nested mini-hub.

20. Export-only backup started with an error-toned helper before the user typed anything
- Severity: Medium
- Result: the export screen now starts with the calmer local-encryption reassurance and only switches to mismatch guidance after the user begins entering conflicting passphrases.

21. Settings data-portability and destructive-control handoffs now have fresh live verification
- Severity: Verification
- Result: the Settings hub now has a confirmed live pass for review-link recovery, `Data & import`, privacy explainer round-trip, restore-only screen entry, export-only screen entry, and delete-data confirmation/cancel behavior.

### Remaining in Wave Backlog

1. Goals/conditions is still a dense long-form screen and needs continued visual review
- The live `goals` route remains a legitimate scroller because it holds three goal panels, irregular-cycle choices, and condition tags.
- The remaining work there is hierarchy and pacing polish, not forcing the entire route into one viewport.

2. Simulator routing into the condensed TTC screens is still flaky during repeated deep-link/manual passes
- Direct repeated deep-link inspection can still be noisy, but a full cold-start TTC pass is now complete in the live simulator.
- The live route now verifies `welcome -> start-path -> basics -> goals -> ttc-setup -> ttc-expectations -> setup-later -> /today` and confirms TTC chips appear on the resulting `Today` screen when TTC logging was enabled during onboarding.

3. Manual onboarding coverage is no longer blocked, but the live path is only partially completed
- The worktree iOS output was repaired by syncing the generated native files and rebuilding the dev client, so manual QA can proceed again.
- Fresh live verification has covered `welcome`, privacy round-trip, `start-path`, and reproduction of the `last-period-start` layout bug. The rest of the fresh/import/restore journey inventory still needs a full manual pass.

4. Import, restore, and deeper privacy-explainer/manual round-trips still need fresh simulator passes.
- Import now has a fresh live onboarding pass for the manual-history path from `start-path` through source selection, manual entry, preview, completion, and paywall handoff.
- Restore now has a fresh live onboarding pass for the entry screen, empty state, and explicit back path to `start-path`.
- Import still needs full document-selection coverage with real Clue/Flo fixture files.
- Restore still needs full preview/commit coverage with a real backup fixture file.
- The fresh non-TTC path now has a complete live pass from `welcome` to `/today`.
- The TTC-enabled branch now also has a complete cold-start live pass through `goals -> ttc-setup -> ttc-expectations -> setup-later -> /today`.
- The cold-start TTC pass exposed one expected validation nuance on `basics`: a truly fresh install does not seed a ready-to-submit last-period date, so the user must choose a quick pick or enter a date before continuing.
- The committed data-portability fixtures are intact and still verified by test: `flo-rich-history.json`, `clue-rich-history.cluedata`, `floriva-rich-history.snapshot.json`, and `floriva-rich-history.floriva` all parse or decrypt successfully in the automated fixture suite.

5. Native runtime warnings surfaced during simulator log capture
- iOS logs warn that the app delegate implements background fetch and remote-notification handlers without matching `UIBackgroundModes` entries in `Info.plist`.
- This may be harmless development scaffolding, but it needs explicit review before production signoff.

## Verification

Targeted red-green verification completed:

- `pnpm jest tests/features/onboarding/model.test.ts --runInBand`
- `pnpm jest tests/features/onboarding/model.test.ts tests/features/onboarding/OnboardingProvider.test.tsx tests/features/onboarding/OnboardingRouteGuard.test.tsx tests/features/onboarding/OnboardingFlow.test.tsx tests/features/app-shell/AppShellRouteGuard.test.tsx --runInBand`
- `pnpm jest tests/features/onboarding/OnboardingFlow.test.tsx --runInBand`
- `pnpm jest tests/features/onboarding/WelcomeScreen.test.tsx --runInBand`
- `pnpm jest tests/features/onboarding/OnboardingFlow.test.tsx --runInBand -t "keeps the last-period-start copy compact|keeps the last-period-start footer inline|validates the last period start date before continuing|updates the iOS inline date picker selection before continuing"`
- `pnpm jest tests/features/onboarding/OnboardingPaywallScreen.test.tsx --runInBand`
- `pnpm jest tests/features/onboarding/WelcomeScreen.test.tsx tests/features/onboarding/OnboardingFlow.test.tsx --runInBand`
- `pnpm jest tests/app/importRoutes.test.tsx tests/app/backupRoutes.test.tsx tests/features/import/ImportFlowScreens.test.tsx tests/features/backup/BackupScreen.test.tsx --runInBand`
- `pnpm jest tests/app/onboarding-smoke.test.tsx tests/app/onboarding-privacy-route.test.tsx tests/features/onboarding/OnboardingRouteGuard.test.tsx tests/features/app-shell/AppShellRouteGuard.test.tsx --runInBand`
- `pnpm jest tests/testing/qaFixtures.test.ts tests/testing/devLaunchPreset.test.ts --runInBand`
- `pnpm jest tests/features/review/storeReview.test.ts tests/features/settings/SettingsScreen.test.tsx --runInBand`
- `pnpm jest tests/features/backup/BackupScreen.test.tsx --runInBand`
- `pnpm jest tests/app/backupRoutes.test.tsx tests/features/settings/SettingsScreen.test.tsx --runInBand`

## Closure Update

Later on 2026-04-17, the remaining iOS closure work in this wave was finished and the report moved from a partial-audit snapshot to a near-signoff record.

### iOS closure completed

- Fresh non-TTC onboarding now has a full live pass from `welcome` to `/today` in the iOS simulator.
- Cold-start TTC onboarding now has a fresh live pass through `welcome -> start-path -> basics -> goals -> ttc-setup -> ttc-expectations -> setup-later -> /today`.
- The TTC cold-start pass confirmed the intended validation nuance after the recent CTA gating fixes: on a truly fresh install, `CycleBasicsScreen` does not start with a submit-ready date, so the user must choose a quick pick or enter a real last-period date before continuing.
- The resulting TTC `Today` screen showed the TTC logging chips as expected, including `today-logging-chip-ttc-sex-logged`, `today-logging-chip-ovulation-test-negative`, `today-logging-chip-ovulation-test-positive`, and `today-logging-chip-ovulation-test-peak`.
- Real file-picker selection is now verified end-to-end for both committed import fixtures:
  - `tests/fixtures/data-portability/clue-rich-history.cluedata`
  - `tests/fixtures/data-portability/flo-rich-history.json`
- Real restore preview and restore commit are now verified end-to-end with `tests/fixtures/data-portability/floriva-rich-history.floriva` and passphrase `fixture-passphrase`.

### Import and restore fix that enabled the live evidence

- The live document-picker work exposed a runtime incompatibility in the import path: the current import screens were calling `readAsStringAsync` through the non-legacy `expo-file-system` surface, which broke real document selection in the simulator.
- The import flow was updated to use `expo-file-system/legacy` where the real file contents are read, and the matching import tests were updated with the legacy mock surface.
- After that change, both Clue and Flo fixture imports completed live through real picker selection, preview, and commit.

### Native iOS warning decision

- The native warning about app delegate background fetch / remote notification selectors versus `Info.plist` background modes was triaged explicitly.
- The chosen fix was to keep `Info.plist` free of `UIBackgroundModes` and hide the inherited background selectors in `AppDelegate.swift` via `responds(to:)`, rather than claiming background capabilities the app is not intentionally using in this wave.
- A dedicated sanity guard now verifies that `Info.plist` still omits `UIBackgroundModes` and that the selector-hiding override remains present.
- Follow-up build/log verification did not reproduce the earlier background-mode warning.

### Review follow-up

- The dedicated review-agent pass surfaced one important issue after the live iOS evidence was refreshed: the fresh-start choice on `start-path` was tracked only in local screen state, so a relaunched condensed onboarding draft could fall back to `/start-path` instead of resuming the in-progress branch.
- That issue is now fixed by persisting an explicit fresh-path selection bit for the condensed branch and by resuming older persisted condensed drafts when they already contain onboarding progress.
- Focused onboarding tests, `pnpm typecheck`, and `pnpm test:smoke` all passed after the fix.
- A follow-up review pass over the repaired files reported no remaining blocking or important findings.

### Android closure completed

- Android parity was finished in the same worktree after fixing the native Android blocker instead of stopping at the earlier failed attempt.
- The Android support floor was aligned to the current native dependency set by raising `minSdkVersion` to `24` in both runtime config and checked-in Gradle config, and the local EAS signing helper was rewritten around `afterEvaluate` so debug/dev builds stop tripping over release-signing setup during `expo run:android`.
- A fresh Android dev client was then rebuilt and installed successfully on `Pixel_9_API_35`, which cleared the stale-client `ExpoAudio` mismatch from the earlier parity attempt.
- Fresh non-TTC onboarding completed live on Android from `welcome -> start-path -> basics -> goals -> setup-later -> /today`.
- Cold-start TTC onboarding completed live on Android from `welcome -> start-path -> basics -> goals -> ttc-setup -> ttc-expectations -> setup-later -> /today`, and the resulting `Today` surface showed the TTC-specific controls expected from the chosen setup:
  - `today-logging-chip-ttc-sex-logged`
  - `today-logging-chip-ovulation-test-negative`
  - `today-logging-chip-ovulation-test-positive`
  - `today-logging-chip-ovulation-test-peak`
  - TTC cervical-mucus chips and the `today-bbt-input`
- Real Android document-picker selection is now verified end to end for both committed onboarding import fixtures in emulator `Downloads`:
  - `tests/fixtures/data-portability/import/clue-rich-history.cluedata`
  - `tests/fixtures/data-portability/import/flo-rich-history.json`
- Real Android restore preview and restore commit are now verified end to end with `tests/fixtures/data-portability/backup/floriva-rich-history.floriva` and passphrase `fixture-passphrase`.
- The Android restore commit rehydrated straight into the billing surface after restore, which matches the restored app state being purchase-gated in this dev build; the restore itself completed and the fixture-backed preview counts were correct before commit.
- Android cold-start QA was still noisier than iOS because unconfigured dev builds mounted `useIAP()` and surfaced an `Expo-IAP` init error during onboarding. That noise is now fixed by skipping the store hook entirely when native billing product ids are absent, and a fresh Android welcome-screen sanity check after that change no longer showed the earlier LogBox/toast interruption.

### Current status

- iOS onboarding closure for this wave is verified, including real import and restore fixture coverage, the TTC rerun after CTA-gating fixes, the iOS warning decision, and the post-review verification pass.
- Android onboarding parity is now also verified live, including the fresh branch, cold-start TTC branch, real Clue/Flo picker imports, and real `.floriva` restore preview/commit.
- The Android no-config billing noise observed during QA is fixed in code and no longer interrupts a fresh Android welcome-screen cold start.
- Dedicated review follow-up on the onboarding resumability fix is clean.
- This onboarding wave is now signoff-ready as an onboarding-specific closure record; broader release readiness still depends on normal production billing/catalog setup outside this audit.
- `pnpm typecheck`

Baseline verified earlier in this worktree:

- `pnpm install --frozen-lockfile`
- `pnpm test:smoke`

## Next Recommended Wave

1. Move from onboarding-specific closure into broader release readiness: configure real production billing catalog ids and verify the paid-app/billing surfaces in native release-capable builds.
2. Run the dedicated final review pass for the Android follow-up changes if this branch is going to merge, then rerun the relevant verification slice after any review fixes.
3. Package the onboarding closure evidence into the merge/PR summary so the Android parity screenshots and fixture-backed restore/import coverage are easy to audit later.
