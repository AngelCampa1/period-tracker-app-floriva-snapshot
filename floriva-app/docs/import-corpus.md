# Import Corpus Workflow

Floriva keeps public Flo and Clue research files out of committed regression fixtures until they are reviewed. The local corpus lives under `floriva-app/.local/import-corpus/` and is gitignored by default.

## Directory Layout

```text
.local/import-corpus/
├── clue/
│   ├── candidate/
│   ├── reviewed/
│   └── rejected/
└── flo/
    ├── candidate/
    ├── reviewed/
    └── rejected/
```

Store each sample file next to a manifest with the same base name:

```text
measurements.json
measurements.manifest.json
```

## Manifest Schema

Every sample must carry provenance metadata:

```json
{
  "schemaVersion": 1,
  "sourceUrl": "https://example.com/sample",
  "retrievalDate": "2026-04-16",
  "fileName": "measurements.json",
  "claimedApp": "clue",
  "discoveredContainerShape": "object:data[]",
  "sha256": "replace-with-sha256",
  "trustNotes": "Why this file is trustworthy enough to inspect locally.",
  "reviewerDecision": "pending"
}
```

Required fields:
- `sourceUrl`
- `retrievalDate`
- `fileName`
- `claimedApp`
- `discoveredContainerShape`
- `sha256`
- `trustNotes`
- `reviewerDecision`

Optional fields:
- `reviewNotes`
- `reviewedAt`
- `searchTier`

## Acquisition Order

Treat public sample search as a deliberate workflow:

1. Official help and support docs that describe the current export path.
2. Third-party importer docs or issues that reference real export files.
3. GitHub repositories, gists, or issues that include downloadable sample exports or converter test data.
4. Archived troubleshooting posts only when they include an actual file, not screenshots or copy-only descriptions.

Text-only descriptions do not count as corpus inputs.

## Commands

- `pnpm corpus:profile`
  Creates the local directory layout if needed, scans the selected corpus statuses, and writes a machine-readable report to `.local/import-corpus/profile-report.json`.

- `pnpm test:corpus`
  Scans reviewed samples only, writes `.local/import-corpus/reviewed-report.json`, prints a coverage matrix by source and top-level shape, and exits non-zero if reviewed samples are missing manifests or review metadata.

Useful flags for both scripts:

- `--root <path>` to use a different corpus directory
- `--write <path>` to override the output report path

`pnpm corpus:profile` also supports:

- `--statuses candidate,reviewed,rejected`

## Promotion Rules

Public files stay in the research corpus first. Do not move them into committed regression fixtures until all of the following are true:

1. The sample has a valid provenance manifest.
2. The sample has manual review metadata.
3. The detected file shape matches the documented reviewed shape.
4. The parser outcome is stable and intentionally understood.
5. Any redaction needed for long-term fixture storage has been completed.

In phase 1, the committed fixtures under `tests/fixtures/data-portability/import` remain synthetic and unchanged.

## Current Export Anchors

- Clue Support, October 1, 2025: Clue sends tracked data and settings in JSON via email.
- Read Your Body Clue guide, February 17, 2026: the useful file is `measurements.json` inside the ZIP.
- Flo Help, March 19, 2026: Flo export is requested through support and delivered as JSON by email.
- Read Your Body Flo guide, February 17, 2026: the useful Flo file is the JSON inside the emailed ZIP.
