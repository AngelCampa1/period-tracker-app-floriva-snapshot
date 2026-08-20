import type {
  AppShellState,
  LimitationCode,
  PredictionSnapshot,
  SupportedLocale,
} from '@/src/types/domain';
import {
  defaultPrivacyPreference,
  defaultReminderPreferences,
  defaultUserProfile,
} from '@/src/db/domainDefaults';
import { formatPredictionLimitation } from '@/src/lib/predictions/presentation';

export {
  defaultPrivacyPreference,
  defaultReminderPreferences,
  defaultUserProfile,
};

const defaultAppShellState: AppShellState = {
  hasCompletedOnboarding: false,
  isLocked: false,
  billingAccessState: 'needs_purchase',
  mainAppReady: false,
  pendingEntryRoute: undefined,
};

export function createDefaultAppShellState(
  overrides: Partial<AppShellState> = {},
): AppShellState {
  return {
    ...defaultAppShellState,
    ...overrides,
  };
}

export function createDefaultPredictionSnapshot(
  locale: SupportedLocale = 'en',
): PredictionSnapshot {
  const localizedLabels = {
    en: {
      cycleDayLabel: 'Cycle day 12',
      fertileWindowLabel: 'Fertile window opens in 2 days',
      confidenceLabel: 'Building confidence from local history',
    },
    es: {
      cycleDayLabel: 'Día del ciclo 12',
      fertileWindowLabel: 'La ventana fértil se abre en 2 días',
      confidenceLabel: 'Ganando confianza a partir del historial local',
    },
    de: {
      cycleDayLabel: 'Zyklustag 12',
      fertileWindowLabel: 'Das fruchtbare Fenster öffnet sich in 2 Tagen',
      confidenceLabel: 'Mehr Zuversicht aus lokalem Verlauf',
    },
    fr: {
      cycleDayLabel: 'Jour 12 du cycle',
      fertileWindowLabel: 'La fenêtre fertile s’ouvre dans 2 jours',
      confidenceLabel: 'Confiance qui se construit à partir de l’historique local',
    },
    ja: {
      cycleDayLabel: '周期12日目',
      fertileWindowLabel: '排卵期は 2 日後に始まります',
      confidenceLabel: 'ローカル履歴から確信度を高めています',
    },
    'zh-Hans': {
      cycleDayLabel: '周期第12天',
      fertileWindowLabel: '易孕期将在 2 天后开始',
      confidenceLabel: '正在根据本地历史建立置信度',
    },
    pt: {
      cycleDayLabel: 'Dia do ciclo 12',
      fertileWindowLabel: 'A janela fértil abre em 2 dias',
      confidenceLabel: 'Construindo confiança a partir do histórico local',
    },
    ru: {
      cycleDayLabel: 'День цикла 12',
      fertileWindowLabel: 'Фертильное окно откроется через 2 дня',
      confidenceLabel: 'Уверенность растёт на основе локальной истории',
    },
  } as const;

  const labels = localizedLabels[locale];

  return {
    cycleDay: 12,
    cycleLengthDays: 28,
    periodLengthDays: 5,
    cycleDayLabel: labels.cycleDayLabel,
    nextPeriodStartIso: '2026-04-27',
    fertileWindowLabel: labels.fertileWindowLabel,
    // Matches cyclePhaseModel.ts's own default formula for a 28-day cycle
    // (cycleLengthDays - 19), so this placeholder snapshot's ribbon phases
    // look identical to what the default formula always produced pre-A4.
    fertileWindowStartOffsetDays: 9,
    fertileWindowCaption: locale === 'en' ? 'Window opens in 2 days.' : undefined,
    confidenceLevel: 'medium',
    confidenceLabel: labels.confidenceLabel,
    confidenceBasisLabel:
      locale === 'en' ? 'Based on 1 local signal' : labels.confidenceLabel,
    // Matches the 'medium' confidenceLevel above -- this placeholder
    // represents the onboarding-seed state (resolveConfidence's first
    // branch), so its reason code is 'onboarding-seed'.
    confidenceReasonCodes: ['onboarding-seed'],
    historyChipLabel: locale === 'en' ? 'New baseline' : undefined,
    // The two base limitation codes every prediction carries (see
    // BASE_LIMITATION_CODES in src/lib/predictions/confidence.ts), localized
    // through the same code-keyed formatter the live snapshot path uses --
    // this placeholder must never show English limitations to a non-en
    // locale.
    limitations: (['on-device', 'not-medical-certainty'] satisfies LimitationCode[]).map(
      (code) => formatPredictionLimitation(code, locale),
    ),
  };
}

export const defaultPredictionSnapshot = createDefaultPredictionSnapshot();
