// Three editorial palettes from the redesign package. v1 ships with `bone`
// only; the others are kept as data so a future settings entry can pivot
// without reshaping the theme. See /tmp/floriva-design/floriva-theme.jsx.
export const florivaPalettes = {
  bone: {
    name: 'Bone & Berry',
    bg: '#F4ECE0',
    bgDeep: '#EAE0D0',
    paper: '#FBF5EB',
    ink: '#1A1410',
    inkSoft: '#3D2E26',
    // Phase-4 contrast pass: darkened from #7A6A5E, which measured 3.97:1 on
    // the card surface (#EAE0D0) and 4.42:1 on the app background — under the
    // 4.5:1 WCAG AA body threshold for the captions/hints that use it. #6A5A4E
    // clears AA on every bone surface (5.05–6.08:1) while staying a clearly
    // muted step below textSecondary (#3D2E26 ~10:1).
    inkMute: '#6A5A4E',
    rule: '#D9CCBB',
    accent: '#923030',
    accentSoft: '#E8D2CB',
    moss: '#6E8E6B',
    mossSoft: '#D5DBC7',
    // VF-5 (prerelease sweep 2026-07-23): danger previously equalled `accent`
    // (#923030), so the one destructive action rendered a pixel-identical pill
    // to every safe primary CTA. A deeper, more saturated crimson stays in the
    // warm editorial family (no generic-SaaS alarm red) but is a clear step off
    // the brick accent — and reads as "serious" on the delete + restore
    // buttons and inline error text. Bone text on it clears AA with headroom.
    danger: '#7C1B1B',
  },
  clay: {
    name: 'Clay & Sage',
    bg: '#F2EBE2',
    bgDeep: '#E6DDD0',
    paper: '#F9F2E8',
    ink: '#1F1A15',
    inkSoft: '#46382E',
    inkMute: '#86766A',
    rule: '#D6C9B8',
    accent: '#9A4B36',
    accentSoft: '#EAD3C7',
    moss: '#62897A',
    mossSoft: '#D2DBCF',
    // VF-5: distinct from accent (#9A4B36) — see bone note.
    danger: '#7C1B1B',
  },
  ink: {
    name: 'Ink & Cream',
    bg: '#F6F0E5',
    bgDeep: '#ECE4D5',
    paper: '#FFFAF1',
    ink: '#0E0B08',
    inkSoft: '#2A2218',
    inkMute: '#73685B',
    rule: '#DCCFBC',
    accent: '#0E0B08',
    accentSoft: '#D9CFBC',
    moss: '#5E7150',
    mossSoft: '#CFD8C1',
    // VF-5: distinct danger red (accent here is near-black ink). See bone note.
    danger: '#7C1B1B',
  },
} as const;

export type FlorivaPaletteName = keyof typeof florivaPalettes;
export const defaultFlorivaPalette: FlorivaPaletteName = 'bone';
export const editorialPalette = florivaPalettes[defaultFlorivaPalette];

function parseHexColor(value: string) {
  const normalized = value.replace('#', '');
  const hex = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function withAlpha(color: string, alpha: number) {
  const { r, g, b } = parseHexColor(color);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  // Editorial spacing step from the redesign theme (FLORIVA_SPACE); 40 has no
  // other spacing name so the 3xl key is the canonical one.
  '3xl': 40,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
  // Editorial radius aliases (FLORIVA_RADII).
  xs: 8,
  xl: 28,
  // Tiny decorative radius for chart bars, progress tracks, and tick marks
  // (the 2-3px cluster). Anything circular should use `pill` instead.
  hairline: 3,
} as const;

// ─── Liquid Glass material tokens ──────────────────────────────────
// On iOS 26 these drive Apple's real UIGlassEffect through GlassSurface /
// expo-glass-effect. On Android and iOS < 26 there is NO faux glass: the
// `fallback` solids (readability-safe surfaces the app already ships) and the
// Material 3 `elevation` values are used instead. `tint` washes are applied
// only over genuine glass. Presentation-only — see the Phase 2 privacy review.
export const glass = {
  // Maps to expo-glass-effect GlassView `glassEffectStyle`.
  material: {
    regular: 'regular',
    clear: 'clear',
  },
  // Subtle accent/paper wash layered over real glass only.
  tint: {
    regular: withAlpha(editorialPalette.paper, 0.6),
    clear: withAlpha(editorialPalette.paper, 0.3),
    accent: withAlpha(editorialPalette.accent, 0.12),
  },
  // Readability-safe surface colors used when Liquid Glass is unavailable.
  // `regular` is the opaque paper surface; `clear` is a near-opaque (0.92)
  // paper wash for lighter overlays that still read over the warm background.
  fallback: {
    regular: editorialPalette.paper,
    clear: withAlpha(editorialPalette.paper, 0.92),
  },
  // Android Material 3 elevation (dp) — no faux glass.
  elevation: {
    resting: 0,
    raised: 3,
  },
  // Hairline edge along a glass surface.
  border: editorialPalette.rule,
} as const;

// ─── Editorial font families ───────────────────────────────────────
// Loaded via @expo-google-fonts/* in app/_layout.tsx. If a font fails to
// load the platform falls back to the system stack and these keys still
// resolve to the right weight via `fontWeight`.
export const fontFamilies = {
  serifRegular: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
  // UL-70: true italic serif faces. Editorial accent words are styled italic,
  // but relying on `fontStyle: 'italic'` over a roman-only family diverged
  // across platforms — iOS renders roman (no synthetic italic for a named font
  // without an italic face) while Android fakes a slant. Naming the real italic
  // face renders true italic identically on both; drop the `fontStyle` so
  // Android does not oblique an already-italic font on top of itself.
  serifRegularItalic: 'Newsreader_400Regular_Italic',
  serifMediumItalic: 'Newsreader_500Medium_Italic',
  serifSemiBoldItalic: 'Newsreader_600SemiBold_Italic',
  sansRegular: 'InterTight_400Regular',
  sansMedium: 'InterTight_500Medium',
  sansSemiBold: 'InterTight_600SemiBold',
  sansBold: 'InterTight_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

/**
 * UL-70: maps a roman serif family to its true italic face. Used by editorial
 * accent styling so the same style spread that sets a roman `fontFamily` can be
 * flipped to real italic (instead of the cross-platform-divergent
 * `fontStyle: 'italic'`). Non-serif or already-italic families pass through.
 */
export function italicSerifFamily(family: string | undefined): string | undefined {
  switch (family) {
    case fontFamilies.serifRegular:
      return fontFamilies.serifRegularItalic;
    case fontFamilies.serifMedium:
      return fontFamilies.serifMediumItalic;
    case fontFamilies.serifSemiBold:
      return fontFamilies.serifSemiBoldItalic;
    default:
      return family;
  }
}

export const typography = {
  // Editorial eyebrow - small, tracked, sans, uppercase. Matches FLORIVA_TYPE.eyebrow.
  eyebrow: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
    letterSpacing: 1.98,
    textTransform: 'uppercase' as const,
  },
  // Section heading - Newsreader medium, large optical size feel.
  title: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '500' as const,
    letterSpacing: -0.4,
  },
  // Editorial display headlines on top of screens - hero, paywall, completion.
  display: {
    fontFamily: fontFamilies.serifRegular,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '400' as const,
    letterSpacing: -0.8,
  },
  displayLg: {
    fontFamily: fontFamilies.serifRegular,
    fontSize: 52,
    lineHeight: 52,
    fontWeight: '400' as const,
    letterSpacing: -1.3,
  },
  subtitle: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400' as const,
  },
  bodyLarge: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  bodyStrong: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.16,
  },
  caption: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  // Numeric display - JetBrains mono, tabular, slightly negative tracking.
  numeral: {
    fontFamily: fontFamilies.monoMedium,
    fontWeight: '500' as const,
    letterSpacing: -0.4,
  },
} as const;

type MotionDurations = {
  instant: number;
  quick: number;
  settle: number;
  lingering: number;
};

type MotionDelays = {
  none: number;
  stagger: number;
  section: number;
};

type MotionDistances = {
  micro: number;
  soft: number;
  bloom: number;
};

type MotionScales = {
  bloom: number;
  settle: number;
  pressed: number;
};

type MotionPreset = {
  duration: number;
  delay: number;
  delayStep: number;
  distance: number;
  enterScale: number;
};

type PressFeedbackPreset = {
  duration: number;
  pressedScale: number;
  pressedTranslateY: number;
};

export type FlorivaMotion = {
  durations: MotionDurations;
  delays: MotionDelays;
  distances: MotionDistances;
  scales: MotionScales;
  presets: {
    screenEnter: MotionPreset;
    cardReveal: MotionPreset;
    heroBloom: MotionPreset;
    rowShift: MotionPreset;
    sensitiveScreenEnter: MotionPreset;
    modalFade: MotionPreset;
    pressFeedback: PressFeedbackPreset;
  };
};

type ThemeColors = {
  background: string;
  backgroundElevated: string;
  surfacePrimary: string;
  surfaceSecondary: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  borderPrimary: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentPrimary: string;
  accentSoft: string;
  success: string;
  danger: string;
  focus: string;
  disabled: string;
  overlay: string;
  tabIconDefault: string;
  tabIconSelected: string;
  tabBarFill: string;
  tabBarBorder: string;
  inputFill: string;
  inputBorder: string;
  chipFill: string;
  chipBorder: string;
  chipSelectedFill: string;
  chipSelectedBorder: string;
  chipSelectedText: string;
  buttonPrimaryText: string;
  buttonSecondaryFill: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  buttonGlassFill: string;
  buttonGlassBorder: string;
  buttonGlassText: string;
  buttonQuietFill: string;
  buttonQuietText: string;
  buttonDestructiveFill: string;
  buttonDestructiveBorder: string;
  buttonDestructiveText: string;
  moss: string;
  mossSoft: string;
  // Bone surface - cream/parchment for text/icons on dark accent surfaces.
  bone: string;
  // Legacy aliases kept so the app can migrate incrementally.
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  tabInactive: string;
  tabActive: string;
};

export type FlorivaColorScheme = 'light' | 'dark';

export type FlorivaTheme = {
  colorScheme: FlorivaColorScheme;
  colors: ThemeColors;
  motion: FlorivaMotion;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  glass: typeof glass;
};

const sharedMotion: FlorivaMotion = {
  durations: {
    instant: 120,
    quick: 180,
    settle: 320,
    lingering: 560,
  },
  delays: {
    none: 0,
    stagger: 90,
    section: 140,
  },
  distances: {
    micro: 6,
    soft: 16,
    bloom: 24,
  },
  scales: {
    bloom: 0.94,
    settle: 0.985,
    pressed: 0.97,
  },
  presets: {
    screenEnter: {
      duration: 320,
      delay: 0,
      delayStep: 90,
      distance: 16,
      enterScale: 0.985,
    },
    cardReveal: {
      duration: 320,
      delay: 70,
      delayStep: 80,
      distance: 14,
      enterScale: 0.988,
    },
    heroBloom: {
      duration: 560,
      delay: 0,
      delayStep: 110,
      distance: 24,
      enterScale: 0.94,
    },
    rowShift: {
      duration: 180,
      delay: 0,
      delayStep: 50,
      distance: 10,
      enterScale: 0.99,
    },
    sensitiveScreenEnter: {
      duration: 240,
      delay: 0,
      delayStep: 60,
      distance: 10,
      enterScale: 0.992,
    },
    modalFade: {
      duration: 220,
      delay: 0,
      delayStep: 0,
      distance: 12,
      enterScale: 0.99,
    },
    pressFeedback: {
      duration: 160,
      pressedScale: 0.97,
      pressedTranslateY: 1,
    },
  },
};

// Editorial light theme - Bone & Berry. Existing semantic keys are kept for
// backwards compatibility while the codebase migrates; values are remapped to
// editorial colors so consumers update visually with no code changes.
const lightColors: ThemeColors = {
  background: editorialPalette.bg,
  backgroundElevated: editorialPalette.bgDeep,
  surfacePrimary: editorialPalette.paper,
  surfaceSecondary: editorialPalette.bgDeep,
  surfaceMuted: editorialPalette.bgDeep,
  surfaceSubtle: editorialPalette.paper,
  borderPrimary: editorialPalette.rule,
  borderStrong: editorialPalette.inkMute,
  textPrimary: editorialPalette.ink,
  textSecondary: editorialPalette.inkSoft,
  textTertiary: editorialPalette.inkMute,
  accentPrimary: editorialPalette.accent,
  accentSoft: editorialPalette.accentSoft,
  success: editorialPalette.moss,
  danger: editorialPalette.danger,
  focus: editorialPalette.accent,
  disabled: withAlpha(editorialPalette.ink, 0.34),
  overlay: withAlpha(editorialPalette.ink, 0.08),
  tabIconDefault: editorialPalette.inkMute,
  tabIconSelected: editorialPalette.ink,
  tabBarFill: editorialPalette.paper,
  tabBarBorder: editorialPalette.rule,
  inputFill: editorialPalette.paper,
  inputBorder: editorialPalette.rule,
  chipFill: editorialPalette.paper,
  chipBorder: editorialPalette.rule,
  chipSelectedFill: editorialPalette.paper,
  chipSelectedBorder: editorialPalette.ink,
  chipSelectedText: editorialPalette.ink,
  buttonPrimaryText: editorialPalette.bg,
  buttonSecondaryFill: editorialPalette.paper,
  buttonSecondaryBorder: editorialPalette.rule,
  buttonSecondaryText: editorialPalette.ink,
  buttonGlassFill: editorialPalette.paper,
  buttonGlassBorder: editorialPalette.rule,
  buttonGlassText: editorialPalette.ink,
  buttonQuietFill: 'transparent',
  buttonQuietText: editorialPalette.ink,
  buttonDestructiveFill: editorialPalette.danger,
  buttonDestructiveBorder: editorialPalette.danger,
  buttonDestructiveText: editorialPalette.bg,
  moss: editorialPalette.moss,
  mossSoft: editorialPalette.mossSoft,
  bone: editorialPalette.bg,
  surface: editorialPalette.paper,
  border: editorialPalette.rule,
  text: editorialPalette.ink,
  textMuted: editorialPalette.inkSoft,
  accent: editorialPalette.accent,
  tabInactive: editorialPalette.inkMute,
  tabActive: editorialPalette.ink,
};

// Floriva ships light-only by design decision; there is no dark theme entry.
export const florivaThemes: { light: FlorivaTheme } = {
  light: {
    colorScheme: 'light',
    colors: lightColors,
    motion: sharedMotion,
    spacing,
    radii,
    typography,
    glass,
  },
};

/**
 * Always resolves the light theme.
 *
 * @param colorScheme - @deprecated Ignored; kept so legacy call sites that
 * still pass a color scheme keep compiling. Floriva is light-only.
 */
export function resolveTheme(colorScheme?: FlorivaColorScheme | null): FlorivaTheme {
  return florivaThemes.light;
}

export function getDocumentBackgroundColors() {
  return {
    light: florivaThemes.light.colors.background,
    dark: florivaThemes.light.colors.background,
  };
}

export function createNavigationTheme(colorScheme?: FlorivaColorScheme | null) {
  const resolvedTheme = resolveTheme(colorScheme);

  return {
    dark: false,
    colors: {
      primary: resolvedTheme.colors.accentPrimary,
      background: resolvedTheme.colors.background,
      card: resolvedTheme.colors.surfacePrimary,
      text: resolvedTheme.colors.textPrimary,
      border: resolvedTheme.colors.borderPrimary,
      notification: resolvedTheme.colors.accentPrimary,
    },
    fonts: {
      regular: {
        fontFamily: 'System',
        fontWeight: '400' as const,
      },
      medium: {
        fontFamily: 'System',
        fontWeight: '500' as const,
      },
      bold: {
        fontFamily: 'System',
        fontWeight: '700' as const,
      },
      heavy: {
        fontFamily: 'System',
        fontWeight: '800' as const,
      },
    },
  };
}

// Light-only compatibility export. Incremental migrations should still prefer resolveTheme/useFlorivaTheme.
export const theme = {
  get colorScheme() {
    return resolveTheme('light').colorScheme;
  },
  get colors() {
    return resolveTheme('light').colors;
  },
  spacing,
  radii,
  typography,
  glass,
} as const;
