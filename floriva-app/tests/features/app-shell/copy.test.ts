import { privacyPromise } from '@/src/features/app-shell/copy';

describe('app-shell copy', () => {
  it('re-exports the shared privacy promise', () => {
    expect(privacyPromise.pillars).toContain('Imports only read local files you choose');
  });
});
