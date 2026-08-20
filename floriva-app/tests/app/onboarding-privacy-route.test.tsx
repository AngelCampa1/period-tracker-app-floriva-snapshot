import { render, screen } from '@testing-library/react-native';

import OnboardingPrivacyRoute from '../../app/(onboarding)/privacy-details';
import { t } from '@/tests/helpers/localization';

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

describe('onboarding privacy route', () => {
  it('renders the privacy explainer with onboarding navigation copy', () => {
    render(<OnboardingPrivacyRoute />);

    expect(screen.getByText(t('privacy.promise.eyebrow'))).toBeTruthy();
    expect(screen.getByText(t('privacy.explainer.backToWelcome'))).toBeTruthy();
  });
});
