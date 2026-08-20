import { buildConfidenceInfoModalContent } from '@/src/lib/predictions/buildConfidenceInfoModalContent';
import {
  predictionConfidenceLevelValues,
  supportedLocaleValues,
} from '@/src/types/domain';
import type { PredictionSnapshot } from '@/src/types/domain';

import { bannedMedicalTermsByLocale } from '../../helpers/bannedMedicalTerms';

function buildSnapshot(overrides: Partial<PredictionSnapshot> = {}): PredictionSnapshot {
  return {
    cycleDay: 12,
    cycleLengthDays: 28,
    periodLengthDays: 5,
    cycleDayLabel: 'Cycle day 12',
    fertileWindowLabel: 'Fertile window active today',
    fertileWindowStartOffsetDays: 9,
    confidenceLevel: 'medium',
    confidenceLabel: 'Medium confidence',
    confidenceBasisLabel: 'Based on 2 local cycle starts',
    confidenceReasonCodes: ['one-observed-interval'],
    limitations: [],
    ...overrides,
  };
}

describe('buildConfidenceInfoModalContent', () => {
  it('returns level-scoped title, eyebrow, and an [intro, general] body for low confidence', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({ confidenceLevel: 'low' }),
      'en',
    );

    expect(content.title).toBe('Why confidence is low');
    expect(content.eyebrow).toBe('How confidence works');
    expect(content.body).toEqual([
      'Confidence is low because there isn’t much local cycle history to compare yet.',
      'Confidence reflects how much on-device cycle history backs an estimate. It is not a medical measurement — it only describes how much the estimate might still move.',
    ]);
  });

  it('returns level-scoped content for medium confidence', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({ confidenceLevel: 'medium' }),
      'en',
    );

    expect(content.title).toBe('Why confidence is medium');
    expect((content.body as string[])[0]).toBe(
      'Confidence is medium — Floriva has some local cycle history, but timing may still shift.',
    );
  });

  it('returns level-scoped content for high confidence', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({ confidenceLevel: 'high' }),
      'en',
    );

    expect(content.title).toBe('Why confidence is high');
    expect((content.body as string[])[0]).toBe(
      'Confidence is high because recent local cycle history has been consistent.',
    );
  });

  it('always composes exactly [intro, general] when no modal-reason code is present — reason detail belongs to the improvement rows, not the modal', () => {
    for (const level of predictionConfidenceLevelValues) {
      const content = buildConfidenceInfoModalContent(
        buildSnapshot({ confidenceLevel: level, confidenceReasonCodes: ['one-observed-interval'] }),
        'en',
      );

      expect(content.body).toHaveLength(2);
      expect((content.body as string[])[1]).toContain(
        'Confidence reflects how much on-device cycle history backs an estimate.',
      );
    }
  });

  it('appends a 3rd paragraph explaining hormonal-birth-control gating, keeping [intro, general] as a stable prefix', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({
        confidenceLevel: 'medium',
        confidenceReasonCodes: ['hormonal-birth-control'],
      }),
      'en',
    );

    expect(content.body).toHaveLength(3);
    expect((content.body as string[])[0]).toBe(
      'Confidence is medium — Floriva has some local cycle history, but timing may still shift.',
    );
    expect((content.body as string[])[1]).toContain(
      'Confidence reflects how much on-device cycle history backs an estimate.',
    );
    expect((content.body as string[])[2]).toBe(
      'Your birth-control method limits the cycle signals Floriva can use to refine ovulation timing, so this estimate relies on calendar history instead.',
    );
  });

  it('appends a 3rd paragraph explaining signals-disagree, keeping [intro, general] as a stable prefix', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({
        confidenceLevel: 'high',
        confidenceReasonCodes: ['consistent-recent-bleeding-history', 'signals-disagree'],
      }),
      'en',
    );

    expect(content.body).toHaveLength(3);
    expect((content.body as string[])[2]).toBe(
      'Your logged signals pointed in slightly different directions this cycle, so Floriva kept this estimate cautious rather than picking one signal over another.',
    );
  });

  it('does not append a reason paragraph for the positive ovulation-signal-confirmed code (descriptive but not a modal-reason code)', () => {
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({
        confidenceLevel: 'high',
        confidenceReasonCodes: ['consistent-recent-bleeding-history', 'ovulation-signal-confirmed'],
      }),
      'en',
    );

    expect(content.body).toHaveLength(2);
  });

  it('never surfaces both hormonal-birth-control and signals-disagree at once (mutually exclusive by construction in buildPredictionResult.ts) — only the first match adds a paragraph', () => {
    // Defensive test: even if a caller somehow constructed both codes together
    // (which the engine never does -- see buildPredictionResult.ts), the modal
    // must still add at most one extra paragraph rather than two.
    const content = buildConfidenceInfoModalContent(
      buildSnapshot({
        confidenceLevel: 'medium',
        confidenceReasonCodes: ['hormonal-birth-control', 'signals-disagree'],
      }),
      'en',
    );

    expect(content.body).toHaveLength(3);
  });

  it('resolves modal content in every supported locale for every confidence level, without banned medical terms', () => {
    for (const locale of supportedLocaleValues) {
      for (const level of predictionConfidenceLevelValues) {
        const content = buildConfidenceInfoModalContent(
          buildSnapshot({ confidenceLevel: level }),
          locale,
        );

        expect(content.title.length).toBeGreaterThan(0);
        expect(content.body).toHaveLength(2);

        const allCopy = [content.title, content.eyebrow ?? '', ...(content.body as string[])].join(
          ' ',
        );

        expect(allCopy).not.toMatch(bannedMedicalTermsByLocale[locale]);
      }
    }
  });

  it('resolves both modal-reason paragraphs in every supported locale without banned medical terms', () => {
    for (const locale of supportedLocaleValues) {
      for (const code of ['hormonal-birth-control', 'signals-disagree'] as const) {
        const content = buildConfidenceInfoModalContent(
          buildSnapshot({ confidenceLevel: 'medium', confidenceReasonCodes: [code] }),
          locale,
        );

        expect(content.body).toHaveLength(3);
        const reasonParagraph = (content.body as string[])[2];
        expect(reasonParagraph.length).toBeGreaterThan(0);
        expect(reasonParagraph).not.toMatch(bannedMedicalTermsByLocale[locale]);
      }
    }
  });

  it('defaults to English when no locale is provided', () => {
    const content = buildConfidenceInfoModalContent(buildSnapshot({ confidenceLevel: 'high' }));

    expect(content.title).toBe('Why confidence is high');
  });
});
