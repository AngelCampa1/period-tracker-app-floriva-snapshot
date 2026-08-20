import { fireEvent, render, screen } from '@testing-library/react-native';

import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { florivaThemes } from '@/src/theme/tokens';

jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');

describe('HelpTooltip', () => {
  it('opens and closes an accessible help sheet', () => {
    render(
      <HelpTooltip
        body="This is a planning aid, not medical advice."
        title="Fertile window"
      />,
    );

    expect(screen.queryByText('This is a planning aid, not medical advice.')).toBeNull();

    fireEvent.press(screen.getByLabelText('Help: Fertile window'));

    expect(screen.getByText('Fertile window')).toBeTruthy();
    expect(screen.getByText('This is a planning aid, not medical advice.')).toBeTruthy();

    fireEvent.press(screen.getByText('Close'));

    expect(screen.queryByText('This is a planning aid, not medical advice.')).toBeNull();
  });

  it('supports custom labels without blocking the surrounding screen', () => {
    render(
      <>
        <HelpTooltip
          accessibilityLabel="Open confidence help"
          body="Confidence reflects how much local history supports this estimate."
          closeLabel="Got it"
          testID="confidence-help"
          title="Confidence"
        />
      </>
    );

    expect(screen.getByTestId('confidence-help')).toBeTruthy();
    expect(screen.queryByText('Confidence')).toBeNull();

    fireEvent.press(screen.getByLabelText('Open confidence help'));

    expect(screen.getByText('Confidence')).toBeTruthy();
  });

  it('closes when the sheet backdrop is pressed', () => {
    render(
      <HelpTooltip
        body="Ovulation timing is only an estimate."
        title="Ovulation estimate"
      />,
    );

    fireEvent.press(screen.getByLabelText('Help: Ovulation estimate'));
    expect(screen.getByText('Ovulation estimate')).toBeTruthy();

    fireEvent.press(screen.getAllByLabelText('Close')[0]);

    expect(screen.queryByText('Ovulation estimate')).toBeNull();
  });

  it('closes with a custom close button', () => {
    render(
      <HelpTooltip
        body="Confidence reflects available local history."
        closeLabel="Got it"
        title="Confidence"
      />,
    );

    fireEvent.press(screen.getByLabelText('Help: Confidence'));
    expect(screen.getByText('Confidence')).toBeTruthy();
    fireEvent.press(screen.getByText('Got it'));
    expect(screen.queryByText('Confidence')).toBeNull();
  });

  it('renders the help sheet as a glass surface without a solid background fill', () => {
    render(
      <HelpTooltip
        body="This is a planning aid, not medical advice."
        testID="fertile-help"
        title="Fertile window"
      />,
    );

    fireEvent.press(screen.getByLabelText('Help: Fertile window'));

    const sheet = screen.getByTestId('fertile-help-sheet');
    const sheetStyle = Array.isArray(sheet.props.style)
      ? Object.assign({}, ...sheet.props.style.flat(Infinity).filter(Boolean))
      : sheet.props.style;
    // The fill now comes from the GlassSurface (glass fallback token in jest),
    // not the old hardcoded solid background, and the rounded top is preserved.
    expect(sheetStyle.backgroundColor).toBe(florivaThemes.light.glass.fallback.regular);
    expect(sheetStyle.backgroundColor).not.toBe(florivaThemes.light.colors.background);
    expect(sheetStyle.borderTopLeftRadius).toBeGreaterThan(0);
  });
});
