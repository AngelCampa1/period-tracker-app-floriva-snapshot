import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { florivaThemes } from '@/src/theme/tokens';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

describe('SectionCard', () => {
  it('stays solid by default so existing cards do not opt into glass implicitly', () => {
    render(
      <SectionCard testID="solid-card" title="Solid card">
        <Text>Body content</Text>
      </SectionCard>,
    );

    expect(screen.getByTestId('solid-card')).toBeTruthy();
    expect(screen.getByTestId('solid-card').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: florivaThemes.light.colors.surfacePrimary,
          borderColor: florivaThemes.light.colors.borderPrimary,
        }),
      ]),
    );
  });

  it('lets subtle cards read as unboxed content groups', () => {
    render(
      <SectionCard testID="subtle-card" title="Muted card" variant="subtle">
        <Text>Body content</Text>
      </SectionCard>,
    );

    expect(screen.getByTestId('subtle-card').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        }),
      ]),
    );
  });

  it('supports grouped sections for native inset-list screens without heavy card framing', () => {
    render(
      <SectionCard presentation="grouped" testID="grouped-section" title="Privacy">
        <Text>Body content</Text>
      </SectionCard>,
    );

    const groupedStyle = StyleSheet.flatten(screen.getByTestId('grouped-section').props.style);

    expect(groupedStyle.backgroundColor).toBe(florivaThemes.light.colors.surfacePrimary);
    expect(groupedStyle.borderWidth).toBe(0);
    expect(groupedStyle.overflow).toBe('hidden');
    expect(groupedStyle.borderRadius).toBe(florivaThemes.light.radii.lg);
  });

  it('supports an emphasis variant with a softer glass-tinted plane', () => {
    render(
      <SectionCard testID="emphasis-card" title="Emphasis card" variant="emphasis">
        <Text>Body content</Text>
      </SectionCard>,
    );

    expect(screen.getByTestId('emphasis-card').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: florivaThemes.light.colors.buttonGlassFill,
          borderColor: florivaThemes.light.colors.borderStrong,
        }),
      ]),
    );
  });

  it('wraps card content in a shared motion shell so reveals can be coordinated centrally', () => {
    render(
      <SectionCard testID="motion-card" title="Motion card">
        <Text>Body content</Text>
      </SectionCard>,
    );

    expect(screen.getByTestId('motion-card-motion')).toBeTruthy();
  });

  it('renders the title in ink by default', () => {
    render(
      <SectionCard title="Neutral heading">
        <Text>Body content</Text>
      </SectionCard>,
    );

    const titleStyle = StyleSheet.flatten(screen.getByText('Neutral heading').props.style);
    expect(titleStyle.color).toBe(florivaThemes.light.colors.textPrimary);
  });

  it('tones the title with the danger color when titleTone is danger (VF-5)', () => {
    render(
      <SectionCard title="Danger zone" titleTone="danger">
        <Text>Body content</Text>
      </SectionCard>,
    );

    const titleStyle = StyleSheet.flatten(screen.getByText('Danger zone').props.style);
    expect(titleStyle.color).toBe(florivaThemes.light.colors.danger);
    // Guards the VF-5 fix: danger must be a distinct color, not the brand accent.
    expect(titleStyle.color).not.toBe(florivaThemes.light.colors.accentPrimary);
  });
});
