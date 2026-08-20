export const privacyMessages = {
  en: {
    privacy: {
      promise: {
        eyebrow: 'Privacy-first period tracker',
        title: 'Private by default. Useful offline.',
        body:
          'Floriva keeps your cycle history on your device. Accounts and cloud storage are off by default.',
        pillars: {
          onDevice: 'On-device by default',
          noAccount: 'No account required',
          localImports: 'Imports only read local files you choose',
        },
        footnote: 'Floriva offers cycle tracking and predictions, not medical advice or treatment.',
      },
      explainer: {
        backToSettings: 'Back to settings',
        backToWelcome: 'Back to welcome',
        whatFlorivaPromises: 'What Floriva promises',
        deviceStorage: {
          title: 'Device storage',
          body: 'Cycle history, reminder preferences, and lock settings are saved on this device.',
        },
        imports: {
          title: 'Imports',
          body: 'Imports only open the file you choose. Floriva does not scan your storage or upload that file.',
        },
        deviceSecurity: {
          title: 'Device security',
          body:
            'Biometric lock uses the {biometric} already set up on your device.',
        },
        deleteLocalData: {
          title: 'Delete local data',
          body:
            'Deleting local data removes cycle history, reminder schedules, and lock data from this device.',
        },
        uninstalling: {
          title: 'Uninstalling the app',
          body:
            'Uninstalling Floriva may permanently remove data stored on this device.',
        },
      },
      lock: {
        eyebrow: 'Privacy controls',
        title: 'Floriva is locked',
        description:
          'Unlock with the {biometric} already set up on this device.',
        localUnlock: {
          title: 'Local unlock',
          body: "Floriva uses your phone\'s built-in security to unlock.",
        },
        unavailableBody:
          "This device can't unlock Floriva right now because no {biometric} is set up.",
        cancelledBody: 'Unlock was cancelled before finishing.',
        failureBody: 'Unlock did not complete.',
        unlockButtonLabel: 'Unlock with device security',
        unlocking: 'Unlocking…',
        statusTitles: {
          unavailable: 'Unlock needs device setup',
          cancelled: 'Unlock cancelled',
          failure: 'Unlock needs attention',
        },
        metrics: {
          unlockPathLabel: 'Unlock path',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Recovery path',
          recoveryPathValue: 'Device passcode',
        },
        statusHints: {
          unavailable:
            'To enroll {biometric}, open the system Settings app first, then come back and try again.',
          generic: 'Floriva stayed locked. Your data was not read.',
        },
        openDeviceSettings: 'Open device settings',
      },
    },
  },
  es: {
    privacy: {
      promise: {
        eyebrow: 'Seguimiento del ciclo centrado en la privacidad',
        title: 'Privado por defecto. Útil sin conexión.',
        body: 'Floriva guarda el historial de tu ciclo en tu dispositivo y evita cuentas o almacenamiento en la nube por defecto.',
        pillars: {
          onDevice: 'En el dispositivo por defecto',
          noAccount: 'No se requiere cuenta',
          localImports: 'Las importaciones solo leen los archivos locales que eliges',
        },
        footnote:
          'Floriva ofrece seguimiento y predicciones del ciclo, no consejo médico ni tratamiento.',
      },
      explainer: {
        backToSettings: 'Volver a ajustes',
        backToWelcome: 'Volver a la bienvenida',
        whatFlorivaPromises: 'Lo que Floriva promete',
        deviceStorage: {
          title: 'Almacenamiento en el dispositivo',
          body: 'El historial del ciclo, las preferencias de recordatorios y los ajustes de bloqueo viven en este dispositivo.',
        },
        imports: {
          title: 'Importaciones',
          body: 'Las importaciones solo abren el archivo que eliges. Floriva no analiza tu almacenamiento ni sube ese archivo.',
        },
        deviceSecurity: {
          title: 'Seguridad del dispositivo',
          body:
            'El bloqueo biométrico usa {biometric} ya disponibles en tu dispositivo.',
        },
        deleteLocalData: {
          title: 'Eliminar datos locales',
          body: 'Eliminar todos los datos locales borra el historial del ciclo, los horarios de recordatorios y los artefactos del bloqueo de privacidad de este dispositivo.',
        },
        uninstalling: {
          title: 'Desinstalar la app',
          body: 'Desinstalar Floriva puede eliminar de forma permanente los datos locales guardados en este dispositivo.',
        },
      },
      lock: {
        eyebrow: 'Controles de privacidad',
        title: 'Floriva está bloqueada',
        description:
          'Desbloquea con {biometric} ya configurados en este dispositivo.',
        localUnlock: {
          title: 'Desbloqueo local',
          body: 'Floriva usa la seguridad integrada del teléfono para desbloquearse.',
        },
        unavailableBody:
          'Este dispositivo no puede confirmar el bloqueo biométrico de Floriva porque ahora mismo no hay {biometric} registrados.',
        cancelledBody: 'El desbloqueo se canceló antes de completarse.',
        failureBody: 'No se pudo completar el desbloqueo.',
        unlockButtonLabel: 'Desbloquear con la seguridad del dispositivo',
        unlocking: 'Desbloqueando…',
        statusTitles: {
          unavailable: 'El desbloqueo necesita configuración del dispositivo',
          cancelled: 'Desbloqueo cancelado',
          failure: 'El desbloqueo necesita atención',
        },
        metrics: {
          unlockPathLabel: 'Ruta de desbloqueo',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Ruta de recuperación',
          recoveryPathValue: 'Código del dispositivo',
        },
        statusHints: {
          unavailable:
            'Para registrar {biometric}, abre primero la app Ajustes del sistema y luego vuelve a intentarlo.',
          generic: 'Floriva no se desbloqueó y tus datos locales siguieron bloqueados.',
        },
        openDeviceSettings: 'Abrir ajustes del dispositivo',
      },
    },
  },
  de: {
    privacy: {
      promise: {
        eyebrow: 'Datenschutzorientierter Zyklus-Tracker',
        title: 'Standardmäßig privat. Offline nützlich.',
        body: 'Floriva speichert deinen Zyklusverlauf auf deinem Gerät und vermeidet standardmäßig Konten oder Cloud-Speicher.',
        pillars: {
          onDevice: 'Standardmäßig auf dem Gerät',
          noAccount: 'Kein Konto erforderlich',
          localImports: 'Importe lesen nur lokale Dateien, die du auswählst',
        },
        footnote:
          'Floriva bietet Zyklus-Tracking und Vorhersagen, keine medizinische Beratung oder Behandlung.',
      },
      explainer: {
        backToSettings: 'Zurück zu den Einstellungen',
        backToWelcome: 'Zurück zum Willkommensbildschirm',
        whatFlorivaPromises: 'Was Floriva verspricht',
        deviceStorage: {
          title: 'Gerätespeicher',
          body: 'Zyklusverlauf, Erinnerungseinstellungen und Sperr-Einstellungen leben auf diesem Gerät.',
        },
        imports: {
          title: 'Importe',
          body: 'Importe öffnen nur die Datei, die du auswählst. Floriva durchsucht deinen Speicher nicht und lädt diese Datei nicht hoch.',
        },
        deviceSecurity: {
          title: 'Gerätesicherheit',
          body:
            'Die biometrische Sperre nutzt {biometric}, die auf deinem Gerät bereits verfügbar sind.',
        },
        deleteLocalData: {
          title: 'Lokale Daten löschen',
          body: 'Wenn alle lokalen Daten gelöscht werden, verschwinden Zyklusverlauf, Erinnerungspläne und Sperr-Artefakte von diesem Gerät.',
        },
        uninstalling: {
          title: 'App deinstallieren',
          body: 'Wenn du Floriva deinstallierst, können die lokal gespeicherten Daten auf diesem Gerät dauerhaft entfernt werden.',
        },
      },
      lock: {
        eyebrow: 'Datenschutzkontrollen',
        title: 'Floriva ist gesperrt',
        description:
          'Entsperre mit {biometric}, die bereits auf diesem Gerät eingerichtet sind.',
        localUnlock: {
          title: 'Lokales Entsperren',
          body: 'Floriva nutzt die eingebaute Sicherheit deines Telefons zum Entsperren.',
        },
        unavailableBody:
          'Dieses Gerät kann Florivas biometrische Sperre gerade nicht bestätigen, weil {biometric} nicht eingerichtet ist.',
        cancelledBody: 'Das Entsperren wurde vor dem Abschluss abgebrochen.',
        failureBody: 'Das Entsperren konnte nicht abgeschlossen werden.',
        unlockButtonLabel: 'Mit Gerätesicherheit entsperren',
        unlocking: 'Wird entsperrt…',
        statusTitles: {
          unavailable: 'Entsperren braucht Geräteeinrichtung',
          cancelled: 'Entsperren abgebrochen',
          failure: 'Entsperren braucht Aufmerksamkeit',
        },
        metrics: {
          unlockPathLabel: 'Entsperrpfad',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Wiederherstellungspfad',
          recoveryPathValue: 'Geräte-Passcode',
        },
        statusHints: {
          unavailable:
            'Um {biometric} einzurichten, öffne zuerst die Systemeinstellungen und versuche es dann erneut.',
          generic: 'Floriva wurde nicht entsperrt, und deine lokalen Daten blieben gesperrt.',
        },
        openDeviceSettings: 'Geräteeinstellungen öffnen',
      },
    },
  },
  fr: {
    privacy: {
      promise: {
        eyebrow: 'Suivi des règles centré sur la vie privée',
        title: 'Privé par défaut. Utile hors ligne.',
        body: "Floriva conserve l’historique de ton cycle sur ton appareil et évite par défaut les comptes ou le stockage cloud.",
        pillars: {
          onDevice: "Sur l’appareil par défaut",
          noAccount: 'Aucun compte requis',
          localImports: 'Les imports lisent seulement les fichiers locaux que tu choisis',
        },
        footnote:
          'Floriva propose le suivi du cycle et des prévisions, pas un avis médical ni un traitement.',
      },
      explainer: {
        backToSettings: 'Retour aux réglages',
        backToWelcome: "Retour à l’accueil",
        whatFlorivaPromises: 'Ce que Floriva promet',
        deviceStorage: {
          title: "Stockage sur l’appareil",
          body: "L’historique du cycle, les préférences de rappel et les réglages de verrouillage vivent sur cet appareil.",
        },
        imports: {
          title: 'Imports',
          body: "Les imports n’ouvrent que le fichier que tu choisis. Floriva ne parcourt pas ton stockage et ne téléverse pas ce fichier.",
        },
        deviceSecurity: {
          title: "Sécurité de l’appareil",
          body:
            "Le verrou biométrique s’appuie sur {biometric} déjà disponibles sur ton appareil.",
        },
        deleteLocalData: {
          title: 'Supprimer les données locales',
          body: "Supprimer toutes les données locales efface l’historique du cycle, les horaires de rappel et les artefacts du verrou de confidentialité de cet appareil.",
        },
        uninstalling: {
          title: "Désinstallation de l’application",
          body: 'Désinstaller Floriva peut supprimer définitivement les données locales stockées sur cet appareil.',
        },
      },
      lock: {
        eyebrow: 'Contrôles de confidentialité',
        title: 'Floriva est verrouillée',
        description:
          'Déverrouille avec {biometric} déjà configurés sur cet appareil.',
        localUnlock: {
          title: 'Déverrouillage local',
          body: 'Floriva utilise la sécurité intégrée de ton téléphone pour se déverrouiller.',
        },
        unavailableBody:
          "Cet appareil ne peut pas confirmer le verrou biométrique de Floriva car {biometric} n’est pas configuré pour le moment.",
        cancelledBody: "Le déverrouillage a été annulé avant d’aboutir.",
        failureBody: "Le déverrouillage n’a pas pu aboutir.",
        unlockButtonLabel: "Déverrouiller avec la sécurité de l’appareil",
        unlocking: 'Déverrouillage…',
        statusTitles: {
          unavailable: "Le déverrouillage nécessite la configuration de l’appareil",
          cancelled: 'Déverrouillage annulé',
          failure: 'Le déverrouillage nécessite une attention',
        },
        metrics: {
          unlockPathLabel: 'Chemin de déverrouillage',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Chemin de secours',
          recoveryPathValue: "Code de l’appareil",
        },
        statusHints: {
          unavailable:
            "Pour enregistrer {biometric}, ouvre d’abord les Réglages du système, puis réessaie.",
          generic: "Floriva ne s’est pas déverrouillée, et tes données locales sont restées verrouillées.",
        },
        openDeviceSettings: "Ouvrir les réglages de l’appareil",
      },
    },
  },
  ja: {
    privacy: {
      promise: {
        eyebrow: 'プライバシー重視の生理周期トラッカー',
        title: '既定でプライベート。オフラインでも便利。',
        body: 'Floriva は、既定でアカウントやクラウド保存を使わず、周期履歴を端末内に保持します。',
        pillars: {
          onDevice: '既定で端末内保存',
          noAccount: 'アカウント不要',
          localImports: 'インポートは選んだローカルファイルだけを読み取ります',
        },
        footnote:
          'Floriva は周期の記録と予測を提供しますが、医療助言や治療は行いません。',
      },
      explainer: {
        backToSettings: '設定に戻る',
        backToWelcome: 'ようこそに戻る',
        whatFlorivaPromises: 'Floriva が約束すること',
        deviceStorage: {
          title: '端末内保存',
          body: '周期履歴、リマインダー設定、ロック設定はこの端末に保存されます。',
        },
        imports: {
          title: 'インポート',
          body: 'インポートは選んだファイルだけを開きます。Floriva は保存領域を走査したり、そのファイルをアップロードしたりしません。',
        },
        deviceSecurity: {
          title: '端末のセキュリティ',
          body:
            '生体認証ロックは、すでに端末で使える {biometric}を使います。',
        },
        deleteLocalData: {
          title: 'ローカルデータを削除',
          body: 'すべてのローカルデータを削除すると、この端末から周期履歴、リマインダーの予定、プライバシーロックの関連データが削除されます。',
        },
        uninstalling: {
          title: 'アプリを削除する',
          body: 'Floriva を削除すると、この端末に保存されているローカルデータが完全に消える場合があります。',
        },
      },
      lock: {
        eyebrow: 'プライバシー制御',
        title: 'Floriva はロックされています',
        description:
          'この端末ですでに設定されている {biometric}で解除してください。',
        localUnlock: {
          title: 'ローカル解除',
          body: 'Floriva は端末の内蔵セキュリティを使って解除します。',
        },
        unavailableBody:
          'この端末では、登録済みの {biometric}が見つからないため、Floriva の生体認証ロックを確認できません。',
        cancelledBody: '解除は完了する前にキャンセルされました。',
        failureBody: '解除を完了できませんでした。',
        unlockButtonLabel: '端末のセキュリティで解除',
        unlocking: '解除中…',
        statusTitles: {
          unavailable: '解除には端末の設定が必要です',
          cancelled: '解除がキャンセルされました',
          failure: '解除には対応が必要です',
        },
        metrics: {
          unlockPathLabel: '解除方法',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: '回復方法',
          recoveryPathValue: '端末パスコード',
        },
        statusHints: {
          unavailable:
            '{biometric}を登録するには、先にシステム設定アプリを開いてからもう一度お試しください。',
          generic: 'Floriva は解除されず、ローカルデータはロックされたままでした。',
        },
        openDeviceSettings: '端末設定を開く',
      },
    },
  },
  'zh-Hans': {
    privacy: {
      promise: {
        eyebrow: '隐私优先的经期追踪器',
        title: '默认私密，离线也能用。',
        body: 'Floriva 会把你的周期历史保存在设备上，默认不使用账号或云端存储。',
        pillars: {
          onDevice: '默认保存在设备上',
          noAccount: '无需账号',
          localImports: '导入只会读取你选择的本地文件',
        },
        footnote: 'Floriva 提供周期追踪和预测，不提供医疗建议或治疗。',
      },
      explainer: {
        backToSettings: '返回设置',
        backToWelcome: '返回欢迎页',
        whatFlorivaPromises: 'Floriva 的承诺',
        deviceStorage: {
          title: '设备存储',
          body: '周期历史、提醒偏好和锁定设置都保留在此设备上。',
        },
        imports: {
          title: '导入',
          body: '导入只会打开你选择的文件。Floriva 不会扫描你的存储，也不会上传该文件。',
        },
        deviceSecurity: {
          title: '设备安全',
          body: '生物识别锁依赖于你设备上已可用的 {biometric}。',
        },
        deleteLocalData: {
          title: '删除本地数据',
          body: '删除所有本地数据会移除此设备上的周期历史、提醒计划和隐私锁相关内容。',
        },
        uninstalling: {
          title: '卸载应用',
          body: '卸载 Floriva 可能会永久删除保存在此设备上的本地数据。',
        },
      },
      lock: {
        eyebrow: '隐私控制',
        title: 'Floriva 已锁定',
        description: '请使用此设备上已设置好的 {biometric}解锁。',
        localUnlock: {
          title: '本地解锁',
          body: 'Floriva 使用手机内置的安全功能来解锁。',
        },
        unavailableBody:
          '此设备当前无法确认 Floriva 的生物识别锁，因为没有已录入的 {biometric}可用。',
        cancelledBody: '解锁在完成前已被取消。',
        failureBody: '无法完成解锁。',
        unlockButtonLabel: '使用设备安全性解锁',
        unlocking: '正在解锁…',
        statusTitles: {
          unavailable: '解锁需要设备设置',
          cancelled: '解锁已取消',
          failure: '解锁需要处理',
        },
        metrics: {
          unlockPathLabel: '解锁路径',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: '恢复路径',
          recoveryPathValue: '设备密码',
        },
        statusHints: {
          unavailable:
            '要录入 {biometric}，请先打开系统设置应用，然后再试一次。',
          generic: 'Floriva 未能解锁，你的本地数据仍然处于锁定状态。',
        },
        openDeviceSettings: '打开设备设置',
      },
    },
  },
  pt: {
    privacy: {
      promise: {
        eyebrow: 'Rastreador de ciclo com privacidade em primeiro lugar',
        title: 'Privado por padrão. Útil offline.',
        body:
          'O Floriva mantém o histórico do seu ciclo neste dispositivo. Contas e armazenamento em nuvem ficam desligados por padrão.',
        pillars: {
          onDevice: 'No dispositivo por padrão',
          noAccount: 'Não é necessária conta',
          localImports: 'As importações só leem os arquivos locais que você escolher',
        },
        footnote:
          'O Floriva oferece acompanhamento do ciclo e previsões, não aconselhamento médico nem tratamento.',
      },
      explainer: {
        backToSettings: 'Voltar para as configurações',
        backToWelcome: 'Voltar para boas-vindas',
        whatFlorivaPromises: 'O que o Floriva promete',
        deviceStorage: {
          title: 'Armazenamento no dispositivo',
          body: 'O histórico do ciclo, as preferências de lembrete e as configurações de bloqueio ficam neste dispositivo.',
        },
        imports: {
          title: 'Importações',
          body: 'As importações só abrem o arquivo que você escolher. O Floriva não verifica seu armazenamento nem envia esse arquivo.',
        },
        deviceSecurity: {
          title: 'Segurança do dispositivo',
          body:
            'O bloqueio biométrico usa {biometric} já disponíveis no seu dispositivo.',
        },
        deleteLocalData: {
          title: 'Apagar dados locais',
          body:
            'Apagar dados locais remove o histórico do ciclo, os horários de lembretes e os dados de bloqueio deste dispositivo.',
        },
        uninstalling: {
          title: 'Desinstalando o app',
          body: 'Desinstalar o Floriva pode remover permanentemente os dados guardados neste dispositivo.',
        },
      },
      lock: {
        eyebrow: 'Controles de privacidade',
        title: 'O Floriva está bloqueado',
        description:
          'Desbloqueie com {biometric} já configurados neste dispositivo.',
        localUnlock: {
          title: 'Desbloqueio local',
          body: 'O Floriva usa a segurança integrada do seu telefone para desbloquear.',
        },
        unavailableBody:
          'Este dispositivo não consegue confirmar o bloqueio biométrico do Floriva porque não há {biometric} cadastrados agora.',
        cancelledBody: 'O desbloqueio foi cancelado antes de concluir.',
        failureBody: 'Não foi possível concluir o desbloqueio.',
        unlockButtonLabel: 'Desbloquear com a segurança do dispositivo',
        unlocking: 'Desbloqueando…',
        statusTitles: {
          unavailable: 'O desbloqueio precisa da configuração do dispositivo',
          cancelled: 'Desbloqueio cancelado',
          failure: 'O desbloqueio precisa de atenção',
        },
        metrics: {
          unlockPathLabel: 'Caminho de desbloqueio',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Caminho de recuperação',
          recoveryPathValue: 'Senha do dispositivo',
        },
        statusHints: {
          unavailable:
            'Para cadastrar {biometric}, abra primeiro o app Ajustes do sistema e tente novamente.',
          generic: 'O Floriva permaneceu bloqueado. Seus dados não foram abertos.',
        },
        openDeviceSettings: 'Abrir configurações do dispositivo',
      },
    },
  },
  ru: {
    privacy: {
      promise: {
        eyebrow: 'Трекер цикла с приоритетом приватности',
        title: 'По умолчанию приватно. Полезно офлайн.',
        body: 'Floriva хранит историю цикла на вашем устройстве и по умолчанию не использует аккаунты или облачное хранилище.',
        pillars: {
          onDevice: 'По умолчанию на устройстве',
          noAccount: 'Аккаунт не нужен',
          localImports: 'Импорт читает только выбранные вами локальные файлы',
        },
        footnote:
          'Floriva предлагает отслеживание цикла и прогнозы, а не медицинские советы или лечение.',
      },
      explainer: {
        backToSettings: 'Назад в настройки',
        backToWelcome: 'Назад к приветствию',
        whatFlorivaPromises: 'Что обещает Floriva',
        deviceStorage: {
          title: 'Хранение на устройстве',
          body: 'История цикла, настройки напоминаний и параметры блокировки живут на этом устройстве.',
        },
        imports: {
          title: 'Импорт',
          body: 'Импорт открывает только выбранный вами файл. Floriva не просматривает хранилище и не загружает этот файл.',
        },
        deviceSecurity: {
          title: 'Безопасность устройства',
          body:
            'Биометрическая блокировка использует {biometric}, уже доступные на вашем устройстве.',
        },
        deleteLocalData: {
          title: 'Удалить локальные данные',
          body: 'Удаление всех локальных данных удаляет с этого устройства историю цикла, расписания напоминаний и артефакты блокировки приватности.',
        },
        uninstalling: {
          title: 'Удаление приложения',
          body: 'Удаление Floriva может навсегда удалить локальные данные, хранящиеся на этом устройстве.',
        },
      },
      lock: {
        eyebrow: 'Контроль приватности',
        title: 'Floriva заблокирована',
        description:
          'Разблокируйте с помощью {biometric}, уже настроенных на этом устройстве.',
        localUnlock: {
          title: 'Локальная разблокировка',
          body: 'Floriva использует встроенную защиту телефона для разблокировки.',
        },
        unavailableBody:
          'Это устройство не может подтвердить биометрическую блокировку Floriva, потому что сейчас не настроены {biometric}.',
        cancelledBody: 'Разблокировка была отменена до завершения.',
        failureBody: 'Не удалось завершить разблокировку.',
        unlockButtonLabel: 'Разблокировать через защиту устройства',
        unlocking: 'Разблокировка…',
        statusTitles: {
          unavailable: 'Для разблокировки нужно настроить устройство',
          cancelled: 'Разблокировка отменена',
          failure: 'Для разблокировки нужна помощь',
        },
        metrics: {
          unlockPathLabel: 'Путь разблокировки',
          unlockPathValue: '{biometric}',
          recoveryPathLabel: 'Путь восстановления',
          recoveryPathValue: 'Пароль устройства',
        },
        statusHints: {
          unavailable:
            'Чтобы настроить {biometric}, сначала откройте системные настройки и попробуйте снова.',
          generic: 'Floriva не была разблокирована, и ваши локальные данные остались заблокированными.',
        },
        openDeviceSettings: 'Открыть настройки устройства',
      },
    },
  },
} as const;
