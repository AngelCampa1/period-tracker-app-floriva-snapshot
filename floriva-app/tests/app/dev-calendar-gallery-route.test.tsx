import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, `redirect:${href}`),
  };
});

jest.mock('@/src/features/calendar/screens/DevCalendarGalleryScreen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    DevCalendarGalleryScreen: () =>
      React.createElement(Text, null, 'mock-dev-calendar-gallery-screen'),
  };
});

// eslint-disable-next-line import/first
import DevCalendarGalleryRoute from '@/app/(app)/dev-calendar-gallery';

const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };

describe('dev-calendar-gallery route', () => {
  const originalDevFlag = devGlobal.__DEV__;

  afterEach(() => {
    devGlobal.__DEV__ = originalDevFlag;
  });

  it('renders the gallery screen in dev builds', () => {
    devGlobal.__DEV__ = true;

    render(<DevCalendarGalleryRoute />);

    expect(screen.getByText('mock-dev-calendar-gallery-screen')).toBeTruthy();
    expect(screen.queryByText('redirect:/calendar')).toBeNull();
  });

  it('redirects to the calendar tab when __DEV__ is false (production bundle safety)', () => {
    devGlobal.__DEV__ = false;

    render(<DevCalendarGalleryRoute />);

    expect(screen.getByText('redirect:/calendar')).toBeTruthy();
    expect(screen.queryByText('mock-dev-calendar-gallery-screen')).toBeNull();
  });
});
