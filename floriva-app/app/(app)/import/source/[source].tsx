import { useLocalSearchParams } from 'expo-router';

import { ImportSourceStepScreen } from '@/src/features/import/screens/ImportFlowScreens';

export default function AppImportSourceRoute() {
  const { source } = useLocalSearchParams<{ source?: string }>();

  return <ImportSourceStepScreen source={source ?? ''} variant="app" />;
}
