import { prepareDiagnosticsPayload } from '@/src/lib/diagnostics/prepareDiagnosticsPayload';

type RuntimeDiagnosticTransport = (event: {
  name: string;
  payload: unknown;
}) => void | Promise<void>;

type ReportRuntimeDiagnosticOptions<TPayload> = {
  diagnosticsConsentEnabled: boolean;
  name: string;
  payload: TPayload;
};

type ReportRecoverableRuntimeDiagnosticOptions<TPayload extends Record<string, unknown>> = {
  diagnosticsConsentEnabled: boolean;
  name: string;
  error: unknown;
  payload?: TPayload;
};

export const defaultRuntimeDiagnosticTransport: RuntimeDiagnosticTransport = async () => undefined;

let runtimeDiagnosticTransport: RuntimeDiagnosticTransport = defaultRuntimeDiagnosticTransport;

export function setRuntimeDiagnosticTransport(transport: RuntimeDiagnosticTransport) {
  runtimeDiagnosticTransport = transport;
}

export async function reportRuntimeDiagnostic<TPayload>({
  diagnosticsConsentEnabled,
  name,
  payload,
}: ReportRuntimeDiagnosticOptions<TPayload>) {
  const preparedPayload = prepareDiagnosticsPayload({
    diagnosticsConsentEnabled,
    payload,
  });

  if (!preparedPayload) {
    return false;
  }

  try {
    await runtimeDiagnosticTransport({
      name,
      payload: preparedPayload,
    });
  } catch {
    return false;
  }

  return true;
}

function buildRecoverableErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      errorKind: 'error',
      errorName: error.name || 'Error',
    };
  }

  return {
    errorKind: typeof error,
  };
}

export function reportRecoverableRuntimeDiagnostic<TPayload extends Record<string, unknown>>({
  diagnosticsConsentEnabled,
  name,
  error,
  payload,
}: ReportRecoverableRuntimeDiagnosticOptions<TPayload>) {
  return reportRuntimeDiagnostic({
    diagnosticsConsentEnabled,
    name,
    payload: {
      ...(payload ?? ({} as TPayload)),
      ...buildRecoverableErrorPayload(error),
    },
  });
}
