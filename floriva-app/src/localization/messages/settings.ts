const settingsEnglishMessages = {
  settings: {
    hub: {
      eyebrow: 'Settings',
      title: 'Settings',
      description: 'Pick what you want to change.',
      appearanceTitle: 'Appearance',
      appearanceDescription:
        'Pick a theme or let Floriva match your device setting.',
      currentModeLabel: 'Current mode',
      followSystem: 'Follow system',
      light: 'Light',
      dark: 'Dark',
      privacyAndRemindersTitle: 'Privacy and reminders',
      privacyAndRemindersDescription: 'App lock, reminders, and trying-to-conceive settings.',
      privacyLockTitle: 'App lock',
      feedbackTitle: 'Send feedback',
      feedbackSummary: 'Ideas, bugs, feature requests',
      soundsTitle: 'Sounds & haptics',
      soundsSummary: 'Vibration and tap sounds',
      privacyLockSummary: 'Off · 1 min · diagnostics off',
      remindersTitle: 'Reminders',
      remindersSummary: '1 active',
      ttcTitle: 'Trying-to-conceive mode',
      ttcSummaryOff: 'Off',
      ttcSummaryOn: 'On',
      ttcSummaryOnDetail: 'On · {flags}',
      languageTitle: 'Language',
      languageSummary: 'System default · English',
      billingAndDataTitle: 'Billing and data',
      billingAndDataDescription: 'Subscription, backup, import, and delete.',
      subscriptionTitle: 'Subscription',
      subscriptionSummary: 'Trial active. Annual plan.',
      rateAppTitle: 'Rate Floriva',
      rateAppSummary: 'Leave a review in the app store.',
      dataTitle: 'Data',
      dataSummary: 'Backup, restore, import, and privacy info.',
      deleteDataTitle: 'Delete data',
      deleteDataSummary: 'Delete all Floriva data from this device.',
    },
    language: {
      eyebrow: 'Settings',
      title: 'Language',
      description: 'Choose the language Floriva uses on this device.',
        currentLabel: 'Current language',
        choicesTitle: 'Available languages',
        systemDefault: 'System default',
        backLabel: 'Back to settings',
        selectedLabel: 'Currently selected',
    },
  },
} as const;

const settingsCoreMessages = {
  en: settingsEnglishMessages,
  es: {
    settings: {
      hub: {
        eyebrow: 'Configuración',
        title: 'Configuración',
        description: 'Elige lo que quieras ajustar.',
        appearanceTitle: 'Apariencia',
        appearanceDescription:
          'Elige si Floriva sigue la apariencia de este dispositivo o se mantiene fija en un modo.',
        currentModeLabel: 'Modo actual',
        followSystem: 'Seguir el sistema',
        light: 'Claro',
        dark: 'Oscuro',
        privacyAndRemindersTitle: 'Privacidad y recordatorios',
        privacyAndRemindersDescription:
          'La privacidad, los recordatorios y los ajustes para buscar embarazo se mantienen juntos.',
        privacyLockTitle: 'Privacidad y bloqueo',
        feedbackTitle: 'Enviar comentarios',
        feedbackSummary: 'Ideas, errores, sugerencias',
        soundsTitle: 'Sonidos y vibración',
        soundsSummary: 'Vibración y sonidos al tocar',
        privacyLockSummary: 'Bloqueo biométrico desactivado. Se vuelve a bloquear tras 1 minuto. Diagnósticos desactivados.',
        remindersTitle: 'Recordatorios',
        remindersSummary: '1 recordatorio activo en este dispositivo.',
        ttcTitle: 'Buscando embarazo',
        ttcSummaryOff: 'Desactivado',
        ttcSummaryOn: 'Activado',
        ttcSummaryOnDetail: 'Activado · {flags}',
        languageTitle: 'Idioma',
        languageSummary: 'Predeterminado del sistema · Inglés',
        billingAndDataTitle: 'Facturación y datos',
        billingAndDataDescription:
          'La facturación, las copias de seguridad, las importaciones y las acciones destructivas se mantienen separadas de los controles diarios.',
        subscriptionTitle: 'Suscripción',
        subscriptionSummary: 'Prueba activa. Plan anual.',
        rateAppTitle: 'Calificar Floriva',
        rateAppSummary: 'Abre la página de reseñas de la tienda cuando quieras apoyar a Floriva.',
        dataTitle: 'Datos e importación',
        dataSummary: 'Copia de seguridad, restauración, importación y notas de privacidad.',
        deleteDataTitle: 'Borrar datos locales',
        deleteDataSummary:
          'Borra todo en este dispositivo solo después de un paso de confirmación dedicado.',
      },
      language: {
        eyebrow: 'Configuración',
        title: 'Idioma',
        description: 'Elige el idioma que Floriva usa en este dispositivo.',
        currentLabel: 'Idioma actual',
        choicesTitle: 'Idiomas disponibles',
        systemDefault: 'Predeterminado del sistema',
        backLabel: 'Volver a configuración',
        selectedLabel: 'Seleccionado actualmente',
      },
    },
  },
  de: {
    settings: {
      hub: {
        eyebrow: 'Einstellungen',
        title: 'Einstellungen',
        description: 'Wähle aus, was du anpassen möchtest.',
        appearanceTitle: 'Erscheinungsbild',
        appearanceDescription:
          'Wähle, ob Floriva dem Erscheinungsbild dieses Geräts folgt oder in einem festen Modus bleibt.',
        currentModeLabel: 'Aktueller Modus',
        followSystem: 'System folgen',
        light: 'Hell',
        dark: 'Dunkel',
        privacyAndRemindersTitle: 'Privatsphäre und Erinnerungen',
        privacyAndRemindersDescription:
          'Privatsphäre, Erinnerungen und Einstellungen für den Kinderwunsch.',
        privacyLockTitle: 'Privatsphäre und Sperre',
        feedbackTitle: 'Feedback',
        feedbackSummary: 'Ideen, Fehler, Wünsche',
        soundsTitle: 'Töne & Haptik',
        soundsSummary: 'Vibration und Tipptöne',
        privacyLockSummary: 'Biometrische Sperre aus. Sperrt nach 1 Minute erneut. Diagnosen aus.',
        remindersTitle: 'Erinnerungen',
        remindersSummary: '1 Erinnerung auf diesem Gerät aktiv.',
        ttcTitle: 'Schwanger werden',
        ttcSummaryOff: 'Aus',
        ttcSummaryOn: 'An',
        ttcSummaryOnDetail: 'An · {flags}',
        languageTitle: 'Sprache',
        languageSummary: 'Systemstandard · Englisch',
        billingAndDataTitle: 'Abrechnung und Daten',
        billingAndDataDescription: 'Abonnement, Backup, Import und Daten löschen.',
        subscriptionTitle: 'Abonnement',
        subscriptionSummary: 'Testphase aktiv. Jahresplan.',
        rateAppTitle: 'Floriva bewerten',
        rateAppSummary: 'Bewerte Floriva im Store.',
        dataTitle: 'Daten und Import',
        dataSummary: 'Backup, Wiederherstellung, Import und Datenschutzhinweise.',
        deleteDataTitle: 'Lokale Daten löschen',
        deleteDataSummary:
          'Löscht alles auf diesem Gerät nur nach einem eigenen Bestätigungsschritt.',
      },
      language: {
        eyebrow: 'Einstellungen',
        title: 'Sprache',
        description: 'Wähle die Sprache, die Floriva auf diesem Gerät verwendet.',
        currentLabel: 'Aktuelle Sprache',
        choicesTitle: 'Verfügbare Sprachen',
        systemDefault: 'Systemstandard',
        backLabel: 'Zurück zu den Einstellungen',
        selectedLabel: 'Derzeit ausgewählt',
      },
    },
  },
  fr: {
    settings: {
      hub: {
        eyebrow: 'Réglages',
        title: 'Réglages',
        description: 'Choisis ce que tu veux ajuster.',
        appearanceTitle: 'Apparence',
        appearanceDescription:
          "Choisis si Floriva suit l’apparence de cet appareil ou utilise un mode fixe.",
        currentModeLabel: 'Mode actuel',
        followSystem: 'Suivre le système',
        light: 'Clair',
        dark: 'Sombre',
        privacyAndRemindersTitle: 'Confidentialité et rappels',
        privacyAndRemindersDescription:
          'Confidentialité, rappels et réglages du projet bébé.',
        privacyLockTitle: 'Confidentialité et verrouillage',
        feedbackTitle: 'Envoyer un commentaire',
        feedbackSummary: 'Idées, bugs, suggestions',
        soundsTitle: 'Sons et vibrations',
        soundsSummary: 'Vibrations et sons de touche',
        privacyLockSummary: 'Verrouillage biométrique désactivé. Se reverrouille après 1 minute. Diagnostics désactivés.',
        remindersTitle: 'Rappels',
        remindersSummary: '1 rappel actif sur cet appareil.',
        ttcTitle: 'Projet bébé',
        ttcSummaryOff: 'Désactivé',
        ttcSummaryOn: 'Activé',
        ttcSummaryOnDetail: 'Activé · {flags}',
        languageTitle: 'Langue',
        languageSummary: 'Langue système · Anglais',
        billingAndDataTitle: 'Facturation et données',
        billingAndDataDescription:
          'Abonnement, sauvegarde, importation et suppression.',
        subscriptionTitle: 'Abonnement',
        subscriptionSummary: 'Essai actif. Formule annuelle.',
        rateAppTitle: 'Noter Floriva',
        rateAppSummary: "Laisse un avis dans la boutique d’applications.",
        dataTitle: 'Données et importation',
        dataSummary: 'Sauvegarde, restauration, importation et détails de confidentialité.',
        deleteDataTitle: 'Supprimer les données locales',
        deleteDataSummary:
          'Efface tout sur cet appareil uniquement après une étape de confirmation dédiée.',
      },
      language: {
        eyebrow: 'Réglages',
        title: 'Langue',
        description: 'Choisis la langue que Floriva utilise sur cet appareil.',
        currentLabel: 'Langue actuelle',
        choicesTitle: 'Langues disponibles',
        systemDefault: 'Langue du système',
        backLabel: 'Retour aux réglages',
        selectedLabel: 'Actuellement sélectionnée',
      },
    },
  },
  ja: {
    settings: {
      hub: {
        eyebrow: '設定',
        title: '設定',
        description: '調整したい項目を選んでください。',
        appearanceTitle: '外観',
        appearanceDescription:
          'Floriva をこのデバイスの外観に合わせるか、1つのモードに固定するかを選べます。',
        currentModeLabel: '現在のモード',
        followSystem: 'システムに従う',
        light: 'ライト',
        dark: 'ダーク',
        privacyAndRemindersTitle: 'プライバシーとリマインダー',
        privacyAndRemindersDescription:
          'プライバシー、リマインダー、妊活の設定。',
        privacyLockTitle: 'プライバシーとロック',
        feedbackTitle: 'フィードバック',
        feedbackSummary: 'アイデア・不具合・ご要望',
        soundsTitle: 'サウンドと触覚',
        soundsSummary: '振動とタップ音',
        privacyLockSummary: '生体認証ロックはオフです。1分後に再ロックします。診断はオフです。',
        remindersTitle: 'リマインダー',
        remindersSummary: 'このデバイスで 1 件のリマインダーが有効です。',
        ttcTitle: '妊活',
        ttcSummaryOff: 'オフ',
        ttcSummaryOn: 'オン',
        ttcSummaryOnDetail: 'オン · {flags}',
        languageTitle: '言語',
        languageSummary: 'システム既定 · 英語',
        billingAndDataTitle: '請求とデータ',
        billingAndDataDescription:
          'サブスクリプション、バックアップ、インポート、データ削除。',
        subscriptionTitle: 'サブスクリプション',
        subscriptionSummary: 'トライアル有効。年間プラン。',
        rateAppTitle: 'Floriva を評価',
        rateAppSummary: 'App Store でレビューを書く。',
        dataTitle: 'データとインポート',
        dataSummary: 'バックアップ、復元、インポート、プライバシーノート。',
        deleteDataTitle: 'ローカルデータを削除',
        deleteDataSummary:
          '専用の確認手順の後にのみ、このデバイス上のすべてを消去します。',
      },
      language: {
        eyebrow: '設定',
        title: '言語',
        description: 'このデバイスで Floriva が使用する言語を選んでください。',
        currentLabel: '現在の言語',
        choicesTitle: '利用可能な言語',
        systemDefault: 'システムのデフォルト',
        backLabel: '設定に戻る',
        selectedLabel: '現在選択中',
      },
    },
  },
  'zh-Hans': {
    settings: {
      hub: {
        eyebrow: '设置',
        title: '设置',
        description: '选择你想调整的内容。',
        appearanceTitle: '外观',
        appearanceDescription:
          '选择 Floriva 是跟随此设备的外观，还是固定为一种模式。',
        currentModeLabel: '当前模式',
        followSystem: '跟随系统',
        light: '浅色',
        dark: '深色',
        privacyAndRemindersTitle: '隐私和提醒',
        privacyAndRemindersDescription:
          '应用锁、提醒和备孕设置。',
        privacyLockTitle: '隐私和锁定',
        feedbackTitle: '反馈',
        feedbackSummary: '想法、错误、功能建议',
        soundsTitle: '声音与触感',
        soundsSummary: '振动与点按声音',
        privacyLockSummary: '生物识别锁已关闭。1 分钟后重新锁定。诊断已关闭。',
        remindersTitle: '提醒',
        remindersSummary: '此设备上有 1 条提醒处于启用状态。',
        ttcTitle: '备孕',
        ttcSummaryOff: '关闭',
        ttcSummaryOn: '已开启',
        ttcSummaryOnDetail: '已开启 · {flags}',
        languageTitle: '语言',
        languageSummary: '系统默认 · 英语',
        billingAndDataTitle: '计费和数据',
        billingAndDataDescription:
          '订阅、备份、导入和删除数据。',
        subscriptionTitle: '订阅',
        subscriptionSummary: '试用已启用。年度计划。',
        rateAppTitle: '为 Floriva 评分',
        rateAppSummary: '在应用商店留下评价。',
        dataTitle: '数据和导入',
        dataSummary: '备份、恢复、导入和隐私说明。',
        deleteDataTitle: '删除本地数据',
        deleteDataSummary:
          '仅在完成专门的确认步骤后，才会清除此设备上的所有内容。',
      },
      language: {
        eyebrow: '设置',
        title: '语言',
        description: '选择 Floriva 在此设备上使用的语言。',
        currentLabel: '当前语言',
        choicesTitle: '可用语言',
        systemDefault: '系统默认',
        backLabel: '返回设置',
        selectedLabel: '当前已选',
      },
    },
  },
  pt: {
    settings: {
      hub: {
        eyebrow: 'Configurações',
        title: 'Configurações',
        description: 'Escolhe o que queres ajustar.',
        appearanceTitle: 'Aparência',
        appearanceDescription:
          'Escolhe se o Floriva segue a aparência deste dispositivo ou fica preso a um modo.',
        currentModeLabel: 'Modo atual',
        followSystem: 'Seguir o sistema',
        light: 'Claro',
        dark: 'Escuro',
        privacyAndRemindersTitle: 'Privacidade e lembretes',
        privacyAndRemindersDescription:
          'Bloqueio da app, lembretes e definições de tentar engravidar.',
        privacyLockTitle: 'Privacidade e bloqueio',
        feedbackTitle: 'Feedback',
        feedbackSummary: 'Ideias, erros, sugestões',
        soundsTitle: 'Sons e hápticos',
        soundsSummary: 'Vibração e sons de toque',
        privacyLockSummary: 'Bloqueio biométrico desligado. Bloqueia de novo após 1 minuto. Diagnósticos desligados.',
        remindersTitle: 'Lembretes',
        remindersSummary: '1 lembrete ativo neste dispositivo.',
        ttcTitle: 'A tentar engravidar',
        ttcSummaryOff: 'Desativado',
        ttcSummaryOn: 'Ativado',
        ttcSummaryOnDetail: 'Ativado · {flags}',
        languageTitle: 'Idioma',
        languageSummary: 'Padrão do sistema · Inglês',
        billingAndDataTitle: 'Cobrança e dados',
        billingAndDataDescription:
          'Subscrição, cópia de segurança, importação e eliminar dados.',
        subscriptionTitle: 'Subscrição',
        subscriptionSummary: 'Teste ativo. Plano anual.',
        rateAppTitle: 'Avaliar o Floriva',
        rateAppSummary: 'Deixa uma avaliação na loja de apps.',
        dataTitle: 'Dados e importação',
        dataSummary: 'Cópia de segurança, restauro, importação e notas de privacidade.',
        deleteDataTitle: 'Eliminar dados locais',
        deleteDataSummary:
          'Apaga tudo neste dispositivo apenas depois de um passo de confirmação dedicado.',
      },
      language: {
        eyebrow: 'Configurações',
        title: 'Idioma',
        description: 'Escolhe o idioma que o Floriva usa neste dispositivo.',
        currentLabel: 'Idioma atual',
        choicesTitle: 'Idiomas disponíveis',
        systemDefault: 'Predefinição do sistema',
        backLabel: 'Voltar às configurações',
        selectedLabel: 'Atualmente selecionado',
      },
    },
  },
  ru: {
    settings: {
      hub: {
        eyebrow: 'Настройки',
        title: 'Настройки',
        description: 'Выберите, что хотите изменить.',
        appearanceTitle: 'Внешний вид',
        appearanceDescription:
          'Выберите, будет ли Floriva следовать внешнему виду этого устройства или останется в одном режиме.',
        currentModeLabel: 'Текущий режим',
        followSystem: 'Следовать системе',
        light: 'Светлый',
        dark: 'Тёмный',
        privacyAndRemindersTitle: 'Приватность и напоминания',
        privacyAndRemindersDescription:
          'Блокировка приложения, напоминания и настройки планирования беременности.',
        privacyLockTitle: 'Приватность и блокировка',
        feedbackTitle: 'Обратная связь',
        feedbackSummary: 'Идеи, ошибки, пожелания',
        soundsTitle: 'Звук и вибрация',
        soundsSummary: 'Вибрация и звуки нажатия',
        privacyLockSummary: 'Биометрическая блокировка выключена. Повторно блокируется через 1 минуту. Диагностика выключена.',
        remindersTitle: 'Напоминания',
        remindersSummary: 'На этом устройстве активно 1 напоминание.',
        ttcTitle: 'Планирование беременности',
        ttcSummaryOff: 'Выключено',
        ttcSummaryOn: 'Включено',
        ttcSummaryOnDetail: 'Включено · {flags}',
        languageTitle: 'Язык',
        languageSummary: 'Системный язык · Английский',
        billingAndDataTitle: 'Оплата и данные',
        billingAndDataDescription:
          'Подписка, резервное копирование, импорт и удаление данных.',
        subscriptionTitle: 'Подписка',
        subscriptionSummary: 'Пробный период активен. Годовой план.',
        rateAppTitle: 'Оценить Floriva',
        rateAppSummary: 'Оставьте отзыв в магазине приложений.',
        dataTitle: 'Данные и импорт',
        dataSummary: 'Резервное копирование, восстановление, импорт и сведения о приватности.',
        deleteDataTitle: 'Удалить локальные данные',
        deleteDataSummary:
          'Удаляет всё на этом устройстве только после отдельного шага подтверждения.',
      },
      language: {
        eyebrow: 'Настройки',
        title: 'Язык',
        description: 'Выберите язык, который Floriva использует на этом устройстве.',
        currentLabel: 'Текущий язык',
        choicesTitle: 'Доступные языки',
        systemDefault: 'Системный язык',
        backLabel: 'Назад к настройкам',
        selectedLabel: 'Текущий выбор',
      },
    },
  },
} as const;

const settingsDeepMessages = {
  en: {
    settings: {
      status: {
        updated: 'Updated',
        warning: 'Needs attention',
        loading: 'Loading...',
        saveFailed: "Couldn't save changes. Try again.",
        reminderSyncFailed:
          'Saved on this device, but reminder timing could not refresh right now.',
        notificationsRequired:
          'Notifications are off for Floriva. Enable them in device settings before turning reminders on.',
        noSubscription: 'No subscription',
        trialActive: 'Trial active',
        premiumActive: 'Premium active',
        expired: 'Expired',
        noRemindersActive: 'No reminders active on this device.',
        remindersLoading: 'Loading reminder timing from this device.',
        remindersLoadError: 'Reminder timing could not load right now.',
      },
      ttcLayout: {
        loading: 'Loading trying-to-conceive setup...',
        retry: 'Try again',
        loadError: 'Trying-to-conceive setup could not load right now.',
      },
      privacyLock: {
        screen: {
          eyebrow: 'Settings',
          title: 'Privacy & lock',
          description: 'Set up app lock and manage diagnostics.',
          backLabel: 'Back to settings',
        },
        deviceLock: {
          title: 'Device lock',
          description:
            'Floriva can lock on launch and after a short pause. It uses {methods} set up on your device.',
          biometricLockLabel: 'Biometric lock',
          relockTimeoutLabel: 'Relock timeout',
          accessTitle: 'Biometric access',
          accessDescription:
            'Use {methods} set up on this device to lock future launches.',
          on: 'On',
          off: 'Off',
          turnOn: 'Set up biometric lock',
          turnOff: 'Turn off biometric lock',
          unavailable: 'This device has no biometric unlock set up.',
          enabled:
            'Biometric lock is on. Future launches will require {methods}.',
          disabled: 'Biometric lock is off.',
        },
        automaticRelock: {
          title: 'Automatic relock',
          description: 'Floriva relocks after {duration} away from the app.',
          oneMinute: '1 minute',
          fiveMinutes: '5 minutes',
          minutes: '{minutes} minutes',
          oneMinuteStatus: 'Relock timeout is now 1 minute.',
          fiveMinutesStatus: 'Relock timeout is now 5 minutes.',
        },
        quickAction: {
          title: 'Quick action',
          descriptionLocked: 'Turn on biometric lock to use Lock now.',
          descriptionUnlocked: 'Lock Floriva before handing your phone to someone.',
          button: 'Lock now',
          unavailable:
            'Floriva can only lock when biometric lock is on and {methods} is available.',
        },
        diagnostics: {
          title: 'Diagnostics',
          description:
            'Diagnostics are off by default. If you turn them on, Floriva keeps app-health data on this device for local troubleshooting. Personal details are not included.',
          sharingLabel: 'Diagnostics setting:',
          on: 'On',
          off: 'Off',
          notes:
            'Notes, symptoms, moods, trying-to-conceive observations, birth-control details, and other personal data are never included in diagnostics.',
          turnOn: 'Turn on diagnostics',
          turnOff: 'Turn off diagnostics',
          savedOn:
            'Diagnostics are on. Floriva keeps only app-health data on this device. Personal details are not included.',
          savedOff: 'Diagnostics are off.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Settings',
          title: 'Reminders',
          description: 'Set reminder times.',
          backLabel: 'Back to settings',
        },
        section: {
          title: 'Saved reminders',
          description:
            'Reminders are saved on this device. They only run after you turn them on.',
        },
        status: {
          updated: 'Updated',
          loading: 'Loading saved reminder settings...',
          error: 'Reminder settings could not load right now. Reopen Settings and try again.',
          refreshFailed:
            "Reminder settings saved, but notification scheduling could not refresh. Open reminders and try again.",
        },
        badges: {
          on: 'On',
          off: 'Off',
        },
        actions: {
          turnOnPrefix: 'Turn on',
          turnOffPrefix: 'Turn off',
          editTiming: 'Edit timing',
          hideTimingControls: 'Hide timing controls',
          earlierBy30Min: 'Earlier by 30 min',
          laterBy30Min: 'Later by 30 min',
          lessNotice: 'Less notice',
          moreNotice: 'More notice',
        },
        detail: {
          fineTuneTiming: 'Fine-tune timing for this reminder.',
        },
        labels: {
          dailyLog: 'Daily log reminder',
          periodStart: 'Period reminder',
          fertileWindow: 'Fertile window reminder',
          birthControl: 'Birth control reminder',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Settings',
          title: 'Subscription',
          titlePrefix: '',
          titleAccent: 'Subscription',
          titleSuffix: '.',
          descriptionRecurring:
            'Check your billing status, restore purchases, or manage your subscription in the store.',
          descriptionOneTime:
            'Check your billing status or restore your one-time purchase.',
          backLabel: 'Back to settings',
        },
        current: {
          title: 'Current plan',
          label: 'Current plan',
          description: 'The latest billing status stored on this device.',
          trialEnds: 'Trial ends {date}.',
          billingStarts: 'Billing starts {date}.',
          currentAccessEnds: 'Access ends {date}.',
          recurringManagementAvailable:
            'Manage Floriva Premium in your platform subscription settings.',
          recurringManagementFallback:
            'If no direct store link is available, Floriva opens the platform subscription page.',
          lifetimeInfo:
            'Lifetime access is a one-time purchase. It does not renew.',
          retired:
            'Floriva is now free and is no longer being updated. Every feature is unlocked and your data stays on this device. You will not be charged again. If you were charged recently, you can request a refund from the store you subscribed through.',
        },
        planLabels: {
          annual: 'Annual plan',
          lifetime: 'Lifetime plan',
          monthly: 'Monthly plan',
          none: 'No active plan',
        },
        states: {
          trialActive: 'Trial active',
          premiumActive: 'Premium active',
          expired: 'Expired',
          billingNeedsAttention: 'Billing needs attention',
          noSubscription: 'No subscription',
        },
        actions: {
          manageSubscription: 'Manage subscription',
          refreshAccess: 'Refresh access',
          restorePurchases: 'Restore purchases',
          readPrivacyPolicy: 'Read privacy policy',
          contactSupport: 'Contact support',
        },
        help: {
          title: 'Need help?',
          description: 'Support and privacy policy links.',
        },
        saveOffer: {
          eyebrow: 'Before you go',
          codeTitle: 'Apple offer code',
          codeBody:
            '{code} will be copied when you accept. Paste it into Apple’s redemption sheet to apply the discount.',
          monthly: {
            title: 'Stay for 80% off the next 3 months',
            body: 'Keep everything you’ve logged. Your monthly plan drops to {discounted} for 3 months, then returns to {full}. Cancel anytime.',
            primary: 'Keep Floriva — 80% off',
          },
          annual: {
            title: 'Stay for 30% off your next year',
            body: 'Keep everything you’ve logged and renew for {discounted} for the year instead of {full}. Cancel anytime.',
            primary: 'Keep Floriva — 30% off',
          },
          annualTrial: {
            title: 'Stay for 30% off your first year',
            body: 'Keep everything you’ve logged and pay {discounted} for the year instead of {full}. Cancel anytime.',
            primary: 'Keep Floriva — 30% off',
          },
          decline: 'Continue to cancel',
          confirmation: 'Your discount’s applied',
          failure: 'That didn’t go through. Try again or continue to cancel.',
        },
      },
      data: {
        screen: {
          eyebrow: 'Settings',
          title: 'Data & import',
          description: 'Back up, import, and review privacy details for this device.',
          backLabel: 'Back to settings',
        },
        deviceStorage: {
          title: 'Device storage',
          description: 'Your data stays on this device until you move it.',
          openBackup: 'Open backup and restore',
        },
        imports: {
          title: 'Imports',
          description: 'Import data from another app or read the privacy details.',
          openImport: 'Open import',
          openPrivacy: 'Read privacy details',
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Settings',
          title: 'Delete local data',
          titlePrefix: 'Delete local ',
          titleAccent: 'data',
          titleSuffix: '.',
          description: 'Remove all Floriva data from this device.',
          backLabel: 'Back to settings',
        },
        danger: {
          title: 'Danger zone',
          description: 'This removes Floriva data from this device. It does not affect any other device.',
          deleteAll: 'Delete all local data',
        },
        warning:
          'This removes your cycle history, reminders, imports, and lock settings from this device. You cannot undo this.',
        confirm: 'Confirm: delete all local data from this device',
        cancel: 'Keep local data',
        error: 'Floriva could not delete local data right now. Try again.',
        beforeConfirm: {
          title: 'Before you confirm',
          description: 'Read this before you delete.',
          backupFirst:
            'Make an encrypted backup first if you want to save this history.',
          resetPurpose:
            'Use this only to clear all Floriva data from inside the app.',
        },
      },
    },
  },
  es: {
    settings: {
      status: {
        updated: 'Actualizado',
        warning: 'Necesita atención',
        loading: 'Cargando...',
        saveFailed: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
        reminderSyncFailed:
          'Se guardó en este dispositivo, pero Floriva no pudo actualizar ahora el horario de los recordatorios.',
        notificationsRequired:
          'Las notificaciones están desactivadas para Floriva. Actívalas en la configuración del dispositivo antes de encender recordatorios.',
        noSubscription: 'Sin suscripción',
        trialActive: 'Prueba activa',
        premiumActive: 'Premium activo',
        expired: 'Caducado',
        noRemindersActive: 'No hay recordatorios activos en este dispositivo.',
        remindersLoading: 'Comprobando la programación de recordatorios guardada en este dispositivo.',
        remindersLoadError: 'No se pudo cargar la hora de los recordatorios ahora mismo.',
      },
      ttcLayout: {
        loading: 'Cargando configuración para buscar embarazo...',
        retry: 'Intentar de nuevo',
        loadError: 'La configuración para buscar embarazo no se pudo cargar ahora mismo.',
      },
      privacyLock: {
        screen: {
          eyebrow: 'Configuración',
          title: 'Privacidad y bloqueo',
          description: 'Configura el bloqueo de la app y gestiona los diagnósticos.',
          backLabel: 'Volver a configuración',
        },
        deviceLock: {
          title: 'Bloqueo del dispositivo',
          description:
            'Floriva puede volver a bloquearse al abrirse y después de una breve pausa cuando este dispositivo tenga {methods}.',
          biometricLockLabel: 'Bloqueo biométrico',
          relockTimeoutLabel: 'Tiempo de relock',
          accessTitle: 'Acceso biométrico',
          accessDescription:
            'Usa {methods} de este dispositivo para proteger futuros inicios.',
          on: 'Activado',
          off: 'Desactivado',
          turnOn: 'Configurar bloqueo biométrico',
          turnOff: 'Desactivar bloqueo biométrico',
          unavailable: 'Este dispositivo no tiene un método biométrico de desbloqueo registrado.',
          enabled:
            'El bloqueo biométrico protegerá futuros inicios cuando este dispositivo tenga {methods}.',
          disabled: 'El bloqueo biométrico está desactivado por ahora.',
        },
        automaticRelock: {
          title: 'Relock automático',
          description: 'Floriva vuelve a bloquearse después de {duration} fuera de la app.',
          oneMinute: '1 minuto',
          fiveMinutes: '5 minutos',
          minutes: '{minutes} minutos',
          oneMinuteStatus: 'El tiempo de relock ahora es de 1 minuto.',
          fiveMinutesStatus: 'El tiempo de relock ahora es de 5 minutos.',
        },
        quickAction: {
          title: 'Acción rápida',
          descriptionLocked: 'Activa el bloqueo biométrico para usar Bloquear ahora.',
          descriptionUnlocked: 'Vuelve a bloquear Floriva antes de prestar tu teléfono.',
          button: 'Bloquear ahora',
          unavailable:
            'Floriva solo puede bloquear este dispositivo cuando el bloqueo biométrico está activado y {methods} está disponible.',
        },
        diagnostics: {
          title: 'Diagnósticos',
          description:
            'Los diagnósticos técnicos están desactivados por defecto. Si los activas, Floriva mantiene diagnósticos redactados de salud de la app solo para resolución local en este dispositivo.',
          sharingLabel: 'Ajuste de diagnósticos:',
          on: 'Activado',
          off: 'Desactivado',
          notes:
            'Las notas, síntomas, estados de ánimo, observaciones sobre búsqueda de embarazo, detalles de anticoncepción y otros datos reproductivos nunca deben ir en diagnósticos.',
          turnOn: 'Activar diagnósticos',
          turnOff: 'Desactivar diagnósticos',
          savedOn:
            'Los diagnósticos técnicos están activados solo para resolución local con datos de salud de la app redactados.',
          savedOff: 'Los diagnósticos técnicos están desactivados.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Configuración',
          title: 'Recordatorios',
          description: 'Ajusta la hora de los recordatorios.',
          backLabel: 'Volver a configuración',
        },
        section: {
          title: 'Recordatorios guardados',
          description:
            'Los ajustes preestablecidos de recordatorios se guardan en este dispositivo y solo se programan después de activarlos.',
        },
        status: {
          updated: 'Actualizado',
          loading: 'Cargando la configuración de recordatorios guardada...',
          error: 'Floriva no pudo cargar la configuración de recordatorios guardada ahora mismo. Vuelve a abrir Configuración e inténtalo otra vez.',
          refreshFailed:
            'Los ajustes de recordatorios se guardaron, pero Floriva no pudo actualizar la programación de notificaciones. Abre Recordatorios e inténtalo de nuevo.',
        },
        badges: {
          on: 'Activado',
          off: 'Desactivado',
        },
        actions: {
          turnOnPrefix: 'Activar',
          turnOffPrefix: 'Desactivar',
          editTiming: 'Editar horario',
          hideTimingControls: 'Ocultar controles de horario',
          earlierBy30Min: '30 min antes',
          laterBy30Min: '30 min después',
          lessNotice: 'Menos aviso',
          moreNotice: 'Más aviso',
        },
        detail: {
          fineTuneTiming: 'Ajusta con más precisión la hora de este recordatorio.',
        },
        labels: {
          dailyLog: 'Recordatorio de registro diario',
          periodStart: 'Recordatorio de periodo',
          fertileWindow: 'Recordatorio de ventana fértil',
          birthControl: 'Recordatorio de anticonceptivos',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Configuración',
          title: 'Suscripción',
          titlePrefix: '',
          titleAccent: 'Suscripción',
          titleSuffix: '.',
          descriptionRecurring:
            'Revisa tu estado de cobro actual, restaura compras o abre el gestor de suscripciones de la tienda.',
          descriptionOneTime:
            'Revisa tu estado de cobro actual o restaura compras para este desbloqueo de pago único.',
          backLabel: 'Volver a configuración',
        },
        current: {
          title: 'Plan actual',
          label: 'Plan actual',
          description: 'Revisa el estado de facturación más reciente guardado para este dispositivo.',
          trialEnds: 'La prueba termina el {date}.',
          billingStarts: 'La facturación empieza el {date}.',
          currentAccessEnds: 'El acceso actual termina el {date}.',
          recurringManagementAvailable:
            'Puedes gestionar Floriva Premium en la configuración de suscripciones de tu plataforma.',
          recurringManagementFallback:
            'Floriva abrirá la página de suscripciones de la plataforma cuando todavía no haya un enlace directo al gestor de la tienda.',
          lifetimeInfo:
            'El acceso de por vida es una compra única y no usa ajustes de suscripción recurrente.',
          retired:
            'Floriva ahora es gratis y ya no recibe actualizaciones. Todas las funciones están desbloqueadas y tus datos permanecen en este dispositivo. No se te volverá a cobrar. Si te cobraron hace poco, puedes solicitar un reembolso en la tienda donde te suscribiste.',
        },
        planLabels: {
          annual: 'Plan anual',
          lifetime: 'Plan de por vida',
          monthly: 'Plan mensual',
          none: 'Sin plan activo',
        },
        states: {
          trialActive: 'Prueba activa',
          premiumActive: 'Premium activo',
          expired: 'Caducado',
          billingNeedsAttention: 'La facturación necesita atención',
          noSubscription: 'Sin suscripción',
        },
        actions: {
          manageSubscription: 'Gestionar suscripción',
          refreshAccess: 'Actualizar acceso',
          restorePurchases: 'Restaurar compras',
          readPrivacyPolicy: 'Leer política de privacidad',
          contactSupport: 'Contactar soporte',
        },
        help: {
          title: '¿Necesitas ayuda?',
          description: 'Soporte y política de privacidad.',
        },
        saveOffer: {
          eyebrow: 'Antes de irte',
          codeTitle: 'Código de oferta de Apple',
          codeBody:
            'Al aceptar, se copiará {code}. Pégalo en la hoja de canje de Apple para aplicar el descuento.',
          monthly: {
            title: 'Quédate con un 80 % de descuento los próximos 3 meses',
            body: 'Conserva todo lo que has registrado. Tu plan mensual baja a {discounted} durante 3 meses y luego vuelve a {full}. Cancela cuando quieras.',
            primary: 'Conservar Floriva — 80 % de descuento',
          },
          annual: {
            title: 'Quédate con un 30 % de descuento el próximo año',
            body: 'Conserva todo lo que has registrado y renueva por {discounted} al año en lugar de {full}. Cancela cuando quieras.',
            primary: 'Conservar Floriva — 30 % de descuento',
          },
          annualTrial: {
            title: 'Quédate con un 30 % de descuento el primer año',
            body: 'Conserva todo lo que has registrado y paga {discounted} al año en lugar de {full}. Cancela cuando quieras.',
            primary: 'Conservar Floriva — 30 % de descuento',
          },
          decline: 'Continuar con la cancelación',
          confirmation: 'Descuento aplicado',
          failure: 'No se pudo aplicar. Inténtalo de nuevo o continúa con la cancelación.',
        },
      },
      data: {
        screen: {
          eyebrow: 'Configuración',
          title: 'Datos e importación',
          description: 'Copia de seguridad, importación e información de privacidad.',
          backLabel: 'Volver a configuración',
        },
        deviceStorage: {
          title: 'Almacenamiento del dispositivo',
          description: 'Floriva guarda los datos en este dispositivo a menos que decidas moverlos.',
          openBackup: 'Abrir copia de seguridad y restauración',
        },
        imports: {
          title: 'Importaciones',
          description:
            'Importa datos de otra app o consulta los detalles de privacidad.',
          openImport: 'Abrir flujo de importación',
          openPrivacy: 'Leer explicación de privacidad',
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Configuración',
          title: 'Eliminar datos locales',
          titlePrefix: 'Eliminar ',
          titleAccent: 'datos',
          titleSuffix: ' locales.',
          description:
            'Elimina todos los datos de Floriva de este dispositivo.',
          backLabel: 'Volver a configuración',
        },
        danger: {
          title: 'Zona de peligro',
          description: 'Esto elimina los datos de Floriva solo de este dispositivo.',
          deleteAll: 'Eliminar todos los datos locales',
        },
        warning:
          'Esto elimina tu historial de ciclo, recordatorios, importaciones y estado de bloqueo de privacidad de este dispositivo. Floriva no puede deshacerlo después de que confirmes.',
        confirm: 'Confirmar eliminación de todos los datos locales de este dispositivo',
        cancel: 'Conservar los datos locales en este dispositivo',
        error: 'Floriva no pudo borrar ahora los datos locales. Inténtalo de nuevo.',
        beforeConfirm: {
          title: 'Antes de confirmar',
          description:
            'Lee esto antes de eliminar.',
          backupFirst:
            'Crea primero una copia de seguridad cifrada si es posible que quieras llevar este historial a otro dispositivo más adelante.',
          resetPurpose:
            'Usa esto solo para borrar todos los datos de Floriva desde dentro de la app.',
        },
      },
    },
  },
  de: {
    settings: {
      status: {
        updated: 'Aktualisiert',
        warning: 'Benötigt Aufmerksamkeit',
        loading: 'Lädt ...',
        saveFailed: 'Änderungen konnten nicht gespeichert werden. Versuche es erneut.',
        reminderSyncFailed:
          'Auf diesem Gerät gespeichert, aber Floriva konnte die Erinnerungszeit gerade nicht aktualisieren.',
        notificationsRequired:
          'Benachrichtigungen sind für Floriva deaktiviert. Aktiviere sie in den Geräteeinstellungen, bevor du Erinnerungen einschaltest.',
        noSubscription: 'Kein Abo',
        trialActive: 'Testphase aktiv',
        premiumActive: 'Premium aktiv',
        expired: 'Abgelaufen',
        noRemindersActive: 'Auf diesem Gerät sind keine Erinnerungen aktiv.',
        remindersLoading: 'Gespeicherte Erinnerungszeiten auf diesem Gerät werden geprüft.',
        remindersLoadError: 'Die Erinnerungszeiten konnten gerade nicht geladen werden.',
      },
      ttcLayout: {
        loading: 'Kinderwunsch-Einrichtung wird geladen...',
        retry: 'Erneut versuchen',
        loadError: 'Die Kinderwunsch-Einrichtung konnte gerade nicht geladen werden.',
      },
      privacyLock: {
        screen: {
          eyebrow: 'Einstellungen',
          title: 'Privatsphäre und Sperre',
          description: 'App-Sperre einrichten und Diagnosen verwalten.',
          backLabel: 'Zurück zu den Einstellungen',
        },
        deviceLock: {
          title: 'Gerätesperre',
          description:
            'Floriva kann sich beim Start und nach einer kurzen Pause erneut sperren, wenn auf diesem Gerät {methods} eingerichtet ist.',
          biometricLockLabel: 'Biometrische Sperre',
          relockTimeoutLabel: 'Sperrzeit',
          accessTitle: 'Biometrischer Zugriff',
          accessDescription:
            'Verwende {methods} dieses Geräts, um zukünftige Starts zu schützen.',
          on: 'Ein',
          off: 'Aus',
          turnOn: 'Biometrische Sperre einrichten',
          turnOff: 'Biometrische Sperre ausschalten',
          unavailable: 'Dieses Gerät hat derzeit keine eingerichtete biometrische Entsperrmethode.',
          enabled:
            'Die biometrische Sperre schützt zukünftige Starts, wenn auf diesem Gerät {methods} eingerichtet ist.',
          disabled: 'Die biometrische Sperre ist vorerst aus.',
        },
        automaticRelock: {
          title: 'Automatische erneute Sperre',
          description: 'Floriva sperrt sich nach {duration} außerhalb der App erneut.',
          oneMinute: '1 Minute',
          fiveMinutes: '5 Minuten',
          minutes: '{minutes} Minuten',
          oneMinuteStatus: 'Die Sperrzeit beträgt jetzt 1 Minute.',
          fiveMinutesStatus: 'Die Sperrzeit beträgt jetzt 5 Minuten.',
        },
        quickAction: {
          title: 'Schnellaktion',
          descriptionLocked: 'Aktiviere die biometrische Sperre, um Jetzt sperren zu verwenden.',
          descriptionUnlocked: 'Sperre Floriva erneut, bevor du dein Telefon weitergibst.',
          button: 'Jetzt sperren',
          unavailable:
            'Floriva kann dieses Gerät nur sperren, wenn die biometrische Sperre aktiv ist und {methods} verfügbar ist.',
        },
        diagnostics: {
          title: 'Diagnosen',
          description:
            'Technische Diagnosen sind standardmäßig aus. Wenn du sie einschaltest, hält Floriva redigierte App-Gesundheitsdaten nur für die lokale Fehlersuche auf diesem Gerät bereit.',
          sharingLabel: 'Diagnoseeinstellung:',
          on: 'Ein',
          off: 'Aus',
          notes:
            'Notizen, Symptome, Stimmungen, Kinderwunsch-Beobachtungen, Verhütungsdetails und andere reproduktive Daten gehören nie in Diagnosen.',
          turnOn: 'Diagnosen aktivieren',
          turnOff: 'Diagnosen deaktivieren',
          savedOn:
            'Technische Diagnosen sind nur für die lokale Fehlersuche mit redigierten App-Gesundheitsdaten aktiv.',
          savedOff: 'Technische Diagnosen sind aus.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Einstellungen',
          title: 'Erinnerungseinstellungen',
          description: 'Passe Erinnerungszeiten an.',
          backLabel: 'Zurück zu den Einstellungen',
        },
        section: {
          title: 'Gespeicherte Erinnerungen',
          description:
            'Erinnerungsvorgaben bleiben auf diesem Gerät und werden erst geplant, nachdem du sie aktivierst.',
        },
        status: {
          updated: 'Aktualisiert',
          loading: 'Gespeicherte Erinnerungseinstellungen werden geladen ...',
          error: 'Floriva konnte die gespeicherten Erinnerungseinstellungen gerade nicht laden. Öffne die Einstellungen erneut und versuche es noch einmal.',
          refreshFailed:
            'Die Erinnerungseinstellungen wurden gespeichert, aber Floriva konnte die Benachrichtigungsplanung nicht aktualisieren. Öffne Erinnerungen und versuche es erneut.',
        },
        badges: {
          on: 'Ein',
          off: 'Aus',
        },
        actions: {
          turnOnPrefix: 'Aktiviere',
          turnOffPrefix: 'Deaktiviere',
          editTiming: 'Zeit anpassen',
          hideTimingControls: 'Zeitsteuerung ausblenden',
          earlierBy30Min: '30 Min. früher',
          laterBy30Min: '30 Min. später',
          lessNotice: 'Weniger Vorlauf',
          moreNotice: 'Mehr Vorlauf',
        },
        detail: {
          fineTuneTiming: 'Feinabstimmung der Zeit für diese Erinnerung.',
        },
        labels: {
          dailyLog: 'Erinnerung für täglichen Eintrag',
          periodStart: 'Erinnerung für Periodenbeginn',
          fertileWindow: 'Erinnerung für fruchtbares Fenster',
          birthControl: 'Erinnerung für Verhütung',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Einstellungen',
          title: 'Abo',
          titlePrefix: '',
          titleAccent: 'Abo',
          titleSuffix: '.',
          descriptionRecurring:
            'Prüfe deinen aktuellen Abrechnungsstatus, stelle Käufe wieder her oder öffne den Abo-Manager des Stores.',
          descriptionOneTime:
            'Prüfe deinen aktuellen Abrechnungsstatus oder stelle Käufe für diesen Einmalkauf wieder her.',
          backLabel: 'Zurück zu den Einstellungen',
        },
        current: {
          title: 'Aktueller Plan',
          label: 'Aktueller Plan',
          description: 'Prüfe den zuletzt für dieses Gerät gespeicherten Abrechnungsstatus.',
          trialEnds: 'Testphase endet am {date}.',
          billingStarts: 'Abrechnung beginnt am {date}.',
          currentAccessEnds: 'Aktueller Zugriff endet am {date}.',
          recurringManagementAvailable:
            'Du kannst Floriva Premium in den Abo-Einstellungen deiner Plattform verwalten.',
          recurringManagementFallback:
            'Floriva öffnet die Abo-Seite der Plattform, wenn noch kein direkter Link zur Store-Verwaltung verfügbar ist.',
          lifetimeInfo:
            'Der Lifetime-Zugriff ist ein Einmalkauf und verwendet keine wiederkehrenden Abo-Einstellungen.',
          retired:
            'Floriva ist jetzt kostenlos und wird nicht mehr aktualisiert. Alle Funktionen sind freigeschaltet und deine Daten bleiben auf diesem Gerät. Es wird nichts mehr abgebucht. Falls dir kürzlich etwas berechnet wurde, kannst du im Store, über den du abonniert hast, eine Rückerstattung beantragen.',
        },
        planLabels: {
          annual: 'Jahresplan',
          lifetime: 'Lebenslanger Zugriff',
          monthly: 'Monatsplan',
          none: 'Kein aktiver Plan',
        },
        states: {
          trialActive: 'Testphase aktiv',
          premiumActive: 'Premium aktiv',
          expired: 'Abgelaufen',
          billingNeedsAttention: 'Abrechnung braucht Aufmerksamkeit',
          noSubscription: 'Kein Abo',
        },
        actions: {
          manageSubscription: 'Abo verwalten',
          refreshAccess: 'Zugang aktualisieren',
          restorePurchases: 'Käufe wiederherstellen',
          readPrivacyPolicy: 'Datenschutzerklärung lesen',
          contactSupport: 'Support kontaktieren',
        },
        help: {
          title: 'Brauchst du Hilfe?',
          description: 'Support und Datenschutzerklärung.',
        },
        saveOffer: {
          eyebrow: 'Bevor du gehst',
          codeTitle: 'Apple-Angebotscode',
          codeBody:
            '{code} wird beim Bestätigen kopiert. Füge ihn in Apples Einlösefenster ein, um den Rabatt anzuwenden.',
          monthly: {
            title: 'Bleib mit 80 % Rabatt für die nächsten 3 Monate',
            body: 'Behalte alles, was du erfasst hast. Dein Monatsplan sinkt für 3 Monate auf {discounted} und kehrt dann zu {full} zurück. Jederzeit kündbar.',
            primary: 'Floriva behalten — 80 % Rabatt',
          },
          annual: {
            title: 'Bleib mit 30 % Rabatt für dein nächstes Jahr',
            body: 'Behalte alles, was du erfasst hast, und verlängere für {discounted} pro Jahr statt {full}. Jederzeit kündbar.',
            primary: 'Floriva behalten — 30 % Rabatt',
          },
          annualTrial: {
            title: 'Bleib mit 30 % Rabatt für dein erstes Jahr',
            body: 'Behalte alles, was du erfasst hast, und zahle {discounted} pro Jahr statt {full}. Jederzeit kündbar.',
            primary: 'Floriva behalten — 30 % Rabatt',
          },
          decline: 'Weiter zum Kündigen',
          confirmation: 'Dein Rabatt ist aktiv',
          failure: 'Das hat nicht geklappt. Versuche es erneut oder fahre mit dem Kündigen fort.',
        },
      },
      data: {
        screen: {
          eyebrow: 'Einstellungen',
          title: 'Daten und Import',
          description: 'Backup, Import und Datenschutzdetails für dieses Gerät.',
          backLabel: 'Zurück zu den Einstellungen',
        },
        deviceStorage: {
          title: 'Gerätespeicher',
          description: 'Floriva behält Daten auf diesem Gerät, es sei denn, du entscheidest dich zum Verschieben.',
          openBackup: 'Backup und Wiederherstellung öffnen',
        },
        imports: {
          title: 'Importe',
          description:
            'Importiere Daten aus einer anderen App oder lies die Datenschutzdetails.',
          openImport: 'Importfluss öffnen',
          openPrivacy: 'Datenschutzhinweis lesen',
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Einstellungen',
          title: 'Lokale Daten löschen',
          titlePrefix: 'Lokale ',
          titleAccent: 'Daten',
          titleSuffix: ' löschen.',
          description:
            'Alle Floriva-Daten von diesem Gerät entfernen.',
          backLabel: 'Zurück zu den Einstellungen',
        },
        danger: {
          title: 'Gefahrenzone',
          description: 'Dadurch werden Floriva-Daten nur von diesem Gerät entfernt.',
          deleteAll: 'Alle lokalen Daten löschen',
        },
        warning:
          'Dadurch werden dein Zyklusverlauf, Erinnerungen, Importe und der Sperrstatus für die Privatsphäre von diesem Gerät entfernt. Floriva kann das nach deiner Bestätigung nicht rückgängig machen.',
        confirm: 'Löschen aller lokalen Daten auf diesem Gerät bestätigen',
        cancel: 'Lokale Daten auf diesem Gerät behalten',
        error: 'Floriva konnte die lokalen Daten gerade nicht löschen. Versuche es erneut.',
        beforeConfirm: {
          title: 'Bevor du bestätigst',
          description:
            'Prüfe dies, bevor du lokale Daten löschst.',
          backupFirst:
            'Erstelle zuerst ein verschlüsseltes Backup, wenn du diesen Verlauf später vielleicht auf ein anderes Gerät mitnehmen willst.',
          resetPurpose:
            'Verwende dies nur, um alle Floriva-Daten aus der App zu löschen.',
        },
      },
    },
  },
  fr: {
    settings: {
      status: {
        updated: 'Mis à jour',
        warning: 'Nécessite une attention',
        loading: 'Chargement...',
        saveFailed: "Les changements n’ont pas pu être enregistrés. Réessaie.",
        reminderSyncFailed:
          "Enregistré sur cet appareil, mais Floriva n’a pas pu actualiser l’horaire des rappels pour le moment.",
        notificationsRequired:
          "Les notifications sont désactivées pour Floriva. Active-les dans les réglages de l’appareil avant d’activer les rappels.",
        noSubscription: 'Aucun abonnement',
        trialActive: 'Essai actif',
        premiumActive: 'Premium actif',
        expired: 'Expiré',
        noRemindersActive: 'Aucun rappel actif sur cet appareil.',
        remindersLoading: 'Vérification des horaires de rappel enregistrés sur cet appareil.',
        remindersLoadError: "Les horaires de rappel n’ont pas pu être chargés pour le moment.",
      },
      ttcLayout: {
        loading: 'Chargement de la configuration projet bébé...',
        retry: 'Réessayer',
        loadError: "La configuration projet bébé n’a pas pu être chargée pour le moment.",
      },
      privacyLock: {
        screen: {
          eyebrow: 'Réglages',
          title: 'Confidentialité et verrouillage',
          description: "Configure le verrouillage de l’app et gère les diagnostics.",
          backLabel: 'Retour aux réglages',
        },
        deviceLock: {
          title: "Verrou de l’appareil",
          description:
            "Floriva peut se reverrouiller au lancement et après une courte pause lorsque {methods} est configuré sur cet appareil.",
          biometricLockLabel: 'Verrouillage biométrique',
          relockTimeoutLabel: 'Délai de reverrouillage',
          accessTitle: 'Accès biométrique',
          accessDescription:
            "Utilise {methods} de cet appareil pour protéger les futurs lancements.",
          on: 'Activé',
          off: 'Désactivé',
          turnOn: 'Configurer le verrouillage biométrique',
          turnOff: 'Désactiver le verrouillage biométrique',
          unavailable: "Cet appareil n’a pas actuellement de méthode biométrique de déverrouillage configurée.",
          enabled:
            "Le verrouillage biométrique protégera les futurs lancements lorsque {methods} est configuré sur cet appareil.",
          disabled: 'Le verrouillage biométrique est désactivé pour le moment.',
        },
        automaticRelock: {
          title: 'Reverrouillage automatique',
          description: "Floriva se reverrouille après {duration} hors de l’application.",
          oneMinute: '1 minute',
          fiveMinutes: '5 minutes',
          minutes: '{minutes} minutes',
          oneMinuteStatus: 'Le délai de reverrouillage est maintenant de 1 minute.',
          fiveMinutesStatus: 'Le délai de reverrouillage est maintenant de 5 minutes.',
        },
        quickAction: {
          title: 'Action rapide',
          descriptionLocked: 'Active le verrouillage biométrique pour utiliser Verrouiller maintenant.',
          descriptionUnlocked: 'Reverrouille Floriva avant de prêter ton téléphone.',
          button: 'Verrouiller maintenant',
          unavailable:
            "Floriva ne peut verrouiller cet appareil que lorsque le verrouillage biométrique est activé et que {methods} est disponible.",
        },
        diagnostics: {
          title: 'Diagnostics',
          description:
            "Les diagnostics techniques sont désactivés par défaut. Si tu les actives, Floriva conserve des données d’état de l’application anonymisées uniquement pour un dépannage local sur cet appareil.",
          sharingLabel: 'Réglage des diagnostics :',
          on: 'Activé',
          off: 'Désactivé',
          notes:
            "Les notes, symptômes, humeurs, observations du projet bébé, détails contraceptifs et autres données reproductives n'ont jamais leur place dans les diagnostics.",
          turnOn: 'Activer les diagnostics',
          turnOff: 'Désactiver les diagnostics',
          savedOn:
            "Les diagnostics techniques sont activés uniquement pour un dépannage local avec des données d’état de l’application anonymisées.",
          savedOff: 'Les diagnostics techniques sont désactivés.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Réglages',
          title: 'Réglages des rappels',
          description: 'Ajuste les horaires des rappels.',
          backLabel: 'Retour aux réglages',
        },
        section: {
          title: 'Rappels enregistrés',
          description:
            "Les préréglages de rappel sont stockés sur cet appareil et ne se programment qu’après activation.",
        },
        status: {
          updated: 'Mis à jour',
          loading: 'Chargement des réglages de rappel enregistrés...',
          error: "Floriva n’a pas pu charger les réglages de rappel enregistrés pour le moment. Rouvre Réglages et réessaie.",
          refreshFailed:
            "Les réglages de rappel ont été enregistrés, mais Floriva n’a pas pu actualiser la planification des notifications. Ouvre les rappels et réessaie.",
        },
        badges: {
          on: 'Activé',
          off: 'Désactivé',
        },
        actions: {
          turnOnPrefix: 'Activer',
          turnOffPrefix: 'Désactiver',
          editTiming: "Modifier l’horaire",
          hideTimingControls: "Masquer les contrôles d’horaire",
          earlierBy30Min: '30 min plus tôt',
          laterBy30Min: '30 min plus tard',
          lessNotice: "Moins d’avance",
          moreNotice: "Plus d’avance",
        },
        detail: {
          fineTuneTiming: "Ajuste finement l’horaire de ce rappel.",
        },
        labels: {
          dailyLog: 'Rappel de journal quotidien',
          periodStart: 'Rappel de règles',
          fertileWindow: 'Rappel de fenêtre fertile',
          birthControl: 'Rappel de contraception',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Réglages',
          title: 'Abonnement',
          titlePrefix: '',
          titleAccent: 'Abonnement',
          titleSuffix: '.',
          descriptionRecurring:
            "Passe en revue ton état de facturation, restaure les achats ou ouvre le gestionnaire d’abonnement du store.",
          descriptionOneTime:
            'Passe en revue ton état de facturation ou restaure les achats pour ce déblocage en achat unique.',
          backLabel: 'Retour aux réglages',
        },
        current: {
          title: 'Formule actuelle',
          label: 'Formule actuelle',
          description: "Consulte l’état de facturation le plus récent enregistré pour cet appareil.",
          trialEnds: "L’essai se termine le {date}.",
          billingStarts: 'La facturation commence le {date}.',
          currentAccessEnds: "L’accès actuel se termine le {date}.",
          recurringManagementAvailable:
            "Tu peux gérer Floriva Premium dans les réglages d’abonnement de ta plateforme.",
          recurringManagementFallback:
            "Floriva ouvrira la page d’abonnement de la plateforme lorsqu’aucun lien direct de gestion du store n’est encore disponible.",
          lifetimeInfo:
            "L’accès à vie est un achat unique et n’utilise pas de réglages d’abonnement récurrent.",
          retired:
            "Floriva est désormais gratuite et n’est plus mise à jour. Toutes les fonctionnalités sont débloquées et tes données restent sur cet appareil. Aucun nouveau prélèvement ne sera effectué. Si un paiement a été prélevé récemment, tu peux demander un remboursement auprès du store où tu t’es abonné.",
        },
        planLabels: {
          annual: 'Formule annuelle',
          lifetime: 'Formule à vie',
          monthly: 'Formule mensuelle',
          none: 'Aucune formule active',
        },
        states: {
          trialActive: 'Essai actif',
          premiumActive: 'Premium actif',
          expired: 'Expiré',
          billingNeedsAttention: 'La facturation nécessite une attention',
          noSubscription: 'Aucun abonnement',
        },
        actions: {
          manageSubscription: "Gérer l’abonnement",
          refreshAccess: "Actualiser l’accès",
          restorePurchases: 'Restaurer les achats',
          readPrivacyPolicy: 'Lire la politique de confidentialité',
          contactSupport: 'Contacter le support',
        },
        help: {
          title: "Besoin d’aide ?",
          description:
            "Liens d’assistance et de politique.",
        },
        saveOffer: {
          eyebrow: 'Avant de partir',
          codeTitle: 'Code promotionnel Apple',
          codeBody:
            '{code} sera copié lorsque tu accepteras. Colle-le dans la feuille d’utilisation des codes Apple pour appliquer la réduction.',
          monthly: {
            title: 'Reste avec 80 % de réduction pendant les 3 prochains mois',
            body: 'Garde tout ce que tu as enregistré. Ta formule mensuelle passe à {discounted} pendant 3 mois, puis revient à {full}. Résiliable à tout moment.',
            primary: 'Garder Floriva — 80 % de réduction',
          },
          annual: {
            title: 'Reste avec 30 % de réduction pour ton année suivante',
            body: 'Garde tout ce que tu as enregistré et renouvelle pour {discounted} par an au lieu de {full}. Résiliable à tout moment.',
            primary: 'Garder Floriva — 30 % de réduction',
          },
          annualTrial: {
            title: 'Reste avec 30 % de réduction pour ta première année',
            body: 'Garde tout ce que tu as enregistré et paie {discounted} par an au lieu de {full}. Résiliable à tout moment.',
            primary: 'Garder Floriva — 30 % de réduction',
          },
          decline: 'Continuer vers la résiliation',
          confirmation: 'Ta réduction est appliquée',
          failure: "Cela n’a pas fonctionné. Réessaie ou continue vers la résiliation.",
        },
      },
      data: {
        screen: {
          eyebrow: 'Réglages',
          title: 'Données et importation',
          description: 'Sauvegarde, importe et consulte les détails de confidentialité.',
          backLabel: 'Retour aux réglages',
        },
        deviceStorage: {
          title: "Stockage de l’appareil",
          description: 'Floriva garde les données sur cet appareil, sauf si tu choisis de les déplacer.',
          openBackup: 'Ouvrir la sauvegarde et la restauration',
        },
        imports: {
          title: 'Importations',
          description:
            'Importe des données depuis une autre app ou lis les détails de confidentialité.',
          openImport: "Ouvrir le flux d’importation",
          openPrivacy: "Lire l’explication de confidentialité",
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Réglages',
          title: 'Supprimer les données locales',
          titlePrefix: 'Supprimer les ',
          titleAccent: 'données',
          titleSuffix: ' locales.',
          description:
            'Supprime les données Floriva de cet appareil.',
          backLabel: 'Retour aux réglages',
        },
        danger: {
          title: 'Zone dangereuse',
          description: 'Cela supprime les données Floriva uniquement de cet appareil.',
          deleteAll: 'Supprimer toutes les données locales',
        },
        warning:
          "Cela supprime de cet appareil ton historique de cycle, tes rappels, tes importations et l’état de verrouillage de confidentialité. Floriva ne peut pas annuler cela après confirmation.",
        confirm: 'Confirmer la suppression de toutes les données locales de cet appareil',
        cancel: 'Conserver les données locales sur cet appareil',
        error: "Floriva n’a pas pu supprimer les données locales pour le moment. Réessaie.",
        beforeConfirm: {
          title: 'Avant de confirmer',
          description:
            'Lis ceci avant de supprimer.',
          backupFirst:
            "Crée d’abord une sauvegarde chiffrée si tu penses vouloir transférer cet historique vers un autre appareil plus tard.",
          resetPurpose:
            "Utilise ceci seulement pour effacer toutes les données de Floriva depuis l’application.",
        },
      },
    },
  },
  ja: {
    settings: {
      status: {
        updated: '更新しました',
        warning: '確認が必要です',
        loading: '読み込み中...',
        saveFailed: '変更を保存できませんでした。もう一度お試しください。',
        reminderSyncFailed:
          'このデバイスには保存されましたが、Floriva は現在リマインダー時刻を更新できませんでした。',
        notificationsRequired:
          'Floriva の通知がオフです。リマインダーをオンにする前にデバイス設定で通知を有効にしてください。',
        noSubscription: 'サブスクリプションなし',
        trialActive: 'トライアル有効',
        premiumActive: 'Premium 有効',
        expired: '期限切れ',
        noRemindersActive: 'このデバイスで有効なリマインダーはありません。',
        remindersLoading: 'このデバイスに保存されたリマインダー時刻を確認しています。',
        remindersLoadError: '現在、リマインダー時刻を読み込めませんでした。',
      },
      ttcLayout: {
        loading: '妊活設定を読み込んでいます...',
        retry: 'もう一度試す',
        loadError: '妊活設定を今は読み込めません。',
      },
      privacyLock: {
        screen: {
          eyebrow: '設定',
          title: 'プライバシーとロック',
          description: 'アプリロックの設定と診断の管理を行います。',
          backLabel: '設定に戻る',
        },
        deviceLock: {
          title: 'デバイスロック',
          description:
            'このデバイスで{methods}が設定されていれば、起動時や少し離れたあとに Floriva を再ロックできます。',
          biometricLockLabel: '生体認証ロック',
          relockTimeoutLabel: '再ロックの待ち時間',
          accessTitle: '生体認証アクセス',
          accessDescription:
            'このデバイスにすでに設定されている{methods}を使って、今後の起動を保護します。',
          on: 'オン',
          off: 'オフ',
          turnOn: '生体認証ロックを設定',
          turnOff: '生体認証ロックをオフにする',
          unavailable: 'このデバイスには現在、登録済みの生体認証の解除方法がありません。',
          enabled:
            'このデバイスに{methods}が設定されていれば、生体認証ロックが今後の起動を保護します。',
          disabled: '生体認証ロックは現在オフです。',
        },
        automaticRelock: {
          title: '自動再ロック',
          description: 'Floriva はアプリから {duration} 離れると再ロックします。',
          oneMinute: '1 分',
          fiveMinutes: '5 分',
          minutes: '{minutes} 分',
          oneMinuteStatus: '再ロックの待ち時間は 1 分になりました。',
          fiveMinutesStatus: '再ロックの待ち時間は 5 分になりました。',
        },
        quickAction: {
          title: 'クイック操作',
          descriptionLocked: '今すぐロックを使うには、生体認証ロックをオンにしてください。',
          descriptionUnlocked: 'スマートフォンを渡す前に Floriva を再ロックしてください。',
          button: '今すぐロック',
          unavailable:
            'Floriva は、生体認証ロックがオンで、{methods}が利用できる場合にのみこのデバイスをロックできます。',
        },
        diagnostics: {
          title: '診断',
          description:
            '技術的な診断は既定でオフです。有効にすると、この端末でのローカルなトラブル対応のために、要約されたアプリ健全性データのみを扱います。',
          sharingLabel: '診断設定:',
          on: 'オン',
          off: 'オフ',
          notes:
            'メモ、症状、気分、妊活の記録、避妊の詳細、その他の生殖関連データは診断に含めるべきではありません。',
          turnOn: '診断をオンにする',
          turnOff: '診断をオフにする',
          savedOn:
            '技術的な診断は、要約されたアプリ健全性データによるローカルなトラブル対応のためだけにオンです。',
          savedOff: '技術的な診断はオフです。',
        },
      },
      reminders: {
        screen: {
          eyebrow: '設定',
          title: 'リマインダー設定',
          description: 'リマインダーの時間を設定します。',
          backLabel: '設定に戻る',
        },
        section: {
          title: '保存済みリマインダー',
          description:
            'リマインダープリセットはローカルに保存され、明示的にオンにしたあとでのみスケジュールされます。',
        },
        status: {
          updated: '更新しました',
          loading: '保存済みのリマインダー設定を読み込んでいます...',
          error: '現在、保存済みのリマインダー設定を読み込めませんでした。設定を開き直してもう一度お試しください。',
          refreshFailed:
            'リマインダー設定は保存されましたが、Floriva は通知スケジュールを更新できませんでした。リマインダーを開いてもう一度お試しください。',
        },
        badges: {
          on: 'オン',
          off: 'オフ',
        },
        actions: {
          turnOnPrefix: 'オンにする',
          turnOffPrefix: 'オフにする',
          editTiming: '時間を編集',
          hideTimingControls: '時間調整を非表示',
          earlierBy30Min: '30 分早く',
          laterBy30Min: '30 分遅く',
          lessNotice: '通知を少なく',
          moreNotice: '通知を多く',
        },
        detail: {
          fineTuneTiming: 'このリマインダーの時間を細かく調整します。',
        },
        labels: {
          dailyLog: '日次ログのリマインダー',
          periodStart: '生理リマインダー',
          fertileWindow: '排卵期リマインダー',
          birthControl: '避妊リマインダー',
        },
      },
      subscription: {
        screen: {
          eyebrow: '設定',
          title: 'サブスクリプション',
          titlePrefix: '',
          titleAccent: 'サブスクリプション',
          titleSuffix: '。',
          descriptionRecurring:
            '現在の請求状況を確認し、購入を復元するか、ストアのサブスクリプション管理を開けます。',
          descriptionOneTime:
            '現在の請求状況を確認するか、この 1 回の解除の購入を復元できます。',
          backLabel: '設定に戻る',
        },
        current: {
          title: '現在のプラン',
          label: '現在のプラン',
          description: 'この端末に保存されている最新の課金状態を確認します。',
          trialEnds: 'トライアルは {date} に終了します。',
          billingStarts: '課金は {date} に開始されます。',
          currentAccessEnds: '現在のアクセスは {date} に終了します。',
          recurringManagementAvailable:
            'Floriva Premium は、利用中のプラットフォームのサブスクリプション設定で管理できます。',
          recurringManagementFallback:
            'ストア管理への直接リンクがまだ使えない場合、Floriva はプラットフォームのサブスクリプションページを開きます。',
          lifetimeInfo:
            'Lifetime アクセスは 1 回限りの購入で、定期的なサブスクリプション設定は使いません。',
          retired:
            'Floriva は無料になり、今後は更新されません。すべての機能が利用でき、データはこの端末に保存されたままです。今後、料金が請求されることはありません。最近請求があった場合は、登録したストアで返金をリクエストできます。',
        },
        planLabels: {
          annual: '年間プラン',
          lifetime: 'Lifetime プラン',
          monthly: '月間プラン',
          none: '有効なプランなし',
        },
        states: {
          trialActive: 'トライアル有効',
          premiumActive: 'Premium 有効',
          expired: '期限切れ',
          billingNeedsAttention: '請求の確認が必要',
          noSubscription: 'サブスクリプションなし',
        },
        actions: {
          manageSubscription: 'サブスクリプションを管理',
          refreshAccess: 'アクセスを更新',
          restorePurchases: '購入を復元',
          readPrivacyPolicy: 'プライバシーポリシーを読む',
          contactSupport: 'サポートに連絡',
        },
        help: {
          title: 'ヘルプが必要ですか？',
          description:
            'サポートとプライバシーポリシーのリンク。',
        },
        saveOffer: {
          eyebrow: '解約する前に',
          codeTitle: 'Apple オファーコード',
          codeBody:
            '承認すると {code} がコピーされます。割引を適用するには、Apple のコード引き換えシートに貼り付けてください。',
          monthly: {
            title: '今後 3 か月間 80% オフで続ける',
            body: '記録したものはすべてそのまま残ります。月額プランは 3 か月間 {discounted} になり、その後 {full} に戻ります。いつでも解約できます。',
            primary: 'Floriva を続ける — 80% オフ',
          },
          annual: {
            title: '次の 1 年を 30% オフで続ける',
            body: '記録したものはすべてそのまま残し、年額を {full} ではなく {discounted} で更新します。いつでも解約できます。',
            primary: 'Floriva を続ける — 30% オフ',
          },
          annualTrial: {
            title: '最初の 1 年を 30% オフで続ける',
            body: '記録したものはすべてそのまま残し、年額を {full} ではなく {discounted} で支払います。いつでも解約できます。',
            primary: 'Floriva を続ける — 30% オフ',
          },
          decline: '解約に進む',
          confirmation: '割引が適用されました',
          failure: 'うまくいきませんでした。もう一度試すか、解約に進んでください。',
        },
      },
      data: {
        screen: {
          eyebrow: '設定',
          title: 'データとインポート',
          description: 'このデバイスのバックアップ、インポート、プライバシーの詳細を確認できます。',
          backLabel: '設定に戻る',
        },
        deviceStorage: {
          title: 'デバイスストレージ',
          description: 'データは、あなたが移動を選ぶまでこのデバイスに残ります。',
          openBackup: 'バックアップと復元を開く',
        },
        imports: {
          title: 'インポート',
          description:
            '別のアプリからデータをインポートするか、プライバシーの詳細を確認します。',
          openImport: 'インポートフローを開く',
          openPrivacy: 'プライバシーの説明を読む',
        },
      },
      deleteData: {
        screen: {
          eyebrow: '設定',
          title: 'ローカルデータを削除',
          titlePrefix: '',
          titleAccent: 'ローカルデータを削除',
          titleSuffix: '。',
          description:
            'このデバイスからすべての Floriva データを削除します。',
          backLabel: '設定に戻る',
        },
        danger: {
          title: '危険ゾーン',
          description: 'これは Floriva のデータをこのデバイスからだけ削除します。',
          deleteAll: 'すべてのローカルデータを削除',
        },
        warning:
          'これにより、このデバイスからサイクル履歴、リマインダー、インポート、プライバシーロックの状態が削除されます。確認後は Floriva でも元に戻せません。',
        confirm: 'このデバイスのすべてのローカルデータ削除を確認',
        cancel: 'このデバイスのローカルデータを保持',
        error: 'Floriva は今ローカルデータを削除できませんでした。もう一度お試しください。',
        beforeConfirm: {
          title: '確認する前に',
          description:
            '削除する前にこれを読んでください。',
          backupFirst:
            '後でこの履歴を別のデバイスに移したくなる可能性があるなら、まず暗号化されたバックアップを作成してください。',
          resetPurpose:
            'アプリ内からすべての Floriva データを消去したいときだけ使ってください。',
        },
      },
    },
  },
  'zh-Hans': {
    settings: {
      status: {
        updated: '已更新',
        warning: '需要注意',
        loading: '加载中...',
        saveFailed: '无法保存更改。请重试。',
        reminderSyncFailed:
          '已保存在此设备上，但 Floriva 目前无法更新提醒时间。',
        notificationsRequired:
          'Floriva 的通知当前已关闭。请先在设备设置中启用通知，再打开提醒。',
        noSubscription: '没有订阅',
        trialActive: '试用中',
        premiumActive: '高级版已启用',
        expired: '已过期',
        noRemindersActive: '此设备上没有处于启用状态的提醒。',
        remindersLoading: '正在检查此设备上保存的提醒时间。',
        remindersLoadError: '目前无法加载提醒时间。',
      },
      ttcLayout: {
        loading: '正在加载备孕设置...',
        retry: '重试',
        loadError: '目前无法加载备孕设置。',
      },
      privacyLock: {
        screen: {
          eyebrow: '设置',
          title: '隐私和锁定',
          description: '设置应用锁并管理诊断。',
          backLabel: '返回设置',
        },
        deviceLock: {
          title: '设备锁定',
          description:
            '当此设备已启用{methods}时，Floriva 可以在启动时以及短暂离开后重新锁定。',
          biometricLockLabel: '生物识别锁定',
          relockTimeoutLabel: '重新锁定时间',
          accessTitle: '生物识别访问',
          accessDescription:
            '使用此设备上已设置的{methods}来保护后续启动。',
          on: '开启',
          off: '关闭',
          turnOn: '设置生物识别锁定',
          turnOff: '关闭生物识别锁定',
          unavailable: '此设备当前没有已注册的生物识别解锁方式。',
          enabled: '当此设备已启用{methods}时，生物识别锁定会保护后续启动。',
          disabled: '生物识别锁定目前已关闭。',
        },
        automaticRelock: {
          title: '自动重新锁定',
          description: '离开应用 {duration} 后，Floriva 会重新锁定。',
          oneMinute: '1 分钟',
          fiveMinutes: '5 分钟',
          minutes: '{minutes} 分钟',
          oneMinuteStatus: '重新锁定时间现在为 1 分钟。',
          fiveMinutesStatus: '重新锁定时间现在为 5 分钟。',
        },
        quickAction: {
          title: '快速操作',
          descriptionLocked: '要使用“立即锁定”，请先开启生物识别锁定。',
          descriptionUnlocked: '在把手机递给别人之前，先重新锁定 Floriva。',
          button: '立即锁定',
          unavailable:
            '只有在生物识别锁定开启且可用{methods}时，Floriva 才能锁定此设备。',
        },
        diagnostics: {
          title: '诊断',
          description:
            '技术诊断默认关闭。开启后，Floriva 也只会保留经过脱敏的应用运行数据，用于这台设备上的本地排查。',
          sharingLabel: '诊断设置：',
          on: '开启',
          off: '关闭',
          notes:
            '备注、症状、情绪、备孕观察、避孕细节以及其他生殖相关数据都不应进入诊断。',
          turnOn: '开启诊断',
          turnOff: '关闭诊断',
          savedOn: '技术诊断已开启，仅用于本地排查经过脱敏的应用运行数据。',
          savedOff: '技术诊断已关闭。',
        },
      },
      reminders: {
        screen: {
          eyebrow: '设置',
          title: '提醒设置',
          description: '设置提醒时间。',
          backLabel: '返回设置',
        },
        section: {
          title: '已保存的提醒',
          description: '提醒预设保存在此设备上，只有在你开启后才会安排。',
        },
        status: {
          updated: '已更新',
          loading: '正在加载已保存的提醒设置...',
          error: 'Floriva 目前无法加载已保存的提醒设置。请重新打开设置并重试。',
          refreshFailed: '提醒设置已保存，但 Floriva 无法刷新通知计划。请打开提醒并重试。',
        },
        badges: {
          on: '开启',
          off: '关闭',
        },
        actions: {
          turnOnPrefix: '开启',
          turnOffPrefix: '关闭',
          editTiming: '编辑时间',
          hideTimingControls: '隐藏时间控制',
          earlierBy30Min: '提前 30 分钟',
          laterBy30Min: '推迟 30 分钟',
          lessNotice: '更少提前量',
          moreNotice: '更多提前量',
        },
        detail: {
          fineTuneTiming: '细调此提醒的时间。',
        },
        labels: {
          dailyLog: '每日记录提醒',
          periodStart: '月经提醒',
          fertileWindow: '易孕期提醒',
          birthControl: '避孕提醒',
        },
      },
      subscription: {
        screen: {
          eyebrow: '设置',
          title: '订阅',
          titlePrefix: '',
          titleAccent: '订阅',
          titleSuffix: '。',
          descriptionRecurring: '查看当前的计费状态、恢复购买，或打开商店订阅管理器。',
          descriptionOneTime: '查看当前的计费状态，或恢复这一次性解锁的购买。',
          backLabel: '返回设置',
        },
        current: {
          title: '当前计划',
          label: '当前计划',
          description: '查看保存在这个设备上的最新订阅状态。',
          trialEnds: '试用将于 {date} 结束。',
          billingStarts: '计费将于 {date} 开始。',
          currentAccessEnds: '当前访问将于 {date} 结束。',
          recurringManagementAvailable:
            '你可以在平台的订阅设置中管理 Floriva Premium。',
          recurringManagementFallback:
            '当还没有可用的商店直接管理链接时，Floriva 会打开平台的订阅页面。',
          lifetimeInfo: '终身访问是一次性购买，不使用循环订阅设置。',
          retired:
            'Floriva 现已免费，并且不再更新。所有功能均已解锁，你的数据仍保存在本设备上。今后不会再产生任何费用。如果最近有扣款，你可以在订阅所用的商店申请退款。',
        },
        planLabels: {
          annual: '年度计划',
          lifetime: '终身计划',
          monthly: '月度计划',
          none: '没有活动计划',
        },
        states: {
          trialActive: '试用中',
          premiumActive: '高级版已启用',
          expired: '已过期',
          billingNeedsAttention: '计费需要处理',
          noSubscription: '没有订阅',
        },
        actions: {
          manageSubscription: '管理订阅',
          refreshAccess: '刷新访问',
          restorePurchases: '恢复购买',
          readPrivacyPolicy: '阅读隐私政策',
          contactSupport: '联系支持',
        },
        help: {
          title: '需要帮助？',
          description: '支持和隐私政策链接。',
        },
        saveOffer: {
          eyebrow: '在你离开之前',
          codeTitle: 'Apple 优惠代码',
          codeBody:
            '接受后会复制 {code}。请将其粘贴到 Apple 的代码兑换页面中以应用优惠。',
          monthly: {
            title: '继续使用，接下来 3 个月享 8 折优惠',
            body: '你记录的一切都会保留。你的月度计划在 3 个月内降为 {discounted}，之后恢复为 {full}。可随时取消。',
            primary: '继续使用 Floriva — 8 折',
          },
          annual: {
            title: '继续使用，下一年享 7 折优惠',
            body: '你记录的一切都会保留，按 {discounted} 续订一年，而不是 {full}。可随时取消。',
            primary: '继续使用 Floriva — 7 折',
          },
          annualTrial: {
            title: '继续使用，第一年享 7 折优惠',
            body: '你记录的一切都会保留，按 {discounted} 支付一年，而不是 {full}。可随时取消。',
            primary: '继续使用 Floriva — 7 折',
          },
          decline: '继续取消',
          confirmation: '优惠已应用',
          failure: '操作未成功。请重试或继续取消。',
        },
      },
      data: {
        screen: {
          eyebrow: '设置',
          title: '数据和导入',
          description: '备份、导入并查看此设备的隐私详情。',
          backLabel: '返回设置',
        },
        deviceStorage: {
          title: '设备存储',
          description: '数据会保留在此设备上，直到你选择移动它们。',
          openBackup: '打开备份和恢复',
        },
        imports: {
          title: '导入',
          description: '从其他应用导入数据，或查看隐私详情。',
          openImport: '打开导入流程',
          openPrivacy: '阅读隐私说明',
        },
      },
      deleteData: {
        screen: {
          eyebrow: '设置',
          title: '删除本地数据',
          titlePrefix: '',
          titleAccent: '删除本地数据',
          titleSuffix: '。',
          description: '从此设备中删除所有 Floriva 数据。',
          backLabel: '返回设置',
        },
        danger: {
          title: '危险区域',
          description: '这只会从此设备中删除 Floriva 数据。',
          deleteAll: '删除所有本地数据',
        },
        warning:
          '这会从此设备中删除你的周期历史、提醒、导入以及隐私锁状态。确认后 Floriva 无法撤销。',
        confirm: '确认删除此设备上的所有本地数据',
        cancel: '保留此设备上的本地数据',
        error: 'Floriva 目前无法删除本地数据。请重试。',
        beforeConfirm: {
          title: '确认前',
          description: '删除前请先阅读。',
          backupFirst:
            '如果你之后可能想把这些历史带到另一台设备，请先创建加密备份。',
          resetPurpose:
            '只有当你想从应用内部清除所有 Floriva 数据时才使用这个功能。',
        },
      },
    },
  },
  pt: {
    settings: {
      status: {
        updated: 'Atualizado',
        warning: 'Precisa de atenção',
        loading: 'A carregar...',
        saveFailed: 'Não foi possível guardar as alterações. Tenta novamente.',
        reminderSyncFailed:
          'Guardado neste dispositivo, mas a Floriva não conseguiu atualizar agora o horário dos lembretes.',
        notificationsRequired:
          'As notificações estão desativadas para o Floriva. Ativa-as nas definições do dispositivo antes de ligar os lembretes.',
        noSubscription: 'Sem subscrição',
        trialActive: 'Teste ativo',
        premiumActive: 'Premium ativo',
        expired: 'Expirado',
        noRemindersActive: 'Não há lembretes ativos neste dispositivo.',
        remindersLoading: 'A verificar o horário dos lembretes guardado neste dispositivo.',
        remindersLoadError: 'Não foi possível carregar agora o horário dos lembretes.',
      },
      ttcLayout: {
        loading: 'A carregar a configuração para tentar engravidar...',
        retry: 'Tentar novamente',
        loadError: 'A configuração para tentar engravidar não pôde ser carregada agora.',
      },
      privacyLock: {
        screen: {
          eyebrow: 'Definições',
          title: 'Privacidade e bloqueio',
          description: 'Configura o bloqueio da app e gere os diagnósticos.',
          backLabel: 'Voltar às definições',
        },
        deviceLock: {
          title: 'Bloqueio do dispositivo',
          description:
            'O Floriva pode voltar a bloquear no arranque e depois de uma pequena pausa quando este dispositivo tiver {methods}.',
          biometricLockLabel: 'Bloqueio biométrico',
          relockTimeoutLabel: 'Tempo de relock',
          accessTitle: 'Acesso biométrico',
          accessDescription:
            'Usa {methods} deste dispositivo para proteger futuros arranques.',
          on: 'Ligado',
          off: 'Desligado',
          turnOn: 'Configurar bloqueio biométrico',
          turnOff: 'Desligar bloqueio biométrico',
          unavailable: 'Este dispositivo não tem atualmente um método biométrico de desbloqueio configurado.',
          enabled:
            'O bloqueio biométrico vai proteger futuros arranques quando este dispositivo tiver {methods}.',
          disabled: 'O bloqueio biométrico está desligado por agora.',
        },
        automaticRelock: {
          title: 'Relock automático',
          description: 'O Floriva volta a bloquear depois de {duration} longe da app.',
          oneMinute: '1 minuto',
          fiveMinutes: '5 minutos',
          minutes: '{minutes} minutos',
          oneMinuteStatus: 'O tempo de relock agora é de 1 minuto.',
          fiveMinutesStatus: 'O tempo de relock agora é de 5 minutos.',
        },
        quickAction: {
          title: 'Ação rápida',
          descriptionLocked: 'Liga o bloqueio biométrico para usar Bloquear agora.',
          descriptionUnlocked: 'Volta a bloquear o Floriva antes de entregares o telefone.',
          button: 'Bloquear agora',
          unavailable:
            'O Floriva só pode bloquear este dispositivo quando o bloqueio biométrico está ligado e {methods} está disponível.',
        },
        diagnostics: {
          title: 'Diagnósticos',
          description:
            'Os diagnósticos técnicos estão desligados por padrão. Se os ativares, o Floriva mantém dados de saúde da app redigidos apenas para resolução local neste dispositivo.',
          sharingLabel: 'Definição de diagnósticos:',
          on: 'Ligado',
          off: 'Desligado',
          notes:
            'Notas, sintomas, estados de espírito, observações de tentativa de conceção, detalhes de contraceção e outros dados reprodutivos nunca devem ir para diagnósticos.',
          turnOn: 'Ligar diagnósticos',
          turnOff: 'Desligar diagnósticos',
          savedOn:
            'Os diagnósticos técnicos estão ligados apenas para resolução local com dados de saúde da app redigidos.',
          savedOff: 'Os diagnósticos técnicos estão desligados.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Definições',
          title: 'Definições de lembretes',
          description: 'Ajusta a hora dos lembretes.',
          backLabel: 'Voltar às definições',
        },
        section: {
          title: 'Lembretes guardados',
          description:
            'As predefinições de lembretes ficam neste dispositivo e só são agendadas depois de as ligares.',
        },
        status: {
          updated: 'Atualizado',
          loading: 'A carregar as definições de lembretes guardadas...',
          error: 'O Floriva não conseguiu carregar agora as definições de lembretes guardadas. Reabre Definições e tenta novamente.',
          refreshFailed:
            'As definições de lembretes foram guardadas, mas o Floriva não conseguiu atualizar o agendamento das notificações. Abre Lembretes e tenta novamente.',
        },
        badges: {
          on: 'Ligado',
          off: 'Desligado',
        },
        actions: {
          turnOnPrefix: 'Ligar',
          turnOffPrefix: 'Desligar',
          editTiming: 'Editar horário',
          hideTimingControls: 'Ocultar controlos de horário',
          earlierBy30Min: '30 min mais cedo',
          laterBy30Min: '30 min mais tarde',
          lessNotice: 'Menos aviso',
          moreNotice: 'Mais aviso',
        },
        detail: {
          fineTuneTiming: 'Ajusta ao detalhe o horário deste lembrete.',
        },
        labels: {
          dailyLog: 'Lembrete de registo diário',
          periodStart: 'Lembrete de período',
          fertileWindow: 'Lembrete de janela fértil',
          birthControl: 'Lembrete de contraceção',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Definições',
          title: 'Subscrição',
          titlePrefix: '',
          titleAccent: 'Subscrição',
          titleSuffix: '.',
          descriptionRecurring:
            'Revê o teu estado de faturação atual, restaura compras ou abre o gestor de subscrições da loja.',
          descriptionOneTime:
            'Revê o teu estado de faturação atual ou restaura compras para este desbloqueio único.',
          backLabel: 'Voltar às definições',
        },
        current: {
          title: 'Plano atual',
          label: 'Plano atual',
          description: 'Revise o estado de cobrança mais recente salvo neste dispositivo.',
          trialEnds: 'O teste termina em {date}.',
          billingStarts: 'A faturação começa em {date}.',
          currentAccessEnds: 'O acesso atual termina em {date}.',
          recurringManagementAvailable:
            'Podes gerir o Floriva Premium nas definições de subscrição da tua plataforma.',
          recurringManagementFallback:
            'O Floriva vai abrir a página de subscrição da plataforma quando ainda não houver um link direto de gestão da loja.',
          lifetimeInfo:
            'O acesso vitalício é uma compra única e não usa definições de subscrição recorrente.',
          retired:
            'O Floriva agora é gratuito e deixou de ser atualizado. Todas as funcionalidades estão desbloqueadas e os teus dados ficam neste dispositivo. Não haverá mais cobranças. Se te cobraram recentemente, podes pedir um reembolso na loja onde subscreveste.',
        },
        planLabels: {
          annual: 'Plano anual',
          lifetime: 'Plano vitalício',
          monthly: 'Plano mensal',
          none: 'Sem plano ativo',
        },
        states: {
          trialActive: 'Teste ativo',
          premiumActive: 'Premium ativo',
          expired: 'Expirado',
          billingNeedsAttention: 'A cobrança precisa de atenção',
          noSubscription: 'Sem subscrição',
        },
        actions: {
          manageSubscription: 'Gerir subscrição',
          refreshAccess: 'Atualizar acesso',
          restorePurchases: 'Restaurar compras',
          readPrivacyPolicy: 'Ler política de privacidade',
          contactSupport: 'Contactar suporte',
        },
        help: {
          title: 'Precisas de ajuda?',
          description:
            'Suporte e política de privacidade.',
        },
        saveOffer: {
          eyebrow: 'Antes de saíres',
          codeTitle: 'Código de oferta Apple',
          codeBody:
            '{code} será copiado quando aceitares. Cola-o na folha de resgate da Apple para aplicares o desconto.',
          monthly: {
            title: 'Fica com 80 % de desconto nos próximos 3 meses',
            body: 'Mantém tudo o que registaste. O teu plano mensal desce para {discounted} durante 3 meses e depois volta a {full}. Cancela quando quiseres.',
            primary: 'Manter o Floriva — 80 % de desconto',
          },
          annual: {
            title: 'Fica com 30 % de desconto no teu próximo ano',
            body: 'Mantém tudo o que registaste e renova por {discounted} ao ano em vez de {full}. Cancela quando quiseres.',
            primary: 'Manter o Floriva — 30 % de desconto',
          },
          annualTrial: {
            title: 'Fica com 30 % de desconto no teu primeiro ano',
            body: 'Mantém tudo o que registaste e paga {discounted} ao ano em vez de {full}. Cancela quando quiseres.',
            primary: 'Manter o Floriva — 30 % de desconto',
          },
          decline: 'Continuar para cancelar',
          confirmation: 'O teu desconto foi aplicado',
          failure: 'Não foi possível concluir. Tenta novamente ou continua para cancelar.',
        },
      },
      data: {
        screen: {
          eyebrow: 'Definições',
          title: 'Dados e importação',
          description: 'Cópia de segurança, importação e detalhes de privacidade deste dispositivo.',
          backLabel: 'Voltar às definições',
        },
        deviceStorage: {
          title: 'Armazenamento do dispositivo',
          description: 'Os dados ficam neste dispositivo até escolheres movê-los.',
          openBackup: 'Abrir cópia de segurança e restauro',
        },
        imports: {
          title: 'Importações',
          description:
            'Importa dados de outra app ou consulta os detalhes de privacidade.',
          openImport: 'Abrir fluxo de importação',
          openPrivacy: 'Ler explicação de privacidade',
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Definições',
          title: 'Apagar dados locais',
          titlePrefix: 'Apagar ',
          titleAccent: 'dados',
          titleSuffix: ' locais.',
          description:
            'Remove todos os dados do Floriva deste dispositivo.',
          backLabel: 'Voltar às definições',
        },
        danger: {
          title: 'Zona de perigo',
          description: 'Isto remove os dados do Floriva apenas deste dispositivo.',
          deleteAll: 'Apagar todos os dados locais',
        },
        warning:
          'Isto remove deste dispositivo o teu histórico de ciclo, lembretes, importações e estado de bloqueio de privacidade. O Floriva não pode desfazer isto depois de confirmares.',
        confirm: 'Confirmar eliminação de todos os dados locais deste dispositivo',
        cancel: 'Manter os dados locais neste dispositivo',
        error: 'O Floriva não conseguiu apagar os dados locais agora. Tente novamente.',
        beforeConfirm: {
          title: 'Antes de confirmares',
          description:
            'Lê isto antes de apagar.',
          backupFirst:
            'Cria primeiro uma cópia de segurança encriptada se quiseres talvez levar este histórico para outro dispositivo mais tarde.',
          resetPurpose:
            'Usa isto apenas para apagar todos os dados do Floriva de dentro da app.',
        },
      },
    },
  },
  ru: {
    settings: {
      status: {
        updated: 'Обновлено',
        warning: 'Требует внимания',
        loading: 'Загрузка...',
        saveFailed: 'Не удалось сохранить изменения. Попробуйте ещё раз.',
        reminderSyncFailed:
          'Данные сохранены на этом устройстве, но Floriva сейчас не смогла обновить время напоминаний.',
        notificationsRequired:
          'Уведомления для Floriva отключены. Включите их в настройках устройства, прежде чем включать напоминания.',
        noSubscription: 'Нет подписки',
        trialActive: 'Пробный период активен',
        premiumActive: 'Премиум активен',
        expired: 'Истёк',
        noRemindersActive: 'На этом устройстве нет активных напоминаний.',
        remindersLoading: 'Проверяем сохранённое время напоминаний на этом устройстве.',
        remindersLoadError: 'Сейчас не удалось загрузить время напоминаний.',
      },
      ttcLayout: {
        loading: 'Загрузка настроек планирования беременности...',
        retry: 'Попробовать снова',
        loadError: 'Сейчас не удалось загрузить настройки планирования беременности.',
      },
      privacyLock: {
        screen: {
          eyebrow: 'Настройки',
          title: 'Приватность и блокировка',
          description: 'Настройте блокировку приложения и управляйте диагностикой.',
          backLabel: 'Назад к настройкам',
        },
        deviceLock: {
          title: 'Блокировка устройства',
          description:
            'Floriva может снова блокироваться при запуске и после короткой паузы, когда на этом устройстве настроено что-то из: {methods}.',
          biometricLockLabel: 'Биометрическая блокировка',
          relockTimeoutLabel: 'Таймаут повторной блокировки',
          accessTitle: 'Биометрический доступ',
          accessDescription:
            'Используйте уже настроенные на этом устройстве способы ({methods}), чтобы защитить будущие запуски.',
          on: 'Вкл.',
          off: 'Выкл.',
          turnOn: 'Настроить биометрическую блокировку',
          turnOff: 'Выключить биометрическую блокировку',
          unavailable: 'На этом устройстве сейчас нет настроенного метода биометрического разблокирования.',
          enabled:
            'Биометрическая блокировка будет защищать будущие запуски, когда на этом устройстве настроено что-то из: {methods}.',
          disabled: 'Биометрическая блокировка сейчас выключена.',
        },
        automaticRelock: {
          title: 'Автоматическая повторная блокировка',
          description: 'Floriva снова блокируется через {duration} после выхода из приложения.',
          oneMinute: '1 минута',
          fiveMinutes: '5 минут',
          minutes: '{minutes} минут',
          oneMinuteStatus: 'Таймаут повторной блокировки теперь 1 минута.',
          fiveMinutesStatus: 'Таймаут повторной блокировки теперь 5 минут.',
        },
        quickAction: {
          title: 'Быстрое действие',
          descriptionLocked: 'Включите биометрическую блокировку, чтобы использовать «Заблокировать сейчас».',
          descriptionUnlocked: 'Заблокируйте Floriva, прежде чем передавать телефон.',
          button: 'Заблокировать сейчас',
          unavailable:
            'Floriva может заблокировать это устройство только когда биометрическая блокировка включена и доступно что-то из: {methods}.',
        },
        diagnostics: {
          title: 'Диагностика',
          description:
            'Техническая диагностика по умолчанию выключена. Если вы включите её, Floriva будет хранить только обезличенные данные о состоянии приложения для локальной отладки на этом устройстве.',
          sharingLabel: 'Настройка диагностики:',
          on: 'Вкл.',
          off: 'Выкл.',
          notes:
            'Заметки, симптомы, настроение, наблюдения планирования беременности, данные о контрацепции и другие репродуктивные данные не должны попадать в диагностику.',
          turnOn: 'Включить диагностику',
          turnOff: 'Выключить диагностику',
          savedOn:
            'Техническая диагностика включена только для локальной отладки с обезличенными данными о состоянии приложения.',
          savedOff: 'Техническая диагностика выключена.',
        },
      },
      reminders: {
        screen: {
          eyebrow: 'Настройки',
          title: 'Настройки напоминаний',
          description: 'Задайте время напоминаний.',
          backLabel: 'Назад к настройкам',
        },
        section: {
          title: 'Сохранённые напоминания',
          description:
            'Пресеты напоминаний остаются на этом устройстве и планируются только после того, как вы их включите.',
        },
        status: {
          updated: 'Обновлено',
          loading: 'Загрузка сохранённых настроек напоминаний...',
          error: 'Floriva сейчас не смогла загрузить сохранённые настройки напоминаний. Откройте настройки снова и попробуйте ещё раз.',
          refreshFailed:
            'Настройки напоминаний сохранены, но Floriva не смогла обновить расписание уведомлений. Откройте напоминания и попробуйте ещё раз.',
        },
        badges: {
          on: 'Вкл.',
          off: 'Выкл.',
        },
        actions: {
          turnOnPrefix: 'Включить',
          turnOffPrefix: 'Выключить',
          editTiming: 'Изменить время',
          hideTimingControls: 'Скрыть элементы управления временем',
          earlierBy30Min: 'На 30 мин раньше',
          laterBy30Min: 'На 30 мин позже',
          lessNotice: 'Уменьшить срок предупреждения',
          moreNotice: 'Увеличить срок предупреждения',
        },
        detail: {
          fineTuneTiming: 'Точно настройте время этого напоминания.',
        },
        labels: {
          dailyLog: 'Напоминание о ежедневной записи',
          periodStart: 'Напоминание о месячных',
          fertileWindow: 'Напоминание о фертильном окне',
          birthControl: 'Напоминание о контрацепции',
        },
      },
      subscription: {
        screen: {
          eyebrow: 'Настройки',
          title: 'Подписка',
          titlePrefix: '',
          titleAccent: 'Подписка',
          titleSuffix: '.',
          descriptionRecurring:
            'Проверьте текущий статус оплаты, восстановите покупки или откройте менеджер подписки магазина.',
          descriptionOneTime:
            'Проверьте текущий статус оплаты или восстановите покупки для этой разовой разблокировки.',
          backLabel: 'Назад к настройкам',
        },
        current: {
          title: 'Текущий план',
          label: 'Текущий план',
          description: 'Проверь последнее состояние оплаты, сохранённое на этом устройстве.',
          trialEnds: 'Пробный период заканчивается {date}.',
          billingStarts: 'Оплата начнётся {date}.',
          currentAccessEnds: 'Текущий доступ закончится {date}.',
          recurringManagementAvailable:
            'Вы можете управлять Floriva Premium в настройках подписки вашей платформы.',
          recurringManagementFallback:
            'Floriva откроет страницу подписки платформы, если прямая ссылка на управление подпиской магазина пока недоступна.',
          lifetimeInfo:
            'Пожизненный доступ: разовая покупка, которая не использует повторяющиеся настройки подписки.',
          retired:
            'Floriva теперь бесплатна и больше не обновляется. Все функции разблокированы, а данные остаются на этом устройстве. Списаний больше не будет. Если оплата прошла недавно, вы можете запросить возврат в магазине, через который оформляли подписку.',
        },
        planLabels: {
          annual: 'Годовой план',
          lifetime: 'Пожизненный план',
          monthly: 'Месячный план',
          none: 'Нет активного плана',
        },
        states: {
          trialActive: 'Пробный период активен',
          premiumActive: 'Премиум активен',
          expired: 'Истёк',
          billingNeedsAttention: 'Платёж требует внимания',
          noSubscription: 'Нет подписки',
        },
        actions: {
          manageSubscription: 'Управлять подпиской',
          refreshAccess: 'Обновить доступ',
          restorePurchases: 'Восстановить покупки',
          readPrivacyPolicy: 'Читать политику конфиденциальности',
          contactSupport: 'Связаться со службой поддержки',
        },
        help: {
          title: 'Нужна помощь?',
          description:
            'Поддержка и политика конфиденциальности.',
        },
        saveOffer: {
          eyebrow: 'Прежде чем уйти',
          codeTitle: 'Код предложения Apple',
          codeBody:
            'После подтверждения код {code} будет скопирован. Вставьте его на экране погашения кода Apple, чтобы применить скидку.',
          monthly: {
            title: 'Останьтесь со скидкой 80 % на следующие 3 месяца',
            body: 'Всё, что вы записали, останется с вами. Ваш месячный план снизится до {discounted} на 3 месяца, а затем вернётся к {full}. Отменить можно в любой момент.',
            primary: 'Оставить Floriva — скидка 80 %',
          },
          annual: {
            title: 'Останьтесь со скидкой 30 % на следующий год',
            body: 'Всё, что вы записали, останется с вами, и продление за год будет стоить {discounted} вместо {full}. Отменить можно в любой момент.',
            primary: 'Оставить Floriva — скидка 30 %',
          },
          annualTrial: {
            title: 'Останьтесь со скидкой 30 % на первый год',
            body: 'Всё, что вы записали, останется с вами, и за год вы заплатите {discounted} вместо {full}. Отменить можно в любой момент.',
            primary: 'Оставить Floriva — скидка 30 %',
          },
          decline: 'Продолжить отмену',
          confirmation: 'Ваша скидка применена',
          failure: 'Не получилось. Попробуйте ещё раз или продолжите отмену.',
        },
      },
      data: {
        screen: {
          eyebrow: 'Настройки',
          title: 'Данные и импорт',
          description: 'Резервное копирование, импорт и сведения о приватности для этого устройства.',
          backLabel: 'Назад к настройкам',
        },
        deviceStorage: {
          title: 'Хранилище устройства',
          description: 'Floriva хранит данные на этом устройстве, пока вы сами не решите перенести их.',
          openBackup: 'Открыть резервную копию и восстановление',
        },
        imports: {
          title: 'Импорт',
          description:
            'Импортируйте данные из другого приложения или ознакомьтесь с деталями приватности.',
          openImport: 'Открыть процесс импорта',
          openPrivacy: 'Читать пояснение о приватности',
        },
      },
      deleteData: {
        screen: {
          eyebrow: 'Настройки',
          title: 'Удалить локальные данные',
          titlePrefix: 'Удалить локальные ',
          titleAccent: 'данные',
          titleSuffix: '.',
          description:
            'Удалить все данные Floriva с этого устройства.',
          backLabel: 'Назад к настройкам',
        },
        danger: {
          title: 'Опасная зона',
          description: 'Это удаляет данные Floriva только с этого устройства.',
          deleteAll: 'Удалить все локальные данные',
        },
        warning:
          'Это удалит с этого устройства историю цикла, напоминания, импорты и состояние блокировки приватности. После подтверждения Floriva не сможет это отменить.',
        confirm: 'Подтвердить удаление всех локальных данных с этого устройства',
        cancel: 'Оставить локальные данные на этом устройстве',
        error: 'Floriva сейчас не смогла удалить локальные данные. Попробуйте ещё раз.',
        beforeConfirm: {
          title: 'Перед подтверждением',
          description:
            'Прочитайте это перед удалением.',
          backupFirst:
            'Сначала создайте зашифрованную резервную копию, если позже захотите перенести эту историю на другое устройство.',
          resetPurpose:
            'Используйте это только для удаления всех данных Floriva из приложения.',
        },
      },
    },
  },
} as const;

const settingsFeedbackMessages = {
  en: {
    settings: {
      feedback: {
        eyebrow: 'Settings',
        title: 'Send feedback',
        description:
          "Questions, bugs, or ideas? Email us. Floriva keeps your data on this device, so we can't see it — tell us what's happening.",
        backLabel: 'Back to settings',
        emailButton: 'Email us',
        supportEmailLabel: 'Support email',
        emailSubject: 'Floriva feedback',
        emailBodyIntro: "What's working or what's broken:",
        emailUnavailable: 'No email app is set up on this device. Reach us at {email}.',
      },
      sounds: {
        eyebrow: 'Settings',
        title: 'Sounds & haptics',
        titlePrefix: 'Sounds & ',
        titleAccent: 'haptics',
        titleSuffix: '.',
        description: 'Pick if Floriva responds to taps with vibration, sound, or both.',
        backLabel: 'Back to settings',
        haptics: {
          title: 'Haptics',
          description: 'Gentle vibration on taps and selections.',
          on: 'On',
          off: 'Off',
          turnOn: 'Turn on haptics',
          turnOff: 'Turn off haptics',
          savedOn: 'Haptics are on.',
          savedOff: 'Haptics are off.',
        },
        tapSound: {
          title: 'Tap sounds',
          description: 'A quiet tap sound when your device audio allows it.',
          on: 'On',
          off: 'Off',
          turnOn: 'Turn on tap sounds',
          turnOff: 'Turn off tap sounds',
          savedOn: 'Tap sounds are on.',
          savedOff: 'Tap sounds are off.',
        },
      },
    },
  },
  es: {
    settings: {
      feedback: {
        eyebrow: 'Configuración',
        title: 'Enviar comentarios',
        description:
          '¿Dudas, errores o ideas? Escríbenos. Floriva guarda tus datos en este dispositivo, así que no podemos verlos: cuéntanos qué ocurre.',
        backLabel: 'Volver a configuración',
        emailButton: 'Escríbenos',
        supportEmailLabel: 'Correo de soporte',
        emailSubject: 'Comentarios de Floriva',
        emailBodyIntro: 'Qué funciona o qué falla:',
        emailUnavailable:
          'No hay ninguna app de correo configurada en este dispositivo. Escríbenos a {email}.',
      },
      sounds: {
        eyebrow: 'Configuración',
        title: 'Sonidos y vibración',
        titlePrefix: 'Sonidos y ',
        titleAccent: 'vibración',
        titleSuffix: '.',
        description:
          'Elige si Floriva responde a los toques con vibración, sonidos o ambos.',
        backLabel: 'Volver a configuración',
        haptics: {
          title: 'Vibración',
          description: 'Usa una vibración suave para toques y selecciones.',
          on: 'Activada',
          off: 'Desactivada',
          turnOn: 'Activar vibración',
          turnOff: 'Desactivar vibración',
          savedOn: 'La vibración está activada.',
          savedOff: 'La vibración está desactivada.',
        },
        tapSound: {
          title: 'Sonidos al tocar',
          description:
            'Reproduce un sonido de toque sutil cuando la configuración de audio del dispositivo lo permita.',
          on: 'Activados',
          off: 'Desactivados',
          turnOn: 'Activar sonidos al tocar',
          turnOff: 'Desactivar sonidos al tocar',
          savedOn: 'Los sonidos al tocar están activados.',
          savedOff: 'Los sonidos al tocar están desactivados.',
        },
      },
    },
  },
  de: {
    settings: {
      feedback: {
        eyebrow: 'Einstellungen',
        title: 'Feedback senden',
        description:
          'Fragen, Fehler oder Ideen? Schreib uns. Floriva speichert deine Daten auf diesem Gerät, wir können sie also nicht sehen – sag uns, was los ist.',
        backLabel: 'Zurück zu den Einstellungen',
        emailButton: 'Schreib uns',
        supportEmailLabel: 'Support-E-Mail',
        emailSubject: 'Floriva-Feedback',
        emailBodyIntro: 'Was funktioniert oder was nicht:',
        emailUnavailable:
          'Auf diesem Gerät ist keine E-Mail-App eingerichtet. Erreiche uns unter {email}.',
      },
      sounds: {
        eyebrow: 'Einstellungen',
        title: 'Töne & Haptik',
        titlePrefix: 'Töne & ',
        titleAccent: 'Haptik',
        titleSuffix: '.',
        description:
          'Wähle, ob Floriva auf Tippen mit Haptik, Tönen oder beidem reagiert.',
        backLabel: 'Zurück zu den Einstellungen',
        haptics: {
          title: 'Haptik',
          description: 'Verwende leichtes Vibrationsfeedback für Tippen und Auswahlen.',
          on: 'Ein',
          off: 'Aus',
          turnOn: 'Haptik einschalten',
          turnOff: 'Haptik ausschalten',
          savedOn: 'Haptik ist eingeschaltet.',
          savedOff: 'Haptik ist ausgeschaltet.',
        },
        tapSound: {
          title: 'Tipptöne',
          description:
            'Spielt einen dezenten Tippton ab, wenn die Audioeinstellungen des Geräts das zulassen.',
          on: 'Ein',
          off: 'Aus',
          turnOn: 'Tipptöne einschalten',
          turnOff: 'Tipptöne ausschalten',
          savedOn: 'Tipptöne sind eingeschaltet.',
          savedOff: 'Tipptöne sind ausgeschaltet.',
        },
      },
    },
  },
  fr: {
    settings: {
      feedback: {
        eyebrow: 'Réglages',
        title: 'Envoyer un commentaire',
        description:
          'Des questions, des bugs ou des idées ? Écris-nous. Floriva conserve tes données sur cet appareil, nous ne pouvons donc pas les voir : dis-nous ce qui se passe.',
        backLabel: 'Retour aux réglages',
        emailButton: 'Écris-nous',
        supportEmailLabel: 'E-mail d’assistance',
        emailSubject: 'Commentaire Floriva',
        emailBodyIntro: 'Ce qui fonctionne ou ce qui ne va pas :',
        emailUnavailable:
          "Aucune application de messagerie n’est configurée sur cet appareil. Contacte-nous à {email}.",
      },
      sounds: {
        eyebrow: 'Réglages',
        title: 'Sons et vibrations',
        titlePrefix: 'Sons et ',
        titleAccent: 'vibrations',
        titleSuffix: '.',
        description:
          'Choisis si Floriva répond aux appuis avec des vibrations, des sons ou les deux.',
        backLabel: 'Retour aux réglages',
        haptics: {
          title: 'Vibrations',
          description:
            'Utilise un retour vibrant léger pour les appuis et les sélections.',
          on: 'Activées',
          off: 'Désactivées',
          turnOn: 'Activer les vibrations',
          turnOff: 'Désactiver les vibrations',
          savedOn: 'Les vibrations sont activées.',
          savedOff: 'Les vibrations sont désactivées.',
        },
        tapSound: {
          title: 'Sons de touche',
          description:
            "Joue un son de touche discret lorsque les réglages audio de l’appareil le permettent.",
          on: 'Activés',
          off: 'Désactivés',
          turnOn: 'Activer les sons de touche',
          turnOff: 'Désactiver les sons de touche',
          savedOn: 'Les sons de touche sont activés.',
          savedOff: 'Les sons de touche sont désactivés.',
        },
      },
    },
  },
  ja: {
    settings: {
      feedback: {
        eyebrow: '設定',
        title: 'フィードバックを送る',
        description:
          'ご質問、不具合、ご要望はメールでお知らせください。Floriva はデータをこの端末に保存するため、私たちは内容を見られません。状況を教えてください。',
        backLabel: '設定に戻る',
        emailButton: 'メールで送る',
        supportEmailLabel: 'サポート用メールアドレス',
        emailSubject: 'Floriva へのフィードバック',
        emailBodyIntro: '良い点や不具合を教えてください:',
        emailUnavailable: 'この端末にメールアプリが設定されていません。{email} までご連絡ください。',
      },
      sounds: {
        eyebrow: '設定',
        title: 'サウンドと触覚',
        titlePrefix: '',
        titleAccent: 'サウンドと触覚',
        titleSuffix: '。',
        description:
          'Floriva がタップ時に触覚、サウンド、またはその両方で反応するかを選べます。',
        backLabel: '設定に戻る',
        haptics: {
          title: '触覚フィードバック',
          description: 'タップや選択時に軽い振動フィードバックを使います。',
          on: 'オン',
          off: 'オフ',
          turnOn: '触覚フィードバックをオンにする',
          turnOff: '触覚フィードバックをオフにする',
          savedOn: '触覚フィードバックはオンです。',
          savedOff: '触覚フィードバックはオフです。',
        },
        tapSound: {
          title: 'タップ音',
          description:
            'デバイスの音声設定で許可されているときに、控えめなタップ音を再生します。',
          on: 'オン',
          off: 'オフ',
          turnOn: 'タップ音をオンにする',
          turnOff: 'タップ音をオフにする',
          savedOn: 'タップ音はオンです。',
          savedOff: 'タップ音はオフです。',
        },
      },
    },
  },
  'zh-Hans': {
    settings: {
      feedback: {
        eyebrow: '设置',
        title: '发送反馈',
        description:
          '有疑问、错误或想法吗？给我们发邮件。Floriva 将数据保存在此设备上，我们无法看到，请告诉我们发生了什么。',
        backLabel: '返回设置',
        emailButton: '给我们发邮件',
        supportEmailLabel: '支持邮箱',
        emailSubject: 'Floriva 反馈',
        emailBodyIntro: '哪些正常或哪些有问题：',
        emailUnavailable: '此设备未设置邮件应用。请通过 {email} 联系我们。',
      },
      sounds: {
        eyebrow: '设置',
        title: '声音与触感',
        titlePrefix: '',
        titleAccent: '声音与触感',
        titleSuffix: '。',
        description: '选择 Floriva 在点按时是否通过触感、声音或两者一起进行反馈。',
        backLabel: '返回设置',
        haptics: {
          title: '触感反馈',
          description: '为点按和选择提供轻微的振动反馈。',
          on: '开启',
          off: '关闭',
          turnOn: '开启触感反馈',
          turnOff: '关闭触感反馈',
          savedOn: '触感反馈已开启。',
          savedOff: '触感反馈已关闭。',
        },
        tapSound: {
          title: '点按声音',
          description: '在设备音频设置允许时播放轻柔的点按声音。',
          on: '开启',
          off: '关闭',
          turnOn: '开启点按声音',
          turnOff: '关闭点按声音',
          savedOn: '点按声音已开启。',
          savedOff: '点按声音已关闭。',
        },
      },
    },
  },
  pt: {
    settings: {
      feedback: {
        eyebrow: 'Configurações',
        title: 'Enviar feedback',
        description:
          'Dúvidas, erros ou ideias? Escreve-nos. O Floriva guarda os teus dados neste dispositivo, por isso não os conseguimos ver — conta-nos o que se passa.',
        backLabel: 'Voltar às configurações',
        emailButton: 'Escreve-nos',
        supportEmailLabel: 'E-mail de suporte',
        emailSubject: 'Feedback do Floriva',
        emailBodyIntro: 'O que funciona ou o que está com problemas:',
        emailUnavailable:
          'Não há nenhuma app de e-mail configurada neste dispositivo. Fala connosco em {email}.',
      },
      sounds: {
        eyebrow: 'Configurações',
        title: 'Sons e hápticos',
        titlePrefix: 'Sons e ',
        titleAccent: 'hápticos',
        titleSuffix: '.',
        description:
          'Escolhe se o Floriva responde aos toques com hápticos, sons ou ambos.',
        backLabel: 'Voltar às configurações',
        haptics: {
          title: 'Hápticos',
          description: 'Usa uma vibração suave para toques e seleções.',
          on: 'Ligado',
          off: 'Desligado',
          turnOn: 'Ligar hápticos',
          turnOff: 'Desligar hápticos',
          savedOn: 'Os hápticos estão ligados.',
          savedOff: 'Os hápticos estão desligados.',
        },
        tapSound: {
          title: 'Sons de toque',
          description:
            'Reproduz um som de toque subtil quando as definições de áudio do dispositivo o permitem.',
          on: 'Ligado',
          off: 'Desligado',
          turnOn: 'Ligar sons de toque',
          turnOff: 'Desligar sons de toque',
          savedOn: 'Os sons de toque estão ligados.',
          savedOff: 'Os sons de toque estão desligados.',
        },
      },
    },
  },
  ru: {
    settings: {
      feedback: {
        eyebrow: 'Настройки',
        title: 'Отправить отзыв',
        description:
          'Вопросы, ошибки или идеи? Напишите нам. Floriva хранит ваши данные на этом устройстве, поэтому мы их не видим — расскажите, что происходит.',
        backLabel: 'Назад к настройкам',
        emailButton: 'Напишите нам',
        supportEmailLabel: 'Почта поддержки',
        emailSubject: 'Отзыв о Floriva',
        emailBodyIntro: 'Что работает, а что нет:',
        emailUnavailable:
          'На этом устройстве не настроено почтовое приложение. Напишите нам на {email}.',
      },
      sounds: {
        eyebrow: 'Настройки',
        title: 'Звук и вибрация',
        titlePrefix: 'Звук и ',
        titleAccent: 'вибрация',
        titleSuffix: '.',
        description:
          'Выберите, будет ли Floriva реагировать на нажатия тактильным откликом, звуком или и тем и другим.',
        backLabel: 'Назад к настройкам',
        haptics: {
          title: 'Тактильный отклик',
          description: 'Использует лёгкую вибрацию для нажатий и выбора.',
          on: 'Вкл.',
          off: 'Выкл.',
          turnOn: 'Включить тактильный отклик',
          turnOff: 'Выключить тактильный отклик',
          savedOn: 'Тактильный отклик включён.',
          savedOff: 'Тактильный отклик выключен.',
        },
        tapSound: {
          title: 'Звуки нажатия',
          description:
            'Воспроизводит тихий звук нажатия, когда это разрешают настройки звука устройства.',
          on: 'Вкл.',
          off: 'Выкл.',
          turnOn: 'Включить звуки нажатия',
          turnOff: 'Выключить звуки нажатия',
          savedOn: 'Звуки нажатия включены.',
          savedOff: 'Звуки нажатия выключены.',
        },
      },
    },
  },
} as const;

export const settingsMessages = {
  en: {
    settings: {
      ...settingsCoreMessages.en.settings,
      ...settingsDeepMessages.en.settings,
      ...settingsFeedbackMessages.en.settings,
    },
  },
  es: {
    settings: {
      ...settingsCoreMessages.es.settings,
      ...settingsDeepMessages.es.settings,
      ...settingsFeedbackMessages.es.settings,
    },
  },
  de: {
    settings: {
      ...settingsCoreMessages.de.settings,
      ...settingsDeepMessages.de.settings,
      ...settingsFeedbackMessages.de.settings,
    },
  },
  fr: {
    settings: {
      ...settingsCoreMessages.fr.settings,
      ...settingsDeepMessages.fr.settings,
      ...settingsFeedbackMessages.fr.settings,
    },
  },
  ja: {
    settings: {
      ...settingsCoreMessages.ja.settings,
      ...settingsDeepMessages.ja.settings,
      ...settingsFeedbackMessages.ja.settings,
    },
  },
  'zh-Hans': {
    settings: {
      ...settingsCoreMessages['zh-Hans'].settings,
      ...settingsDeepMessages['zh-Hans'].settings,
      ...settingsFeedbackMessages['zh-Hans'].settings,
    },
  },
  pt: {
    settings: {
      ...settingsCoreMessages.pt.settings,
      ...settingsDeepMessages.pt.settings,
      ...settingsFeedbackMessages.pt.settings,
    },
  },
  ru: {
    settings: {
      ...settingsCoreMessages.ru.settings,
      ...settingsDeepMessages.ru.settings,
      ...settingsFeedbackMessages.ru.settings,
    },
  },
} as const;
