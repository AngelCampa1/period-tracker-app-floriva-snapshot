const REDACTED = '[REDACTED]';

const sensitiveKeys = new Set([
  'birthControlEvent',
  'conditionTags',
  'bleeding',
  'cycleHistory',
  'cycleLengthDays',
  'dailyLogEntry',
  'freeformText',
  'goals',
  'importSessionId',
  'logs',
  'mood',
  'note',
  'notes',
  'ovulationTest',
  'periodLengthDays',
  'sexLogged',
  'symptoms',
  'ttcObservation',
]);

export function redactSensitiveFields<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (sensitiveKeys.has(key)) {
        return [key, REDACTED];
      }

      return [key, redactValue(nestedValue)];
    }),
  );
}
