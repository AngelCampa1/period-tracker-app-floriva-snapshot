import { florivaThemes } from '@/src/theme/tokens';

const schemeColors = {
  text: florivaThemes.light.colors.textPrimary,
  background: florivaThemes.light.colors.background,
  tint: florivaThemes.light.colors.accentPrimary,
  tabIconDefault: florivaThemes.light.colors.tabIconDefault,
  tabIconSelected: florivaThemes.light.colors.tabIconSelected,
  border: florivaThemes.light.colors.borderPrimary,
};

// Floriva is light-only; the dark key stays for legacy call sites but maps to
// the same light values.
const Colors = {
  light: schemeColors,
  dark: schemeColors,
};

export default Colors;
