import { predictionsMessages } from '@/src/localization/messages/predictions';
import {
  confidenceReasonCodeValues,
  limitationCodeValues,
  predictionConfidenceLevelValues,
  supportedLocaleValues,
} from '@/src/types/domain';

import { bannedMedicalTermsByLocale } from '../helpers/bannedMedicalTerms';

const anomalyKinds = [
  'short-cycle',
  'long-cycle',
  'prolonged-bleeding',
  'missed-expected-period',
] as const;

describe('predictionsMessages', () => {
  it('defines every supported locale', () => {
    for (const locale of supportedLocaleValues) {
      expect(predictionsMessages).toHaveProperty(locale);
    }
    expect(Object.keys(predictionsMessages)).toHaveLength(supportedLocaleValues.length);
  });

  it('defines a non-empty reason label for every reason code in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const catalog = predictionsMessages[locale];

      for (const code of confidenceReasonCodeValues) {
        const label = catalog.predictions.confidence.reasons[code];

        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('defines modal title and intro copy for every confidence level in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const modal = predictionsMessages[locale].predictions.confidence.modal;

      for (const level of predictionConfidenceLevelValues) {
        expect(modal.title[level].length).toBeGreaterThan(0);
        expect(modal.intro[level].length).toBeGreaterThan(0);
      }

      expect(modal.eyebrow.length).toBeGreaterThan(0);
      expect(modal.general.length).toBeGreaterThan(0);
    }
  });

  it('never implies diagnosis or medical certainty in any locale', () => {
    for (const locale of supportedLocaleValues) {
      const { reasons, modal } = predictionsMessages[locale].predictions.confidence;
      const allCopy = [
        ...Object.values(reasons),
        modal.eyebrow,
        ...Object.values(modal.title),
        ...Object.values(modal.intro),
        modal.general,
      ].join(' ');

      expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
    }
  });

  it('defines a non-empty limitation label for every limitation code in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const catalog = predictionsMessages[locale];

      for (const code of limitationCodeValues) {
        const label = catalog.predictions.limitations[code];

        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it('never implies diagnosis or medical certainty in any limitation label', () => {
    for (const locale of supportedLocaleValues) {
      const allCopy = Object.values(predictionsMessages[locale].predictions.limitations).join(' ');

      expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
    }
  });

  it('defines the two modal-reason paragraphs (hormonal-birth-control, signals-disagree) in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const { reasons } = predictionsMessages[locale].predictions.confidence.modal;

      expect(reasons['hormonal-birth-control'].length).toBeGreaterThan(0);
      expect(reasons['signals-disagree'].length).toBeGreaterThan(0);
    }
  });

  it('never implies diagnosis or medical certainty in the modal-reason paragraphs', () => {
    for (const locale of supportedLocaleValues) {
      const { reasons } = predictionsMessages[locale].predictions.confidence.modal;
      const allCopy = [reasons['hormonal-birth-control'], reasons['signals-disagree']].join(' ');

      expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
    }
  });

  describe('anomalies', () => {
    it('defines a non-empty title and body for every anomaly kind in every locale', () => {
      for (const locale of supportedLocaleValues) {
        const anomalies = predictionsMessages[locale].predictions.anomalies;

        for (const kind of anomalyKinds) {
          expect(anomalies[kind].title.trim().length).toBeGreaterThan(0);
          expect(anomalies[kind].body.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('defines a non-empty shared clinician note and dismiss label in every locale', () => {
      for (const locale of supportedLocaleValues) {
        const { common } = predictionsMessages[locale].predictions.anomalies;

        expect(common.clinicianNote.trim().length).toBeGreaterThan(0);
        expect(common.dismissLabel.trim().length).toBeGreaterThan(0);
      }
    });

    it('never implies diagnosis, abnormality, or medical certainty in any locale', () => {
      for (const locale of supportedLocaleValues) {
        const { anomalies } = predictionsMessages[locale].predictions;
        const allCopy = [
          ...anomalyKinds.flatMap((kind) => [anomalies[kind].title, anomalies[kind].body]),
          anomalies.common.clinicianNote,
          anomalies.common.dismissLabel,
        ].join(' ');

        expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
      }
    });
  });

  // LT-24: Today's stale-prediction hedge copy (replaces the fertile-window
  // headline/caption once `stale-history` fires -- see buildTodaySnapshot.ts).
  describe('today.staleHeadline / today.staleCaption (LT-24)', () => {
    it('defines a non-empty stale headline and caption in every locale', () => {
      for (const locale of supportedLocaleValues) {
        const { today } = predictionsMessages[locale].predictions;

        expect(today.staleHeadline.trim().length).toBeGreaterThan(0);
        expect(today.staleCaption.trim().length).toBeGreaterThan(0);
      }
    });

    it('never asserts an active fertile window or a confident cycle-day claim', () => {
      // The whole point of this copy is to NOT repeat the claim it replaces
      // -- guard against a future edit accidentally re-introducing
      // "fertile"/"ovulat*" language into the neutral stale acknowledgment.
      for (const locale of supportedLocaleValues) {
        const { today } = predictionsMessages[locale].predictions;
        const allCopy = `${today.staleHeadline} ${today.staleCaption}`.toLowerCase();

        expect(allCopy).not.toMatch(/fertile|fértil|fruchtbar|fertile|妊娠|排卵|受孕|生育/);
      }
    });

    it('never implies diagnosis or medical certainty in any locale', () => {
      for (const locale of supportedLocaleValues) {
        const { today } = predictionsMessages[locale].predictions;
        const allCopy = [today.staleHeadline, today.staleCaption].join(' ');

        expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
      }
    });
  });
});
