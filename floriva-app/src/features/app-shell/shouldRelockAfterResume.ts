type ShouldRelockAfterResumeOptions = {
  biometricsEnabled: boolean;
  relockAfterSeconds: number;
  backgroundedAt: number | null;
  resumedAt: number;
};

export function shouldRelockAfterResume({
  biometricsEnabled,
  relockAfterSeconds,
  backgroundedAt,
  resumedAt,
}: ShouldRelockAfterResumeOptions) {
  if (!biometricsEnabled || backgroundedAt === null) {
    return false;
  }

  // Fail CLOSED on an invalid threshold. A corrupted/migrated preference could
  // arrive as NaN or negative; `NaN >= x` is always false, which would silently
  // disable relock for the whole session (fail-open). Treat any non-finite or
  // negative threshold as "relock immediately" so a broken value can never
  // leave biometrics-enabled data unprotected after backgrounding.
  if (!Number.isFinite(relockAfterSeconds) || relockAfterSeconds < 0) {
    return true;
  }

  return resumedAt - backgroundedAt >= relockAfterSeconds * 1000;
}
