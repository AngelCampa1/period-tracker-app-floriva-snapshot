/**
 * Long-tenure probes for the private timeline (workstream E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment. Deterministic via buildTenureDataset(variant, FIXED todayIso).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { buildPrivateTimelineModel } from '@/src/features/timeline/buildPrivateTimelineModel';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';

const TODAY = '2026-07-06';

describe('DOCUMENTED LT-10 — timeline volume and model-build cost at 12 months of tenure', () => {
  it('a 12-month dense dataset expands ~299 logs into 341 timeline items', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);
    const model = buildPrivateTimelineModel({
      dailyLogs: dataset.dailyLogs,
      imports: [],
      reminders: [],
    });

    // PrivateTimelineScreen loads logs via repositories.dailyLogs.listAll()
    // (UNBOUNDED — the only screen without a date window) and renders
    // visibleItems.map(...) — one Pressable row per item — inside the
    // non-virtualized Screen scroll view. At one year of tenure that is 341
    // mounted rows; the count grows linearly forever.
    //
    // SHOULD (perf, render-side): the item list belongs in a virtualized
    // list (FlatList/SectionList) or behind pagination. The MODEL build is
    // not the bottleneck (see next probe) — the finding is confined to the
    // unbounded read + non-virtualized render. Device-side impact not yet
    // measured -> ledger severity PLAUSIBLE pending the Phase 2 device
    // sweep.
    expect(dataset.dailyLogs).toHaveLength(299);
    expect(model.items).toHaveLength(341);
    expect(model.counts['daily-log']).toBe(299);
  });

  it('model build for the 12-month dataset stays well under 500ms in the node environment', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);

    const startedAt = Date.now();
    const model = buildPrivateTimelineModel({
      dailyLogs: dataset.dailyLogs,
      imports: [],
      reminders: [],
    });
    const elapsedMs = Date.now() - startedAt;

    // Observed ~0-4ms on the reference machine (Phase 1, 2026-07-06) — the
    // pure model transform is cheap even at a year of data. Generous bound
    // to stay CI-safe while still catching an accidental O(n^2) regression.
    expect(model.items.length).toBeGreaterThan(300);
    expect(elapsedMs).toBeLessThan(500);
  });

  it('items stay globally sorted newest-first with deterministic tie-breaks at full-year volume', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY);
    const model = buildPrivateTimelineModel({
      dailyLogs: dataset.dailyLogs,
      imports: [],
      reminders: [],
    });

    for (let index = 1; index < model.items.length; index += 1) {
      const previous = model.items[index - 1]!;
      const current = model.items[index]!;
      const dateOrder = previous.date.localeCompare(current.date);
      expect(dateOrder).toBeGreaterThanOrEqual(0);
      if (dateOrder === 0) {
        expect(previous.id.localeCompare(current.id)).toBeLessThanOrEqual(0);
      }
    }
  });
});
