/**
 * OPK (ovulation predictor kit) LH-surge ovulation signal.
 *
 * Domain vocabulary (`TtcObservation.ovulationTest`, src/types/domain.ts,
 * `ovulationTestValues`): `negative | positive | peak`.
 *
 * Clinical rationale: home LH-surge OPKs detect the luteinizing hormone
 * surge that precedes ovulation by ~24-36 hours. Consumer guidance (and most
 * charting apps) simplifies this to a fixed +1 day estimate:
 * - First `positive` result -> ovulation ~= positive date + 1 day.
 * - A `peak` result (a stronger/digital-peak reading, offered by some test
 *   brands) outweighs a `positive` -> ovulation ~= peak date + 1 day, even if
 *   an earlier `positive` was logged in the same cycle. `peak` is a more
 *   specific confirmation of the surge, so it takes priority regardless of
 *   chronological order relative to `positive` readings.
 *
 * Unlike BBT, an OPK surge can be acted on the same day it's observed -- it
 * is PROSPECTIVE (see types.ts): the orchestrator may use it to open/adjust
 * the fertile window ahead of confirmed ovulation.
 *
 * CALLER CONTRACT: pass a single cycle's entries. Behavior on multi-cycle
 * input is unspecified (this detector happens to resolve to the earliest
 * qualifying surge, but callers must not rely on that).
 */

import type { DailyLogEntry } from '@/src/types/domain';
import { addDays } from '@/src/lib/predictions/dateMath';
import type { OpkSurgeSignal } from '@/src/lib/predictions/signals/types';

type DatedResult = { date: string; result: 'negative' | 'positive' | 'peak' };

function extractOpkResults(entries: DailyLogEntry[]): DatedResult[] {
  const results: DatedResult[] = [];
  for (const entry of entries) {
    const result = entry.ttcObservation?.ovulationTest;
    if (result == null) continue;
    results.push({ date: entry.logDate, result });
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function detectOpkSurge(entries: DailyLogEntry[]): OpkSurgeSignal | null {
  const results = extractOpkResults(entries);
  if (results.length === 0) return null;

  // `peak` outweighs `positive` regardless of chronological order: prefer
  // the first `peak` if one exists anywhere in the data, else the first
  // `positive`.
  const firstPeak = results.find((r) => r.result === 'peak');
  const trigger = firstPeak ?? results.find((r) => r.result === 'positive');
  if (!trigger) return null;

  return {
    kind: 'opk-surge',
    ovulationDateIso: addDays(trigger.date, 1),
    triggerResult: trigger.result as 'positive' | 'peak',
    uncertaintyDays: 0,
    prospective: true,
    retrospective: false,
  };
}
