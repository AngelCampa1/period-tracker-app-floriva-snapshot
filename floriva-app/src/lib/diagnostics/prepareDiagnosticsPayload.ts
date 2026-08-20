import { redactSensitiveFields } from '@/src/lib/diagnostics/redactSensitiveFields';

type PrepareDiagnosticsPayloadOptions<TPayload> = {
  diagnosticsConsentEnabled: boolean;
  payload: TPayload;
};

export function prepareDiagnosticsPayload<TPayload>({
  diagnosticsConsentEnabled,
  payload,
}: PrepareDiagnosticsPayloadOptions<TPayload>) {
  if (!diagnosticsConsentEnabled) {
    return null;
  }

  return redactSensitiveFields(payload);
}
