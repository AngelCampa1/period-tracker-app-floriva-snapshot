import { translate } from '@/src/localization/translations';
import type {
  SupportedLocale,
  TtcObservation,
  TtcTrackingPreferences,
  UserProfile,
} from '@/src/types/domain';

type TtcObservationSummaryInput = {
  observation?: TtcObservation;
  locale: SupportedLocale;
  emptyLabel?: string;
};

type TtcTrackingPreviewInput = {
  preferences?: TtcTrackingPreferences;
  locale: SupportedLocale;
  emptyLabel?: string;
};

export function hasEnabledTtcTracking(preferences?: TtcTrackingPreferences) {
  return Boolean(
    preferences &&
      (preferences.sex ||
        preferences.ovulationTest ||
        preferences.cervicalMucus ||
        preferences.basalBodyTemperature),
  );
}

export function hasEnabledTtcMode(
  profile?: Pick<UserProfile, 'goals' | 'ttcTrackingPreferences'> | null,
) {
  return Boolean(
    profile?.goals.includes('trying-to-conceive') &&
      hasEnabledTtcTracking(profile.ttcTrackingPreferences),
  );
}

export function buildTtcObservationSummary({
  emptyLabel,
  locale,
  observation,
}: TtcObservationSummaryInput) {
  const details: string[] = [];

  if (observation?.sexLogged) {
    details.push(translate(locale, 'ttc.summary.sexLogged'));
  }

  if (observation?.ovulationTest) {
    details.push(
      translate(locale, `ttc.summary.ovulationTest${capitalize(observation.ovulationTest)}`),
    );
  }

  if (observation?.cervicalMucus) {
    const mucusKey =
      observation.cervicalMucus === 'egg-white'
        ? 'EggWhite'
        : capitalize(observation.cervicalMucus);

    details.push(translate(locale, `ttc.summary.cervicalMucus${mucusKey}`));
  }

  if (typeof observation?.basalBodyTemperatureCelsius === 'number') {
    details.push(translate(locale, 'ttc.summary.bbtAdded'));
  }

  if (details.length === 0) {
    return emptyLabel ?? translate(locale, 'ttc.summary.noDetailsToday');
  }

  return details.join(' · ');
}

export function buildTtcTrackingPreview({
  emptyLabel,
  locale,
  preferences,
}: TtcTrackingPreviewInput) {
  const fields = [
    preferences?.sex ? translate(locale, 'ttc.summary.previewSex') : null,
    preferences?.ovulationTest ? translate(locale, 'ttc.summary.previewOvulationTest') : null,
    preferences?.cervicalMucus ? translate(locale, 'ttc.summary.previewCervicalMucus') : null,
    preferences?.basalBodyTemperature ? translate(locale, 'ttc.summary.previewBbt') : null,
  ].filter((field): field is string => Boolean(field));

  if (fields.length === 0) {
    return emptyLabel ?? translate(locale, 'ttc.summary.loggingPreviewEmpty');
  }

  return translate(locale, 'ttc.summary.loggingPreviewBody', {
    fields: joinList(fields, locale),
  });
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function joinList(values: string[], locale: SupportedLocale) {
  return values.join(locale === 'ja' || locale === 'zh-Hans' ? '、' : ', ');
}
