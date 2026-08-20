import { requireOptionalNativeModule } from 'expo-modules-core';

type InteractionFeedbackAudioPlayer = {
  play?: () => void;
  release?: () => void;
  seekTo?: (positionMillis: number) => void;
};

type InteractionFeedbackAudioModule = {
  createAudioPlayer: (asset: number) => InteractionFeedbackAudioPlayer;
};

type InteractionFeedbackHapticsModule = {
  ImpactFeedbackStyle?: {
    Soft?: unknown;
  };
  impactAsync?: (style: unknown) => Promise<unknown> | unknown;
  selectionAsync?: () => Promise<unknown> | unknown;
};

let cachedAudioModule: InteractionFeedbackAudioModule | null | undefined;
let cachedHapticsModule: InteractionFeedbackHapticsModule | null | undefined;

function loadOptionalAudioModule() {
  if (!requireOptionalNativeModule('ExpoAudio')) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-audio') as InteractionFeedbackAudioModule;
  } catch {
    return null;
  }
}

function loadOptionalHapticsModule() {
  if (!requireOptionalNativeModule('ExpoHaptics')) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-haptics') as InteractionFeedbackHapticsModule;
  } catch {
    return null;
  }
}

export function createInteractionFeedbackAudioPlayer(
  asset: number,
): InteractionFeedbackAudioPlayer | null {
  if (cachedAudioModule === undefined) {
    cachedAudioModule = loadOptionalAudioModule();
  }

  if (!cachedAudioModule) {
    return null;
  }

  try {
    return cachedAudioModule.createAudioPlayer(asset);
  } catch {
    return null;
  }
}

export function getInteractionFeedbackHapticsModule() {
  if (cachedHapticsModule === undefined) {
    cachedHapticsModule = loadOptionalHapticsModule();
  }

  return cachedHapticsModule;
}
