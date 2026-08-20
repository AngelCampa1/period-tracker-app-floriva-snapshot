import { Keyboard, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  buildFreshOnboardingProgress,
  ChoiceChip,
  ChoicePanel,
  InputField,
  OnboardingFooter,
  OnboardingAlert,
  OptionCard,
} from '@/src/features/onboarding/screens/shared';
import { theme } from '@/src/theme/tokens';
import { t } from '@/tests/helpers/localization';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) =>
      mockTriggerPressFeedback(...args),
  }),
}));

describe('onboarding shared fields', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
    jest.restoreAllMocks();
  });

  it('renders a secure text input when secret-entry props are supplied', () => {
    const handleChange = jest.fn();

    render(
      <InputField
        label="Backup passphrase"
        value="privacy-first"
        onChangeText={handleChange}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        error="Passphrase required"
        testID="shared-input"
      />,
    );

    const input = screen.getByTestId('shared-input');

    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
    expect(screen.getByText('Passphrase required')).toBeTruthy();

    fireEvent.changeText(input, 'new-passphrase');
    expect(handleChange).toHaveBeenCalledWith('new-passphrase');
  });

  it('uses the default text-input behavior when optional props are omitted', () => {
    render(
      <InputField
        label="Cycle notes"
        value=""
        onChangeText={() => undefined}
        testID="default-input"
      />,
    );

    const input = screen.getByTestId('default-input');

    expect(input.props.secureTextEntry).toBe(false);
    expect(input.props.autoCapitalize).toBe('sentences');
    expect(input.props.autoCorrect).toBe(true);
  });

  it('renders selectable chips and option cards for onboarding choices', () => {
    const handlePress = jest.fn();

    render(
      <>
        <ChoiceChip
          label="Trying to conceive"
          selected
          onPress={handlePress}
          testID="chip"
        />
        <ChoicePanel
          title="Review later"
          description="Leave this off for now and revisit it after setup."
          selected
          onPress={handlePress}
          testID="panel"
        />
        <OptionCard
          title="Manual setup"
          description="Add your cycle details directly."
        >
          <InputField
            label="Cycle length"
            value="29"
            onChangeText={() => undefined}
            testID="nested-input"
          />
        </OptionCard>
      </>,
    );

    fireEvent.press(screen.getByTestId('chip'));
    fireEvent.press(screen.getByTestId('panel'));
    expect(handlePress).toHaveBeenCalledTimes(2);
    expect(mockTriggerPressFeedback).toHaveBeenNthCalledWith(1, 'selection');
    expect(mockTriggerPressFeedback).toHaveBeenNthCalledWith(2, 'selection');
    expect(screen.getByText('Manual setup')).toBeTruthy();
    expect(screen.getByText('Add your cycle details directly.')).toBeTruthy();
    expect(screen.getByText(t('onboarding.shared.selected'))).toBeTruthy();
    expect(screen.getByTestId('nested-input')).toBeTruthy();
  });

  it('dismisses the keyboard when onboarding choice controls are selected', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const handlePress = jest.fn();

    render(
      <>
        <ChoiceChip
          label="28 days"
          selected={false}
          onPress={handlePress}
          testID="chip"
        />
        <ChoicePanel
          title="Pretty regular"
          description="Within two days month to month."
          selected={false}
          onPress={handlePress}
          testID="panel"
        />
      </>,
    );

    fireEvent.press(screen.getByTestId('chip'));
    fireEvent.press(screen.getByTestId('panel'));

    expect(dismissSpy).toHaveBeenCalledTimes(2);
    expect(handlePress).toHaveBeenCalledTimes(2);
  });

  it('lets shared option cards opt back into the default card treatment', () => {
    render(
      <OptionCard
        description="Keep the section visually stronger when it carries the main action."
        title="Primary setup"
        variant="default"
      >
        <InputField
          label="Cycle length"
          onChangeText={() => undefined}
          testID="default-variant-input"
          value="29"
        />
      </OptionCard>,
    );

    expect(screen.getByText('Primary setup')).toBeTruthy();
    expect(screen.getByTestId('default-variant-input')).toBeTruthy();
  });

  it('can rerender the onboarding alert when messages appear after an empty state', () => {
    const { rerender } = render(
      <OnboardingAlert messages={[]} title="Needs attention" />,
    );

    expect(screen.queryByRole('alert')).toBeNull();

    expect(() => {
      rerender(
        <OnboardingAlert
          messages={['Choose at least one goal before continuing.']}
          title="Needs attention"
        />,
      );
    }).not.toThrow();

    expect(screen.getByText('Needs attention')).toBeTruthy();
    expect(
      screen.getByText('Choose at least one goal before continuing.'),
    ).toBeTruthy();
  });

  it('renders a single continue action and respects the disabled state', () => {
    // UL-53: navigation back lives in the Screen back pill; the footer no
    // longer renders a duplicate Back button.
    const handleContinue = jest.fn();

    render(
      <OnboardingFooter
        continueDisabled
        continueLabel="Finish setup"
        continueTestID="shared-continue"
        onContinue={handleContinue}
      />,
    );

    expect(screen.queryByText('Back')).toBeNull();
    expect(
      screen.getByTestId('shared-continue').props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
  });

  it('dismisses the keyboard before running the continue action', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const handleContinue = jest.fn();

    render(
      <OnboardingFooter
        continueLabel="Continue"
        continueTestID="shared-continue"
        onContinue={handleContinue}
      />,
    );

    fireEvent.press(screen.getByTestId('shared-continue'));

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(handleContinue).toHaveBeenCalledTimes(1);
  });

  it('gives active onboarding continue actions a stronger visual state than disabled ones', () => {
    const { rerender } = render(
      <OnboardingFooter
        continueLabel="Continue"
        continueTestID="shared-continue"
        onContinue={() => undefined}
      />,
    );

    const activeStyle = StyleSheet.flatten(screen.getByTestId('shared-continue').props.style);
    expect(activeStyle.backgroundColor).toBe(theme.colors.accentPrimary);
    expect(activeStyle.shadowOpacity).toBeGreaterThan(0);
    expect(activeStyle.elevation).toBeGreaterThan(0);

    rerender(
      <OnboardingFooter
        continueDisabled
        continueLabel="Continue"
        continueTestID="shared-continue"
        onContinue={() => undefined}
      />,
    );

    const disabledStyle = StyleSheet.flatten(screen.getByTestId('shared-continue').props.style);
    // UL-37: disabled is a distinct muted surface (not a washed 0.5-opacity
    // accent) with the CTA lift removed.
    expect(disabledStyle.backgroundColor).toBe(theme.colors.surfaceMuted);
    expect(disabledStyle.borderColor).toBe(theme.colors.borderPrimary);
    expect(disabledStyle.opacity).toBeUndefined();
    expect(disabledStyle.shadowOpacity).toBe(0);
    expect(disabledStyle.elevation).toBe(0);
  });

  it('normalizes onboarding progress totals for TTC and non-TTC branches', () => {
    expect(buildFreshOnboardingProgress({ ttcEnabled: false }, 7)).toEqual({
      current: 7,
      total: 9,
      variant: 'bar',
    });

    expect(buildFreshOnboardingProgress({ ttcEnabled: true }, 8)).toEqual({
      current: 8,
      total: 10,
      variant: 'bar',
    });
  });
});
