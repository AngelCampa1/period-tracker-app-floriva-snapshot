import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockStack = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: MockText } = require('react-native');

  return {
    Stack: (props: { screenOptions: unknown }) => {
      mockStack(props);

      return <MockText>settings-stack</MockText>;
    },
  };
});

// eslint-disable-next-line import/first
import SettingsLayout from '@/app/(app)/settings/_layout';

describe('Settings layout', () => {
  beforeEach(() => {
    mockStack.mockClear();
  });

  it('keeps settings routes in a plain native stack', () => {
    render(<SettingsLayout />);

    expect(screen.getByText('settings-stack')).toBeTruthy();
    expect(mockStack).toHaveBeenCalledWith({
      screenOptions: { headerShown: false },
    });
  });
});
