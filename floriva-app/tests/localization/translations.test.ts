import {
  buildMissingTranslationKeyReport,
  translate,
  translations,
} from '@/src/localization/translations';
import { bannedMedicalTermsByLocale } from '../helpers/bannedMedicalTerms';

describe('translation catalogs', () => {
  it('keeps every non-English locale aligned with the English source catalog', () => {
    expect(buildMissingTranslationKeyReport(translations)).toEqual({});
  });

  it('reports missing keys for incomplete locale catalogs', () => {
    const incompleteCatalogs = {
      ...translations,
      fr: {
        common: {
          actions: {
            continue: 'Continuer',
          },
        },
      },
    } as typeof translations;

    expect(buildMissingTranslationKeyReport(incompleteCatalogs).fr).toEqual(
      expect.arrayContaining(['settings.hub.eyebrow']),
    );
  });

  it('keeps billing descriptions aligned with free-to-start access', () => {
    const descriptions = Object.values(translations).map(
      (catalog) => catalog.billing.screen.description,
    );

    expect(descriptions).toHaveLength(8);
    expect(descriptions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('free to start'),
        expect.stringContaining('gratis para empezar'),
      ]),
    );
    expect(descriptions.join('\n')).not.toMatch(
      /free to download|se descarga gratis|kostenlos geladen|téléchargeable gratuitement|無料でダウンロード|免费下载|descarregado gratuitamente|скачать бесплатно/i,
    );
  });

  it('LT-28: gives a trial-active paywall visitor copy that acknowledges their active trial', () => {
    for (const locale of Object.keys(translations) as (keyof typeof translations)[]) {
      const trialActiveCopy = translate(locale, 'billing.screen.lockedTrialActiveDescription');
      const expiredCopy = translate(locale, 'billing.screen.lockedExpiredDescription');
      const needsPurchaseCopy = translate(locale, 'billing.screen.lockedNeedsPurchaseDescription');

      expect(trialActiveCopy.length).toBeGreaterThan(0);
      // The trial-active visitor already has access -- the copy must not
      // repeat the "no access yet" framing shared by the other two states.
      expect(trialActiveCopy).not.toBe(expiredCopy);
      expect(trialActiveCopy).not.toBe(needsPurchaseCopy);
      expect(trialActiveCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
    }
  });

  it('keeps import concierge review copy calm and non-medical', () => {
    expect(translate('en', 'import.labels.confidenceTitle')).toBe('Import confidence');
    expect(translate('en', 'import.confidence.low')).toBe('Low confidence');
    expect(translate('en', 'import.labels.duplicateDatesTitle')).toBe(
      'Duplicate dates Floriva will skip',
    );
    expect(translate('en', 'import.actions.useManualHistory')).toBe(
      'Use manual history instead',
    );
    expect(translate('en', 'import.labels.editedCount')).toBe('Edited after review');
    expect(translate('en', 'import.actions.excludeReviewedRow')).toBe(
      'Exclude this row',
    );
    expect(translate('en', 'import.skippedRows.invalid', { rowNumber: 4 })).toBe(
      'Row 4 has a date or value Floriva could not read.',
    );
    expect(
      [
        translate('en', 'import.labels.confidenceTitle'),
        translate('en', 'import.screen.duplicateOnlyDescription'),
        translate('en', 'import.actions.useManualHistory'),
        translate('en', 'import.labels.editablePreviewDescription'),
      ].join(' '),
    ).not.toMatch(/diagnos|doctor|guarantee|zero-knowledge|upload|next .*pass|roadmap/i);
  });

  it('interpolates params and throws for missing nested translation keys', () => {
    expect(
      translate('en', 'logging.validation.bbtRange', { min: 36.1, max: 37.5 }),
    ).toBe('Enter a BBT between 36.1 C and 37.5 C.');

    expect(() => translate('en', 'common.actions' as never)).toThrow(
      'Missing translation for key "common.actions"',
    );
    expect(() => translate('en', 'common.actions.missing' as never)).toThrow(
      'Missing translation for key "common.actions.missing"',
    );
  });

  it('localizes the 1.2.1 Today and Insights production labels', () => {
    const expectations = {
      en: ['of 28', 'This cycle', 'Cycle length', 'avg', 'Phase rhythm', '28d'],
      es: ['de 28', 'Este ciclo', 'Duración del ciclo', 'prom.', 'Ritmo de fases', '28 d'],
      de: ['von 28', 'Dieser Zyklus', 'Zykluslänge', 'Ø', 'Phasenrhythmus', '28 T'],
      fr: ['sur 28', 'Ce cycle', 'Durée du cycle', 'moy.', 'Rythme des phases', '28 j'],
      ja: ['28日中', 'この周期', '周期の長さ', '平均', '周期フェーズ', '28日'],
      'zh-Hans': ['共28天', '本周期', '周期长度', '平均', '阶段节律', '28天'],
      pt: ['de 28', 'Este ciclo', 'Duração do ciclo', 'méd.', 'Ritmo das fases', '28 d'],
      ru: ['из 28', 'Этот цикл', 'Длина цикла', 'сред.', 'Ритм фаз', '28 дн.'],
    } as const;

    for (const [locale, expected] of Object.entries(expectations)) {
      expect([
        translate(locale as keyof typeof expectations, 'tracker.snapshot.cycleLengthTotal', { count: 28 }),
        translate(locale as keyof typeof expectations, 'tracker.snapshot.thisCycleLabel'),
        translate(locale as keyof typeof expectations, 'insights.screen.cycleLengthLabel'),
        translate(locale as keyof typeof expectations, 'insights.screen.averageAbbreviation'),
        translate(locale as keyof typeof expectations, 'insights.screen.phaseRhythmLabel'),
        translate(locale as keyof typeof expectations, 'insights.screen.phaseDays', { count: 28 }),
      ]).toEqual(expected);
    }
  });

  it('keeps timeline loading and TTC row copy polished across supported locales', () => {
    expect(translate('en', 'calendar.timeline.loading')).toBe('Loading timeline…');
    expect(translate('es', 'calendar.timeline.rows.ttcLoggedDetail')).toBe(
      'Observación TTC registrada',
    );
    expect(translate('de', 'calendar.timeline.rows.cervicalMucusEggWhite')).toBe(
      'eiweißartig',
    );
    expect(translate('fr', 'calendar.timeline.rows.cervicalMucusEggWhite')).toBe(
      'blanc d’œuf',
    );

    for (const locale of Object.keys(translations) as (keyof typeof translations)[]) {
      expect(translate(locale, 'calendar.timeline.loading')).toContain('…');
      expect(translate(locale, 'calendar.timeline.loading')).not.toContain('...');
    }
  });

  it('keeps birth-control hub copy localized and non-medical', () => {
    expect(translate('en', 'birthControl.settings.defaultMethodDescription')).toBe(
      'Floriva uses this only to speed up daily logging and reminders. It is not contraception guidance.',
    );
    expect(translate('es', 'birthControl.hub.title')).toBe('Anticonceptivos');
    expect(translate('de', 'birthControl.summary.reminderOn')).toBe('Erinnerung an');
    expect(
      translate('fr', 'birthControl.hub.reminderOn', {
        methodLabel: 'Pilule',
        timeLabel: '07:45',
      }),
    ).toBe('Pilule · 07:45');

    expect(
      [
        translate('en', 'birthControl.settings.description'),
        translate('en', 'birthControl.settings.defaultMethodDescription'),
        translate('en', 'birthControl.settings.reminderDescription'),
      ].join(' '),
    ).not.toMatch(/doctor|diagnos|treat|guarantee|zero-knowledge|medical/i);
  });

  it('keeps TTC mode copy localized and non-medical', () => {
    expect(translate('en', 'ttc.summary.noDetailsToday')).toBe(
      'No TTC details logged today',
    );
    expect(translate('es', 'ttc.insights.recentLogsTitle')).toBe(
      'Registros TTC recientes',
    );
    expect(
      translate('de', 'ttc.summary.loggingPreviewBody', {
        fields: 'Sex, Ovulationstest',
      }),
    ).toBe('Floriva hält diese Felder beim Erfassen bereit: Sex, Ovulationstest.');

    expect(
      [
        translate('en', 'ttc.summary.noDetailsToday'),
        translate('en', 'ttc.insights.exploreSubtitle'),
        translate('en', 'ttc.insights.noRecentLogs'),
        translate('en', 'ttc.summary.loggingPreviewBody', {
          fields: 'Sex, BBT',
        }),
      ].join(' '),
    ).not.toMatch(/odds|best day|high chance|confirm|doctor|diagnos|treat|medical/i);
  });

  it('keeps monthly briefing copy localized and non-medical', () => {
    for (const locale of Object.keys(translations) as (keyof typeof translations)[]) {
      expect(
        translate(locale, 'insights.monthlyBriefing.subtitle', {
          count: 3,
        }),
      ).toContain('3');
      expect(
        translate(locale, 'insights.monthlyBriefing.lead', {
          month: 'April',
          periodDays: 2,
          signalCount: 4,
        }),
      ).toBeTruthy();
      expect(translate(locale, 'insights.monthlyBriefing.exploreTitle')).toBeTruthy();
      expect(translate(locale, 'insights.monthlyBriefing.periodDaysMetric')).toBeTruthy();
      expect(translate(locale, 'insights.monthlyBriefing.symptomDaysMetric')).toBeTruthy();
      expect(translate(locale, 'insights.monthlyBriefing.sourceTitle')).toBeTruthy();
      expect(translate(locale, 'insights.monthlyBriefing.sourceImported')).toBeTruthy();
      expect(
        translate(locale, 'insights.monthlyBriefing.sourceTtcDays', { count: 2 }),
      ).toContain('2');
      expect(
        translate(locale, 'insights.monthlyBriefing.sourceBirthControlDays', { count: 2 }),
      ).toContain('2');
      expect(
        translate(locale, 'insights.monthlyBriefing.sourceConditionFocus', {
          conditions: 'PCOS',
        }),
      ).toBeTruthy();
    }

    expect(
      [
        translate('en', 'insights.monthlyBriefing.lead', {
          month: 'April',
          periodDays: 2,
          signalCount: 4,
        }),
        translate('en', 'insights.monthlyBriefing.exploreSubtitle'),
        translate('en', 'insights.monthlyBriefing.detailDescription'),
      ].join(' '),
    ).not.toMatch(/doctor|diagnos|treat|medical|guarantee|risk|normal|abnormal/i);
  });
});
