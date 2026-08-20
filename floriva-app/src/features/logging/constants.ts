import { translate } from '@/src/localization/translations';
import type {
  BleedingIntensity,
  BirthControlMethod,
  CervicalMucusValue,
  IudType,
  MoodValue,
  OvulationTestValue,
  SupportedLocale,
  SymptomKey,
} from '@/src/types/domain';

type Option<T> = {
  value: T;
  label: string;
};

export function getBleedingOptions(locale: SupportedLocale): Option<BleedingIntensity>[] {
  return [
    { value: 'none', label: translate(locale, 'logging.options.bleeding.none') },
    { value: 'spotting', label: translate(locale, 'logging.options.bleeding.spotting') },
    { value: 'light', label: translate(locale, 'logging.options.bleeding.light') },
    { value: 'medium', label: translate(locale, 'logging.options.bleeding.medium') },
    { value: 'heavy', label: translate(locale, 'logging.options.bleeding.heavy') },
  ];
}

export function getMoodOptions(locale: SupportedLocale): Option<MoodValue>[] {
  return [
    { value: 'steady', label: translate(locale, 'logging.options.mood.steady') },
    { value: 'low', label: translate(locale, 'logging.options.mood.low') },
    { value: 'sensitive', label: translate(locale, 'logging.options.mood.sensitive') },
    { value: 'energized', label: translate(locale, 'logging.options.mood.energized') },
  ];
}

export function getSymptomOptions(locale: SupportedLocale): Option<SymptomKey>[] {
  return [
    { value: 'cramps', label: translate(locale, 'logging.options.symptoms.cramps') },
    { value: 'headache', label: translate(locale, 'logging.options.symptoms.headache') },
    { value: 'bloating', label: translate(locale, 'logging.options.symptoms.bloating') },
    { value: 'fatigue', label: translate(locale, 'logging.options.symptoms.fatigue') },
    {
      value: 'breast-tenderness',
      label: translate(locale, 'logging.options.symptoms.breast-tenderness'),
    },
    { value: 'acne', label: translate(locale, 'logging.options.symptoms.acne') },
    { value: 'discharge', label: translate(locale, 'logging.options.symptoms.discharge') },
    {
      value: 'sleep-changes',
      label: translate(locale, 'logging.options.symptoms.sleep-changes'),
    },
    {
      value: 'libido-changes',
      label: translate(locale, 'logging.options.symptoms.libido-changes'),
    },
  ];
}

export function getBirthControlMethodOptions(
  locale: SupportedLocale,
): Option<BirthControlMethod>[] {
  return [
    { value: 'pill', label: translate(locale, 'logging.options.birthControlMethod.pill') },
    { value: 'iud', label: translate(locale, 'logging.options.birthControlMethod.iud') },
    {
      value: 'implant',
      label: translate(locale, 'logging.options.birthControlMethod.implant'),
    },
    { value: 'ring', label: translate(locale, 'logging.options.birthControlMethod.ring') },
    { value: 'patch', label: translate(locale, 'logging.options.birthControlMethod.patch') },
    { value: 'other', label: translate(locale, 'logging.options.birthControlMethod.other') },
  ];
}

export function getIudTypeOptions(locale: SupportedLocale): Option<IudType>[] {
  return [
    { value: 'hormonal', label: translate(locale, 'logging.options.iudType.hormonal') },
    { value: 'copper', label: translate(locale, 'logging.options.iudType.copper') },
  ];
}

export function getOvulationTestOptions(locale: SupportedLocale): Option<OvulationTestValue>[] {
  return [
    { value: 'negative', label: translate(locale, 'logging.options.ttc.negativeTest') },
    { value: 'positive', label: translate(locale, 'logging.options.ttc.positiveTest') },
    { value: 'peak', label: translate(locale, 'logging.options.ttc.peakTest') },
  ];
}

export function getCervicalMucusOptions(locale: SupportedLocale): Option<CervicalMucusValue>[] {
  return [
    { value: 'dry', label: translate(locale, 'logging.options.ttc.dry') },
    { value: 'sticky', label: translate(locale, 'logging.options.ttc.sticky') },
    { value: 'creamy', label: translate(locale, 'logging.options.ttc.creamy') },
    { value: 'egg-white', label: translate(locale, 'logging.options.ttc.eggWhite') },
  ];
}
