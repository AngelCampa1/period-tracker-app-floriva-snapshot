import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

// eslint-disable-next-line import/first
import { CycleRibbon } from '@/src/components/editorial/CycleRibbon';

describe('CycleRibbon', () => {
  it('renders phase segment views', () => {
    render(<CycleRibbon cycleDay={14} cycleLengthDays={28} testID="ribbon" />);

    expect(screen.getByTestId('ribbon')).toBeTruthy();
  });

  it('renders the day marker within the ribbon', () => {
    render(<CycleRibbon cycleDay={7} cycleLengthDays={28} testID="ribbon" />);

    expect(screen.getByTestId('ribbon-day-marker')).toBeTruthy();
  });

  it('renders phase labels for all four phases', () => {
    render(<CycleRibbon cycleDay={1} cycleLengthDays={28} testID="ribbon" />);

    expect(screen.getByText('Period')).toBeTruthy();
    expect(screen.getByText('Follicular')).toBeTruthy();
    expect(screen.getByText('Fertile')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
  });

  it.each([
    ['es', ['Periodo', 'Folicular', 'Fértil', 'Lútea']],
    ['de', ['Periode', 'Follikelphase', 'Fruchtbare Phase', 'Lutealphase']],
    ['fr', ['Règles', 'Folliculaire', 'Fertile', 'Lutéale']],
    ['ja', ['生理期', '卵胞期', '妊娠しやすい時期', '黄体期']],
    ['zh-Hans', ['经期', '卵泡期', '易孕期', '黄体期']],
    ['pt', ['Menstruação', 'Folicular', 'Fértil', 'Lútea']],
    ['ru', ['Месячные', 'Фолликулярная фаза', 'Фертильная фаза', 'Лютеиновая фаза']],
  ] as const)('localizes the phase legend for %s', (locale, labels) => {
    render(<CycleRibbon cycleDay={14} cycleLengthDays={28} locale={locale} testID="ribbon" />);

    for (const label of labels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Period')).toBeNull();
  });

  it('keeps phase legend labels readable instead of constraining them to narrow segment widths', () => {
    render(<CycleRibbon cycleDay={16} cycleLengthDays={28} periodLengthDays={6} testID="ribbon" />);

    const follicularItem = screen.getByTestId('ribbon-phase-follicular');
    const follicularLabel = screen.getByTestId('ribbon-phase-follicular-label');

    expect(follicularItem.props.accessibilityLabel).toBe('Follicular, days 7 to 9');
    expect(follicularItem.props.style).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: expect.any(String),
        }),
      ]),
    );
    expect(follicularLabel.props.numberOfLines).toBe(1);
  });

  it('renders the phase legend as a wrapping row under constrained width', () => {
    render(
      <View style={{ width: 144 }}>
        <CycleRibbon cycleDay={16} cycleLengthDays={28} periodLengthDays={6} testID="ribbon" />
      </View>,
    );

    const legend = screen.getByTestId('ribbon-phase-legend');

    expect(legend.props.style).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        flexWrap: 'wrap',
      }),
    );
    expect(screen.getByText('Follicular')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
  });

  it('UL-24: gives legend items a two-column basis so the four phases never wrap 3+1', () => {
    render(<CycleRibbon cycleDay={16} cycleLengthDays={28} periodLengthDays={6} testID="ribbon" />);

    for (const phase of ['period', 'follicular', 'fertile', 'luteal']) {
      const item = screen.getByTestId(`ribbon-phase-${phase}`);
      const style = StyleSheet.flatten(item.props.style);

      // On phone widths the free-wrapping row broke 3+1, orphaning LUTEAL
      // on its own line. A ~half-row flex basis pins the legend to a steady
      // 2x2 grid -- deliberate columns instead of a ragged wrap.
      expect(style.flexBasis).toBe('46%');
      expect(style.flexGrow).toBe(1);
    }
  });

  it('uses neutral phase labels when fertility estimates are hidden', () => {
    render(
      <CycleRibbon
        cycleDay={14}
        cycleLengthDays={28}
        showFertilityEstimates={false}
        testID="ribbon"
      />,
    );

    expect(screen.getByText('Period')).toBeTruthy();
    expect(screen.getByText('Earlier cycle')).toBeTruthy();
    expect(screen.getByText('Later cycle')).toBeTruthy();
    expect(screen.queryByText('Fertile')).toBeNull();
    expect(screen.queryByText('Follicular')).toBeNull();
    expect(screen.queryByText('Luteal')).toBeNull();
  });

  it('clamps cycleDay to cycleLengthDays when day exceeds length', () => {
    // Should not throw — day marker position is clamped
    expect(() => {
      render(<CycleRibbon cycleDay={35} cycleLengthDays={28} testID="ribbon" />);
    }).not.toThrow();
  });

  it('clamps cycleDay to 1 when day is zero or negative', () => {
    expect(() => {
      render(<CycleRibbon cycleDay={0} cycleLengthDays={28} testID="ribbon" />);
    }).not.toThrow();

    expect(screen.getByTestId('ribbon')).toBeTruthy();
  });

  it('renders without testID prop', () => {
    expect(() => {
      render(<CycleRibbon cycleDay={5} cycleLengthDays={28} />);
    }).not.toThrow();
  });

  it('aligns phase day ranges with the shared prediction phase model', () => {
    // 29-day cycle, 5-day period: the fertile window is the 6-day span ending 14 days
    // before the next period (days 11-16), exactly as the Insights phase-rhythm chart
    // derives it, so the two screens agree. Luteal is ~13 days.
    render(<CycleRibbon cycleDay={1} cycleLengthDays={29} periodLengthDays={5} testID="ribbon" />);

    expect(screen.getByText('1-5')).toBeTruthy(); // Period (5 days)
    expect(screen.getByText('6-10')).toBeTruthy(); // Follicular (5 days)
    expect(screen.getByText('11-16')).toBeTruthy(); // Fertile (6 days)
    expect(screen.getByText('17-29')).toBeTruthy(); // Luteal (13 days)
  });

  it('uses the live prediction fertileWindowStartOffsetDays when provided, instead of the default formula (A4 phase-model agreement)', () => {
    // Same 29-day/5-day-period cycle as above, but simulating a
    // signal-confirmed window that opens 3 days EARLIER than the default
    // formula would place it (offset 6 instead of the default 10 = 29-19).
    // Without wiring this prop through, the ribbon would silently disagree
    // with Calendar/Insights whenever the engine emits a signal-confirmed
    // window -- see buildTodaySnapshot.ts / buildPredictionResult.ts.
    render(
      <CycleRibbon
        cycleDay={1}
        cycleLengthDays={29}
        periodLengthDays={5}
        fertileWindowStartOffsetDays={6}
        testID="ribbon"
      />,
    );

    expect(screen.getByText('1-5')).toBeTruthy(); // Period (5 days)
    expect(screen.getByText('6-6')).toBeTruthy(); // Follicular shrinks to 1 day
    expect(screen.getByText('7-12')).toBeTruthy(); // Fertile (6 days), starting at offset 6
    expect(screen.getByText('13-29')).toBeTruthy(); // Luteal absorbs the rest
  });

  // UL-05 / UL-81 (docs/qa/2026-07-22-ui-lift/phase-1/findings.md): a short
  // cycle can legitimately leave zero days between the period and the
  // fertile window (e.g. 25-day cycle, 6-day period, fertile offset 6). The
  // legend used to render that zero-length phase as an INVERTED range
  // ("FOLLICULAR 7-6" next to "FERTILE 7-12") -- the designed treatment is
  // to omit zero-length phases entirely: the remaining ranges stay
  // contiguous and honest, and no broken "start > end" label can appear.
  describe('UL-05/UL-81 — zero-length phases are omitted, never rendered inverted', () => {
    it('omits a zero-length follicular phase from the legend (qa-rich-history shape: 25-day cycle, 6-day period)', () => {
      render(
        <CycleRibbon
          cycleDay={14}
          cycleLengthDays={25}
          periodLengthDays={6}
          fertileWindowStartOffsetDays={6}
          testID="ribbon"
        />,
      );

      expect(screen.queryByText('Follicular')).toBeNull();
      expect(screen.queryByText('7-6')).toBeNull();
      expect(screen.getByText('1-6')).toBeTruthy(); // Period
      expect(screen.getByText('7-12')).toBeTruthy(); // Fertile opens right after the period
      expect(screen.getByText('13-25')).toBeTruthy(); // Luteal
    });

    it('never renders an inverted (start > end) range for any phase across short cycles', () => {
      for (const cycleLengthDays of [20, 21, 22, 23, 24, 25, 26]) {
        const view = render(
          <CycleRibbon
            cycleDay={1}
            cycleLengthDays={cycleLengthDays}
            periodLengthDays={6}
            testID="ribbon"
          />,
        );

        for (const phase of ['period', 'follicular', 'fertile', 'luteal']) {
          const label = screen.queryByTestId(`ribbon-phase-${phase}`);
          if (!label) continue; // omitted zero-length phase — the designed treatment

          const match = label.props.accessibilityLabel?.match(/days (\d+) to (\d+)$/);
          expect(match).toBeTruthy();
          expect(Number(match![1])).toBeLessThanOrEqual(Number(match![2]));
        }

        view.unmount();
      }
    });

    it('keeps all four phases when every phase has at least one day', () => {
      render(<CycleRibbon cycleDay={1} cycleLengthDays={29} periodLengthDays={5} testID="ribbon" />);

      expect(screen.getByText('Period')).toBeTruthy();
      expect(screen.getByText('Follicular')).toBeTruthy();
      expect(screen.getByText('Fertile')).toBeTruthy();
      expect(screen.getByText('Luteal')).toBeTruthy();
    });
  });
});
