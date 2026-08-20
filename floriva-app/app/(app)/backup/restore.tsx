import { BackupScreen } from '@/src/features/backup/screens/BackupScreen';

export default function BackupRestoreRoute() {
  return <BackupScreen mode="restore-only" resultHref="/settings/data" />;
}
