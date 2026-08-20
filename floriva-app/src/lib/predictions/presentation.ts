import type {
  LimitationCode,
  PredictionConfidenceLevel,
  SupportedLocale,
} from '@/src/types/domain';

import { diffDays } from '@/src/lib/predictions/dateMath';
import { translate } from '@/src/localization/translations';

function createMiddayDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`);
}

// Russian noun pluralization has three forms selected by the last digit, with a
// "teen exception": 11-14 (and any number ending 11-14) always take the "many"
// form regardless of last digit. A naive `n < 5` check is wrong for 21, 22-24,
// 31, … (which follow the standard last-digit rule) and for 12-14 (which a
// last-digit check would mis-bucket as "one"/"few").
function selectRussianPluralForm(count: number): 'one' | 'few' | 'many' {
  const absCount = Math.abs(count);
  const lastTwo = absCount % 100;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'many';
  }
  const lastDigit = absCount % 10;
  if (lastDigit === 1) {
    return 'one';
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'few';
  }
  return 'many';
}

function russianPlural(
  count: number,
  forms: { one: string; few: string; many: string },
): string {
  return forms[selectRussianPluralForm(count)];
}

function getDateParts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return {
    year,
    month,
    day,
  };
}

function isJapaneseLocale(locale: SupportedLocale) {
  return locale === 'ja';
}

function isChineseLocale(locale: SupportedLocale) {
  return locale === 'zh-Hans';
}

export function formatMonthDayLabel(isoDate: string, locale: SupportedLocale = 'en') {
  const date = createMiddayDate(isoDate);

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

// Same fields as formatMonthDayLabel plus an explicit year, reusing the same
// Intl.DateTimeFormat pattern used throughout this module (see
// formatMonthLabel below) rather than hand-rolling year placement per locale.
// Used by formatPredictionRangeLabel (LT-08) when a range's start/end years
// differ, so a New Year-spanning window like "Dec 30 to Jan 3" is never
// ambiguous about which year each side falls in.
export function formatMonthDayYearLabel(isoDate: string, locale: SupportedLocale = 'en') {
  const date = createMiddayDate(isoDate);

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatMonthLabel(monthIso: string, locale: SupportedLocale = 'en') {
  const { year, month } = getDateParts(monthIso);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatWeekdayLabels(locale: SupportedLocale = 'en') {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 4 + index)); // Jan 4 2026 = Sunday

    return new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(date);
  });
}

function formatLocalizedCountSentence(
  locale: SupportedLocale,
  openCount: number,
  closedCount: number,
) {
  if (isJapaneseLocale(locale)) {
    return {
      open: `排卵期は ${openCount} 日後に始まります`,
      closed: `排卵期は ${closedCount} 日前に終わりました`,
      active: '排卵期は今日です',
    };
  }

  if (isChineseLocale(locale)) {
    return {
      open: `易孕期将在 ${openCount} 天后开始`,
      closed: `易孕期在 ${closedCount} 天前结束`,
      active: '易孕期今天处于活跃状态',
    };
  }

  switch (locale) {
    case 'es':
      return {
        open: `La ventana fértil se abre en ${openCount} día${openCount === 1 ? '' : 's'}`,
        closed: `La ventana fértil terminó hace ${closedCount} día${closedCount === 1 ? '' : 's'}`,
        active: 'La ventana fértil está activa hoy',
      };
    case 'de':
      return {
        open: `Das fruchtbare Fenster öffnet sich in ${openCount} Tag${openCount === 1 ? '' : 'en'}`,
        closed: `Das fruchtbare Fenster endete vor ${closedCount} Tag${closedCount === 1 ? '' : 'en'}`,
        active: 'Das fruchtbare Fenster ist heute aktiv',
      };
    case 'fr':
      return {
        open: `La fenêtre fertile s’ouvre dans ${openCount} jour${openCount === 1 ? '' : 's'}`,
        closed: `La fenêtre fertile s’est terminée il y a ${closedCount} jour${closedCount === 1 ? '' : 's'}`,
        active: 'La fenêtre fertile est active aujourd’hui',
      };
    case 'pt':
      return {
        open: `A janela fértil abre em ${openCount} dia${openCount === 1 ? '' : 's'}`,
        closed: `A janela fértil terminou há ${closedCount} dia${closedCount === 1 ? '' : 's'}`,
        active: 'A janela fértil está ativa hoje',
      };
    case 'ru':
      return {
        open: `Фертильное окно откроется через ${openCount} ${russianPlural(openCount, { one: 'день', few: 'дня', many: 'дней' })}`,
        closed: `Фертильное окно закончилось ${closedCount} ${russianPlural(closedCount, { one: 'день', few: 'дня', many: 'дней' })} назад`,
        active: 'Фертильное окно активно сегодня',
      };
    default:
      return {
        open: `Fertile window opens in ${openCount} day${openCount === 1 ? '' : 's'}`,
        closed: `Fertile window ended ${closedCount} day${closedCount === 1 ? '' : 's'} ago`,
        active: 'Fertile window active today',
      };
  }
}

export function formatFertileWindowLabel(
  todayIso: string,
  startIso: string,
  endIso: string,
  locale: SupportedLocale = 'en',
) {
  if (todayIso < startIso) {
    const daysUntilWindow = diffDays(todayIso, startIso);

    return formatLocalizedCountSentence(locale, daysUntilWindow, daysUntilWindow).open;
  }

  if (todayIso > endIso) {
    const daysSinceWindow = diffDays(endIso, todayIso);

    return formatLocalizedCountSentence(locale, daysSinceWindow, daysSinceWindow).closed;
  }

  return formatLocalizedCountSentence(locale, 0, 0).active;
}

// UL-07: this caption sits directly under the fertile-window headline, which
// already states the relative time ("Fertile window ended 9 days ago"). The
// old captions restated that same fact verbatim ("Window closed 9 days
// ago.") -- a same-fact stutter. The caption now carries the one thing the
// headline does not: the window's actual dates. Still en-only, matching the
// pre-existing behavior of this formatter (other locales return '').
export function formatFertileWindowCaption(
  todayIso: string,
  startIso: string,
  endIso: string,
  locale: SupportedLocale = 'en',
) {
  if (locale !== 'en') {
    return '';
  }

  const rangeLabel = formatPredictionRangeLabel(startIso, endIso, locale);

  if (todayIso < startIso) {
    return `Runs ${rangeLabel}.`;
  }
  if (todayIso > endIso) {
    return `Was open ${rangeLabel}.`;
  }
  return `Open through ${formatMonthDayLabel(endIso, locale)}.`;
}

export function formatHistoryChipLabel(cycleCount: number, locale: SupportedLocale = 'en') {
  if (cycleCount <= 0) {
    return locale === 'en' ? 'New baseline' : '';
  }
  if (locale === 'en') {
    return `${cycleCount} cycle${cycleCount === 1 ? '' : 's'}`;
  }
  return '';
}

export function formatPredictionConfidenceLabel(
  level: PredictionConfidenceLevel,
  locale: SupportedLocale = 'en',
) {
  switch (locale) {
    case 'es':
      return level === 'low'
        ? 'Confianza baja'
        : level === 'medium'
          ? 'Confianza media'
          : 'Confianza alta';
    case 'de':
      return level === 'low'
        ? 'Niedrige Zuversicht'
        : level === 'medium'
          ? 'Mittlere Zuversicht'
          : 'Hohe Zuversicht';
    case 'fr':
      return level === 'low'
        ? 'Confiance faible'
        : level === 'medium'
          ? 'Confiance moyenne'
          : 'Confiance élevée';
    case 'ja':
      return level === 'low'
        ? '低い確信度'
        : level === 'medium'
          ? '中程度の確信度'
          : '高い確信度';
    case 'zh-Hans':
      return level === 'low'
        ? '低置信度'
        : level === 'medium'
          ? '中等置信度'
          : '高置信度';
    case 'pt':
      return level === 'low'
        ? 'Confiança baixa'
        : level === 'medium'
          ? 'Confiança média'
          : 'Confiança alta';
    case 'ru':
      return level === 'low'
        ? 'Низкая уверенность'
        : level === 'medium'
          ? 'Средняя уверенность'
          : 'Высокая уверенность';
    default:
      return level === 'low'
        ? 'Low confidence'
        : level === 'medium'
          ? 'Medium confidence'
          : 'High confidence';
  }
}

export function formatPredictionConfidenceBasisLabel(
  cycleCount: number,
  locale: SupportedLocale = 'en',
) {
  if (cycleCount <= 1) {
    switch (locale) {
      case 'es':
        return 'Basado en una señal local';
      case 'de':
        return 'Basierend auf einem lokalen Signal';
      case 'fr':
        return 'Basé sur un signal local';
      case 'ja':
        return 'ローカルの記録 1 件に基づく推定';
      case 'zh-Hans':
        return '基于 1 条本地记录';
      case 'pt':
        return 'Baseado em um sinal local';
      case 'ru':
        return 'На основе одной локальной записи';
      default:
        return 'Based on 1 local signal';
    }
  }

  switch (locale) {
    case 'es':
      return `Basado en ${cycleCount} inicios de ciclo locales`;
    case 'de':
      return `Basierend auf ${cycleCount} lokalen Zyklusstarts`;
    case 'fr':
      return `Basé sur ${cycleCount} débuts de cycle locaux`;
    case 'ja':
      return `${cycleCount} 件のローカル周期開始に基づく推定`;
    case 'zh-Hans':
      return `基于 ${cycleCount} 条本地周期开始记录`;
    case 'pt':
      return `Baseado em ${cycleCount} inícios de ciclo locais`;
    case 'ru':
      return `На основе ${cycleCount} локальных начал цикла`;
    default:
      return `Based on ${cycleCount} local cycle starts`;
  }
}

export function formatCycleDayLabel(cycleDay: number, locale: SupportedLocale = 'en') {
  switch (locale) {
    case 'es':
      return `Día del ciclo ${cycleDay}`;
    case 'de':
      return `Zyklustag ${cycleDay}`;
    case 'fr':
      return `Jour ${cycleDay} du cycle`;
    case 'ja':
      return `周期${cycleDay}日目`;
    case 'zh-Hans':
      return `周期第${cycleDay}天`;
    case 'pt':
      return `Dia do ciclo ${cycleDay}`;
    case 'ru':
      return `День цикла ${cycleDay}`;
    default:
      return `Cycle day ${cycleDay}`;
  }
}

export type CyclePhaseLabelKey =
  | 'period'
  | 'follicular'
  | 'fertile'
  | 'luteal'
  | 'earlier-cycle'
  | 'later-cycle';

const cyclePhaseLabels: Record<SupportedLocale, Record<CyclePhaseLabelKey, string>> = {
  en: {
    period: 'Period', follicular: 'Follicular', fertile: 'Fertile', luteal: 'Luteal',
    'earlier-cycle': 'Earlier cycle', 'later-cycle': 'Later cycle',
  },
  es: {
    period: 'Periodo', follicular: 'Folicular', fertile: 'Fértil', luteal: 'Lútea',
    'earlier-cycle': 'Inicio del ciclo', 'later-cycle': 'Final del ciclo',
  },
  de: {
    period: 'Periode', follicular: 'Follikelphase', fertile: 'Fruchtbare Phase', luteal: 'Lutealphase',
    'earlier-cycle': 'Frühe Zyklusphase', 'later-cycle': 'Späte Zyklusphase',
  },
  fr: {
    period: 'Règles', follicular: 'Folliculaire', fertile: 'Fertile', luteal: 'Lutéale',
    'earlier-cycle': 'Début du cycle', 'later-cycle': 'Fin du cycle',
  },
  ja: {
    period: '生理期', follicular: '卵胞期', fertile: '妊娠しやすい時期', luteal: '黄体期',
    'earlier-cycle': '周期前半', 'later-cycle': '周期後半',
  },
  'zh-Hans': {
    period: '经期', follicular: '卵泡期', fertile: '易孕期', luteal: '黄体期',
    'earlier-cycle': '周期前段', 'later-cycle': '周期后段',
  },
  pt: {
    period: 'Menstruação', follicular: 'Folicular', fertile: 'Fértil', luteal: 'Lútea',
    'earlier-cycle': 'Início do ciclo', 'later-cycle': 'Fim do ciclo',
  },
  ru: {
    period: 'Месячные', follicular: 'Фолликулярная фаза', fertile: 'Фертильная фаза', luteal: 'Лютеиновая фаза',
    'earlier-cycle': 'Начало цикла', 'later-cycle': 'Конец цикла',
  },
};

export function formatCyclePhaseLabel(
  phase: CyclePhaseLabelKey,
  locale: SupportedLocale = 'en',
) {
  return cyclePhaseLabels[locale][phase];
}

export function formatPredictionRangeLabel(
  startIso: string,
  endIso: string,
  locale: SupportedLocale = 'en',
) {
  const startDateParts = getDateParts(startIso);
  const endDateParts = getDateParts(endIso);
  const crossesYear = startDateParts.year !== endDateParts.year;
  const sameMonth =
    startDateParts.year === endDateParts.year && startDateParts.month === endDateParts.month;
  // LT-08: a range spanning a New Year boundary (e.g. "Dec 30 to Jan 3") is
  // ambiguous about which year each side falls in, especially in a January
  // history view. Once start/end years differ, render the year on BOTH
  // sides -- the compact same-month/day-only shortening below only applies
  // within a single year, so it never re-introduces the ambiguity.
  const start = crossesYear
    ? formatMonthDayYearLabel(startIso, locale)
    : formatMonthDayLabel(startIso, locale);
  const end = crossesYear
    ? formatMonthDayYearLabel(endIso, locale)
    : formatMonthDayLabel(endIso, locale);
  const endDay = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(createMiddayDate(endIso));
  const canCompactSameMonthEnd = locale === 'en' || locale === 'ja' || locale === 'zh-Hans';
  const compactEnd = crossesYear ? end : sameMonth && canCompactSameMonthEnd ? endDay : end;

  switch (locale) {
    case 'ja':
      return `${start}〜${compactEnd}`;
    case 'zh-Hans':
      return `${start}至${compactEnd}`;
    case 'fr':
      return `${start} au ${compactEnd}`;
    case 'de':
      return `${start} bis ${compactEnd}`;
    case 'es':
      return `${start} al ${compactEnd}`;
    case 'pt':
      return `${start} a ${compactEnd}`;
    case 'ru':
      return `${start} — ${compactEnd}`;
    default:
      return `${start} to ${compactEnd}`;
  }
}

function formatLongMonthName(isoDate: string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(createMiddayDate(isoDate));
}

function formatGrammaticalExpectedRange(
  startIso: string,
  endIso: string,
  locale: 'es' | 'de' | 'fr',
) {
  const start = getDateParts(startIso);
  const end = getDateParts(endIso);
  const sameMonth = start.year === end.year && start.month === end.month;
  const crossesYear = start.year !== end.year;
  const startMonth = formatLongMonthName(startIso, locale);
  const endMonth = formatLongMonthName(endIso, locale);

  if (locale === 'es') {
    if (sameMonth) {
      return `del ${start.day} al ${end.day} de ${endMonth}`;
    }
    const startYear = crossesYear ? ` de ${start.year}` : '';
    const endYear = crossesYear ? ` de ${end.year}` : '';
    return `del ${start.day} de ${startMonth}${startYear} al ${end.day} de ${endMonth}${endYear}`;
  }

  if (locale === 'de') {
    const startYear = crossesYear ? ` ${start.year}` : '';
    const endYear = crossesYear ? ` ${end.year}` : '';
    return `vom ${start.day}. ${startMonth}${startYear} bis ${end.day}. ${endMonth}${endYear}`;
  }

  const startDay = start.day === 1 ? '1er' : String(start.day);
  const endDay = end.day === 1 ? '1er' : String(end.day);
  if (sameMonth) {
    return `du ${startDay} au ${endDay} ${endMonth}`;
  }
  const startYear = crossesYear ? ` ${start.year}` : '';
  const endYear = crossesYear ? ` ${end.year}` : '';
  return `du ${startDay} ${startMonth}${startYear} au ${endDay} ${endMonth}${endYear}`;
}

export function formatNextPeriodExpectedRangeLabel(
  startIso: string,
  endIso: string,
  locale: SupportedLocale = 'en',
) {
  switch (locale) {
    case 'es':
      return `Se espera el próximo periodo ${formatGrammaticalExpectedRange(startIso, endIso, locale)}`;
    case 'de':
      return `Die nächste Periode wird ${formatGrammaticalExpectedRange(startIso, endIso, locale)} erwartet`;
    case 'fr':
      return `Les prochaines règles sont attendues ${formatGrammaticalExpectedRange(startIso, endIso, locale)}`;
  }

  const rangeLabel = formatPredictionRangeLabel(startIso, endIso, locale);

  switch (locale) {
    case 'ja':
      return `次の生理は ${rangeLabel} 頃の予定です`;
    case 'zh-Hans':
      return `下次月经预计为 ${rangeLabel}`;
    case 'pt':
      return `A próxima menstruação é esperada de ${rangeLabel}`;
    case 'ru':
      return `Следующие месячные ожидаются ${rangeLabel}`;
    default:
      return `Next period expected ${rangeLabel}`;
  }
}

export function formatCurrentExpectedPeriodRangeLabel(
  startIso: string,
  endIso: string,
  locale: SupportedLocale = 'en',
) {
  const rangeLabel = formatPredictionRangeLabel(startIso, endIso, locale);

  switch (locale) {
    case 'es':
      return `Periodo esperado actual ${rangeLabel}`;
    case 'de':
      return `Aktuell erwartete Periode ${rangeLabel}`;
    case 'fr':
      return `Règles attendues en ce moment ${rangeLabel}`;
    case 'ja':
      return `現在予測される生理は ${rangeLabel} です`;
    case 'zh-Hans':
      return `当前预计月经为 ${rangeLabel}`;
    case 'pt':
      return `Menstruação esperada atual de ${rangeLabel}`;
    case 'ru':
      return `Текущие ожидаемые месячные ${rangeLabel}`;
    default:
      return `Current expected period ${rangeLabel}`;
  }
}

export function formatNextPeriodExpectedAroundLabel(
  dateLabel: string,
  locale: SupportedLocale = 'en',
) {
  switch (locale) {
    case 'es':
      return `Se espera el próximo periodo alrededor de ${dateLabel}`;
    case 'de':
      return `Die nächste Periode wird ungefähr am ${dateLabel} erwartet`;
    case 'fr':
      return `Les prochaines règles sont attendues autour du ${dateLabel}`;
    case 'ja':
      return `次の生理は ${dateLabel} 頃の予定です`;
    case 'zh-Hans':
      return `下次月经预计在 ${dateLabel} 左右`;
    case 'pt':
      return `A próxima menstruação é esperada por volta de ${dateLabel}`;
    case 'ru':
      return `Следующие месячные ожидаются примерно ${dateLabel}`;
    default:
      return `Next period expected around ${dateLabel}`;
  }
}

export function formatLoggedPeriodStartsLabel(
  periodStartsCount: number,
  locale: SupportedLocale = 'en',
) {
  switch (locale) {
    case 'es':
      return `${periodStartsCount} inicio${periodStartsCount === 1 ? '' : 's'} de periodo registrado${periodStartsCount === 1 ? '' : 's'}`;
    case 'de':
      return `${periodStartsCount} erfasste Periodenstarts`;
    case 'fr':
      return `${periodStartsCount} début${periodStartsCount === 1 ? '' : 's'} de règles enregistré${periodStartsCount === 1 ? '' : 's'}`;
    case 'ja':
      return `記録した生理開始は ${periodStartsCount} 件`;
    case 'zh-Hans':
      return `已记录 ${periodStartsCount} 次月经开始`;
    case 'pt':
      return `${periodStartsCount} início${periodStartsCount === 1 ? '' : 's'} de período registrados`;
    case 'ru':
      return `Записано ${periodStartsCount} ${russianPlural(periodStartsCount, { one: 'начало', few: 'начала', many: 'началов' })} месячных`;
    default:
      return `${periodStartsCount} logged period start${periodStartsCount === 1 ? '' : 's'}`;
  }
}

// LT-27: when the prediction is stale (`stale-history` on
// confidence.reasonCodes -- the same signal LT-04/LT-09 use), the calendar
// banner must not announce concrete dates ("Next period expected Jul 24 to
// 28") that the grid itself refuses to draw (LT-09 suppresses ALL
// predicted-period shading while stale). Announcing dates the grid won't
// shade is its own incoherence -- a user comparing the banner to the grid
// sees a claim with no visual backing. This is the single stale-banner
// string reused by both the "current expected period" and "next period"
// framings (buildCalendarScreenModel.ts's formatCalendarPredictionRangeLabel
// picks between them based on whether today falls inside the current
// cycle's window -- once stale, both collapse to this one honest,
// action-oriented message instead).
export function formatStalePredictionBannerLabel(locale: SupportedLocale = 'en') {
  switch (locale) {
    case 'es':
      return 'Registra tu último periodo para actualizar la estimación';
    case 'de':
      return 'Erfasse deine letzte Periode, um die Schätzung zu aktualisieren';
    case 'fr':
      return 'Enregistre tes dernières règles pour actualiser l’estimation';
    case 'ja':
      return '最新の生理を記録すると、この推定を更新できます';
    case 'zh-Hans':
      return '记录你最近一次月经以更新此估算';
    case 'pt':
      return 'Registe o seu último período para atualizar a estimativa';
    case 'ru':
      return 'Запишите последние месячные, чтобы обновить оценку';
    default:
      return 'Log your latest period to update this estimate';
  }
}

// LT-20: a bare "Jul 2" is ambiguous once a long-tenure user's timeline or
// history spans more than one calendar year -- two different entries a year
// apart render identically. Follows LT-08's convention (formatMonthDayLabel
// vs formatMonthDayYearLabel, chosen by a year-comparison, reusing the same
// Intl.DateTimeFormat machinery rather than hand-rolling year placement) but
// applied per-row against "is this entry's year the CURRENT year" instead of
// a start/end range comparison. Any row dated in a year other than
// `currentYearIso`'s year gets the explicit year suffix; current-year rows
// stay in the compact "Jul 2" form, matching existing short-history behavior
// exactly (no golden diffs for any surface where every row is still within
// the current year).
export function formatMonthDayLabelWithYearIfNotCurrent(
  isoDate: string,
  currentYearIso: string,
  locale: SupportedLocale = 'en',
) {
  const entryYear = getDateParts(isoDate).year;
  const currentYear = getDateParts(currentYearIso).year;

  return entryYear === currentYear
    ? formatMonthDayLabel(isoDate, locale)
    : formatMonthDayYearLabel(isoDate, locale);
}

/**
 * Resolves the localized display copy for a limitation code from the
 * `predictions.limitations.*` catalog
 * (`src/localization/messages/predictions.ts`). Codes are stable (see
 * `LimitationCode` in `src/types/domain.ts`); the catalog is exhaustive over
 * `limitationCodeValues`, so this is a direct lookup with no fallback
 * branch.
 */
export function formatPredictionLimitation(code: LimitationCode, locale: SupportedLocale = 'en') {
  return translate(locale, `predictions.limitations.${code}`);
}
