/**
 * Long-tenure probes for the import parsers (workstream E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment; resolution probes pin behavior that already holds.
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import {
  parseClueImport,
  parseFloImport,
  parseManualHistoryImport,
} from '@/src/lib/parsing/importParsers';

describe('RESOLVED — UTC/offset timestamps keep the literal logged calendar date (no off-by-one)', () => {
  it('a positive-offset timestamp crossing UTC midnight keeps its local calendar date', () => {
    // Logged 2026-04-02 00:30 in UTC+05:30 — the UTC instant is 2026-04-01
    // 19:00Z. A naive toISOString() read would shift the day to April 1;
    // the parser prefers the literal date prefix.
    const parsed = parseClueImport([
      { date: '2026-04-02T00:30:00+05:30', flow: 'medium' },
    ]);

    expect(parsed.entries.map((entry) => entry.logDate)).toEqual(['2026-04-02']);
  });

  it('a late-evening Z timestamp keeps its written date in west-of-UTC zones', () => {
    // 2026-01-01T23:30Z written on Jan 1 — a local-time read in UTC-6 would
    // land on Jan 1 anyway, but a *local* Date parse then local read-back of
    // an east-of-UTC wall clock could shift; the literal prefix wins.
    const parsed = parseClueImport([
      { date: '2026-01-01T23:30:00Z', flow: 'light' },
    ]);

    expect(parsed.entries.map((entry) => entry.logDate)).toEqual(['2026-01-01']);
  });

  it('a year-boundary offset timestamp does not slide into the previous year', () => {
    const parsed = parseFloImport([
      { recordedAt: '2027-01-01T00:15:00+11:00', category: 'flow', value: 'heavy' },
    ]);

    expect(parsed.entries.map((entry) => entry.logDate)).toEqual(['2027-01-01']);
  });
});

describe('RESOLVED LT-07 — 12-month cutoff asymmetry between file imports and manual quick-entry is a documented, intentional policy', () => {
  it('Clue/Flo file imports accept rows 7+ years old without any age cutoff or warning (strategic: import is a flagship feature; old data cannot hurt the 12-interval-windowed engine)', () => {
    // File imports (parseClueImport / parseFloImport) apply NO lookback
    // window — 2019-dated rows import in full. (The committed on-disk
    // fixtures import/clue-older-than-12-months.cluedata and
    // flo-older-than-12-months.json pin the same fact end-to-end in
    // tests/testing/qaFixtures.test.ts; this inline probe keeps both sides
    // of the policy visible in one file.)
    const clue = parseClueImport([
      { day: '2019-02-11T06:00:00.000Z', flow: 'medium' },
      { day: '2019-02-12T06:00:00.000Z', flow: 'light' },
    ]);
    const flo = parseFloImport([
      { recordedAt: '2018-11-05T08:00:00.000Z', category: 'flow', value: 'heavy' },
    ]);

    expect(clue.entries.map((entry) => entry.logDate)).toEqual(['2019-02-11', '2019-02-12']);
    expect(clue.skippedRows).toHaveLength(0);
    expect(flo.entries.map((entry) => entry.logDate)).toEqual(['2018-11-05']);
    expect(flo.skippedRows).toHaveLength(0);
  });

  it('manual quick-entry REJECTS the same-age dates once the caller-provided 12-month lookback applies (deliberate UX simplification, not a data policy)', () => {
    // ImportFlowProvider (and the legacy ImportScreen) always pass
    // lookbackStartIso = today minus 1 year for the manual path via the
    // single shared getManualHistoryLookbackStartIso (src/features/import/
    // model.ts -- previously duplicated verbatim in both files; deduped as
    // part of LT-07).
    //
    // DECISION (documented at both call sites and on the helper itself):
    // this asymmetry is intentional, not a bug. File import keeps full
    // history because import is a strategic feature and old data respects
    // user ownership at zero cost (the engine windows itself to 12
    // intervals regardless of how much is stored). Manual quick-entry's cap
    // is a deliberate UX simplification of a hand-picked-dates flow: a user
    // with genuinely old history should use file import instead. This
    // probe pins both sides of the now-documented policy.
    const parsed = parseManualHistoryImport({
      periodStarts: ['2019-02-11', '2026-06-01'],
      lookbackStartIso: '2025-07-06',
    });

    expect(parsed.entries.map((entry) => entry.logDate)).toEqual(['2026-06-01']);
    expect(parsed.skippedRows).toHaveLength(1);
    expect(parsed.skippedRows[0]?.message).toContain('12-month manual import window');
  });
});
