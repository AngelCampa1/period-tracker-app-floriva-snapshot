import { Stack } from 'expo-router';

import { ImportFlowProvider } from '@/src/features/import/ImportFlowProvider';

export default function OnboardingImportLayout() {
  return (
    <ImportFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ImportFlowProvider>
  );
}
