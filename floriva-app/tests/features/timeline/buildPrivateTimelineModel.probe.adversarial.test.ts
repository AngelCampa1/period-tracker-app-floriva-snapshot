/**
 * PROBE: adversarial edge-case tests for buildPrivateTimelineModel
 * and normalizeTimelineDate / formatLocalTimelineDate.
 *
 * Asserts CORRECT behaviour. Failing tests that represent genuine bugs are
 * marked // SUSPECTED BUG.
 */

import { buildPrivateTimelineModel } from '@/src/features/timeline/buildPrivateTimelineModel';
import {
  formatLocalTimelineDate,
  normalizeTimelineDate,
} from '@/src/features/timeline/date';
import type { DailyLogEntry } from '@/src/types/domain';
import type { PrivateTimelineImportSummary } from '@/src/features/timeline/types';

// -----------------------------------------------------------------------
// Fixture helpers
// -----------------------------------------------------------------------

function makeLog(overrides: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    id: 'log-1',
    logDate: '2026-05-01',
    bleeding: 'none',
    symptoms: [],
    ...overrides,
  };
}

function makeImport(overrides: Partial<PrivateTimelineImportSummary> = {}): PrivateTimelineImportSummary {
  return {
    id: 'import-1',
    source: 'clue',
    status: 'committed',
    startedAt: '2026-01-15T10:00:00.000Z',
    importedLogCount: 10,
    skippedLogCount: 0,
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// 1. normalizeTimelineDate
// -----------------------------------------------------------------------

describe('normalizeTimelineDate', () => {
  it('passes through a valid YYYY-MM-DD string unchanged', () => {
    expect(normalizeTimelineDate('2026-06-01')).toBe('2026-06-01');
  });

  it('passes through leap-year date unchanged', () => {
    expect(normalizeTimelineDate('2024-02-29')).toBe('2024-02-29');
  });

  it('converts an ISO 8601 timestamp to a date-only string', () => {
    // Use a UTC midnight to make the result timezone-stable for this call path:
    // normalizeTimelineDate parses with new Date() and then uses getFullYear/getMonth/getDate
    // (local time). We cannot assert exact date without knowing the test runner TZ,
    // but we CAN assert the result looks like a date string.
    const result = normalizeTimelineDate('2026-03-15T00:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does NOT return undefined or throw for an ISO timestamp', () => {
    expect(() => normalizeTimelineDate('2026-03-15T12:34:56.789Z')).not.toThrow();
    expect(normalizeTimelineDate('2026-03-15T12:34:56.789Z')).toBeTruthy();
  });

  it('a string that looks like a date but has a time component is NOT returned as-is', () => {
    // The regex only matches exactly YYYY-MM-DD; timestamps fall through to new Date()
    const result = normalizeTimelineDate('2026-06-01T00:00:00Z');
    // Must still be a date-only string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// -----------------------------------------------------------------------
// 2. formatLocalTimelineDate
// -----------------------------------------------------------------------

describe('formatLocalTimelineDate', () => {
  it('pads single-digit month and day with zeros', () => {
    // new Date(year, monthIndex, day) — Jan is 0
    const date = new Date(2026, 0, 5); // Jan 5 2026
    expect(formatLocalTimelineDate(date)).toBe('2026-01-05');
  });

  it('handles December correctly (month 11 → 12)', () => {
    const date = new Date(2026, 11, 31);
    expect(formatLocalTimelineDate(date)).toBe('2026-12-31');
  });

  it('handles leap year Feb 29', () => {
    const date = new Date(2024, 1, 29); // Feb 29 2024
    expect(formatLocalTimelineDate(date)).toBe('2024-02-29');
  });

  it('handles non-leap Feb 28 (no overflow)', () => {
    const date = new Date(2023, 1, 28);
    expect(formatLocalTimelineDate(date)).toBe('2023-02-28');
  });
});

// -----------------------------------------------------------------------
// 3. Monthly briefing — edge cases NOT in existing tests
// -----------------------------------------------------------------------

describe('monthly briefing — adversarial', () => {
  /**
   * SUSPECTED BUG: when all logs fall in different months, the monthly briefing
   * is anchored on the most recent log's month and counts only logs in THAT month.
   * If only one log exists in the most recent month, the count should be 1.
   * Verify the singular form "1 local log reviewed" is used.
   */
  it('uses singular form "1 local log reviewed" when only one log exists in the latest month', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'may-only', logDate: '2026-05-15', bleeding: 'light' }),
        makeLog({ id: 'apr-1', logDate: '2026-04-10', bleeding: 'none' }),
        makeLog({ id: 'apr-2', logDate: '2026-04-20', bleeding: 'none' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');
    expect(briefing?.detail).toBe('1 local log reviewed');
  });

  it('monthly briefing id encodes the YYYY-MM prefix of the latest log', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'log-x', logDate: '2026-03-22', bleeding: 'light' })],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');
    expect(briefing?.id).toBe('monthly-briefing-2026-03');
  });

  it('monthly briefing date is the latest log date, not the first of the month', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'early', logDate: '2026-06-01', bleeding: 'none' }),
        makeLog({ id: 'latest', logDate: '2026-06-28', bleeding: 'light' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');
    expect(briefing?.date).toBe('2026-06-28');
  });

  it('monthly briefing crosses year boundary — uses only the most-recent year-month', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'dec', logDate: '2025-12-30', bleeding: 'none' }),
        makeLog({ id: 'jan', logDate: '2026-01-02', bleeding: 'light' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');
    // 2026-01 is the most recent month, only 1 log there
    expect(briefing?.detail).toBe('1 local log reviewed');
    expect(briefing?.date).toBe('2026-01-02');
  });

  /**
   * SUSPECTED BUG: monthly briefing only counts by startsWith(monthPrefix),
   * where monthPrefix is entry.logDate.slice(0, 7).
   * If logDates share the same YYYY-MM prefix but have different full dates, all
   * should be counted. Verify the count is correct for 3 logs in the same month.
   */
  it('monthly briefing counts all logs across all days in the latest month', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'a', logDate: '2026-05-01', bleeding: 'light' }),
        makeLog({ id: 'b', logDate: '2026-05-10', bleeding: 'none' }),
        makeLog({ id: 'c', logDate: '2026-05-31', bleeding: 'medium' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');
    expect(briefing?.detail).toBe('3 local logs reviewed');
  });
});

// -----------------------------------------------------------------------
// 4. Import item — date normalization and edge cases
// -----------------------------------------------------------------------

describe('import item', () => {
  it('uses completedAt date when provided', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [
        makeImport({
          id: 'imp-complete',
          startedAt: '2026-01-10T08:00:00.000Z',
          completedAt: '2026-01-11T09:00:00.000Z',
        }),
      ],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item).toBeDefined();
    // The date should be derived from completedAt, not startedAt
    // normalizeTimelineDate parses and uses local date, which may vary by TZ.
    // We can at least assert it's a date-only string
    expect(item?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to startedAt when completedAt is absent', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [
        makeImport({
          id: 'imp-no-complete',
          startedAt: '2026-02-20T10:00:00.000Z',
          completedAt: undefined,
        }),
      ],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('skipped count is omitted from detail when skippedLogCount is 0', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ skippedLogCount: 0, importedLogCount: 5 })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.detail).toBe('5 entries imported');
    expect(item?.detail).not.toContain('skipped');
  });

  it('skipped count IS included in detail when skippedLogCount > 0', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ skippedLogCount: 3, importedLogCount: 7 })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.detail).toContain('7 entries imported');
    expect(item?.detail).toContain('3 skipped');
  });

  it('singular "1 entry imported" when importedLogCount is 1', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ importedLogCount: 1, skippedLogCount: 0 })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.detail).toBe('1 entry imported');
  });

  it('plural "N entries imported" when importedLogCount > 1', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ importedLogCount: 2, skippedLogCount: 0 })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.detail).toBe('2 entries imported');
  });

  it('import source "manual" renders title as "manual history import"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ source: 'manual' })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.title).toBe('manual history import');
  });

  it('import source "flo" renders title as "Flo import"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ source: 'flo' })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.title).toBe('Flo import');
  });

  it('import id is prefixed with "import-"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport({ id: 'abc123' })],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.id).toBe('import-abc123');
  });

  it('import is marked sensitive', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [makeImport()],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'import');
    expect(item?.sensitive).toBe(true);
  });
});

// -----------------------------------------------------------------------
// 5. DailyLog — bleeding classification
// -----------------------------------------------------------------------

describe('daily-log bleeding detail', () => {
  const cases: [string, string][] = [
    ['none', 'No bleeding'],
    ['spotting', 'Spotting'],
    ['light', 'Light bleeding'],
    ['medium', 'Medium bleeding'],
    ['heavy', 'Heavy bleeding'],
  ];

  for (const [bleeding, expected] of cases) {
    it(`bleeding "${bleeding}" maps to "${expected}" in detail`, () => {
      const model = buildPrivateTimelineModel({
        dailyLogs: [makeLog({ bleeding: bleeding as DailyLogEntry['bleeding'] })],
        imports: [],
        reminders: [],
      });

      const item = model.items.find((i) => i.kind === 'daily-log');
      expect(item?.detail).toContain(expected);
    });
  }
});

// -----------------------------------------------------------------------
// 6. DailyLog — notes / note item
// -----------------------------------------------------------------------

describe('daily-log note items', () => {
  it('note item is NOT produced when notes is undefined', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ notes: undefined })],
      imports: [],
      reminders: [],
    });

    expect(model.items.filter((i) => i.kind === 'note')).toHaveLength(0);
  });

  it('note item is NOT produced when notes is an empty string', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ notes: '' })],
      imports: [],
      reminders: [],
    });

    expect(model.items.filter((i) => i.kind === 'note')).toHaveLength(0);
  });

  it('note item is NOT produced when notes is only whitespace', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ notes: '   \t\n  ' })],
      imports: [],
      reminders: [],
    });

    expect(model.items.filter((i) => i.kind === 'note')).toHaveLength(0);
  });

  it('note item IS produced when notes has real content', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ notes: 'Felt great today.' })],
      imports: [],
      reminders: [],
    });

    expect(model.items.filter((i) => i.kind === 'note')).toHaveLength(1);
  });

  it('note item detail is always "Private note saved." regardless of content', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ notes: 'Super secret note content here.' })],
      imports: [],
      reminders: [],
    });

    const note = model.items.find((i) => i.kind === 'note');
    // The note content itself must NOT leak into the detail string
    expect(note?.detail).toBe('Private note saved.');
    expect(note?.detail).not.toContain('Super secret');
  });
});

// -----------------------------------------------------------------------
// 7. TTC observation detail
// -----------------------------------------------------------------------

describe('ttc observation detail', () => {
  it('all TTC fields together produce the correct combined detail', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          ttcObservation: {
            ovulationTest: 'peak',
            cervicalMucus: 'egg-white',
            basalBodyTemperatureCelsius: 36.75,
            sexLogged: true,
          },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'ttc');
    expect(item?.detail).toBe(
      'Ovulation test: peak · Cervical mucus: egg-white · BBT: 36.75 C · Sex logged',
    );
  });

  it('sexLogged false does NOT append "Sex logged"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          ttcObservation: {
            ovulationTest: 'negative',
            sexLogged: false,
          },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'ttc');
    expect(item?.detail).not.toContain('Sex logged');
  });

  it('empty TTC observation falls back to "TTC observation logged"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ ttcObservation: {} })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'ttc');
    expect(item?.detail).toBe('TTC observation logged');
  });

  it('BBT is formatted to 2 decimal places', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ ttcObservation: { basalBodyTemperatureCelsius: 37 } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'ttc');
    expect(item?.detail).toContain('BBT: 37.00 C');
  });

  it('BBT value of 0 is still treated as a number (falsy trap)', () => {
    // 0 is falsy; the guard uses typeof === 'number' so this should work
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ ttcObservation: { basalBodyTemperatureCelsius: 0 } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'ttc');
    expect(item?.detail).toContain('BBT: 0.00 C');
  });
});

// -----------------------------------------------------------------------
// 8. Birth-control detail
// -----------------------------------------------------------------------

describe('birth-control detail', () => {
  it('missedDose true appends "Missed dose"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ birthControlEvent: { method: 'pill', missedDose: true } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'birth-control');
    expect(item?.detail).toContain('Missed dose');
  });

  it('lateDose true appends "Late dose"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ birthControlEvent: { method: 'ring', lateDose: true } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'birth-control');
    expect(item?.detail).toContain('Late dose');
  });

  it('missedDose false does NOT append "Missed dose"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ birthControlEvent: { method: 'iud', missedDose: false } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'birth-control');
    expect(item?.detail).not.toContain('Missed dose');
  });

  it('birth-control item id is prefixed with "birth-control-"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'log-bc', birthControlEvent: { method: 'pill' } })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'birth-control');
    expect(item?.id).toBe('birth-control-log-bc');
  });
});

// -----------------------------------------------------------------------
// 9. Backup events
// -----------------------------------------------------------------------

describe('backup events', () => {
  it('exported backup has title "Backup exported"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
      backupEvents: [{ id: 'bk-1', action: 'exported', date: '2026-05-01', detail: '' }],
    });

    const item = model.items.find((i) => i.kind === 'backup');
    expect(item?.title).toBe('Backup exported');
  });

  it('restored backup has title "Backup restored"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
      backupEvents: [{ id: 'bk-2', action: 'restored', date: '2026-05-02', detail: '' }],
    });

    const item = model.items.find((i) => i.kind === 'backup');
    expect(item?.title).toBe('Backup restored');
  });

  it('multiple backup events produce multiple items', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
      backupEvents: [
        { id: 'bk-a', action: 'exported', date: '2026-04-01', detail: '' },
        { id: 'bk-b', action: 'restored', date: '2026-05-01', detail: '' },
      ],
    });

    expect(model.items.filter((i) => i.kind === 'backup')).toHaveLength(2);
    expect(model.counts.backup).toBe(2);
  });

  it('backup items are marked sensitive', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
      backupEvents: [{ id: 'bk-3', action: 'exported', date: '2026-05-05', detail: '' }],
    });

    const item = model.items.find((i) => i.kind === 'backup');
    expect(item?.sensitive).toBe(true);
  });
});

// -----------------------------------------------------------------------
// 10. Sort stability — same-date items from different sources
// -----------------------------------------------------------------------

describe('sort stability — same-date cross-source', () => {
  it('items with the same date are further sorted ascending by id (stable tie-break)', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'log-z', logDate: '2026-05-10', bleeding: 'light' }),
      ],
      imports: [],
      reminders: [],
      backupEvents: [
        { id: 'aaa', action: 'exported', date: '2026-05-10', detail: '' },
      ],
    });

    // "backup-aaa" < "daily-log-log-z" lexicographically
    const sameDate = model.items.filter((i) => i.date === '2026-05-10');
    const ids = sameDate.map((i) => i.id);
    expect(ids[0]).toBe('backup-aaa');
    expect(ids[1]).toBe('daily-log-log-z');
  });
});

// -----------------------------------------------------------------------
// 11. Out-of-order / future-dated logs
// -----------------------------------------------------------------------

describe('out-of-order and future-dated entries', () => {
  it('future-dated log appears first in the sorted list', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'past', logDate: '2020-01-01', bleeding: 'none' }),
        makeLog({ id: 'future', logDate: '2099-01-01', bleeding: 'light' }),
      ],
      imports: [],
      reminders: [],
    });

    const logItems = model.items.filter((i) => i.kind === 'daily-log');
    expect(logItems[0]?.date).toBe('2099-01-01');
    expect(logItems[1]?.date).toBe('2020-01-01');
  });

  it('all-same-date logs produce one monthly briefing, not multiple', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'a', logDate: '2026-05-01', bleeding: 'light' }),
        makeLog({ id: 'b', logDate: '2026-05-01', bleeding: 'none' }),
        makeLog({ id: 'c', logDate: '2026-05-01', bleeding: 'spotting' }),
      ],
      imports: [],
      reminders: [],
    });

    expect(model.items.filter((i) => i.kind === 'monthly-briefing')).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------
// 12. Reminder meta — enabled vs disabled
// -----------------------------------------------------------------------

describe('reminder meta text', () => {
  it('enabled reminder shows "Active local reminder" meta', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [
        {
          kind: 'daily-log',
          enabled: true,
          date: '2026-05-20',
          label: 'Daily log',
          detail: 'Every day',
        },
      ],
    });

    const item = model.items.find((i) => i.kind === 'reminder');
    expect(item?.meta).toBe('Active local reminder');
  });

  it('disabled reminder shows "Reminder available" meta', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [
        {
          kind: 'birth-control',
          enabled: false,
          date: '2026-05-21',
          label: 'BC reminder',
          detail: 'Daily',
        },
      ],
    });

    const item = model.items.find((i) => i.kind === 'reminder');
    expect(item?.meta).toBe('Reminder available');
  });

  it('reminder id is "reminder-<kind>"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [
        {
          kind: 'period-start',
          enabled: true,
          date: '2026-05-22',
          label: 'Period',
          detail: '',
        },
      ],
    });

    const item = model.items.find((i) => i.kind === 'reminder');
    expect(item?.id).toBe('reminder-period-start');
  });
});

// -----------------------------------------------------------------------
// 13. importedHistory vs loggedOnDevice meta on daily-log
// -----------------------------------------------------------------------

describe('daily-log imported vs on-device meta', () => {
  it('log with importSessionId shows "Imported history" meta', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ importSessionId: 'sess-001' })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');
    expect(item?.meta).toBe('Imported history');
  });

  it('log without importSessionId carries no meta (UL-28: the privacy promise lives once, in the header)', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ importSessionId: undefined })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');
    expect(item?.meta).toBeUndefined();
  });
});

// -----------------------------------------------------------------------
// 14. formatList — detail list formatting
// -----------------------------------------------------------------------

describe('formatList (via daily-log symptoms)', () => {
  it('two symptoms are joined with " and "', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ symptoms: ['cramps', 'headache'] })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');
    expect(item?.detail).toContain('Cramps and Headache');
  });

  it('three symptoms are joined as "A, B and C"', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ symptoms: ['cramps', 'headache', 'fatigue'] })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');
    expect(item?.detail).toContain('Cramps, Headache and Fatigue');
  });

  it('single symptom has no separator', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ symptoms: ['bloating'] })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');
    expect(item?.detail).toContain('Bloating');
    expect(item?.detail).not.toContain(' and ');
  });
});
