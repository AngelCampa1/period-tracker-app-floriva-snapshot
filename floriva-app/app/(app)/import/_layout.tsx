import { Stack } from 'expo-router';

import { ImportFlowProvider } from '@/src/features/import/ImportFlowProvider';

export default function AppImportLayout() {
  return (
    <ImportFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ImportFlowProvider>
  );
}
