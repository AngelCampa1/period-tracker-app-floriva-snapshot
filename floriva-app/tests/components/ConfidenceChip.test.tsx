import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ConfidenceChip } from '@/src/components/primitives/ConfidenceChip';
import { florivaThemes } from '@/src/theme/tokens';

type RenderedNode = ReturnType<ReturnType<typeof render>['UNSAFE_root']['findAll']>[number];

function typeName(type: unknown): string | undefined {
  if (typeof type === 'string') {
    return type;
  }

  if (type && (typeof type === 'object' || typeof type === 'function')) {
    const named = type as { displayName?: string; name?: string };
    return named.displayName ?? named.name;
  }

  return undefined;
}

function findPressableComposite(root: ReturnType<typeof render>['UNSAFE_root']) {
  const [match] = root.findAll((node: RenderedNode) => typeName(node.type) === 'Pressable');

  if (!match) {
    throw new Error('No Pressable composite instance found in the rendered tree.');
  }

  return match;
}

describe('ConfidenceChip', () => {
  it('renders the confidence label and calls onPress when tapped', () => {
    const onPress = jest.fn();

    render(
      <ConfidenceChip
        accessibilityHint="Opens details about this confidence level"
        accessibilityLabel="Confidence: Established"
        label="Established"
        onPress={onPress}
        testID="confidence-chip"
      />,
    );

    expect(screen.getByText('Established')).toBeTruthy();

    fireEvent.press(screen.getByTestId('confidence-chip'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible button role, label, and hint', () => {
    render(
      <ConfidenceChip
        accessibilityHint="Opens details about this confidence level"
        accessibilityLabel="Confidence: Established"
        label="Established"
        onPress={() => undefined}
        testID="confidence-chip"
      />,
    );

    const chip = screen.getByTestId('confidence-chip');

    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityLabel).toBe('Confidence: Established');
    expect(chip.props.accessibilityHint).toBe('Opens details about this confidence level');
  });

  it('hides the info glyph from the accessibility tree', () => {
    render(
      <ConfidenceChip
        accessibilityHint="hint"
        accessibilityLabel="label"
        label="Established"
        onPress={() => undefined}
      />,
    );

    const glyph = screen.getByText('ⓘ', { includeHiddenElements: true });

    expect(glyph.props.accessibilityElementsHidden).toBe(true);
    expect(glyph.props.importantForAccessibility).toBe('no');
  });

  it('defaults to the inline variant using textPrimary for the label', () => {
    render(
      <ConfidenceChip
        accessibilityHint="hint"
        accessibilityLabel="label"
        label="Established"
        onPress={() => undefined}
      />,
    );

    const labelStyle = StyleSheet.flatten(screen.getByText('Established').props.style);

    expect(labelStyle.color).toBe(florivaThemes.light.colors.textPrimary);
  });

  it('UL-20: renders the filled variant as a warm espresso pill with background-colored text', () => {
    render(
      <ConfidenceChip
        accessibilityHint="hint"
        accessibilityLabel="label"
        label="Established"
        onPress={() => undefined}
        testID="confidence-chip-filled"
        variant="filled"
      />,
    );

    const chip = screen.getByTestId('confidence-chip-filled');
    const chipStyle = StyleSheet.flatten(chip.props.style);

    // The filled pill keeps its dark prominence but in the warm espresso
    // token (textSecondary) — never the near-black ink fill that fought the
    // editorial palette (UL-20), and never the oxblood CTA color.
    expect(chipStyle.backgroundColor).toBe(florivaThemes.light.colors.textSecondary);
    expect(chipStyle.backgroundColor).not.toBe(florivaThemes.light.colors.textPrimary);
    expect(chipStyle.borderRadius).toBe(florivaThemes.light.radii.pill);

    const labelStyle = StyleSheet.flatten(screen.getByText('Established').props.style);

    expect(labelStyle.color).toBe(florivaThemes.light.colors.background);
  });

  it.each([
    ['inline', undefined, 0.72] as const,
    ['filled', 'filled', 0.82] as const,
  ])(
    'resolves the %s variant pressed style function to the expected opacity, and to no opacity override when not pressed',
    (_name, variant, expectedPressedOpacity) => {
      const view = render(
        <ConfidenceChip
          accessibilityHint="hint"
          accessibilityLabel="label"
          label="Established"
          onPress={() => undefined}
          testID="confidence-chip"
          variant={variant}
        />,
      );

      // The composite Pressable instance (not the host View getByTestId
      // resolves to) is where the `style` prop is still the raw
      // `({ pressed }) => [...]` function, before React Native flattens it
      // against press state.
      const pressableInstance = findPressableComposite(view.UNSAFE_root);
      const styleFn = pressableInstance.props.style as (state: { pressed: boolean }) => unknown;

      expect(StyleSheet.flatten(styleFn({ pressed: true }) as never)).toMatchObject({
        opacity: expectedPressedOpacity,
      });

      const unpressedStyle = StyleSheet.flatten(styleFn({ pressed: false }) as never) as {
        opacity?: number;
      };

      expect(unpressedStyle.opacity).toBeUndefined();
    },
  );

  it.each([
    // Filled pill: 7pt vertical padding x2 + ~18pt caption line = ~32pt
    // tall, so 6pt top+bottom hitSlop reaches the 44pt minimum.
    ['filled', 'filled', { top: 6, bottom: 6 }, 32] as const,
    // Inline pair: one ~22pt bodyStrong line with no chrome, so 11pt
    // top+bottom reaches 44pt; horizontal slop guards short labels.
    ['inline', undefined, { top: 11, bottom: 11, left: 8, right: 8 }, 22] as const,
  ])(
    'gives the %s variant enough hitSlop to reach a 44pt touch target',
    (_name, variant, expectedHitSlop, approximateContentHeight) => {
      render(
        <ConfidenceChip
          accessibilityHint="hint"
          accessibilityLabel="label"
          label="Established"
          onPress={() => undefined}
          testID="confidence-chip"
          variant={variant}
        />,
      );

      const chip = screen.getByTestId('confidence-chip');

      expect(chip.props.hitSlop).toEqual(expectedHitSlop);

      const effectiveHeight =
        approximateContentHeight + expectedHitSlop.top + expectedHitSlop.bottom;

      expect(effectiveHeight).toBeGreaterThanOrEqual(44);
    },
  );

  it('merges a caller-provided style onto the chip', () => {
    render(
      <ConfidenceChip
        accessibilityHint="hint"
        accessibilityLabel="label"
        label="Established"
        onPress={() => undefined}
        style={{ marginTop: 12 }}
        testID="confidence-chip"
      />,
    );

    const chip = screen.getByTestId('confidence-chip');
    const style = StyleSheet.flatten(chip.props.style);

    expect(style).toMatchObject({ marginTop: 12 });
  });
});
