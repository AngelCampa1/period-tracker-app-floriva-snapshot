import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EditorialNumeral } from '@/src/components/editorial/EditorialNumeral';

describe('EditorialNumeral', () => {
  it('renders the numeric value with a tabular mono font', () => {
    render(<EditorialNumeral value={14} testID="numeral" />);
    const value = screen.getByText('14');
    const style = StyleSheet.flatten(value.props.style);
    expect(style.fontFamily).toBe('JetBrainsMono_500Medium');
    expect(style.fontSize).toBe(64);
  });

  it('renders an optional unit label', () => {
    render(<EditorialNumeral value={28} unit="days" />);
    expect(screen.getByText('days')).toBeTruthy();
  });

  it('clamps font scaling so hero numerals do not blow layouts', () => {
    render(<EditorialNumeral value={28} testID="numeral" />);
    const value = screen.getByText('28');
    expect(value.props.maxFontSizeMultiplier).toBe(1.4);
  });

  it('keeps the numeral line box taller than the glyph size so tall digits are not clipped', () => {
    render(<EditorialNumeral value={28} testID="numeral" />);
    const value = screen.getByText('28');
    const style = StyleSheet.flatten(value.props.style);

    expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    expect(style.includeFontPadding).toBe(true);
  });
});
