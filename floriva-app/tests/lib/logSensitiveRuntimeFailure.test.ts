import { logSensitiveRuntimeFailure } from '@/src/lib/diagnostics/logSensitiveRuntimeFailure';

describe('logSensitiveRuntimeFailure', () => {
  it('suppresses sensitive runtime failures in test environments', () => {
    const logger = jest.fn();

    logSensitiveRuntimeFailure({
      event: 'import_commit_failed',
      error: new Error('EACCES: permission denied, open /private/user/export.json'),
      environment: 'test',
      logger,
    });

    expect(logger).not.toHaveBeenCalled();
  });

  it('logs only a sanitized error summary outside tests', () => {
    const logger = jest.fn();

    logSensitiveRuntimeFailure({
      event: 'backup_export_failed',
      error: new TypeError('disk full while exporting cycle history'),
      environment: 'development',
      logger,
    });

    expect(logger).toHaveBeenCalledWith('[Floriva:backup_export_failed]', {
      errorName: 'TypeError',
    });
  });

  it('handles non-Error throw values without exposing their contents', () => {
    const logger = jest.fn();

    logSensitiveRuntimeFailure({
      event: 'ttc_expectations_save_failed',
      error: 'raw private failure payload',
      environment: 'development',
      logger,
    });

    expect(logger).toHaveBeenCalledWith('[Floriva:ttc_expectations_save_failed]', {
      errorName: 'NonError',
    });
  });
});
