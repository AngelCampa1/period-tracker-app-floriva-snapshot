import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { AnomalyNudge } from '@/src/components/primitives/AnomalyNudge';
// eslint-disable-next-line import/first
import type { Anomaly, AnomalyKind } from '@/src/lib/predictions/anomalyPresentation';
// eslint-disable-next-line import/first
import { translate } from '@/src/localization/translations';

function buildAnomaly(kind: AnomalyKind): Anomaly {
  return {
    id: `${kind}:2026-04-01`,
    kind,
    anchorDateIso: '2026-04-01',
  };
}

function t(key: Parameters<typeof translate>[1]) {
  return translate('en', key);
}

describe('AnomalyNudge', () => {
  it.each<AnomalyKind>([
    'short-cycle',
    'long-cycle',
    'prolonged-bleeding',
    'missed-expected-period',
  ])('renders localized title and body copy for the %s anomaly kind', (kind) => {
    render(<AnomalyNudge anomaly={buildAnomaly(kind)} onDismiss={jest.fn()} />);

    expect(screen.getByText(t(`predictions.anomalies.${kind}.title`))).toBeTruthy();
    expect(
      screen.getByText(t(`predictions.anomalies.${kind}.body`), { exact: false }),
    ).toBeTruthy();
  });

  it('renders the shared clinician note alongside the body copy', () => {
    render(<AnomalyNudge anomaly={buildAnomaly('short-cycle')} onDismiss={jest.fn()} />);

    expect(
      screen.getByText(t('predictions.anomalies.common.clinicianNote'), { exact: false }),
    ).toBeTruthy();
  });

  it('calls onDismiss with the anomaly id when the dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const anomaly = buildAnomaly('long-cycle');

    render(<AnomalyNudge anomaly={anomaly} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByLabelText(t('predictions.anomalies.common.dismissLabel')));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(anomaly.id);
  });

  it('exposes the dismiss button with an accessible role and label', () => {
    render(<AnomalyNudge anomaly={buildAnomaly('prolonged-bleeding')} onDismiss={jest.fn()} />);

    const dismissButton = screen.getByLabelText(t('predictions.anomalies.common.dismissLabel'));

    expect(dismissButton.props.accessibilityRole).toBe('button');
  });

  it('does not call onDismiss on render', () => {
    const onDismiss = jest.fn();

    render(
      <AnomalyNudge anomaly={buildAnomaly('missed-expected-period')} onDismiss={onDismiss} />,
    );

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
