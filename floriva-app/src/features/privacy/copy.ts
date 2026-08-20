export const privacyPromise = {
  eyebrow: 'Privacy-first period tracker',
  title: 'Private by default. Useful offline.',
  body: 'Floriva keeps your cycle history on your device. Accounts and cloud storage are off by default.',
  pillars: [
    'On-device by default',
    'No account required',
    'Imports only read local files you choose',
  ],
  footnote:
    'Floriva offers cycle tracking and predictions, not medical advice or treatment.',
} as const;

export const privacyExplainerSections = {
  deviceStorage: {
    title: 'Device storage',
    body: 'Cycle history, reminder preferences, and lock settings live on this device.',
  },
  imports: {
    title: 'Imports',
    body: 'Imports only open the file you choose. Floriva does not scan your storage or upload that file.',
  },
  deviceSecurity: {
    title: 'Device security',
    body: 'Biometric lock uses your device security.',
  },
  deleteLocalData: {
    title: 'Delete local data',
    body: 'This removes your cycle history, reminders, and lock data.',
  },
  uninstalling: {
    title: 'Uninstalling the app',
    body: 'Uninstalling Floriva may permanently remove data stored on this device.',
  },
} as const;

export const lockScreenCopy = {
  eyebrow: 'Privacy controls',
  title: 'Floriva is locked',
  description: 'Unlock with your device security.',
  localUnlockTitle: 'Local unlock',
  localUnlockBody: 'Floriva uses the biometric unlock your phone already supports.',
  unavailableBody:
    "Your device needs security set up before you can unlock Floriva.",
  cancelledBody: 'You cancelled the unlock.',
  failureBody: 'Unlock could not be completed.',
  unlockButtonLabel: 'Unlock with device security',
} as const;
