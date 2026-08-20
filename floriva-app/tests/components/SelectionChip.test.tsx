import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { florivaThemes } from '@/src/theme/tokens';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

describe('SelectionChip', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('renders semantic selected styles and triggers selection feedback', () => {
    const handlePress = jest.fn();

    render(
      <SelectionChip
        indicatorTestID="selection-chip-indicator"
        label="Cramps"
        onPress={handlePress}
        selected
        selectionIndicator="dot"
        testID="selection-chip"
      />,
    );

    const chip = screen.getByTestId('selection-chip');
    const chipStyle = StyleSheet.flatten(chip.props.style);

    expect(chipStyle.backgroundColor).toBe(florivaThemes.light.colors.chipSelectedFill);
    expect(chipStyle.borderColor).toBe(florivaThemes.light.colors.chipSelectedBorder);
    expect(chipStyle.borderRadius).toBe(florivaThemes.light.radii.pill);
    expect(screen.getByTestId('selection-chip-indicator')).toBeTruthy();

    fireEvent.press(chip);

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('selection');
  });

  it('renders a square checkbox affordance with a check mark for selected multi-select chips', () => {
    render(
      <SelectionChip
        indicatorTestID="symptom-indicator"
        label="Cramps"
        onPress={() => undefined}
        selected
        selectionIndicator="check"
        testID="symptom-chip"
      />,
    );

    const chip = screen.getByTestId('symptom-chip');

    expect(chip.props.accessibilityRole).toBe('checkbox');
    expect(chip.props.accessibilityState).toEqual({ disabled: false, checked: true });

    const indicator = screen.getByTestId('symptom-indicator');
    const indicatorStyle = StyleSheet.flatten(indicator.props.style);

    // A rounded square (checkbox), never the pill-shaped radio dot.
    expect(indicatorStyle.borderRadius).toBe(florivaThemes.light.radii.sm);
    expect(indicatorStyle.borderRadius).not.toBe(florivaThemes.light.radii.pill);
    // The glyph is hidden from the accessibility tree (the chip's own
    // accessibilityState.checked already conveys "selected" to screen
    // readers), so it must be queried with includeHiddenElements.
    expect(screen.getByText('✓', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps an empty checkbox visible for unselected multi-select chips so multiple choices read as allowed', () => {
    render(
      <SelectionChip
        indicatorTestID="symptom-indicator"
        label="Cramps"
        onPress={() => undefined}
        selectionIndicator="check"
        testID="symptom-chip"
      />,
    );

    expect(screen.getByTestId('symptom-indicator')).toBeTruthy();
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.getByTestId('symptom-chip').props.accessibilityState).toEqual({
      disabled: false,
      checked: false,
    });
  });

  it('UL-73/UL-64: keeps the label and indicator slot on a single content row', () => {
    render(
      <SelectionChip
        indicatorTestID="libido-indicator"
        label="Libido changes"
        onPress={() => undefined}
        selectionIndicator="check"
        testID="libido-chip"
      />,
    );

    const content = screen.getByTestId('libido-chip-content');
    const contentStyle = StyleSheet.flatten(content.props.style);

    // The row must never wrap: with wrapping enabled, the (invisible)
    // reserved indicator slot could break onto its own line, inflating the
    // chip and floating short labels high ("Heavy", "Low", "Sticky",
    // "Positive test") or double-decking the checkbox under long labels
    // ("Libido changes").
    expect(contentStyle.flexWrap).toBeUndefined();
    expect(contentStyle.flexDirection).toBe('row');

    // The label is the flexible part: it may wrap internally as text, so the
    // indicator keeps its seat on the shared row.
    const labelStyle = StyleSheet.flatten(screen.getByText('Libido changes').props.style);
    expect(labelStyle.flexShrink).toBe(1);
  });

  it('renders tall and highlighted variants without a content testID when none is supplied', () => {
    render(
      <SelectionChip
        highlighted
        label="Backups"
        onPress={() => undefined}
        selectionIndicator="dot"
        size="tall"
      />,
    );

    const chip = screen.getByLabelText('Backups');
    const chipStyle = StyleSheet.flatten(chip.props.style);

    expect(chipStyle.minHeight).toBe(52);
    expect(chipStyle.backgroundColor).toBe(florivaThemes.light.colors.buttonGlassFill);
    // No testID prop → no derived `-content` handle is exposed.
    expect(screen.queryByTestId('-content')).toBeNull();
  });

  it('keeps press transforms out of reduced-motion rendering', () => {
    render(
      <SelectionChip
        label="Tenderness"
        onPress={() => undefined}
        reducedMotionEnabled
        testID="reduced-selection-chip"
      />,
    );

    const chip = screen.getByTestId('reduced-selection-chip');

    fireEvent(chip, 'pressIn');

    const chipStyle = StyleSheet.flatten(chip.props.style);

    expect(chipStyle.transform).toBeUndefined();
  });

  it('exposes disabled accessibility state and blocks presses when disabled', () => {
    const handlePress = jest.fn();

    render(
      <SelectionChip
        disabled
        label="Sleep changes"
        onPress={handlePress}
        selected
        testID="disabled-selection-chip"
      />,
    );

    const chip = screen.getByTestId('disabled-selection-chip');

    expect(chip.props.accessibilityState).toEqual({ disabled: true, selected: true });

    fireEvent.press(chip);

    expect(handlePress).not.toHaveBeenCalled();
  });
});
