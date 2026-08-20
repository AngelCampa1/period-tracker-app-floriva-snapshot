import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import {
  buildCalendarScreenModel,
  type CalendarScreenModel,
} from '@/src/features/calendar/buildCalendarScreenModel';

/**
 * Deterministic calendar states for the Phase 2b redesign gallery
 * (DevCalendarGalleryScreen). Every fixture is produced by the REAL
 * buildCalendarScreenModel over fixed synthetic inputs -- never by
 * hand-assembled weeks -- so variant renderers are always exercised against
 * exactly what production emits, band segments included.
 *
 * All fixtures pin the visible month to July 2026 (todayIso 2026-07-22
 * unless the fixture is specifically about today's placement).
 *
 * Input recipes (July 2026 rows are Sun-first: Jun 28-Jul 4 / Jul 5-11 /
 * Jul 12-18 / Jul 19-25 / Jul 26-Aug 1):
 *
 * - `standard`: three period starts 21 days apart (May 22, Jun 12, Jul 3-7
 *   run) fix the estimated cycle length at 21, so the engine predicts the
 *   next period Jul 24-28 -- crossing the Jul 25/26 row boundary -- and the
 *   fertile window (next start - 19 .. - 14) lands on Jul 5-10. NOTE: the
 *   calendar engine hard-couples the fertile window to the predicted start
 *   (it always ends 14 days before it), so a fixture cannot have BOTH a
 *   mid-month fertile window and a month-end predicted run further apart
 *   than that coupling allows.
 * - `overlap`: same 21-day rhythm but the last logged start is Jun 19, so
 *   the anchor rolls forward once to a SYNTHETIC Jul 10 cycle start (one
 *   roll + 12 days past expectation = NOT stale). The synthetic
 *   current-cycle window paints predicted Jul 10-14 while the fertile
 *   window (next start Jul 31 - 19/14) covers Jul 12-17 -- overlapping
 *   bands on Jul 12-14.
 * - `todayInBand`: the standard dataset with todayIso moved to Jul 6, the
 *   'mid' cell of the logged period run.
 * - `stale`: last period start Apr 17 with a 21-day rhythm is 4 whole
 *   cycles before Jul 22 -> the stale-history gate (LT-04/LT-09/LT-31)
 *   fires, suppressing every predicted/fertile marker and band. A logged
 *   period day in July would re-anchor the cycle and undo staleness, so the
 *   only July log is spotting (never period evidence, never banded).
 */
export type CalendarDirectionFixtureName = 'standard' | 'overlap' | 'todayInBand' | 'stale';

export type CalendarDirectionFixture = {
  weeks: CalendarScreenModel['weeks'];
  weekdayLabels: string[];
  /** Plain-English summary rendered in the gallery's legend placeholder. */
  description: string;
  /** The todayIso the model was built with (the grid's isToday cell). */
  todayIso: string;
  /** A sensible initial grid selection for the gallery. */
  selectedDate: string;
};

const JULY_2026 = '2026-07-01';

function logEntry(logDate: string, bleeding: DailyLogEntry['bleeding']): DailyLogEntry {
  return {
    id: `direction-fixture-${logDate}-${bleeding}`,
    logDate,
    bleeding,
    symptoms: [],
  };
}

function buildProfile(lastPeriodStartDate: string): UserProfile {
  return {
    cycleLengthDays: 21,
    periodLengthDays: 5,
    lastPeriodStartDate,
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };
}

function buildFixture({
  todayIso,
  profile,
  logEntries,
  description,
  selectedDate,
}: {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  description: string;
  selectedDate: string;
}): CalendarDirectionFixture {
  const model = buildCalendarScreenModel({
    todayIso,
    monthIso: JULY_2026,
    profile,
    logEntries,
    locale: 'en',
  });

  return {
    weeks: model.weeks,
    weekdayLabels: model.weekdayLabels,
    description,
    todayIso,
    selectedDate,
  };
}

const standardLogEntries: DailyLogEntry[] = [
  logEntry('2026-05-22', 'heavy'),
  logEntry('2026-06-12', 'heavy'),
  logEntry('2026-07-03', 'light'),
  logEntry('2026-07-04', 'medium'),
  logEntry('2026-07-05', 'heavy'),
  logEntry('2026-07-06', 'medium'),
  logEntry('2026-07-07', 'light'),
  logEntry('2026-07-10', 'spotting'),
];

export const standard: CalendarDirectionFixture = buildFixture({
  todayIso: '2026-07-22',
  profile: buildProfile('2026-07-03'),
  logEntries: standardLogEntries,
  description:
    'Standard month: logged period Jul 3-7 (clips at the Jul 4/5 row ' +
    'boundary), single spotting day Jul 10, fertile window Jul 5-10, ' +
    'predicted period Jul 24-28 crossing the Jul 25/26 row boundary, today ' +
    'Jul 22 outside every band.',
  selectedDate: '2026-07-09',
});

export const overlap: CalendarDirectionFixture = buildFixture({
  todayIso: '2026-07-22',
  profile: buildProfile('2026-06-19'),
  logEntries: [
    logEntry('2026-05-08', 'heavy'),
    logEntry('2026-05-29', 'heavy'),
    logEntry('2026-06-19', 'heavy'),
  ],
  description:
    'Overlap month: the anchor rolled once to a synthetic Jul 10 cycle ' +
    'start, so the predicted window Jul 10-14 overlaps the fertile window ' +
    'Jul 12-17 on Jul 12-14; a second predicted cell (Jul 31) clips to a ' +
    'single at the month edge.',
  selectedDate: '2026-07-12',
});

export const todayInBand: CalendarDirectionFixture = buildFixture({
  todayIso: '2026-07-06',
  profile: buildProfile('2026-07-03'),
  logEntries: standardLogEntries,
  description:
    'Today-in-band month: the standard dataset with today on Jul 6 -- the ' +
    'mid cell of the logged period run -- so variants must compose the ' +
    'today treatment with an active band.',
  selectedDate: '2026-07-06',
});

export const stale: CalendarDirectionFixture = buildFixture({
  todayIso: '2026-07-22',
  profile: buildProfile('2026-04-17'),
  logEntries: [
    logEntry('2026-03-06', 'heavy'),
    logEntry('2026-03-27', 'heavy'),
    logEntry('2026-04-17', 'heavy'),
    logEntry('2026-04-18', 'heavy'),
    logEntry('2026-04-19', 'heavy'),
    logEntry('2026-07-10', 'spotting'),
  ],
  description:
    'Stale month: the last logged period start (Apr 17) is four whole ' +
    'cycles ago, so stale-history suppresses every predicted and fertile ' +
    'marker/band -- the grid shows honest emptiness plus the lone spotting ' +
    'log on Jul 10.',
  selectedDate: '2026-07-10',
});

export const calendarDirectionFixtures: Record<
  CalendarDirectionFixtureName,
  CalendarDirectionFixture
> = {
  standard,
  overlap,
  todayInBand,
  stale,
};

export const calendarDirectionFixtureNames: CalendarDirectionFixtureName[] = [
  'standard',
  'overlap',
  'todayInBand',
  'stale',
];
