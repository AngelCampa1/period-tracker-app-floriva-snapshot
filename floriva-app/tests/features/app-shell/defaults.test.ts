import { createDefaultPredictionSnapshot } from '@/src/features/app-shell/defaults';
import { formatPredictionLimitation } from '@/src/lib/predictions/presentation';
import { supportedLocaleValues } from '@/src/types/domain';

describe('createDefaultPredictionSnapshot', () => {
  it('localizes the placeholder limitations for a non-en locale (no hardcoded English)', () => {
    const snapshot = createDefaultPredictionSnapshot('es');

    expect(snapshot.limitations).toEqual([
      'Las predicciones se quedan en el dispositivo y se ajustan a medida que registras más entradas.',
      'Floriva muestra estimaciones, no certeza médica.',
    ]);
  });

  it('keeps the English placeholder limitations byte-identical to the pre-A5 copy', () => {
    const snapshot = createDefaultPredictionSnapshot('en');

    expect(snapshot.limitations).toEqual([
      'Predictions stay on this device and adapt as more entries are logged.',
      'Floriva shows estimates, not medical certainty.',
    ]);
  });

  it('derives placeholder limitations from the same code-keyed formatter as live snapshots, in every locale', () => {
    for (const locale of supportedLocaleValues) {
      const snapshot = createDefaultPredictionSnapshot(locale);

      expect(snapshot.limitations).toEqual([
        formatPredictionLimitation('on-device', locale),
        formatPredictionLimitation('not-medical-certainty', locale),
      ]);
    }
  });

  it('defaults to English when no locale is provided', () => {
    const snapshot = createDefaultPredictionSnapshot();

    expect(snapshot.limitations).toEqual(createDefaultPredictionSnapshot('en').limitations);
  });
});
