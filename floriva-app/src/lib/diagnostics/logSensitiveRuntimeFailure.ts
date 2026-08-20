type LogSensitiveRuntimeFailureOptions = {
  event: string;
  error: unknown;
  environment?: string | undefined;
  logger?: (message?: unknown, ...optionalParams: unknown[]) => void;
};

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return 'NonError';
}

export function logSensitiveRuntimeFailure({
  event,
  error,
  environment = process.env.NODE_ENV,
  logger = console.error,
}: LogSensitiveRuntimeFailureOptions) {
  if (environment === 'test') {
    return;
  }

  logger(`[Floriva:${event}]`, {
    errorName: getErrorName(error),
  });
}
