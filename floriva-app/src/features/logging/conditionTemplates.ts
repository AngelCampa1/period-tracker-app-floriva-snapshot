import { translate } from '@/src/localization/translations';
import type { TranslationKey } from '@/src/localization/translations';
import type { ConditionKey, SupportedLocale, SymptomKey } from '@/src/types/domain';

export type ConditionTemplateDefinition = {
  key: ConditionKey;
  title: string;
  highlightedSymptoms: SymptomKey[];
  loggingHint: string;
  insightsEmptyState: string;
};

const CONDITION_TEMPLATES = {
  pcos: {
    key: 'pcos',
    titleKey: 'logging.conditionTemplates.pcos.title',
    highlightedSymptoms: ['acne', 'bloating', 'fatigue', 'discharge'],
    loggingHintKey: 'logging.conditionTemplates.pcos.loggingHint',
    insightsEmptyStateKey: 'logging.conditionTemplates.pcos.insightsEmptyState',
  },
  pmdd: {
    key: 'pmdd',
    titleKey: 'logging.conditionTemplates.pmdd.title',
    highlightedSymptoms: ['sleep-changes', 'headache', 'cramps'],
    loggingHintKey: 'logging.conditionTemplates.pmdd.loggingHint',
    insightsEmptyStateKey: 'logging.conditionTemplates.pmdd.insightsEmptyState',
  },
  endometriosis: {
    key: 'endometriosis',
    titleKey: 'logging.conditionTemplates.endometriosis.title',
    highlightedSymptoms: ['cramps', 'fatigue', 'bloating'],
    loggingHintKey: 'logging.conditionTemplates.endometriosis.loggingHint',
    insightsEmptyStateKey: 'logging.conditionTemplates.endometriosis.insightsEmptyState',
  },
} as const satisfies Record<
  ConditionKey,
  {
    key: ConditionKey;
    titleKey: string;
    highlightedSymptoms: SymptomKey[];
    loggingHintKey: string;
    insightsEmptyStateKey: string;
  }
>;

export function buildConditionTemplateContext(
  conditionTags: ConditionKey[],
  locale: SupportedLocale,
) {
  const templates = conditionTags.map((conditionTag) => {
    const definition = CONDITION_TEMPLATES[conditionTag];

    return {
      key: definition.key,
      title: translate(locale, definition.titleKey as TranslationKey),
      highlightedSymptoms: definition.highlightedSymptoms,
      loggingHint: translate(locale, definition.loggingHintKey as TranslationKey),
      insightsEmptyState: translate(locale, definition.insightsEmptyStateKey as TranslationKey),
    } satisfies ConditionTemplateDefinition;
  });
  const highlightedSymptoms: SymptomKey[] = [];

  for (const template of templates) {
    for (const symptomKey of template.highlightedSymptoms) {
      if (!highlightedSymptoms.includes(symptomKey)) {
        highlightedSymptoms.push(symptomKey);
      }
    }
  }

  return {
    templates,
    highlightedSymptoms,
    loggingHints: templates.map((template) => template.loggingHint),
  };
}
