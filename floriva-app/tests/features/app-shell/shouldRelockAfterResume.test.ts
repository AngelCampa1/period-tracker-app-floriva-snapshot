import { shouldRelockAfterResume } from '@/src/features/app-shell/shouldRelockAfterResume';

describe('shouldRelockAfterResume', () => {
  it('returns false when biometric lock is disabled', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: false,
        relockAfterSeconds: 60,
        backgroundedAt: 1000,
        resumedAt: 70000,
      }),
    ).toBe(false);
  });

  it('returns false when the app resumes before the timeout elapses', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 120,
        backgroundedAt: 1000,
        resumedAt: 60000,
      }),
    ).toBe(false);
  });

  it('returns true when the app resumes after the configured timeout', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        backgroundedAt: 1000,
        resumedAt: 62000,
      }),
    ).toBe(true);
  });
});
