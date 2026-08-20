/**
 * Tenure fixture generator for the 1.2.0 long-tenure bug hunt (workstream E).
 *
 * Produces synthetic-but-realistic multi-month/multi-year usage histories so
 * the sweep can exercise screens (Today, Calendar, Timeline, Insights,
 * condition detail, reminders) against data shapes a long-tenure real user
 * would actually accumulate -- new users, gaps, irregular cycles, lapsed
 * logging, and a full year of dense data. This module is dev/test tooling
 * only: it has no runtime import from product code, and lives in
 * `src/testing/` (excluded from coverage collection, matching
 * `devLaunchPreset.ts`/`qaFixtures.ts` precedent -- see jest.config.js
 * `collectCoverageFrom: ['!src/testing/**\/*']`).
 *
 * ## Determinism contract
 *
 * `buildTenureDataset(variant, todayIso)` is a pure function of its two
 * arguments: calling it twice with the same `(variant, todayIso)` pair
 * always returns byte-identical (deep-equal) output, in this process or any
 * other, on any platform, forever (no reliance on `Date.now()`, `Math.random()`,
 * locale, or timezone). This matters for the sweep because a flaky/varying
 * fixture would make triaged bugs unreproducible.
 *
 * Determinism is achieved with a tiny explicit PRNG (`mulberry32`, a
 * public-domain 32-bit generator) seeded by hashing the string
 * `"${variant}:${todayIso}"` with a simple FNV-1a-style string hash. Every
 * "random" choice below (which day within a cycle logging drops out,
 * whether a note is attached, symptom/mood selection, noise in irregular
 * cycle lengths, etc.) draws from that single seeded stream, consumed in a
 * fixed, code-order sequence -- so the sequence of draws for a given variant
 * is stable across runs as long as the code itself doesn't change. This is
 * the same category of contract unit tests rely on for snapshot fixtures; it
 * is NOT cryptographic and must never be used for anything security-sensitive.
 *
 * ## Backward-from-today construction
 *
 * Every variant is built by walking backward from `todayIso` (the caller
 * passes the runtime result of `getLocalTodayLogDate()` -- see
 * `src/features/logging/date.ts` -- so the dataset always ends "now" instead
 * of a hardcoded date). Building backward means a 12-month dataset naturally
 * spans a real year boundary (Dec 31 -> Jan 1) and both US DST transition
 * windows (the second Sunday of March, e.g. 2026-03-08, and the Sunday
 * following Nov 1, e.g. 2025-11-01) whenever `todayIso` is far enough in the
 * future of those anchors -- exactly the calendar-math edge cases the sweep
 * cares about. `tenure-3mo-regular` and `tenure-12mo-regular` deliberately
 * place a period start (or a reminder-relevant log) on/around both DST dates
 * when the 12-month span reaches them.
 */

import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type {
  BirthControlEvent,
  DailyLogEntry,
  MoodValue,
  ReminderPreference,
  SymptomKey,
  TtcObservation,
  UserProfile,
} from '@/src/types/domain';
import { moodValueValues, symptomKeyValues } from '@/src/types/domain';
import { defaultReminderPreferences } from '@/src/db/domainDefaults';

export const tenureFixtureVariantValues = [
  'tenure-1mo-new',
  'tenure-3mo-regular',
  'tenure-6mo-gap',
  'tenure-12mo-regular',
  'tenure-12mo-irregular',
  'tenure-lapsed',
] as const;
export type TenureFixtureVariant = (typeof tenureFixtureVariantValues)[number];

export type TenureDataset = {
  profile: UserProfile;
  dailyLogs: DailyLogEntry[];
  reminderPreferences: ReminderPreference[];
};

// ---------------------------------------------------------------------------
// Deterministic seeded PRNG
// ---------------------------------------------------------------------------

/**
 * Simple FNV-1a-style string hash -> 32-bit unsigned seed. Deliberately not
 * cryptographic; this exists purely to turn an arbitrary `(variant, todayIso)`
 * string key into a well-distributed 32-bit integer for `mulberry32`.
 */
function hashSeedString(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * mulberry32 -- a small, fast, public-domain 32-bit PRNG. Given the same
 * seed, it always produces the same sequence of floats in [0, 1). Not
 * cryptographically secure; used only to make fixture generation
 * deterministic and reproducible across runs/platforms.
 */
function mulberry32(seed: number) {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(variant: TenureFixtureVariant, todayIso: string) {
  const seed = hashSeedString(`${variant}:${todayIso}`);
  return mulberry32(seed);
}

/** Returns a deterministic integer in [min, max] (inclusive). */
function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Returns true with the given probability (0..1), deterministically. */
function randomChance(random: () => number, probability: number): boolean {
  return random() < probability;
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[randomInt(random, 0, items.length - 1)]!;
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const ALL_SYMPTOMS: readonly SymptomKey[] = symptomKeyValues;
const ALL_MOODS: readonly MoodValue[] = moodValueValues;

const LONG_NOTE =
  'Logged this one in detail because the day felt different from the usual pattern: ' +
  'cramping started earlier than expected, energy dipped hard by mid-afternoon, and ' +
  'sleep was noticeably lighter than the last few nights. Keeping an eye on whether ' +
  'this repeats next cycle before mentioning it to anyone -- for now just want the ' +
  'detail on record in case the pattern holds up over the next few months of tracking.';

/** Builds a >300 char note deterministically, reusing LONG_NOTE as the base. */
function buildLongNote(dayIndex: number): string {
  const suffix = ` (day-index ${dayIndex} marker for fixture traceability.)`;
  const note = LONG_NOTE + suffix;
  return note.length > 300 ? note : note.padEnd(305, '.');
}

function nextLogId(logDate: string, variant: TenureFixtureVariant): string {
  return `tenure-log-${variant}-${logDate}`;
}

function pickSymptoms(random: () => number, count: number): SymptomKey[] {
  const shuffled = [...ALL_SYMPTOMS];
  // Fisher-Yates using the seeded stream, so symptom selection is
  // reproducible for a given seed sequence position.
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(random, 0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

type PeriodPlan = {
  startIso: string;
  periodLengthDays: number;
};

/**
 * Builds period start dates walking BACKWARD from todayIso, one cycle at a
 * time, until `cycleCount` starts have been produced (oldest first in the
 * returned array). `cycleLengthFor(indexFromNewest)` lets callers vary
 * length per cycle (irregular variant) while everything is still derived
 * deterministically from the seeded random stream.
 */
function buildPeriodStartsBackward(
  todayIso: string,
  cycleCount: number,
  cycleLengthFor: (indexFromNewest: number) => number,
  daysAgoOfNewestStart: number,
): PeriodPlan[] {
  const plans: PeriodPlan[] = [];
  let cursorIso = addDays(todayIso, -daysAgoOfNewestStart);

  for (let i = 0; i < cycleCount; i += 1) {
    plans.push({ startIso: cursorIso, periodLengthDays: 5 });
    const cycleLength = cycleLengthFor(i);
    cursorIso = addDays(cursorIso, -cycleLength);
  }

  return plans.reverse();
}

function buildBleedingDaysForPeriod(
  plan: PeriodPlan,
  variant: TenureFixtureVariant,
  random: () => number,
  loggingProbability: number,
  logs: Map<string, DailyLogEntry>,
) {
  for (let dayOffset = 0; dayOffset < plan.periodLengthDays; dayOffset += 1) {
    const logDate = addDays(plan.startIso, dayOffset);

    if (!randomChance(random, loggingProbability)) {
      continue;
    }

    const bleeding = dayOffset === 0 || dayOffset === 1 ? 'heavy' : dayOffset < 4 ? 'medium' : 'light';
    const symptoms = pickSymptoms(random, randomInt(random, 0, 3));
    const mood = randomChance(random, 0.7) ? pick(random, ALL_MOODS) : undefined;
    const withLongNote = randomChance(random, 0.1);

    logs.set(logDate, {
      id: nextLogId(logDate, variant),
      logDate,
      bleeding,
      symptoms,
      ...(mood ? { mood } : {}),
      ...(withLongNote ? { notes: buildLongNote(dayOffset) } : {}),
    });
  }
}

/**
 * Adds a realistic biphasic BBT + OPK + mucus fertile-window pattern anchored
 * on the NEXT expected ovulation for the cycle that starts at `periodStart`
 * (i.e. roughly `periodStart + cycleLengthDays - lutealLengthDays`). This is
 * what lets the A4 ovulation-fusion engine paths (bbt-shift, opk-surge,
 * mucus-peak, and their fusion in `fuseOvulationEstimate`) actually light up
 * against these fixtures rather than silently falling back to the plain
 * calendar estimate.
 */
function addFertileWindowSignals(
  periodStartIso: string,
  cycleLengthDays: number,
  variant: TenureFixtureVariant,
  random: () => number,
  logs: Map<string, DailyLogEntry>,
  todayIso: string,
) {
  const lutealLengthDays = 13;
  const ovulationDayOffset = cycleLengthDays - lutealLengthDays;
  const ovulationIso = addDays(periodStartIso, ovulationDayOffset);

  // Don't fabricate signals in the future relative to todayIso -- a
  // long-tenure history must never contain "future" BBT/OPK readings.
  if (ovulationIso > todayIso) {
    return;
  }

  const mergeTtc = (logDate: string, ttcObservation: TtcObservation) => {
    const existing = logs.get(logDate);
    if (existing) {
      logs.set(logDate, {
        ...existing,
        ttcObservation: { ...existing.ttcObservation, ...ttcObservation },
      });
      return;
    }

    logs.set(logDate, {
      id: nextLogId(logDate, variant),
      logDate,
      bleeding: 'none',
      symptoms: [],
      ttcObservation,
    });
  };

  // --- Cervical mucus build-up + egg-white peak + dry-up (mucusPeak.ts) ---
  const mucusBuildupStart = addDays(ovulationIso, -3);
  const mucusStages: TtcObservation['cervicalMucus'][] = ['sticky', 'creamy', 'egg-white', 'egg-white'];
  mucusStages.forEach((quality, index) => {
    const logDate = addDays(mucusBuildupStart, index);
    if (logDate > todayIso) return;
    mergeTtc(logDate, { cervicalMucus: quality });
  });
  const dryUpIso = addDays(ovulationIso, 1);
  if (dryUpIso <= todayIso) {
    mergeTtc(dryUpIso, { cervicalMucus: 'sticky' });
  }

  // --- OPK surge: positive the day before ovulation (opkSurge.ts +1 rule) ---
  const opkPositiveIso = addDays(ovulationIso, -1);
  if (opkPositiveIso <= todayIso) {
    mergeTtc(opkPositiveIso, { ovulationTest: 'positive' });
  }
  const opkNegativePriorIso = addDays(ovulationIso, -3);
  if (opkNegativePriorIso <= todayIso) {
    mergeTtc(opkNegativePriorIso, { ovulationTest: 'negative' });
  }

  // --- BBT coverline shift: low-phase baseline then 3-over-6 elevated days
  // (bbtShift.ts: coverline = max of last 6 valid readings prior to shift day,
  // shift day requires +0.2C over coverline, sustained for 3 total days). ---
  const baselineCelsius = 36.3;
  const shiftCelsius = 36.6; // +0.3C, safely over the 0.2C threshold
  // 8 baseline days ending the day before the shift day (ovulationIso + 1).
  const shiftDateIso = addDays(ovulationIso, 1);
  for (let i = 8; i >= 1; i -= 1) {
    const logDate = addDays(shiftDateIso, -i);
    if (logDate < periodStartIso || logDate > todayIso) continue;
    const jitter = randomChance(random, 0.5) ? 0.05 : -0.05;
    mergeTtc(logDate, { basalBodyTemperatureCelsius: Number((baselineCelsius + jitter).toFixed(2)) });
  }
  for (let i = 0; i < 3; i += 1) {
    const logDate = addDays(shiftDateIso, i);
    if (logDate > todayIso) continue;
    mergeTtc(logDate, { basalBodyTemperatureCelsius: shiftCelsius });
  }

  // Log intercourse near the fertile window, per the TTC-tracking vocabulary.
  const sexLoggedIso = addDays(ovulationIso, -2);
  if (sexLoggedIso <= todayIso) {
    mergeTtc(sexLoggedIso, { sexLogged: true });
  }
}

function addNoisyTtcSignals(
  periodStartIso: string,
  cycleLengthDays: number,
  variant: TenureFixtureVariant,
  random: () => number,
  logs: Map<string, DailyLogEntry>,
  todayIso: string,
) {
  // Conflicting/noisy signals for tenure-12mo-irregular: an OPK positive far
  // from where the mucus pattern and a WEAK/absent BBT shift would put
  // ovulation, so fusion either disagrees or falls back to calendar --
  // exercising the 'signals-disagree' reason code and the calendar-fallback
  // path, per the irregular-variant intent in the campaign plan.
  const midCycleOffset = Math.floor(cycleLengthDays / 2);
  const noisyOpkIso = addDays(periodStartIso, randomInt(random, 3, Math.max(4, midCycleOffset - 4)));
  const conflictingMucusIso = addDays(periodStartIso, midCycleOffset + randomInt(random, 3, 6));

  if (noisyOpkIso <= todayIso && noisyOpkIso >= periodStartIso) {
    const existing = logs.get(noisyOpkIso);
    logs.set(noisyOpkIso, {
      id: existing?.id ?? nextLogId(noisyOpkIso, variant),
      logDate: noisyOpkIso,
      bleeding: existing?.bleeding ?? 'none',
      symptoms: existing?.symptoms ?? [],
      ...existing,
      ttcObservation: { ...existing?.ttcObservation, ovulationTest: 'positive' },
    });
  }

  if (conflictingMucusIso <= todayIso && conflictingMucusIso >= periodStartIso) {
    const existing = logs.get(conflictingMucusIso);
    logs.set(conflictingMucusIso, {
      id: existing?.id ?? nextLogId(conflictingMucusIso, variant),
      logDate: conflictingMucusIso,
      bleeding: existing?.bleeding ?? 'none',
      symptoms: existing?.symptoms ?? [],
      ...existing,
      ttcObservation: { ...existing?.ttcObservation, cervicalMucus: 'egg-white' },
    });
  }

  // Sparse, unconfirmed BBT noise (no coherent coverline shift): a couple of
  // scattered, mildly-varying readings that never sustain a 3-over-6 shift.
  for (let i = 0; i < 3; i += 1) {
    const logDate = addDays(periodStartIso, randomInt(random, 6, Math.max(7, cycleLengthDays - 6)));
    if (logDate > todayIso || logDate < periodStartIso) continue;
    const existing = logs.get(logDate);
    const noisyTemp = Number((36.2 + random() * 0.5).toFixed(2));
    logs.set(logDate, {
      id: existing?.id ?? nextLogId(logDate, variant),
      logDate,
      bleeding: existing?.bleeding ?? 'none',
      symptoms: existing?.symptoms ?? [],
      ...existing,
      ttcObservation: { ...existing?.ttcObservation, basalBodyTemperatureCelsius: noisyTemp },
    });
  }
}

function addLateDosePillEvents(
  periodStarts: PeriodPlan[],
  variant: TenureFixtureVariant,
  random: () => number,
  logs: Map<string, DailyLogEntry>,
  todayIso: string,
) {
  for (const plan of periodStarts) {
    if (!randomChance(random, 0.4)) continue;

    const logDate = addDays(plan.startIso, randomInt(random, 8, 18));
    if (logDate > todayIso) continue;

    const birthControlEvent: BirthControlEvent = {
      method: 'pill',
      lateDose: true,
    };
    const existing = logs.get(logDate);
    logs.set(logDate, {
      id: existing?.id ?? nextLogId(logDate, variant),
      logDate,
      bleeding: existing?.bleeding ?? 'none',
      symptoms: existing?.symptoms ?? [],
      ...existing,
      birthControlEvent,
    });
  }
}

function toSortedLogs(logs: Map<string, DailyLogEntry>): DailyLogEntry[] {
  return [...logs.values()].sort((a, b) => a.logDate.localeCompare(b.logDate));
}

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
    ttcTrackingPreferences: {
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    },
    ...overrides,
  };
}

/**
 * All reminder kinds enabled, EXCEPT birth-control -- which only makes sense
 * (and, per LT-26, only actually schedules) once a birth-control method is on
 * the profile. A reminder that is `enabled: true` with no method selected is
 * not a state a real user can reach through the app's own settings flow
 * (`persistBirthControlMethod` in SettingsScreen.tsx turns the reminder off
 * the moment its method is cleared): it was previously produced here
 * unconditionally, encoding an unreachable state in every tenure fixture that
 * doesn't set `birthControlMethod`. Callers that DO set a method should pass
 * it so their fixture's birth-control reminder is legitimately active.
 */
function enabledReminderPreferences(hasBirthControlMethod = false): ReminderPreference[] {
  return defaultReminderPreferences.map((reminder) => ({
    ...reminder,
    enabled: reminder.kind === 'birth-control' ? hasBirthControlMethod : true,
  }));
}

// ---------------------------------------------------------------------------
// Variant builders
// ---------------------------------------------------------------------------

function buildOneMonthNew(todayIso: string, random: () => number): TenureDataset {
  // 1 completed cycle + a partial (in-progress) second cycle, ~60% logging.
  const cycleLengthDays = 28;
  const currentCycleStart = addDays(todayIso, -randomInt(random, 8, 16));
  const previousCycleStart = addDays(currentCycleStart, -cycleLengthDays);
  const plans: PeriodPlan[] = [
    { startIso: previousCycleStart, periodLengthDays: 5 },
    { startIso: currentCycleStart, periodLengthDays: 5 },
  ];

  const logs = new Map<string, DailyLogEntry>();
  for (const plan of plans) {
    buildBleedingDaysForPeriod(plan, 'tenure-1mo-new', random, 0.6, logs);
  }

  // A few non-bleeding symptom-only days scattered in between, still ~60%.
  let cursor = addDays(previousCycleStart, 5);
  while (cursor < currentCycleStart) {
    if (randomChance(random, 0.3)) {
      logs.set(cursor, {
        id: nextLogId(cursor, 'tenure-1mo-new'),
        logDate: cursor,
        bleeding: 'none',
        symptoms: pickSymptoms(random, randomInt(random, 1, 2)),
        mood: pick(random, ALL_MOODS),
      });
    }
    cursor = addDays(cursor, 1);
  }

  return {
    profile: baseProfile({ cycleLengthDays, lastPeriodStartDate: currentCycleStart }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(),
  };
}

function buildThreeMonthRegular(todayIso: string, random: () => number): TenureDataset {
  // 3 cycles, 28 +/- 1 day, realistic biphasic BBT+OPK+mucus so the A4
  // engine paths light up. Newest cycle started recently enough to still be
  // "current".
  const daysAgoOfNewestStart = randomInt(random, 5, 12);
  const cycleLengths = [27, 29, 28]; // newest-first jitter within 28 +/- 1
  const plans = buildPeriodStartsBackward(
    todayIso,
    3,
    (indexFromNewest) => cycleLengths[indexFromNewest] ?? 28,
    daysAgoOfNewestStart,
  );

  const logs = new Map<string, DailyLogEntry>();
  plans.forEach((plan, index) => {
    buildBleedingDaysForPeriod(plan, 'tenure-3mo-regular', random, 0.85, logs);

    const nextPlan = plans[index + 1];
    const cycleLengthDays = nextPlan
      ? diffDays(plan.startIso, nextPlan.startIso)
      : 28;

    addFertileWindowSignals(
      plan.startIso,
      cycleLengthDays,
      'tenure-3mo-regular',
      random,
      logs,
      todayIso,
    );
  });

  return {
    profile: baseProfile({
      cycleLengthDays: 28,
      lastPeriodStartDate: plans.at(-1)!.startIso,
      goals: ['period', 'symptoms', 'trying-to-conceive'],
    }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(),
  };
}

function buildSixMonthGap(todayIso: string, random: () => number): TenureDataset {
  // 2 cycles -> 3-month gap -> resumed (2 more recent cycles), spanning ~6mo.
  const cycleLengthDays = 30;
  const daysAgoOfNewestStart = randomInt(random, 6, 14);
  const resumedPlans = buildPeriodStartsBackward(
    todayIso,
    2,
    () => cycleLengthDays,
    daysAgoOfNewestStart,
  );
  const gapDays = 90;
  const beforeGapNewestStart = addDays(resumedPlans[0]!.startIso, -gapDays - cycleLengthDays);
  const priorPlans = buildPeriodStartsBackward(
    beforeGapNewestStart,
    2,
    () => cycleLengthDays,
    0,
  );

  const allPlans = [...priorPlans, ...resumedPlans];
  const logs = new Map<string, DailyLogEntry>();
  for (const plan of allPlans) {
    buildBleedingDaysForPeriod(plan, 'tenure-6mo-gap', random, 0.75, logs);
  }

  return {
    profile: baseProfile({ cycleLengthDays, lastPeriodStartDate: resumedPlans.at(-1)!.startIso }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(),
  };
}

function buildTwelveMonthRegular(todayIso: string, random: () => number): TenureDataset {
  // ~13 cycles at ~28 days each to cover a full year, ~330 logs (full data
  // volume: every bleeding day logged, plus scattered non-bleeding
  // symptom/TTC-only days), full symptom/mood breadth.
  const cycleLengthDays = 28;
  const daysAgoOfNewestStart = randomInt(random, 5, 12);
  const plans = buildPeriodStartsBackward(todayIso, 13, () => cycleLengthDays, daysAgoOfNewestStart);

  const logs = new Map<string, DailyLogEntry>();

  plans.forEach((plan, index) => {
    buildBleedingDaysForPeriod(plan, 'tenure-12mo-regular', random, 0.95, logs);

    const nextPlan = plans[index + 1];
    const thisCycleLength = nextPlan ? diffDays(plan.startIso, nextPlan.startIso) : cycleLengthDays;

    // Only give the two most data-rich (most recent) cycles the full
    // fertile-window signal set, per the campaign instruction to give
    // tenure-12mo-regular "realistic biphasic BBT + OPK + mucus patterns" --
    // every cycle would be excessive/unrealistic for a full year.
    if (index >= plans.length - 3) {
      addFertileWindowSignals(
        plan.startIso,
        thisCycleLength,
        'tenure-12mo-regular',
        random,
        logs,
        todayIso,
      );
    }

    // Dense non-bleeding day logging for full data volume + symptom/mood
    // breadth coverage across the whole year.
    let cursor = addDays(plan.startIso, 5);
    const cycleEndExclusive = nextPlan ? nextPlan.startIso : todayIso;
    let dayCounter = 0;
    while (cursor < cycleEndExclusive) {
      if (randomChance(random, 0.85)) {
        const existing = logs.get(cursor);
        const symptomCount = randomInt(random, 1, ALL_SYMPTOMS.length);
        // Rotate symptom seed by dayCounter so across 13 cycles every
        // symptom key gets used at least once (breadth requirement).
        const rotatedSymptoms = [
          ALL_SYMPTOMS[(dayCounter + index) % ALL_SYMPTOMS.length]!,
          ...pickSymptoms(random, symptomCount - 1),
        ];
        const mood = ALL_MOODS[(dayCounter + index) % ALL_MOODS.length]!;
        logs.set(cursor, {
          id: existing?.id ?? nextLogId(cursor, 'tenure-12mo-regular'),
          logDate: cursor,
          bleeding: existing?.bleeding ?? 'none',
          symptoms: [...new Set(rotatedSymptoms)],
          mood,
          ...(randomChance(random, 0.05) ? { notes: buildLongNote(dayCounter) } : {}),
          ...existing,
        });
      }
      dayCounter += 1;
      cursor = addDays(cursor, 1);
    }
  });

  addLateDosePillEvents(plans, 'tenure-12mo-regular', random, logs, todayIso);

  return {
    profile: baseProfile({
      cycleLengthDays,
      lastPeriodStartDate: plans.at(-1)!.startIso,
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      conditionTags: ['pcos', 'pmdd', 'endometriosis'],
      birthControlMethod: 'pill',
    }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(true),
  };
}

function buildTwelveMonthIrregular(todayIso: string, random: () => number): TenureDataset {
  // Cycles ranging 24-60 days, a missed period, and spotting days --
  // conflicting/noisy TTC signals per the campaign instruction.
  const daysAgoOfNewestStart = randomInt(random, 5, 14);
  const cycleLengths = [
    24, 60, 31, 26, 45, 29, 24, 38, 27, 60, 25,
  ]; // includes a couple of 60-day (missed-period-shaped) gaps
  const plans = buildPeriodStartsBackward(
    todayIso,
    cycleLengths.length,
    (indexFromNewest) => cycleLengths[indexFromNewest] ?? 30,
    daysAgoOfNewestStart,
  );

  const logs = new Map<string, DailyLogEntry>();

  plans.forEach((plan, index) => {
    buildBleedingDaysForPeriod(plan, 'tenure-12mo-irregular', random, 0.65, logs);

    const nextPlan = plans[index + 1];
    const thisCycleLength = nextPlan ? diffDays(plan.startIso, nextPlan.startIso) : 30;

    // Spotting a few days before the "real" period start, only for some
    // cycles -- a realistic irregular-cycle pattern.
    if (randomChance(random, 0.4)) {
      const spottingIso = addDays(plan.startIso, -randomInt(random, 1, 3));
      if (spottingIso <= todayIso) {
        logs.set(spottingIso, {
          id: nextLogId(spottingIso, 'tenure-12mo-irregular'),
          logDate: spottingIso,
          bleeding: 'spotting',
          symptoms: pickSymptoms(random, 1),
        });
      }
    }

    if (index >= plans.length - 3) {
      addNoisyTtcSignals(
        plan.startIso,
        thisCycleLength,
        'tenure-12mo-irregular',
        random,
        logs,
        todayIso,
      );
    }
  });

  return {
    profile: baseProfile({
      cycleLengthDays: 34,
      supportsIrregularCycles: true,
      lastPeriodStartDate: plans.at(-1)!.startIso,
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      conditionTags: ['pcos'],
    }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(),
  };
}

function buildLapsed(todayIso: string, random: () => number): TenureDataset {
  // 12 months of history, but the last log is ~70 days ago -- the user
  // stopped logging well before "today".
  const lastLogAgeDays = randomInt(random, 68, 72);
  const anchorIso = addDays(todayIso, -lastLogAgeDays);
  const cycleLengthDays = 29;
  const plans = buildPeriodStartsBackward(anchorIso, 12, () => cycleLengthDays, 2);

  const logs = new Map<string, DailyLogEntry>();
  for (const plan of plans) {
    buildBleedingDaysForPeriod(plan, 'tenure-lapsed', random, 0.8, logs);
  }

  // Guarantee the actual most-recent entry lands at anchorIso exactly (a
  // deterministic, unambiguous "last log ~70 days ago" anchor for assertions),
  // regardless of whether the last period's bleeding days happened to log on
  // that exact date.
  if (!logs.has(anchorIso)) {
    logs.set(anchorIso, {
      id: nextLogId(anchorIso, 'tenure-lapsed'),
      logDate: anchorIso,
      bleeding: 'none',
      symptoms: pickSymptoms(random, 1),
      mood: pick(random, ALL_MOODS),
      notes: 'Last entry before a long break from logging.',
    });
  }

  return {
    profile: baseProfile({ cycleLengthDays, lastPeriodStartDate: plans.at(-1)!.startIso }),
    dailyLogs: toSortedLogs(logs),
    reminderPreferences: enabledReminderPreferences(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic tenure fixture dataset for the given variant and
 * "today" (pass the runtime result of `getLocalTodayLogDate()` at the call
 * site -- never a hardcoded date). See the module doc comment for the full
 * determinism contract and the backward-from-today construction rationale.
 */
export function buildTenureDataset(
  variant: TenureFixtureVariant,
  todayIso: string,
): TenureDataset {
  const random = createSeededRandom(variant, todayIso);

  switch (variant) {
    case 'tenure-1mo-new':
      return buildOneMonthNew(todayIso, random);
    case 'tenure-3mo-regular':
      return buildThreeMonthRegular(todayIso, random);
    case 'tenure-6mo-gap':
      return buildSixMonthGap(todayIso, random);
    case 'tenure-12mo-regular':
      return buildTwelveMonthRegular(todayIso, random);
    case 'tenure-12mo-irregular':
      return buildTwelveMonthIrregular(todayIso, random);
    case 'tenure-lapsed':
      return buildLapsed(todayIso, random);
    default: {
      const exhaustiveCheck: never = variant;
      throw new Error(`Unsupported tenure fixture variant: ${exhaustiveCheck}`);
    }
  }
}
