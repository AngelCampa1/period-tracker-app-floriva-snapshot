import {
  formatMonthDayLabel,
  formatMonthLabel,
  formatWeekdayLabels,
  formatCyclePhaseLabel,
  formatCycleDayLabel,
  formatCurrentExpectedPeriodRangeLabel,
  formatFertileWindowCaption,
  formatFertileWindowLabel,
  formatHistoryChipLabel,
  formatLoggedPeriodStartsLabel,
  formatNextPeriodExpectedAroundLabel,
  formatNextPeriodExpectedRangeLabel,
  formatPredictionConfidenceBasisLabel,
  formatPredictionConfidenceLabel,
  formatPredictionLimitation,
  formatPredictionRangeLabel,
} from '@/src/lib/predictions/presentation';

describe('prediction presentation helpers', () => {
  it('formats short month and day labels from ISO dates', () => {
    expect(formatMonthDayLabel('2026-04-28', 'en')).toBe('Apr 28');
    expect(formatMonthDayLabel('2026-12-03', 'en')).toBe('Dec 3');
    expect(formatMonthLabel('2026-04-01', 'en')).toBe('April 2026');
    expect(formatWeekdayLabels('en')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('formats confidence labels with a humanized hierarchy', () => {
    expect(formatPredictionConfidenceLabel('low', 'en')).toBe('Low confidence');
    expect(formatPredictionConfidenceLabel('medium', 'en')).toBe('Medium confidence');
    expect(formatPredictionConfidenceLabel('high', 'en')).toBe('High confidence');
    expect(formatPredictionConfidenceLabel('medium', 'ja')).toBe('中程度の確信度');
    expect(formatPredictionConfidenceLabel('low', 'zh-Hans')).toBe('低置信度');
    expect(formatPredictionConfidenceLabel('medium', 'pt')).toBe('Confiança média');
    expect(formatPredictionConfidenceLabel('high', 'ru')).toBe('Высокая уверенность');
  });

  it('formats confidence basis labels across supported locales', () => {
    const locales = ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'] as const;

    for (const locale of locales) {
      expect(formatPredictionConfidenceBasisLabel(1, locale)).toBeTruthy();
      expect(formatPredictionConfidenceBasisLabel(3, locale)).toContain('3');
    }

    expect(formatPredictionConfidenceBasisLabel(3, 'en')).not.toMatch(
      /diagnos|doctor|accurate|guarantee|fertility status/i,
    );
  });

  it('formats cycle and fertile-window labels with locale-aware copy', () => {
    expect(formatCycleDayLabel(24, 'es')).toBe('Día del ciclo 24');
    expect(formatCycleDayLabel(8, 'de')).toBe('Zyklustag 8');
    expect(formatCycleDayLabel(10, 'fr')).toBe('Jour 10 du cycle');
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-12', '2026-04-18', 'ja')).toBe(
      '排卵期は今日です',
    );
    expect(formatFertileWindowLabel('2026-04-10', '2026-04-12', '2026-04-18', 'de')).toBe(
      'Das fruchtbare Fenster öffnet sich in 2 Tagen',
    );
    expect(formatFertileWindowLabel('2026-04-21', '2026-04-12', '2026-04-18', 'fr')).toBe(
      'La fenêtre fertile s’est terminée il y a 3 jours',
    );
    expect(formatFertileWindowLabel('2026-04-21', '2026-04-12', '2026-04-18', 'zh-Hans')).toBe(
      '易孕期在 3 天前结束',
    );
    expect(formatPredictionLimitation('not-medical-certainty', 'es')).toBe(
      'Floriva muestra estimaciones, no certeza médica.',
    );
  });

  it('formats cycle phase labels across every supported locale', () => {
    const expectations = {
      en: ['Period', 'Follicular', 'Fertile', 'Luteal', 'Earlier cycle', 'Later cycle'],
      es: ['Periodo', 'Folicular', 'Fértil', 'Lútea', 'Inicio del ciclo', 'Final del ciclo'],
      de: ['Periode', 'Follikelphase', 'Fruchtbare Phase', 'Lutealphase', 'Frühe Zyklusphase', 'Späte Zyklusphase'],
      fr: ['Règles', 'Folliculaire', 'Fertile', 'Lutéale', 'Début du cycle', 'Fin du cycle'],
      ja: ['生理期', '卵胞期', '妊娠しやすい時期', '黄体期', '周期前半', '周期後半'],
      'zh-Hans': ['经期', '卵泡期', '易孕期', '黄体期', '周期前段', '周期后段'],
      pt: ['Menstruação', 'Folicular', 'Fértil', 'Lútea', 'Início do ciclo', 'Fim do ciclo'],
      ru: ['Месячные', 'Фолликулярная фаза', 'Фертильная фаза', 'Лютеиновая фаза', 'Начало цикла', 'Конец цикла'],
    } as const;
    const phases = ['period', 'follicular', 'fertile', 'luteal', 'earlier-cycle', 'later-cycle'] as const;

    for (const [locale, labels] of Object.entries(expectations)) {
      expect(phases.map((phase) => formatCyclePhaseLabel(phase, locale as keyof typeof expectations))).toEqual(labels);
    }
  });

  it('formats fertile-window messages across every supported locale', () => {
    const expectations = {
      en: {
        open: 'Fertile window opens in 2 days',
        closed: 'Fertile window ended 5 days ago',
        active: 'Fertile window active today',
      },
      es: {
        open: 'La ventana fértil se abre en 2 días',
        closed: 'La ventana fértil terminó hace 5 días',
        active: 'La ventana fértil está activa hoy',
      },
      de: {
        open: 'Das fruchtbare Fenster öffnet sich in 2 Tagen',
        closed: 'Das fruchtbare Fenster endete vor 5 Tagen',
        active: 'Das fruchtbare Fenster ist heute aktiv',
      },
      fr: {
        open: 'La fenêtre fertile s’ouvre dans 2 jours',
        closed: 'La fenêtre fertile s’est terminée il y a 5 jours',
        active: 'La fenêtre fertile est active aujourd’hui',
      },
      ja: {
        open: '排卵期は 2 日後に始まります',
        closed: '排卵期は 5 日前に終わりました',
        active: '排卵期は今日です',
      },
      'zh-Hans': {
        open: '易孕期将在 2 天后开始',
        closed: '易孕期在 5 天前结束',
        active: '易孕期今天处于活跃状态',
      },
      pt: {
        open: 'A janela fértil abre em 2 dias',
        closed: 'A janela fértil terminou há 5 dias',
        active: 'A janela fértil está ativa hoje',
      },
      ru: {
        open: 'Фертильное окно откроется через 2 дня',
        closed: 'Фертильное окно закончилось 5 дней назад',
        active: 'Фертильное окно активно сегодня',
      },
    } as const;

    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'en')).toBe(
      expectations.en.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'en')).toBe(
      expectations.en.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'en')).toBe(
      expectations.en.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'es')).toBe(
      expectations.es.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'es')).toBe(
      expectations.es.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'es')).toBe(
      expectations.es.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'de')).toBe(
      expectations.de.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'de')).toBe(
      expectations.de.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'de')).toBe(
      expectations.de.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'fr')).toBe(
      expectations.fr.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'fr')).toBe(
      expectations.fr.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'fr')).toBe(
      expectations.fr.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'ja')).toBe(
      expectations.ja.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'ja')).toBe(
      expectations.ja.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'ja')).toBe(
      expectations.ja.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'zh-Hans')).toBe(
      expectations['zh-Hans'].open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'zh-Hans')).toBe(
      expectations['zh-Hans'].closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'zh-Hans')).toBe(
      expectations['zh-Hans'].active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'pt')).toBe(
      expectations.pt.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'pt')).toBe(
      expectations.pt.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'pt')).toBe(
      expectations.pt.active,
    );
    expect(formatFertileWindowLabel('2026-04-01', '2026-04-03', '2026-04-08', 'ru')).toBe(
      expectations.ru.open,
    );
    expect(formatFertileWindowLabel('2026-04-13', '2026-04-03', '2026-04-08', 'ru')).toBe(
      expectations.ru.closed,
    );
    expect(formatFertileWindowLabel('2026-04-05', '2026-04-03', '2026-04-08', 'ru')).toBe(
      expectations.ru.active,
    );
  });

  it('formats compact fertile captions, history chips, and current-period ranges', () => {
    // UL-07: the caption used to restate the headline's relative-time fact
    // ("Fertile window ended 1 day ago" / "Window closed 1 day ago."). It now
    // carries the one thing the headline does not: the window's dates.
    expect(formatFertileWindowCaption('2026-04-11', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Runs Apr 12 to 18.',
    );
    expect(formatFertileWindowCaption('2026-04-10', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Runs Apr 12 to 18.',
    );
    expect(formatFertileWindowCaption('2026-04-19', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Was open Apr 12 to 18.',
    );
    expect(formatFertileWindowCaption('2026-04-14', '2026-04-12', '2026-04-18', 'en')).toBe(
      'Open through Apr 18.',
    );
    // A window spanning a month boundary keeps both month names.
    expect(formatFertileWindowCaption('2026-04-26', '2026-04-28', '2026-05-02', 'en')).toBe(
      'Runs Apr 28 to May 2.',
    );
    expect(formatFertileWindowCaption('2026-04-11', '2026-04-12', '2026-04-18', 'es')).toBe('');

    expect(formatHistoryChipLabel(0, 'en')).toBe('New baseline');
    expect(formatHistoryChipLabel(2, 'en')).toBe('2 cycles');
    expect(formatHistoryChipLabel(2, 'fr')).toBe('');

    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'en')).toBe(
      'Current expected period May 1 to 5',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'es')).toBe(
      'Periodo esperado actual 1 may al 5 may',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'de')).toBe(
      'Aktuell erwartete Periode 1. Mai bis 5. Mai',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'fr')).toBe(
      'Règles attendues en ce moment 1 mai au 5 mai',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'ja')).toBe(
      '現在予測される生理は 5月1日〜5日 です',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'zh-Hans')).toBe(
      '当前预计月经为 5月1日至5日',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'pt')).toBe(
      'Menstruação esperada atual de 1 de mai. a 5 de mai.',
    );
    expect(formatCurrentExpectedPeriodRangeLabel('2026-05-01', '2026-05-05', 'ru')).toBe(
      'Текущие ожидаемые месячные 1 мая — 5 мая',
    );
  });

  it('formats cycle day and confidence labels across supported locales', () => {
    expect(formatCycleDayLabel(24, 'en')).toBe('Cycle day 24');
    expect(formatCycleDayLabel(24, 'de')).toBe('Zyklustag 24');
    expect(formatCycleDayLabel(24, 'fr')).toBe('Jour 24 du cycle');
    expect(formatCycleDayLabel(24, 'ja')).toBe('周期24日目');
    expect(formatCycleDayLabel(24, 'zh-Hans')).toBe('周期第24天');
    expect(formatCycleDayLabel(24, 'pt')).toBe('Dia do ciclo 24');
    expect(formatCycleDayLabel(24, 'ru')).toBe('День цикла 24');

    expect(formatPredictionConfidenceLabel('low', 'es')).toBe('Confianza baja');
    expect(formatPredictionConfidenceLabel('medium', 'de')).toBe('Mittlere Zuversicht');
    expect(formatPredictionConfidenceLabel('high', 'fr')).toBe('Confiance élevée');
    expect(formatPredictionConfidenceLabel('low', 'ja')).toBe('低い確信度');
    expect(formatPredictionConfidenceLabel('medium', 'zh-Hans')).toBe('中等置信度');
    expect(formatPredictionConfidenceLabel('high', 'pt')).toBe('Confiança alta');
  });

  it('formats prediction ranges and next-period wrappers in each locale', () => {
    const startIso = '2026-04-28';
    const endIso = '2026-05-02';
    const locales = ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'] as const;
    const nextPeriodLabels = {
      en: 'Next period expected Apr 28 to May 2',
      es: 'Se espera el próximo periodo del 28 de abril al 2 de mayo',
      de: 'Die nächste Periode wird vom 28. April bis 2. Mai erwartet',
      fr: 'Les prochaines règles sont attendues du 28 avril au 2 mai',
      ja: '次の生理は 4月28日〜5月2日 頃の予定です',
      'zh-Hans': '下次月经预计为 4月28日至5月2日',
      pt: 'A próxima menstruação é esperada de 28 de abr. a 2 de mai.',
      ru: 'Следующие месячные ожидаются 28 апр. — 2 мая',
    } as const;
    const aroundWrappers = {
      en: 'Next period expected around Apr 28',
      es: 'Se espera el próximo periodo alrededor de Apr 28',
      de: 'Die nächste Periode wird ungefähr am Apr 28 erwartet',
      fr: 'Les prochaines règles sont attendues autour du Apr 28',
      ja: '次の生理は Apr 28 頃の予定です',
      'zh-Hans': '下次月经预计在 Apr 28 左右',
      pt: 'A próxima menstruação é esperada por volta de Apr 28',
      ru: 'Следующие месячные ожидаются примерно Apr 28',
    } as const;

    for (const locale of locales) {
      const start = formatMonthDayLabel(startIso, locale);
      const end = formatMonthDayLabel(endIso, locale);
      const crossMonthRange =
        locale === 'ja'
          ? `${start}〜${end}`
          : locale === 'zh-Hans'
            ? `${start}至${end}`
            : locale === 'fr'
              ? `${start} au ${end}`
              : locale === 'de'
                ? `${start} bis ${end}`
                  : locale === 'es'
                  ? `${start} al ${end}`
                    : locale === 'pt'
                    ? `${start} a ${end}`
                      : locale === 'ru'
                      ? `${start} — ${end}`
                      : `${start} to ${end}`;

      expect(formatPredictionRangeLabel('2026-04-28', '2026-05-02', locale)).toBe(crossMonthRange);
      expect(formatNextPeriodExpectedRangeLabel(startIso, endIso, locale)).toBe(
        nextPeriodLabels[locale],
      );
      expect(formatNextPeriodExpectedAroundLabel('Apr 28', locale)).toBe(aroundWrappers[locale]);
    }
  });

  it('formats fertile-window and next-period labels for non-default locales', () => {
    expect(formatFertileWindowLabel('2026-04-11', '2026-04-13', '2026-04-18', 'zh-Hans')).toBe(
      '易孕期将在 2 天后开始',
    );
    expect(formatFertileWindowLabel('2026-04-22', '2026-04-13', '2026-04-18', 'ru')).toBe(
      'Фертильное окно закончилось 4 дня назад',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-04-28', '2026-05-02', 'fr')).toBe(
      'Les prochaines règles sont attendues du 28 avril au 2 mai',
    );
    expect(formatNextPeriodExpectedAroundLabel('Apr 28', 'ja')).toBe(
      '次の生理は Apr 28 頃の予定です',
    );
  });

  it('formats logged period counts with locale-specific plural branches', () => {
    expect(formatLoggedPeriodStartsLabel(1, 'pt')).toBe('1 início de período registrados');
    expect(formatLoggedPeriodStartsLabel(5, 'ru')).toBe('Записано 5 началов месячных');
    expect(formatLoggedPeriodStartsLabel(1, 'en')).toBe('1 logged period start');
    expect(formatLoggedPeriodStartsLabel(2, 'es')).toBe('2 inicios de periodo registrados');
    expect(formatLoggedPeriodStartsLabel(2, 'de')).toBe('2 erfasste Periodenstarts');
    expect(formatLoggedPeriodStartsLabel(2, 'fr')).toBe('2 débuts de règles enregistrés');
    expect(formatLoggedPeriodStartsLabel(2, 'ja')).toBe('記録した生理開始は 2 件');
    expect(formatLoggedPeriodStartsLabel(2, 'zh-Hans')).toBe('已记录 2 次月经开始');
    expect(formatPredictionLimitation('on-device', 'en')).toBe(
      'Predictions stay on this device and adapt as more entries are logged.',
    );
  });

  it('localizes the prediction limitation catalog across every supported locale', () => {
    const expectations = {
      'on-device': {
        en: 'Predictions stay on this device and adapt as more entries are logged.',
        es: 'Las predicciones se quedan en el dispositivo y se ajustan a medida que registras más entradas.',
        de: 'Vorhersagen bleiben auf diesem Gerät und passen sich an, wenn mehr Einträge erfasst werden.',
        fr: 'Les prévisions restent sur cet appareil et s’adaptent à mesure que d’autres entrées sont enregistrées.',
        ja: '予測はこの端末にとどまり、記録が増えるほど調整されます。',
        'zh-Hans': '预测会保留在这个设备上，并随着更多记录自动调整。',
        pt: 'As previsões ficam neste dispositivo e se ajustam conforme mais registros são adicionados.',
        ru: 'Прогнозы остаются на этом устройстве и корректируются по мере добавления новых записей.',
      },
      'not-medical-certainty': {
        en: 'Floriva shows estimates, not medical certainty.',
        es: 'Floriva muestra estimaciones, no certeza médica.',
        de: 'Floriva zeigt Schätzungen, keine medizinische Gewissheit.',
        fr: 'Floriva affiche des estimations, pas une certitude médicale.',
        ja: 'Floriva は推定値を表示し、医学的な確実性は示しません。',
        'zh-Hans': 'Floriva 显示的是估算，不是医学上的确定结论。',
        pt: 'O Floriva mostra estimativas, não certeza médica.',
        ru: 'Floriva показывает оценки, а не медицинскую точность.',
      },
      'onboarding-seed-active': {
        en: 'Predictions are using your onboarding seed until more bleeding history is logged.',
        es: 'Las predicciones usan tus datos iniciales de bienvenida hasta que se registre más historial de sangrado.',
        de: 'Vorhersagen nutzen zunächst deine Onboarding-Ausgangsdaten, bis mehr Blutungsverlauf erfasst ist.',
        fr: 'Les prévisions utilisent les données de départ de l’onboarding jusqu’à ce que davantage d’historique de saignement soit enregistré.',
        ja: 'より多くの出血履歴が記録されるまで、予測はオンボーディングの初期データを使います。',
        'zh-Hans': '在记录更多出血历史之前，预测会使用你的引导初始数据。',
        pt: 'As previsões usam seus dados iniciais de onboarding até que mais histórico de sangramento seja registrado.',
        ru: 'Прогнозы используют стартовые данные онбординга, пока не накопится больше истории кровотечений.',
      },
      'limited-history-shift': {
        en: 'Limited bleeding history means period timing may shift as more entries are logged.',
        es: 'El historial limitado de sangrado significa que el momento del periodo puede cambiar a medida que se registran más entradas.',
        de: 'Ein begrenzter Blutungsverlauf bedeutet, dass sich das Timing der Periode mit mehr Einträgen verschieben kann.',
        fr: 'Un historique de saignement limité signifie que le timing des règles peut évoluer à mesure que d’autres entrées sont ajoutées.',
        ja: '出血履歴が少ないため、記録が増えると生理のタイミングが変わることがあります。',
        'zh-Hans': '出血历史较少意味着，随着记录增多，月经时间可能会变化。',
        pt: 'Pouco histórico de sangramento significa que o timing do período pode mudar conforme mais entradas são registradas.',
        ru: 'Ограниченная история кровотечений означает, что время месячных может смещаться по мере добавления записей.',
      },
      'irregular-cycle-broader': {
        en: 'Irregular-cycle support keeps predictions broader when your timing varies.',
        es: 'El soporte para ciclos irregulares mantiene predicciones más amplias cuando tu ritmo varía.',
        de: 'Die Unterstützung für unregelmäßige Zyklen hält Vorhersagen breiter, wenn dein Timing schwankt.',
        fr: 'La prise en charge des cycles irréguliers garde les prévisions plus larges quand ton rythme varie.',
        ja: '周期が変動する場合、不規則な周期のサポートにより予測範囲を広めに保ちます。',
        'zh-Hans': '当你的周期时间有变化时，不规则周期支持会让预测范围更宽。',
        pt: 'O suporte a ciclos irregulares mantém as previsões mais amplas quando o teu ritmo varia.',
        ru: 'Поддержка нерегулярного цикла делает прогнозы шире, когда ваши сроки меняются.',
      },
    } as const;

    for (const [code, translations] of Object.entries(expectations)) {
      for (const [locale, expected] of Object.entries(translations)) {
        expect(formatPredictionLimitation(code as any, locale as any)).toBe(expected);
      }
    }
  });

  it('formats short prediction ranges for the calendar summary', () => {
    expect(formatPredictionRangeLabel('2026-04-28', '2026-05-02', 'en')).toBe(
      'Apr 28 to May 2',
    );
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'en')).toBe('May 1 to 5');
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'ja')).toBe('5月1日〜5日');
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'ru')).toBe('1 мая — 5 мая');
  });

  it('formats next-period messaging and logged-period counts across locales', () => {
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'en')).toBe(
      'Next period expected May 1 to 5',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'pt')).toBe(
      'A próxima menstruação é esperada de 1 de mai. a 5 de mai.',
    );
    expect(formatNextPeriodExpectedAroundLabel('Apr 25', 'de')).toBe(
      'Die nächste Periode wird ungefähr am Apr 25 erwartet',
    );
    expect(formatNextPeriodExpectedAroundLabel('4月25日', 'ja')).toBe(
      '次の生理は 4月25日 頃の予定です',
    );
    expect(formatLoggedPeriodStartsLabel(1, 'en')).toBe('1 logged period start');
    expect(formatLoggedPeriodStartsLabel(2, 'fr')).toBe('2 débuts de règles enregistrés');
    expect(formatLoggedPeriodStartsLabel(3, 'ru')).toBe('Записано 3 начала месячных');
  });

  it('localizes each prediction limitation family across locales', () => {
    expect(formatPredictionLimitation('on-device', 'de')).toBe(
      'Vorhersagen bleiben auf diesem Gerät und passen sich an, wenn mehr Einträge erfasst werden.',
    );
    expect(formatPredictionLimitation('onboarding-seed-active', 'fr')).toBe(
      'Les prévisions utilisent les données de départ de l’onboarding jusqu’à ce que davantage d’historique de saignement soit enregistré.',
    );
    expect(formatPredictionLimitation('limited-history-shift', 'pt')).toBe(
      'Pouco histórico de sangramento significa que o timing do período pode mudar conforme mais entradas são registradas.',
    );
    expect(formatPredictionLimitation('irregular-cycle-broader', 'ja')).toBe(
      '周期が変動する場合、不規則な周期のサポートにより予測範囲を広めに保ちます。',
    );
  });

  it('covers the remaining locale branches for prediction messaging helpers', () => {
    expect(formatFertileWindowLabel('2026-04-10', '2026-04-12', '2026-04-18', 'es')).toBe(
      'La ventana fértil se abre en 2 días',
    );
    expect(formatFertileWindowLabel('2026-04-10', '2026-04-12', '2026-04-18', 'pt')).toBe(
      'A janela fértil abre em 2 dias',
    );
    expect(formatFertileWindowLabel('2026-04-10', '2026-04-12', '2026-04-18', 'ru')).toBe(
      'Фертильное окно откроется через 2 дня',
    );

    expect(formatPredictionConfidenceLabel('low', 'es')).toBe('Confianza baja');
    expect(formatPredictionConfidenceLabel('high', 'de')).toBe('Hohe Zuversicht');
    expect(formatPredictionConfidenceLabel('medium', 'fr')).toBe('Confiance moyenne');

    expect(formatCycleDayLabel(7, 'ja')).toBe('周期7日目');
    expect(formatCycleDayLabel(7, 'zh-Hans')).toBe('周期第7天');
    expect(formatCycleDayLabel(7, 'pt')).toBe('Dia do ciclo 7');
    expect(formatCycleDayLabel(7, 'ru')).toBe('День цикла 7');

    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'fr')).toBe(
      '1 mai au 5 mai',
    );
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'de')).toBe(
      '1. Mai bis 5. Mai',
    );
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'es')).toBe(
      '1 may al 5 may',
    );
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'pt')).toBe(
      '1 de mai. a 5 de mai.',
    );
    expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', 'zh-Hans')).toBe(
      '5月1日至5日',
    );

    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'es')).toBe(
      'Se espera el próximo periodo del 1 al 5 de mayo',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'de')).toBe(
      'Die nächste Periode wird vom 1. Mai bis 5. Mai erwartet',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'fr')).toBe(
      'Les prochaines règles sont attendues du 1er au 5 mai',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-02', '2026-05-05', 'fr')).toBe(
      'Les prochaines règles sont attendues du 2 au 5 mai',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-12-30', '2027-01-03', 'es')).toBe(
      'Se espera el próximo periodo del 30 de diciembre de 2026 al 3 de enero de 2027',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-12-30', '2027-01-03', 'de')).toBe(
      'Die nächste Periode wird vom 30. Dezember 2026 bis 3. Januar 2027 erwartet',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-12-30', '2027-01-03', 'fr')).toBe(
      'Les prochaines règles sont attendues du 30 décembre 2026 au 3 janvier 2027',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'ja')).toBe(
      '次の生理は 5月1日〜5日 頃の予定です',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'zh-Hans')).toBe(
      '下次月经预计为 5月1日至5日',
    );
    expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', 'ru')).toBe(
      'Следующие месячные ожидаются 1 мая — 5 мая',
    );

    expect(formatNextPeriodExpectedAroundLabel('25 abr', 'es')).toBe(
      'Se espera el próximo periodo alrededor de 25 abr',
    );
    expect(formatNextPeriodExpectedAroundLabel('25 avr.', 'fr')).toBe(
      'Les prochaines règles sont attendues autour du 25 avr.',
    );
    expect(formatNextPeriodExpectedAroundLabel('2026年4月25日', 'zh-Hans')).toBe(
      '下次月经预计在 2026年4月25日 左右',
    );
    expect(formatNextPeriodExpectedAroundLabel('25 апр.', 'ru')).toBe(
      'Следующие месячные ожидаются примерно 25 апр.',
    );

    expect(formatLoggedPeriodStartsLabel(2, 'es')).toBe('2 inicios de periodo registrados');
    expect(formatLoggedPeriodStartsLabel(1, 'de')).toBe('1 erfasste Periodenstarts');
    expect(formatLoggedPeriodStartsLabel(1, 'ja')).toBe('記録した生理開始は 1 件');
    expect(formatLoggedPeriodStartsLabel(4, 'zh-Hans')).toBe('已记录 4 次月经开始');
    expect(formatLoggedPeriodStartsLabel(2, 'pt')).toBe('2 inícios de período registrados');

    expect(formatPredictionLimitation('on-device', 'ja')).toBe(
      '予測はこの端末にとどまり、記録が増えるほど調整されます。',
    );
    expect(formatPredictionLimitation('not-medical-certainty', 'ru')).toBe(
      'Floriva показывает оценки, а не медицинскую точность.',
    );
    expect(formatPredictionLimitation('onboarding-seed-active', 'zh-Hans')).toBe(
      '在记录更多出血历史之前，预测会使用你的引导初始数据。',
    );
    expect(formatPredictionLimitation('limited-history-shift', 'de')).toBe(
      'Ein begrenzter Blutungsverlauf bedeutet, dass sich das Timing der Periode mit mehr Einträgen verschieben kann.',
    );
    expect(formatPredictionLimitation('irregular-cycle-broader', 'pt')).toBe(
      'O suporte a ciclos irregulares mantém as previsões mais amplas quando o teu ritmo varia.',
    );
  });

  it('exercises all locale variants for localized prediction labels', () => {
    const locales = ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'] as const;

    for (const locale of locales) {
      expect(formatPredictionConfidenceLabel('low', locale)).toEqual(expect.any(String));
      expect(formatPredictionConfidenceLabel('medium', locale)).toEqual(expect.any(String));
      expect(formatPredictionConfidenceLabel('high', locale)).toEqual(expect.any(String));
      expect(formatCycleDayLabel(14, locale)).toContain('14');
      expect(formatNextPeriodExpectedRangeLabel('2026-05-01', '2026-05-05', locale)).toEqual(
        expect.any(String),
      );
      expect(formatNextPeriodExpectedAroundLabel('Apr 25', locale)).toEqual(expect.any(String));
      expect(formatPredictionRangeLabel('2026-05-01', '2026-05-05', locale)).toEqual(
        expect.any(String),
      );
      expect(formatLoggedPeriodStartsLabel(1, locale)).toEqual(expect.any(String));
      expect(formatLoggedPeriodStartsLabel(3, locale)).toEqual(expect.any(String));
    }
  });

  it('exercises every localized limitation family across all supported locales', () => {
    const locales = ['es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'] as const;
    const codes = [
      'on-device',
      'not-medical-certainty',
      'onboarding-seed-active',
      'limited-history-shift',
      'irregular-cycle-broader',
      'projected-forward',
    ] as const;

    for (const code of codes) {
      for (const locale of locales) {
        expect(formatPredictionLimitation(code, locale)).toEqual(expect.any(String));
      }
    }
  });
});
