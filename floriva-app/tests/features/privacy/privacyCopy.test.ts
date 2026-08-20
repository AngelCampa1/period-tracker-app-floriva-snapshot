import {
  lockScreenCopy,
  privacyExplainerSections,
  privacyPromise,
} from '@/src/features/privacy/copy';

describe('privacy copy', () => {
  it('keeps the privacy promise anchored to local-only claims', () => {
    expect(privacyPromise).toEqual({
      eyebrow: 'Privacy-first period tracker',
      title: 'Private by default. Useful offline.',
      body:
        'Floriva keeps your cycle history on your device. Accounts and cloud storage are off by default.',
      pillars: [
        'On-device by default',
        'No account required',
        'Imports only read local files you choose',
      ],
      footnote:
        'Floriva offers cycle tracking and predictions, not medical advice or treatment.',
    });
  });

  it('shares the settings and explainer claims from one module', () => {
    expect(privacyExplainerSections.deviceStorage.title).toBe('Device storage');
    expect(privacyExplainerSections.deviceStorage.body).toBe(
      'Cycle history, reminder preferences, and lock settings live on this device.',
    );
    expect(privacyExplainerSections.imports.title).toBe('Imports');
    expect(privacyExplainerSections.imports.body).toBe(
      'Imports only open the file you choose. Floriva does not scan your storage or upload that file.',
    );
    expect(privacyExplainerSections.deviceSecurity.title).toBe('Device security');
    expect(privacyExplainerSections.deviceSecurity.body).toBe(
      'Biometric lock uses your device security.',
    );
    // Apple brand names must not be baked into platform-neutral copy.
    expect(privacyExplainerSections.deviceSecurity.body).not.toMatch(/Face ID|Touch ID/);
    expect(privacyExplainerSections.deleteLocalData.title).toBe('Delete local data');
    expect(privacyExplainerSections.deleteLocalData.body).toBe(
      'This removes your cycle history, reminders, and lock data.',
    );
    expect(privacyExplainerSections.uninstalling.title).toBe('Uninstalling the app');
    expect(privacyExplainerSections.uninstalling.body).toBe(
      'Uninstalling Floriva may permanently remove data stored on this device.',
    );
  });

  it('distinguishes unavailable and cancelled lock messaging', () => {
    expect(lockScreenCopy.unavailableBody).toBe(
      "Your device needs security set up before you can unlock Floriva.",
    );
    expect(lockScreenCopy.cancelledBody).toBe(
      'You cancelled the unlock.',
    );
    expect(lockScreenCopy.unavailableBody).not.toBe(lockScreenCopy.cancelledBody);
  });
});
