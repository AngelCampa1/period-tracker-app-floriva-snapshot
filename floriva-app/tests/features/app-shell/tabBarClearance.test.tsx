import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import {
  nativeTabBarClearance,
  TabBarClearanceProvider,
  useTabBarClearance,
} from '@/src/features/app-shell/tabBarClearance';

function Probe() {
  return <Text testID="clearance">{useTabBarClearance()}</Text>;
}

describe('tabBarClearance', () => {
  it('returns 0 outside the tab navigator (no provider)', () => {
    render(<Probe />);

    expect(screen.getByTestId('clearance').props.children).toBe(0);
  });

  it('returns the tab layout default clearance when wrapped without an explicit value', () => {
    render(
      <TabBarClearanceProvider>
        <Probe />
      </TabBarClearanceProvider>,
    );

    expect(screen.getByTestId('clearance').props.children).toBe(nativeTabBarClearance);
    expect(nativeTabBarClearance).toBeGreaterThan(0);
  });

  it('passes an explicit clearance value through the provider', () => {
    render(
      <TabBarClearanceProvider value={88}>
        <Probe />
      </TabBarClearanceProvider>,
    );

    expect(screen.getByTestId('clearance').props.children).toBe(88);
  });
});
