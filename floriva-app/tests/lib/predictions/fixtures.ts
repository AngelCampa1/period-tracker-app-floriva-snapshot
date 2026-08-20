/**
 * Shared cycle fixture builders for the signal-detector test suites (and
 * later A4/A6 wiring tests). Produces `DailyLogEntry[]` shaped exactly like
 * real domain data -- these are NOT parallel test-only types, just
 * convenience constructors over `src/types/domain.ts`.
 *
 * All builders are pure and deterministic: given the same options they
 * always produce the same entries, so tests can assert on exact output.
 */

import type { DailyLogEntry, TtcObservation } from '@/src/types/domain';
import { addDays } from '@/src/lib/predictions/dateMath';
import type {
  BbtShiftSignal,
  MucusPeakSignal,
  OpkSurgeSignal,
} from '@/src/lib/predictions/signals/types';

let idCounter = 0;

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function resetFixtureIds() {
  idCounter = 0;
}

function buildEntry(
  logDate: string,
  ttcObservation?: TtcObservation,
  overrides?: Partial<DailyLogEntry>,
): DailyLogEntry {
  return {
    id: nextId('entry'),
    logDate,
    bleeding: 'none',
    symptoms: [],
    ...(ttcObservation ? { ttcObservation } : {}),
    ...overrides,
  };
}

export type BbtPattern = 'biphasic' | 'flat' | 'noisy' | 'sparse';

/**
 * Biphasic BBT curve: 10 days of a stable low (pre-ovulatory) phase, then a
 * sustained rise (post-ovulatory) starting on `shiftDateIso`. Matches the
 * canonical 3-over-6 Marshall pattern used across bbtShift.test.ts.
 */
function buildBiphasicTemps(startIso: string, days: number): Map<string, number> {
  const temps = new Map<string, number>();
  const low = 36.4;
  const high = 36.75; // +0.35C -- comfortably above the +0.2C coverline threshold.
  // Shift lands at day index 10 (11th day) by convention across fixtures.
  const shiftIndex = 10;
  for (let i = 0; i < days; i += 1) {
    const date = addDays(startIso, i);
    temps.set(date, i < shiftIndex ? low : high);
  }
  return temps;
}

function buildFlatTemps(startIso: string, days: number): Map<string, number> {
  const temps = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    temps.set(addDays(startIso, i), 36.4);
  }
  return temps;
}

export type BuildCycleFixtureOptions = {
  cycleStartIso: string;
  cycleLengthDays?: number;
  bbt?: BbtPattern;
  opk?: 'none' | 'positive-then-peak' | 'peak-only' | 'positive-only';
  mucus?: 'none' | 'clear-peak' | 'no-dry-up' | 'sparse';
};

/**
 * Builds a full cycle's worth of `DailyLogEntry` records with the requested
 * TTC observation patterns layered in. `cycleStartIso` is the first day of
 * bleeding; entries run for `cycleLengthDays` (default 28) days.
 */
export function buildCycleFixture({
  cycleStartIso,
  cycleLengthDays = 28,
  bbt,
  opk = 'none',
  mucus = 'none',
}: BuildCycleFixtureOptions): DailyLogEntry[] {
  const entries: DailyLogEntry[] = [];

  let bbtTemps: Map<string, number> | undefined;
  if (bbt === 'biphasic') {
    bbtTemps = buildBiphasicTemps(cycleStartIso, cycleLengthDays);
  } else if (bbt === 'flat') {
    bbtTemps = buildFlatTemps(cycleStartIso, cycleLengthDays);
  } else if (bbt === 'noisy') {
    bbtTemps = buildBiphasicTemps(cycleStartIso, cycleLengthDays);
    // Inject a couple of noise spikes/dips within the pre-shift baseline
    // window. Kept below (post-shift high - rise threshold) so the coverline
    // they contribute to still allows the real shift to clear +0.2C -- a
    // spike large enough to itself raise the coverline above the shift
    // temperature would legitimately suppress detection under the real
    // Marshall rule, so the fixture models tolerable noise, not a
    // coverline-defeating outlier.
    bbtTemps.set(addDays(cycleStartIso, 3), 36.5);
    bbtTemps.set(addDays(cycleStartIso, 7), 36.1);
  } else if (bbt === 'sparse') {
    // Only a handful of scattered readings -- not enough to establish a
    // coverline (mimics imported Clue/Flo data with gaps).
    bbtTemps = new Map([
      [addDays(cycleStartIso, 1), 36.4],
      [addDays(cycleStartIso, 12), 36.7],
      [addDays(cycleStartIso, 20), 36.6],
    ]);
  }

  const opkByDate = new Map<string, 'negative' | 'positive' | 'peak'>();
  if (opk === 'positive-then-peak') {
    opkByDate.set(addDays(cycleStartIso, 11), 'negative');
    opkByDate.set(addDays(cycleStartIso, 12), 'positive');
    opkByDate.set(addDays(cycleStartIso, 13), 'peak');
  } else if (opk === 'peak-only') {
    opkByDate.set(addDays(cycleStartIso, 12), 'peak');
  } else if (opk === 'positive-only') {
    opkByDate.set(addDays(cycleStartIso, 11), 'negative');
    opkByDate.set(addDays(cycleStartIso, 12), 'positive');
  }

  const mucusByDate = new Map<string, 'dry' | 'sticky' | 'creamy' | 'egg-white'>();
  if (mucus === 'clear-peak') {
    mucusByDate.set(addDays(cycleStartIso, 9), 'creamy');
    mucusByDate.set(addDays(cycleStartIso, 10), 'egg-white');
    mucusByDate.set(addDays(cycleStartIso, 11), 'egg-white');
    mucusByDate.set(addDays(cycleStartIso, 12), 'sticky'); // observed dry-up
  } else if (mucus === 'no-dry-up') {
    mucusByDate.set(addDays(cycleStartIso, 10), 'egg-white');
    mucusByDate.set(addDays(cycleStartIso, 11), 'egg-white');
    // No entry after -- absence of data, not an observed dry-up.
  } else if (mucus === 'sparse') {
    mucusByDate.set(addDays(cycleStartIso, 10), 'egg-white');
  }

  for (let i = 0; i < cycleLengthDays; i += 1) {
    const date = addDays(cycleStartIso, i);
    const ttcObservation: TtcObservation = {};
    let hasObservation = false;

    if (bbtTemps?.has(date)) {
      ttcObservation.basalBodyTemperatureCelsius = bbtTemps.get(date);
      hasObservation = true;
    }
    if (opkByDate.has(date)) {
      ttcObservation.ovulationTest = opkByDate.get(date);
      hasObservation = true;
    }
    if (mucusByDate.has(date)) {
      ttcObservation.cervicalMucus = mucusByDate.get(date);
      hasObservation = true;
    }

    entries.push(
      buildEntry(date, hasObservation ? ttcObservation : undefined, {
        bleeding: i === 0 ? 'medium' : 'none',
      }),
    );
  }

  return entries;
}

/** Builds a single dated BBT reading entry (Celsius), for focused unit tests. */
export function buildBbtEntry(logDate: string, celsius: number): DailyLogEntry {
  return buildEntry(logDate, { basalBodyTemperatureCelsius: celsius });
}

/** Builds a single dated OPK reading entry, for focused unit tests. */
export function buildOpkEntry(
  logDate: string,
  result: 'negative' | 'positive' | 'peak',
): DailyLogEntry {
  return buildEntry(logDate, { ovulationTest: result });
}

/** Builds a single dated mucus observation entry, for focused unit tests. */
export function buildMucusEntry(
  logDate: string,
  quality: 'dry' | 'sticky' | 'creamy' | 'egg-white',
): DailyLogEntry {
  return buildEntry(logDate, { cervicalMucus: quality });
}

// --- OvulationSignal builders (fusion inputs) ---
// These construct the per-detector signal shapes directly, for tests that
// exercise fuseOvulationEstimate without running the detectors themselves.
// Shared here (rather than in a single test file) so A4/A6 fusion tests can
// reuse them.

/** A confirmed BBT-shift signal. shiftDateIso is arbitrary (fusion never reads it). */
export function buildBbtSignal(ovulationDateIso: string): BbtShiftSignal {
  return {
    kind: 'bbt-shift',
    ovulationDateIso,
    shiftDateIso: addDays(ovulationDateIso, 1),
    confirmed: true,
    retrospective: true,
    prospective: false,
    uncertaintyDays: 0,
  };
}

/** An OPK-peak surge signal (peak outweighs positive in fusion weighting). */
export function buildOpkPeakSignal(ovulationDateIso: string): OpkSurgeSignal {
  return {
    kind: 'opk-surge',
    ovulationDateIso,
    triggerResult: 'peak',
    uncertaintyDays: 0,
    prospective: true,
    retrospective: false,
  };
}

/** An OPK-positive surge signal. */
export function buildOpkPositiveSignal(ovulationDateIso: string): OpkSurgeSignal {
  return {
    kind: 'opk-surge',
    ovulationDateIso,
    triggerResult: 'positive',
    uncertaintyDays: 0,
    prospective: true,
    retrospective: false,
  };
}

/** A mucus-peak signal (widest uncertainty band: +/-2 days). */
export function buildMucusSignal(ovulationDateIso: string): MucusPeakSignal {
  return {
    kind: 'mucus-peak',
    peakDateIso: ovulationDateIso,
    ovulationDateIso,
    uncertaintyDays: 2,
    prospective: true,
    retrospective: false,
  };
}
