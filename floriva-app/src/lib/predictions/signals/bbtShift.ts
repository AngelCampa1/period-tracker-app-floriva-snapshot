/**
 * BBT (basal body temperature) ovulation signal -- the "three-over-six"
 * coverline rule attributed to Marshall (1963), the standard heuristic taught
 * in fertility-awareness method (FAM) training and implemented by most
 * consumer BBT charting tools.
 *
 * Pipeline:
 * 1. Extract dated, valid BBT readings from `DailyLogEntry[]`. The domain
 *    (`TtcObservation.basalBodyTemperatureCelsius`) stores Celsius only --
 *    there is no unit field, so normalization is a no-op; the validity band
 *    below is itself the guard against bad data (e.g. a Fahrenheit value
 *    entered by mistake, such as 97.8, which is nowhere near a plausible
 *    Celsius BBT and is rejected by the band).
 * 2. For each candidate day, look at the valid readings within the preceding
 *    10 days. Require at least 6 of them to be eligible (fewer means too
 *    little baseline signal, e.g. sparse imported data). The coverline is
 *    then Marshall's rule proper: the HIGHEST of the most recent 6 valid
 *    readings prior to the candidate day. The 10-day window is only an
 *    eligibility gate -- the coverline itself is built from the last 6
 *    readings, so an older spike (e.g. 7-10 days back) that would age out of
 *    a last-6 selection never inflates the coverline and suppresses a
 *    legitimate shift.
 * 3. A day qualifies as the shift day if its temperature is >= coverline +
 *    0.2C AND the following 2 days both remain above the (same) coverline --
 *    3 total elevated readings confirm the shift.
 * 4. Estimated ovulation = the day immediately before the shift day (ovulation
 *    itself does not raise BBT; the rise reflects the post-ovulatory
 *    progesterone effect that begins the next day).
 *
 * This signal is RETROSPECTIVE ONLY (see types.ts): confirming a shift
 * inherently requires 3 days of readings after the fact, so it can never open
 * a fertile window prospectively. Its only valid use downstream is (a)
 * confirming ovulation happened for cycle-history purposes and (b) anchoring
 * luteal-length learning.
 *
 * CALLER CONTRACT: pass a single cycle's entries. Behavior on multi-cycle
 * input is unspecified (this detector happens to return the first qualifying
 * shift chronologically, but callers must not rely on that).
 */

import type { DailyLogEntry } from '@/src/types/domain';
import { addDays } from '@/src/lib/predictions/dateMath';
import type { BbtShiftSignal } from '@/src/lib/predictions/signals/types';

// Valid physiological BBT band in Celsius, inclusive. Chosen to comfortably
// cover the full range of adult basal body temperatures (documented low-mid
// 35s during menses/follicular phase up to high-37s during illness/luteal
// phase with fever) while band-rejecting unit-confusion errors -- e.g. a
// Fahrenheit reading like 97.8 lands far outside this band and is dropped
// rather than misread as a biologically impossible 97.8C.
const MIN_VALID_CELSIUS = 35.0;
const MAX_VALID_CELSIUS = 38.5;

// Marshall's coverline rule: look back 10 days for the readings that make a
// candidate ELIGIBLE for a coverline (the eligibility window).
const COVERLINE_LOOKBACK_DAYS = 10;
// At least 6 valid readings within that lookback window are required to
// trust the coverline -- fewer means too little baseline signal (e.g.
// sparse imported data). The coverline is then built from exactly the most
// recent 6 of those eligible readings (see COVERLINE_READINGS below).
const MIN_COVERLINE_READINGS = 6;
// The coverline is the highest of the most recent 6 valid readings prior to
// the candidate day -- Marshall's "last 6", NOT the max of every reading in
// the 10-day eligibility window.
const COVERLINE_READINGS = 6;
// Minimum rise, in Celsius, above the coverline required to count as the
// first elevated (shift) day. A rise of exactly 0.19C must NOT trigger; the
// threshold is therefore inclusive at 0.2C.
const MIN_SHIFT_RISE_CELSIUS = 0.2;
// Total consecutive elevated days (including the shift day itself) required
// to confirm the shift -- "three over six".
const ELEVATED_DAYS_REQUIRED = 3;

type DatedTemp = { date: string; celsius: number };

function extractValidTemps(entries: DailyLogEntry[]): DatedTemp[] {
  const temps: DatedTemp[] = [];
  for (const entry of entries) {
    const celsius = entry.ttcObservation?.basalBodyTemperatureCelsius;
    if (celsius == null) continue;
    if (celsius < MIN_VALID_CELSIUS || celsius > MAX_VALID_CELSIUS) continue;
    temps.push({ date: entry.logDate, celsius });
  }
  return temps.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Detects a confirmed BBT coverline shift within the given entries.
 * Returns `null` if no cycle in the data establishes a confirmed shift
 * (e.g. an anovulatory/flat cycle, or too little data to build a coverline).
 */
export function detectBbtShift(entries: DailyLogEntry[]): BbtShiftSignal | null {
  const temps = extractValidTemps(entries);
  if (temps.length < MIN_COVERLINE_READINGS + ELEVATED_DAYS_REQUIRED) return null;

  // Index temps by date for O(1) lookahead/lookback by calendar date (rather
  // than by array position), since real data may have gaps.
  const byDate = new Map(temps.map((t) => [t.date, t.celsius]));

  // Walk candidate shift days in chronological order. A candidate must have
  // >=10 days of calendar history behind it in the dataset to even attempt a
  // coverline lookback.
  for (let i = 0; i < temps.length; i += 1) {
    const candidate = temps[i]!;

    // Gather valid readings strictly within the 10 days prior to the
    // candidate date (by calendar date, not array index, so gaps in logging
    // don't silently reach further back than intended). This is the
    // eligibility window: >=6 readings must fall inside it.
    const priorWindowStart = addDays(candidate.date, -COVERLINE_LOOKBACK_DAYS);
    const priorReadings = temps.filter(
      (t) => t.date >= priorWindowStart && t.date < candidate.date,
    );
    if (priorReadings.length < MIN_COVERLINE_READINGS) continue;

    // Coverline = highest of the most recent 6 valid readings prior to the
    // candidate (Marshall's "last 6"). `priorReadings` is chronologically
    // sorted (temps is), so slice the final 6 before taking the max -- an
    // older spike further back in the window must not inflate the coverline.
    const coverlineReadings = priorReadings.slice(-COVERLINE_READINGS);
    const coverline = Math.max(...coverlineReadings.map((t) => t.celsius));
    if (candidate.celsius < coverline + MIN_SHIFT_RISE_CELSIUS) continue;

    // Require the next 2 calendar days (not just the next 2 readings) to
    // exist and both remain above the coverline -- a gap where the next
    // reading is missing must not be treated as a confirming day.
    const day2Date = addDays(candidate.date, 1);
    const day3Date = addDays(candidate.date, 2);
    const day2 = byDate.get(day2Date);
    const day3 = byDate.get(day3Date);
    if (day2 == null || day3 == null) continue;
    if (day2 <= coverline || day3 <= coverline) continue;

    const shiftDateIso = candidate.date;
    const ovulationDateIso = addDays(shiftDateIso, -1);

    // Invariant: ovulationDateIso always strictly precedes shiftDateIso by
    // exactly one day here -- `addDays(shiftDateIso, -1)` guarantees this
    // for any well-formed ISO date, including across cycle-boundary and
    // month/year-rollover inputs (see dateMath.adversarial.test.ts), so no
    // separate runtime guard is needed.

    return {
      kind: 'bbt-shift',
      ovulationDateIso,
      shiftDateIso,
      confirmed: true,
      retrospective: true,
      prospective: false,
      uncertaintyDays: 0,
    };
  }

  return null;
}
