import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SelectionPanel } from '@/src/components/primitives/SelectionPanel';
import { florivaThemes } from '@/src/theme/tokens';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

describe('SelectionPanel', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('renders semantic selected styles and badge content', () => {
    render(
      <SelectionPanel
        description="Leave this off for now and revisit it after setup."
        selected
        selectedBadgeLabel="Selected"
        title="Review later"
        onPress={() => undefined}
        testID="selection-panel"
      />,
    );

    const panel = screen.getByTestId('selection-panel');
    const panelStyle = StyleSheet.flatten(panel.props.style);

    expect(panelStyle.backgroundColor).toBe(florivaThemes.light.colors.chipSelectedFill);
    expect(panelStyle.borderColor).toBe(florivaThemes.light.colors.accentPrimary);
    expect(screen.getByText('Selected')).toBeTruthy();
  });

  it('triggers selection feedback when pressed', () => {
    const handlePress = jest.fn();

    render(
      <SelectionPanel
        description="Track symptoms with condition-aware logging."
        title="Turn this on"
        onPress={handlePress}
        testID="selection-panel"
      />,
    );

    fireEvent.press(screen.getByTestId('selection-panel'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('selection');
  });

  it('renders kicker label above the panel title when provided', () => {
    render(
      <SelectionPanel
        description="Answer a few setup questions, then land in your tracker."
        kicker="Recommended"
        title="Start fresh"
        onPress={() => undefined}
        testID="kicker-panel"
      />,
    );

    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Start fresh')).toBeTruthy();
  });

  it('keeps press transforms out of reduced-motion rendering', () => {
    render(
      <SelectionPanel
        description="Track symptoms with condition-aware logging."
        reducedMotionEnabled
        title="Turn this on"
        onPress={() => undefined}
        testID="reduced-selection-panel"
      />,
    );

    const panel = screen.getByTestId('reduced-selection-panel');

    fireEvent(panel, 'pressIn');

    const panelStyle = StyleSheet.flatten(panel.props.style);

    expect(panelStyle.transform).toBeUndefined();
  });
});
