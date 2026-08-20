import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockDb = {
  name: 'floriva-db',
};

const mockRepositories = {
  appPreferences: {},
  userProfile: {},
  dailyLogs: {},
  reminderPreferences: {},
  privacyPreferences: {},
  importSessions: {},
  localDataMaintenance: {},
};

const mockUseMigrations = jest.fn();
const mockRepairRuntimeSchemaIfNeeded = jest.fn(() => Promise.resolve());

jest.mock('expo-sqlite', () => {
  const mockSqlite = {
    execSync: jest.fn(),
  };

  return {
    __mockSqlite: mockSqlite,
    openDatabaseSync: jest.fn(() => mockSqlite),
  };
});

jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => mockDb),
}));

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

jest.mock('@/src/db/repositories', () => ({
  createDomainRepositories: jest.fn(() => mockRepositories),
}));

jest.mock('@/src/testing/devLaunchPreset', () => ({
  resolveDevLaunchPreset: jest.fn(() => null),
  applyDevLaunchPreset: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/src/db/runtimeSchemaRepair', () => ({
  repairRuntimeSchemaIfNeeded: () => mockRepairRuntimeSchemaIfNeeded(),
}));

jest.mock('@/drizzle/migrations', () => ({
  __esModule: true,
  default: {
    journal: {
      entries: [],
    },
    migrations: {},
  },
}));

// eslint-disable-next-line import/first
import { DatabaseProvider, useDatabase } from '@/src/db/DatabaseProvider';
// eslint-disable-next-line import/first
import { openDatabaseSync } from 'expo-sqlite';
// eslint-disable-next-line import/first
import { drizzle } from 'drizzle-orm/expo-sqlite';
// eslint-disable-next-line import/first
import { createDomainRepositories } from '@/src/db/repositories';
// eslint-disable-next-line import/first
import {
  applyDevLaunchPreset,
  resolveDevLaunchPreset,
} from '@/src/testing/devLaunchPreset';

function DatabaseConsumer() {
  const { repositories } = useDatabase();

  return <Text>repositories:{String(repositories === mockRepositories)}</Text>;
}

class TestErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { errorMessage: string | null }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { errorMessage: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { errorMessage: error.message };
  }

  override render() {
    if (this.state.errorMessage) {
      return <Text>boundary:{this.state.errorMessage}</Text>;
    }

    return this.props.children;
  }
}

describe('DatabaseProvider', () => {
  beforeEach(() => {
    mockUseMigrations.mockReset();
    mockRepairRuntimeSchemaIfNeeded.mockClear();
    jest.mocked(resolveDevLaunchPreset).mockReset();
    jest.mocked(applyDevLaunchPreset).mockReset();
    jest.mocked(resolveDevLaunchPreset).mockReturnValue(null);
    jest.mocked(applyDevLaunchPreset).mockResolvedValue(undefined);
  });

  it('waits to render children until migrations succeed', () => {
    mockUseMigrations.mockReturnValue({
      success: false,
      error: undefined,
    });

    render(
      <DatabaseProvider>
        <Text>child</Text>
      </DatabaseProvider>,
    );

    expect(screen.queryByText('child')).toBeNull();
  });

  it('provides the migrated database and repository set through context', async () => {
    mockUseMigrations.mockReturnValue({
      success: true,
      error: undefined,
    });

    render(
      <DatabaseProvider>
        <DatabaseConsumer />
      </DatabaseProvider>,
    );

    const expoSqliteModule = jest.requireMock('expo-sqlite') as {
      __mockSqlite: { execSync: jest.Mock };
    };

    await waitFor(() => {
      expect(screen.getByText('repositories:true')).toBeTruthy();
    });

    expect(mockRepairRuntimeSchemaIfNeeded).toHaveBeenCalledTimes(1);
    expect(openDatabaseSync).toHaveBeenCalledWith('floriva.db');
    expect(expoSqliteModule.__mockSqlite.execSync).toHaveBeenCalledWith(
      'PRAGMA foreign_keys = ON;',
    );
    expect(drizzle).toHaveBeenCalled();
    expect(createDomainRepositories).toHaveBeenCalled();
  });

  it('throws if useDatabase is called outside the provider', () => {
    expect(() => render(<DatabaseConsumer />)).toThrow(
      'useDatabase must be used within DatabaseProvider',
    );
  });

  it('surfaces migration errors immediately', () => {
    mockUseMigrations.mockReturnValue({
      success: false,
      error: new Error('migration failed'),
    });

    expect(() =>
      render(
        <DatabaseProvider>
          <Text>child</Text>
        </DatabaseProvider>,
      ),
    ).toThrow('migration failed');
  });

  it('applies a configured dev launch preset before rendering children', async () => {
    mockUseMigrations.mockReturnValue({
      success: true,
      error: undefined,
    });
    jest.mocked(resolveDevLaunchPreset).mockReturnValue('seeded-tracker');

    render(
      <DatabaseProvider>
        <DatabaseConsumer />
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('repositories:true')).toBeTruthy();
    });

    expect(applyDevLaunchPreset).toHaveBeenCalledWith({
      preset: 'seeded-tracker',
      repositories: mockRepositories,
    });
  });

  it('surfaces preset bootstrap failures and normalizes non-Error rejections', async () => {
    mockUseMigrations.mockReturnValue({
      success: true,
      error: undefined,
    });
    jest.mocked(resolveDevLaunchPreset).mockReturnValue('seeded-tracker');
    jest.mocked(applyDevLaunchPreset).mockRejectedValueOnce('boom');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <TestErrorBoundary>
        <DatabaseProvider>
          <Text>child</Text>
        </DatabaseProvider>
      </TestErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('boundary:Dev launch preset bootstrap failed')).toBeTruthy();
    });

    consoleErrorSpy.mockRestore();
  });
});
