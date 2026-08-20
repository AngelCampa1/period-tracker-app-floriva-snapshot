import type { SupportedLocale } from '@/src/types/domain';

/**
 * Per-locale banned medical/overclaiming terms for user-facing prediction
 * copy. Floriva never implies diagnosis, treatment, or medical certainty —
 * these patterns are the localized guard for that rule.
 *
 * Note the terms are deliberately narrower than "anything medical": copy is
 * allowed to say "not a medical measurement" (and does, in every locale), so
 * bare "medical"/"médica"/"医学" is NOT banned — only diagnosis/treatment/
 * guarantee/advice language is.
 *
 * B4 extended these lists with equivalents of "abnormal", "disorder",
 * "disease", and "risk of" for the anomaly-nudge copy guard (see
 * predictions.anomalies.* in src/localization/messages/predictions.ts and
 * tests/localization/predictionsMessages.test.ts) -- Floriva's anomaly
 * nudges describe an observation against the user's own range, never a
 * medical judgment.
 *
 * Shared by the predictions message-catalog and modal-builder tests.
 */
export const bannedMedicalTermsByLocale: Record<SupportedLocale, RegExp> = {
  en: /diagnos|medical advice|guarantee|\bcure\b|\btreat(?:ment)?\b|abnormal|disorder|disease|risk of/iu,
  es: /diagn[oó]s|consejo médico|garant[ií]|tratamiento|\bcurar?\b|anormal|trastorno|enfermedad|riesgo de/iu,
  de: /diagnos|medizinischer rat|ärztlicher rat|garantie|heilung|behandlung|abnormal|anormal|störung|krankheit|risiko (?:für|von)/iu,
  fr: /diagnost|avis médical|garanti|guérison|traitement|anormal|trouble|maladie|risque de/iu,
  ja: /診断|医療アドバイス|医学的助言|保証|治療|異常|障害|疾患|病気|リスク/u,
  'zh-Hans': /诊断|医疗建议|保证|治疗|异常|失调|疾病|风险/u,
  pt: /diagn[oó]st|conselho médico|garant|tratamento|\bcura\b|anormal|transtorno|doença|risco de/iu,
  ru: /диагно|медицинская консультация|медицинский совет|гарант|лечени|излечи|аномал|расстройств|заболевани|риск/iu,
};
