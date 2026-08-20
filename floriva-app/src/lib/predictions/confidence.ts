import type {
  ConfidenceReasonCode,
  LimitationCode,
  PredictionConfidence,
  PredictionResult,
  UserProfile,
} from '@/src/types/domain';

const BASE_LIMITATION_CODES: LimitationCode[] = ['on-device', 'not-medical-certainty'];

// Additive (A5): appended by buildPredictionResult.ts when the calendar
// anchor rolled forward by at least one whole cycle. Exported so the
// orchestrator can reference the same stable code rather than a magic
// string.
export const PROJECTED_FORWARD_LIMITATION_CODE: LimitationCode = 'projected-forward';

export function resolveConfidence(
  profile: UserProfile,
  historySource: PredictionResult['history']['source'],
  periodStartCount: number,
  // LT-04: true when the user's bleeding history is stale relative to today
  // -- see the inline `isHistoryStale` computation in buildPredictionResult
  // .ts for the exact trigger (the un-rolled calendar expectation >30 days
  // overdue, OR the calendar anchor rolled forward >=2 whole cycles).
  // Defaults to false so every existing caller/fixture (fresh, non-lapsed
  // history) is unaffected.
  isStale = false,
): PredictionConfidence {
  const reasonCodes: ConfidenceReasonCode[] = [];

  if (historySource === 'onboarding-seed') {
    reasonCodes.push('onboarding-seed');
    return {
      level: 'medium',
      reasonCodes,
    };
  }

  if (periodStartCount < 2) {
    reasonCodes.push('limited-bleeding-history');
    return {
      level: 'low',
      reasonCodes,
    };
  }

  if (profile.supportsIrregularCycles) {
    reasonCodes.push('irregular-cycle-support-enabled');
    return {
      level: 'medium',
      reasonCodes,
    };
  }

  // "High confidence" implies an observed rhythm. A single interval (two starts)
  // cannot establish a rhythm, so it stays medium until a third start lands.
  if (periodStartCount < 3) {
    reasonCodes.push('one-observed-interval');
    return {
      level: 'medium',
      reasonCodes,
    };
  }

  // LT-04: a user with plenty of PAST history still reaches this branch
  // (periodStartCount >= 3), but "consistent RECENT bleeding history" is
  // factually wrong once that history has gone stale -- the only
  // limitation code that used to hint at this was `projected-forward`,
  // which most users never open the confidence modal to see. Degrade one
  // level (high -> medium) and swap in the honest `stale-history` reason
  // code instead of silently keeping the "recent"-framed one. Scoped to
  // this terminal high-confidence branch only: the other branches above
  // either already read as non-high (onboarding-seed, low,
  // irregular-cycle-support-enabled, one-observed-interval) or are gated
  // before periodStartCount can reflect a real elapsed-time story, so
  // staleness has nothing dishonest to correct there.
  if (isStale) {
    reasonCodes.push('stale-history');
    return {
      level: 'medium',
      reasonCodes,
    };
  }

  reasonCodes.push('consistent-recent-bleeding-history');
  return {
    level: 'high',
    reasonCodes,
  };
}

export function resolveLimitations(
  profile: UserProfile,
  historySource: PredictionResult['history']['source'],
  periodStartCount: number,
): LimitationCode[] {
  const limitationCodes = [...BASE_LIMITATION_CODES];

  if (historySource === 'onboarding-seed') {
    limitationCodes.push('onboarding-seed-active');
  }

  if (historySource === 'bleeding-history' && periodStartCount < 2) {
    limitationCodes.push('limited-history-shift');
  }

  if (profile.supportsIrregularCycles) {
    limitationCodes.push('irregular-cycle-broader');
  }

  return limitationCodes;
}
