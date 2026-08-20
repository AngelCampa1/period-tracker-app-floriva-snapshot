import type {
  BleedingIntensity,
  BirthControlMethod,
  CervicalMucusValue,
  DailyLogEntry,
  MoodValue,
  OvulationTestValue,
  SupportedLocale,
  SymptomKey,
} from '@/src/types/domain';

import { translate } from '@/src/localization/translations';

export type DailyLogDraft = {
  bleeding?: BleedingIntensity;
  symptoms: SymptomKey[];
  mood?: MoodValue;
  notes: string;
  ttcObservation: {
    cervicalMucus?: CervicalMucusValue;
    ovulationTest?: OvulationTestValue;
    basalBodyTemperatureInput: string;
    sexLogged: boolean;
  };
  birthControlEvent: {
    method?: BirthControlMethod;
    missedDose: boolean;
    lateDose: boolean;
  };
};

const MIN_BASAL_BODY_TEMPERATURE_CELSIUS = 30;
const MAX_BASAL_BODY_TEMPERATURE_CELSIUS = 45;

export function createEmptyDailyLogDraft(): DailyLogDraft {
  return {
    symptoms: [],
    notes: '',
    ttcObservation: {
      basalBodyTemperatureInput: '',
      sexLogged: false,
    },
    birthControlEvent: {
      missedDose: false,
      lateDose: false,
    },
  };
}

export function createDailyLogDraft(entry: DailyLogEntry | null): DailyLogDraft {
  if (!entry) {
    return createEmptyDailyLogDraft();
  }

  return {
    bleeding: entry.bleeding,
    symptoms: entry.symptoms,
    mood: entry.mood,
    notes: entry.notes ?? '',
    ttcObservation: {
      cervicalMucus: entry.ttcObservation?.cervicalMucus,
      ovulationTest: entry.ttcObservation?.ovulationTest,
      basalBodyTemperatureInput:
        typeof entry.ttcObservation?.basalBodyTemperatureCelsius === 'number'
          ? entry.ttcObservation.basalBodyTemperatureCelsius.toFixed(2)
          : '',
      sexLogged: entry.ttcObservation?.sexLogged ?? false,
    },
    birthControlEvent: {
      method: entry.birthControlEvent?.method,
      missedDose: entry.birthControlEvent?.missedDose ?? false,
      lateDose: entry.birthControlEvent?.lateDose ?? false,
    },
  };
}

export function getBasalBodyTemperatureValidationMessage(
  value: string,
  locale: SupportedLocale = 'en',
) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  const parsedValue = Number.parseFloat(trimmedValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < MIN_BASAL_BODY_TEMPERATURE_CELSIUS ||
    parsedValue > MAX_BASAL_BODY_TEMPERATURE_CELSIUS
  ) {
    return translate(locale, 'logging.validation.bbtRange', {
      min: MIN_BASAL_BODY_TEMPERATURE_CELSIUS.toFixed(2),
      max: MAX_BASAL_BODY_TEMPERATURE_CELSIUS.toFixed(2),
    });
  }

  return undefined;
}

export function hasTrackableContent(draft: DailyLogDraft) {
  return (
    (draft.bleeding !== undefined && draft.bleeding !== 'none') ||
    draft.symptoms.length > 0 ||
    draft.mood !== undefined ||
    normalizeNotes(draft.notes) !== undefined ||
    Boolean(
      draft.ttcObservation.sexLogged ||
        draft.ttcObservation.ovulationTest ||
        draft.ttcObservation.cervicalMucus ||
        normalizeBasalBodyTemperature(draft.ttcObservation.basalBodyTemperatureInput) !==
          undefined,
    ) ||
    Boolean(draft.birthControlEvent.method && draft.birthControlEvent.method !== 'none')
  );
}

export function buildDailyLogEntry({
  draft,
  existingEntry,
  logDate,
}: {
  draft: DailyLogDraft;
  existingEntry: DailyLogEntry | null;
  logDate: string;
}): DailyLogEntry | null {
  if (!hasTrackableContent(draft)) {
    return null;
  }

  return {
    id: existingEntry?.id ?? `daily-log-${logDate}`,
    logDate,
    bleeding: draft.bleeding ?? existingEntry?.bleeding ?? 'none',
    symptoms: draft.symptoms,
    mood: draft.mood,
    notes: normalizeNotes(draft.notes),
    ttcObservation: buildTtcObservation(draft),
    birthControlEvent: buildBirthControlEvent(draft),
    importSessionId: existingEntry?.importSessionId,
  };
}

export function areDailyLogEntriesEquivalent(
  left: DailyLogEntry | null,
  right: DailyLogEntry | null,
) {
  if (left === null || right === null) {
    return left === right;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function buildTtcObservation(draft: DailyLogDraft) {
  const basalBodyTemperatureCelsius = normalizeBasalBodyTemperature(
    draft.ttcObservation.basalBodyTemperatureInput,
  );

  if (
    !draft.ttcObservation.sexLogged &&
    !draft.ttcObservation.ovulationTest &&
    !draft.ttcObservation.cervicalMucus &&
    basalBodyTemperatureCelsius === undefined
  ) {
    return undefined;
  }

  return {
    cervicalMucus: draft.ttcObservation.cervicalMucus,
    ovulationTest: draft.ttcObservation.ovulationTest,
    basalBodyTemperatureCelsius,
    sexLogged: draft.ttcObservation.sexLogged || undefined,
  };
}

function buildBirthControlEvent(draft: DailyLogDraft) {
  const method = draft.birthControlEvent.method;

  if (!method || method === 'none') {
    return undefined;
  }

  if (method !== 'pill') {
    return {
      method,
    };
  }

  return {
    method,
    missedDose: draft.birthControlEvent.missedDose || undefined,
    lateDose: draft.birthControlEvent.lateDose || undefined,
  };
}

function normalizeNotes(notes: string) {
  const trimmedNotes = notes.trim();

  return trimmedNotes.length > 0 ? trimmedNotes : undefined;
}

function normalizeBasalBodyTemperature(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  if (getBasalBodyTemperatureValidationMessage(trimmedValue)) {
    return undefined;
  }

  return Number.parseFloat(trimmedValue);
}
