import {
  defaultRuntimeDiagnosticTransport,
  reportRecoverableRuntimeDiagnostic,
  reportRuntimeDiagnostic,
  setRuntimeDiagnosticTransport,
} from '@/src/lib/diagnostics/runtimeDiagnostics';

describe('runtimeDiagnostics', () => {
  beforeEach(() => {
    setRuntimeDiagnosticTransport(defaultRuntimeDiagnosticTransport);
  });

  it('uses the built-in no-op transport before a runtime transport is registered', async () => {
    setRuntimeDiagnosticTransport(defaultRuntimeDiagnosticTransport);

    await expect(
      reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: true,
        name: 'billing_refresh_failed',
        payload: {
          screenId: 'subscribe',
        },
      }),
    ).resolves.toBe(true);
  });

  it('does not emit diagnostics while consent is disabled', async () => {
    const transport = jest.fn();
    setRuntimeDiagnosticTransport(transport);

    await expect(
      reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: false,
        name: 'billing_refresh_failed',
        payload: {
          notes: 'private note',
        },
      }),
    ).resolves.toBe(false);

    expect(transport).not.toHaveBeenCalled();
  });

  it('emits redacted diagnostics when consent is enabled', async () => {
    const transport = jest.fn();
    setRuntimeDiagnosticTransport(transport);

    await expect(
      reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: true,
        name: 'billing_refresh_failed',
        payload: {
          screenId: 'subscribe',
          notes: 'private note',
          symptoms: ['cramps'],
        },
      }),
    ).resolves.toBe(true);

    expect(transport).toHaveBeenCalledWith({
      name: 'billing_refresh_failed',
      payload: {
        screenId: 'subscribe',
        notes: '[REDACTED]',
        symptoms: '[REDACTED]',
      },
    });
  });

  it('treats transport failures as best-effort and does not rethrow them', async () => {
    const transport = jest.fn().mockRejectedValue(new Error('transport down'));
    setRuntimeDiagnosticTransport(transport);

    await expect(
      reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: true,
        name: 'billing_refresh_failed',
        payload: {
          screenId: 'subscribe',
        },
      }),
    ).resolves.toBe(false);
  });

  it('emits recoverable diagnostics without leaking the raw error message', async () => {
    const transport = jest.fn();
    setRuntimeDiagnosticTransport(transport);

    await expect(
      reportRecoverableRuntimeDiagnostic({
        diagnosticsConsentEnabled: true,
        name: 'import_commit_failed',
        error: new Error('private import details'),
        payload: {
          feature: 'import',
          screenId: 'import-screen',
        },
      }),
    ).resolves.toBe(true);

    expect(transport).toHaveBeenCalledWith({
      name: 'import_commit_failed',
      payload: {
        feature: 'import',
        screenId: 'import-screen',
        errorKind: 'error',
        errorName: 'Error',
      },
    });
  });

  it('records the error kind for non-Error recoverable failures', async () => {
    const transport = jest.fn();
    setRuntimeDiagnosticTransport(transport);

    await expect(
      reportRecoverableRuntimeDiagnostic({
        diagnosticsConsentEnabled: true,
        name: 'backup_export_failed',
        error: 'disk full',
      }),
    ).resolves.toBe(true);

    expect(transport).toHaveBeenCalledWith({
      name: 'backup_export_failed',
      payload: {
        errorKind: 'string',
      },
    });
  });
});
