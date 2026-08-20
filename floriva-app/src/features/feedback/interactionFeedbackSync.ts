const interactionFeedbackListeners = new Set<() => void>();

export function subscribeToInteractionFeedbackChanges(listener: () => void) {
  interactionFeedbackListeners.add(listener);

  return () => {
    interactionFeedbackListeners.delete(listener);
  };
}

export function notifyInteractionFeedbackChanged() {
  for (const listener of interactionFeedbackListeners) {
    listener();
  }
}
