# QA Data Portability Fixtures

- `import/clue-rich-history.cluedata`: committed Clue import fixture.
- `import/flo-rich-history.json`: committed Flo import fixture.
- `import/clue-older-than-12-months.cluedata`: Clue export fixture whose rows
  all predate the fixture reference date by more than 12 months. Exists to
  prove (workstream E / Phase 0 finding) that the Clue/Flo file-import
  parsers apply no age cutoff -- only the manual quick-entry import path
  enforces a 12-month lookback.
- `import/flo-older-than-12-months.json`: same purpose as above, Flo-shaped.
- `backup/floriva-rich-history.snapshot.json`: decrypted backup snapshot fixture.
- `backup/floriva-rich-history.floriva`: encrypted Floriva backup package.
- `backup/floriva-long-tenure-12mo.snapshot.json`: decrypted 12-month
  long-tenure backup snapshot (workstream E, Phase 2), built from the
  deterministic `tenure-12mo-regular` fixture in `src/testing/tenureFixtures.ts`.
- `backup/floriva-long-tenure-12mo.floriva`: encrypted package for the
  12-month long-tenure snapshot above (its own salt/nonce, same passphrase).
- Backup passphrase (all `.floriva` packages above): `fixture-passphrase`.

Regenerate with `pnpm fixtures:generate`.
