import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { Text } from '@/src/components/primitives/Text';
import { florivaThemes } from '@/src/theme/tokens';

describe('Text', () => {
  it('applies the Floriva baseline text treatment (textPrimary + typography.body)', () => {
    render(<Text>Floriva</Text>);

    const flattened = StyleSheet.flatten(screen.getByText('Floriva').props.style);

    expect(flattened).toEqual(
      expect.objectContaining({
        color: florivaThemes.light.colors.textPrimary,
        ...florivaThemes.light.typography.body,
      }),
    );
  });

  it('lets call-site styles override the baseline color and typography', () => {
    render(
      <Text style={{ color: '#123456', fontSize: 11 }}>Overridden</Text>,
    );

    const flattened = StyleSheet.flatten(screen.getByText('Overridden').props.style);

    expect(flattened.color).toBe('#123456');
    expect(flattened.fontSize).toBe(11);
    expect(flattened.lineHeight).toBe(florivaThemes.light.typography.body.lineHeight);
  });

  it('forwards native text props untouched', () => {
    render(
      <Text numberOfLines={1} testID="metric-caption">
        Forwarded
      </Text>,
    );

    expect(screen.getByTestId('metric-caption').props.numberOfLines).toBe(1);
  });
});
