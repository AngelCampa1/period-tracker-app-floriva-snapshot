import { useCallback } from 'react';

import { useOptionalInteractionFeedback } from '@/src/features/feedback/InteractionFeedbackProvider';
import type { InteractionFeedbackKind } from '@/src/types/domain';

export function usePressFeedback(
  onPress: () => void,
  kind: InteractionFeedbackKind = 'action',
) {
  const interactionFeedback = useOptionalInteractionFeedback();

  return useCallback(() => {
    onPress();
    void interactionFeedback?.triggerPressFeedback(kind);
  }, [interactionFeedback, kind, onPress]);
}
