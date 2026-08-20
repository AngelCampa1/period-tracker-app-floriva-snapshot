import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { florivaDb } from '@/src/db/client';
import { createDomainRepositories } from '@/src/db/repositories';
import { repairRuntimeSchemaIfNeeded } from '@/src/db/runtimeSchemaRepair';
import { applyDevLaunchPreset, resolveDevLaunchPreset } from '@/src/testing/devLaunchPreset';

type DatabaseContextValue = {
  db: typeof florivaDb;
  repositories: ReturnType<typeof createDomainRepositories>;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(florivaDb, migrations);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);
  const [isBootstrapReady, setIsBootstrapReady] = useState(false);
  const value = useMemo<DatabaseContextValue>(
    () => ({
      db: florivaDb,
      repositories: createDomainRepositories(florivaDb),
    }),
    [],
  );

  useEffect(() => {
    if (!success) {
      return;
    }

    let isCancelled = false;

    async function bootstrapLaunchPreset() {
      try {
        await repairRuntimeSchemaIfNeeded();

        const preset = resolveDevLaunchPreset();

        if (preset) {
          await applyDevLaunchPreset({
            preset,
            repositories: value.repositories,
          });
        }

        if (!isCancelled) {
          setIsBootstrapReady(true);
        }
      } catch (bootstrapFailure) {
        if (!isCancelled) {
          setBootstrapError(
            bootstrapFailure instanceof Error
              ? bootstrapFailure
              : new Error('Dev launch preset bootstrap failed'),
          );
        }
      }
    }

    void bootstrapLaunchPreset();

    return () => {
      isCancelled = true;
    };
  }, [success, value.repositories]);

  if (error) {
    throw error;
  }

  if (bootstrapError) {
    throw bootstrapError;
  }

  if (!success || !isBootstrapReady) {
    return null;
  }

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }

  return context;
}
