const helpMessages = {
  tryingToConceive: {
    title: 'Trying to conceive',
    body: 'Turn this on if you want to log conception-related details, like sex, ovulation tests, cervical mucus, or basal body temperature. Period and fertility estimates work without it.',
  },
  fertilityEstimates: {
    title: 'Fertility estimates',
    body: 'Floriva shows estimated fertile-window and ovulation timing to help you plan. These are estimates, not medical advice or birth control guidance.',
  },
  fertileWindow: {
    title: 'Fertile window',
    body: "The fertile window is Floriva’s estimate of days when conception may be more likely, based on your cycle data. Use it as planning context, not as contraception guidance.",
  },
  ovulationEstimate: {
    title: 'Ovulation estimate',
    body: 'Ovulation estimates are timing predictions from your saved cycle history. They are approximate. Floriva does not confirm ovulation or diagnose anything.',
  },
  bbt: {
    title: 'Basal body temperature',
    body: 'Basal body temperature is your resting temperature measured after sleep. Some people track it to notice patterns, but Floriva does not confirm ovulation from it.',
  },
  cervicalMucus: {
    title: 'Cervical mucus',
    body: 'Cervical mucus descriptions are optional observations about your body. They can help you notice patterns, but they are not a diagnosis.',
  },
  irregularCycles: {
    title: 'Irregular cycles',
    body: 'If your cycle timing varies a lot, Floriva uses more cautious wording for predictions. Estimates are still shown, but with lower confidence.',
  },
  sensitiveLogging: {
    title: 'Sensitive logging',
    body: 'Sensitive details stay on this device unless you choose to move them. Log only what feels useful to you.',
  },
} as const;

export const commonMessages = {
  en: {
    common: {
      actions: {
        continue: 'Continue',
        open: 'Open',
        close: 'Close',
      },
      help: helpMessages,
    },
  },
  es: {
    common: {
      actions: {
        continue: 'Continuar',
        open: 'Abrir',
        close: 'Cerrar',
      },
      help: helpMessages,
    },
  },
  de: {
    common: {
      actions: {
        continue: 'Weiter',
        open: 'Öffnen',
        close: 'Schließen',
      },
      help: helpMessages,
    },
  },
  fr: {
    common: {
      actions: {
        continue: 'Continuer',
        open: 'Ouvrir',
        close: 'Fermer',
      },
      help: helpMessages,
    },
  },
  ja: {
    common: {
      actions: {
        continue: '続ける',
        open: '開く',
        close: '閉じる',
      },
      help: helpMessages,
    },
  },
  'zh-Hans': {
    common: {
      actions: {
        continue: '继续',
        open: '打开',
        close: '关闭',
      },
      help: helpMessages,
    },
  },
  pt: {
    common: {
      actions: {
        continue: 'Continuar',
        open: 'Abrir',
        close: 'Fechar',
      },
      help: helpMessages,
    },
  },
  ru: {
    common: {
      actions: {
        continue: 'Продолжить',
        open: 'Открыть',
        close: 'Закрыть',
      },
      help: helpMessages,
    },
  },
} as const;
