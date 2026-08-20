import { buildConditionTemplateContext } from '@/src/features/logging/conditionTemplates';
import { getSymptomOptions } from '@/src/features/logging/constants';
import {
  buildTtcObservationSummary,
  hasEnabledTtcMode,
} from '@/src/features/ttc/summary';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import {
  computeCycleStatistics,
  MAX_INTERVAL_WINDOW,
  type CycleStatistics,
} from '@/src/lib/predictions/cycleStatistics';
import { attachImprovementActions } from '@/src/lib/predictions/confidencePresentation';
import { buildCyclePhaseBreakdown } from '@/src/lib/predictions/cyclePhaseModel';
import { collectPeriodStarts } from '@/src/lib/predictions/cycleHistory';
import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import { filterDismissedAnomalies } from '@/src/lib/predictions/anomalyPresentation';
import {
  formatFertileWindowLabel,
  formatLoggedPeriodStartsLabel,
  formatMonthDayLabel,
  formatNextPeriodExpectedAroundLabel,
  formatPredictionConfidenceLabel,
} from '@/src/lib/predictions/presentation';
import { translate } from '@/src/localization/translations';
import type { DailyLogEntry, SupportedLocale, UserProfile } from '@/src/types/domain';

import type {
  ConditionSummaryModel,
  InsightsScreenModel,
  MonthlyBriefingModel,
  TtcObservationHighlight,
  TtcSummaryModel,
} from '@/src/features/insights/types';
import type { ConditionTemplateDefinition } from '@/src/features/logging/conditionTemplates';

type BuildInsightsScreenModelOptions = {
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  locale: SupportedLocale;
  showFertilityEstimates?: boolean;
  /**
   * `AppPreferences.dismissedAnomalyIds`, threaded in by the caller (this
   * module stays pure -- it does not read preferences itself). Defaults to
   * empty so callers that haven't hydrated preferences yet still get a
   * valid model. See `filterDismissedAnomalies` (anomalyPresentation.ts).
   */
  dismissedAnomalyIds?: string[];
};

function buildFertileWindowStatus(
  todayIso: string,
  fertileWindow: {
    startDate: string;
    endDate: string;
  },
  locale: SupportedLocale,
) {
  return formatFertileWindowLabel(
    todayIso,
    fertileWindow.startDate,
    fertileWindow.endDate,
    locale,
  );
}

// LT-13: this used to be a private gap>1-day heuristic with no minimum
// cycle-separation guard, which could fabricate an extra "start" out of a
// single unlogged day inside one continuous period (disagreeing with the
// engine's own count on the same data — see the findings ledger). Insights
// now defers to `collectPeriodStarts` (cycleHistory.ts), the SAME canonical
// period-start detector the prediction engine and the Settings hub
// (LT-02) use, so all three surfaces report one consistent number for
// identical history. Kept as a local `string[]`-returning wrapper so the
// call sites below (which index/slice/measure by logDate) do not need to
// change.
function countPeriodStarts(logEntries: DailyLogEntry[]) {
  return collectPeriodStarts(logEntries).map((entry) => entry.logDate);
}

function formatTtcHighlightLabel(
  entry: DailyLogEntry,
  locale: SupportedLocale,
): TtcObservationHighlight[] {
  const highlights: TtcObservationHighlight[] = [];

  if (entry.ttcObservation?.ovulationTest) {
    const label =
      locale === 'es'
        ? entry.ttcObservation.ovulationTest === 'peak'
          ? 'Prueba de ovulación pico'
          : entry.ttcObservation.ovulationTest === 'positive'
            ? 'Prueba de ovulación positiva'
            : 'Prueba de ovulación negativa'
        : locale === 'de'
          ? entry.ttcObservation.ovulationTest === 'peak'
            ? 'Peak-Ovulationstest'
            : entry.ttcObservation.ovulationTest === 'positive'
              ? 'Positiver Ovulationstest'
              : 'Negativer Ovulationstest'
          : locale === 'fr'
            ? entry.ttcObservation.ovulationTest === 'peak'
              ? 'Test d’ovulation au pic'
              : entry.ttcObservation.ovulationTest === 'positive'
                ? 'Test d’ovulation positif'
                : 'Test d’ovulation négatif'
            : locale === 'ja'
              ? entry.ttcObservation.ovulationTest === 'peak'
                ? '排卵検査薬ピーク'
                : entry.ttcObservation.ovulationTest === 'positive'
                  ? '排卵検査薬陽性'
                  : '排卵検査薬陰性'
              : locale === 'zh-Hans'
                ? entry.ttcObservation.ovulationTest === 'peak'
                  ? '排卵试纸峰值'
                  : entry.ttcObservation.ovulationTest === 'positive'
                    ? '排卵试纸阳性'
                    : '排卵试纸阴性'
                : locale === 'pt'
                  ? entry.ttcObservation.ovulationTest === 'peak'
                    ? 'Teste de ovulação pico'
                    : entry.ttcObservation.ovulationTest === 'positive'
                      ? 'Teste de ovulação positivo'
                      : 'Teste de ovulação negativo'
                  : locale === 'ru'
                    ? entry.ttcObservation.ovulationTest === 'peak'
                      ? 'Пик теста на овуляцию'
                      : entry.ttcObservation.ovulationTest === 'positive'
                        ? 'Положительный тест на овуляцию'
                        : 'Отрицательный тест на овуляцию'
                    : entry.ttcObservation.ovulationTest === 'peak'
                      ? 'Peak ovulation test'
                      : entry.ttcObservation.ovulationTest === 'positive'
                        ? 'Positive ovulation test'
                        : 'Negative ovulation test';

    highlights.push({
      kind: 'ovulationTest',
      date: entry.logDate,
      label,
    });
  }

  if (entry.ttcObservation?.sexLogged) {
    highlights.push({
      kind: 'sex',
      date: entry.logDate,
      label:
        locale === 'es'
          ? 'Sexo registrado'
          : locale === 'de'
            ? 'Sex erfasst'
            : locale === 'fr'
              ? 'Rapport sexuel noté'
              : locale === 'ja'
                ? '性交を記録'
                : locale === 'zh-Hans'
                  ? '已记录性生活'
                  : locale === 'pt'
                    ? 'Sexo registrado'
                    : locale === 'ru'
                      ? 'Секс отмечен'
                      : 'Sex logged',
    });
  }

  if (entry.ttcObservation?.cervicalMucus) {
    const label =
      locale === 'es'
        ? entry.ttcObservation.cervicalMucus === 'egg-white'
          ? 'Moco cervical tipo clara de huevo'
          : entry.ttcObservation.cervicalMucus === 'creamy'
            ? 'Moco cervical cremoso'
            : entry.ttcObservation.cervicalMucus === 'sticky'
              ? 'Moco cervical pegajoso'
              : 'Moco cervical seco'
        : locale === 'de'
          ? entry.ttcObservation.cervicalMucus === 'egg-white'
            ? 'Eiweißartiger Zervixschleim'
            : entry.ttcObservation.cervicalMucus === 'creamy'
              ? 'Cremiger Zervixschleim'
              : entry.ttcObservation.cervicalMucus === 'sticky'
                ? 'Klebriger Zervixschleim'
                : 'Trockener Zervixschleim'
          : locale === 'fr'
            ? entry.ttcObservation.cervicalMucus === 'egg-white'
              ? "Glaire cervicale type blanc d'œuf"
              : entry.ttcObservation.cervicalMucus === 'creamy'
                ? 'Glaire cervicale crémeuse'
                : entry.ttcObservation.cervicalMucus === 'sticky'
                  ? 'Glaire cervicale collante'
                  : 'Glaire cervicale sèche'
            : locale === 'ja'
              ? entry.ttcObservation.cervicalMucus === 'egg-white'
                ? '頸管粘液 卵白状'
                : entry.ttcObservation.cervicalMucus === 'creamy'
                  ? '頸管粘液 クリーム状'
                  : entry.ttcObservation.cervicalMucus === 'sticky'
                    ? '頸管粘液 ねばつき'
                    : '頸管粘液 乾燥'
              : locale === 'zh-Hans'
                ? entry.ttcObservation.cervicalMucus === 'egg-white'
                  ? '宫颈黏液蛋清状'
                  : entry.ttcObservation.cervicalMucus === 'creamy'
                    ? '宫颈黏液乳霜状'
                    : entry.ttcObservation.cervicalMucus === 'sticky'
                      ? '宫颈黏液粘稠'
                      : '宫颈黏液干燥'
                : locale === 'pt'
                  ? entry.ttcObservation.cervicalMucus === 'egg-white'
                    ? 'Muco cervical tipo clara de ovo'
                    : entry.ttcObservation.cervicalMucus === 'creamy'
                      ? 'Muco cervical cremoso'
                      : entry.ttcObservation.cervicalMucus === 'sticky'
                        ? 'Muco cervical pegajoso'
                        : 'Muco cervical seco'
                  : locale === 'ru'
                    ? entry.ttcObservation.cervicalMucus === 'egg-white'
                      ? 'Цервикальная слизь как яичный белок'
                      : entry.ttcObservation.cervicalMucus === 'creamy'
                        ? 'Кремообразная цервикальная слизь'
                        : entry.ttcObservation.cervicalMucus === 'sticky'
                          ? 'Липкая цервикальная слизь'
                          : 'Сухая цервикальная слизь'
                    : entry.ttcObservation.cervicalMucus === 'egg-white'
                      ? 'Egg-white cervical mucus'
                      : entry.ttcObservation.cervicalMucus === 'creamy'
                        ? 'Creamy cervical mucus'
                        : entry.ttcObservation.cervicalMucus === 'sticky'
                          ? 'Sticky cervical mucus'
                          : 'Dry cervical mucus';

    highlights.push({
      kind: 'cervicalMucus',
      date: entry.logDate,
      label,
    });
  }

  // Number.isFinite (not `typeof === 'number'`) so a NaN/Infinity reading is
  // suppressed rather than rendered as the literal label "BBT NaN C".
  const basalBodyTemperatureCelsius = entry.ttcObservation?.basalBodyTemperatureCelsius;
  if (Number.isFinite(basalBodyTemperatureCelsius)) {
    const value = (basalBodyTemperatureCelsius as number).toFixed(2);
    highlights.push({
      kind: 'basalBodyTemperature',
      date: entry.logDate,
      label:
        locale === 'es'
          ? `BBT ${value} C`
          : locale === 'de'
            ? `BBT ${value} C`
            : locale === 'fr'
              ? `BBT ${value} C`
              : locale === 'ja'
                ? `BBT ${value} C`
                : locale === 'zh-Hans'
                  ? `BBT ${value} C`
                  : locale === 'pt'
                    ? `BBT ${value} C`
                    : locale === 'ru'
                      ? `BBT ${value} C`
                      : `BBT ${value} C`,
    });
  }

  return highlights;
}

// UL-14: highlights render inside the "Current fertile window" card,
// directly under the "Logged on X of Y fertile-window days" claim -- so they
// must come from the SAME window that claim counts. Before this fix they
// were simply the most recent observations from ANY date, which produced the
// ledger's self-contradiction: "Logged on 0 of 6 fertile-window days" above
// four cards of months-old logs (qa-rich-history). Out-of-window
// observations still surface, dated, in the separate "Recent TTC logs"
// section (buildRecentTtcLogSummaries below).
function buildTtcHighlights(
  logEntries: DailyLogEntry[],
  window: { startDate: string; endDate: string },
  locale: SupportedLocale,
) {
  return [...logEntries]
    .filter(
      (entry) => entry.logDate >= window.startDate && entry.logDate <= window.endDate,
    )
    .sort((left, right) => right.logDate.localeCompare(left.logDate))
    .flatMap((entry) => formatTtcHighlightLabel(entry, locale));
}

function buildRecentTtcLogSummaries(logEntries: DailyLogEntry[], locale: SupportedLocale) {
  return [...logEntries]
    .filter((entry) => entry.ttcObservation)
    .sort((left, right) => right.logDate.localeCompare(left.logDate))
    .slice(0, 3)
    .map((entry) => ({
      date: entry.logDate,
      summary: buildTtcObservationSummary({
        locale,
        observation: entry.ttcObservation,
      }),
    }));
}

function buildTtcSummary(
  todayIso: string,
  profile: UserProfile,
  logEntries: DailyLogEntry[],
  locale: SupportedLocale,
): TtcSummaryModel | undefined {
  if (!hasEnabledTtcMode(profile)) {
    return undefined;
  }

  const prediction = buildPredictionResult({
    todayIso,
    profile,
    logEntries,
  });
  const currentWindowLoggedDays = new Set(
    logEntries
      .filter(
        (entry) =>
          entry.logDate >= prediction.fertileWindow.startDate &&
          entry.logDate <= prediction.fertileWindow.endDate &&
          entry.ttcObservation &&
          (entry.ttcObservation.sexLogged ||
            entry.ttcObservation.ovulationTest ||
            entry.ttcObservation.cervicalMucus ||
            typeof entry.ttcObservation.basalBodyTemperatureCelsius === 'number'),
      )
      .map((entry) => entry.logDate),
  ).size;

  return {
    fertileWindowLabel: buildFertileWindowStatus(todayIso, prediction.fertileWindow, locale),
    currentWindowLoggedDays,
    currentWindowLengthDays:
      diffDays(prediction.fertileWindow.startDate, prediction.fertileWindow.endDate) + 1,
    latestHighlights: buildTtcHighlights(logEntries, prediction.fertileWindow, locale).slice(0, 4),
    recentLogSummaries: buildRecentTtcLogSummaries(logEntries, locale),
  };
}

function enrichConditionSummary(
  summary: Pick<ConditionSummaryModel, 'key' | 'title' | 'summary'>,
  template: ConditionTemplateDefinition,
  locale: SupportedLocale,
  recentConditionEntries: DailyLogEntry[],
): ConditionSummaryModel {
  const symptomLabels = new Map<string, string>(
    getSymptomOptions(locale).map((option) => [option.value, option.label]),
  );

  return {
    ...summary,
    emptyState: template.insightsEmptyState,
    loggingHint: template.loggingHint,
    recentLogCount: recentConditionEntries.length,
    trackedSymptomLabels: template.highlightedSymptoms.map(
      (symptomKey) => symptomLabels.get(symptomKey) ?? symptomKey,
    ),
  };
}

function buildPcosSummary(
  locale: SupportedLocale,
  logEntries: DailyLogEntry[],
): Pick<ConditionSummaryModel, 'key' | 'title' | 'summary'> {
  const periodStarts = countPeriodStarts(logEntries);
  const cycleIntervals =
    periodStarts.length >= 2
      ? periodStarts.slice(1).map((startDate, index) => diffDays(periodStarts[index]!, startDate))
      : [];
  const maxInterval = cycleIntervals.length > 0 ? Math.max(...cycleIntervals) : 0;
  const spottingCount = logEntries.filter((entry) => entry.bleeding === 'spotting').length;

  return {
    key: 'pcos',
    title: translate(locale, 'logging.conditionTemplates.pcos.title'),
    summary:
      cycleIntervals.length > 0
        ? locale === 'es'
          ? `Los inicios de ciclo recientes abarcan ${maxInterval} días y el manchado apareció en ${spottingCount} día${
              spottingCount === 1 ? '' : 's'
            } registrado${spottingCount === 1 ? '' : 's'} en los últimos 90 días.`
          : locale === 'de'
            ? `Die letzten Zyklusstarts erstrecken sich über ${maxInterval} Tage, und Schmierblutungen traten an ${spottingCount} erfassten Tag${spottingCount === 1 ? '' : 'en'} in den letzten 90 Tagen auf.`
            : locale === 'fr'
              ? `Les derniers débuts de cycle s’étalent sur ${maxInterval} jours et le spotting est apparu sur ${spottingCount} jour${spottingCount === 1 ? '' : 's'} enregistré${spottingCount === 1 ? '' : 's'} au cours des 90 derniers jours.`
              : locale === 'ja'
                ? `最近の周期開始は ${maxInterval} 日にわたり、過去 90 日間でスポッティングは ${spottingCount} 日に記録されました。`
                : locale === 'zh-Hans'
                  ? `最近的周期开始跨度为 ${maxInterval} 天，点滴出血在最近 90 天内记录了 ${spottingCount} 天。`
                  : locale === 'pt'
                    ? `Os inícios de ciclo recentes abrangem ${maxInterval} dias, e o escape apareceu em ${spottingCount} dia${
                        spottingCount === 1 ? '' : 's'
                      } registrado${spottingCount === 1 ? '' : 's'} nos últimos 90 dias.`
                    : locale === 'ru'
                      ? `Недавние начала циклов охватывают ${maxInterval} дней, а мажущие выделения появлялись в ${spottingCount} отмеченн${spottingCount === 1 ? 'ый' : 'ых'} д${spottingCount === 1 ? 'ень' : spottingCount < 5 ? 'ня' : 'ней'} за последние 90 дней.`
                      : `Recent cycle starts span ${maxInterval} days, and spotting appeared on ${spottingCount} logged day${
                          spottingCount === 1 ? '' : 's'
                        } in the last 90 days.`
        : locale === 'es'
          ? `El manchado apareció en ${spottingCount} día${
              spottingCount === 1 ? '' : 's'
            } registrado${spottingCount === 1 ? '' : 's'} en los últimos 90 días, y Floriva afinará el resumen de variabilidad a medida que se registren más ciclos.`
          : locale === 'de'
            ? `Schmierblutungen traten an ${spottingCount} erfassten Tag${spottingCount === 1 ? '' : 'en'} in den letzten 90 Tagen auf, und Floriva verfeinert die Variabilitätszusammenfassungen mit mehr erfassten Zyklen.`
            : locale === 'fr'
              ? `Le spotting est apparu sur ${spottingCount} jour${spottingCount === 1 ? '' : 's'} enregistré${spottingCount === 1 ? '' : 's'} au cours des 90 derniers jours, et Floriva affinera les résumés de variabilité à mesure que d’autres cycles seront enregistrés.`
              : locale === 'ja'
                ? `過去 90 日間でスポッティングは ${spottingCount} 日に記録されました。さらに周期を記録すると、ばらつきの要約がより明確になります。`
                : locale === 'zh-Hans'
                  ? `点滴出血在最近 90 天内记录了 ${spottingCount} 天，随着更多周期被记录，Floriva 会进一步细化波动摘要。`
                  : locale === 'pt'
                    ? `O escape apareceu em ${spottingCount} dia${
                        spottingCount === 1 ? '' : 's'
                      } registrado${spottingCount === 1 ? '' : 's'} nos últimos 90 dias, e o Floriva vai refinar os resumos de variabilidade conforme mais ciclos forem registrados.`
                    : locale === 'ru'
                      ? `Мажущие выделения появлялись в ${spottingCount} отмеченн${spottingCount === 1 ? 'ый' : 'ых'} д${spottingCount === 1 ? 'ень' : spottingCount < 5 ? 'ня' : 'ней'} за последние 90 дней, и Floriva будет точнее сводить вариативность по мере записи новых циклов.`
                      : `Spotting appeared on ${spottingCount} logged day${spottingCount === 1 ? '' : 's'} in the last 90 days, and Floriva will sharpen variability summaries as more cycles are logged.`,
  };
}

function buildPmddSummary(
  locale: SupportedLocale,
  logEntries: DailyLogEntry[],
): Pick<ConditionSummaryModel, 'key' | 'title' | 'summary'> {
  const periodStarts = countPeriodStarts(logEntries);
  const lastPeriodStart = periodStarts[periodStarts.length - 1];
  const windowEntries = lastPeriodStart
    ? logEntries.filter((entry) => {
        const daysBefore = diffDays(entry.logDate, lastPeriodStart);

        return daysBefore >= 1 && daysBefore <= 7;
      })
    : [];
  const moodShiftDays = windowEntries.filter(
    (entry) => entry.mood === 'low' || entry.mood === 'sensitive',
  ).length;
  const symptomDays = windowEntries.filter((entry) => entry.symptoms.length > 0).length;

  return {
    key: 'pmdd',
    title: translate(locale, 'logging.conditionTemplates.pmdd.title'),
    summary:
      locale === 'es'
        ? `En los 7 días antes del último periodo registrado, los cambios de ánimo aparecieron en ${moodShiftDays} día${
            moodShiftDays === 1 ? '' : 's'
          } y los síntomas relacionados en ${symptomDays} día${symptomDays === 1 ? '' : 's'}.`
        : locale === 'de'
          ? `In den 7 Tagen vor der letzten erfassten Periode traten Stimmungsschwankungen an ${moodShiftDays} Tag${
              moodShiftDays === 1 ? '' : 'en'
            } und verwandte Symptome an ${symptomDays} Tag${symptomDays === 1 ? '' : 'en'} auf.`
          : locale === 'fr'
            ? `Dans les 7 jours précédant les dernières règles enregistrées, les variations d’humeur sont apparues sur ${moodShiftDays} jour${moodShiftDays === 1 ? '' : 's'} et les symptômes associés sur ${symptomDays} jour${symptomDays === 1 ? '' : 's'}.`
            : locale === 'ja'
              ? `最後に記録した生理の前 7 日間で、気分の変化は ${moodShiftDays} 日、関連する症状は ${symptomDays} 日に見られました。`
              : locale === 'zh-Hans'
                ? `在最近一次记录月经前的 7 天里，情绪变化出现在 ${moodShiftDays} 天，相关症状出现在 ${symptomDays} 天。`
                : locale === 'pt'
                  ? `Nos 7 dias antes do último período registrado, mudanças de humor apareceram em ${moodShiftDays} dia${
                      moodShiftDays === 1 ? '' : 's'
                    } e sintomas relacionados em ${symptomDays} dia${symptomDays === 1 ? '' : 's'}.`
                  : locale === 'ru'
                    ? `В течение 7 дней перед последними зарегистрированными месячными перепады настроения проявились в ${moodShiftDays} д${moodShiftDays === 1 ? 'ень' : moodShiftDays < 5 ? 'ня' : 'ней'}, а связанные симптомы в ${symptomDays} д${symptomDays === 1 ? 'ень' : symptomDays < 5 ? 'ня' : 'ней'}.`
                    : `In the 7 days before the last logged period, mood shifts appeared on ${moodShiftDays} day${moodShiftDays === 1 ? '' : 's'} and related symptoms on ${symptomDays} day${symptomDays === 1 ? '' : 's'}.`,
  };
}

function buildEndometriosisSummary(
  locale: SupportedLocale,
  logEntries: DailyLogEntry[],
): Pick<ConditionSummaryModel, 'key' | 'title' | 'summary'> {
  const crampDays = logEntries.filter((entry) => entry.symptoms.includes('cramps')).length;
  const heavyBleedingDays = logEntries.filter((entry) => entry.bleeding === 'heavy').length;

  return {
    key: 'endometriosis',
    title: translate(locale, 'logging.conditionTemplates.endometriosis.title'),
    summary:
      locale === 'es'
        ? `Los cólicos aparecieron en ${crampDays} día${crampDays === 1 ? '' : 's'} registrado${crampDays === 1 ? '' : 's'} y el sangrado abundante en ${heavyBleedingDays} día${heavyBleedingDays === 1 ? '' : 's'} durante los últimos 90 días.`
        : locale === 'de'
          ? `Krämpfe traten an ${crampDays} erfassten Tag${crampDays === 1 ? '' : 'en'} auf und starke Blutungen an ${heavyBleedingDays} Tag${heavyBleedingDays === 1 ? '' : 'en'} in den letzten 90 Tagen.`
          : locale === 'fr'
            ? `Des crampes sont apparues sur ${crampDays} jour${crampDays === 1 ? '' : 's'} enregistré${crampDays === 1 ? '' : 's'} et des saignements abondants sur ${heavyBleedingDays} jour${heavyBleedingDays === 1 ? '' : 's'} au cours des 90 derniers jours.`
            : locale === 'ja'
              ? `過去 90 日間で、けいれんは ${crampDays} 日に、出血が多い日は ${heavyBleedingDays} 日に見られました。`
              : locale === 'zh-Hans'
                ? `在最近 90 天内，痉挛出现在 ${crampDays} 天，重度出血出现在 ${heavyBleedingDays} 天。`
                : locale === 'pt'
                  ? `Cólicas apareceram em ${crampDays} dia${crampDays === 1 ? '' : 's'} registrado${crampDays === 1 ? '' : 's'} e sangramento intenso em ${heavyBleedingDays} dia${heavyBleedingDays === 1 ? '' : 's'} nos últimos 90 dias.`
                  : locale === 'ru'
                    ? `Спазмы появлялись в ${crampDays} д${crampDays === 1 ? 'ень' : crampDays < 5 ? 'ня' : 'ней'} за последние 90 дней, а сильное кровотечение в ${heavyBleedingDays} д${heavyBleedingDays === 1 ? 'ень' : heavyBleedingDays < 5 ? 'ня' : 'ней'}.`
                    : `Cramps appeared on ${crampDays} logged day${crampDays === 1 ? '' : 's'} and heavy bleeding on ${heavyBleedingDays} day${heavyBleedingDays === 1 ? '' : 's'} in the last 90 days.`,
  };
}

function buildConditionSummaries(
  profile: UserProfile,
  todayIso: string,
  logEntries: DailyLogEntry[],
  locale: SupportedLocale,
): ConditionSummaryModel[] {
  const recentConditionEntries = logEntries.filter(
    (entry) => entry.logDate >= addDays(todayIso, -89) && entry.logDate <= todayIso,
  );

  return buildConditionTemplateContext(profile.conditionTags, locale).templates.map((template) => {
    const summary = (() => {
      switch (template.key) {
      case 'pcos':
        return buildPcosSummary(locale, recentConditionEntries);
      case 'pmdd':
        return buildPmddSummary(locale, logEntries);
      case 'endometriosis':
        return buildEndometriosisSummary(locale, recentConditionEntries);
      }
    })();

    return enrichConditionSummary(summary, template, locale, recentConditionEntries);
  });
}

// LT-18 thresholds, re-based (UL-02) on the RAW pre-rejection MAD spread
// (`CycleStatistics.rawSpreadDays`, cycleStatistics.ts). Documented here
// (not just on the type) since these are the numbers a reviewer would need
// to change:
//   - rawSpreadDays <= 2  -> 'consistent' (matches the card's historical
//     "+/- 2 days" claim -- only shown when it is actually true)
//   - rawSpreadDays <= 6  -> 'somewhat-variable'
//   - rawSpreadDays > 6   -> 'varies-widely'
// UL-02 root cause: LT-18 originally classified on the SURVIVOR spread
// (statistics.spreadDays) -- the spread AFTER MAD outlier rejection. On the
// tenure-12mo-irregular sweep capture, rejection discarded the 38/45/64-day
// intervals as "outliers", the surviving 21-31 cluster spread rounded to
// "+/- 1", and a user whose recent cycles visibly ranged 21-64 days was
// told "Consistent on average ... treating your cycle as regular" (P0).
// Rejection is correct for the prediction-window estimate; it is exactly
// wrong for a consistency claim about the observed history. Two changes:
//   1. Classify on rawSpreadDays (median-based, so ONE anomalous lapse in a
//      steady history still reads consistent -- calm copy preserved).
//   2. Escalate to 'varies-widely' when the MAD step rejected >= 2 of the
//      bounds-plausible intervals AND they are >= 1/3 of that set: when a
//      third of recent cycles are "outliers", the outliers are the pattern.
//      ('varies-widely' copy deliberately cites no +/- number, so no
//      misleading tight spread can be quoted alongside it.)
// A sample of 0 or 1 surviving interval cannot support ANY consistency
// claim (there is nothing to compare), so it is always 'not-enough-data'.
const CONSISTENT_SPREAD_DAYS_MAX = 2;
const SOMEWHAT_VARIABLE_SPREAD_DAYS_MAX = 6;
const VARIES_WIDELY_MIN_OUTLIERS = 2;
const VARIES_WIDELY_OUTLIER_SHARE = 1 / 3;

function resolveCycleLengthConsistencyLevel(
  statistics: CycleStatistics | undefined,
): import('./types').CycleLengthConsistencyLevel {
  if (!statistics || statistics.sampleSize < 2) {
    return 'not-enough-data';
  }

  const outlierShareIsIrregular =
    statistics.madOutlierCount >= VARIES_WIDELY_MIN_OUTLIERS &&
    statistics.boundsSampleSize > 0 &&
    statistics.madOutlierCount / statistics.boundsSampleSize >= VARIES_WIDELY_OUTLIER_SHARE;

  if (outlierShareIsIrregular || statistics.rawSpreadDays > SOMEWHAT_VARIABLE_SPREAD_DAYS_MAX) {
    return 'varies-widely';
  }

  if (statistics.rawSpreadDays <= CONSISTENT_SPREAD_DAYS_MAX) {
    return 'consistent';
  }

  return 'somewhat-variable';
}

// LT-18: resolves the pre-localized subtitle/footnote pair for a
// consistency level from the `insights.cycleLength.*` catalog
// (src/localization/messages/insights.ts). `spreadDays` (UL-02: now the RAW
// pre-rejection spread) is only interpolated into the two "variable"
// footnotes -- 'not-enough-data' has no number to cite and 'varies-widely'
// deliberately cites none.
function resolveCycleLengthCopy(
  level: import('./types').CycleLengthConsistencyLevel,
  spreadDays: number,
  locale: SupportedLocale,
): { subtitleLabel: string; footnoteLabel: string } {
  const roundedSpreadDays = Math.round(spreadDays);

  switch (level) {
    case 'consistent': {
      // UL-02: floor at 1 -- "Within about +/- 0 days" (seen live on
      // tenure-12mo-regular) is a nonsense claim; "within about +/- 1 day"
      // stays true for any sub-day spread. Exactly 1 uses the dedicated
      // singular catalog string ("+/- 1 days" was the ledger's
      // pluralization defect).
      const flooredDays = Math.max(1, roundedSpreadDays);

      return {
        subtitleLabel: translate(locale, 'insights.cycleLength.subtitleConsistent'),
        footnoteLabel:
          flooredDays === 1
            ? translate(locale, 'insights.cycleLength.footnoteConsistentOne')
            : translate(locale, 'insights.cycleLength.footnoteConsistent', {
                days: flooredDays,
              }),
      };
    }
    case 'somewhat-variable':
      return {
        subtitleLabel: translate(locale, 'insights.cycleLength.subtitleSomewhatVariable'),
        footnoteLabel: translate(locale, 'insights.cycleLength.footnoteSomewhatVariable', {
          days: roundedSpreadDays,
        }),
      };
    case 'varies-widely':
      return {
        subtitleLabel: translate(locale, 'insights.cycleLength.subtitleVariesWidely'),
        footnoteLabel: translate(locale, 'insights.cycleLength.footnoteVariesWidely'),
      };
    case 'not-enough-data':
      return {
        subtitleLabel: translate(locale, 'insights.cycleLength.subtitleNotEnoughData'),
        footnoteLabel: translate(locale, 'insights.cycleLength.footnoteNotEnoughData'),
      };
  }
}

function buildCycleLengthData(
  periodStarts: string[],
  prediction: ReturnType<typeof buildPredictionResult>,
  locale: SupportedLocale,
): import('./types').CycleLengthData {
  // Bars: raw per-interval history, kept UNFILTERED on purpose -- each bar
  // is independently labeled with its own day count, so showing the true
  // observed range (including an interval the engine's statistics later
  // discard as an outlier) is honest, not misleading. See CycleLengthData's
  // doc comment.
  const cycleIntervals = periodStarts
    .slice(1)
    .map((start, index) => diffDays(periodStarts[index]!, start));
  // UL-36: the chart used to slice an arbitrary LAST NINE intervals while
  // the subtitle/footnote classification and avgDays below were computed
  // over the engine's 12-interval statistics window -- a third,
  // unexplained history-size claim ("What your last nine cycles say")
  // alongside Today/Settings' total-starts counts. The chart now shows the
  // SAME window the statistics classify (MAX_INTERVAL_WINDOW, shared with
  // computeCycleStatistics), so the headline count, the bars, and the
  // classification all describe one window.
  const chartIntervals = cycleIntervals.slice(-MAX_INTERVAL_WINDOW);

  // LT-18/LT-21: avgDays is now ALWAYS prediction.cycleLengthDays -- the
  // same robust, outlier-rejected estimate the phase-rhythm card (below)
  // derives its phase durations from, and the same number
  // `resolveCycleLengthConsistencyLevel` above classifies. Previously this
  // recomputed a naive mean of the last 9 RAW intervals, which (a) silently
  // averaged in bounds/MAD-discarded intervals (e.g. a multi-month gap
  // reads as "60 AVG" instead of the engine's outlier-rejected estimate),
  // and (b) disagreed with the phase-rhythm card's number, so the phase
  // durations printed below it did not sum to the displayed average.
  const avgDays = prediction.cycleLengthDays;
  // UL-02: classification statistics are computed here from the SAME
  // canonical intervals (collectPeriodStarts -> diffDays) the engine feeds
  // computeCycleStatistics via resolveCycleLengthDays, because the fields
  // the classifier needs (rawSpreadDays/madOutlierCount) are part of the
  // full CycleStatistics, while PredictionResult.statistics is deliberately
  // a 3-field summary (see nextPeriodWindow.ts's field-explicit contract).
  // Same inputs + same pure function = the same numbers the engine saw.
  const classificationStatistics: CycleStatistics | undefined =
    cycleIntervals.length > 0 ? computeCycleStatistics(cycleIntervals) : undefined;
  const consistencyLevel = resolveCycleLengthConsistencyLevel(classificationStatistics);
  const { subtitleLabel, footnoteLabel } = resolveCycleLengthCopy(
    consistencyLevel,
    classificationStatistics?.rawSpreadDays ?? 0,
    locale,
  );

  return {
    avgDays,
    bars: chartIntervals.map((days, index) => ({
      days,
      isLatest: index === chartIntervals.length - 1,
    })),
    hasObservedHistory: cycleIntervals.length > 0,
    consistencyLevel,
    subtitleLabel,
    footnoteLabel,
  };
}

function buildPhaseRhythmData(
  prediction: ReturnType<typeof buildPredictionResult>,
  profile: UserProfile,
): import('./types').PhaseRhythmData {
  // Decompose the cycle through the shared phase model so the Insights chart and
  // the Today phase ribbon never disagree about the same cycle. We feed the live
  // prediction's fertile-window start offset so the split tracks the real estimate.
  return buildCyclePhaseBreakdown({
    cycleLengthDays: prediction.cycleLengthDays,
    periodLengthDays: profile.periodLengthDays ?? 5,
    fertileWindowStartOffsetDays: diffDays(
      prediction.current.cycleStartDate,
      prediction.fertileWindow.startDate,
    ),
  });
}

function buildMonthlyBriefing(
  todayIso: string,
  profile: UserProfile,
  logEntries: DailyLogEntry[],
  locale: SupportedLocale,
): MonthlyBriefingModel {
  const currentMonthPrefix = todayIso.slice(0, 7);
  const currentMonthLogs = logEntries.filter(
    (entry) => entry.logDate.startsWith(currentMonthPrefix) && entry.logDate <= todayIso,
  );
  const latestLoggedMonthPrefix = [...logEntries]
    .filter((entry) => entry.logDate <= todayIso)
    .sort((left, right) => right.logDate.localeCompare(left.logDate))[0]
    ?.logDate.slice(0, 7);
  const briefingMonthPrefix =
    currentMonthLogs.length > 0 ? currentMonthPrefix : latestLoggedMonthPrefix ?? currentMonthPrefix;
  // LT-22: "so far" only makes sense while the briefing month is STILL
  // happening. `briefingMonthPrefix` falls back to the latest LOGGED month
  // when the current month has no logs (e.g. a lapsed user, or a user whose
  // most recent entry predates this month) -- that fallback month is
  // already fully in the past, so a "so far" suffix on it is false: it
  // implies the month is still in progress and more logs may still land in
  // it this month, when in fact it ended.
  const isBriefingForCurrentMonth = briefingMonthPrefix === currentMonthPrefix;
  const monthStart = `${briefingMonthPrefix}-01`;
  const monthLogs = logEntries.filter(
    (entry) => entry.logDate.startsWith(briefingMonthPrefix) && entry.logDate <= todayIso,
  );
  const periodDays = monthLogs.filter(
    (entry) =>
      entry.bleeding === 'light' || entry.bleeding === 'medium' || entry.bleeding === 'heavy',
  ).length;
  const symptomDays = monthLogs.filter((entry) => entry.symptoms.length > 0).length;
  const symptomLabels = new Map<string, string>(
    getSymptomOptions(locale).map((option) => [option.value, option.label]),
  );
  const signalCounts = monthLogs
    .flatMap((entry) => entry.symptoms)
    .reduce<Map<string, number>>((counts, symptom) => {
      counts.set(symptom, (counts.get(symptom) ?? 0) + 1);

      return counts;
    }, new Map());
  const topSignals = [...signalCounts.entries()]
    .sort((left, right) => {
      const countDelta = right[1] - left[1];

      if (countDelta !== 0) {
        return countDelta;
      }

      return (symptomLabels.get(left[0]) ?? left[0]).localeCompare(
        symptomLabels.get(right[0]) ?? right[0],
      );
    })
    .slice(0, 3)
    .map(([symptom]) => symptomLabels.get(symptom) ?? symptom);
  const ttcDayCount = hasEnabledTtcMode(profile)
    ? monthLogs.filter((entry) => entry.ttcObservation).length
    : 0;
  const birthControlDayCount = profile.birthControlMethod
    ? monthLogs.filter((entry) => entry.birthControlEvent).length
    : 0;
  const hasImportedHistory = monthLogs.some((entry) => entry.importSessionId);
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${monthStart}T00:00:00.000Z`));
  const titleMonth = locale === 'en'
    ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
    : monthName;
  const periodDaysLabel =
    locale === 'en' && periodDays === 1
      ? '1 period day'
      : translate(locale, 'insights.monthlyBriefing.periodDaysLabel', { count: periodDays });
  const symptomDaysLabel =
    locale === 'en' && symptomDays === 1
      ? '1 symptom day'
      : translate(locale, 'insights.monthlyBriefing.symptomDaysLabel', { count: symptomDays });
  // LT-22: definitions, made coherent and documented here so the lead
  // sentence and the chips below it always agree:
  //   - "N local logs reviewed" (subtitle) = monthLogs.length -- every
  //     distinct daily-log row in the briefing month, regardless of content.
  //   - "period days" = rows with bleeding evidence (periodDays above).
  //   - "symptom days" = rows with >= 1 symptom logged (symptomDays above).
  //     A single row can be BOTH a period day and a symptom day (e.g. a
  //     bleeding day with cramps logged), so periodDays + symptomDays can
  //     legitimately exceed monthLogs.length without being wrong -- but the
  //     LEAD sentence must cite the SAME symptomDays number the chip below
  //     it shows, not a different metric under a similar-sounding name.
  //   - "tracked signals" (previously signalCounts.size, the count of
  //     DISTINCT SYMPTOM TYPES seen anywhere in the month) is a different
  //     unit from "symptom days" (a count of DAYS) and could exceed the
  //     total log count for the month (e.g. "6 logs / 10 tracked signals"),
  //     which reads as an internal contradiction even though both numbers
  //     were individually correct. The lead sentence now cites symptomDays
  //     instead, so it always agrees with the symptomDaysLabel chip;
  //     distinct symptom TYPES are still surfaced, unambiguously, as
  //     topSignalsLabel's named list ("Cramps, Headache", not a count).
  const lead =
    monthLogs.length === 0
      ? translate(locale, 'insights.monthlyBriefing.noLogsLead')
      : locale === 'en'
        ? isBriefingForCurrentMonth
          ? `${titleMonth} shows ${periodDays} period day${periodDays === 1 ? '' : 's'} and ${symptomDays} symptom day${symptomDays === 1 ? '' : 's'} so far.`
          : `${titleMonth} showed ${periodDays} period day${periodDays === 1 ? '' : 's'} and ${symptomDays} symptom day${symptomDays === 1 ? '' : 's'}.`
        : translate(
            locale,
            isBriefingForCurrentMonth
              ? 'insights.monthlyBriefing.lead'
              : 'insights.monthlyBriefing.leadPastMonth',
            {
              month: titleMonth,
              periodDays,
              symptomDays,
            },
          );
  const conditionLabels = profile.conditionTags.map((condition) =>
    translate(locale, `logging.conditionTemplates.${condition}.title`),
  );
  const sourceLabels = [
    hasImportedHistory
      ? translate(locale, 'insights.monthlyBriefing.sourceImported')
      : null,
    ttcDayCount > 0
      ? locale === 'en' && ttcDayCount === 1
        ? 'TTC details logged on 1 day'
        : translate(locale, 'insights.monthlyBriefing.sourceTtcDays', { count: ttcDayCount })
      : null,
    birthControlDayCount > 0
      ? locale === 'en' && birthControlDayCount === 1
        ? 'Birth-control details logged on 1 day'
        : translate(locale, 'insights.monthlyBriefing.sourceBirthControlDays', {
            count: birthControlDayCount,
          })
      : null,
    conditionLabels.length > 0
      ? translate(locale, 'insights.monthlyBriefing.sourceConditionFocus', {
          conditions: conditionLabels.join(', '),
        })
      : null,
  ].filter((label): label is string => Boolean(label));

  return {
    title: translate(locale, 'insights.monthlyBriefing.title', { month: titleMonth }),
    subtitle:
      locale === 'en' && monthLogs.length === 1
        ? '1 local log reviewed'
        : translate(locale, 'insights.monthlyBriefing.subtitle', {
            count: monthLogs.length,
          }),
    lead,
    periodDaysCount: periodDays,
    symptomDaysCount: symptomDays,
    periodDaysLabel,
    symptomDaysLabel,
    hasTopSignals: topSignals.length > 0,
    topSignalsLabel:
      topSignals.length > 0
        ? topSignals.join(', ')
        : translate(locale, 'insights.monthlyBriefing.noSignalsLabel'),
    sourceLabels,
    emptyState: translate(locale, 'insights.monthlyBriefing.emptyState'),
  };
}

export function buildInsightsScreenModel({
  todayIso,
  profile,
  logEntries,
  locale,
  showFertilityEstimates = true,
  dismissedAnomalyIds = [],
}: BuildInsightsScreenModelOptions): InsightsScreenModel {
  const prediction = buildPredictionResult({
    todayIso,
    profile,
    logEntries,
  });
  const periodStarts = countPeriodStarts(logEntries);
  const improvements = attachImprovementActions(
    prediction.confidence.improvementCodes ?? [],
    todayIso,
  );
  // B5: Insights "Observations" is a quiet, complete record -- ALL
  // non-dismissed anomalies, not just the head Today shows (contrast with
  // buildTodaySnapshot.ts, which takes only filterDismissedAnomalies(...)[0]).
  const observations = filterDismissedAnomalies(
    prediction.anomalies ?? [],
    dismissedAnomalyIds,
  );

  const cycleLengthData = buildCycleLengthData(periodStarts, prediction, locale);
  // UL-88: when there are no discrete anomalies, the Observations all-clear
  // line must not claim "nothing unusual" while the cycle-length card on the
  // same screen reads "Varies widely" — that contradiction was the
  // tenure-12mo-irregular Phase-4 defect. Escalate ONLY on varies-widely;
  // 'somewhat-variable' and calmer tiers keep the reassuring line.
  const observationsAllClear: 'calm' | 'varies-widely' =
    cycleLengthData.consistencyLevel === 'varies-widely' ? 'varies-widely' : 'calm';

  return {
    cyclePattern: {
      title: translate(locale, 'insights.cyclePattern.title'),
      periodStartsLabel: formatLoggedPeriodStartsLabel(periodStarts.length, locale),
      nextPeriodLabel: formatNextPeriodExpectedAroundLabel(
        formatMonthDayLabel(prediction.nextPeriod.startDate, locale),
        locale,
      ),
      confidenceLevel: prediction.confidence.level,
      confidenceLabel: formatPredictionConfidenceLabel(prediction.confidence.level, locale),
      confidenceReasonCodes: prediction.confidence.reasonCodes,
    },
    cycleLengthData,
    phaseRhythmData: buildPhaseRhythmData(prediction, profile),
    showFertilityEstimates,
    ttcSummary: buildTtcSummary(todayIso, profile, logEntries, locale),
    conditionSummaries: buildConditionSummaries(profile, todayIso, logEntries, locale),
    monthlyBriefing: buildMonthlyBriefing(todayIso, profile, logEntries, locale),
    observationsAllClear,
    ...(improvements.length > 0 ? { improvements } : {}),
    ...(observations.length > 0 ? { observations } : {}),
  };
}
