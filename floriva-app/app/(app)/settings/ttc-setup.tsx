/* istanbul ignore file */

import { TtcSetupScreen } from '@/src/features/onboarding/screens/TtcSetupScreen';

export default function SettingsTtcSetupRoute() {
  return <TtcSetupScreen nextHref="/settings/ttc-expectations" />;
}
