import { fireEvent, render, screen } from '@testing-library/react-native';

import { EditorialOption } from '@/src/components/editorial/EditorialOption';

describe('EditorialOption', () => {
  it('renders the label, description, and kicker', () => {
    render(
      <EditorialOption
        kicker="Recommended"
        label="Track period"
        description="Log days, symptoms, and flow."
        testID="opt-period"
      />,
    );
    expect(screen.getByText('Track period')).toBeTruthy();
    expect(screen.getByText('Log days, symptoms, and flow.')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('reflects selection state for assistive tech', () => {
    render(
      <EditorialOption label="Track period" selected testID="opt-period" />,
    );
    const row = screen.getByTestId('opt-period');
    expect(row.props.accessibilityRole).toBe('radio');
    expect(row.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('invokes onPress when not disabled', () => {
    const onPress = jest.fn();
    render(<EditorialOption label="Track period" onPress={onPress} testID="opt-period" />);
    fireEvent.press(screen.getByTestId('opt-period'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      <EditorialOption
        label="Track period"
        disabled
        onPress={onPress}
        testID="opt-period"
      />,
    );
    fireEvent.press(screen.getByTestId('opt-period'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
