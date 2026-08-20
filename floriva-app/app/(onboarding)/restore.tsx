import { BackupScreen } from '@/src/features/backup/screens/BackupScreen';
import { useLocalization } from '@/src/localization/LocalizationProvider';

export default function RestoreBackupRoute() {
  const { resolvedLocale } = useLocalization();
  const backLabels = {
    en: 'Back to path choice',
    es: 'Volver a la ruta inicial',
    de: 'Zurück zur Startoption',
    fr: 'Retour au choix de départ',
    ja: '開始方法の選択に戻る',
    'zh-Hans': '返回开始方式',
    pt: 'Voltar à forma de começar',
    ru: 'Назад к выбору старта',
  } as const;

  return (
    <BackupScreen
      backHref="/start-path"
      backLabel={backLabels[resolvedLocale]}
      mode="restore-only"
      resultHref="/notifications"
    />
  );
}
