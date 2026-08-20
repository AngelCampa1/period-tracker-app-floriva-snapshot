import { prepareDiagnosticsPayload } from '@/src/lib/diagnostics/prepareDiagnosticsPayload';

describe('prepareDiagnosticsPayload', () => {
  it('returns null while diagnostics consent is disabled', () => {
    expect(
      prepareDiagnosticsPayload({
        diagnosticsConsentEnabled: false,
        payload: {
          screenId: 'today',
          notes: 'private note',
        },
      }),
    ).toBeNull();
  });

  it('redacts sensitive reproductive data before a diagnostics payload leaves the device', () => {
    expect(
      prepareDiagnosticsPayload({
        diagnosticsConsentEnabled: true,
        payload: {
          screenId: 'today',
          notes: 'private note',
          symptoms: ['cramps'],
          nested: {
            freeformText: 'sensitive',
          },
        },
      }),
    ).toEqual({
      screenId: 'today',
      notes: '[REDACTED]',
      symptoms: '[REDACTED]',
      nested: {
        freeformText: '[REDACTED]',
      },
    });
  });
});
