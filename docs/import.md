# Import

Import is a strategic feature, not a convenience. A period tracker competes for users who already
have years of history in Clue or Flo, and the switching cost is that history. So the parser is the
largest authored logic module in the codebase:
[floriva-app/src/lib/parsing/importParsers.ts](../floriva-app/src/lib/parsing/importParsers.ts),
1,500 lines, ahead of `src/db/repositories.ts` at 1,354. (Two files are larger and neither is logic:
`src/localization/messages/settings.ts` is 2,922 lines and `onboarding.ts` 1,958, both eight-locale
message catalogs: see [localization.md](localization.md).) It is treated as an untrusted-input
boundary, because that is exactly what it is:
arbitrary JSON, from a file the user picked, from an export pipeline nobody here controls.

---

## 1. Formats and how the shape is resolved

Three sources (`ImportSource`): **Clue**, **Flo**, and a **manual** period-history JSON used by the
quick-entry fallback. There is deliberately **no content sniffing**: the user selects the source in
the UI, and [model.ts](../floriva-app/src/features/import/model.ts):30-40 dispatches on it:

```ts
function parseImportPayload(source: ImportSource, payload: unknown): ParsedImportDocument {
  if (source === 'clue') {
    return parseClueImport(payload);
  }
  if (source === 'flo') {
    return parseFloImport(payload);
  }
  return parseManualHistoryImport(payload);
}
```

Guessing the vendor from the file contents would be a heuristic that fails silently and mis-maps the
user's vocabulary; asking is one extra tap and is always right. What the parsers *do* detect is the
**container shape within** the declared source, because each vendor's export format has drifted over
the years.

**Clue**: `extractClueRows` (`:959-981`): a top-level array, or an object with `data[]` or
`trackedData[]`. Anything else throws `UnsupportedImportShapeError`.

**Flo**: `extractFloRows` (`:1071-1154`): an array, or an object with `data[]` or `values[]`,
*plus* cycle containers under `operationalData.cycles` / `update.cycles`. Those are expanded from a
`{period_start_date, period_end_date}` pair into an inclusive per-day range of `bleeding: 'medium'`
rows (`:1095-1131`). A cycle whose dates are missing, uncoercible, or reversed degrades to a
single-date row rather than being dropped (`:1107-1117`).

**Manual**: `parseManualHistoryImport` (`:1397-1472`): an object with a `periodStarts[]` array,
each element a date string, materialized as `bleeding: 'medium'` entries.

### Field mapping and ambiguity

Clue emits long-format `{date, type, value}` rows. `adaptClueRow` (`:983-1069`) maps them by metric
name:

| metric tokens | target |
|---|---|
| `period`, `bleeding`, `flow` | `bleeding` |
| `pain`, `symptom`, `symptoms` | `symptoms[]` |
| `feeling(s)`, `emotion(s)`, `mood` | `mood` |
| `discharge`, `cervical mucus` | `ttcObservation.cervicalMucus` |
| `ovulation`, `ovulation test`, `opk` | `ttcObservation.ovulationTest` |
| `bbt`, `temperature`, `basal body temperature` | `ttcObservation.basalBodyTemperatureCelsius` |

Flo instead emits one row *per metric per day*, so `adaptFloMetricRow` (`:1209-1336`) matches by
substring (`normalizedMetric.includes('symptom')`, etc.) and `parseFloImportDocument` (`:1338-1385`)
aggregates per date into a single row via `mergePartialFloRow`.

Vocabulary differences are absorbed by three alias tables (`:47-94`): `symptomAliasMap` (`cramping
→ cramps`, `tired → fatigue`, `sore breasts → breast-tenderness`), `moodAliasMap`
(`anxious|irritable|stressed|moody → sensitive`, `happy|good|fine|normal|okay|calm → steady`), and
`birthControlMethodAliasMap`. Every lookup goes through `normalizeToken` (`:265-271`), which
lowercases and collapses `_`/`-`/whitespace, so `Breast_Tenderness` and `breast tenderness` land in
the same bucket.

Ambiguity is resolved by explicit precedence rules rather than by whichever row happened to be last:

- **Bleeding conflicts take the maximum by rank.** `bleedingRanks` (`:36-42`) orders `none <
  spotting < light < medium < heavy`, and both `mergeBleeding` (`:362-364`) and `findBleedingValue`
  (`:606-633`) fold multiple values with it. Two rows for one day, one saying `light` and one saying
  `heavy`, resolve to `heavy`: under-reporting a period is the worse error.
- **Symptoms union and dedupe** (`mergeSymptoms`, `:350-360`).
- **Scalars are first-wins** (`mood`, `notes`): `existing.entry.mood ?? entry.mood` (`:421-422`).
- **Nested objects shallow-merge**: later `ttcObservation` keys win per-field (`:399-405`), so a
  temperature row and a mucus row for the same day combine rather than clobber.
- **A Clue metric row that carries a symptom/mood/TTC value but no bleeding gets `bleeding: 'none'`
  injected** (`:1061-1066`), because the domain requires a bleeding value and absence of a flow
  record is genuinely "no bleeding," not missing data.

---

## 2. Hostile and malformed input

`coerceIsoDate` (`:165-248`) is where most of the adversarial thinking lives. It is a small essay on
why `new Date()` cannot be trusted with user-supplied strings.

**Invalid calendar dates are rejected, not overflowed** (`:186-192`):

```ts
// If the string looks like a strict ISO date (YYYY-MM-DD) but failed
// isIsoDate above, it is an invalid calendar date (e.g. "2026-02-30",
// "2023-02-29").  Do NOT fall through to new Date() which would silently
// overflow to the next valid date — reject it outright.
if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
  return null;
}
```

`new Date('2026-02-30')` yields March 2, and recording a period start on the wrong day silently is
worse than skipping the row and telling the user.

**Offset-carrying timestamps prefer the literal date prefix** (`:194-213`):
`2026-04-02T00:30:00+05:30` was logged on April 2 in the user's zone, but `toISOString()` reads it
back as April 1. The code takes the first 10 characters when they form a valid date, and only falls
back to a UTC read otherwise.

**The V8 leniency guard** (`:215-223`, quoted verbatim):

```ts
// Guard against V8's lenient `new Date()` silently coercing leading garbage
// into a real date (e.g. `new Date('🌸🌸-04-01')` returns 2001-04-01). A
// genuine locale-style date is composed only of ASCII letters/digits and the
// small set of separators date formats use. Anything containing emoji, CJK,
// control characters, or other unexpected code points is corrupted input and
// must be rejected rather than recorded as a confidently-wrong calendar date.
if (!/^[A-Za-z0-9][A-Za-z0-9 ./,:+\-T]*$/.test(trimmed)) {
  return null;
}
```

This is a real, reproducible engine behaviour, not a hypothetical. The allowlist is deliberately
narrow (an anchored first character plus a fixed separator set) because a denylist of "bad" code
points would have to be exhaustive.

**Locale-style dates are read back in local time** (`:225-247`): after `new Date(trimmed)` (which
parses bare date strings as *local* midnight), the code reconstructs the ISO string from
`getFullYear/getMonth/getDate`, never `toISOString()`. "March 28" in UTC+12 must not become March
27.

Beyond dates:

- **Unbounded range expansion is capped.** `MAX_PERIOD_DAYS = 90` (`:685-688`) and
  `buildInclusiveIsoDateRange` (`:696-719`) return `null` above it, so a Flo cycle with
  `period_end_date: "9999-12-31"` skips instead of allocating a three-million-element array. The
  comment names the failure mode: "would cause an OOM/hang [...] if left unchecked."
- **Physiological sanity bounds.** Temperatures outside 30 to 45 °C are dropped at every entry
  point (`:863`, `:1047`, `:1300`, `:547-551`), and Clue rows the user marked `excluded: true` are
  honoured (`:1040-1047`).
- **The manual-import lookback guard** (`:1418-1423`):

  ```ts
  // Only honour lookbackStartIso if it is itself a valid strict ISO date.
  // An invalid (non-string, garbage, or overflowed) value would cause
  // incorrect string comparisons: e.g. "garbage" > any YYYY-... string,
  // silently discarding all entries.
  const lookbackStartIso = isIsoDate(rawLookback) ? rawLookback : undefined;
  ```

  The filter downstream is a lexicographic `logDate < lookbackStartIso`: correct for ISO dates and
  catastrophic for anything else.
- **Notes are truncated to 500 characters** (`:521`).
- **Enum fields are allowlist-validated, not cast.** `normalizeImportRow` (`:476-590`) re-checks
  `cervicalMucus`, `ovulationTest`, `sexLogged`, and `birthControlEvent.method` against literal
  arrays even when the row arrived pre-shaped from an adapter: the adapters are convenience, not
  trust.
- **Unrecognized-but-meaningful data warns rather than vanishing.** `warnUnsupportedClueFields`
  (`:327-348`) reports any unknown key with a meaningful value against `supportedClueKeys`
  (`:96-149`); unknown Clue metric types (`:1052-1058`) and unknown Flo categories (`:1329-1333`)
  warn too. The user is told what did *not* come across.

Every rejected row becomes a structured record rather than a silent drop:

```ts
skippedRows.push({
  rowNumber,
  reason: 'invalid',
  message: `Row ${rowNumber} has an invalid date.`,
});
```

`ImportSkippedRow` carries `reason: 'invalid' | 'unsupported'`, which `buildSkippedSummary`
([model.ts](../floriva-app/src/features/import/model.ts):61-68) splits into `invalidCount` /
`unsupportedCount` and surfaces separately in the review step and the final result.

### File-level defenses

Before any of that runs,
[`ImportFlowProvider`](../floriva-app/src/features/import/ImportFlowProvider.tsx) (`:36-57`,
`:250-279`) applies three guards:

```ts
// 50 MB hard cap. A real Clue/Flo JSON export is typically <2 MB even for years
// of data. Anything beyond this cap is almost certainly malformed or malicious,
// and passing it to JSON.parse risks OOM-killing the JS thread on low-end devices.
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
```

a UTF-8 BOM strip (`stripBom`, `:55-57`), because some export tools prepend U+FEFF, which makes
`JSON.parse` throw on otherwise-valid JSON, and a MIME denylist:

```ts
const UNSUPPORTED_IMPORT_MIME_PREFIXES = ['image/', 'video/', 'audio/'] as const;
```

Those types appear in the picker's `type` list at all (`:36-45`) only because Android's document
picker misreports JSON MIME types; widening the picker was the only way to make real exports
selectable, so the denylist re-narrows it after selection. `JSON.parse` failure, oversize, and wrong
media type each produce a distinct localized error rather than a generic one.

---

## 3. The import flow

Routes are duplicated under both `app/(app)/import/` and `app/(onboarding)/import/` (`index` →
`source/[source]` → `review` → `complete`), sharing one provider and one set of screen components so
the onboarding and settings entry points cannot drift.

[`ImportFlowProvider`](../floriva-app/src/features/import/ImportFlowProvider.tsx) holds the whole
flow's state and exposes a small context: `previewFileImport`, `previewManualHistory`,
`removePreviewEntry`, `commitPreview`, plus error and progress state.

### Preview before commit

Nothing is written until the user has seen what will be written. `previewImport`
([model.ts](../floriva-app/src/features/import/model.ts):188-220) parses, then queries the database
for the dates it is about to touch:

```ts
const uniqueDates = [...new Set(parsed.entries.map((entry) => entry.logDate))];
const existingEntries = await repositories.dailyLogs.listByDates(uniqueDates);
const existingDates = new Set(existingEntries.map((entry) => entry.logDate));
...
const importableEntries = parsed.entries.filter((entry) => !existingDates.has(entry.logDate));
```

The resulting `ImportPreview` carries `importableEntries`, `duplicateSummary`, `skippedSummary`,
`warnings`, `dateRange`, and a `confidence` label of high/medium/low computed by
`buildImportConfidence` (`:83-119`): `high` only when there is something to import and nothing was
skipped or duplicated; `low` when nothing is importable; `medium` in between. Every label ships with
machine-readable `reasons` (`reviewed-days-ready`, `duplicate-dates-skipped`, `rows-skipped`) so the
review screen explains the label instead of asserting it.

If a preview yields literally nothing to say (no entries, no duplicates, no skips, no warnings),
the flow refuses to advance and shows an error (`hasPreviewableHistory`,
[ImportFlowProvider.tsx](../floriva-app/src/features/import/ImportFlowProvider.tsx):97-105) rather
than presenting an empty review screen. The user can also drop individual days from the preview;
`removePreviewEntry` (`:185-213`) recomputes confidence and date range and increments
`editedEntryCount`, reported back in the commit result.

### Dedupe and merge

Deduplication happens at three layers, deliberately:

1. **Within the parsed document.** `mergeEntries` (`importParsers.ts:377-439`) folds multiple rows
   for the same date using the precedence rules in §1 and emits a warning naming the count: `Merged
   3 Clue rows for 2026-04-02.`
2. **Against existing local data at preview time**, as above.
3. **Again at commit time**, because time passes between preview and commit and the user may have
   logged that day in the interim ([model.ts](../floriva-app/src/features/import/model.ts):226-231).

The final safety net is at the repository contract
([floriva-app/src/db/contracts.ts](../floriva-app/src/db/contracts.ts):41):

```ts
saveEntryIfDateAbsent: (entry: DailyLogEntry) => Promise<boolean>;
```

Import never calls `saveEntry`. It calls the conditional variant and counts the `false` returns as
duplicates ([model.ts](../floriva-app/src/features/import/model.ts):251-269). **Import can add days;
it can never overwrite one.** A user's own logged entry always wins over an imported one.

Commit is transactional-by-compensation
([model.ts](../floriva-app/src/features/import/model.ts):222-317): a session row is written as
`pending`, entries are saved with deterministic ids (`import-{sessionId}-{logDate}`), and on any
failure every already-saved entry id is deleted and the session is marked `failed`. The stable id
scheme means a partial import is reversible without a diff.

### One deliberate asymmetry

File imports accept history of **any** age; manual quick-entry caps at 12 months.
[model.ts](../floriva-app/src/features/import/model.ts):142-166 argues the case:

> File imports (parseClueImport / parseFloImport) accept history of any age with
> no lookback cutoff. Import is a flagship/strategic feature [...] a long-tenure
> switcher's full history is exactly what makes Floriva worth switching to, and
> old data cannot hurt the prediction engine even if it can't help it beyond a
> point — buildPredictionResult windows its own statistics to the most recent 12
> completed intervals [...] Manual quick-entry [...] caps at 12 months back. This
> is a deliberate UX simplification of a hand-picked-dates flow, not a
> data-integrity or trust policy.

Rows outside the manual window are skipped as `reason: 'unsupported'` with an explanatory message,
not as invalid data.

---

## 4. The import-corpus harness

The hardest problem in this subsystem is not parsing. It is that you cannot commit real users' Clue
or Flo exports to a public repo, and you cannot write a robust parser against data you invented
yourself: invented fixtures encode the same assumptions the parser already has. The harness
([importCorpus.ts](../floriva-app/src/testing/importCorpus.ts), 567 lines) makes sample collection a
governed, reproducible process against a **gitignored, provenance-tracked local corpus**:

```
.local/import-corpus/
├── clue/{candidate,reviewed,rejected}/
└── flo/{candidate,reviewed,rejected}/
```

### The manifest

Every sample must sit beside a `{basename}.manifest.json` validated by a Zod schema (`:47-65`):

```ts
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceUrl: z.string().trim().url(),
  retrievalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  fileName: z.string().trim().min(1),
  claimedApp: z.enum(importCorpusSources),
  discoveredContainerShape: z.string().trim().min(1),
  sha256: z.string().trim().min(1),
  trustNotes: z.string().trim().min(1),
  reviewerDecision: z.enum(['pending', 'accepted', 'rejected']),
  ...
});
```

This is chain of custody. `sourceUrl` and `retrievalDate` say where the file came from and when;
`trustNotes` is a required free-text justification for why the file was safe to open at all;
`reviewerDecision` records a human's call.

**The sha256 is the load-bearing field.** `profileImportSampleFile` (`:355-461`) re-hashes the file
on every scan and compares:

```ts
if (manifest.sha256 !== sha256) {
  deltas.push('Manifest sha256 does not match the current sample contents.');
}
```

Because the corpus is gitignored, git cannot tell you a sample changed. The hash pin means a
reviewed-and-accepted sample cannot be quietly edited to make a failing parser pass: the review
decision is bound to specific bytes, not to a filename.

### The delta report

`buildFieldShapeDeltas` (`:295-353`) is the part that actually produces new information. It compares
each sample against the parser's **declared** assumptions (`supportedTopLevelShapes` (`:36-45`) and
`supportedDateKeys` (`:21-34`)) and reports every divergence:

```ts
if (!supportedTopLevelShapes[source].has(topLevelContainerShape)) {
  deltas.push(
    `Top-level shape ${topLevelContainerShape} is outside Floriva's current ${source} parser assumptions.`,
  );
}
const unexpectedDateKeys = likelyDateKeys.filter((key) => !supportedDateKeys.has(key));
```

Alongside it, `inferTopLevelContainerShape` (`:145-167`) canonicalizes the container (`array`,
`object:data[]`, `object:trackedData[]`, or a sorted key join), `collectKeyInsights` (`:203-228`)
harvests likely date keys vs metric keys by regex across every row, and the real parser is run and
its outcome classified as `clean | partial | unsupported | invalid` (`:279-293`). The output is a
machine-readable "here is where reality diverged from my parser's assumptions" report plus a
coverage matrix keyed by `source:containerShape`.

### The promotion gate

`canPromoteToFixture` (`:455-459`) is the only path from "a file off the internet" to "a committed
regression fixture":

```ts
canPromoteToFixture:
  status === 'reviewed' &&
  manifest?.reviewerDecision === 'accepted' &&
  (parseResult === 'clean' || parseResult === 'partial') &&
  issues.length === 0,
```

`profileImportSampleFile` also raises issues for a reviewed sample missing a manifest, a reviewed
sample whose decision is not `accepted`, and a rejected sample whose decision does not say
`rejected` (`:422-436`): the directory and the manifest must agree.

### The two commands

- `pnpm corpus:profile`
  ([scripts/profile-import-corpus.ts](../floriva-app/scripts/profile-import-corpus.ts)) scans all
  statuses (or `--statuses candidate,reviewed`) and writes `profile-report.json`. Exploration; never
  fails the build.
- `pnpm test:corpus` ([scripts/run-import-corpus.ts](../floriva-app/scripts/run-import-corpus.ts))
  scans **only** `reviewed`, writes `reviewed-report.json`, and `process.exitCode = 1` if any issue
  exists (`:55-60`). Enforcement.

The workflow (including a documented acquisition order that ranks official export docs above
archived forum posts, and an explicit rule that "text-only descriptions do not count as corpus
inputs") is written up in
[floriva-app/docs/import-corpus.md](../floriva-app/docs/import-corpus.md).

What this buys: a data-acquisition *process* encoded as tooling, so the answer to "how do you know
your parser handles real Flo exports?" is a reproducible report rather than an assertion, while the
repo itself stays free of anyone's real reproductive data.

---

## 5. Test coverage

**350 `it()` cases** across six parser suites in
[floriva-app/tests/lib/parsing/](../floriva-app/tests/lib/parsing/), plus **176** across eight
flow/model suites in [floriva-app/tests/features/import/](../floriva-app/tests/features/import/):

| suite | cases | focus |
|---|---|---|
| `importParsers.test.ts` | 13 | baseline behaviour per source |
| `importParsers.adversarial.test.ts` | 40 | first adversarial pass |
| `importParsers.clueManual.adversarial.test.ts` | 94 | Clue long-format + manual path |
| `importParsers.probe.adversarial.test.ts` | 112 | broad hostile-input probe |
| `importParsers.realworld.probe.adversarial.test.ts` | 86 | messy realistic export shapes |
| `importParsers.probe.longTenure.test.ts` | 5 | multi-year histories |

The adversarial suites are written as independent attacks rather than mirrors of the implementation.
The realworld probe states its own contract in its header: it targets shapes "NOT already covered by
the four existing test files" and flags any failing assertion as `SUSPECTED BUG #n` with
expected-vs-actual, which is how the date-coercion defenses in §2 were found rather than imagined.
That file also carries a **literal NUL byte** at offset 23,722, in the fixture for `stores notes with
null bytes without crash (if present in string)`: real rather than escaped, which makes the file
binary to `grep` and `file(1)` (a blunt way to prove the parser survives a control character no
well-behaved export would produce).

On the flow side, `ImportFlowProvider.test.tsx` (22) covers the size cap, BOM, MIME denylist, and
JSON-parse failure paths; `importWorkflow.test.ts` (12) and `importModel.adversarial.test.ts` (25)
cover preview/commit, duplicate counting, and the compensating rollback;
`importIngestion.adversarial.test.tsx` (17) covers end-to-end ingestion.

Coverage is enforced at 95% lines/statements/functions
([jest.config.js](../floriva-app/jest.config.js):78-83) plus a per-file check in
[scripts/check-coverage.js](../floriva-app/scripts/check-coverage.js):14.

---

## 6. Known limitations

- **No CSV or ZIP handling.** Both vendors deliver a ZIP by email; the user must unzip and select
  the JSON themselves. The parser accepts only parsed JSON.
- **Format detection is user-declared.** Selecting "Clue" and picking a Flo file produces an
  `UnsupportedImportShapeError` (good) or, if the container shape happens to match, a partial import
  governed by Clue's alias tables (less good).
- **The alias tables are authored** from documented export vocabularies. Any metric name not in
  them is warned-about and dropped, visible to the user, but still a data loss.
- **The corpus is local-only by construction**, so the shape coverage the harness reports is only as
  broad as the samples an individual developer has legitimately obtained. The tooling makes that gap
  measurable; it does not close it.
- **`buildImportConfidence` labels effort, not correctness.** A `high` label means "everything
  parsed and nothing collided," not "the mapping is right."
