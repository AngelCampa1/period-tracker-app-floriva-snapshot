import PrivacyRoute from '../../app/(app)/privacy';
import { PrivacyExplainerScreen } from '@/src/features/privacy/screens/PrivacyExplainerScreen';

describe('privacy route', () => {
  it('renders the privacy explainer screen', () => {
    const element = PrivacyRoute();

    expect(element.type).toBe(PrivacyExplainerScreen);
  });
});
