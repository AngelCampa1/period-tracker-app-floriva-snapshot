import {
  createNavigationTheme,
  editorialPalette,
  florivaPalettes,
  florivaThemes,
  fontFamilies,
  getDocumentBackgroundColors,
  italicSerifFamily,
  resolveTheme,
  spacing,
  theme,
  typography,
  withAlpha,
} from '@/src/theme/tokens';

describe('italicSerifFamily', () => {
  it('maps each serif weight to its true-italic family', () => {
    expect(italicSerifFamily(fontFamilies.serifRegular)).toBe(
      fontFamilies.serifRegularItalic,
    );
    expect(italicSerifFamily(fontFamilies.serifMedium)).toBe(
      fontFamilies.serifMediumItalic,
    );
    expect(italicSerifFamily(fontFamilies.serifSemiBold)).toBe(
      fontFamilies.serifSemiBoldItalic,
    );
  });

  it('passes through non-serif and undefined families unchanged', () => {
    expect(italicSerifFamily(fontFamilies.sansRegular)).toBe(
      fontFamilies.sansRegular,
    );
    expect(italicSerifFamily(undefined)).toBeUndefined();
  });
});

describe('theme tokens', () => {
  it('exposes a single name per spacing and typography token', () => {
    expect(spacing.xxl).toBe(28);
    expect(Object.keys(spacing)).not.toContain('2xl');
    // 40 has no other spacing name, so the editorial 3xl alias stays.
    expect(spacing['3xl']).toBe(40);
    expect(typography.display.fontSize).toBe(40);
    expect(Object.keys(typography)).not.toContain('heroTitle');
  });

  it('resolves the light semantic theme for every legacy color-scheme request', () => {
    expect(resolveTheme()).toBe(florivaThemes.light);
    expect(resolveTheme('light')).toBe(florivaThemes.light);
    expect(resolveTheme('dark')).toBe(florivaThemes.light);
    // Floriva ships light-only: the theme map has no dark entry left.
    expect(Object.keys(florivaThemes)).toEqual(['light']);
  });

  it('includes shared motion tokens with a softer preset for sensitive surfaces', () => {
    const lightMotion = (florivaThemes.light as typeof florivaThemes.light & {
      motion?: {
        durations: Record<string, number>;
        presets: Record<string, Record<string, number>>;
      };
    }).motion;

    expect(lightMotion).toEqual(
      expect.objectContaining({
        durations: expect.objectContaining({
          instant: expect.any(Number),
          quick: expect.any(Number),
          settle: expect.any(Number),
          lingering: expect.any(Number),
        }),
        presets: expect.objectContaining({
          screenEnter: expect.objectContaining({
            distance: expect.any(Number),
            enterScale: expect.any(Number),
          }),
          heroBloom: expect.objectContaining({
            distance: expect.any(Number),
            enterScale: expect.any(Number),
          }),
          sensitiveScreenEnter: expect.objectContaining({
            distance: expect.any(Number),
            enterScale: expect.any(Number),
          }),
          pressFeedback: expect.objectContaining({
            pressedScale: expect.any(Number),
          }),
        }),
      }),
    );
    expect(lightMotion?.durations.instant).toBeLessThan(lightMotion?.durations.settle ?? 0);
    expect(lightMotion?.durations.quick).toBeLessThan(lightMotion?.durations.lingering ?? 0);
    expect(lightMotion?.presets.heroBloom.distance).toBeGreaterThan(
      lightMotion?.presets.sensitiveScreenEnter.distance ?? 0,
    );
    expect(lightMotion?.presets.heroBloom.enterScale).toBeLessThan(
      lightMotion?.presets.screenEnter.enterScale ?? 1,
    );
    expect(lightMotion?.presets.pressFeedback.pressedScale).toBeLessThan(1);
  });

  it('builds a light-only navigation theme from the same semantic tokens', () => {
    const navigationTheme = createNavigationTheme('dark');

    expect(navigationTheme.dark).toBe(false);
    expect(navigationTheme.colors.background).toBe(
      florivaThemes.light.colors.background,
    );
    expect(navigationTheme.colors.card).toBe(
      florivaThemes.light.colors.surfacePrimary,
    );
    expect(navigationTheme.colors.border).toBe(
      florivaThemes.light.colors.borderPrimary,
    );
    expect(navigationTheme.colors.primary).toBe(
      florivaThemes.light.colors.accentPrimary,
    );
    expect(navigationTheme.colors.text).toBe(
      florivaThemes.light.colors.textPrimary,
    );
  });

  it('keeps editorial pill radii and provides distinct button surface tokens', () => {
    expect(florivaThemes.light.radii.pill).toBe(999);
    expect(florivaThemes.light.colors.buttonGlassFill).toBeTruthy();
    expect(florivaThemes.light.colors.buttonQuietFill).toBeTruthy();
    expect(florivaThemes.light.colors.buttonDestructiveFill).toBeTruthy();
    expect(florivaThemes.light.colors.buttonDestructiveBorder).toBeTruthy();
  });

  it('builds alpha-based semantic colors from editorial palette references', () => {
    expect(editorialPalette.bg).toBe('#F4ECE0');
    expect(editorialPalette.accent).toBe('#923030');
    expect(florivaThemes.light.colors.disabled).toBe(withAlpha('#1A1410', 0.34));
    expect(florivaThemes.light.colors.chipSelectedFill).toBe(editorialPalette.paper);
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('keeps the danger tone distinct from the brand accent so destructive UI never mimics a safe CTA (VF-5)', () => {
    // Before the prerelease sweep, danger === accent (#923030) in every palette,
    // so the destructive button + error text rendered identically to a primary
    // CTA. danger must stay a genuinely different color everywhere.
    expect(florivaThemes.light.colors.danger).not.toBe(florivaThemes.light.colors.accentPrimary);
    expect(florivaThemes.light.colors.buttonDestructiveFill).toBe(
      florivaThemes.light.colors.danger,
    );
    expect(florivaThemes.light.colors.buttonDestructiveFill).not.toBe(
      florivaThemes.light.colors.accentPrimary,
    );
    for (const palette of Object.values(florivaPalettes)) {
      expect(palette.danger).not.toBe(palette.accent);
    }
  });

  it('exposes a glass material token group with tint, fallback, and elevation', () => {
    expect(florivaThemes.light.glass).toEqual(
      expect.objectContaining({
        material: expect.objectContaining({
          regular: 'regular',
          clear: 'clear',
        }),
        tint: expect.objectContaining({
          regular: expect.any(String),
          clear: expect.any(String),
          accent: expect.any(String),
        }),
        fallback: expect.objectContaining({
          regular: expect.any(String),
          clear: expect.any(String),
        }),
        elevation: expect.objectContaining({
          resting: expect.any(Number),
          raised: expect.any(Number),
        }),
        border: expect.any(String),
      }),
    );

    // The Android/iOS<26 fallback must be a real solid the app already ships,
    // so glass surfaces stay readable when Liquid Glass is unavailable.
    expect(florivaThemes.light.glass.fallback.regular).toBe(
      florivaThemes.light.colors.surfacePrimary,
    );
    // A raised Material elevation must be greater than the resting one.
    expect(florivaThemes.light.glass.elevation.raised).toBeGreaterThan(
      florivaThemes.light.glass.elevation.resting,
    );
  });

  it('exports theme-derived document background colors for web fallbacks', () => {
    expect(getDocumentBackgroundColors()).toEqual({
      light: florivaThemes.light.colors.background,
      dark: florivaThemes.light.colors.background,
    });
  });

  it('resolves the compatibility theme getters to light mode', () => {
    expect(theme.colorScheme).toBe('light');
    expect(theme.colors.background).toBe(florivaThemes.light.colors.background);
  });
});
