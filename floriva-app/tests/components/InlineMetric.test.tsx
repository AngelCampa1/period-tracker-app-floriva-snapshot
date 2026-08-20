import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { florivaThemes } from '@/src/theme/tokens';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

describe('InlineMetric', () => {
  it('renders a compact metric label and value without needing a nested card wrapper', () => {
    render(<InlineMetric label="Next period" value="May 1" />);

    expect(screen.getByText('Next period')).toBeTruthy();
    expect(screen.getByText('May 1')).toBeTruthy();
  });

  it('uses the active dark theme surface for the metric shell', () => {
    render(<InlineMetric label="Next period" testID="metric" value="May 1" />);

    const motionShell = screen.getByTestId('metric-motion');
    const metricShell = motionShell.props.children;

    expect(metricShell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: florivaThemes.light.colors.surfaceSecondary,
          borderColor: florivaThemes.light.colors.borderPrimary,
        }),
      ]),
    );
  });

  it('renders through the shared motion shell so small stats can join staggered reveals', () => {
    render(<InlineMetric label="Next period" testID="metric" value="May 1" />);

    expect(screen.getByTestId('metric-motion')).toBeTruthy();
  });

  it('keeps the layout flex behavior on the motion wrapper so sibling metrics still share width', () => {
    render(<InlineMetric label="Next period" testID="metric" value="May 1" />);

    const motionShell = screen.getByTestId('metric-motion');

    expect(motionShell.props.style).toEqual(
      expect.objectContaining({
        flex: 1,
        minWidth: 132,
      }),
    );
  });

  it('renders accent numeric values in the tabular numeral typeface by default', () => {
    render(<InlineMetric label="Logs imported" tone="accent" value="42" />);

    const valueNode = screen.getByText('42');
    const flattened = StyleSheet.flatten(valueNode.props.style);

    expect(flattened.fontFamily).toBe(florivaThemes.light.typography.numeral.fontFamily);
  });

  it('renders accent prose values in the serif title face instead of the numeral mono face', () => {
    render(<InlineMetric label="Current language" numeric={false} tone="accent" value="System default · English" />);

    const valueNode = screen.getByText('System default · English');
    const flattened = StyleSheet.flatten(valueNode.props.style);

    expect(flattened.fontFamily).toBe(florivaThemes.light.typography.title.fontFamily);
    expect(flattened.fontFamily).not.toBe(florivaThemes.light.typography.numeral.fontFamily);
  });
});
