import { useLocalSearchParams } from 'expo-router';

import { InsightsConditionScreen } from '@/src/features/insights/screens/InsightsConditionScreen';

export default function InsightsConditionRoute() {
  const { conditionKey } = useLocalSearchParams<{ conditionKey?: string }>();

  return <InsightsConditionScreen conditionKey={conditionKey} />;
}
