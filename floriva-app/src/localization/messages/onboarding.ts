export const onboardingMessages = {
  en: {
    onboarding: {
      shared: {
        selected: 'Selected',
        invalidInput: 'Invalid input',
      },
      welcome: {
        eyebrow: 'Privacy-first period tracker',
        title: 'Floriva keeps setup calm and private.',
        body: 'Your cycle data stays on your device unless you explicitly choose to move it.',
        startSetup: 'Start setup',
        restoreFromBackup: 'Restore from backup',
        readPrivacyDetails: 'Read privacy details',
        setupCard: {
          title: 'Set up in about a minute',
          body: 'A few basics get your timeline started. You can add the rest later.',
        },
        storageCard: {
          title: 'Stored on this device',
          body: 'Cycle history, symptoms, and notes stay local on this device.',
        },
      },
      basics: {
        eyebrow: 'Cycle basics',
        title: 'Set your everyday starting point',
        description:
          'These details stay on your device and help Floriva give reasonable estimates.',
        backLabel: 'Back',
        section: {
          title: 'What Floriva needs first',
          body: 'You can adjust these later. Last period start helps Floriva place you in your cycle right away.',
        },
        cycleLengthLabel: 'Cycle length (days)',
        periodLengthLabel: 'Period length (days)',
        lastPeriodStartLabel: 'Last period start',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD or 04/03/2026',
        quickPicksTitle: 'Quick picks',
        quickPicks: {
          today: 'Today',
          yesterday: 'Yesterday',
          sevenDaysAgo: '7 days ago',
          fourteenDaysAgo: '14 days ago',
          twentyEightDaysAgo: '28 days ago',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva will start from ',
          selectedSuffix: '.',
          empty: 'Pick the closest date, or type the exact day if you know it.',
        },
        privacyNote: {
          title: 'Privacy note',
          body: 'Floriva does not need an account to remember this setup.',
          detail: 'Your cycle basics stay on-device unless you explicitly choose to move them later.',
          helper:
            'Floriva accepts `YYYY-MM-DD` or `MM/DD/YYYY`, and quick picks can fill the date if you do not want to type it out.',
        },
        validation: {
          cycleLengthRequired: 'Enter your usual cycle length.',
          cycleLengthRange: 'Enter a cycle length between 1 and 120 days.',
          periodLengthRange: 'Enter a period length between 1 and 30 days.',
          lastPeriodStartInvalid:
            'Enter a real date. Floriva also accepts MM/DD/YYYY for this step.',
          lastPeriodStartFuture: 'Last period start cannot be in the future.',
        },
      },
      goals: {
        eyebrow: 'Goals and conditions',
        title: 'Set up the tracking that fits you',
        description: 'Pick the tracking Floriva should prioritize first.',
        backLabel: 'Back',
        section: {
          title: 'Tracking goals',
          body: 'Choose at least one. This sets up your first logging screens.',
        },
        options: {
          period: {
            title: 'Period tracking',
            description: 'Keep today and your calendar focused on cycle rhythm.',
          },
          symptoms: {
            title: 'Symptoms and mood',
            description: 'Log symptoms, mood, and daily notes from day one.',
          },
          tryingToConceive: {
            title: 'Trying to conceive',
            description: 'Add trying-to-conceive logging when you want it.',
          },
        },
        irregularCycle: {
          title: 'Irregular-cycle support',
          body: 'Let Floriva know whether your timing can vary.',
          yes: {
            title: 'Yes, it can vary',
            description: 'Use clearer uncertainty around predictions.',
          },
          no: {
            title: 'No, it is usually steady',
            description: 'Use a steadier baseline for predictions.',
          },
        },
        conditions: {
          title: 'Condition tags',
          body: 'Optional tags keep your logging screens relevant to you.',
        },
        footer: {
          helper: 'Selections stay visible near Continue while you scroll.',
          selectedGoalPrefix: 'Selected goal: ',
        },
        tags: {
          pcos: 'PCOS',
          pmdd: 'PMDD',
          endometriosis: 'Endometriosis',
        },
        validation: {
          alertTitle: 'Pick the basics to continue',
          goalsRequired: 'Choose at least one goal to tailor Floriva.',
          irregularCyclesRequired: 'Tell Floriva whether your cycle timing can vary.',
        },
      },
      ttcSetup: {
        eyebrow: 'Trying to conceive',
        title: 'Keep trying-to-conceive logging focused',
        description:
          'Choose the trying-to-conceive details you want ready on day one.',
        backLabel: 'Back',
        section: {
          title: 'Tracking preferences',
          body: 'Pick what Floriva should show when you log.',
        },
        chips: {
          sex: 'Sex',
          ovulationTest: 'Ovulation test',
          cervicalMucus: 'Cervical mucus',
          basalBodyTemperature: 'BBT',
        },
        helper:
          'These choices set up trying-to-conceive logging and reminders. Floriva stays focused on cycle tracking.',
      },
      ttcExpectations: {
        eyebrow: 'What to expect',
        title: 'How Floriva uses these choices',
        description:
          'This screen shows how Floriva uses your choices before you finish setup.',
        backLabel: 'Back',
        sections: {
          privateByDefault: {
            title: 'Private by default',
            body: 'Your trying-to-conceive preferences stay local on this device unless you choose to move them later.',
          },
          usedForTracking: {
            title: 'Used for tracking',
            body: 'Floriva uses these choices to keep daily logging and reminders relevant to your setup.',
          },
          estimatesOnly: {
            title: 'Estimates only',
            body: 'Floriva gives estimates and reminders. It does not diagnose or promise a timeline.',
          },
          currentSetup: {
            title: 'Current setup',
            body: 'Review the current trying-to-conceive choices before you continue.',
          },
        },
        summary: {
          disabled: 'Floriva will keep trying-to-conceive tracking off until you choose details to follow.',
          enabledPrefix: 'Floriva will remember: ',
          enabledSuffix: '.',
        },
        saving: 'Saving...',
        error: 'Unable to save trying-to-conceive setup.',
      },
      setupLater: {
        eyebrow: 'Set up later',
        title: 'Finish setup without the extras',
        description:
          'Go straight into Floriva now, then come back for any extras when you are ready. Nothing on this screen turns reminders, import, or biometrics on yet.',
        backLabel: 'Back',
        finishSetup: 'Finish setup',
        saving: 'Saving...',
        sections: {
          whatHappensAfterThis: {
            title: 'What happens after this',
            description: 'Your cycle basics and goals are ready to save when you finish setup. These are only optional next steps.',
            body: 'Finish setup opens the app immediately. Anything you leave for later stays off until you explicitly turn it on.',
          },
          reminders: {
            title: 'Reminders',
            body: 'Local reminders stay off until you explicitly revisit them.',
          },
          import: {
            title: 'Import from Clue or Flo',
            body: 'Import review can wait until you have your export file ready.',
          },
          biometricLock: {
            title: 'Biometric lock',
            body: 'Biometric unlock stays off until you decide to enable it.',
          },
        },
        choices: {
          remindersLater: {
            title: 'Remind me later',
            description:
              'Keep reminders off for now. You can turn them on later in Settings.',
          },
          remindersOff: {
            title: 'Keep reminders off',
            description: 'Leave reminders fully off until you decide you want them.',
          },
          importNow: {
            title: 'Open import next',
            description:
              'Open import right after setup to bring your old data in now.',
          },
          importLater: {
            title: 'Review import later',
            description:
              'Skip import for the moment and keep a reminder to review it later.',
          },
          importSkip: {
            title: 'Skip for now',
            description:
              'Do not queue import at all. You can still open it manually when you are ready.',
          },
          biometricsLater: {
            title: 'Review lock later',
            description:
              'Keep lock off for now. You can turn it on later once you are settled in.',
          },
          biometricsSkip: {
            title: 'Leave lock off',
            description:
              'Leave biometric lock disabled until you choose to turn it on yourself.',
          },
        },
        error: 'Setup did not finish. Try again.',
      },
    },
  },
  es: {
    onboarding: {
      shared: {
        selected: 'Seleccionado',
        invalidInput: 'Entrada no valida',
      },
      welcome: {
        eyebrow: 'Seguimiento del ciclo centrado en la privacidad',
        title: 'Floriva mantiene la configuración tranquila y privada.',
        body: 'Tus datos del ciclo permanecen en tu dispositivo a menos que decidas moverlos explícitamente.',
        startSetup: 'Empezar configuración',
        restoreFromBackup: 'Restaurar desde copia de seguridad',
        readPrivacyDetails: 'Leer detalles de privacidad',
        setupCard: {
          title: 'Configúralo en un minuto',
          body: 'Unos pocos datos básicos inician tu cronología. Importación, recordatorios y bloqueo pueden esperar a tu primera vista.',
        },
        storageCard: {
          title: 'Guardado en este dispositivo',
          body: 'El historial del ciclo, los síntomas y las notas se quedan en este dispositivo.',
        },
      },
      basics: {
        eyebrow: 'Datos básicos del ciclo',
        title: 'Define tu punto de partida diario',
        description:
          'Estos datos permanecen en tu dispositivo y ayudan a Floriva a mantener predicciones comprensibles, no demasiado seguras.',
        backLabel: 'Atrás',
        section: {
          title: 'Lo primero que necesita Floriva',
          body: 'Puedes ajustarlo más tarde en Ajustes. La fecha del último periodo ayuda a Floriva a ubicarte en tu ciclo enseguida.',
        },
        cycleLengthLabel: 'Duración del ciclo (días)',
        periodLengthLabel: 'Duración del periodo (días)',
        lastPeriodStartLabel: 'Inicio del último periodo',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD o 04/03/2026',
        quickPicksTitle: 'Selecciones rápidas',
        quickPicks: {
          today: 'Hoy',
          yesterday: 'Ayer',
          sevenDaysAgo: 'Hace 7 días',
          fourteenDaysAgo: 'Hace 14 días',
          twentyEightDaysAgo: 'Hace 28 días',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva empezará desde ',
          selectedSuffix: '.',
          empty: 'Elige la fecha más cercana o escribe el día exacto si lo sabes.',
        },
        privacyNote: {
          title: 'Nota de privacidad',
          body: 'Floriva no necesita una cuenta para recordar esta configuración.',
          detail:
            'Los datos básicos de tu ciclo permanecen en el dispositivo, a menos que decidas moverlos más tarde.',
          helper:
            'Floriva acepta `YYYY-MM-DD` o `MM/DD/YYYY`, y las selecciones rápidas pueden rellenar la fecha si no quieres escribirla.',
        },
        validation: {
          cycleLengthRequired: 'Introduce la duración habitual de tu ciclo.',
          cycleLengthRange: 'Introduce una duración entre 1 y 120 días.',
          periodLengthRange: 'Introduce una duración entre 1 y 30 días.',
          lastPeriodStartInvalid:
            'Introduce una fecha real. Floriva también acepta MM/DD/YYYY para este paso.',
          lastPeriodStartFuture: 'El inicio del último periodo no puede estar en el futuro.',
        },
      },
      goals: {
        eyebrow: 'Objetivos y condiciones',
        title: 'Ajusta Floriva al tipo de seguimiento que necesitas',
        description:
          'Elige los objetivos que Floriva debe priorizar primero y luego marca las plantillas con conciencia de condición que quieras listas desde el inicio.',
        backLabel: 'Atrás',
        section: {
          title: 'Objetivos de seguimiento',
          body: 'Elige al menos uno. Floriva se mantiene más tranquila cuando la primera pantalla sabe qué es lo más importante para ti.',
        },
        options: {
          period: {
            title: 'Seguimiento del periodo',
            description:
              'Mantén hoy, el próximo periodo y el calendario centrados en el ritmo del ciclo.',
          },
          symptoms: {
            title: 'Síntomas y estado de ánimo',
            description:
              'Incluye síntomas, estado de ánimo y contexto corporal diario en el flujo de registro desde el principio.',
          },
          tryingToConceive: {
            title: 'Buscando embarazo',
            description:
              'Añade registros específicos para buscar embarazo solo si los quieres, sin convertir el resto de la app en una aplicación de fertilidad.',
          },
        },
        irregularCycle: {
          title: 'Compatibilidad con ciclos irregulares',
          body: 'Dile a Floriva si tu ritmo puede variar para que las predicciones sean claras sobre sus límites.',
          yes: {
            title: 'Sí, puede variar',
            description:
              'Usa más incertidumbre en las predicciones y espera más variación entre ciclos.',
          },
          no: {
            title: 'No, suele ser estable',
            description:
              'Usa una base más estable al proyectar el próximo periodo y la ventana fértil.',
          },
        },
        conditions: {
          title: 'Plantillas adaptadas a condiciones',
          body: 'Las etiquetas opcionales mantienen relevantes las plantillas de registro sin convertir Floriva en un feed de contenido.',
        },
        footer: {
          helper: 'Las selecciones siguen visibles cerca de Continuar al desplazarte.',
          selectedGoalPrefix: 'Objetivo elegido: ',
        },
        tags: {
          pcos: 'SOP',
          pmdd: 'TDPM',
          endometriosis: 'Endometriosis',
        },
        validation: {
          alertTitle: 'Elige lo básico para continuar',
          goalsRequired: 'Elige al menos un objetivo para adaptar Floriva.',
          irregularCyclesRequired:
            'Indica a Floriva si el ritmo de tu ciclo puede variar.',
        },
      },
      ttcSetup: {
        eyebrow: 'Buscando embarazo',
        title: 'Mantén el seguimiento para concebir centrado',
        description:
          'Elige solo los detalles para buscar embarazo que quieres tener listos el primer día. Puedes editarlos más tarde en Ajustes.',
        backLabel: 'Atrás',
        section: {
          title: 'Preferencias de seguimiento',
          body: 'Elige los detalles que Floriva debe mostrar cuando registres algo. La configuración sigue siendo tranquila y totalmente local.',
        },
        chips: {
          sex: 'Sexo',
          ovulationTest: 'Test de ovulación',
          cervicalMucus: 'Moco cervical',
          basalBodyTemperature: 'Temp. basal',
        },
        helper:
          'Estas elecciones moldean el seguimiento para concebir y los recordatorios mientras Floriva sigue centrada en el ciclo.',
      },
      ttcExpectations: {
        eyebrow: 'Qué esperar',
        title: 'Para qué usa Floriva esto',
        description:
          'Este paso aclara cómo Floriva usará tus elecciones dentro del flujo para concebir.',
        backLabel: 'Atrás',
        sections: {
          privateByDefault: {
            title: 'Privado por defecto',
            body:
              'Tus preferencias para buscar embarazo se quedan localmente en este dispositivo a menos que decidas moverlas más tarde.',
          },
          usedForTracking: {
            title: 'Usado para el seguimiento',
            body: 'Floriva usa estas elecciones para mantener el registro diario y los recordatorios relevantes para tu configuración.',
          },
          estimatesOnly: {
            title: 'Solo estimaciones',
            body: 'Floriva ofrece estimaciones y recordatorios. No diagnostica ni promete un plazo.',
          },
          currentSetup: {
            title: 'Configuración actual',
            body: 'Revisa las elecciones actuales para buscar embarazo antes de continuar.',
          },
        },
        summary: {
          disabled:
            'Floriva mantendrá apagado el seguimiento para concebir hasta que elijas qué detalles seguir.',
          enabledPrefix: 'Floriva recordará: ',
          enabledSuffix: '.',
        },
        saving: 'Guardando...',
        error: 'No se pudo guardar la configuración de búsqueda de embarazo.',
      },
      setupLater: {
        eyebrow: 'Configurar más tarde',
        title: 'Termina la configuración sin extras',
        description:
          'Entra en Floriva ahora y vuelve a los extras cuando quieras. Nada en esta pantalla activa recordatorios, importación o biometría todavía.',
        backLabel: 'Atrás',
        finishSetup: 'Terminar configuración',
        saving: 'Guardando...',
        sections: {
          whatHappensAfterThis: {
            title: 'Qué pasa después',
            description:
              'Tus datos básicos y objetivos ya están listos para guardarse cuando termines la configuración. Son solo pasos opcionales.',
            body: 'Terminar la configuración abre la app de inmediato. Todo lo que dejes para después permanece desactivado hasta que lo actives explícitamente.',
          },
          reminders: {
            title: 'Recordatorios',
            body: 'Los recordatorios locales permanecen apagados hasta que los revises de nuevo de forma explícita.',
          },
          import: {
            title: 'Importar desde Clue o Flo',
            body: 'La revisión de importación puede esperar hasta que tengas listo tu archivo de exportación.',
          },
          biometricLock: {
            title: 'Bloqueo biométrico',
            body: 'El desbloqueo biométrico permanece apagado hasta que decidas activarlo.',
          },
        },
        choices: {
          remindersLater: {
            title: 'Recordármelo más tarde',
            description:
              'Mantén los recordatorios apagados por ahora, pero vuelve a mostrarlos más tarde en Ajustes.',
          },
          remindersOff: {
            title: 'Mantener recordatorios apagados',
            description: 'Deja los recordatorios completamente apagados hasta que quieras usarlos.',
          },
          importNow: {
            title: 'Abrir importación después',
            description:
              'Ve directo a la revisión de importación tras la configuración para traer ahora tu historial antiguo.',
          },
          importLater: {
            title: 'Revisar importación luego',
            description:
              'Sáltate la importación por ahora y deja un recordatorio para revisarla más tarde.',
          },
          importSkip: {
            title: 'Saltar por ahora',
            description:
              'No pongas la importación en cola. Aún podrás abrirla manualmente cuando estés lista.',
          },
          biometricsLater: {
            title: 'Revisar bloqueo luego',
            description:
              'Mantén el bloqueo apagado por ahora, pero vuelve a mostrar la opción cuando ya estés asentada.',
          },
          biometricsSkip: {
            title: 'Dejar bloqueo apagado',
            description:
              'Deja el bloqueo biométrico desactivado hasta que decidas activarlo tú misma.',
          },
        },
        error: 'No pudimos terminar la configuración. Inténtalo de nuevo.',
      },
    },
  },
  de: {
    onboarding: {
      shared: {
        selected: 'Ausgewählt',
        invalidInput: 'Ungültige Eingabe',
      },
      welcome: {
        eyebrow: 'Datenschutzorientierter Zyklus-Tracker',
        title: 'Floriva hält die Einrichtung ruhig und privat.',
        body: 'Deine Zyklusdaten bleiben auf deinem Gerät, solange du sie nicht ausdrücklich verschieben möchtest.',
        startSetup: 'Einrichtung starten',
        restoreFromBackup: 'Aus Sicherung wiederherstellen',
        readPrivacyDetails: 'Datenschutzdetails lesen',
        setupCard: {
          title: 'In etwa einer Minute eingerichtet',
          body: 'Ein paar Grundlagen legen deine Zeitlinie an. Import, Erinnerungen und Sperre können bis zum ersten Blick warten.',
        },
        storageCard: {
          title: 'Auf diesem Gerät gespeichert',
          body: 'Zyklusverlauf, Symptome und Notizen bleiben lokal auf diesem Gerät.',
        },
      },
      basics: {
        eyebrow: 'Zyklus-Grundlagen',
        title: 'Lege deinen täglichen Ausgangspunkt fest',
        description:
          'Diese Angaben bleiben auf deinem Gerät und helfen Floriva dabei, Vorhersagen nachvollziehbar statt zu selbstsicher zu halten.',
        backLabel: 'Zurück',
        section: {
          title: 'Was Floriva zuerst braucht',
          body: 'Du kannst das später in den Einstellungen anpassen. Der Beginn der letzten Periode hilft Floriva, dich sofort in deinen Zyklus einzuordnen.',
        },
        cycleLengthLabel: 'Zykluslänge (Tage)',
        periodLengthLabel: 'Periodenlänge (Tage)',
        lastPeriodStartLabel: 'Beginn der letzten Periode',
        lastPeriodStartPlaceholder: 'JJJJ-MM-TT oder 03.04.2026',
        quickPicksTitle: 'Schnellauswahl',
        quickPicks: {
          today: 'Heute',
          yesterday: 'Gestern',
          sevenDaysAgo: 'Vor 7 Tagen',
          fourteenDaysAgo: 'Vor 14 Tagen',
          twentyEightDaysAgo: 'Vor 28 Tagen',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva startet von ',
          selectedSuffix: ' aus.',
          empty: 'Wähle das Datum, das am nächsten liegt, oder tippe den genauen Tag ein, wenn du ihn kennst.',
        },
        privacyNote: {
          title: 'Hinweis zum Datenschutz',
          body: 'Floriva braucht kein Konto, um sich diese Einrichtung zu merken.',
          detail:
            'Deine Zyklus-Grundlagen bleiben auf dem Gerät, solange du sie nicht ausdrücklich später verschiebst.',
          helper:
            'Floriva akzeptiert `JJJJ-MM-TT` oder `TT.MM.JJJJ`, und Schnellauswahlen können das Datum eintragen, wenn du es nicht tippen möchtest.',
        },
        validation: {
          cycleLengthRequired: 'Gib deine übliche Zykluslänge ein.',
          cycleLengthRange: 'Gib eine Zykluslänge zwischen 1 und 120 Tagen ein.',
          periodLengthRange: 'Gib eine Periodenlänge zwischen 1 und 30 Tagen ein.',
          lastPeriodStartInvalid:
            'Gib ein echtes Datum ein. Floriva akzeptiert für diesen Schritt auch TT.MM.JJJJ.',
          lastPeriodStartFuture: 'Der Beginn der letzten Periode darf nicht in der Zukunft liegen.',
        },
      },
      goals: {
        eyebrow: 'Ziele und Bedingungen',
        title: 'Passe Floriva an die Art des Trackings an, die du brauchst',
        description:
          'Wähle zuerst die Ziele, die Floriva priorisieren soll, und markiere dann die zustandsbewussten Vorlagen, die von Anfang an bereit sein sollen.',
        backLabel: 'Zurück',
        section: {
          title: 'Tracking-Ziele',
          body: 'Wähle mindestens eines. Floriva bleibt ruhiger, wenn der erste Bildschirm weiß, was dir am wichtigsten ist.',
        },
        options: {
          period: {
            title: 'Perioden-Tracking',
            description:
              'Richte Heute, die nächste Periode und den Kalender am Rhythmus deines Zyklus aus.',
          },
          symptoms: {
            title: 'Symptome und Stimmung',
            description:
              'Bringe Symptome, Stimmung und täglichen Körperkontext von Anfang an in den Erfassungsfluss.',
          },
          tryingToConceive: {
            title: 'Kinderwunsch',
            description:
              'Füge Tracking für den Kinderwunsch nur hinzu, wenn du es möchtest, ohne den Rest der App in einen Fruchtbarkeitsmodus zu verwandeln.',
          },
        },
        irregularCycle: {
          title: 'Unterstützung für unregelmäßige Zyklen',
          body: 'Lass Floriva wissen, ob dein Timing variieren kann, damit Vorhersagen ihre Grenzen klar zeigen.',
          yes: {
            title: 'Ja, es kann variieren',
            description:
              'Nutze klarere Unsicherheit in Vorhersagen und erwarte stärkere Schwankungen von Zyklus zu Zyklus.',
          },
          no: {
            title: 'Nein, es ist meist stabil',
            description:
              'Nutze eine gleichmäßigere Grundlage für die nächste Periode und das fruchtbare Fenster.',
          },
        },
        conditions: {
          title: 'Zustandsbewusste Vorlagen',
          body: 'Optionale Tags halten spätere Erfassungsvorlagen relevant, ohne Floriva in einen Content-Feed zu verwandeln.',
        },
        footer: {
          helper: 'Deine Auswahl bleibt beim Weiter-Button sichtbar, wenn du nach unten gehst.',
          selectedGoalPrefix: 'Gewähltes Ziel: ',
        },
        tags: {
          pcos: 'PCOS',
          pmdd: 'PMDS',
          endometriosis: 'Endometriose',
        },
        validation: {
          alertTitle: 'Wähle die Grundlagen, um fortzufahren',
          goalsRequired: 'Wähle mindestens ein Ziel, um Floriva anzupassen.',
          irregularCyclesRequired:
            'Sag Floriva, ob dein Zyklustiming variieren kann.',
        },
      },
      ttcSetup: {
        eyebrow: 'Kinderwunsch',
        title: 'Halte das Kinderwunsch-Tracking fokussiert',
        description:
          'Wähle nur die Kinderwunsch-Details, die du am ersten Tag bereit haben möchtest. Du kannst sie später in den Einstellungen ändern.',
        backLabel: 'Zurück',
        section: {
          title: 'Tracking-Einstellungen',
          body: 'Wähle die Details, die Floriva beim Erfassen anzeigen soll. Die Einrichtung bleibt ruhig und vollständig lokal.',
        },
        chips: {
          sex: 'Sex',
          ovulationTest: 'Ovulationstest',
          cervicalMucus: 'Zervixschleim',
          basalBodyTemperature: 'BBT',
        },
        helper:
          'Diese Auswahl formt Kinderwunsch-Tracking und Erinnerungen, während Floriva ein ruhiger, privater Zyklustracker bleibt.',
      },
      ttcExpectations: {
        eyebrow: 'Was zu erwarten ist',
        title: 'Wofür Floriva das verwendet',
        description:
          'Dieser Schritt hält den Kinderwunsch-Fluss klar darüber, wie Floriva deine Auswahl nutzt.',
        backLabel: 'Zurück',
        sections: {
          privateByDefault: {
            title: 'Standardmäßig privat',
            body: 'Deine Kinderwunsch-Einstellungen bleiben lokal auf diesem Gerät, solange du sie nicht später verschiebst.',
          },
          usedForTracking: {
            title: 'Für das Tracking verwendet',
            body: 'Floriva nutzt diese Auswahl, um tägliche Erfassung und Erinnerungen passend zu deiner Einrichtung zu halten.',
          },
          estimatesOnly: {
            title: 'Nur Schätzungen',
            body: 'Floriva liefert Schätzungen und Erinnerungen. Es stellt keine Diagnose und verspricht keinen Zeitplan.',
          },
          currentSetup: {
            title: 'Aktuelle Einrichtung',
            body: 'Überprüfe die aktuellen Kinderwunsch-Optionen, bevor du fortfährst.',
          },
        },
        summary: {
          disabled:
            'Floriva lässt das Kinderwunsch-Tracking aus, bis du auswählst, welche Details verfolgt werden sollen.',
          enabledPrefix: 'Floriva merkt sich: ',
          enabledSuffix: '.',
        },
        saving: 'Wird gespeichert...',
        error: 'Die Kinderwunsch-Einrichtung konnte nicht gespeichert werden.',
      },
      setupLater: {
        eyebrow: 'Später einrichten',
        title: 'Schließe die Einrichtung ohne Extras ab',
        description:
          'Gehe jetzt direkt in Floriva und komme später für Extras zurück, wenn du bereit bist. Auf diesem Bildschirm werden Erinnerungen, Import oder Biometrie noch nicht aktiviert.',
        backLabel: 'Zurück',
        finishSetup: 'Einrichtung abschließen',
        saving: 'Wird gespeichert...',
        sections: {
          whatHappensAfterThis: {
            title: 'Was danach passiert',
            description:
              'Deine Zyklus-Grundlagen und Ziele sind bereit zum Speichern, wenn du die Einrichtung abschließt. Das sind nur optionale nächste Schritte.',
            body: 'Die Einrichtung abschließen öffnet die App sofort. Alles, was du für später lässt, bleibt aus, bis du es ausdrücklich aktivierst.',
          },
          reminders: {
            title: 'Erinnerungen',
            body: 'Lokale Erinnerungen bleiben aus, bis du sie ausdrücklich wieder aufrufst.',
          },
          import: {
            title: 'Import aus Clue oder Flo',
            body: 'Die Importprüfung kann warten, bis deine Exportdatei bereit ist.',
          },
          biometricLock: {
            title: 'Biometrische Sperre',
            body: 'Das biometrische Entsperren bleibt aus, bis du es aktivierst.',
          },
        },
        choices: {
          remindersLater: {
            title: 'Später erinnern',
            description:
              'Erinnerungen vorerst auslassen, aber später in den Einstellungen wieder anzeigen.',
          },
          remindersOff: {
            title: 'Erinnerungen aus lassen',
            description: 'Lass Erinnerungen vollständig aus, bis du sie wirklich möchtest.',
          },
          importNow: {
            title: 'Import als Nächstes öffnen',
            description:
              'Gehe direkt nach der Einrichtung zur Importprüfung, damit du alte Daten jetzt übernehmen kannst.',
          },
          importLater: {
            title: 'Import später prüfen',
            description:
              'Überspringe den Import vorerst und behalte eine Erinnerung dafür.',
          },
          importSkip: {
            title: 'Vorerst überspringen',
            description:
              'Lege den Import nicht in die Warteschlange. Du kannst ihn später manuell öffnen.',
          },
          biometricsLater: {
            title: 'Sperre später prüfen',
            description:
              'Lass die Sperre vorerst aus, aber zeige die Option erneut, wenn du dich eingelebt hast.',
          },
          biometricsSkip: {
            title: 'Sperre aus lassen',
            description:
              'Lass die biometrische Sperre deaktiviert, bis du sie selbst einschaltest.',
          },
        },
        error: 'Die Einrichtung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
      },
    },
  },
  fr: {
    onboarding: {
      shared: {
        selected: 'Sélectionné',
        invalidInput: 'Saisie invalide',
      },
      welcome: {
        eyebrow: 'Suivi des règles centré sur la vie privée',
        title: 'Floriva garde la configuration calme et privée.',
        body: 'Tes données de cycle restent sur ton appareil sauf si tu choisis explicitement de les déplacer.',
        startSetup: 'Commencer la configuration',
        restoreFromBackup: 'Restaurer depuis une sauvegarde',
        readPrivacyDetails: 'Lire les détails de confidentialité',
        setupCard: {
          title: 'Installé en une minute environ',
          body: "Quelques bases suffisent pour lancer ta chronologie. L’import, les rappels et le verrouillage peuvent attendre ta première vue.",
        },
        storageCard: {
          title: 'Stocké sur cet appareil',
          body: "L’historique du cycle, les symptômes et les notes restent locaux sur cet appareil.",
        },
      },
      basics: {
        eyebrow: 'Bases du cycle',
        title: 'Définis ton point de départ quotidien',
        description:
          'Ces informations restent sur ton appareil et aident Floriva à garder des prédictions compréhensibles, sans excès de confiance.',
        backLabel: 'Retour',
        section: {
          title: "Ce dont Floriva a d’abord besoin",
          body: 'Tu peux modifier cela plus tard dans les paramètres. Le début des dernières règles aide Floriva à te placer immédiatement dans ton cycle.',
        },
        cycleLengthLabel: 'Durée du cycle (jours)',
        periodLengthLabel: 'Durée des règles (jours)',
        lastPeriodStartLabel: 'Début des dernières règles',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD ou 04/03/2026',
        quickPicksTitle: 'Choix rapides',
        quickPicks: {
          today: "Aujourd'hui",
          yesterday: 'Hier',
          sevenDaysAgo: 'Il y a 7 jours',
          fourteenDaysAgo: 'Il y a 14 jours',
          twentyEightDaysAgo: 'Il y a 28 jours',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva commencera à partir du ',
          selectedSuffix: '.',
          empty: 'Choisis la date la plus proche ou saisis le jour exact si tu le connais.',
        },
        privacyNote: {
          title: 'Note de confidentialité',
          body: "Floriva n’a pas besoin de compte pour retenir cette configuration.",
          detail:
            "Tes bases de cycle restent sur l’appareil sauf si tu choisis explicitement de les déplacer plus tard.",
          helper:
            'Floriva accepte `YYYY-MM-DD` ou `MM/DD/YYYY`, et les choix rapides peuvent remplir la date si tu ne veux pas la saisir.',
        },
        validation: {
          cycleLengthRequired: 'Indique la durée habituelle de ton cycle.',
          cycleLengthRange: 'Indique une durée de cycle entre 1 et 120 jours.',
          periodLengthRange: 'Indique une durée de règles entre 1 et 30 jours.',
          lastPeriodStartInvalid:
            'Indique une vraie date. Floriva accepte aussi MM/DD/YYYY pour cette étape.',
          lastPeriodStartFuture: 'Le début des dernières règles ne peut pas être dans le futur.',
        },
      },
      goals: {
        eyebrow: 'Objectifs et conditions',
        title: 'Adapte Floriva au type de suivi dont tu as besoin',
        description:
          "Choisis d’abord les objectifs que Floriva doit prioriser, puis marque les modèles sensibles aux conditions que tu veux prêts dès le départ.",
        backLabel: 'Retour',
        section: {
          title: 'Objectifs de suivi',
          body: 'Choisis-en au moins un. Floriva reste plus calme quand le premier écran sait ce qui compte le plus pour toi.',
        },
        options: {
          period: {
            title: 'Suivi des règles',
            description:
              "Garde aujourd’hui, la prochaine période et le calendrier centrés sur le rythme du cycle.",
          },
          symptoms: {
            title: 'Symptômes et humeur',
            description:
              "Intègre les symptômes, l’humeur et le contexte corporel quotidien dans le flux de saisie dès le départ.",
          },
          tryingToConceive: {
            title: 'Projet bébé',
            description:
              "Ajoute un suivi projet bébé spécifique seulement si tu le veux, sans transformer le reste de l'application en mode fertilité.",
          },
        },
        irregularCycle: {
          title: 'Prise en charge des cycles irréguliers',
          body: 'Indique à Floriva si ton rythme peut varier afin que les prévisions restent claires sur leurs limites.',
          yes: {
            title: 'Oui, il peut varier',
            description:
              "Utilise une incertitude plus visible dans les prévisions et attends-toi à davantage de variation d’un cycle à l’autre.",
          },
          no: {
            title: 'Non, il est généralement stable',
            description:
              'Utilise une base plus régulière pour projeter la prochaine période et la fenêtre fertile.',
          },
        },
        conditions: {
          title: 'Modèles adaptés aux conditions',
          body: 'Des étiquettes facultatives gardent les modèles de saisie pertinents sans transformer Floriva en flux de contenu.',
        },
        footer: {
          helper: 'Vos choix restent visibles près de Continuer quand vous faites défiler.',
          selectedGoalPrefix: 'Objectif choisi : ',
        },
        tags: {
          pcos: 'SOPK',
          pmdd: 'TDPM',
          endometriosis: 'Endométriose',
        },
        validation: {
          alertTitle: 'Choisis les bases pour continuer',
          goalsRequired: 'Choisis au moins un objectif pour adapter Floriva.',
          irregularCyclesRequired:
            'Indique à Floriva si le rythme de ton cycle peut varier.',
        },
      },
      ttcSetup: {
        eyebrow: 'Projet bébé',
        title: 'Garde le suivi projet bébé ciblé',
        description:
          'Choisis seulement les détails du projet bébé que tu veux prêts dès le premier jour. Tu pourras les modifier plus tard dans les réglages.',
        backLabel: 'Retour',
        section: {
          title: 'Préférences de suivi',
          body: 'Choisis les détails que Floriva doit afficher lors de la saisie. La configuration reste calme et entièrement locale.',
        },
        chips: {
          sex: 'Sexe',
          ovulationTest: "Test d’ovulation",
          cervicalMucus: 'Glaire cervicale',
          basalBodyTemperature: 'TBC',
        },
        helper:
          'Ces choix façonnent le suivi projet bébé et les rappels pendant que Floriva reste centrée sur le cycle.',
      },
      ttcExpectations: {
        eyebrow: "À quoi t’attendre",
        title: 'À quoi Floriva sert cela',
        description:
          'Cette étape garde le flux projet bébé clair sur la façon dont Floriva utilisera tes choix.',
        backLabel: 'Retour',
        sections: {
          privateByDefault: {
            title: 'Privé par défaut',
            body: 'Tes préférences du projet bébé restent locales sur cet appareil sauf si tu choisis de les déplacer plus tard.',
          },
          usedForTracking: {
            title: 'Utilisé pour le suivi',
            body: 'Floriva utilise ces choix pour garder la saisie quotidienne et les rappels pertinents pour ta configuration.',
          },
          estimatesOnly: {
            title: 'Estimations seulement',
            body: 'Floriva fournit des estimations et des rappels. Elle ne diagnostique pas et ne promet pas de calendrier.',
          },
          currentSetup: {
            title: 'Configuration actuelle',
            body: 'Passe en revue les choix du projet bébé actuels avant de continuer.',
          },
        },
        summary: {
          disabled:
            "Floriva gardera le suivi projet bébé désactivé jusqu'à ce que tu choisisses les détails à suivre.",
          enabledPrefix: 'Floriva retiendra : ',
          enabledSuffix: '.',
        },
        saving: 'Enregistrement...',
        error: "Impossible d'enregistrer la configuration du projet bébé.",
      },
      setupLater: {
        eyebrow: 'Configurer plus tard',
        title: 'Termine la configuration sans les extras',
        description:
          "Va directement dans Floriva maintenant, puis reviens pour les extras quand tu seras prête. Rien sur cet écran n’active encore les rappels, l’import ou la biométrie.",
        backLabel: 'Retour',
        finishSetup: 'Terminer la configuration',
        saving: 'Enregistrement...',
        sections: {
          whatHappensAfterThis: {
            title: 'Ce qui se passe ensuite',
            description:
              'Tes bases de cycle et tes objectifs sont prêts à être enregistrés quand tu termines la configuration. Ce ne sont que des étapes optionnelles.',
            body: "Terminer la configuration ouvre l’application immédiatement. Tout ce que tu laisses pour plus tard reste désactivé jusqu’à ce que tu l’actives explicitement.",
          },
          reminders: {
            title: 'Rappels',
            body: "Les rappels locaux restent désactivés jusqu’à ce que tu les rouvres explicitement.",
          },
          import: {
            title: 'Importer depuis Clue ou Flo',
            body: "La revue d’import peut attendre que ton fichier d’export soit prêt.",
          },
          biometricLock: {
            title: 'Verrou biométrique',
            body: "Le déverrouillage biométrique reste désactivé jusqu’à ce que tu décides de l’activer.",
          },
        },
        choices: {
          remindersLater: {
            title: 'Me le rappeler plus tard',
            description:
              "Garde les rappels désactivés pour l’instant, mais fais-les réapparaître plus tard dans les réglages.",
          },
          remindersOff: {
            title: 'Laisser les rappels désactivés',
            description:
              "Laisse les rappels complètement désactivés jusqu’à ce que tu en aies envie.",
          },
          importNow: {
            title: "Ouvrir l’import ensuite",
            description:
              "Va directement à la revue d’import après la configuration pour récupérer ton ancien historique tout de suite.",
          },
          importLater: {
            title: "Revoir l’import plus tard",
            description:
              "Passe l’import pour le moment et garde un rappel pour le revoir plus tard.",
          },
          importSkip: {
            title: "Passer pour l’instant",
            description:
              "Ne mets pas l’import en file d’attente. Tu pourras toujours l’ouvrir manuellement quand tu seras prête.",
          },
          biometricsLater: {
            title: 'Revoir le verrou plus tard',
            description:
              "Garde le verrou désactivé pour l’instant, mais fais réapparaître l’option une fois installée.",
          },
          biometricsSkip: {
            title: 'Laisser le verrou désactivé',
            description:
              "Laisse le verrou biométrique désactivé jusqu’à ce que tu choisisses de l’activer toi-même.",
          },
        },
        error: "Nous n’avons pas pu terminer la configuration. Réessaie.",
      },
    },
  },
  ja: {
    onboarding: {
      shared: {
        selected: '選択済み',
        invalidInput: '入力が無効です',
      },
      welcome: {
        eyebrow: 'プライバシー重視の生理周期トラッカー',
        title: 'Floriva は、静かでプライベートな設定体験を提供します。',
        body: 'あなたの周期データは、明示的に移動を選ばない限り端末内に残ります。',
        startSetup: '設定を始める',
        restoreFromBackup: 'バックアップから復元',
        readPrivacyDetails: 'プライバシーの詳細を見る',
        setupCard: {
          title: '約1分で設定できます',
          body: 'いくつかの基本情報でタイムラインを始められます。インポート、リマインダー、ロックは最初の確認のあとでかまいません。',
        },
        storageCard: {
          title: 'この端末に保存',
          body: '周期履歴、症状、メモはこの端末にローカル保存されます。',
        },
      },
      basics: {
        eyebrow: '周期の基本情報',
        title: '毎日の起点を設定する',
        description:
          'これらの情報は端末内に残り、Floriva が予測を過信しすぎず、わかりやすく保つのに役立ちます。',
        backLabel: '戻る',
        section: {
          title: 'まず Floriva が必要なもの',
          body: 'あとから設定で変更できます。前回の生理開始日は、今すぐあなたの周期を把握するのに役立ちます。',
        },
        cycleLengthLabel: '周期の長さ（日）',
        periodLengthLabel: '生理期間の長さ（日）',
        lastPeriodStartLabel: '前回の生理開始日',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD または 04/03/2026',
        quickPicksTitle: 'クイック選択',
        quickPicks: {
          today: '今日',
          yesterday: '昨日',
          sevenDaysAgo: '7日前',
          fourteenDaysAgo: '14日前',
          twentyEightDaysAgo: '28日前',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva は ',
          selectedSuffix: ' から始めます。',
          empty: '近い日付を選ぶか、わかるなら正確な日付を入力してください。',
        },
        privacyNote: {
          title: 'プライバシー注意',
          body: 'この設定を覚えるのにアカウントは必要ありません。',
          detail: '周期の基本情報は、あとで明示的に移動しない限り端末内に残ります。',
          helper:
            'Floriva は `YYYY-MM-DD` と `MM/DD/YYYY` のどちらも受け付け、入力したくない場合はクイック選択で日付を入れられます。',
        },
        validation: {
          cycleLengthRequired: 'いつもの周期の長さを入力してください。',
          cycleLengthRange: '1日から120日の範囲で周期の長さを入力してください。',
          periodLengthRange: '1日から30日の範囲で生理期間の長さを入力してください。',
          lastPeriodStartInvalid:
            '正しい日付を入力してください。この手順では MM/DD/YYYY も使えます。',
          lastPeriodStartFuture: '前回の生理開始日は未来の日付にできません。',
        },
      },
      goals: {
        eyebrow: '目的と状態',
        title: '必要な記録の種類に合わせて Floriva を整える',
        description:
          '最初に優先したい目的を選び、必要なら状態に配慮したテンプレートも最初から用意しておきましょう。',
        backLabel: '戻る',
        section: {
          title: '記録の目的',
          body: '少なくとも1つ選んでください。最初の画面が何を大切にするか分かると、Floriva は落ち着いて動けます。',
        },
        options: {
          period: {
            title: '生理記録',
            description:
              '今日・次回の生理・カレンダーを周期のリズムに合わせて見やすくします。',
          },
          symptoms: {
            title: '症状と気分',
            description:
              '症状、気分、日々の体調メモを最初から記録フローに取り入れます。',
          },
          tryingToConceive: {
            title: '妊活',
            description:
              '必要なときだけ妊活専用の記録を追加し、アプリ全体を妊娠向けに変えません。',
          },
        },
        irregularCycle: {
          title: '不規則周期のサポート',
          body: '周期が変わることがあるかを教えてください。予測の限界をわかりやすくできます。',
          yes: {
            title: 'はい、変わることがあります',
            description:
              '予測の不確実さをより明確にし、周期ごとの幅を広めに見込みます。',
          },
          no: {
            title: 'いいえ、だいたい安定しています',
            description:
              '次の生理や排卵期の予測に、より安定した基準を使います。',
          },
        },
        conditions: {
          title: '状態に配慮したテンプレート',
          body: '任意のタグで、Floriva をコンテンツフィードのようにせずに後続の記録テンプレートを整えられます。',
        },
        footer: {
          helper: '下に進んでも「続ける」の近くに選択内容を表示します。',
          selectedGoalPrefix: '選択中の目的: ',
        },
        tags: {
          pcos: 'PCOS',
          pmdd: 'PMDD',
          endometriosis: '子宮内膜症',
        },
        validation: {
          alertTitle: '続けるために基本情報を選んでください',
          goalsRequired: 'Floriva を調整するために、少なくとも1つ目的を選んでください。',
          irregularCyclesRequired:
            '周期が変わることがあるか、Floriva に伝えてください。',
        },
      },
      ttcSetup: {
        eyebrow: '妊活',
        title: '妊活の記録をシンプルに保つ',
        description:
          '初日に必要な妊活の項目だけを選んでください。あとで設定から変更できます。',
        backLabel: '戻る',
        section: {
          title: '記録の設定',
          body: '記録時に Floriva が表示する項目を選びます。設定は落ち着いていて、すべて端末内で完結します。',
        },
        chips: {
          sex: '性行為',
          ovulationTest: '排卵検査薬',
          cervicalMucus: '子宮頸管粘液',
          basalBodyTemperature: '基礎体温',
        },
        helper:
          'これらの選択は妊活の記録とリマインダーを形作りますが、Floriva は落ち着いたプライベートなサイクルトラッカーであり続けます。',
      },
      ttcExpectations: {
        eyebrow: '予想されること',
        title: 'Floriva がこれをどう使うか',
        description:
          'この手順で、妊活フローにおける Floriva の使い方を明確にします。',
        backLabel: '戻る',
        sections: {
          privateByDefault: {
            title: '既定で非公開',
            body: '妊活の設定は、あとで移すことを選ばない限りこの端末内に残ります。',
          },
          usedForTracking: {
            title: '記録に使用',
            body: 'Floriva はこれらの選択を使って、日々の記録とリマインダーを設定に合うようにします。',
          },
          estimatesOnly: {
            title: 'あくまで予測',
            body: 'Floriva は予測とリマインダーを出します。診断も期間の約束もしません。',
          },
          currentSetup: {
            title: '現在の設定',
            body: '続ける前に、現在の妊活の選択を確認してください。',
          },
        },
        summary: {
          disabled: '詳細を選ぶまで、Floriva は妊活の記録をオフにします。',
          enabledPrefix: 'Floriva は次を覚えます: ',
          enabledSuffix: '。',
        },
        saving: '保存中...',
        error: '妊活の設定を保存できませんでした。',
      },
      setupLater: {
        eyebrow: 'あとで設定',
        title: '追加項目なしで設定を終える',
        description:
          'まず Floriva を使い始めて、必要になったらあとで追加項目に戻ってきてください。この画面では、リマインダー・インポート・生体認証はまだ有効になりません。',
        backLabel: '戻る',
        finishSetup: '設定を完了する',
        saving: '保存中...',
        sections: {
          whatHappensAfterThis: {
            title: 'このあとどうなるか',
            description:
              '設定を終えると、周期の基本情報と目的を保存する準備が整います。これはあくまで任意の次のステップです。',
            body: '設定を完了するとすぐにアプリが開きます。あとでにした項目は、明示的にオンにするまでオフのままです。',
          },
          reminders: {
            title: 'リマインダー',
            body: 'ローカルのリマインダーは、明示的に見直すまでオフのままです。',
          },
          import: {
            title: 'Clue または Flo からのインポート',
            body: 'インポートの確認は、エクスポートファイルが用意できてからでかまいません。',
          },
          biometricLock: {
            title: '生体認証ロック',
            body: '有効にするまで、生体認証による解除はオフのままです。',
          },
        },
        choices: {
          remindersLater: {
            title: 'あとで通知',
            description: '今はリマインダーをオフにし、あとで設定から再表示します。',
          },
          remindersOff: {
            title: 'リマインダーをオフ',
            description: '使いたくなるまで、リマインダーは完全にオフのままにします。',
          },
          importNow: {
            title: '次にインポートを開く',
            description:
              '設定後すぐにインポート確認へ進み、古い履歴を今取り込めます。',
          },
          importLater: {
            title: 'インポートはあとで確認',
            description: '今はインポートを飛ばし、あとで確認するようにします。',
          },
          importSkip: {
            title: '今回はスキップ',
            description:
              'インポートは待機列に入れません。準備ができたら手動で開けます。',
          },
          biometricsLater: {
            title: 'ロックはあとで確認',
            description:
              '今はロックをオフにし、落ち着いたあとで再び選べるようにします。',
          },
          biometricsSkip: {
            title: 'ロックをオフのまま',
            description:
              '自分でオンにするまで、生体認証ロックは無効のままにします。',
          },
        },
        error: '設定を完了できませんでした。もう一度お試しください。',
      },
    },
  },
  'zh-Hans': {
    onboarding: {
      shared: {
        selected: '已选中',
        invalidInput: '输入无效',
      },
      welcome: {
        eyebrow: '隐私优先的经期追踪器',
        title: 'Floriva 让设置保持安静且私密。',
        body: '除非你明确选择迁移，周期数据都会保留在你的设备上。',
        startSetup: '开始设置',
        restoreFromBackup: '从备份恢复',
        readPrivacyDetails: '查看隐私详情',
        setupCard: {
          title: '约一分钟即可完成设置',
          body: '几个基础信息就能建立你的时间线。导入、提醒和锁定都可以先放到第一次查看之后。',
        },
        storageCard: {
          title: '保存在此设备上',
          body: '周期历史、症状和备注都会留在本地设备上。',
        },
      },
      basics: {
        eyebrow: '周期基础',
        title: '设置你的日常起点',
        description:
          '这些信息会保留在你的设备上，帮助 Floriva 给出更易懂、不过度自信的预测。',
        backLabel: '返回',
        section: {
          title: 'Floriva 先需要这些信息',
          body: '你以后可以在设置中调整。上次月经开始日期能帮助 Floriva 立即把你放入当前周期。',
        },
        cycleLengthLabel: '周期长度（天）',
        periodLengthLabel: '月经长度（天）',
        lastPeriodStartLabel: '上次月经开始日期',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD 或 04/03/2026',
        quickPicksTitle: '快捷选择',
        quickPicks: {
          today: '今天',
          yesterday: '昨天',
          sevenDaysAgo: '7 天前',
          fourteenDaysAgo: '14 天前',
          twentyEightDaysAgo: '28 天前',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva 将从 ',
          selectedSuffix: ' 开始计算。',
          empty: '选择最接近的日期，或者如果你知道准确日期也可以直接输入。',
        },
        privacyNote: {
          title: '隐私说明',
          body: 'Floriva 不需要账号也能记住这套设置。',
          detail: '除非你明确选择迁移，否则周期基础信息会保留在设备上。',
          helper:
            'Floriva 接受 `YYYY-MM-DD` 或 `MM/DD/YYYY`，如果你不想手动输入，也可以用快捷选择填入日期。',
        },
        validation: {
          cycleLengthRequired: '请输入你平时的周期长度。',
          cycleLengthRange: '请输入 1 到 120 天之间的周期长度。',
          periodLengthRange: '请输入 1 到 30 天之间的月经长度。',
          lastPeriodStartInvalid:
            '请输入一个真实日期。此步骤也接受 MM/DD/YYYY。',
          lastPeriodStartFuture: '上次月经开始日期不能是未来日期。',
        },
      },
      goals: {
        eyebrow: '目标与情况',
        title: '根据你需要的追踪方式来调整 Floriva',
        description:
          '先选择 Floriva 应该优先的目标，再标记你希望从一开始就准备好的、考虑特定情况的模板。',
        backLabel: '返回',
        section: {
          title: '追踪目标',
          body: '至少选择一个。第一屏知道你最在意什么时，Floriva 会更从容。',
        },
        options: {
          period: {
            title: '经期追踪',
            description:
              '让今天、下次月经时间和日历都聚焦在周期节奏上。',
          },
          symptoms: {
            title: '症状和情绪',
            description:
              '从一开始就把症状、情绪和每天的身体状态带入记录流程。',
          },
          tryingToConceive: {
            title: '备孕',
            description:
              '只在你需要时添加备孕专用记录，而不会把整个应用变成生育模式。',
          },
        },
        irregularCycle: {
          title: '不规则周期支持',
          body: '告诉 Floriva 你的周期是否会变化，这样预测就能清楚说明自己的局限。',
          yes: {
            title: '是，会变化',
            description:
              '在预测中使用更明确的不确定性，并预期周期之间会有更大波动。',
          },
          no: {
            title: '否，通常比较稳定',
            description:
              '在预测下次月经和排卵期时使用更稳定的基线。',
          },
        },
        conditions: {
          title: '考虑特定情况的模板',
          body: '可选标签能让后续记录模板保持相关性，而不会把 Floriva 变成内容流。',
        },
        footer: {
          helper: '向下浏览时，所选内容会继续显示在“继续”附近。',
          selectedGoalPrefix: '已选目标：',
        },
        tags: {
          pcos: '多囊卵巢综合征',
          pmdd: '经前烦躁障碍',
          endometriosis: '子宫内膜异位症',
        },
        validation: {
          alertTitle: '选择基础信息后继续',
          goalsRequired: '请至少选择一个目标来定制 Floriva。',
          irregularCyclesRequired:
            '请告诉 Floriva 你的周期是否会变化。',
        },
      },
      ttcSetup: {
        eyebrow: '备孕',
        title: '让备孕记录保持聚焦',
        description:
          '只选择你希望在第一天就准备好的备孕细节。以后可以在设置中修改。',
        backLabel: '返回',
        section: {
          title: '记录偏好',
          body: '选择 Floriva 在你记录时应展示的内容。整个设置保持安静，并且完全本地化。',
        },
        chips: {
          sex: '性生活',
          ovulationTest: '排卵试纸',
          cervicalMucus: '宫颈黏液',
          basalBodyTemperature: '基础体温',
        },
        helper:
          '这些选择会影响备孕记录和提醒，而 Floriva 始终保持平静、私密的周期追踪应用定位。',
      },
      ttcExpectations: {
        eyebrow: '你会看到什么',
        title: 'Floriva 会如何使用这些信息',
        description:
          '这一步能让备孕流程清楚说明 Floriva 会如何使用你的选择。',
        backLabel: '返回',
        sections: {
          privateByDefault: {
            title: '默认私密',
            body: '除非你以后选择迁移，这些备孕偏好都会保留在这台设备上。',
          },
          usedForTracking: {
            title: '用于追踪',
            body: 'Floriva 会用这些选择让日常记录和提醒更符合你的设置。',
          },
          estimatesOnly: {
            title: '仅作估计',
            body: 'Floriva 只提供估计和提醒，不会诊断，也不会承诺时间表。',
          },
          currentSetup: {
            title: '当前设置',
            body: '继续之前，请先查看当前的备孕选择。',
          },
        },
        summary: {
          disabled: '在你选择要跟踪的内容之前，Floriva 会保持备孕记录关闭。',
          enabledPrefix: 'Floriva 会记住：',
          enabledSuffix: '。',
        },
        saving: '保存中...',
        error: '无法保存备孕设置。',
      },
      setupLater: {
        eyebrow: '稍后设置',
        title: '不启用额外功能就完成设置',
        description:
          '现在直接进入 Floriva，等你准备好时再回来开启额外功能。此屏幕不会提前启用提醒、导入或生物识别。',
        backLabel: '返回',
        finishSetup: '完成设置',
        saving: '保存中...',
        sections: {
          whatHappensAfterThis: {
            title: '之后会发生什么',
            description:
              '当你完成设置时，周期基础信息和目标就已经准备好保存了。这些都只是可选的下一步。',
            body: '完成设置会立即打开应用。你留到以后再开的内容，都会保持关闭，直到你明确启用。',
          },
          reminders: {
            title: '提醒',
            body: '本地提醒会保持关闭，直到你明确回来重新设置。',
          },
          import: {
            title: '从 Clue 或 Flo 导入',
            body: '等你准备好导出文件后，再来查看导入也可以。',
          },
          biometricLock: {
            title: '生物识别锁',
            body: '在你决定启用之前，生物识别解锁会一直关闭。',
          },
        },
        choices: {
          remindersLater: {
            title: '以后提醒我',
            description: '先关闭提醒，但以后可以在设置中再次显示。',
          },
          remindersOff: {
            title: '保持提醒关闭',
            description: '在你自己决定之前，提醒完全保持关闭。',
          },
          importNow: {
            title: '下一步打开导入',
            description: '设置完成后直接进入导入审核，现在就把旧历史带进来。',
          },
          importLater: {
            title: '以后再看导入',
            description: '先跳过导入，并保留一个稍后查看的提醒。',
          },
          importSkip: {
            title: '暂时跳过',
            description: '现在不把导入加入队列。准备好时你仍可手动打开。',
          },
          biometricsLater: {
            title: '以后再看锁定',
            description: '现在先关闭锁定，等你安顿好后再显示这个选项。',
          },
          biometricsSkip: {
            title: '保持锁定关闭',
            description: '在你自己开启之前，生物识别锁保持禁用。',
          },
        },
        error: '我们没能完成设置。请再试一次。',
      },
    },
  },
  pt: {
    onboarding: {
      shared: {
        selected: 'Selecionado',
        invalidInput: 'Entrada inválida',
      },
      welcome: {
        eyebrow: 'Rastreador de ciclo com privacidade em primeiro lugar',
        title: 'O Floriva mantém a configuração calma e privada.',
        body: 'Seus dados de ciclo ficam no seu dispositivo, a menos que você escolha explicitamente movê-los.',
        startSetup: 'Iniciar configuração',
        restoreFromBackup: 'Restaurar do backup',
        readPrivacyDetails: 'Ler detalhes de privacidade',
        setupCard: {
          title: 'Configure em cerca de um minuto',
          body: 'Algumas noções básicas já iniciam sua linha do tempo. Importação, lembretes e bloqueio podem esperar até sua primeira olhada.',
        },
        storageCard: {
          title: 'Armazenado neste dispositivo',
          body: 'Histórico do ciclo, sintomas e notas permanecem locais neste dispositivo.',
        },
      },
      basics: {
        eyebrow: 'Noções básicas do ciclo',
        title: 'Defina seu ponto de partida diário',
        description:
          'Esses dados ficam no seu dispositivo e ajudam o Floriva a manter as previsões compreensíveis, sem excesso de confiança.',
        backLabel: 'Voltar',
        section: {
          title: 'O que o Floriva precisa primeiro',
          body: 'Você pode ajustar isso depois em Configurações. O início da última menstruação ajuda o Floriva a situar você no ciclo imediatamente.',
        },
        cycleLengthLabel: 'Duração do ciclo (dias)',
        periodLengthLabel: 'Duração da menstruação (dias)',
        lastPeriodStartLabel: 'Início da última menstruação',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD ou 04/03/2026',
        quickPicksTitle: 'Seleções rápidas',
        quickPicks: {
          today: 'Hoje',
          yesterday: 'Ontem',
          sevenDaysAgo: 'Há 7 dias',
          fourteenDaysAgo: 'Há 14 dias',
          twentyEightDaysAgo: 'Há 28 dias',
        },
        quickPickHint: {
          selectedPrefix: 'O Floriva vai começar em ',
          selectedSuffix: '.',
          empty: 'Escolha a data mais próxima ou digite o dia exato se souber.',
        },
        privacyNote: {
          title: 'Nota de privacidade',
          body: 'O Floriva não precisa de conta para lembrar desta configuração.',
          detail:
            'Os dados básicos do ciclo permanecem no dispositivo, a menos que você escolha movê-los depois.',
          helper:
            'O Floriva aceita `YYYY-MM-DD` ou `MM/DD/YYYY`, e as seleções rápidas podem preencher a data se você não quiser digitar.',
        },
        validation: {
          cycleLengthRequired: 'Digite a duração usual do seu ciclo.',
          cycleLengthRange: 'Digite uma duração de ciclo entre 1 e 120 dias.',
          periodLengthRange: 'Digite uma duração de menstruação entre 1 e 30 dias.',
          lastPeriodStartInvalid:
            'Digite uma data real. O Floriva também aceita MM/DD/YYYY nesta etapa.',
          lastPeriodStartFuture: 'O início da última menstruação não pode estar no futuro.',
        },
      },
      goals: {
        eyebrow: 'Objetivos e condições',
        title: 'Adapte o Floriva ao tipo de acompanhamento que você precisa',
        description:
          'Escolha primeiro os objetivos que o Floriva deve priorizar e depois marque os modelos sensíveis a condições que deseja prontos desde o início.',
        backLabel: 'Voltar',
        section: {
          title: 'Objetivos de acompanhamento',
          body: 'Escolha pelo menos um. O Floriva fica mais tranquilo quando a primeira tela sabe o que mais importa para você.',
        },
        options: {
          period: {
            title: 'Acompanhamento menstrual',
            description:
              'Mantenha hoje, o próximo período e o calendário focados no ritmo do ciclo.',
          },
          symptoms: {
            title: 'Sintomas e humor',
            description:
              'Registre sintomas, humor e notas diárias desde o primeiro dia.',
          },
          tryingToConceive: {
            title: 'Tentando engravidar',
            description:
              'Adicione registros específicos de tentativa de conceção apenas se quiser, sem transformar o restante do app em um modo de fertilidade.',
          },
        },
        irregularCycle: {
          title: 'Suporte para ciclos irregulares',
          body: 'Diga ao Floriva se seu timing pode variar para que as previsões deixem claros os limites.',
          yes: {
            title: 'Sim, pode variar',
            description:
              'Use uma incerteza mais clara nas previsões e espere maior variação de ciclo para ciclo.',
          },
          no: {
            title: 'Não, costuma ser estável',
            description:
              'Use uma base mais estável ao projetar o próximo período e a janela fértil.',
          },
        },
        conditions: {
          title: 'Modelos com consciência de condições',
          body: 'Tags opcionais mantêm os modelos de registro relevantes sem transformar o Floriva em um feed de conteúdo.',
        },
        footer: {
          helper: 'As seleções continuam visíveis perto de Continuar enquanto você desce.',
          selectedGoalPrefix: 'Objetivo selecionado: ',
        },
        tags: {
          pcos: 'SOP',
          pmdd: 'TDPM',
          endometriosis: 'Endometriose',
        },
        validation: {
          alertTitle: 'Escolha o básico para continuar',
          goalsRequired: 'Escolha ao menos um objetivo para adaptar o Floriva.',
          irregularCyclesRequired:
            'Diga ao Floriva se o timing do seu ciclo pode variar.',
        },
      },
      ttcSetup: {
        eyebrow: 'Tentando engravidar',
        title: 'Mantenha o registro de tentativa de conceção focado',
        description:
          'Escolha apenas os detalhes de tentativa de conceção que você quer prontos no primeiro dia. Você pode editá-los depois em Configurações.',
        backLabel: 'Voltar',
        section: {
          title: 'Preferências de acompanhamento',
          body: 'Escolha os detalhes que o Floriva deve mostrar ao registrar. A configuração continua calma e totalmente local.',
        },
        chips: {
          sex: 'Sexo',
          ovulationTest: 'Teste de ovulação',
          cervicalMucus: 'Muco cervical',
          basalBodyTemperature: 'TBB',
        },
        helper:
          'Essas escolhas moldam o registro de tentativa de conceção e os lembretes enquanto o Floriva continua focado no ciclo.',
      },
      ttcExpectations: {
        eyebrow: 'O que esperar',
        title: 'Para que o Floriva usa isso',
        description:
          'Esta etapa deixa o fluxo de tentativa de conceção claro sobre como o Floriva usará suas escolhas.',
        backLabel: 'Voltar',
        sections: {
          privateByDefault: {
            title: 'Privado por padrão',
            body: 'Suas preferências de tentativa de conceção permanecem locais neste dispositivo, a menos que você escolha movê-las depois.',
          },
          usedForTracking: {
            title: 'Usado para acompanhamento',
            body: 'O Floriva usa essas escolhas para manter o registro diário e os lembretes relevantes para sua configuração.',
          },
          estimatesOnly: {
            title: 'Apenas estimativas',
            body: 'O Floriva fornece estimativas e lembretes. Ele não diagnostica nem promete um prazo.',
          },
          currentSetup: {
            title: 'Configuração atual',
            body: 'Revise as escolhas de tentativa de conceção atuais antes de continuar.',
          },
        },
        summary: {
          disabled: 'O Floriva manterá a tentativa de conceção desligada até você escolher os detalhes a acompanhar.',
          enabledPrefix: 'O Floriva vai lembrar: ',
          enabledSuffix: '.',
        },
        saving: 'Salvando...',
        error: 'Não foi possível salvar a configuração de tentativa de conceção.',
      },
      setupLater: {
        eyebrow: 'Configurar depois',
        title: 'Conclua a configuração sem os extras',
        description:
          'Entre no Floriva agora e volte aos extras quando estiver pronta. Nada nesta tela ativa lembretes, importação ou biometria ainda.',
        backLabel: 'Voltar',
        finishSetup: 'Concluir configuração',
        saving: 'Salvando...',
        sections: {
          whatHappensAfterThis: {
            title: 'O que acontece depois',
            description:
              'Seus dados básicos e objetivos já estarão prontos para salvar quando você concluir a configuração. São apenas próximos passos opcionais.',
            body: 'Concluir a configuração abre o app imediatamente. Tudo o que você deixar para depois permanece desligado até ativar explicitamente.',
          },
          reminders: {
            title: 'Lembretes',
            body: 'Os lembretes locais ficam desligados até você revisitá-los explicitamente.',
          },
          import: {
            title: 'Importar do Clue ou Flo',
            body: 'A revisão da importação pode esperar até você ter o arquivo de exportação pronto.',
          },
          biometricLock: {
            title: 'Bloqueio biométrico',
            body: 'O desbloqueio biométrico permanece desligado até você decidir ativá-lo.',
          },
        },
        choices: {
          remindersLater: {
            title: 'Lembrar depois',
            description:
              'Mantenha os lembretes desligados por enquanto, mas mostre isso novamente mais tarde em Configurações.',
          },
          remindersOff: {
            title: 'Manter lembretes desligados',
            description: 'Deixe os lembretes totalmente desligados até decidir usá-los.',
          },
          importNow: {
            title: 'Abrir importação em seguida',
            description:
              'Vá direto para a revisão de importação após a configuração para trazer o histórico antigo agora.',
          },
          importLater: {
            title: 'Revisar importação depois',
            description:
              'Pule a importação por enquanto e mantenha um lembrete para revisá-la depois.',
          },
          importSkip: {
            title: 'Pular por enquanto',
            description:
              'Não coloque a importação na fila. Você ainda poderá abri-la manualmente quando estiver pronta.',
          },
          biometricsLater: {
            title: 'Revisar bloqueio depois',
            description:
              'Mantenha o bloqueio desligado por enquanto, mas mostre a opção novamente quando você já estiver estabelecida.',
          },
          biometricsSkip: {
            title: 'Deixar bloqueio desligado',
            description:
              'Deixe o bloqueio biométrico desativado até você decidir ativá-lo sozinha.',
          },
        },
        error: 'Não conseguimos concluir a configuração. Tente novamente.',
      },
    },
  },
  ru: {
    onboarding: {
      shared: {
        selected: 'Выбрано',
        invalidInput: 'Неверный ввод',
      },
      welcome: {
        eyebrow: 'Трекер цикла с приоритетом приватности',
        title: 'Floriva делает настройку спокойной и приватной.',
        body: 'Данные о цикле остаются на вашем устройстве, если вы явно не решите их перенести.',
        startSetup: 'Начать настройку',
        restoreFromBackup: 'Восстановить из резервной копии',
        readPrivacyDetails: 'Открыть сведения о приватности',
        setupCard: {
          title: 'Настройка занимает около минуты',
          body: 'Нескольких базовых сведений достаточно, чтобы запустить вашу временную линию. Импорт, напоминания и блокировка могут подождать первого просмотра.',
        },
        storageCard: {
          title: 'Хранится на этом устройстве',
          body: 'История цикла, симптомы и заметки остаются локально на этом устройстве.',
        },
      },
      basics: {
        eyebrow: 'Базовые данные цикла',
        title: 'Задайте ежедневную точку отсчёта',
        description:
          'Эти данные остаются на вашем устройстве и помогают Floriva делать прогнозы понятными, а не чрезмерно уверенными.',
        backLabel: 'Назад',
        section: {
          title: 'Что нужно Floriva сначала',
          body: 'Вы сможете изменить это позже в настройках. Дата начала последней менструации помогает Floriva сразу определить ваш цикл.',
        },
        cycleLengthLabel: 'Длина цикла (дни)',
        periodLengthLabel: 'Длительность менструации (дни)',
        lastPeriodStartLabel: 'Начало последней менструации',
        lastPeriodStartPlaceholder: 'YYYY-MM-DD или 04/03/2026',
        quickPicksTitle: 'Быстрый выбор',
        quickPicks: {
          today: 'Сегодня',
          yesterday: 'Вчера',
          sevenDaysAgo: '7 дней назад',
          fourteenDaysAgo: '14 дней назад',
          twentyEightDaysAgo: '28 дней назад',
        },
        quickPickHint: {
          selectedPrefix: 'Floriva начнёт с ',
          selectedSuffix: '.',
          empty: 'Выберите ближайшую дату или введите точный день, если знаете его.',
        },
        privacyNote: {
          title: 'Примечание о приватности',
          body: 'Floriva не нужен аккаунт, чтобы запомнить эту настройку.',
          detail:
            'Базовые данные о цикле остаются на устройстве, если вы явно не решите перенести их позже.',
          helper:
            'Floriva принимает `YYYY-MM-DD` или `MM/DD/YYYY`, а быстрый выбор может подставить дату, если вы не хотите печатать её вручную.',
        },
        validation: {
          cycleLengthRequired: 'Введите обычную длину вашего цикла.',
          cycleLengthRange: 'Введите длину цикла от 1 до 120 дней.',
          periodLengthRange: 'Введите длительность менструации от 1 до 30 дней.',
          lastPeriodStartInvalid:
            'Введите настоящую дату. Для этого шага Floriva также принимает MM/DD/YYYY.',
          lastPeriodStartFuture: 'Начало последней менструации не может быть в будущем.',
        },
      },
      goals: {
        eyebrow: 'Цели и состояния',
        title: 'Настройте Floriva под тот вид отслеживания, который вам нужен',
        description:
          'Сначала выберите цели, которые Floriva должна поставить в приоритет, а затем отметьте шаблоны с учётом состояния, которые должны быть готовы с самого начала.',
        backLabel: 'Назад',
        section: {
          title: 'Цели отслеживания',
          body: 'Выберите хотя бы одну. Floriva спокойнее, когда первый экран знает, что для вас важнее всего.',
        },
        options: {
          period: {
            title: 'Отслеживание менструации',
            description:
              'Сделайте так, чтобы сегодня, следующая менструация и календарь были сосредоточены на ритме цикла.',
          },
          symptoms: {
            title: 'Симптомы и настроение',
            description:
              'Записывайте симптомы, настроение и ежедневные заметки с первого дня.',
          },
          tryingToConceive: {
            title: 'Планирование беременности',
            description:
              'Добавляйте отслеживание планирования беременности только если вам это нужно, не превращая всё приложение в режим фертильности.',
          },
        },
        irregularCycle: {
          title: 'Поддержка нерегулярного цикла',
          body: 'Сообщите Floriva, может ли ваш цикл меняться, чтобы прогнозы ясно показывали свои ограничения.',
          yes: {
            title: 'Да, он может меняться',
            description:
              'Используйте более явную неопределённость в прогнозах и ожидайте большего разброса от цикла к циклу.',
          },
          no: {
            title: 'Нет, обычно он стабильный',
            description:
              'Используйте более устойчивую базу при прогнозе следующей менструации и фертильного окна.',
          },
        },
        conditions: {
          title: 'Шаблоны с учётом состояний',
          body: 'Необязательные метки помогают сделать шаблоны записи релевантными, не превращая Floriva в поток контента.',
        },
        footer: {
          helper: 'Выбор остаётся видимым рядом с «Продолжить», пока вы прокручиваете экран.',
          selectedGoalPrefix: 'Выбранная цель: ',
        },
        tags: {
          pcos: 'СПКЯ',
          pmdd: 'ПМДР',
          endometriosis: 'Эндометриоз',
        },
        validation: {
          alertTitle: 'Выберите основу, чтобы продолжить',
          goalsRequired: 'Выберите хотя бы одну цель, чтобы настроить Floriva.',
          irregularCyclesRequired:
            'Сообщите Floriva, может ли меняться ритм вашего цикла.',
        },
      },
      ttcSetup: {
        eyebrow: 'Планирование беременности',
        title: 'Сделайте ведение планирования беременности сосредоточенным',
        description:
          'Выберите только те детали планирования беременности, которые должны быть готовы в первый день. Позже их можно изменить в настройках.',
        backLabel: 'Назад',
        section: {
          title: 'Предпочтения отслеживания',
          body: 'Выберите детали, которые Floriva должна показывать при записи. Настройка остаётся спокойной и полностью локальной.',
        },
        chips: {
          sex: 'Секс',
          ovulationTest: 'Тест на овуляцию',
          cervicalMucus: 'Цервикальная слизь',
          basalBodyTemperature: 'БТТ',
        },
        helper:
          'Эти выборы формируют ведение планирования беременности и напоминания, пока Floriva остаётся спокойным и приватным трекером цикла.',
      },
      ttcExpectations: {
        eyebrow: 'Чего ожидать',
        title: 'Для чего Floriva это использует',
        description:
          'Этот шаг делает поток планирования беременности понятным: как именно Floriva будет использовать ваши выборы.',
        backLabel: 'Назад',
        sections: {
          privateByDefault: {
            title: 'По умолчанию приватно',
            body: 'Ваши настройки планирования беременности остаются локально на этом устройстве, если вы позже не решите их перенести.',
          },
          usedForTracking: {
            title: 'Используется для отслеживания',
            body: 'Floriva использует эти выборы, чтобы ежедневная запись и напоминания оставались уместными для вашей настройки.',
          },
          estimatesOnly: {
            title: 'Только оценки',
            body: 'Floriva даёт оценки и напоминания. Она не ставит диагноз и не обещает сроков.',
          },
          currentSetup: {
            title: 'Текущая настройка',
            body: 'Перед продолжением проверьте текущие выборы по планированию беременности.',
          },
        },
        summary: {
          disabled:
            'Floriva оставит отслеживание планирования беременности выключенным, пока вы не выберете, что отслеживать.',
          enabledPrefix: 'Floriva запомнит: ',
          enabledSuffix: '.',
        },
        saving: 'Сохранение...',
        error: 'Не удалось сохранить настройку планирования беременности.',
      },
      setupLater: {
        eyebrow: 'Настроить позже',
        title: 'Завершите настройку без лишнего',
        description:
          'Сразу переходите в Floriva, а за дополнительными возможностями вернётесь позже, когда будете готовы. На этом экране пока не включаются напоминания, импорт или биометрия.',
        backLabel: 'Назад',
        finishSetup: 'Завершить настройку',
        saving: 'Сохранение...',
        sections: {
          whatHappensAfterThis: {
            title: 'Что будет дальше',
            description:
              'Ваши базовые данные цикла и цели уже готовы к сохранению после завершения настройки. Это лишь необязательные следующие шаги.',
            body: 'Завершение настройки сразу откроет приложение. Всё, что вы оставите на потом, останется выключенным, пока вы явно не включите это.',
          },
          reminders: {
            title: 'Напоминания',
            body: 'Локальные напоминания останутся выключенными, пока вы явно не вернётесь к ним.',
          },
          import: {
            title: 'Импорт из Clue или Flo',
            body: 'Проверку импорта можно отложить до тех пор, пока не будет готов файл экспорта.',
          },
          biometricLock: {
            title: 'Биометрическая блокировка',
            body: 'Биометрическая разблокировка остаётся выключенной, пока вы не решите её включить.',
          },
        },
        choices: {
          remindersLater: {
            title: 'Напомнить позже',
            description:
              'Пока оставьте напоминания выключенными, но покажите этот вариант снова позже в настройках.',
          },
          remindersOff: {
            title: 'Оставить напоминания выключенными',
            description:
              'Полностью оставьте напоминания выключенными, пока сами не решите их использовать.',
          },
          importNow: {
            title: 'Открыть импорт следующим',
            description:
              'Сразу перейдите к проверке импорта после настройки, чтобы перенести старую историю сейчас.',
          },
          importLater: {
            title: 'Проверить импорт позже',
            description:
              'Пропустите импорт на время и оставьте напоминание на потом.',
          },
          importSkip: {
            title: 'Пока пропустить',
            description:
              'Не ставьте импорт в очередь. Вы сможете открыть его вручную, когда будете готовы.',
          },
          biometricsLater: {
            title: 'Проверить блокировку позже',
            description:
              'Пока оставьте блокировку выключенной, но покажите этот вариант снова, когда вы освоитесь.',
          },
          biometricsSkip: {
            title: 'Оставить блокировку выключенной',
            description:
              'Оставьте биометрическую блокировку отключённой, пока сами не решите её включить.',
          },
        },
        error: 'Не удалось завершить настройку. Попробуйте ещё раз.',
      },
    },
  },
} as const;
