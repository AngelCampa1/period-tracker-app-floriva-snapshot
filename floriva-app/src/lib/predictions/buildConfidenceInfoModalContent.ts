/**
 * Pure builder for the confidence info-modal content shown on Today (see
 * `src/features/navigation/infoModal.ts` for the reusable modal
 * infrastructure this feeds). Given the prediction snapshot's confidence
 * level, reason codes, and a locale, returns a title + body explaining what
 * the current confidence level means — without implying diagnosis or
 * medical certainty.
 *
 * The modal is primarily level-scoped: per-reason detail for the ACTIONABLE
 * codes (`onboarding-seed`, `limited-bleeding-history`,
 * `one-observed-interval`) lives in the `ConfidenceImprovementList` rows
 * rendered under the confidence chip, so repeating that (imperative) copy
 * here would clash in register and duplicate what is already on screen.
 *
 * Two DESCRIPTIVE (non-actionable, non-imperative) reason codes are the
 * exception: `hormonal-birth-control` and `signals-disagree`. Neither has an
 * improvement row (they aren't actionable), so the modal is the only place a
 * user can learn why their estimate looks the way it does — the register
 * clash argument doesn't apply to descriptive copy. When either code is
 * present, one extra paragraph is appended: `[intro, general, reasonDetail]`.
 * `general` (the disclaimer) is kept as the stable second element so the
 * pre-A5 "always composes exactly [intro, general]" contract still holds as
 * a prefix -- only a 3rd paragraph is ever added, never inserted before
 * `general`.
 *
 * These two codes are mutually exclusive by construction (see
 * `buildPredictionResult.ts`): `hormonal-birth-control` is only pushed when
 * `ovulation.gated === 'hormonal-birth-control'`, which means ALL signal
 * detection was suppressed for the cycle -- so `signalsDisagree` (which
 * requires a populated, non-gated signal estimate) can never also be true.
 * At most one extra paragraph is ever added.
 */

import type { InfoModalContent } from '@/src/features/navigation/infoModal';
import { translate } from '@/src/localization/translations';
import type { ConfidenceReasonCode, PredictionSnapshot, SupportedLocale } from '@/src/types/domain';

// The only two reason codes with dedicated modal-reason copy. Both are
// descriptive/non-actionable -- see the module doc comment above.
const MODAL_REASON_CODES: readonly ConfidenceReasonCode[] = [
  'hormonal-birth-control',
  'signals-disagree',
];

export function buildConfidenceInfoModalContent(
  snapshot: Pick<PredictionSnapshot, 'confidenceLevel' | 'confidenceReasonCodes'>,
  locale: SupportedLocale = 'en',
): InfoModalContent {
  const { confidenceLevel, confidenceReasonCodes } = snapshot;

  // Mutually exclusive by construction (see module doc comment): at most one
  // of these codes can ever be present, so `find` is safe -- there is no
  // ordering ambiguity to resolve between the two.
  const modalReasonCode = confidenceReasonCodes.find((code) => MODAL_REASON_CODES.includes(code));

  return {
    title: translate(locale, `predictions.confidence.modal.title.${confidenceLevel}`),
    eyebrow: translate(locale, 'predictions.confidence.modal.eyebrow'),
    body: [
      translate(locale, `predictions.confidence.modal.intro.${confidenceLevel}`),
      translate(locale, 'predictions.confidence.modal.general'),
      ...(modalReasonCode
        ? [translate(locale, `predictions.confidence.modal.reasons.${modalReasonCode}`)]
        : []),
    ],
  };
}
