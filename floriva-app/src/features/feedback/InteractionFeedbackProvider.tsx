import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultAppPreferences } from '@/src/db/domainDefaults';
import {
  createInteractionFeedbackAudioPlayer,
  getInteractionFeedbackHapticsModule,
} from '@/src/features/feedback/interactionFeedbackNative';
import {
  notifyInteractionFeedbackChanged,
  subscribeToInteractionFeedbackChanges,
} from '@/src/features/feedback/interactionFeedbackSync';
import type { InteractionFeedbackKind } from '@/src/types/domain';

type InteractionFeedbackContextValue = {
  isHydrated: boolean;
  hapticsEnabled: boolean;
  tapSoundEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  setTapSoundEnabled: (enabled: boolean) => Promise<void>;
  triggerPressFeedback: (kind: InteractionFeedbackKind) => Promise<void>;
};

const tapSoundAsset = require('../../../assets/sounds/tap.wav');

const InteractionFeedbackContext = createContext<InteractionFeedbackContextValue | null>(null);

export function InteractionFeedbackProvider({ children }: PropsWithChildren) {
  const { repositories } = useDatabase();
  const [hapticsEnabled, setHapticsEnabledState] = useState(
    defaultAppPreferences.hapticsEnabled,
  );
  const [tapSoundEnabled, setTapSoundEnabledState] = useState(
    defaultAppPreferences.tapSoundEnabled,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const tapSoundPlayerRef = useRef<any>(null);

  const hydrateInteractionFeedback = useCallback(async () => {
    const preferences = await repositories.appPreferences.getPreferences();

    setHapticsEnabledState(preferences.hapticsEnabled);
    setTapSoundEnabledState(preferences.tapSoundEnabled);
    setIsHydrated(true);
  }, [repositories.appPreferences]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateIfActive() {
      const preferences = await repositories.appPreferences.getPreferences();

      if (isCancelled) {
        return;
      }

      setHapticsEnabledState(preferences.hapticsEnabled);
      setTapSoundEnabledState(preferences.tapSoundEnabled);
      setIsHydrated(true);
    }

    void hydrateIfActive();

    return () => {
      isCancelled = true;
    };
  }, [repositories.appPreferences]);

  useEffect(() => {
    return subscribeToInteractionFeedbackChanges(() => {
      void hydrateInteractionFeedback();
    });
  }, [hydrateInteractionFeedback]);

  useEffect(() => {
    tapSoundPlayerRef.current = createInteractionFeedbackAudioPlayer(tapSoundAsset);

    return () => {
      tapSoundPlayerRef.current?.release?.();
      tapSoundPlayerRef.current = null;
    };
  }, []);

  const updateFeedbackPreferences = useCallback(
    async (overrides: Partial<Pick<InteractionFeedbackContextValue, never>> & {
      hapticsEnabled?: boolean;
      tapSoundEnabled?: boolean;
    }) => {
      const preferences = await repositories.appPreferences.getPreferences();
      const nextPreferences = {
        ...preferences,
        ...overrides,
      };

      await repositories.appPreferences.savePreferences(nextPreferences);

      setHapticsEnabledState(nextPreferences.hapticsEnabled);
      setTapSoundEnabledState(nextPreferences.tapSoundEnabled);
      setIsHydrated(true);
      notifyInteractionFeedbackChanged();
    },
    [repositories.appPreferences],
  );

  const setHapticsEnabled = useCallback(
    async (enabled: boolean) => {
      await updateFeedbackPreferences({ hapticsEnabled: enabled });
    },
    [updateFeedbackPreferences],
  );

  const setTapSoundEnabled = useCallback(
    async (enabled: boolean) => {
      await updateFeedbackPreferences({ tapSoundEnabled: enabled });
    },
    [updateFeedbackPreferences],
  );

  const triggerPressFeedback = useCallback(
    async (kind: InteractionFeedbackKind) => {
      if (!isHydrated) {
        return;
      }

      const feedbackPromises: Promise<unknown>[] = [];
      const hapticsModule = getInteractionFeedbackHapticsModule();

      if (
        hapticsEnabled &&
        typeof hapticsModule?.selectionAsync === 'function' &&
        typeof hapticsModule?.impactAsync === 'function'
      ) {
        feedbackPromises.push(
          kind === 'selection'
            ? Promise.resolve(hapticsModule.selectionAsync())
            : Promise.resolve(
                hapticsModule.impactAsync(hapticsModule.ImpactFeedbackStyle?.Soft ?? 'soft'),
              ),
        );
      }

      if (tapSoundEnabled) {
        if (typeof tapSoundPlayerRef.current?.seekTo === 'function') {
          tapSoundPlayerRef.current.seekTo(0);
        }

        tapSoundPlayerRef.current?.play?.();
      }

      await Promise.allSettled(feedbackPromises);
    },
    [hapticsEnabled, isHydrated, tapSoundEnabled],
  );

  const value = useMemo<InteractionFeedbackContextValue>(
    () => ({
      isHydrated,
      hapticsEnabled,
      tapSoundEnabled,
      setHapticsEnabled,
      setTapSoundEnabled,
      triggerPressFeedback,
    }),
    [
      hapticsEnabled,
      isHydrated,
      setHapticsEnabled,
      setTapSoundEnabled,
      tapSoundEnabled,
      triggerPressFeedback,
    ],
  );

  return (
    <InteractionFeedbackContext.Provider value={value}>
      {children}
    </InteractionFeedbackContext.Provider>
  );
}

export function useInteractionFeedback() {
  const context = useContext(InteractionFeedbackContext);

  if (!context) {
    throw new Error('useInteractionFeedback must be used within InteractionFeedbackProvider');
  }

  return context;
}

export function useOptionalInteractionFeedback() {
  return useContext(InteractionFeedbackContext);
}
