import { redactSensitiveFields } from '@/src/lib/diagnostics/redactSensitiveFields';

describe('redactSensitiveFields', () => {
  it('redacts reproductive-health payloads from diagnostics', () => {
    expect(
      redactSensitiveFields({
        appVersion: '1.0.0',
        screenId: 'today',
        notes: 'bad cramps today',
        symptoms: ['cramps', 'fatigue'],
        mood: 'low',
        cycleHistory: [{ date: '2026-04-09', bleeding: 'medium' }],
        nested: {
          freeformText: 'sensitive note',
          logs: [
            {
              note: 'private',
              bleeding: 'light',
            },
          ],
        },
      }),
    ).toEqual({
      appVersion: '1.0.0',
      screenId: 'today',
      notes: '[REDACTED]',
      symptoms: '[REDACTED]',
      mood: '[REDACTED]',
      cycleHistory: '[REDACTED]',
      nested: {
        freeformText: '[REDACTED]',
        logs: '[REDACTED]',
      },
    });
  });

  it('keeps primitive diagnostics intact while still redacting nested arrays', () => {
    expect(redactSensitiveFields(5)).toBe(5);
    expect(
      redactSensitiveFields([
        { screenId: 'today' },
        { note: 'private log' },
      ]),
    ).toEqual([{ screenId: 'today' }, { note: '[REDACTED]' }]);
  });

  it('redacts newly persisted cycle-profile and import-linked fields', () => {
    expect(
      redactSensitiveFields({
        cycleLengthDays: 31,
        periodLengthDays: 6,
        conditionTags: ['pcos'],
        goals: ['trying-to-conceive'],
        importSessionId: 'import-session-1',
        appState: 'ready',
      }),
    ).toEqual({
      cycleLengthDays: '[REDACTED]',
      periodLengthDays: '[REDACTED]',
      conditionTags: '[REDACTED]',
      goals: '[REDACTED]',
      importSessionId: '[REDACTED]',
      appState: 'ready',
    });
  });
});
