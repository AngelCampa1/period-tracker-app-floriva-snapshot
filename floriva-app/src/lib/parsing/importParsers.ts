import type {
  BleedingIntensity,
  BirthControlEvent,
  ImportDateRange,
  ImportSkippedRow,
  ImportSource,
  ManualHistoryPeriod,
  MoodValue,
  SymptomKey,
  TtcObservation,
} from '@/src/types/domain';
import { bleedingIntensityValues, symptomKeyValues } from '@/src/types/domain';

export type ParsedImportDocument = {
  source: ImportSource;
  dateRange: ImportDateRange | null;
  entries: {
    logDate: string;
    bleeding: BleedingIntensity;
    symptoms: SymptomKey[];
    mood?: MoodValue;
    notes?: string;
    ttcObservation?: TtcObservation;
    birthControlEvent?: BirthControlEvent;
  }[];
  skippedRows: ImportSkippedRow[];
  warnings: string[];
};

type NormalizedImportEntry = ParsedImportDocument['entries'][number];
type AdaptedImportRow = {
  row: unknown;
  rowNumber: number;
};

const bleedingRanks: Record<BleedingIntensity, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
};

const bleedingValues = new Set(bleedingIntensityValues);
const symptomValues = new Set(symptomKeyValues);

const symptomAliasMap: Record<string, SymptomKey> = {
  acne: 'acne',
  bloated: 'bloating',
  bloating: 'bloating',
  cramps: 'cramps',
  cramping: 'cramps',
  'period cramps': 'cramps',
  fatigue: 'fatigue',
  tired: 'fatigue',
  tiredness: 'fatigue',
  headache: 'headache',
  headaches: 'headache',
  insomnia: 'sleep-changes',
  libido: 'libido-changes',
  sex: 'sex',
  'sore breasts': 'breast-tenderness',
  'tender breasts': 'breast-tenderness',
  'breast tenderness': 'breast-tenderness',
};

const moodAliasMap: Record<string, MoodValue> = {
  anxious: 'sensitive',
  calm: 'steady',
  energized: 'energized',
  energetic: 'energized',
  fine: 'steady',
  good: 'steady',
  happy: 'steady',
  irritable: 'sensitive',
  low: 'low',
  moody: 'sensitive',
  normal: 'steady',
  okay: 'steady',
  sad: 'low',
  sensitive: 'sensitive',
  steady: 'steady',
  stressed: 'sensitive',
};

const birthControlMethodAliasMap: Record<string, BirthControlEvent['method']> = {
  iud: 'iud',
  implant: 'implant',
  none: 'none',
  patch: 'patch',
  pill: 'pill',
  ring: 'ring',
  other: 'other',
};

const supportedClueKeys = new Set([
  'date',
  'logDate',
  'day',
  'calendarDate',
  'trackedAt',
  'tracked_at',
  'recordedAt',
  'recorded_at',
  'createdAt',
  'created_at',
  'startDate',
  'start_date',
  'bleeding',
  'flow',
  'period',
  'menstruation',
  'symptoms',
  'symptom',
  'tags',
  'observations',
  'mood',
  'emotion',
  'emotions',
  'feeling',
  'notes',
  'note',
  'memo',
  'comment',
  'ttcObservation',
  'cervicalMucus',
  'cervical_mucus',
  'ovulationTest',
  'ovulation_test',
  'basalBodyTemperatureCelsius',
  'basal_body_temperature_celsius',
  'temperature',
  'sexLogged',
  'sex_logged',
  'hadSex',
  'birthControlEvent',
  'birthControl',
  'birth_control',
  'contraception',
  'birthControlMethod',
  'birth_control_method',
  'missedDose',
  'missed_dose',
  'lateDose',
  'late_dose',
  'type',
  'value',
  ...Object.keys(symptomAliasMap),
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(value);
}

function coerceIsoDate(value: unknown): string | null {
  if (isIsoDate(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // After trimming, the value might now be a valid strict ISO date (e.g. a
  // date string that was accidentally padded with whitespace).
  if (isIsoDate(trimmed)) {
    return trimmed;
  }

  // If the string looks like a strict ISO date (YYYY-MM-DD) but failed
  // isIsoDate above, it is an invalid calendar date (e.g. "2026-02-30",
  // "2023-02-29").  Do NOT fall through to new Date() which would silently
  // overflow to the next valid date — reject it outright.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  // If the string carries an explicit UTC/offset indicator (Z or +HH:MM /
  // +HHMM), the calendar date the user logged is the wall-clock date written in
  // the string itself (e.g. "2026-04-02T00:30:00+05:30" was logged on Apr 2 in
  // that zone). Reading the UTC date back via toISOString() would shift it to
  // Apr 1 for any offset that crosses midnight. Prefer the literal date prefix
  // when it is a valid calendar date; only fall back to a UTC read otherwise.
  if (/[Zz]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const datePrefix = value.trim().slice(0, 10);
    if (isIsoDate(datePrefix)) {
      return datePrefix;
    }

    const parsedDate = new Date(trimmed);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toISOString().slice(0, 10);
  }

  // Guard against V8's lenient `new Date()` silently coercing leading garbage
  // into a real date (e.g. `new Date('🌸🌸-04-01')` returns 2001-04-01). A
  // genuine locale-style date is composed only of ASCII letters/digits and the
  // small set of separators date formats use. Anything containing emoji, CJK,
  // control characters, or other unexpected code points is corrupted input and
  // must be rejected rather than recorded as a confidently-wrong calendar date.
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./,:+\-T]*$/.test(trimmed)) {
    return null;
  }

  // For all other strings (locale-style dates, long-form month names, etc.)
  // `new Date(trimmed)` treats them as LOCAL midnight.  Converting directly
  // to `.toISOString()` (UTC) would shift the date by the local UTC offset —
  // a period logged on "March 28" in UTC+12 would appear as "March 27" in
  // the export.  Instead, parse with Date and read back LOCAL year/month/day
  // so the calendar date is preserved regardless of timezone.
  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const y = parsedDate.getFullYear();
  const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const d = String(parsedDate.getDate()).padStart(2, '0');
  const localIso = `${y}-${m}-${d}`;

  // Validate the reconstructed ISO string is a real date.
  if (!isIsoDate(localIso)) {
    return null;
  }

  return localIso;
}

function isBleedingIntensity(value: unknown): value is BleedingIntensity {
  return typeof value === 'string' && bleedingValues.has(value as BleedingIntensity);
}

function isMoodValue(value: unknown): value is MoodValue {
  return (
    typeof value === 'string' &&
    ['steady', 'low', 'sensitive', 'energized'].includes(value)
  );
}

function isBooleanLike(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function asStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function hasMeaningfulValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length > 0;
  }

  return value !== null && value !== undefined;
}

function getRowValues(row: Record<string, unknown>, keys: string[]) {
  return keys.flatMap((key) => asStringList(row[key]));
}

function getFirstRowString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getTruthyKeys(row: Record<string, unknown>) {
  return Object.entries(row)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

function warnUnsupportedClueFields(
  row: Record<string, unknown>,
  rowNumber: number,
  warnings: string[],
) {
  const unsupportedKeys = Object.entries(row)
    .filter(
      ([key, value]) => !supportedClueKeys.has(key) && hasMeaningfulValue(value),
    )
    .map(([key]) => key)
    .sort();

  if (unsupportedKeys.length === 0) {
    return;
  }

  warnings.push(
    `Ignored unsupported Clue field${
      unsupportedKeys.length === 1 ? '' : 's'
    } on row ${rowNumber}: ${unsupportedKeys.join(', ')}.`,
  );
}

function mergeSymptoms(existing: SymptomKey[], incoming: SymptomKey[]) {
  const merged = [...existing];

  for (const symptom of incoming) {
    if (!merged.includes(symptom)) {
      merged.push(symptom);
    }
  }

  return merged;
}

function mergeBleeding(existing: BleedingIntensity, incoming: BleedingIntensity) {
  return bleedingRanks[incoming] > bleedingRanks[existing] ? incoming : existing;
}

function buildDateRange(entries: NormalizedImportEntry[]): ImportDateRange | null {
  if (entries.length === 0) {
    return null;
  }

  return {
    startIso: entries[0].logDate,
    endIso: entries[entries.length - 1].logDate,
  };
}

function mergeEntries(
  entries: NormalizedImportEntry[],
  sourceLabel: string,
  warnings: string[],
) {
  const mergedByDate = new Map<string, { entry: NormalizedImportEntry; count: number }>();

  for (const entry of entries) {
    const existing = mergedByDate.get(entry.logDate);

    if (!existing) {
      mergedByDate.set(entry.logDate, {
        entry: {
          ...entry,
          symptoms: [...entry.symptoms],
        },
        count: 1,
      });
      continue;
    }

    existing.count += 1;
    const mergedTtcObservation =
      existing.entry.ttcObservation || entry.ttcObservation
        ? {
            ...(existing.entry.ttcObservation ?? {}),
            ...(entry.ttcObservation ?? {}),
          }
        : undefined;
    const mergedBirthControlEvent = existing.entry.birthControlEvent
      ? {
          ...existing.entry.birthControlEvent,
          ...(entry.birthControlEvent ?? {}),
        }
      : entry.birthControlEvent
        ? {
            ...entry.birthControlEvent,
          }
        : undefined;

    existing.entry = {
      ...existing.entry,
      bleeding: mergeBleeding(existing.entry.bleeding, entry.bleeding),
      symptoms: mergeSymptoms(existing.entry.symptoms, entry.symptoms),
      mood: existing.entry.mood ?? entry.mood,
      notes: existing.entry.notes ?? entry.notes,
      ttcObservation: mergedTtcObservation,
      birthControlEvent: mergedBirthControlEvent,
    };
  }

  const mergedEntries = [...mergedByDate.values()]
    .sort((left, right) => left.entry.logDate.localeCompare(right.entry.logDate))
    .map((value) => value.entry);

  for (const value of mergedByDate.values()) {
    if (value.count > 1) {
      warnings.push(`Merged ${value.count} ${sourceLabel} rows for ${value.entry.logDate}.`);
    }
  }

  return mergedEntries;
}

function normalizeSymptomList(
  row: Record<string, unknown>,
  rowNumber: number,
  warnings: string[],
) {
  const rawSymptoms = row.symptoms;

  if (!Array.isArray(rawSymptoms)) {
    return [];
  }

  const symptoms: SymptomKey[] = [];
  let unsupportedCount = 0;

  for (const symptom of rawSymptoms) {
    if (typeof symptom === 'string' && symptomValues.has(symptom as SymptomKey)) {
      if (!symptoms.includes(symptom as SymptomKey)) {
        symptoms.push(symptom as SymptomKey);
      }
    } else {
      unsupportedCount += 1;
    }
  }

  if (unsupportedCount > 0) {
    warnings.push(
      `Ignored ${unsupportedCount} unsupported symptom value${
        unsupportedCount === 1 ? '' : 's'
      } on row ${rowNumber}.`,
    );
  }

  return symptoms;
}

function normalizeImportRow(
  row: unknown,
  rowNumber: number,
  defaultBleeding: BleedingIntensity | null,
  warnings: string[],
  skippedRows: ImportSkippedRow[],
) {
  if (!isPlainObject(row)) {
    skippedRows.push({
      rowNumber,
      reason: 'invalid',
      message: `Row ${rowNumber} is not an object.`,
    });
    return null;
  }

  const logDate = row.date;

  if (!isIsoDate(logDate)) {
    skippedRows.push({
      rowNumber,
      reason: 'invalid',
      message: `Row ${rowNumber} has an invalid date.`,
    });
    return null;
  }

  const bleeding = isBleedingIntensity(row.bleeding) ? row.bleeding : defaultBleeding;

  if (!bleeding) {
    skippedRows.push({
      rowNumber,
      reason: 'invalid',
      message: `Row ${rowNumber} is missing a valid bleeding value.`,
    });
    return null;
  }

  const entry: NormalizedImportEntry = {
    logDate,
    bleeding,
    symptoms: normalizeSymptomList(row, rowNumber, warnings),
  };

  if (typeof row.notes === 'string' && row.notes.trim().length > 0) {
    entry.notes = row.notes.trim().slice(0, 500);
  }

  if (isMoodValue(row.mood)) {
    entry.mood = row.mood;
  }

  if (isPlainObject(row.ttcObservation)) {
    const ttcObservation: TtcObservation = {};

    if (
      typeof row.ttcObservation.cervicalMucus === 'string' &&
      ['dry', 'sticky', 'creamy', 'egg-white'].includes(row.ttcObservation.cervicalMucus)
    ) {
      ttcObservation.cervicalMucus =
        row.ttcObservation.cervicalMucus as TtcObservation['cervicalMucus'];
    }

    if (
      typeof row.ttcObservation.ovulationTest === 'string' &&
      ['negative', 'positive', 'peak'].includes(row.ttcObservation.ovulationTest)
    ) {
      ttcObservation.ovulationTest =
        row.ttcObservation.ovulationTest as TtcObservation['ovulationTest'];
    }

    if (
      typeof row.ttcObservation.basalBodyTemperatureCelsius === 'number' &&
      row.ttcObservation.basalBodyTemperatureCelsius >= 30 &&
      row.ttcObservation.basalBodyTemperatureCelsius <= 45
    ) {
      ttcObservation.basalBodyTemperatureCelsius =
        row.ttcObservation.basalBodyTemperatureCelsius;
    }

    if (isBooleanLike(row.ttcObservation.sexLogged)) {
      ttcObservation.sexLogged = row.ttcObservation.sexLogged;
    }

    if (Object.keys(ttcObservation).length > 0) {
      entry.ttcObservation = ttcObservation;
    }
  }

  if (isPlainObject(row.birthControlEvent) && typeof row.birthControlEvent.method === 'string') {
    const rawBirthControl = row.birthControlEvent as Record<string, unknown>;
    const method = rawBirthControl.method;

    if (
      typeof method === 'string' &&
      ['none', 'pill', 'iud', 'implant', 'ring', 'patch', 'other'].includes(method)
    ) {
      const birthControlEvent: BirthControlEvent = {
        method: method as BirthControlEvent['method'],
      };

      if (isBooleanLike(rawBirthControl.missedDose)) {
        birthControlEvent.missedDose = rawBirthControl.missedDose;
      }

      if (isBooleanLike(rawBirthControl.lateDose)) {
        birthControlEvent.lateDose = rawBirthControl.lateDose;
      }

      entry.birthControlEvent = birthControlEvent;
    }
  }

  return entry;
}

function mapSymptomsFromValues(values: string[]) {
  const symptoms: SymptomKey[] = [];

  for (const value of values) {
    const mapped = symptomAliasMap[normalizeToken(value)];

    if (mapped && !symptoms.includes(mapped)) {
      symptoms.push(mapped);
    }
  }

  return symptoms;
}

function findBleedingValue(values: string[]) {
  let bleeding: BleedingIntensity | null = null;

  for (const value of values) {
    const token = normalizeToken(value);
    let nextBleeding: BleedingIntensity | null = null;

    if (['none', 'no bleeding', 'no period'].includes(token)) {
      nextBleeding = 'none';
    } else if (['spotting', 'spot'].includes(token)) {
      nextBleeding = 'spotting';
    } else if (token === 'light') {
      nextBleeding = 'light';
    } else if (['medium', 'moderate'].includes(token)) {
      nextBleeding = 'medium';
    } else if (token === 'heavy') {
      nextBleeding = 'heavy';
    }

    if (!nextBleeding) {
      continue;
    }

    bleeding = bleeding ? mergeBleeding(bleeding, nextBleeding) : nextBleeding;
  }

  return bleeding;
}

function findMoodValue(values: string[]) {
  for (const value of values) {
    const mapped = moodAliasMap[normalizeToken(value)];

    if (mapped) {
      return mapped;
    }
  }

  return null;
}

function coerceNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function coerceBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const token = normalizeToken(value);

  if (['yes', 'true', 'logged'].includes(token)) {
    return true;
  }

  if (['no', 'false', 'not logged'].includes(token)) {
    return false;
  }

  return null;
}

// Maximum number of days that a single period cycle range may span.
// Anything exceeding this is almost certainly corrupt data — and would cause
// an OOM/hang in buildInclusiveIsoDateRange if left unchecked.
const MAX_PERIOD_DAYS = 90;

function addDaysToIsoDate(isoDate: string, dayOffset: number) {
  const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + dayOffset);
  return parsedDate.toISOString().slice(0, 10);
}

/**
 * Returns the ISO date strings for every day from startIso to endIso
 * (inclusive).  Returns null when the span exceeds MAX_PERIOD_DAYS to
 * prevent unbounded loops / OOM with malformed imports.
 */
function buildInclusiveIsoDateRange(startIso: string, endIso: string): string[] | null {
  const startMs = new Date(`${startIso}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${endIso}T00:00:00.000Z`).getTime();
  const spanDays = Math.round((endMs - startMs) / 86_400_000) + 1;

  if (spanDays > MAX_PERIOD_DAYS) {
    return null;
  }

  const range: string[] = [];
  let currentIso = startIso;

  while (currentIso <= endIso) {
    range.push(currentIso);
    currentIso = addDaysToIsoDate(currentIso, 1);
  }

  return range;
}

function extractDateFromRow(row: Record<string, unknown>) {
  const candidateKeys = [
    'date',
    'logDate',
    'day',
    'calendarDate',
    'trackedAt',
    'tracked_at',
    'recordedAt',
    'recorded_at',
    'createdAt',
    'created_at',
    'startDate',
    'start_date',
  ];

  for (const key of candidateKeys) {
    const isoDate = coerceIsoDate(row[key]);

    if (isoDate) {
      return isoDate;
    }
  }

  return null;
}

function getOptionValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => getOptionValues(item));
  }

  if (!isPlainObject(value)) {
    return [];
  }

  const values: string[] = [];

  for (const key of ['option', 'label', 'name', 'value']) {
    const candidate = value[key];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      values.push(candidate.trim());
    }
  }

  return values;
}

function findBirthControlEvent(row: Record<string, unknown>) {
  if (isPlainObject(row.birthControlEvent)) {
    return row.birthControlEvent;
  }

  const method = (() => {
    const directMethod = getFirstRowString(row, [
      'birthControlMethod',
      'birth_control_method',
    ]);

    if (directMethod) {
      return birthControlMethodAliasMap[normalizeToken(directMethod)] ?? null;
    }

    const candidates = getRowValues(row, ['birthControl', 'birth_control', 'contraception']);

    for (const candidate of candidates) {
      const mapped = birthControlMethodAliasMap[normalizeToken(candidate)];

      if (mapped) {
        return mapped;
      }
    }

    return null;
  })();

  if (!method) {
    return null;
  }

  const event: BirthControlEvent = {
    method,
  };

  const missedDose = coerceBoolean(row.missedDose ?? row.missed_dose);
  const lateDose = coerceBoolean(row.lateDose ?? row.late_dose);

  if (missedDose !== null) {
    event.missedDose = missedDose;
  }

  if (lateDose !== null) {
    event.lateDose = lateDose;
  }

  return event;
}

function findTtcObservation(row: Record<string, unknown>) {
  if (isPlainObject(row.ttcObservation)) {
    return row.ttcObservation;
  }

  const observation: TtcObservation = {};
  const cervicalMucusValue = getFirstRowString(row, [
    'cervicalMucus',
    'cervical_mucus',
  ]);
  const ovulationTestValue = getFirstRowString(row, [
    'ovulationTest',
    'ovulation_test',
  ]);
  const temperatureValue =
    coerceNumber(row.basalBodyTemperatureCelsius ?? row.basal_body_temperature_celsius) ??
    coerceNumber(row.temperature);
  const sexLoggedValue = coerceBoolean(row.sexLogged ?? row.sex_logged ?? row.hadSex);

  if (
    cervicalMucusValue &&
    ['dry', 'sticky', 'creamy', 'egg white', 'egg-white'].includes(
      normalizeToken(cervicalMucusValue),
    )
  ) {
    observation.cervicalMucus = normalizeToken(cervicalMucusValue).replace(
      'egg white',
      'egg-white',
    ) as TtcObservation['cervicalMucus'];
  }

  if (
    ovulationTestValue &&
    ['negative', 'positive', 'peak'].includes(normalizeToken(ovulationTestValue))
  ) {
    observation.ovulationTest =
      normalizeToken(ovulationTestValue) as TtcObservation['ovulationTest'];
  }

  if (temperatureValue !== null && temperatureValue >= 30 && temperatureValue <= 45) {
    observation.basalBodyTemperatureCelsius = temperatureValue;
  }

  if (sexLoggedValue !== null) {
    observation.sexLogged = sexLoggedValue;
  }

  return Object.keys(observation).length > 0 ? observation : null;
}

function adaptGenericDailyRow(row: Record<string, unknown>) {
  const date = extractDateFromRow(row);
  const rawSymptoms = Array.from(
    new Set([
      ...getRowValues(row, ['symptoms', 'symptom', 'tags', 'observations']),
      ...getTruthyKeys(row).filter(
        (key) => symptomAliasMap[normalizeToken(key)] !== undefined,
      ),
    ]),
  );
  const mappedSymptoms = mapSymptomsFromValues(rawSymptoms);
  // Keep the resolved canonical symptoms, plus any raw values that did NOT
  // resolve through the alias map. The raw passthrough preserves canonical
  // SymptomKeys that aren't self-mapped in symptomAliasMap (e.g.
  // 'sleep-changes'), while genuinely unsupported values still fall through to
  // normalizeSymptomList's warning. Crucially, we must NOT pass through a raw
  // value that already resolved to an alias (e.g. 'cramping' → 'cramps'):
  // leaving it in would make normalizeSymptomList count it as "unsupported" and
  // emit a false data-loss warning even though the symptom was imported fine.
  const symptomTokens = Array.from(
    new Set([
      ...mappedSymptoms,
      ...rawSymptoms.filter(
        (value) => symptomAliasMap[normalizeToken(value)] === undefined,
      ),
    ]),
  );
  const bleeding = findBleedingValue(
    getRowValues(row, ['bleeding', 'flow', 'period', 'menstruation']),
  );
  const mood =
    (isMoodValue(row.mood) ? row.mood : null) ??
    findMoodValue(getRowValues(row, ['mood', 'emotion', 'emotions', 'feeling']));
  const notes =
    getFirstRowString(row, ['notes', 'note', 'memo', 'comment']) ?? undefined;

  return {
    ...(date ? { date } : {}),
    ...(bleeding ? { bleeding } : {}),
    ...(symptomTokens.length > 0 ? { symptoms: symptomTokens } : {}),
    ...(mood ? { mood } : {}),
    ...(notes ? { notes } : {}),
    ...(findTtcObservation(row) ? { ttcObservation: findTtcObservation(row) } : {}),
    ...(findBirthControlEvent(row)
      ? { birthControlEvent: findBirthControlEvent(row) }
      : {}),
  };
}

function parseAdaptedRows(
  source: ImportSource,
  sourceLabel: string,
  adaptedRows: AdaptedImportRow[],
  defaultBleeding: BleedingIntensity | null,
  initialWarnings: string[] = [],
): ParsedImportDocument {
  const warnings = [...initialWarnings];
  const skippedRows: ImportSkippedRow[] = [];
  const normalizedRows: NormalizedImportEntry[] = [];

  for (const adaptedRow of adaptedRows) {
    const normalizedRow = normalizeImportRow(
      adaptedRow.row,
      adaptedRow.rowNumber,
      defaultBleeding,
      warnings,
      skippedRows,
    );

    if (normalizedRow) {
      normalizedRows.push(normalizedRow);
    }
  }

  const entries = mergeEntries(normalizedRows, sourceLabel, warnings);

  return {
    source,
    entries,
    skippedRows,
    warnings,
    dateRange: buildDateRange(entries),
  };
}

function extractClueRows(raw: unknown) {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!isPlainObject(raw)) {
    throw new UnsupportedImportShapeError(
      'clue',
      'Unsupported Clue import file shape: expected a top-level array or object with "data".',
    );
  }

  const rawRows = raw.data ?? raw.trackedData;

  if (!Array.isArray(rawRows)) {
    throw new UnsupportedImportShapeError(
      'clue',
      'Unsupported Clue import file shape: expected "data" to be an array.',
    );
  }

  return rawRows;
}

function adaptClueRow(row: unknown, rowNumber: number, warnings: string[]) {
  if (!isPlainObject(row)) {
    return row;
  }

  const clueMetric = getFirstRowString(row, ['type']);

  if (!clueMetric) {
    return adaptGenericDailyRow(row);
  }

  const date = extractDateFromRow(row);
  const metric = normalizeToken(clueMetric);
  const optionValues = getOptionValues(row.value);
  const adaptedRow: Record<string, unknown> = {
    ...(date ? { date } : {}),
  };

  if (['period', 'bleeding', 'flow'].includes(metric)) {
    const bleeding = findBleedingValue(optionValues);

    if (bleeding) {
      adaptedRow.bleeding = bleeding;
    }
  } else if (['pain', 'symptom', 'symptoms'].includes(metric)) {
    const symptoms = mapSymptomsFromValues(optionValues);

    if (symptoms.length > 0) {
      adaptedRow.symptoms = symptoms;
    }
  } else if (['feeling', 'feelings', 'emotion', 'emotions', 'mood'].includes(metric)) {
    const mood = findMoodValue(optionValues);

    if (mood) {
      adaptedRow.mood = mood;
    }
  } else if (['discharge', 'cervical mucus'].includes(metric)) {
    const cervicalMucus = optionValues
      .map((value) => normalizeToken(value).replace('egg white', 'egg-white'))
      .find((value) => ['dry', 'sticky', 'creamy', 'egg-white'].includes(value));

    if (cervicalMucus) {
      adaptedRow.ttcObservation = {
        cervicalMucus: cervicalMucus as TtcObservation['cervicalMucus'],
      };
    }
  } else if (['ovulation', 'ovulation test', 'opk'].includes(metric)) {
    const ovulationTest = optionValues
      .map((value) => normalizeToken(value))
      .find((value) => ['negative', 'positive', 'peak'].includes(value));

    if (ovulationTest) {
      adaptedRow.ttcObservation = {
        ovulationTest: ovulationTest as TtcObservation['ovulationTest'],
      };
    }
  } else if (['bbt', 'temperature', 'basal body temperature'].includes(metric)) {
    const excluded =
      isPlainObject(row.value) && row.value.excluded === true;
    const temperature =
      isPlainObject(row.value)
        ? coerceNumber(row.value.celsius ?? row.value.temperature ?? row.value.value)
        : coerceNumber(row.value);

    if (!excluded && temperature !== null && temperature >= 30 && temperature <= 45) {
      adaptedRow.ttcObservation = {
        basalBodyTemperatureCelsius: temperature,
      };
    }
  } else if (hasMeaningfulValue(row.value)) {
    // Unrecognized Clue metric type with a meaningful value — warn so users
    // know this data was not imported.  This mirrors the behaviour of
    // adaptFloMetricRow which emits the same class of warning.
    warnings.push(
      `Ignored unsupported Clue metric type "${clueMetric}" on row ${rowNumber}.`,
    );
  }

  if (
    !('bleeding' in adaptedRow) &&
    ('symptoms' in adaptedRow || 'mood' in adaptedRow || 'ttcObservation' in adaptedRow)
  ) {
    adaptedRow.bleeding = 'none';
  }

  return adaptedRow;
}

function extractFloRows(raw: unknown) {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!isPlainObject(raw)) {
    throw new UnsupportedImportShapeError(
      'flo',
      'Unsupported Flo import file shape: expected a top-level array or object with "data" or "values".',
    );
  }

  let hasCyclesContainer = false;
  const cycleRows = [raw.operationalData, raw.update]
    .filter((value): value is Record<string, unknown> => isPlainObject(value))
    .flatMap((value) => {
      const cycles = value.cycles;

      if (!Array.isArray(cycles)) {
        return [];
      }

      hasCyclesContainer = true;

      return cycles.flatMap((cycle) => {
        if (!isPlainObject(cycle)) {
          return [cycle];
        }

        const startDate = coerceIsoDate(
          cycle.period_start_date ?? cycle.periodStartDate ?? cycle.start_date ?? cycle.startDate,
        );
        const endDate = coerceIsoDate(
          cycle.period_end_date ?? cycle.periodEndDate ?? cycle.end_date ?? cycle.endDate,
        );

        if (!startDate || !endDate || endDate < startDate) {
          return [
            {
              date:
                cycle.period_start_date ??
                cycle.periodStartDate ??
                cycle.start_date ??
                cycle.startDate,
            },
          ];
        }

        const dateRange = buildInclusiveIsoDateRange(startDate, endDate);

        // Null means the range exceeded MAX_PERIOD_DAYS — skip this cycle to
        // avoid OOM / DoS from corrupt data (e.g. period_end_date: 9999-12-31).
        if (dateRange === null) {
          return [];
        }

        return dateRange.map((date) => ({
          date,
          bleeding: 'medium',
        }));
      });
    });

  const rawRows = raw.data ?? raw.values;

  if (Array.isArray(rawRows)) {
    return [...rawRows, ...cycleRows];
  }

  if (cycleRows.length > 0) {
    return cycleRows;
  }

  // A valid cycles container that yielded zero rows (e.g. all cycles skipped
  // due to oversized date ranges) should return an empty array, not throw.
  if (hasCyclesContainer) {
    return [];
  }

  throw new UnsupportedImportShapeError(
    'flo',
    'Unsupported Flo import file shape: expected a top-level array or "data"/"values" array.',
  );
}

function isFloListValueRow(row: Record<string, unknown>) {
  const metric = getFirstRowString(row, [
    'type',
    'category',
    'name',
    'metric',
    'trackingType',
    'key',
  ]);

  return metric !== null && 'value' in row;
}

function mergePartialFloRow(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
) {
  if (!existing) {
    return {
      ...incoming,
      ...(Array.isArray(incoming.symptoms) ? { symptoms: [...incoming.symptoms] } : {}),
    };
  }

  return {
    ...existing,
    bleeding:
      isBleedingIntensity(existing.bleeding) && isBleedingIntensity(incoming.bleeding)
        ? mergeBleeding(existing.bleeding, incoming.bleeding)
        : existing.bleeding ?? incoming.bleeding,
    symptoms: mergeSymptoms(
      Array.isArray(existing.symptoms) ? (existing.symptoms as SymptomKey[]) : [],
      Array.isArray(incoming.symptoms) ? (incoming.symptoms as SymptomKey[]) : [],
    ),
    mood: existing.mood ?? incoming.mood,
    notes: existing.notes ?? incoming.notes,
    ttcObservation:
      isPlainObject(existing.ttcObservation) || isPlainObject(incoming.ttcObservation)
        ? {
            ...(isPlainObject(existing.ttcObservation) ? existing.ttcObservation : {}),
            ...(isPlainObject(incoming.ttcObservation) ? incoming.ttcObservation : {}),
          }
        : undefined,
    birthControlEvent:
      isPlainObject(existing.birthControlEvent) || isPlainObject(incoming.birthControlEvent)
        ? {
            ...(isPlainObject(existing.birthControlEvent) ? existing.birthControlEvent : {}),
            ...(isPlainObject(incoming.birthControlEvent) ? incoming.birthControlEvent : {}),
          }
        : undefined,
  };
}

function adaptFloMetricRow(
  row: Record<string, unknown>,
  rowNumber: number,
  warnings: string[],
) {
  const date = extractDateFromRow(row);

  if (!date) {
    return row;
  }

  const metric = getFirstRowString(row, [
    'type',
    'category',
    'name',
    'metric',
    'trackingType',
    'key',
  ]);
  const value = row.value;

  if (!metric) {
    return { date };
  }

  const normalizedMetric = normalizeToken(metric);
  const values = asStringList(value);
  const partial: Record<string, unknown> = { date };

  if (
    ['bleeding', 'flow', 'period', 'menstruation'].some((token) =>
      normalizedMetric.includes(token),
    )
  ) {
    const bleeding = findBleedingValue(values);

    if (bleeding) {
      partial.bleeding = bleeding;
    }
  } else if (normalizedMetric.includes('symptom')) {
    partial.symptoms = mapSymptomsFromValues(values);
  } else if (
    ['mood', 'emotion', 'feeling'].some((token) => normalizedMetric.includes(token))
  ) {
    const mood = findMoodValue(values);

    if (mood) {
      partial.mood = mood;
    }
  } else if (['note', 'memo', 'comment'].some((token) => normalizedMetric.includes(token))) {
    if (typeof value === 'string' && value.trim().length > 0) {
      partial.notes = value.trim();
    }
  } else if (normalizedMetric.includes('cervical mucus')) {
    const ttcObservation: TtcObservation = {};
    const mucusValue = values[0];

    if (mucusValue) {
      const normalizedMucus = normalizeToken(mucusValue).replace('egg white', 'egg-white');

      if (['dry', 'sticky', 'creamy', 'egg-white'].includes(normalizedMucus)) {
        ttcObservation.cervicalMucus =
          normalizedMucus as TtcObservation['cervicalMucus'];
      }
    }

    if (Object.keys(ttcObservation).length > 0) {
      partial.ttcObservation = ttcObservation;
    }
  } else if (normalizedMetric.includes('ovulation test')) {
    const ttcObservation: TtcObservation = {};
    const ovulationValue = values[0];

    if (ovulationValue) {
      const normalizedValue = normalizeToken(ovulationValue);

      if (['negative', 'positive', 'peak'].includes(normalizedValue)) {
        ttcObservation.ovulationTest =
          normalizedValue as TtcObservation['ovulationTest'];
      }
    }

    if (Object.keys(ttcObservation).length > 0) {
      partial.ttcObservation = ttcObservation;
    }
  } else if (
    normalizedMetric.includes('temperature') ||
    normalizedMetric.includes('bbt')
  ) {
    const temperature = coerceNumber(value);

    if (temperature !== null && temperature >= 30 && temperature <= 45) {
      partial.ttcObservation = {
        basalBodyTemperatureCelsius: temperature,
      };
    }
  } else if (
    normalizedMetric.includes('sex') ||
    normalizedMetric.includes('intercourse')
  ) {
    const sexLogged = coerceBoolean(value);

    if (sexLogged !== null) {
      partial.ttcObservation = {
        sexLogged,
      };
    }
  } else if (
    normalizedMetric.includes('birth control') ||
    normalizedMetric.includes('contraception')
  ) {
    const methodValue = values[0];

    if (methodValue) {
      const mappedMethod = birthControlMethodAliasMap[normalizeToken(methodValue)];

      if (mappedMethod) {
        partial.birthControlEvent = { method: mappedMethod };
      }
    }
  } else if (hasMeaningfulValue(value)) {
    warnings.push(
      `Ignored unsupported Flo value category "${metric}" on row ${rowNumber}.`,
    );
  }

  return partial;
}

function parseFloImportDocument(raw: unknown): ParsedImportDocument {
  const rawRows = extractFloRows(raw);
  const warnings: string[] = [];
  const directRows: AdaptedImportRow[] = [];
  const aggregatedRows = new Map<string, { row: Record<string, unknown>; rowNumber: number }>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 1;

    if (!isPlainObject(rawRow)) {
      directRows.push({ row: rawRow, rowNumber });
      return;
    }

    const adaptedRow = isFloListValueRow(rawRow)
      ? adaptFloMetricRow(rawRow, rowNumber, warnings)
      : adaptGenericDailyRow(rawRow);

    if (!isPlainObject(adaptedRow)) {
      directRows.push({ row: adaptedRow, rowNumber });
      return;
    }

    const date = typeof adaptedRow.date === 'string' ? adaptedRow.date : null;

    if (!date) {
      directRows.push({ row: adaptedRow, rowNumber });
      return;
    }

    const existing = aggregatedRows.get(date);

    aggregatedRows.set(date, {
      row: mergePartialFloRow(existing?.row, adaptedRow),
      rowNumber: existing?.rowNumber ?? rowNumber,
    });
  });

  const adaptedRows = [
    ...directRows,
    ...[...aggregatedRows.values()].map((value) => ({
      row: value.row,
      rowNumber: value.rowNumber,
    })),
  ];

  return parseAdaptedRows('flo', 'Flo', adaptedRows, null, warnings);
}

export class UnsupportedImportShapeError extends Error {
  readonly source: ImportSource;

  constructor(source: ImportSource, message: string) {
    super(message);
    this.name = 'UnsupportedImportShapeError';
    this.source = source;
  }
}

export function parseManualHistoryImport(raw: unknown): ParsedImportDocument {
  const source: ImportSource = 'manual';
  const sourceLabel = 'manual period-history';

  if (!isPlainObject(raw)) {
    throw new UnsupportedImportShapeError(
      source,
      'Unsupported manual import file shape: expected a top-level object with periodStarts.',
    );
  }

  const manualHistory = raw as ManualHistoryPeriod;
  const rawStarts = manualHistory.periodStarts;

  if (!Array.isArray(rawStarts)) {
    throw new UnsupportedImportShapeError(
      source,
      'Unsupported manual import file shape: expected "periodStarts" to be an array.',
    );
  }

  // Only honour lookbackStartIso if it is itself a valid strict ISO date.
  // An invalid (non-string, garbage, or overflowed) value would cause
  // incorrect string comparisons: e.g. "garbage" > any YYYY-... string,
  // silently discarding all entries.
  const rawLookback = manualHistory.lookbackStartIso;
  const lookbackStartIso = isIsoDate(rawLookback) ? rawLookback : undefined;
  const warnings: string[] = [];
  const skippedRows: ImportSkippedRow[] = [];
  const normalizedRows: NormalizedImportEntry[] = [];

  rawStarts.forEach((value, index) => {
    const rowNumber = index + 1;

    // Use coerceIsoDate (not strict isIsoDate) so the manual path is as forgiving
    // as the Clue/Flo paths: a hand-edited JSON — the most likely source of a
    // manual import — commonly carries whitespace padding or an ISO timestamp
    // suffix. coerceIsoDate trims and normalizes those while still rejecting
    // impossible/overflow calendar dates outright.
    const logDate = coerceIsoDate(value);

    if (logDate === null) {
      skippedRows.push({
        rowNumber,
        reason: 'invalid',
        message: `Row ${rowNumber} has an invalid date.`,
      });
      return;
    }

    if (lookbackStartIso && logDate < lookbackStartIso) {
      skippedRows.push({
        rowNumber,
        reason: 'unsupported',
        message: `Row ${rowNumber} is older than Floriva's 12-month manual import window.`,
      });
      return;
    }

    normalizedRows.push({
      logDate,
      bleeding: 'medium',
      symptoms: [],
    });
  });

  const entries = mergeEntries(normalizedRows, sourceLabel, warnings);

  return {
    source,
    entries,
    skippedRows,
    warnings,
    dateRange: buildDateRange(entries),
  };
}

export function parseClueImport(raw: unknown): ParsedImportDocument {
  const rawRows = extractClueRows(raw);
  const warnings: string[] = [];

  return parseAdaptedRows(
    'clue',
    'Clue',
    rawRows.map((row, index) => {
      const rowNumber = index + 1;

      if (isPlainObject(row)) {
        warnUnsupportedClueFields(row, rowNumber, warnings);
      }

      return {
        row: adaptClueRow(row, rowNumber, warnings),
        rowNumber,
      };
    }),
    null,
    warnings,
  );
}

export function parseFloImport(raw: unknown): ParsedImportDocument {
  return parseFloImportDocument(raw);
}
