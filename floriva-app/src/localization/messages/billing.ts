const billingEnglishMessages = {
  billing: {
    screen: {
      eyebrow: 'Billing',
      title: 'Get Floriva',
      loading: 'Checking your purchase on this device.',
      description:
        'Floriva is free to start. Start a trial, pick a plan, restore a purchase, or come back later.',
      lockedNeedsPurchaseDescription:
        'Pick a plan to unlock Floriva. Start with a free trial.',
      lockedExpiredDescription:
        'Your free trial has ended. Pick a plan to keep using Floriva.',
      // LT-28: shown when a `trial_active` user reaches this screen
      // voluntarily (Settings' "Manage subscription" has no access-state
      // gate) -- must acknowledge the trial already in progress instead of
      // repeating the "start a free trial" pitch.
      lockedTrialActiveDescription:
        'Your free trial is active. You can review or change your plan anytime.',
    },
    overview: {
      title: 'Billing details',
      description: 'See pricing, trial dates, and renewal info before you choose.',
      trialNote:
        "If a plan has a free trial, billing starts when the trial ends. Cancel before then and you won’t be charged.",
      reminderNote:
        'If notifications are on, Floriva can send you a local reminder 3 days before the first charge.',
    },
    support: {
      title: 'Need help with billing?',
      description: 'Try restoring your purchases first. Then refresh if something still looks off.',
    },
    legal: {
      title: 'Legal',
      description: "Read Floriva’s policies before choosing a plan.",
      privacyPolicy: 'Privacy Policy',
      termsOfUse: 'Terms of Use',
    },
    buttons: {
      annual: 'Choose annual plan',
      lifetime: 'Unlock lifetime access',
      lifetimeStartTrial: 'Start free trial',
      monthly: 'Choose monthly plan',
      restore: 'Restore purchases',
      refresh: 'Refresh billing status',
      retry: 'Retry billing check',
      manage: 'Manage subscription',
    },
    labels: {
      oneTimePrice: 'One-time price',
      price: 'Price',
      refreshing: 'Refreshing billing status...',
    },
    offerings: {
      annualTrialDetail: '1 month free, then charged once a year. Cancel before the trial ends to avoid being charged.',
      annualStandardDetail: 'Charged once a year. Cancel before the next renewal to stop.',
      lifetimeDetail: 'Pay once. Access Floriva forever on this store account.',
      lifetimeTrialDetail: 'Try 1 month free, then a one-time purchase. No auto-charge — access ends unless you unlock lifetime.',
      monthlyTrialDetail: '1 month free, then charged each month. Cancel before the trial ends to avoid being charged.',
      monthlyStandardDetail: 'Charged each month. Cancel before the next renewal to stop.',
    },
    value: {
      eyebrow: "What you’re paying for",
      body: 'Floriva charges a simple fee so it stays private and ad-free.',
      onDevice: 'Stays on your device',
      noAccount: 'No account needed',
      noAds: 'No ads',
      noSelling: 'Your data is never sold',
    },
    timeline: {
      title: 'How the free trial works',
      today: 'Today',
      reminderLabel: 'Reminder',
      chargeLabel: 'Trial ends',
      todayBody: 'Full access starts now.',
      reminderBody: "We’ll send a reminder 3 days before the trial ends.",
      chargeBody: 'Billing starts. Cancel any time before this to avoid the charge.',
    },
    plans: {
      bestValueBadge: 'Best value',
      // UL-10: visible label pairing with the selected card's accessibility
      // state, so the chosen plan is announced in words, not border-weight.
      selectedBadge: 'Selected',
      savings: 'Save {percent}%',
      perMonth: '{price}/mo',
      notChargedToday: 'Nothing charged today.',
      autoRenewDisclosure:
        'Subscriptions renew automatically. Cancel at least 24 hours before the period ends to stop renewal. Manage or cancel in your store account at any time.',
    },
    onboarding: {
      eyebrow: 'Floriva access',
      title: 'Start your free trial.',
      needsPurchase:
        'Pick a plan to start 1 month free. Switch or cancel any time before the trial ends.',
      expired: 'Your trial has ended. Pick a plan to keep your data.',
    },
  },
} as const;

export const billingMessages = {
  en: billingEnglishMessages,
  es: {
    billing: {
      screen: {
        eyebrow: 'Facturación',
        title: 'Obtén Floriva',
        loading: 'Comprobando tu estado de compra en este dispositivo.',
        description:
          'Floriva es gratis para empezar. Puedes iniciar una prueba, elegir un plan, restaurar una compra o decidir después.',
        lockedNeedsPurchaseDescription:
          'Elige un plan para desbloquear Floriva. Inicia tu prueba gratuita o elige un plan para empezar.',
        lockedExpiredDescription:
          'Tu prueba gratuita ha terminado: elige un plan para seguir usando Floriva.',
        lockedTrialActiveDescription:
          'Tu prueba gratuita está activa. Puedes revisar o cambiar tu plan cuando quieras.',
      },
      overview: {
        title: 'Detalles de facturación',
        description:
          'Revisa precios, fechas de prueba y renovaciones antes de elegir.',
        trialNote:
          'Si un plan incluye prueba gratuita, el cobro empieza automáticamente cuando termina la prueba, salvo que canceles antes.',
        reminderNote:
          'Si las notificaciones siguen permitidas en este dispositivo, Floriva puede enviar un recordatorio local 3 días antes del primer cobro.',
      },
      support: {
        title: '¿Necesitas ayuda con la facturación?',
        description:
          'Primero restaura tus compras y luego actualiza si el acceso sigue viéndose mal.',
      },
      legal: {
        title: 'Legal',
        description: 'Revisa las políticas de Floriva antes de elegir un plan.',
        privacyPolicy: 'Política de privacidad',
        termsOfUse: 'Términos de uso',
      },
      buttons: {
        annual: 'Elegir plan anual',
        lifetime: 'Desbloquear acceso de por vida',
        lifetimeStartTrial: 'Comenzar prueba gratis',
        monthly: 'Elegir plan mensual',
        restore: 'Restaurar compras',
        refresh: 'Actualizar estado de facturación',
        retry: 'Reintentar comprobación de facturación',
        manage: 'Gestionar suscripción',
      },
      labels: {
        oneTimePrice: 'Precio único',
        price: 'Precio',
        refreshing: 'Actualizando estado de facturación...',
      },
      offerings: {
        annualTrialDetail: '1 mes gratis y después cobro anual, salvo que canceles antes.',
        annualStandardDetail: 'Cobro anual salvo que canceles antes de la siguiente renovación.',
        lifetimeDetail: 'Compra única para acceso de por vida en esta cuenta de la tienda.',
        lifetimeTrialDetail: 'Prueba 1 mes gratis y luego un pago único. Sin cargos automáticos: el acceso termina a menos que desbloquees el acceso de por vida.',
        monthlyTrialDetail: '1 mes gratis y después cobro mensual, salvo que canceles antes.',
        monthlyStandardDetail:
          'Cobro mensual salvo que canceles antes de la siguiente renovación.',
      },
      value: {
        eyebrow: 'Qué estás pagando',
        body: 'Un modelo de pago sencillo es lo que mantiene privado a Floriva.',
        onDevice: 'Almacenado solo en este dispositivo',
        noAccount: 'No requiere cuenta',
        noAds: 'Sin anuncios',
        noSelling: 'Sin venta de datos',
      },
      timeline: {
        title: 'Cómo funciona tu prueba gratuita',
        today: 'Hoy',
        reminderLabel: 'Recordatorio de prueba',
        chargeLabel: 'Cuando termine tu prueba',
        todayBody: 'Acceso completo a todas las funciones.',
        reminderBody: 'Te avisaremos 3 días antes de que termine la prueba.',
        chargeBody: 'Tu plan empieza salvo que canceles antes.',
      },
      plans: {
        bestValueBadge: 'Mejor valor',
        selectedBadge: 'Seleccionado',
        savings: 'Ahorra {percent}%',
        perMonth: '{price}/mes',
        notChargedToday: 'No se te cobrará hoy.',
        autoRenewDisclosure:
          'Las suscripciones se renuevan automáticamente salvo que canceles al menos 24 horas antes de que termine el periodo. Gestiona o cancela cuando quieras en tu cuenta de la tienda.',
      },
      onboarding: {
        eyebrow: 'Acceso a Floriva',
        title: 'Empieza tu prueba gratuita.',
        needsPurchase:
          'Elige un plan para iniciar tu prueba gratuita. Puedes cambiar o cancelar en cualquier momento antes de que termine.',
        expired:
          'Tu prueba ha terminado: elige un plan para conservar tus datos y predicciones.',
      },
    },
  },
  de: {
    billing: {
      screen: {
        eyebrow: 'Abrechnung',
        title: 'Floriva holen',
        loading: 'Dein Kaufstatus auf diesem Gerät wird geprüft.',
        description:
          'Floriva ist kostenlos zum Starten. Du kannst eine Testphase beginnen, einen Plan wählen, einen Kauf wiederherstellen oder später entscheiden.',
        lockedNeedsPurchaseDescription:
          'Wähle einen Plan, um Floriva freizuschalten. Starte deine kostenlose Testphase oder wähle einen Plan, um zu beginnen.',
        lockedExpiredDescription:
          'Deine kostenlose Testphase ist beendet. Wähle einen Plan, um Floriva weiter zu nutzen.',
        lockedTrialActiveDescription:
          'Deine kostenlose Testphase läuft. Du kannst deinen Plan jederzeit prüfen oder ändern.',
      },
      overview: {
        title: 'Abrechnungsdetails',
        description:
          'Prüfe Preise, Testzeitraum und Verlängerungsdetails, bevor du wählst.',
        trialNote:
          'Wenn ein Plan eine kostenlose Testphase enthält, beginnt die Abrechnung nach dem Ende der Testphase automatisch, sofern du nicht vorher kündigst.',
        reminderNote:
          'Wenn Benachrichtigungen auf diesem Gerät erlaubt sind, kann Floriva 3 Tage vor der ersten Abbuchung eine lokale Erinnerung senden.',
      },
      support: {
        title: 'Brauchst du Hilfe bei der Abrechnung?',
        description:
          'Stelle zuerst Käufe wieder her und aktualisiere dann, wenn dein Zugriff weiterhin falsch aussieht.',
      },
      legal: {
        title: 'Rechtliches',
        description: 'Prüfe die Floriva-Richtlinien, bevor du einen Plan wählst.',
        privacyPolicy: 'Datenschutzrichtlinie',
        termsOfUse: 'Nutzungsbedingungen',
      },
      buttons: {
        annual: 'Jahresplan wählen',
        lifetime: 'Lebenslangen Zugriff freischalten',
        lifetimeStartTrial: 'Kostenlos testen',
        monthly: 'Monatsplan wählen',
        restore: 'Käufe wiederherstellen',
        refresh: 'Abrechnungsstatus aktualisieren',
        retry: 'Abrechnungsprüfung erneut versuchen',
        manage: 'Abo verwalten',
      },
      labels: {
        oneTimePrice: 'Einmalpreis',
        price: 'Preis',
        refreshing: 'Abrechnungsstatus wird aktualisiert...',
      },
      offerings: {
        annualTrialDetail:
          '1 Monat gratis, danach jährliche Abrechnung, wenn du nicht vorher kündigst.',
        annualStandardDetail:
          'Jährliche Abrechnung, wenn du nicht vor der nächsten Verlängerung kündigst.',
        lifetimeDetail: 'Einmaliger Kauf für lebenslangen Zugriff in diesem Store-Konto.',
        lifetimeTrialDetail: '1 Monat kostenlos testen, danach einmalige Zahlung. Keine automatische Abbuchung – der Zugriff endet, sofern du den lebenslangen Zugriff nicht freischaltest.',
        monthlyTrialDetail:
          '1 Monat gratis, danach monatliche Abrechnung, wenn du nicht vorher kündigst.',
        monthlyStandardDetail:
          'Monatliche Abrechnung, wenn du nicht vor der nächsten Verlängerung kündigst.',
      },
      value: {
        eyebrow: 'Wofür du bezahlst',
        body: 'Ein einfaches, bezahltes Modell hält Floriva privat.',
        onDevice: 'Nur auf diesem Gerät gespeichert',
        noAccount: 'Kein Konto erforderlich',
        noAds: 'Keine Werbung',
        noSelling: 'Kein Verkauf von Daten',
      },
      timeline: {
        title: 'So funktioniert deine kostenlose Testphase',
        today: 'Heute',
        reminderLabel: 'Test-Erinnerung',
        chargeLabel: 'Wenn deine Testphase endet',
        todayBody: 'Voller Zugriff auf alle Funktionen.',
        reminderBody: 'Wir erinnern dich 3 Tage vor dem Ende der Testphase.',
        chargeBody: 'Dein Plan beginnt, sofern du nicht vorher kündigst.',
      },
      plans: {
        bestValueBadge: 'Bestes Angebot',
        selectedBadge: 'Ausgewählt',
        savings: '{percent}% sparen',
        perMonth: '{price}/Mon.',
        notChargedToday: 'Heute wird dir nichts berechnet.',
        autoRenewDisclosure:
          'Abos verlängern sich automatisch, sofern nicht mindestens 24 Stunden vor Ablauf des Zeitraums gekündigt wird. Verwalte oder kündige jederzeit in deinem Store-Konto.',
      },
      onboarding: {
        eyebrow: 'Floriva-Zugang',
        title: 'Starte deine kostenlose Testphase.',
        needsPurchase:
          'Wähle einen Plan, um deine kostenlose Testphase zu starten. Du kannst jederzeit vor dem Ende wechseln oder kündigen.',
        expired:
          'Deine Testphase ist beendet. Wähle einen Plan, um deine Daten und Prognosen zu behalten.',
      },
    },
  },
  fr: {
    billing: {
      screen: {
        eyebrow: 'Facturation',
        title: 'Obtenir Floriva',
        loading: "Vérification de ton statut d’achat sur cet appareil.",
        description:
          'Floriva est gratuit pour commencer. Tu peux démarrer un essai, choisir une formule, restaurer un achat ou décider plus tard.',
        lockedNeedsPurchaseDescription:
          'Choisis une formule pour débloquer Floriva. Démarre ton essai gratuit ou choisis une formule pour commencer.',
        lockedExpiredDescription:
          'Ton essai gratuit est terminé. Choisis une formule pour continuer à utiliser Floriva.',
        lockedTrialActiveDescription:
          'Ton essai gratuit est actif. Tu peux consulter ou changer ta formule à tout moment.',
      },
      overview: {
        title: 'Détails de facturation',
        description:
          "Consulte les prix, le calendrier d’essai et les détails de renouvellement avant de choisir.",
        trialNote:
          "Si une formule inclut un essai gratuit, la facturation démarre automatiquement à la fin de l’essai sauf si tu annules avant.",
        reminderNote:
          'Si les notifications sont autorisées sur cet appareil, Floriva peut envoyer un rappel local 3 jours avant le premier débit.',
      },
      support: {
        title: "Besoin d’aide pour la facturation ?",
        description:
          "Restaure d’abord les achats, puis actualise si ton accès semble toujours incorrect.",
      },
      legal: {
        title: 'Mentions légales',
        description: 'Consulte les politiques de Floriva avant de choisir une formule.',
        privacyPolicy: 'Politique de confidentialité',
        termsOfUse: "Conditions d’utilisation",
      },
      buttons: {
        annual: 'Choisir la formule annuelle',
        lifetime: "Débloquer l’accès à vie",
        lifetimeStartTrial: 'Commencer l’essai gratuit',
        monthly: 'Choisir la formule mensuelle',
        restore: 'Restaurer les achats',
        refresh: "Actualiser l’état de facturation",
        retry: 'Réessayer la vérification',
        manage: "Gérer l’abonnement",
      },
      labels: {
        oneTimePrice: 'Prix unique',
        price: 'Prix',
        refreshing: "Actualisation de l’état de facturation...",
      },
      offerings: {
        annualTrialDetail: '1 mois gratuit, puis facturation annuelle sauf annulation avant.',
        annualStandardDetail:
          'Facturation annuelle sauf annulation avant le prochain renouvellement.',
        lifetimeDetail: 'Achat unique pour un accès à vie sur ce compte de la boutique.',
        lifetimeTrialDetail: 'Essaie 1 mois gratuitement, puis un paiement unique. Aucun prélèvement automatique : l’accès prend fin sauf si tu débloques l’accès à vie.',
        monthlyTrialDetail:
          '1 mois gratuit, puis facturation mensuelle sauf annulation avant.',
        monthlyStandardDetail:
          'Facturation mensuelle sauf annulation avant le prochain renouvellement.',
      },
      value: {
        eyebrow: 'Ce pour quoi tu paies',
        body: 'Un modèle payant simple est ce qui garde Floriva privé.',
        onDevice: 'Stocké uniquement sur cet appareil',
        noAccount: 'Aucun compte requis',
        noAds: 'Aucune publicité',
        noSelling: 'Aucune vente de données',
      },
      timeline: {
        title: 'Comment fonctionne ton essai gratuit',
        today: "Aujourd’hui",
        reminderLabel: "Rappel d’essai",
        chargeLabel: 'À la fin de ton essai',
        todayBody: 'Accès complet à toutes les fonctionnalités.',
        reminderBody: "Nous te préviendrons 3 jours avant la fin de l’essai.",
        chargeBody: 'Ta formule démarre sauf si tu annules avant.',
      },
      plans: {
        bestValueBadge: 'Meilleure offre',
        selectedBadge: 'Sélectionné',
        savings: 'Économise {percent}%',
        perMonth: '{price}/mois',
        notChargedToday: "Tu ne seras pas débité aujourd’hui.",
        autoRenewDisclosure:
          'Les abonnements se renouvellent automatiquement sauf annulation au moins 24 heures avant la fin de la période. Gère ou annule à tout moment dans ton compte de la boutique.',
      },
      onboarding: {
        eyebrow: 'Accès Floriva',
        title: 'Commence ton essai gratuit.',
        needsPurchase:
          'Choisis une formule pour démarrer ton essai gratuit. Tu peux changer ou annuler à tout moment avant la fin.',
        expired:
          'Ton essai est terminé. Choisis une formule pour conserver tes données et prédictions.',
      },
    },
  },
  ja: {
    billing: {
      screen: {
        eyebrow: '請求',
        title: 'Floriva を入手',
        loading: 'この端末で購入状況を確認しています。',
        description:
          'Floriva は無料で始められます。トライアルを開始する、プランを選ぶ、購入を復元する、または後で決めることができます。',
        lockedNeedsPurchaseDescription:
          'プランを選ぶと Floriva を使えます。無料トライアルを開始するか、プランを選んで始めましょう。',
        lockedExpiredDescription:
          '無料トライアルが終了しました。Floriva を続けて使うにはプランを選んでください。',
        lockedTrialActiveDescription:
          '無料トライアルは有効です。いつでもプランを確認・変更できます。',
      },
      overview: {
        title: '請求の詳細',
        description:
          '選ぶ前に、価格、トライアル期間、更新内容を確認できます。',
        trialNote:
          'プランに無料トライアルが含まれる場合、先に解約しない限りトライアル終了後に自動で課金が始まります。',
        reminderNote:
          'この端末で通知が許可されたままであれば、最初の課金の 3 日前に Floriva がローカル通知を送ることがあります。',
      },
      support: {
        title: '請求についてサポートが必要ですか？',
        description:
          'アクセス表示がおかしいままなら、まず購入を復元してから請求状態を更新してください。',
      },
      legal: {
        title: '法的情報',
        description: 'プランを選ぶ前に Floriva のポリシーを確認できます。',
        privacyPolicy: 'プライバシーポリシー',
        termsOfUse: '利用規約',
      },
      buttons: {
        annual: '年額プランを選ぶ',
        lifetime: '生涯アクセスを解除',
        lifetimeStartTrial: '無料トライアルを開始',
        monthly: '月額プランを選ぶ',
        restore: '購入を復元',
        refresh: '請求状態を更新',
        retry: '請求確認を再試行',
        manage: 'サブスクリプションを管理',
      },
      labels: {
        oneTimePrice: '買い切り価格',
        price: '価格',
        refreshing: '請求状態を更新しています...',
      },
      offerings: {
        annualTrialDetail: '1 か月無料、その後は先に解約しない限り年額で請求されます。',
        annualStandardDetail:
          '次回更新の前に解約しない限り、年額で請求されます。',
        lifetimeDetail: 'このストアアカウントで使える生涯アクセスの買い切りです。',
        lifetimeTrialDetail: '1か月無料でお試しいただけます。その後は買い切り1回のみで、自動課金はありません。生涯アクセスを購入しない限りアクセスは終了します。',
        monthlyTrialDetail:
          '1 か月無料、その後は先に解約しない限り月額で請求されます。',
        monthlyStandardDetail:
          '次回更新の前に解約しない限り、月額で請求されます。',
      },
      value: {
        eyebrow: '料金で支えているもの',
        body: 'シンプルな有料モデルが Floriva のプライバシーを守ります。',
        onDevice: 'この端末にのみ保存',
        noAccount: 'アカウント不要',
        noAds: '広告なし',
        noSelling: 'データ販売なし',
      },
      timeline: {
        title: '無料トライアルの仕組み',
        today: '今日',
        reminderLabel: 'トライアルのリマインダー',
        chargeLabel: 'トライアル終了時',
        todayBody: 'すべての機能をフルに利用できます。',
        reminderBody: 'トライアル終了の3日前にお知らせします。',
        chargeBody: '先に解約しない限り、プランが開始します。',
      },
      plans: {
        bestValueBadge: 'いちばんお得',
        selectedBadge: '選択中',
        savings: '{percent}% お得',
        perMonth: '{price}/月',
        notChargedToday: '本日は課金されません。',
        autoRenewDisclosure:
          '期間終了の少なくとも 24 時間前に解約しない限り、サブスクリプションは自動更新されます。ストアアカウントでいつでも管理・解約できます。',
      },
      onboarding: {
        eyebrow: 'Floriva アクセス',
        title: '無料トライアルを始める',
        needsPurchase:
          'プランを選んで無料トライアルを開始しましょう。終了前ならいつでも変更・解約できます。',
        expired:
          'トライアルが終了しました。データと予測を引き継ぐにはプランを選んでください。',
      },
    },
  },
  'zh-Hans': {
    billing: {
      screen: {
        eyebrow: '计费',
        title: '获取 Floriva',
        loading: '正在检查这台设备上的购买状态。',
        description:
          'Floriva 可免费开始使用。你可以开始试用、选择一个计划、恢复购买，或稍后再决定。',
        lockedNeedsPurchaseDescription:
          '选择一个计划即可解锁 Floriva。开始免费试用或选择一个计划即可开始。',
        lockedExpiredDescription: '你的免费试用已结束。选择一个计划以继续使用 Floriva。',
        lockedTrialActiveDescription: '你的免费试用正在进行。你可以随时查看或更改计划。',
      },
      overview: {
        title: '计费详情',
        description: '选择前查看价格、试用时间和续订详情。',
        trialNote:
          '如果某个计划包含免费试用，除非你提前取消，否则会在试用结束后自动开始收费。',
        reminderNote:
          '如果这台设备仍允许通知，Floriva 可以在首次扣费前 3 天发送本地提醒。',
      },
      support: {
        title: '需要计费帮助吗？',
        description: '如果访问状态看起来仍然不对，请先恢复购买，再刷新计费状态。',
      },
      legal: {
        title: '法律信息',
        description: '选择计划前，请查看 Floriva 政策。',
        privacyPolicy: '隐私政策',
        termsOfUse: '使用条款',
      },
      buttons: {
        annual: '选择年度计划',
        lifetime: '解锁终身访问',
        lifetimeStartTrial: '开始免费试用',
        monthly: '选择月度计划',
        restore: '恢复购买',
        refresh: '刷新计费状态',
        retry: '重试计费检查',
        manage: '管理订阅',
      },
      labels: {
        oneTimePrice: '一次性价格',
        price: '价格',
        refreshing: '正在刷新计费状态...',
      },
      offerings: {
        annualTrialDetail: '首月免费，之后除非你提前取消，否则按年收费。',
        annualStandardDetail: '除非你在下一次续订前取消，否则按年收费。',
        lifetimeDetail: '一次性购买，在此商店账户中解锁终身访问。',
        lifetimeTrialDetail: '免费试用 1 个月，之后一次性付款。不会自动扣费——除非解锁终身访问，否则访问将结束。',
        monthlyTrialDetail: '首月免费，之后除非你提前取消，否则按月收费。',
        monthlyStandardDetail: '除非你在下一次续订前取消，否则按月收费。',
      },
      value: {
        eyebrow: '你付费换来的',
        body: '简单的付费模式正是 Floriva 保持私密的原因。',
        onDevice: '仅存储在这台设备上',
        noAccount: '无需账户',
        noAds: '没有广告',
        noSelling: '不出售数据',
      },
      timeline: {
        title: '免费试用如何运作',
        today: '今天',
        reminderLabel: '试用提醒',
        chargeLabel: '试用结束时',
        todayBody: '完整使用所有功能。',
        reminderBody: '试用结束前 3 天我们会提醒你。',
        chargeBody: '除非你提前取消，否则你的计划将开始。',
      },
      plans: {
        bestValueBadge: '超值之选',
        selectedBadge: '已选择',
        savings: '省 {percent}%',
        perMonth: '{price}/月',
        notChargedToday: '今天不会向你收费。',
        autoRenewDisclosure:
          '除非在周期结束前至少 24 小时取消，否则订阅会自动续订。你可以随时在商店账户中管理或取消。',
      },
      onboarding: {
        eyebrow: 'Floriva 访问',
        title: '开始免费试用。',
        needsPurchase:
          '选择一个计划开始免费试用。你可以在结束前随时更换或取消。',
        expired: '你的试用已结束。选择一个计划以保留你的数据和预测。',
      },
    },
  },
  pt: {
    billing: {
      screen: {
        eyebrow: 'Cobrança',
        title: 'Obter o Floriva',
        loading: 'A verificar o estado da tua compra neste dispositivo.',
        description:
          'O Floriva é gratuito para começar. Podes iniciar um teste, escolher um plano, restaurar uma compra ou decidir depois.',
        lockedNeedsPurchaseDescription:
          'Escolhe um plano para desbloquear o Floriva. Inicia o teste gratuito ou escolhe um plano para começar.',
        lockedExpiredDescription:
          'O teu teste gratuito terminou. Escolhe um plano para continuar a usar o Floriva.',
        lockedTrialActiveDescription:
          'O teu teste gratuito está ativo. Podes rever ou mudar o teu plano quando quiseres.',
      },
      overview: {
        title: 'Detalhes da cobrança',
        description:
          'Revê preços, duração do teste e detalhes de renovação antes de escolher.',
        trialNote:
          'Se um plano incluir teste gratuito, a cobrança começa automaticamente quando o teste termina, a menos que canceles antes.',
        reminderNote:
          'Se as notificações continuarem permitidas neste dispositivo, o Floriva pode enviar um lembrete local 3 dias antes da primeira cobrança.',
      },
      support: {
        title: 'Precisas de ajuda com a cobrança?',
        description:
          'Restaura primeiro as compras e depois atualiza se o teu acesso continuar a parecer incorreto.',
      },
      legal: {
        title: 'Legal',
        description: 'Revê as políticas do Floriva antes de escolher um plano.',
        privacyPolicy: 'Política de privacidade',
        termsOfUse: 'Termos de uso',
      },
      buttons: {
        annual: 'Escolher plano anual',
        lifetime: 'Desbloquear acesso vitalício',
        lifetimeStartTrial: 'Iniciar teste grátis',
        monthly: 'Escolher plano mensal',
        restore: 'Restaurar compras',
        refresh: 'Atualizar estado de cobrança',
        retry: 'Tentar novamente a verificação',
        manage: 'Gerir subscrição',
      },
      labels: {
        oneTimePrice: 'Preço único',
        price: 'Preço',
        refreshing: 'A atualizar o estado de cobrança...',
      },
      offerings: {
        annualTrialDetail:
          '1 mês grátis e depois cobrança anual, a menos que canceles antes.',
        annualStandardDetail:
          'Cobrança anual, a menos que canceles antes da renovação seguinte.',
        lifetimeDetail: 'Compra única para acesso vitalício nesta conta da loja.',
        lifetimeTrialDetail: 'Experimente 1 mês grátis e depois um pagamento único. Sem cobrança automática: o acesso termina a menos que você desbloqueie o acesso vitalício.',
        monthlyTrialDetail:
          '1 mês grátis e depois cobrança mensal, a menos que canceles antes.',
        monthlyStandardDetail:
          'Cobrança mensal, a menos que canceles antes da renovação seguinte.',
      },
      value: {
        eyebrow: 'O que estás a pagar',
        body: 'Um modelo pago simples é o que mantém o Floriva privado.',
        onDevice: 'Guardado apenas neste dispositivo',
        noAccount: 'Não requer conta',
        noAds: 'Sem anúncios',
        noSelling: 'Sem venda de dados',
      },
      timeline: {
        title: 'Como funciona o teu teste gratuito',
        today: 'Hoje',
        reminderLabel: 'Lembrete do teste',
        chargeLabel: 'Quando o teste terminar',
        todayBody: 'Acesso completo a todas as funcionalidades.',
        reminderBody: 'Vamos avisar-te 3 dias antes de o teste terminar.',
        chargeBody: 'O teu plano começa, a menos que canceles antes.',
      },
      plans: {
        bestValueBadge: 'Melhor valor',
        selectedBadge: 'Selecionado',
        savings: 'Poupa {percent}%',
        perMonth: '{price}/mês',
        notChargedToday: 'Não serás cobrado hoje.',
        autoRenewDisclosure:
          'As subscrições renovam-se automaticamente, a menos que canceles pelo menos 24 horas antes do fim do período. Gere ou cancela a qualquer momento na tua conta da loja.',
      },
      onboarding: {
        eyebrow: 'Acesso ao Floriva',
        title: 'Começa o teu teste gratuito.',
        needsPurchase:
          'Escolhe um plano para iniciar o teu teste gratuito. Podes mudar ou cancelar a qualquer momento antes de terminar.',
        expired:
          'O teu teste terminou. Escolhe um plano para manter os teus dados e previsões.',
      },
    },
  },
  ru: {
    billing: {
      screen: {
        eyebrow: 'Оплата',
        title: 'Получить Floriva',
        loading: 'Проверяем статус вашей покупки на этом устройстве.',
        description:
          'Floriva можно начать бесплатно. Вы можете начать пробный период, выбрать план, восстановить покупку или решить позже.',
        lockedNeedsPurchaseDescription:
          'Выберите план, чтобы открыть Floriva. Начните бесплатный пробный период или выберите план, чтобы начать.',
        lockedExpiredDescription:
          'Ваш бесплатный пробный период закончился. Выберите план, чтобы продолжить пользоваться Floriva.',
        lockedTrialActiveDescription:
          'Ваш бесплатный пробный период активен. Вы можете просмотреть или изменить план в любое время.',
      },
      overview: {
        title: 'Детали оплаты',
        description:
          'Проверьте цену, сроки пробного периода и условия продления перед выбором.',
        trialNote:
          'Если в плане есть бесплатный пробный период, списание начнётся автоматически после его окончания, если вы не отмените план заранее.',
        reminderNote:
          'Если уведомления на этом устройстве разрешены, Floriva может отправить локальное напоминание за 3 дня до первого списания.',
      },
      support: {
        title: 'Нужна помощь с оплатой?',
        description:
          'Сначала восстановите покупки, а затем обновите статус, если доступ всё ещё выглядит неверно.',
      },
      legal: {
        title: 'Правовая информация',
        description: 'Ознакомьтесь с политиками Floriva перед выбором плана.',
        privacyPolicy: 'Политика конфиденциальности',
        termsOfUse: 'Условия использования',
      },
      buttons: {
        annual: 'Выбрать годовой план',
        lifetime: 'Открыть пожизненный доступ',
        lifetimeStartTrial: 'Начать бесплатный период',
        monthly: 'Выбрать месячный план',
        restore: 'Восстановить покупки',
        refresh: 'Обновить статус оплаты',
        retry: 'Повторить проверку оплаты',
        manage: 'Управлять подпиской',
      },
      labels: {
        oneTimePrice: 'Разовая цена',
        price: 'Цена',
        refreshing: 'Обновляем статус оплаты...',
      },
      offerings: {
        annualTrialDetail:
          '1 месяц бесплатно, затем ежегодная оплата, если вы не отмените раньше.',
        annualStandardDetail:
          'Ежегодная оплата, если вы не отмените план до следующего продления.',
        lifetimeDetail: 'Разовая покупка для пожизненного доступа в этой учётной записи магазина.',
        lifetimeTrialDetail: 'Попробуйте 1 месяц бесплатно, затем разовая покупка. Без автосписаний — доступ закончится, если не оформить пожизненный доступ.',
        monthlyTrialDetail:
          '1 месяц бесплатно, затем ежемесячная оплата, если вы не отмените раньше.',
        monthlyStandardDetail:
          'Ежемесячная оплата, если вы не отмените план до следующего продления.',
      },
      value: {
        eyebrow: 'За что вы платите',
        body: 'Простая платная модель это то, что сохраняет приватность Floriva.',
        onDevice: 'Хранится только на этом устройстве',
        noAccount: 'Аккаунт не нужен',
        noAds: 'Без рекламы',
        noSelling: 'Без продажи данных',
      },
      timeline: {
        title: 'Как работает бесплатный пробный период',
        today: 'Сегодня',
        reminderLabel: 'Напоминание о пробном периоде',
        chargeLabel: 'Когда закончится пробный период',
        todayBody: 'Полный доступ ко всем функциям.',
        reminderBody: 'Мы напомним вам за 3 дня до окончания пробного периода.',
        chargeBody: 'Ваш план начнётся, если вы не отмените его раньше.',
      },
      plans: {
        bestValueBadge: 'Лучшая цена',
        selectedBadge: 'Выбрано',
        savings: 'Экономия {percent}%',
        perMonth: '{price}/мес',
        notChargedToday: 'Сегодня с вас не спишут оплату.',
        autoRenewDisclosure:
          'Подписки продлеваются автоматически, если не отменить их не менее чем за 24 часа до окончания периода. Управляйте или отменяйте в любое время в учётной записи магазина.',
      },
      onboarding: {
        eyebrow: 'Доступ к Floriva',
        title: 'Начните бесплатный пробный период.',
        needsPurchase:
          'Выберите план, чтобы начать бесплатный пробный период. Вы можете сменить или отменить его в любое время до окончания.',
        expired:
          'Ваш пробный период закончился. Выберите план, чтобы сохранить данные и прогнозы.',
      },
    },
  },
} as const;
