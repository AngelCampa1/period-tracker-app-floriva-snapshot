import { buildDayCellAccessibilityLabel } from '@/src/features/calendar/buildDayCellAccessibilityLabel';
import { supportedLocales } from '@/src/localization/config';
import { translate } from '@/src/localization/translations';
import type { SupportedLocale } from '@/src/types/domain';

function translatorFor(locale: SupportedLocale) {
  return (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(locale, key, params);
}

const t = translatorFor('en');

type CellState = Parameters<typeof buildDayCellAccessibilityLabel>[0]['cell'];

function cell(overrides: Partial<NonNullable<CellState>> = {}): NonNullable<CellState> {
  return {
    marker: 'none',
    isFertile: false,
    isToday: false,
    ...overrides,
  };
}

describe('buildDayCellAccessibilityLabel', () => {
  it('returns the plain open-log label for an unmarked day', () => {
    expect(
      buildDayCellAccessibilityLabel({ date: '2026-04-15', cell: cell(), t }),
    ).toBe('Open log for 2026-04-15');
  });

  it('returns the plain open-log label when the cell is unknown (defensive)', () => {
    expect(buildDayCellAccessibilityLabel({ date: '2026-04-15', cell: null, t })).toBe(
      'Open log for 2026-04-15',
    );
  });

  it('appends the logged period state', () => {
    expect(
      buildDayCellAccessibilityLabel({ date: '2026-04-03', cell: cell({ marker: 'period' }), t }),
    ).toBe('Open log for 2026-04-03, logged period day');
  });

  it('appends the spotting state', () => {
    expect(
      buildDayCellAccessibilityLabel({
        date: '2026-04-02',
        cell: cell({ marker: 'spotting' }),
        t,
      }),
    ).toBe('Open log for 2026-04-02, spotting day');
  });

  it('appends the predicted period state', () => {
    expect(
      buildDayCellAccessibilityLabel({
        date: '2026-04-28',
        cell: cell({ marker: 'predicted-period' }),
        t,
      }),
    ).toBe('Open log for 2026-04-28, predicted period day');
  });

  it('appends the fertile window state', () => {
    expect(
      buildDayCellAccessibilityLabel({ date: '2026-04-13', cell: cell({ isFertile: true }), t }),
    ).toBe('Open log for 2026-04-13, fertile window day');
  });

  it('appends the today state', () => {
    expect(
      buildDayCellAccessibilityLabel({ date: '2026-04-20', cell: cell({ isToday: true }), t }),
    ).toBe('Open log for 2026-04-20, today');
  });

  it('composes predicted + fertile in marker-then-window order', () => {
    expect(
      buildDayCellAccessibilityLabel({
        date: '2026-04-28',
        cell: cell({ marker: 'predicted-period', isFertile: true }),
        t,
      }),
    ).toBe('Open log for 2026-04-28, predicted period day, fertile window day');
  });

  it('composes today + logged period with today announced last', () => {
    expect(
      buildDayCellAccessibilityLabel({
        date: '2026-04-20',
        cell: cell({ marker: 'period', isToday: true }),
        t,
      }),
    ).toBe('Open log for 2026-04-20, logged period day, today');
  });

  it('composes the full stack (spotting + fertile + today)', () => {
    expect(
      buildDayCellAccessibilityLabel({
        date: '2026-04-20',
        cell: cell({ marker: 'spotting', isFertile: true, isToday: true }),
        t,
      }),
    ).toBe('Open log for 2026-04-20, spotting day, fertile window day, today');
  });

  it('resolves translated (non-English, non-fallback) state fragments in every supported locale', () => {
    for (const locale of supportedLocales) {
      const localizedT = translatorFor(locale);
      const label = buildDayCellAccessibilityLabel({
        date: '2026-04-20',
        cell: cell({ marker: 'period', isFertile: true, isToday: true }),
        t: localizedT,
      });

      // Every locale resolves all three fragments without throwing...
      expect(label).toContain(localizedT('calendar.a11y.loggedPeriodDay'));
      expect(label).toContain(localizedT('calendar.a11y.fertileWindowDay'));
      expect(label).toContain(localizedT('calendar.a11y.today'));

      // ...and non-English locales are real translations, not English copies.
      if (locale !== 'en') {
        expect(localizedT('calendar.a11y.loggedPeriodDay')).not.toBe(
          t('calendar.a11y.loggedPeriodDay'),
        );
        expect(localizedT('calendar.a11y.today')).not.toBe(t('calendar.a11y.today'));
      }
    }
  });
});
