import { renderRouter, screen } from 'expo-router/testing-library';

import WelcomeRoute from '../../app/(onboarding)/welcome';
import { testIds } from '../../src/testing/testIds';

describe('app smoke render', () => {
  it('renders the Floriva onboarding entry route through Expo Router', () => {
    renderRouter(
      {
        welcome: WelcomeRoute,
      },
      {
        initialUrl: '/welcome',
      },
    );

    expect(screen.getByText('tracker')).toBeTruthy();
    expect(screen.getByText('On-device by default')).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.welcome.screen)).toBeTruthy();
  });
});
