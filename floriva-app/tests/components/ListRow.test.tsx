import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ListRow } from '@/src/components/primitives/ListRow';
import { florivaThemes } from '@/src/theme/tokens';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@expo/vector-icons/FontAwesome', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text: MockText } = require('react-native');

    return <MockText>{name}</MockText>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

describe('ListRow', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('renders a compact navigation row with a chevron and triggers presses', () => {
    const onPress = jest.fn();

    render(
      <ListRow
        onPress={onPress}
        summary="Biometric lock off. Relocks after 1 minute."
        testID="privacy-row"
        title="Privacy & lock"
      />,
    );

    expect(screen.getByText('Privacy & lock')).toBeTruthy();
    expect(screen.getByText('Biometric lock off. Relocks after 1 minute.')).toBeTruthy();
    expect(screen.getByText('angle-right', { includeHiddenElements: true })).toBeTruthy();

    fireEvent.press(screen.getByTestId('privacy-row'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
  });

  it('keeps touch targets generous and uses dark-mode dividers', () => {
    render(
      <ListRow
        onPress={() => {}}
        summary="Biometric lock off. Relocks after 1 minute."
        testID="privacy-row"
        title="Privacy & lock"
      />,
    );

    const row = screen.getByTestId('privacy-row');

    expect(row.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          minHeight: 72,
          borderBottomColor: florivaThemes.light.colors.borderPrimary,
        }),
      ]),
    );
  });

  it('supports destructive rows without reusing the default navigation affordance', () => {
    render(
      <ListRow
        kind="destructive"
        onPress={() => {}}
        summary="Permanently remove cycle history from this device."
        testID="delete-row"
        title="Delete all data"
        trailingAccessory="none"
      />,
    );

    const row = screen.getByTestId('delete-row');
    const destructiveTitleStyle = StyleSheet.flatten(screen.getByText('Delete all data').props.style);

    expect(destructiveTitleStyle).toEqual(
      expect.objectContaining({
        color: florivaThemes.light.colors.danger,
      }),
    );
    expect(row.props.accessibilityRole).toBe('button');
    expect(screen.queryByText('angle-right')).toBeNull();
  });

  it('adds a subtle press shift by default and removes it when reduced motion is enabled', () => {
    render(
      <>
        <ListRow onPress={() => {}} testID="motion-row" title="Motion row" />
        <ListRow
          onPress={() => {}}
          reducedMotionEnabled
          testID="reduced-motion-row"
          title="Reduced motion row"
        />
      </>,
    );

    fireEvent(screen.getByTestId('motion-row'), 'pressIn');
    fireEvent(screen.getByTestId('reduced-motion-row'), 'pressIn');

    const motionPressedStyle = StyleSheet.flatten(
      screen.getByTestId('motion-row').props.style,
    );
    const reducedPressedStyle = StyleSheet.flatten(
      screen.getByTestId('reduced-motion-row').props.style,
    );

    expect(motionPressedStyle.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ translateX: expect.any(Number) })]),
    );
    expect(reducedPressedStyle.transform).toBeUndefined();
  });

  it('supports trailing labels and clears the press shift after press out', () => {
    render(
      <ListRow
        onPress={() => {}}
        testID="label-row"
        title="Reminder state"
        trailingAccessory="label"
        trailingLabel="Enabled"
      />,
    );

    expect(screen.getByText('Enabled')).toBeTruthy();

    fireEvent(screen.getByTestId('label-row'), 'pressIn');

    const pressedStyle = StyleSheet.flatten(screen.getByTestId('label-row').props.style);

    expect(pressedStyle.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ translateX: 2 })]),
    );

    fireEvent(screen.getByTestId('label-row'), 'pressOut');

    const restingStyle = StyleSheet.flatten(screen.getByTestId('label-row').props.style);

    expect(restingStyle.transform).toBeUndefined();
  });

  it('supports icon-led grouped rows and can suppress the final divider', () => {
    render(
      <ListRow
        iconName="lock"
        isLastInGroup
        onPress={() => {}}
        summary="On-device lock and diagnostics choices."
        testID="icon-row"
        title="Privacy"
      />,
    );

    const row = screen.getByTestId('icon-row');
    const rowStyle = StyleSheet.flatten(row.props.style);
    const iconFrame = screen.getByTestId('icon-row-icon-frame', {
      includeHiddenElements: true,
    });
    const iconFrameStyle = StyleSheet.flatten(iconFrame.props.style);

    expect(iconFrame).toBeTruthy();
    expect(rowStyle.borderBottomWidth).toBe(0);
    expect(iconFrame.props.accessible).toBe(false);
    expect(iconFrame.props.accessibilityElementsHidden).toBe(true);
    expect(iconFrame.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(iconFrameStyle.width).toBe(32);
    expect(iconFrameStyle.height).toBe(32);
    expect(iconFrameStyle.borderRadius).toBe(florivaThemes.light.radii.md);
  });
});
