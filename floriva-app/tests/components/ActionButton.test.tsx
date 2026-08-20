import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ActionButton } from '@/src/components/primitives/ActionButton';
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

describe('ActionButton', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('prevents presses and exposes disabled accessibility state when disabled', () => {
    const onPress = jest.fn();

    render(
      <ActionButton disabled onPress={onPress} testID="action-button">
        Locked action
      </ActionButton>,
    );

    const button = screen.getByTestId('action-button');

    expect(button.props.accessibilityState).toEqual({ disabled: true });

    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('UL-37: renders filled appearances with a distinct muted disabled surface, not bare opacity', () => {
    const appearances = ['primary', 'secondary', 'glass', 'destructive'] as const;

    render(
      <>
        {appearances.map((appearance) => (
          <ActionButton
            appearance={appearance}
            disabled
            key={appearance}
            onPress={() => {}}
            testID={`disabled-${appearance}`}
          >
            {`Disabled ${appearance}`}
          </ActionButton>
        ))}
      </>,
    );

    for (const appearance of appearances) {
      const style = StyleSheet.flatten(screen.getByTestId(`disabled-${appearance}`).props.style);
      // One shared disabled surface across every filled appearance —
      // desaturated fill + rule border instead of a washed accent.
      expect(style.backgroundColor).toBe(florivaThemes.light.colors.surfaceMuted);
      expect(style.borderColor).toBe(florivaThemes.light.colors.borderPrimary);
      // The ambiguous flat-opacity treatment is gone.
      expect(style.opacity).toBeUndefined();

      const labelStyle = StyleSheet.flatten(
        screen.getByText(`Disabled ${appearance}`).props.style,
      );
      expect(labelStyle.color).toBe(florivaThemes.light.colors.textTertiary);
    }
  });

  it('UL-37: keeps quiet buttons unfilled when disabled but mutes the label', () => {
    render(
      <ActionButton appearance="quiet" disabled onPress={() => {}} testID="disabled-quiet">
        Disabled quiet
      </ActionButton>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('disabled-quiet').props.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe('transparent');
    expect(style.opacity).toBeUndefined();

    const labelStyle = StyleSheet.flatten(screen.getByText('Disabled quiet').props.style);
    expect(labelStyle.color).toBe(florivaThemes.light.colors.textTertiary);
  });

  it('UL-37: leaves enabled appearances untouched by the disabled treatment', () => {
    render(
      <ActionButton onPress={() => {}} testID="enabled-primary">
        Enabled primary
      </ActionButton>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('enabled-primary').props.style);
    expect(style.backgroundColor).toBe(florivaThemes.light.colors.accentPrimary);

    const labelStyle = StyleSheet.flatten(screen.getByText('Enabled primary').props.style);
    expect(labelStyle.color).toBe(florivaThemes.light.colors.buttonPrimaryText);
  });

  it('exposes selected accessibility state for filter-style buttons', () => {
    render(
      <ActionButton accessibilitySelected onPress={() => {}} testID="selected-button">
        Selected
      </ActionButton>,
    );

    expect(screen.getByTestId('selected-button').props.accessibilityState).toEqual({
      disabled: false,
      selected: true,
    });
  });

  it('uses the active theme for primary and secondary button fills', () => {
    render(
      <>
        <ActionButton onPress={() => {}} testID="primary-button">
          Primary
        </ActionButton>
        <ActionButton appearance="secondary" onPress={() => {}} testID="secondary-button">
          Secondary
        </ActionButton>
      </>,
    );

    const primaryButton = screen.getByTestId('primary-button');
    const secondaryButton = screen.getByTestId('secondary-button');
    const primaryStyle = StyleSheet.flatten(primaryButton.props.style);
    const secondaryStyle = StyleSheet.flatten(secondaryButton.props.style);

    expect(primaryStyle.backgroundColor).toBe(florivaThemes.light.colors.accentPrimary);
    expect(primaryStyle.borderRadius).toBe(florivaThemes.light.radii.pill);
    expect(secondaryStyle.backgroundColor).toBe(florivaThemes.light.colors.buttonSecondaryFill);
    expect(secondaryStyle.borderColor).toBe(florivaThemes.light.colors.buttonSecondaryBorder);
  });

  it('can keep selected button labels on one line with bounded font scaling', () => {
    render(
      <ActionButton fitLabelToSingleLine onPress={() => {}} testID="single-line-button">
        Turn off
      </ActionButton>,
    );

    const label = screen.getByText('Turn off');

    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.82);
  });

  it('allows multiline labels unless fitting is requested', () => {
    render(
      <ActionButton onPress={() => {}} testID="default-label-button">
        Longer label
      </ActionButton>,
    );

    const label = screen.getByText('Longer label');

    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.adjustsFontSizeToFit).toBe(false);
    expect(label.props.minimumFontScale).toBeUndefined();
  });

  it('supports glass, quiet, and destructive pill variants', () => {
    render(
      <>
        <ActionButton appearance="glass" onPress={() => {}} testID="glass-button">
          Glass
        </ActionButton>
        <ActionButton appearance="quiet" onPress={() => {}} testID="quiet-button">
          Quiet
        </ActionButton>
        <ActionButton appearance="destructive" onPress={() => {}} testID="destructive-style-button">
          Delete
        </ActionButton>
      </>,
    );

    const glassStyle = StyleSheet.flatten(screen.getByTestId('glass-button').props.style);
    const quietStyle = StyleSheet.flatten(screen.getByTestId('quiet-button').props.style);
    const destructiveStyle = StyleSheet.flatten(
      screen.getByTestId('destructive-style-button').props.style,
    );
    const destructiveTextStyle = StyleSheet.flatten(screen.getByText('Delete').props.style);

    expect(glassStyle.backgroundColor).toBe(florivaThemes.light.colors.buttonGlassFill);
    expect(glassStyle.borderColor).toBe(florivaThemes.light.colors.buttonGlassBorder);
    expect(glassStyle.borderRadius).toBe(florivaThemes.light.radii.pill);
    expect(quietStyle.backgroundColor).toBe(florivaThemes.light.colors.buttonQuietFill);
    expect(quietStyle.borderRadius).toBe(florivaThemes.light.radii.pill);
    expect(destructiveStyle.backgroundColor).toBe(
      florivaThemes.light.colors.buttonDestructiveFill,
    );
    expect(destructiveStyle.borderColor).toBe(
      florivaThemes.light.colors.buttonDestructiveBorder,
    );
    expect(destructiveStyle.borderRadius).toBe(florivaThemes.light.radii.pill);
    expect(destructiveStyle.backgroundColor).toBe(florivaThemes.light.colors.danger);
    expect(destructiveTextStyle.color).toBe(florivaThemes.light.colors.buttonDestructiveText);
  });

  it('triggers action feedback after a successful press', () => {
    const onPress = jest.fn();

    render(
      <ActionButton onPress={onPress} testID="feedback-button">
        Feedback
      </ActionButton>,
    );

    fireEvent.press(screen.getByTestId('feedback-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
  });

  it('adds richer press motion by default and removes it for reduced-motion users', () => {
    render(
      <>
        <ActionButton onPress={() => {}} testID="motion-button">
          Motion
        </ActionButton>
        <ActionButton onPress={() => {}} reducedMotionEnabled testID="reduced-motion-button">
          Reduced motion
        </ActionButton>
      </>,
    );

    fireEvent(screen.getByTestId('motion-button'), 'pressIn');
    fireEvent(screen.getByTestId('reduced-motion-button'), 'pressIn');

    const motionPressedStyle = StyleSheet.flatten(
      screen.getByTestId('motion-button').props.style,
    );
    const reducedPressedStyle = StyleSheet.flatten(
      screen.getByTestId('reduced-motion-button').props.style,
    );

    expect(motionPressedStyle.transform).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scale: expect.any(Number) }),
        expect.objectContaining({ translateY: expect.any(Number) }),
      ]),
    );
    expect(reducedPressedStyle.transform).toBeUndefined();
  });

  it('supports destructive press tuning and clears motion after press out', () => {
    render(
      <ActionButton motionVariant="destructive" onPress={() => {}} testID="destructive-button">
        Delete
      </ActionButton>,
    );

    fireEvent(screen.getByTestId('destructive-button'), 'pressIn');

    const pressedStyle = StyleSheet.flatten(screen.getByTestId('destructive-button').props.style);

    expect(pressedStyle.transform).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scale: 0.985 }),
        expect.objectContaining({ translateY: 0 }),
      ]),
    );

    fireEvent(screen.getByTestId('destructive-button'), 'pressOut');

    const restingStyle = StyleSheet.flatten(screen.getByTestId('destructive-button').props.style);

    expect(restingStyle.transform).toBeUndefined();
  });
});
