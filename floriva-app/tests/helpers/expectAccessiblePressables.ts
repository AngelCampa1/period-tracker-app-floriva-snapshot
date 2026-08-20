import type { RenderResult } from '@testing-library/react-native';

// `react-test-renderer` ships no type declarations in this project (adding
// them just for this one helper isn't worth the dependency), so the node
// type is inferred from RNTL's own `RenderResult['UNSAFE_root']` instead of
// importing `ReactTestInstance` directly.
type ReactTestInstance = RenderResult['UNSAFE_root'];

/**
 * Walks a rendered RNTL tree and flags any `Pressable`/`TouchableOpacity`/
 * `TouchableHighlight`/`TouchableWithoutFeedback` (matched by component
 * display name, so it works across the app's actual component tree rather
 * than the host-node tree React Native compiles them down to) that is
 * missing the minimum accessibility contract VoiceOver/TalkBack need:
 *
 * - an `accessibilityRole` (so the screen reader announces it as
 *   interactive, e.g. "button"/"link"), AND
 * - a way to derive an accessible name: either an explicit
 *   `accessibilityLabel`, or non-empty rendered text content somewhere in
 *   its subtree.
 *
 * Purely decorative touchables that intentionally hide themselves from the
 * accessibility tree (`accessibilityElementsHidden` or
 * `importantForAccessibility="no"`/`"no-hide-descendants"`, set on the
 * touchable itself or an ancestor) are skipped, since those are
 * deliberately excluded from the a11y tree rather than missing a label.
 *
 * Walking must start from RNTL's `view.UNSAFE_root` (not `view.root`),
 * because `view.root` filters the tree down to host nodes only, and by the
 * time `Pressable` compiles to a host `View` its `onPress` prop has already
 * been translated into low-level responder/`onClick` props -- the
 * composite `Pressable` instance itself is where `accessibilityRole`,
 * `accessibilityLabel`, and `onPress` are still present together.
 *
 * This is intentionally conservative: it is a floor ("did we forget the
 * props entirely"), not a full a11y linter. It is meant to be wired into
 * screen-level test suites as a single extra assertion, not to replace
 * targeted a11y tests on individual components.
 */
export type AccessiblePressableViolation = {
  /** Best-effort testID or type name, for readable failure output. */
  identifier: string;
  reason: 'missing-role' | 'missing-label';
};

const TOUCHABLE_NAMES = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
]);

function typeName(node: ReactTestInstance): string | undefined {
  const { type } = node;

  if (typeof type === 'string') {
    return type;
  }

  if (type && typeof type === 'object') {
    const named = type as { displayName?: string; name?: string };

    return named.displayName ?? named.name;
  }

  if (typeof type === 'function') {
    return type.displayName ?? type.name;
  }

  return undefined;
}

function isTouchable(node: ReactTestInstance): boolean {
  const name = typeName(node);

  return typeof name === 'string' && TOUCHABLE_NAMES.has(name);
}

function isHiddenFromAccessibilityTree(props: Record<string, unknown>): boolean {
  if (props.accessibilityElementsHidden === true) {
    return true;
  }

  const importantForAccessibility = props.importantForAccessibility;

  return importantForAccessibility === 'no' || importantForAccessibility === 'no-hide-descendants';
}

function collectText(node: ReactTestInstance): string {
  let text = '';
  const { children } = node.props ?? {};

  if (typeof children === 'string' || typeof children === 'number') {
    text += String(children);
  }

  for (const child of node.children ?? []) {
    if (typeof child === 'string') {
      text += child;
    } else if (child && typeof child === 'object') {
      text += collectText(child as ReactTestInstance);
    }
  }

  return text;
}

function hasAccessibleName(node: ReactTestInstance): boolean {
  const props = node.props ?? {};

  if (typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim().length > 0) {
    return true;
  }

  return collectText(node).trim().length > 0;
}

function describeNode(node: ReactTestInstance): string {
  const testID = node.props?.testID;

  if (typeof testID === 'string' && testID.length > 0) {
    return testID;
  }

  const label = node.props?.accessibilityLabel;

  if (typeof label === 'string' && label.length > 0) {
    return `${typeName(node) ?? 'unknown'} (accessibilityLabel="${label}")`;
  }

  return typeName(node) ?? 'unknown';
}

/**
 * Returns every touchable in `root`'s subtree missing `accessibilityRole`
 * and/or an accessible name. `root` must be RNTL's `view.UNSAFE_root` (the
 * unfiltered composite+host tree) -- see the module doc for why.
 */
export function findInaccessiblePressables(
  root: ReactTestInstance,
): AccessiblePressableViolation[] {
  const violations: AccessiblePressableViolation[] = [];
  const seen = new Set<ReactTestInstance>();

  function walk(node: ReactTestInstance, hiddenAncestor: boolean) {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    const props = node.props ?? {};
    const hidden = hiddenAncestor || isHiddenFromAccessibilityTree(props);

    if (!hidden && isTouchable(node)) {
      const hasRole = typeof props.accessibilityRole === 'string' && props.accessibilityRole.length > 0;
      const hasName = hasAccessibleName(node);

      if (!hasRole) {
        violations.push({ identifier: describeNode(node), reason: 'missing-role' });
      } else if (!hasName) {
        violations.push({ identifier: describeNode(node), reason: 'missing-label' });
      }
    }

    for (const child of node.children ?? []) {
      if (child && typeof child === 'object') {
        walk(child as ReactTestInstance, hidden);
      }
    }
  }

  walk(root, false);

  return violations;
}

/**
 * Jest assertion helper: fails with a readable message listing every
 * touchable missing a role or accessible name. Intended to be called once
 * per screen-level test, using `view.UNSAFE_root` (not `view.root`), e.g.:
 *
 *   const view = render(<TodayScreenContent todayIso="2026-04-20" />);
 *   expectAccessiblePressables(view.UNSAFE_root);
 */
export function expectAccessiblePressables(root: ReactTestInstance): void {
  const violations = findInaccessiblePressables(root);

  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `  - ${violation.identifier}: ${violation.reason}`)
    .join('\n');

  throw new Error(
    `Found ${violations.length} touchable(s) missing accessibility role and/or label:\n${details}`,
  );
}
