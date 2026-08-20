import { buildConditionTemplateContext } from '@/src/features/logging/conditionTemplates';
import { translate } from '@/src/localization/translations';

describe('buildConditionTemplateContext', () => {
  it('merges highlighted symptoms and helper copy in the stored condition order', () => {
    const context = buildConditionTemplateContext(['pmdd', 'endometriosis'], 'en');

    expect(context.highlightedSymptoms).toEqual([
      'sleep-changes',
      'headache',
      'cramps',
      'fatigue',
      'bloating',
    ]);
    expect(context.loggingHints).toEqual([
      translate('en', 'logging.conditionTemplates.pmdd.loggingHint'),
      translate('en', 'logging.conditionTemplates.endometriosis.loggingHint'),
    ]);
    expect(context.templates.map((template) => template.key)).toEqual([
      'pmdd',
      'endometriosis',
    ]);
  });

  it('returns empty defaults when no condition tags are active', () => {
    expect(buildConditionTemplateContext([], 'en')).toEqual({
      templates: [],
      highlightedSymptoms: [],
      loggingHints: [],
    });
  });
});
