// Localized copy for OS-level local notifications (buildReminderPlans.ts) and
// their quick-action button titles (registerNotificationCategories.ts).
//
// Discreet by design: lock-screen notifications must never surface
// reproductive-health wording (see the 2026-06-11 pristine-sweep hardening,
// which stripped period/cycle/fertility words from these strings). Keep any
// future edits to this file in the same generic, private register —
// buildReminderPlans.test.ts asserts none of these strings match
// period/fertile/ovulation/birth-control/cycle/symptom/mood/cramp/bleed.
export const notificationsMessages = {
  en: {
    notifications: {
      dailyLog: {
        title: 'Log today in Floriva',
        body: 'Keep your private history current without sending anything off-device.',
      },
      cycleEvent: {
        title: 'Floriva reminder',
        body: 'Open Floriva for a private update.',
      },
      birthControl: {
        title: 'Floriva reminder',
        body: 'Open Floriva for your private check-in.',
      },
      quickActions: {
        quickLog: 'Quick log',
        open: 'Open',
      },
    },
  },
  es: {
    notifications: {
      dailyLog: {
        title: 'Registra hoy en Floriva',
        body: 'Mantén tu historial privado al día sin enviar nada fuera del dispositivo.',
      },
      cycleEvent: {
        title: 'Recordatorio de Floriva',
        body: 'Abre Floriva para ver una actualización privada.',
      },
      birthControl: {
        title: 'Recordatorio de Floriva',
        body: 'Abre Floriva para tu registro privado.',
      },
      quickActions: {
        quickLog: 'Registro rápido',
        open: 'Abrir',
      },
    },
  },
  de: {
    notifications: {
      dailyLog: {
        title: 'Heute in Floriva erfassen',
        body: 'Halte deinen privaten Verlauf aktuell, ohne dass etwas das Gerät verlässt.',
      },
      cycleEvent: {
        title: 'Floriva-Erinnerung',
        body: 'Öffne Floriva für ein privates Update.',
      },
      birthControl: {
        title: 'Floriva-Erinnerung',
        body: 'Öffne Floriva für deinen privaten Check-in.',
      },
      quickActions: {
        quickLog: 'Schnell erfassen',
        open: 'Öffnen',
      },
    },
  },
  fr: {
    notifications: {
      dailyLog: {
        title: "Enregistre aujourd’hui dans Floriva",
        body: "Garde ton historique privé à jour sans rien envoyer hors de l’appareil.",
      },
      cycleEvent: {
        title: 'Rappel Floriva',
        body: 'Ouvre Floriva pour une mise à jour privée.',
      },
      birthControl: {
        title: 'Rappel Floriva',
        body: 'Ouvre Floriva pour ton suivi privé.',
      },
      quickActions: {
        quickLog: 'Saisie rapide',
        open: 'Ouvrir',
      },
    },
  },
  ja: {
    notifications: {
      dailyLog: {
        title: 'Florivaに今日の記録を',
        body: '何も外部に送信せず、プライベートな履歴を最新に保てます。',
      },
      cycleEvent: {
        title: 'Florivaからのお知らせ',
        body: 'Florivaを開いてプライベートな更新を確認しましょう。',
      },
      birthControl: {
        title: 'Florivaからのお知らせ',
        body: 'Florivaを開いてプライベートな確認をしましょう。',
      },
      quickActions: {
        quickLog: 'クイック記録',
        open: '開く',
      },
    },
  },
  'zh-Hans': {
    notifications: {
      dailyLog: {
        title: '在 Floriva 记录今天',
        body: '保持你的私密历史最新，且不会发送到设备之外。',
      },
      cycleEvent: {
        title: 'Floriva 提醒',
        body: '打开 Floriva 查看私密更新。',
      },
      birthControl: {
        title: 'Floriva 提醒',
        body: '打开 Floriva 进行私密确认。',
      },
      quickActions: {
        quickLog: '快速记录',
        open: '打开',
      },
    },
  },
  pt: {
    notifications: {
      dailyLog: {
        title: 'Registre hoje no Floriva',
        body: 'Mantenha seu histórico privado atualizado sem enviar nada para fora do dispositivo.',
      },
      cycleEvent: {
        title: 'Lembrete do Floriva',
        body: 'Abra o Floriva para uma atualização privada.',
      },
      birthControl: {
        title: 'Lembrete do Floriva',
        body: 'Abra o Floriva para o seu check-in privado.',
      },
      quickActions: {
        quickLog: 'Registro rápido',
        open: 'Abrir',
      },
    },
  },
  ru: {
    notifications: {
      dailyLog: {
        title: 'Запишите сегодня в Floriva',
        body: 'Поддерживайте приватную историю в актуальном состоянии, ничего не отправляя за пределы устройства.',
      },
      cycleEvent: {
        title: 'Напоминание Floriva',
        body: 'Откройте Floriva, чтобы увидеть приватное обновление.',
      },
      birthControl: {
        title: 'Напоминание Floriva',
        body: 'Откройте Floriva для приватной отметки.',
      },
      quickActions: {
        quickLog: 'Быстрая запись',
        open: 'Открыть',
      },
    },
  },
} as const;
