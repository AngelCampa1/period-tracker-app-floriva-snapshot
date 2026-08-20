import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EditorialProgress } from '@/src/components/editorial/EditorialProgress';

describe('EditorialProgress', () => {
  it('renders one pip per total step plus a tabular counter', () => {
    render(<EditorialProgress total={4} current={2} testID="progress" />);

    const counter = screen.getByText('03 / 04');
    expect(counter).toBeTruthy();

    const counterStyle = StyleSheet.flatten(counter.props.style);
    expect(counterStyle.fontFamily).toBe('JetBrainsMono_500Medium');
  });

  it('exposes its progress to assistive technology', () => {
    render(<EditorialProgress total={5} current={1} testID="progress" />);

    const wrapper = screen.getByTestId('progress');
    expect(wrapper.props.accessibilityRole).toBe('progressbar');
    expect(wrapper.props.accessibilityValue).toEqual({ min: 1, max: 5, now: 2 });
  });

  it('clamps current to the [0, total) range', () => {
    render(<EditorialProgress total={3} current={99} testID="progress" />);
    expect(screen.getByText('03 / 03')).toBeTruthy();
  });

  it('handles a zero or negative total without crashing', () => {
    render(<EditorialProgress total={0} current={0} testID="progress" />);
    expect(screen.getByText('01 / 01')).toBeTruthy();
  });
});
