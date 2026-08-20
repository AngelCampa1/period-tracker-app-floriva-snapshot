/**
 * Cervical mucus "peak day" ovulation signal.
 *
 * Domain vocabulary (`TtcObservation.cervicalMucus`, src/types/domain.ts,
 * `cervicalMucusValues`): `dry | sticky | creamy | egg-white`.
 *
 * Clinical rationale: egg-white-quality mucus (clear, stretchy, slippery)
 * is the fertile-quality mucus that peaks immediately around ovulation. The
 * fertility-awareness "peak day" rule defines the peak as the LAST day of
 * egg-white-quality mucus before quality drops off (dries up) -- it can only
 * be identified in hindsight, once the drop-off is observed. Ovulation is
 * estimated to occur on (or within ~1 day of) the peak day; because mucus
 * observation is subjective and the weakest of the three signals here, it
 * carries the widest uncertainty band of the three detectors: +/-2 days.
 *
 * Critically, "dry-up" must be an OBSERVED non-egg-white entry on a later
 * day -- NOT merely the absence of further logging. A user who stops logging
 * mid-cycle has not necessarily dried up; treating silence as a dry-up would
 * fabricate a peak day out of missing data (relevant for imported/sparse
 * datasets). This signal is treated as prospective-adjacent (see types.ts):
 * once an egg-white run + dry-up is observed, the estimate is usable for
 * fertile-window purposes going forward, unlike BBT which is purely
 * retrospective.
 *
 * CALLER CONTRACT: pass a single cycle's entries. Behavior on multi-cycle
 * input is unspecified.
 *
 * SCAN DIRECTION -- deliberately newest-first, unlike bbtShift/opkSurge
 * (which resolve the FIRST/earliest qualifying event): within a single
 * cycle, the LAST egg-white day followed by an observed dry-up is the
 * clinically correct peak day. Fertile-quality mucus RETURNING after an
 * apparent dry-up resets the peak per the fertility-awareness "peak day"
 * rule -- the true peak is the last egg-white day that actually precedes
 * ovulation, so an earlier egg-white block that was followed by fertile
 * mucus returning is NOT the peak. "Last within the cycle" is therefore the
 * correct peak, and the single-cycle caller contract above is exactly what
 * keeps this newest-first walk from reaching back into a prior cycle's mucus
 * data. The asymmetry with bbtShift/opkSurge is intentional.
 */

import type { DailyLogEntry } from '@/src/types/domain';
import type { MucusPeakSignal } from '@/src/lib/predictions/signals/types';

// Weakest of the three signals -- widest uncertainty band.
const MUCUS_PEAK_UNCERTAINTY_DAYS = 2;

type DatedMucus = { date: string; quality: 'dry' | 'sticky' | 'creamy' | 'egg-white' };

function extractMucusReadings(entries: DailyLogEntry[]): DatedMucus[] {
  const readings: DatedMucus[] = [];
  for (const entry of entries) {
    const quality = entry.ttcObservation?.cervicalMucus;
    if (quality == null) continue;
    readings.push({ date: entry.logDate, quality });
  }
  return readings.sort((a, b) => a.date.localeCompare(b.date));
}

export function detectMucusPeak(entries: DailyLogEntry[]): MucusPeakSignal | null {
  const readings = extractMucusReadings(entries);
  if (readings.length === 0) return null;

  // Walk chronologically newest-first, looking for the last egg-white day
  // that has ANY later logged non-egg-white reading (an observed dry-up),
  // not simply the next reading -- a user could log egg-white again after a
  // single sticky day, so "next reading" is not equivalent to "dried up".
  for (let i = readings.length - 1; i >= 0; i -= 1) {
    const candidate = readings[i]!;
    if (candidate.quality !== 'egg-white') continue;

    const hasLaterDryUp = readings
      .slice(i + 1)
      .some((later) => later.quality !== 'egg-white');
    if (!hasLaterDryUp) continue;

    return {
      kind: 'mucus-peak',
      peakDateIso: candidate.date,
      ovulationDateIso: candidate.date,
      uncertaintyDays: MUCUS_PEAK_UNCERTAINTY_DAYS,
      prospective: true,
      retrospective: false,
    };
  }

  return null;
}
