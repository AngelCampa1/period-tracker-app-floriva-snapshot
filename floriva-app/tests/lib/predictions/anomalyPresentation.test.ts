import {
  filterDismissedAnomalies,
  type Anomaly,
} from '@/src/lib/predictions/anomalyPresentation';

function buildAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'short-cycle:2026-04-01',
    kind: 'short-cycle',
    anchorDateIso: '2026-04-01',
    ...overrides,
  };
}

describe('filterDismissedAnomalies', () => {
  it('returns all anomalies unchanged (aside from sorting) when nothing is dismissed', () => {
    const anomalies = [buildAnomaly()];

    expect(filterDismissedAnomalies(anomalies, [])).toEqual(anomalies);
  });

  it('filters out anomalies whose id is in the dismissed list', () => {
    const dismissed = buildAnomaly({ id: 'long-cycle:2026-03-01', kind: 'long-cycle', anchorDateIso: '2026-03-01' });
    const kept = buildAnomaly({ id: 'short-cycle:2026-04-01', anchorDateIso: '2026-04-01' });

    const result = filterDismissedAnomalies([dismissed, kept], [dismissed.id]);

    expect(result).toEqual([kept]);
  });

  it('returns an empty array when every anomaly has been dismissed', () => {
    const anomalies = [
      buildAnomaly({ id: 'a', anchorDateIso: '2026-04-01' }),
      buildAnomaly({ id: 'b', anchorDateIso: '2026-03-01' }),
    ];

    expect(filterDismissedAnomalies(anomalies, ['a', 'b'])).toEqual([]);
  });

  it('returns an empty array when given no anomalies', () => {
    expect(filterDismissedAnomalies([], ['some-id'])).toEqual([]);
  });

  it('sorts the remaining anomalies most-recent anchorDateIso first', () => {
    const oldest = buildAnomaly({
      id: 'prolonged-bleeding:2026-01-01',
      kind: 'prolonged-bleeding',
      anchorDateIso: '2026-01-01',
    });
    const middle = buildAnomaly({
      id: 'missed-expected-period:2026-02-15',
      kind: 'missed-expected-period',
      anchorDateIso: '2026-02-15',
    });
    const newest = buildAnomaly({
      id: 'short-cycle:2026-04-01',
      kind: 'short-cycle',
      anchorDateIso: '2026-04-01',
    });

    const result = filterDismissedAnomalies([oldest, newest, middle], []);

    expect(result.map((anomaly) => anomaly.id)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it('preserves relative order when two anomalies share the same anchorDateIso', () => {
    const first = buildAnomaly({
      id: 'short-cycle:2026-04-01',
      kind: 'short-cycle',
      anchorDateIso: '2026-04-01',
    });
    const second = buildAnomaly({
      id: 'prolonged-bleeding:2026-04-01',
      kind: 'prolonged-bleeding',
      anchorDateIso: '2026-04-01',
    });

    const result = filterDismissedAnomalies([first, second], []);

    expect(result.map((anomaly) => anomaly.id)).toEqual([first.id, second.id]);
  });

  it('does not mutate the input array', () => {
    const anomalies = [
      buildAnomaly({ id: 'a', anchorDateIso: '2026-01-01' }),
      buildAnomaly({ id: 'b', anchorDateIso: '2026-04-01' }),
    ];
    const copy = [...anomalies];

    filterDismissedAnomalies(anomalies, []);

    expect(anomalies).toEqual(copy);
  });
});
