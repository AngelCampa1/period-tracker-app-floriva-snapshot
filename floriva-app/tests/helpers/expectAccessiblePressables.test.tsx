import { Pressable, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

import {
  expectAccessiblePressables,
  findInaccessiblePressables,
} from './expectAccessiblePressables';

describe('findInaccessiblePressables', () => {
  it('returns no violations for a Pressable with a role and text label', () => {
    const view = render(
      <Pressable accessibilityRole="button" onPress={() => {}}>
        <Text>Save</Text>
      </Pressable>,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([]);
  });

  it('returns no violations for a Pressable with a role and explicit accessibilityLabel', () => {
    const view = render(
      <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={() => {}} />,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([]);
  });

  it('flags a Pressable missing accessibilityRole', () => {
    const view = render(
      <Pressable onPress={() => {}} testID="unroled-button">
        <Text>Tap me</Text>
      </Pressable>,
    );

    const violations = findInaccessiblePressables(view.UNSAFE_root);

    expect(violations).toEqual([{ identifier: 'unroled-button', reason: 'missing-role' }]);
  });

  it('flags a Pressable with a role but no label and no text content', () => {
    const view = render(
      <Pressable accessibilityRole="button" onPress={() => {}} testID="silent-button">
        <View />
      </Pressable>,
    );

    const violations = findInaccessiblePressables(view.UNSAFE_root);

    expect(violations).toEqual([{ identifier: 'silent-button', reason: 'missing-label' }]);
  });

  it('ignores a Pressable hidden from the accessibility tree via accessibilityElementsHidden', () => {
    const view = render(
      <Pressable accessibilityElementsHidden onPress={() => {}} testID="hidden-button" />,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([]);
  });

  it('ignores a Pressable nested under an ancestor marked importantForAccessibility="no-hide-descendants"', () => {
    const view = render(
      <View importantForAccessibility="no-hide-descendants">
        <Pressable onPress={() => {}} testID="nested-hidden-button" />
      </View>,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([]);
  });

  it('does not flag a non-interactive View with no press handler', () => {
    const view = render(
      <View>
        <Text>Just some text</Text>
      </View>,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([]);
  });

  it('matches a plain function component named like a touchable and describes it via its accessibilityLabel when it has no testID', () => {
    // Exercises typeName's function-type branch (a function component has
    // typeof === 'function', unlike RN's object-wrapped Pressable) and
    // describeNode's accessibilityLabel fallback (no testID present).
    function TouchableOpacity(props: Record<string, unknown>) {
      return <View {...props} />;
    }

    const view = render(
      <TouchableOpacity accessibilityLabel="Fake dismiss" onPress={() => {}} />,
    );

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([
      {
        identifier: 'TouchableOpacity (accessibilityLabel="Fake dismiss")',
        reason: 'missing-role',
      },
    ]);
  });

  it('falls back to the bare type name when a violating touchable has no testID and no accessibilityLabel', () => {
    const view = render(<Pressable onPress={() => {}} />);

    expect(findInaccessiblePressables(view.UNSAFE_root)).toEqual([
      { identifier: 'Pressable', reason: 'missing-role' },
    ]);
  });

  it('collects multiple violations across a tree', () => {
    const view = render(
      <View>
        <Pressable onPress={() => {}} testID="first-offender" />
        <Pressable accessibilityRole="button" onPress={() => {}} testID="second-offender" />
      </View>,
    );

    const violations = findInaccessiblePressables(view.UNSAFE_root);

    expect(violations).toEqual([
      { identifier: 'first-offender', reason: 'missing-role' },
      { identifier: 'second-offender', reason: 'missing-label' },
    ]);
  });
});

describe('expectAccessiblePressables', () => {
  it('does not throw when every touchable is accessible', () => {
    const view = render(
      <Pressable accessibilityRole="button" onPress={() => {}}>
        <Text>Save</Text>
      </Pressable>,
    );

    expect(() => expectAccessiblePressables(view.UNSAFE_root)).not.toThrow();
  });

  it('throws a readable error listing every violation found', () => {
    const view = render(
      <Pressable onPress={() => {}} testID="broken-button" />,
    );

    expect(() => expectAccessiblePressables(view.UNSAFE_root)).toThrow(/broken-button: missing-role/);
  });
});
