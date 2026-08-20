import { useLocalSearchParams } from 'expo-router';

import { CalendarDayScreen } from '@/src/features/calendar/screens/CalendarDayScreen';

export default function CalendarDayRoute() {
  const { date, quick } = useLocalSearchParams<{ date?: string; quick?: string }>();

  return <CalendarDayScreen selectedDate={date} quick={quick} />;
}
