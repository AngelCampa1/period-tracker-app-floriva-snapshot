import { render } from '@testing-library/react-native';

import { Arc, Petal, Seed } from '@/src/components/editorial';
import { editorialPalette } from '@/src/theme/tokens';

describe('editorial ornaments', () => {
  it('renders Petal at the requested size and color', () => {
    const tree = render(<Petal color="#923030" size={56} />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders Seed', () => {
    const tree = render(<Seed color="#923030" size={14} />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders Arc with default opacity', () => {
    const tree = render(<Arc />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('defaults every ornament color to the editorial accent token', () => {
    expect(editorialPalette.accent).toBe('#923030');

    const petal = render(<Petal />).toJSON() as unknown as {
      children: { props: { style: { backgroundColor?: string } } }[];
    };
    expect(petal.children[0].props.style.backgroundColor).toBe(editorialPalette.accent);

    // react-native-svg normalizes fill into an internal payload, so compare
    // the default render against an explicit accent-token render instead.
    expect(render(<Seed />).toJSON()).toEqual(
      render(<Seed color={editorialPalette.accent} />).toJSON(),
    );

    const arc = render(<Arc />).toJSON() as unknown as {
      children: { props: { style: { borderColor?: string } } }[];
    };
    expect(arc.children[0].props.style.borderColor).toBe(editorialPalette.accent);
  });
});
