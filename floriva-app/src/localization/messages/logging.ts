export const loggingMessages = {
  en: {
    logging: {
      screen: {
        eyebrow: 'Daily tracking',
        title: 'Today',
        description: 'Log what changed today in a few taps.',
        dayDescription: 'Log what changed on this day in a few taps.',
      },
      card: {
        title: 'Log today',
        description: 'Start with what changed today.',
        loading: 'Loading today…',
        titleThisDay: 'Log this day',
        descriptionThisDay: 'Start with what changed on this day.',
        loadingThisDay: 'Loading this day…',
      },
      status: {
        savedForThisDay: 'Saved for this day',
        nothingAddedYet: 'Nothing added yet',
        readyToSave: 'Ready to save',
        startWithWhatChanged: 'Start with what changed today',
        startWithWhatChangedThisDay: 'Start with what changed on this day',
        updateAnything:
          'Update anything that changed. Or delete this day to remove it from this device.',
        tapAnySignal: 'Tap any signal that stands out. Floriva only saves what you choose.',
        reviewSelected: 'Review the selected details, then save.',
        everythingCleared:
          'Everything is cleared. Delete the entry to remove this day from this device.',
        addSomething: 'Add something before saving.',
        noUnsavedChanges: 'No unsaved changes yet.',
        savedLocal: 'Saved on this device.',
        alreadyRemoved: 'Entry already removed from this device.',
        deletedLocal: 'Entry deleted from this device.',
        deleteEntry: 'Delete entry',
        deleteConfirm: 'Delete this entry from this device? This cannot be undone.',
        keepEntry: 'Keep entry',
        confirmDelete: 'Confirm delete',
        working: 'Working…',
        saving: 'Saving…',
        saveTodayLog: "Save today's log",
        saveThisLog: 'Save this log',
      },
      errors: {
        load: 'Today could not load right now.',
        save: 'Today could not save right now.',
        delete: 'Today could not delete right now.',
        loadThisDay: 'This day could not load right now.',
        saveThisDay: 'This day could not save right now.',
        deleteThisDay: 'This day could not delete right now.',
      },
      validation: {
        bbtRange: 'Enter a BBT between {min} C and {max} C.',
      },
      fields: {
        bleeding: {
          title: 'Bleeding',
          description: 'Skip this if you are only logging symptoms, mood, or a note.',
        },
        symptoms: {
          title: 'Symptoms',
        },
        ttcTracking: {
          title: 'Trying-to-conceive tracking',
          description: 'Only the trying-to-conceive details you turned on in setup appear here.',
          bbtLabel: 'Basal body temperature',
        },
        birthControl: {
          title: 'Birth control',
          description: 'Shown only when you already track it or use the reminder.',
        },
        mood: {
          title: 'Mood',
        },
        notes: {
          title: 'Notes',
        },
      },
      placeholders: {
        bbtExample: 'e.g. 36.50 C',
        notes: 'Anything worth remembering today',
        notesThisDay: 'Anything worth remembering for this day',
      },
      options: {
        bleeding: {
          none: 'None',
          spotting: 'Spotting',
          light: 'Light',
          medium: 'Medium',
          heavy: 'Heavy',
        },
        mood: {
          steady: 'Steady',
          low: 'Low',
          sensitive: 'Sensitive',
          energized: 'Energized',
        },
        symptoms: {
          cramps: 'Cramps',
          headache: 'Headache',
          bloating: 'Bloating',
          fatigue: 'Fatigue',
          'breast-tenderness': 'Breast tenderness',
          acne: 'Acne',
          discharge: 'Discharge',
          'sleep-changes': 'Sleep changes',
          'libido-changes': 'Libido changes',
        },
        ttc: {
          sexLogged: 'Sex logged',
          negativeTest: 'Negative test',
          positiveTest: 'Positive test',
          peakTest: 'Peak test',
          dry: 'Dry',
          sticky: 'Sticky',
          creamy: 'Creamy',
          eggWhite: 'Egg-white',
        },
        birthControlMethod: {
          pill: 'Pill',
          iud: 'IUD',
          implant: 'Implant',
          ring: 'Ring',
          patch: 'Patch',
          other: 'Other',
        },
        iudType: {
          hormonal: 'Hormonal',
          copper: 'Copper',
        },
        birthControlPill: {
          missedDose: 'Missed dose',
          lateDose: 'Late dose',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'PCOS patterns',
          loggingHint:
            'Cycle variability, spotting, skin, and discharge are all easy to log and review here.',
          insightsEmptyState:
            'Log irregular timing, spotting, and symptom shifts so Floriva can summarize what it sees in your history.',
        },
        pmdd: {
          title: 'PMDD patterns',
          loggingHint:
            'Mood, sleep, headache, and cramps are all here so you can look back before a period starts.',
          insightsEmptyState:
            'Floriva can summarize pre-period mood and symptom clusters once a few cycles are logged locally.',
        },
        endometriosis: {
          title: 'Endometriosis patterns',
          loggingHint:
            'Pain and heavier-flow days are quick to log here.',
          insightsEmptyState:
            'Log pain and flow intensity consistently so Floriva can describe heavier symptom stretches from device history.',
        },
      },
    },
  },
  es: {
    logging: {
      screen: {
        eyebrow: 'Seguimiento diario',
        title: 'Hoy',
        description: 'Registra en pocos toques lo que cambió hoy y guárdalo en este dispositivo.',
        dayDescription:
          'Registra en pocos toques lo que cambió en este día y guárdalo en este dispositivo.',
      },
      card: {
        title: 'Registrar hoy',
        description: 'Empieza con lo que cambió hoy.',
        loading: 'Cargando hoy…',
        titleThisDay: 'Registrar este día',
        descriptionThisDay: 'Empieza con lo que cambió en este día.',
        loadingThisDay: 'Cargando este día…',
      },
      status: {
        savedForThisDay: 'Guardado para este día',
        nothingAddedYet: 'Todavía no se ha añadido nada',
        readyToSave: 'Listo para guardar',
        startWithWhatChanged: 'Empieza con lo que cambió hoy',
        startWithWhatChangedThisDay: 'Empieza con lo que cambió en este día',
        updateAnything:
          'Actualiza lo que cambió o elimina este día si quieres quitarlo de este dispositivo.',
        tapAnySignal: 'Pulsa cualquier señal que destaque. Floriva solo guarda lo que eliges.',
        reviewSelected: 'Revisa los detalles seleccionados y guarda.',
        everythingCleared:
          'Todo está borrado. Elimina la entrada para quitar este día de este dispositivo.',
        addSomething: 'Añade algo antes de guardar.',
        noUnsavedChanges: 'Aún no hay cambios sin guardar.',
        savedLocal: 'Guardado en este dispositivo.',
        alreadyRemoved: 'La entrada ya se eliminó de este dispositivo.',
        deletedLocal: 'Entrada eliminada de este dispositivo.',
        deleteEntry: 'Eliminar entrada',
        deleteConfirm: '¿Eliminar esta entrada de este dispositivo? Esto no se puede deshacer.',
        keepEntry: 'Conservar entrada',
        confirmDelete: 'Confirmar eliminación',
        working: 'Trabajando…',
        saving: 'Guardando…',
        saveTodayLog: 'Guardar el registro de hoy',
        saveThisLog: 'Guardar este registro',
      },
      errors: {
        load: 'Hoy no se pudo cargar ahora mismo.',
        save: 'Hoy no se pudo guardar ahora mismo.',
        delete: 'Hoy no se pudo eliminar ahora mismo.',
        loadThisDay: 'Este día no se pudo cargar ahora mismo.',
        saveThisDay: 'Este día no se pudo guardar ahora mismo.',
        deleteThisDay: 'Este día no se pudo eliminar ahora mismo.',
      },
      validation: {
        bbtRange: 'Introduce una temperatura basal entre {min} C y {max} C.',
      },
      fields: {
        bleeding: {
          title: 'Sangrado',
          description: 'Sáltalo si solo registras síntomas, ánimo o una nota.',
        },
        symptoms: {
          title: 'Síntomas',
        },
        ttcTracking: {
          title: 'Seguimiento para concebir',
          description:
            'Aquí solo aparecen los detalles para buscar embarazo que activaste en la configuración.',
          bbtLabel: 'Temperatura basal',
        },
        birthControl: {
          title: 'Anticonceptivos',
          description: 'Se muestra solo cuando ya lo registras o usas el recordatorio.',
        },
        mood: {
          title: 'Ánimo',
        },
        notes: {
          title: 'Notas',
        },
      },
      placeholders: {
        bbtExample: 'p. ej. 36,50 C',
        notes: 'Cualquier cosa que valga la pena recordar hoy',
        notesThisDay: 'Cualquier cosa que valga la pena recordar de este día',
      },
      options: {
        bleeding: {
          none: 'Ninguno',
          spotting: 'Manchado',
          light: 'Ligero',
          medium: 'Moderado',
          heavy: 'Abundante',
        },
        mood: {
          steady: 'Estable',
          low: 'Bajo',
          sensitive: 'Sensible',
          energized: 'Con energía',
        },
        symptoms: {
          cramps: 'Cólicos',
          headache: 'Dolor de cabeza',
          bloating: 'Hinchazón',
          fatigue: 'Fatiga',
          'breast-tenderness': 'Sensibilidad en los senos',
          acne: 'Acné',
          discharge: 'Flujo',
          'sleep-changes': 'Cambios de sueño',
          'libido-changes': 'Cambios de libido',
        },
        ttc: {
          sexLogged: 'Sexo registrado',
          negativeTest: 'Prueba negativa',
          positiveTest: 'Prueba positiva',
          peakTest: 'Pico',
          dry: 'Seco',
          sticky: 'Pegajoso',
          creamy: 'Cremoso',
          eggWhite: 'Clara de huevo',
        },
        birthControlMethod: {
          pill: 'Píldora',
          iud: 'DIU',
          implant: 'Implante',
          ring: 'Anillo',
          patch: 'Parche',
          other: 'Otro',
        },
        iudType: {
          hormonal: 'Hormonal',
          copper: 'De cobre',
        },
        birthControlPill: {
          missedDose: 'Dosis olvidada',
          lateDose: 'Dosis tardía',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'Patrones de SOP',
          loggingHint:
            'La variabilidad del ciclo, el manchado, la piel y el flujo son fáciles de registrar y revisar aquí.',
          insightsEmptyState:
            'Registra tiempos irregulares, manchado y cambios de síntomas para que Floriva resuma patrones sin exagerar.',
        },
        pmdd: {
          title: 'Patrones de TDPM',
          loggingHint:
            'El ánimo, el sueño, el dolor de cabeza y los cólicos están aquí para que puedas revisarlos antes de que empiece el periodo.',
          insightsEmptyState:
            'Floriva puede resumir los grupos de ánimo y síntomas previos al periodo cuando ya hay unos cuantos ciclos registrados.',
        },
        endometriosis: {
          title: 'Patrones de endometriosis',
          loggingHint:
            'El dolor y los días de flujo fuerte son fáciles de registrar aquí.',
          insightsEmptyState:
            'Registra dolor e intensidad del flujo de forma constante para que Floriva describa periodos de síntomas más intensos desde el historial del dispositivo.',
        },
      },
    },
  },
  de: {
    logging: {
      screen: {
        eyebrow: 'Tägliches Tracking',
        title: 'Heute',
        description: 'Erfasse in wenigen Fingertipps, was sich heute geändert hat, und speichere es auf diesem Gerät.',
        dayDescription:
          'Erfasse in wenigen Fingertipps, was sich an diesem Tag geändert hat, und speichere es auf diesem Gerät.',
      },
      card: {
        title: 'Heute erfassen',
        description: 'Beginne mit dem, was sich heute geändert hat, und speichere es lokal.',
        loading: 'Heute wird geladen…',
        titleThisDay: 'Diesen Tag erfassen',
        descriptionThisDay:
          'Beginne mit dem, was sich an diesem Tag geändert hat, und speichere es lokal.',
        loadingThisDay: 'Dieser Tag wird geladen…',
      },
      status: {
        savedForThisDay: 'Für diesen Tag gespeichert',
        nothingAddedYet: 'Noch nichts hinzugefügt',
        readyToSave: 'Bereit zum Speichern',
        startWithWhatChanged: 'Beginne mit dem, was sich heute geändert hat',
        startWithWhatChangedThisDay: 'Beginne mit dem, was sich an diesem Tag geändert hat',
        updateAnything:
          'Ändere, was sich verändert hat, oder lösche diesen Tag, wenn er von diesem Gerät entfernt werden soll.',
        tapAnySignal: 'Tippe auf ein auffälliges Signal. Floriva speichert nur, was du auswählst.',
        reviewSelected: 'Prüfe die ausgewählten Details und speichere sie lokal.',
        everythingCleared:
          'Alles ist gelöscht. Lösche den Eintrag, um diesen Tag von diesem Gerät zu entfernen.',
        addSomething: 'Füge etwas hinzu, bevor du speicherst.',
        noUnsavedChanges: 'Noch keine ungespeicherten Änderungen.',
        savedLocal: 'Lokal auf diesem Gerät gespeichert.',
        alreadyRemoved: 'Eintrag wurde bereits von diesem Gerät entfernt.',
        deletedLocal: 'Eintrag von diesem Gerät gelöscht.',
        deleteEntry: 'Eintrag löschen',
        deleteConfirm: 'Diesen Eintrag von diesem Gerät löschen? Das kann nicht rückgängig gemacht werden.',
        keepEntry: 'Eintrag behalten',
        confirmDelete: 'Löschen bestätigen',
        working: 'Wird bearbeitet…',
        saving: 'Speichern…',
        saveTodayLog: 'Tageserfassung speichern',
        saveThisLog: 'Diesen Eintrag speichern',
      },
      errors: {
        load: 'Heute konnte gerade nicht geladen werden.',
        save: 'Heute konnte gerade nicht gespeichert werden.',
        delete: 'Heute konnte gerade nicht gelöscht werden.',
        loadThisDay: 'Dieser Tag konnte gerade nicht geladen werden.',
        saveThisDay: 'Dieser Tag konnte gerade nicht gespeichert werden.',
        deleteThisDay: 'Dieser Tag konnte gerade nicht gelöscht werden.',
      },
      validation: {
        bbtRange: 'Gib eine BBT zwischen {min} C und {max} C ein.',
      },
      fields: {
        bleeding: {
          title: 'Blutung',
          description: 'Überspringe das, wenn du nur Symptome, Stimmung oder eine Notiz erfasst.',
        },
        symptoms: {
          title: 'Symptome',
        },
        ttcTracking: {
          title: 'Kinderwunsch-Tracking',
          description: 'Hier erscheinen nur die Kinderwunsch-Details, die du im Setup aktiviert hast.',
          bbtLabel: 'Basaltemperatur',
        },
        birthControl: {
          title: 'Verhütung',
          description: 'Wird nur angezeigt, wenn du es bereits verfolgst oder die Erinnerung nutzt.',
        },
        mood: {
          title: 'Stimmung',
        },
        notes: {
          title: 'Notizen',
        },
      },
      placeholders: {
        bbtExample: 'z. B. 36,50 C',
        notes: 'Alles, was du dir heute merken möchtest',
        notesThisDay: 'Alles, was du dir für diesen Tag merken möchtest',
      },
      options: {
        bleeding: {
          none: 'Keine',
          spotting: 'Schmierblutung',
          light: 'Leicht',
          medium: 'Mittel',
          heavy: 'Stark',
        },
        mood: {
          steady: 'Stabil',
          low: 'Tief',
          sensitive: 'Empfindlich',
          energized: 'Energiegeladen',
        },
        symptoms: {
          cramps: 'Krämpfe',
          headache: 'Kopfschmerzen',
          bloating: 'Blähungen',
          fatigue: 'Müdigkeit',
          'breast-tenderness': 'Brustspannen',
          acne: 'Akne',
          discharge: 'Ausfluss',
          'sleep-changes': 'Schlafveränderungen',
          'libido-changes': 'Libidoveränderungen',
        },
        ttc: {
          sexLogged: 'Sex erfasst',
          negativeTest: 'Negativer Test',
          positiveTest: 'Positiver Test',
          peakTest: 'Peak-Test',
          dry: 'Trocken',
          sticky: 'Klebrig',
          creamy: 'Cremig',
          eggWhite: 'Eiweißartig',
        },
        birthControlMethod: {
          pill: 'Pille',
          iud: 'IUP',
          implant: 'Implantat',
          ring: 'Ring',
          patch: 'Pflaster',
          other: 'Andere',
        },
        iudType: {
          hormonal: 'Hormonell',
          copper: 'Kupfer',
        },
        birthControlPill: {
          missedDose: 'Vergessene Dosis',
          lateDose: 'Späte Dosis',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'PCOS-Muster',
          loggingHint:
            'Zyklus-Variabilität, Schmierblutung, Haut und Ausfluss lassen sich hier leicht erfassen und später prüfen.',
          insightsEmptyState:
            'Erfasse unregelmäßige Zeiten, Schmierblutungen und Symptomanstiege, damit Floriva Muster beschreibt, ohne zu viel zu versprechen.',
        },
        pmdd: {
          title: 'PMDD-Muster',
          loggingHint:
            'Stimmung, Schlaf, Kopfschmerzen und Krämpfe sind hier, damit du vor dem Periodenbeginn nachschauen kannst.',
          insightsEmptyState:
            'Floriva kann Stimmung und Symptomcluster vor der Periode zusammenfassen, sobald einige Zyklen lokal erfasst sind.',
        },
        endometriosis: {
          title: 'Endometriose-Muster',
          loggingHint:
            'Schmerzen und stärkere Flusstage lassen sich hier schnell erfassen.',
          insightsEmptyState:
            'Erfasse Schmerz und Blutungsstärke konsistent, damit Floriva stärkere Symptomphasen aus dem Geräteverlauf beschreiben kann.',
        },
      },
    },
  },
  fr: {
    logging: {
      screen: {
        eyebrow: 'Suivi quotidien',
        title: "Aujourd’hui",
        description: "Enregistre en quelques gestes ce qui a changé aujourd’hui et garde-le sur cet appareil.",
        dayDescription:
          'Enregistre en quelques gestes ce qui a changé ce jour-là et garde-le sur cet appareil.',
      },
      card: {
        title: "Enregistrer aujourd’hui",
        description: "Commence par ce qui a changé aujourd’hui, puis enregistre-le localement.",
        loading: "Chargement d’aujourd’hui…",
        titleThisDay: 'Enregistrer ce jour',
        descriptionThisDay:
          'Commence par ce qui a changé ce jour-là, puis enregistre-le localement.',
        loadingThisDay: 'Chargement de ce jour…',
      },
      status: {
        savedForThisDay: 'Enregistré pour ce jour',
        nothingAddedYet: "Rien n’a encore été ajouté",
        readyToSave: 'Prêt à enregistrer',
        startWithWhatChanged: "Commence par ce qui a changé aujourd’hui",
        startWithWhatChangedThisDay: 'Commence par ce qui a changé ce jour-là',
        updateAnything:
          'Modifie ce qui a changé, ou supprime ce jour si tu veux le retirer de cet appareil.',
        tapAnySignal: "Appuie sur un signal qui te semble important. Floriva n’enregistre que ce que tu choisis.",
        reviewSelected: 'Vérifie les détails sélectionnés, puis enregistre-les localement.',
        everythingCleared:
          "Tout est effacé. Supprime l’entrée pour retirer ce jour de cet appareil.",
        addSomething: "Ajoute quelque chose avant d’enregistrer.",
        noUnsavedChanges: 'Aucune modification non enregistrée pour le moment.',
        savedLocal: 'Enregistré localement sur cet appareil.',
        alreadyRemoved: "L’entrée a déjà été retirée de cet appareil.",
        deletedLocal: 'Entrée supprimée de cet appareil.',
        deleteEntry: "Supprimer l’entrée",
        deleteConfirm: 'Supprimer cette entrée de cet appareil ? Cette action est irréversible.',
        keepEntry: "Garder l’entrée",
        confirmDelete: 'Confirmer la suppression',
        working: 'Traitement…',
        saving: 'Enregistrement…',
        saveTodayLog: "Enregistrer l’entrée du jour",
        saveThisLog: 'Enregistrer cette entrée',
      },
      errors: {
        load: "Aujourd’hui n’a pas pu être chargé pour le moment.",
        save: "Aujourd’hui n’a pas pu être enregistré pour le moment.",
        delete: "Aujourd’hui n’a pas pu être supprimé pour le moment.",
        loadThisDay: "Ce jour n’a pas pu être chargé pour le moment.",
        saveThisDay: "Ce jour n’a pas pu être enregistré pour le moment.",
        deleteThisDay: "Ce jour n’a pas pu être supprimé pour le moment.",
      },
      validation: {
        bbtRange: 'Saisis une BBT entre {min} C et {max} C.',
      },
      fields: {
        bleeding: {
          title: 'Saignement',
          description: "Passe cette étape si tu enregistres seulement des symptômes, l’humeur ou une note.",
        },
        symptoms: {
          title: 'Symptômes',
        },
        ttcTracking: {
          title: 'Suivi projet bébé',
          description: "Ici n’apparaissent que les détails projet bébé activés dans la configuration.",
          bbtLabel: 'Température basale',
        },
        birthControl: {
          title: 'Contraception',
          description: 'Affiché seulement si tu le suis déjà ou si tu utilises le rappel.',
        },
        mood: {
          title: 'Humeur',
        },
        notes: {
          title: 'Notes',
        },
      },
      placeholders: {
        bbtExample: 'p. ex. 36,50 C',
        notes: "Tout ce qu’il vaut la peine de retenir aujourd’hui",
        notesThisDay: "Tout ce qu’il vaut la peine de retenir pour ce jour",
      },
      options: {
        bleeding: {
          none: 'Aucun',
          spotting: 'Saignotement',
          light: 'Léger',
          medium: 'Modéré',
          heavy: 'Abondant',
        },
        mood: {
          steady: 'Stable',
          low: 'Bas',
          sensitive: 'Sensible',
          energized: 'Dynamique',
        },
        symptoms: {
          cramps: 'Crampes',
          headache: 'Mal de tête',
          bloating: 'Ballonnements',
          fatigue: 'Fatigue',
          'breast-tenderness': 'Sensibilité des seins',
          acne: 'Acné',
          discharge: 'Pertes',
          'sleep-changes': 'Changements de sommeil',
          'libido-changes': 'Changements de libido',
        },
        ttc: {
          sexLogged: 'Rapport sexuel noté',
          negativeTest: 'Test négatif',
          positiveTest: 'Test positif',
          peakTest: 'Pic',
          dry: 'Sec',
          sticky: 'Collant',
          creamy: 'Crémeux',
          eggWhite: "Blanc d'œuf",
        },
        birthControlMethod: {
          pill: 'Pilule',
          iud: 'DIU',
          implant: 'Implant',
          ring: 'Anneau',
          patch: 'Patch',
          other: 'Autre',
        },
        iudType: {
          hormonal: 'Hormonal',
          copper: 'Au cuivre',
        },
        birthControlPill: {
          missedDose: 'Dose oubliée',
          lateDose: 'Dose prise en retard',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'Motifs SOPK',
          loggingHint:
            'La variabilité du cycle, le spotting, la peau et les pertes sont faciles à noter et à revoir ici.',
          insightsEmptyState:
            'Enregistre les variations de rythme, le spotting et les changements de symptômes pour que Floriva résume les motifs sans en faire trop.',
        },
        pmdd: {
          title: 'Motifs TDPM',
          loggingHint:
            "L’humeur, le sommeil, les maux de tête et les crampes sont ici pour que tu puisses les consulter avant le début des règles.",
          insightsEmptyState:
            "Floriva peut résumer les groupes d’humeur et de symptômes prémenstruels une fois quelques cycles enregistrés localement.",
        },
        endometriosis: {
          title: "Motifs d’endométriose",
          loggingHint:
            'La douleur et les jours de flux plus abondant sont rapides à noter ici.',
          insightsEmptyState:
            "Enregistre la douleur et l’intensité du flux de manière cohérente pour que Floriva décrive les périodes de symptômes plus lourds à partir de l’historique de l’appareil.",
        },
      },
    },
  },
  ja: {
    logging: {
      screen: {
        eyebrow: '毎日の記録',
        title: '今日',
        description: '今日変わったことを少ない操作で記録し、この端末に保存します。',
        dayDescription: 'この日に変わったことを少ない操作で記録し、この端末に保存します。',
      },
      card: {
        title: '今日を記録',
        description: '今日変わったことから始めて、あとでローカルに保存します。',
        loading: '今日を読み込み中…',
        titleThisDay: 'この日を記録',
        descriptionThisDay: 'この日に変わったことから始めて、あとでローカルに保存します。',
        loadingThisDay: 'この日を読み込み中…',
      },
      status: {
        savedForThisDay: 'この日の記録として保存済み',
        nothingAddedYet: 'まだ何も追加されていません',
        readyToSave: '保存の準備ができました',
        startWithWhatChanged: '今日変わったことから始めましょう',
        startWithWhatChangedThisDay: 'この日に変わったことから始めましょう',
        updateAnything:
          '変わったことを更新するか、この日を端末から削除したい場合は削除してください。',
        tapAnySignal: '気になる項目を選んでください。Floriva は選んだ内容だけを保存します。',
        reviewSelected: '選んだ内容を確認してから、ローカルに保存します。',
        everythingCleared: 'すべて削除されています。この日を端末から削除するには記録を消してください。',
        addSomething: '保存する前に何か追加してください。',
        noUnsavedChanges: 'まだ未保存の変更はありません。',
        savedLocal: 'この端末にローカル保存しました。',
        alreadyRemoved: 'この端末からはすでに削除されています。',
        deletedLocal: 'この端末から記録を削除しました。',
        deleteEntry: '記録を削除',
        deleteConfirm: 'この記録をこの端末から削除しますか？元には戻せません。',
        keepEntry: '記録を残す',
        confirmDelete: '削除を確認',
        working: '処理中…',
        saving: '保存中…',
        saveTodayLog: '今日の記録を保存',
        saveThisLog: 'この記録を保存',
      },
      errors: {
        load: '今日を今は読み込めませんでした。',
        save: '今日を今は保存できませんでした。',
        delete: '今日を今は削除できませんでした。',
        loadThisDay: 'この日を今は読み込めませんでした。',
        saveThisDay: 'この日を今は保存できませんでした。',
        deleteThisDay: 'この日を今は削除できませんでした。',
      },
      validation: {
        bbtRange: 'BBT は {min} C から {max} C の範囲で入力してください。',
      },
      fields: {
        bleeding: {
          title: '出血',
          description: '症状、気分、メモだけを記録するなら、ここは飛ばしてかまいません。',
        },
        symptoms: {
          title: '症状',
        },
        ttcTracking: {
          title: '妊活の記録',
          description: 'ここには、設定で有効にした妊活項目だけが表示されます。',
          bbtLabel: '基礎体温',
        },
        birthControl: {
          title: '避妊',
          description: 'すでに記録しているか、リマインダーを使うときだけ表示されます。',
        },
        mood: {
          title: '気分',
        },
        notes: {
          title: 'メモ',
        },
      },
      placeholders: {
        bbtExample: '例: 36.50 C',
        notes: '今日覚えておきたいこと',
        notesThisDay: 'この日に覚えておきたいこと',
      },
      options: {
        bleeding: {
          none: 'なし',
          spotting: 'スポッティング',
          light: '軽い',
          medium: '中等度',
          heavy: '多い',
        },
        mood: {
          steady: '安定',
          low: '低い',
          sensitive: '敏感',
          energized: '元気',
        },
        symptoms: {
          cramps: '生理痛',
          headache: '頭痛',
          bloating: '張り',
          fatigue: '疲れ',
          'breast-tenderness': '胸の張り',
          acne: 'ニキビ',
          discharge: 'おりもの',
          'sleep-changes': '睡眠の変化',
          'libido-changes': '性欲の変化',
        },
        ttc: {
          sexLogged: '性交を記録',
          negativeTest: '陰性',
          positiveTest: '陽性',
          peakTest: 'ピーク',
          dry: '乾燥',
          sticky: 'ねばつき',
          creamy: 'クリーム状',
          eggWhite: '卵白状',
        },
        birthControlMethod: {
          pill: 'ピル',
          iud: 'IUD',
          implant: 'インプラント',
          ring: 'リング',
          patch: 'パッチ',
          other: 'その他',
        },
        iudType: {
          hormonal: 'ホルモン',
          copper: '銅',
        },
        birthControlPill: {
          missedDose: '飲み忘れ',
          lateDose: '遅れた服用',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'PCOS の傾向',
          loggingHint:
            '周期のばらつき、スポッティング、肌の状態、おりものはここで記録して後から見返せます。',
          insightsEmptyState:
            '不規則なタイミング、スポッティング、症状の変化を記録すると、Floriva は傾向を表示できます。',
        },
        pmdd: {
          title: 'PMDD の傾向',
          loggingHint:
            '気分、睡眠、頭痛、生理痛はここにまとまっているので、生理が始まる前に見返せます。',
          insightsEmptyState:
            '数周期分をローカルに記録すると、Floriva は生理前の気分と症状のまとまりを要約できます。',
        },
        endometriosis: {
          title: '子宮内膜症の傾向',
          loggingHint:
            '痛みや出血が多い日をここで素早く記録できます。',
          insightsEmptyState:
            '痛みと出血の強さを一貫して記録すると、Floriva は端末履歴から症状が重い時期を説明しやすくなります。',
        },
      },
    },
  },
  'zh-Hans': {
    logging: {
      screen: {
        eyebrow: '每日追踪',
        title: '今天',
        description: '用几次点击记录今天的变化，并保存在这个设备上。',
        dayDescription: '用几次点击记录这一天的变化，并保存在这个设备上。',
      },
      card: {
        title: '记录今天',
        description: '先记录今天的变化，再本地保存。',
        loading: '正在加载今天…',
        titleThisDay: '记录这一天',
        descriptionThisDay: '先记录这一天的变化，再本地保存。',
        loadingThisDay: '正在加载这一天…',
      },
      status: {
        savedForThisDay: '已保存到这一天',
        nothingAddedYet: '还没有添加任何内容',
        readyToSave: '可保存',
        startWithWhatChanged: '先从今天变化的内容开始',
        startWithWhatChangedThisDay: '先从这一天变化的内容开始',
        updateAnything: '更新任何变化；如果想把这一天从设备中移除，也可以删除这条记录。',
        tapAnySignal: '点选任何明显的变化。Floriva 只会保存你选择的内容。',
        reviewSelected: '检查已选详情，然后本地保存。',
        everythingCleared: '内容已清空。删除条目即可把这一天从设备中移除。',
        addSomething: '保存之前请先添加一些内容。',
        noUnsavedChanges: '目前还没有未保存的更改。',
        savedLocal: '已本地保存到这个设备。',
        alreadyRemoved: '这条记录已经从这个设备中移除了。',
        deletedLocal: '已从这个设备中删除记录。',
        deleteEntry: '删除记录',
        deleteConfirm: '要从这个设备删除这条记录吗？此操作无法撤销。',
        keepEntry: '保留记录',
        confirmDelete: '确认删除',
        working: '处理中…',
        saving: '正在保存…',
        saveTodayLog: '保存今日记录',
        saveThisLog: '保存这条记录',
      },
      errors: {
        load: '现在无法加载今天。',
        save: '现在无法保存今天。',
        delete: '现在无法删除今天。',
        loadThisDay: '现在无法加载这一天。',
        saveThisDay: '现在无法保存这一天。',
        deleteThisDay: '现在无法删除这一天。',
      },
      validation: {
        bbtRange: '请输入介于 {min} C 和 {max} C 之间的 BBT。',
      },
      fields: {
        bleeding: {
          title: '出血',
          description: '如果你只记录症状、心情或备注，可以跳过这里。',
        },
        symptoms: {
          title: '症状',
        },
        ttcTracking: {
          title: '备孕追踪',
          description: '这里只会显示你在设置里开启的备孕细节。',
          bbtLabel: '基础体温',
        },
        birthControl: {
          title: '避孕',
          description: '只有当你已经在追踪它，或者使用了提醒时才会显示。',
        },
        mood: {
          title: '心情',
        },
        notes: {
          title: '备注',
        },
      },
      placeholders: {
        bbtExample: '例如 36.50 C',
        notes: '今天值得记住的任何事情',
        notesThisDay: '这一天值得记住的任何事情',
      },
      options: {
        bleeding: {
          none: '无',
          spotting: '点滴出血',
          light: '少量',
          medium: '中等',
          heavy: '大量',
        },
        mood: {
          steady: '平稳',
          low: '低落',
          sensitive: '敏感',
          energized: '有活力',
        },
        symptoms: {
          cramps: '痉挛',
          headache: '头痛',
          bloating: '腹胀',
          fatigue: '疲劳',
          'breast-tenderness': '乳房胀痛',
          acne: '痤疮',
          discharge: '分泌物',
          'sleep-changes': '睡眠变化',
          'libido-changes': '性欲变化',
        },
        ttc: {
          sexLogged: '已记录性生活',
          negativeTest: '阴性',
          positiveTest: '阳性',
          peakTest: '峰值',
          dry: '干燥',
          sticky: '粘稠',
          creamy: '乳霜状',
          eggWhite: '蛋清状',
        },
        birthControlMethod: {
          pill: '药丸',
          iud: '宫内节育器',
          implant: '植入物',
          ring: '阴道环',
          patch: '贴片',
          other: '其他',
        },
        iudType: {
          hormonal: '含激素',
          copper: '含铜',
        },
        birthControlPill: {
          missedDose: '漏服',
          lateDose: '迟服',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'PCOS 模式',
          loggingHint: '周期波动、点滴出血、皮肤状况和分泌物都可以在这里记录，以后随时回看。',
          insightsEmptyState: '记录不规律的时间、点滴出血和症状变化，Floriva 就能在不过度承诺的前提下总结模式。',
        },
        pmdd: {
          title: 'PMDD 模式',
          loggingHint: '心情、睡眠、头痛和痉挛都在这里，月经开始前可以随时查看。',
          insightsEmptyState: '当本地记录了几个周期后，Floriva 可以总结经前心情和症状的聚集情况。',
        },
        endometriosis: {
          title: '子宫内膜异位症模式',
          loggingHint: '疼痛和出血较多的日子在这里可以快速记录。',
          insightsEmptyState: '持续记录疼痛和出血强度，这样 Floriva 就能从设备历史中描述更重的症状阶段。',
        },
      },
    },
  },
  pt: {
    logging: {
      screen: {
        eyebrow: 'Acompanhamento diário',
        title: 'Hoje',
        description: 'Registre em poucos toques o que mudou hoje e mantenha salvo neste dispositivo.',
        dayDescription:
          'Registre em poucos toques o que mudou neste dia e mantenha salvo neste dispositivo.',
      },
      card: {
        title: 'Registrar hoje',
        description: 'Comece pelo que mudou hoje.',
        loading: 'Carregando hoje…',
        titleThisDay: 'Registrar este dia',
        descriptionThisDay: 'Comece pelo que mudou neste dia.',
        loadingThisDay: 'Carregando este dia…',
      },
      status: {
        savedForThisDay: 'Salvo para este dia',
        nothingAddedYet: 'Ainda não foi adicionado nada',
        readyToSave: 'Pronto para salvar',
        startWithWhatChanged: 'Comece pelo que mudou hoje',
        startWithWhatChangedThisDay: 'Comece pelo que mudou neste dia',
        updateAnything:
          'Atualize o que mudou ou apague este dia se quiser removê-lo deste dispositivo.',
        tapAnySignal: 'Toque em qualquer sinal que se destaque. O Floriva só salva o que você escolher.',
        reviewSelected: 'Revise os detalhes selecionados e guarde.',
        everythingCleared:
          'Tudo foi limpo. Apague a entrada para remover este dia deste dispositivo.',
        addSomething: 'Adicione algo antes de salvar.',
        noUnsavedChanges: 'Ainda não há alterações sem salvar.',
        savedLocal: 'Guardado neste dispositivo.',
        alreadyRemoved: 'A entrada já foi removida deste dispositivo.',
        deletedLocal: 'Entrada excluída deste dispositivo.',
        deleteEntry: 'Excluir entrada',
        deleteConfirm: 'Excluir esta entrada deste dispositivo? Isso não pode ser desfeito.',
        keepEntry: 'Manter entrada',
        confirmDelete: 'Confirmar exclusão',
        working: 'Processando…',
        saving: 'Salvando…',
        saveTodayLog: 'Salvar registro de hoje',
        saveThisLog: 'Salvar este registro',
      },
      errors: {
        load: 'Hoje não pôde ser carregado agora.',
        save: 'Hoje não pôde ser salvo agora.',
        delete: 'Hoje não pôde ser excluído agora.',
        loadThisDay: 'Este dia não pôde ser carregado agora.',
        saveThisDay: 'Este dia não pôde ser salvo agora.',
        deleteThisDay: 'Este dia não pôde ser excluído agora.',
      },
      validation: {
        bbtRange: 'Digite uma BBT entre {min} C e {max} C.',
      },
      fields: {
        bleeding: {
          title: 'Sangramento',
          description: 'Pule isso se estiver registrando só sintomas, humor ou uma nota.',
        },
        symptoms: {
          title: 'Sintomas',
        },
        ttcTracking: {
          title: 'Acompanhamento de tentativa de conceção',
          description: 'Aqui aparecem apenas os detalhes de tentativa de conceção que você ativou na configuração.',
          bbtLabel: 'Temperatura basal',
        },
        birthControl: {
          title: 'Anticoncepcional',
          description: 'Mostrado apenas quando você já acompanha isso ou usa o lembrete.',
        },
        mood: {
          title: 'Humor',
        },
        notes: {
          title: 'Notas',
        },
      },
      placeholders: {
        bbtExample: 'ex.: 36,50 C',
        notes: 'Qualquer coisa que valha lembrar hoje',
        notesThisDay: 'Qualquer coisa que valha lembrar deste dia',
      },
      options: {
        bleeding: {
          none: 'Nenhum',
          spotting: 'Escape',
          light: 'Leve',
          medium: 'Moderado',
          heavy: 'Intenso',
        },
        mood: {
          steady: 'Estável',
          low: 'Baixo',
          sensitive: 'Sensível',
          energized: 'Energizado',
        },
        symptoms: {
          cramps: 'Cólicas',
          headache: 'Dor de cabeça',
          bloating: 'Inchaço',
          fatigue: 'Fadiga',
          'breast-tenderness': 'Sensibilidade nos seios',
          acne: 'Acne',
          discharge: 'Corrimento',
          'sleep-changes': 'Mudanças no sono',
          'libido-changes': 'Mudanças na libido',
        },
        ttc: {
          sexLogged: 'Sexo registrado',
          negativeTest: 'Teste negativo',
          positiveTest: 'Teste positivo',
          peakTest: 'Pico',
          dry: 'Seco',
          sticky: 'Grudento',
          creamy: 'Cremoso',
          eggWhite: 'Clara de ovo',
        },
        birthControlMethod: {
          pill: 'Pílula',
          iud: 'DIU',
          implant: 'Implante',
          ring: 'Anel',
          patch: 'Adesivo',
          other: 'Outro',
        },
        iudType: {
          hormonal: 'Hormonal',
          copper: 'De cobre',
        },
        birthControlPill: {
          missedDose: 'Dose esquecida',
          lateDose: 'Dose atrasada',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'Padrões de SOP',
          loggingHint:
            'A variabilidade do ciclo, o escape, a pele e o corrimento são fáceis de registrar e revisar aqui.',
          insightsEmptyState:
            'Registre irregularidades de tempo, escape e mudanças de sintomas para que o Floriva resuma padrões sem exagerar.',
        },
        pmdd: {
          title: 'Padrões de TDPM',
          loggingHint:
            'Humor, sono, dor de cabeça e cólicas estão aqui para você consultar antes do início do ciclo.',
          insightsEmptyState:
            'O Floriva pode resumir padrões de humor e sintomas antes do ciclo quando já existirem alguns ciclos registados.',
        },
        endometriosis: {
          title: 'Padrões de endometriose',
          loggingHint:
            'Dor e dias de fluxo mais forte são fáceis de registrar aqui.',
          insightsEmptyState:
            'Registre dor e intensidade do fluxo com consistência para que o Floriva descreva trechos de sintomas mais intensos a partir do histórico do dispositivo.',
        },
      },
    },
  },
  ru: {
    logging: {
      screen: {
        eyebrow: 'Ежедневный трекинг',
        title: 'Сегодня',
        description: 'Внеси изменения за сегодня в несколько нажатий и сохрани их на этом устройстве.',
        dayDescription: 'Внеси изменения за этот день в несколько нажатий и сохрани их на этом устройстве.',
      },
      card: {
        title: 'Записать сегодня',
        description: 'Начни с того, что изменилось сегодня, а затем сохрани локально.',
        loading: 'Загружаем сегодня…',
        titleThisDay: 'Записать этот день',
        descriptionThisDay: 'Начни с того, что изменилось в этот день, а затем сохрани локально.',
        loadingThisDay: 'Загружаем этот день…',
      },
      status: {
        savedForThisDay: 'Сохранено для этого дня',
        nothingAddedYet: 'Пока ничего не добавлено',
        readyToSave: 'Готово к сохранению',
        startWithWhatChanged: 'Начни с того, что изменилось сегодня',
        startWithWhatChangedThisDay: 'Начни с того, что изменилось в этот день',
        updateAnything:
          'Обнови всё, что изменилось, или удали этот день, если хочешь убрать его с этого устройства.',
        tapAnySignal: 'Нажми на любой заметный сигнал. Floriva сохраняет только то, что ты выберешь.',
        reviewSelected: 'Проверь выбранные детали, затем сохрани их локально.',
        everythingCleared:
          'Всё очищено. Удали запись, чтобы убрать этот день с этого устройства.',
        addSomething: 'Добавь что-нибудь перед сохранением.',
        noUnsavedChanges: 'Пока нет несохранённых изменений.',
        savedLocal: 'Локально сохранено на этом устройстве.',
        alreadyRemoved: 'Запись уже удалена с этого устройства.',
        deletedLocal: 'Запись удалена с этого устройства.',
        deleteEntry: 'Удалить запись',
        deleteConfirm: 'Удалить эту запись с устройства? Это нельзя отменить.',
        keepEntry: 'Оставить запись',
        confirmDelete: 'Подтвердить удаление',
        working: 'Выполняется…',
        saving: 'Сохранение…',
        saveTodayLog: 'Сохранить запись за сегодня',
        saveThisLog: 'Сохранить эту запись',
      },
      errors: {
        load: 'Сегодня сейчас не удалось загрузить.',
        save: 'Сегодня сейчас не удалось сохранить.',
        delete: 'Сегодня сейчас не удалось удалить.',
        loadThisDay: 'Этот день сейчас не удалось загрузить.',
        saveThisDay: 'Этот день сейчас не удалось сохранить.',
        deleteThisDay: 'Этот день сейчас не удалось удалить.',
      },
      validation: {
        bbtRange: 'Введите BBT между {min} C и {max} C.',
      },
      fields: {
        bleeding: {
          title: 'Кровотечение',
          description: 'Пропусти это, если ты записываешь только симптомы, настроение или заметку.',
        },
        symptoms: {
          title: 'Симптомы',
        },
        ttcTracking: {
          title: 'Трекинг планирования беременности',
          description: 'Здесь отображаются только те детали планирования беременности, которые ты включила в настройках.',
          bbtLabel: 'Базальная температура',
        },
        birthControl: {
          title: 'Контрацепция',
          description: 'Показывается только если ты уже отслеживаешь это или используешь напоминание.',
        },
        mood: {
          title: 'Настроение',
        },
        notes: {
          title: 'Заметки',
        },
      },
      placeholders: {
        bbtExample: 'напр. 36,50 C',
        notes: 'Всё, что стоит запомнить сегодня',
        notesThisDay: 'Всё, что стоит запомнить для этого дня',
      },
      options: {
        bleeding: {
          none: 'Нет',
          spotting: 'Мажущие выделения',
          light: 'Лёгкое',
          medium: 'Среднее',
          heavy: 'Сильное',
        },
        mood: {
          steady: 'Спокойное',
          low: 'Низкое',
          sensitive: 'Чувствительное',
          energized: 'Энергичное',
        },
        symptoms: {
          cramps: 'Спазмы',
          headache: 'Головная боль',
          bloating: 'Вздутие',
          fatigue: 'Усталость',
          'breast-tenderness': 'Чувствительность груди',
          acne: 'Акне',
          discharge: 'Выделения',
          'sleep-changes': 'Изменения сна',
          'libido-changes': 'Изменения либидо',
        },
        ttc: {
          sexLogged: 'Секс отмечен',
          negativeTest: 'Отрицательный тест',
          positiveTest: 'Положительный тест',
          peakTest: 'Пик',
          dry: 'Сухо',
          sticky: 'Липко',
          creamy: 'Кремово',
          eggWhite: 'Как яичный белок',
        },
        birthControlMethod: {
          pill: 'Таблетка',
          iud: 'ВМС',
          implant: 'Имплант',
          ring: 'Кольцо',
          patch: 'Пластырь',
          other: 'Другое',
        },
        iudType: {
          hormonal: 'Гормональная',
          copper: 'Медная',
        },
        birthControlPill: {
          missedDose: 'Пропущенная доза',
          lateDose: 'Поздний приём',
        },
      },
      conditionTemplates: {
        pcos: {
          title: 'Паттерны PCOS',
          loggingHint:
            'Вариативность цикла, мажущие выделения, состояние кожи и выделения легко записать и посмотреть здесь позже.',
          insightsEmptyState:
            'Отмечай нерегулярные сроки, мажущие выделения и изменения симптомов, чтобы Floriva могла описывать паттерны без лишних обещаний.',
        },
        pmdd: {
          title: 'Паттерны PMDD',
          loggingHint:
            'Настроение, сон, головная боль и спазмы. Всё здесь, чтобы ты могла посмотреть до начала месячных.',
          insightsEmptyState:
            'Floriva может свести в итог предменструальное настроение и группы симптомов после нескольких локально записанных циклов.',
        },
        endometriosis: {
          title: 'Паттерны эндометриоза',
          loggingHint:
            'Боль и дни с более сильным кровотечением легко отметить здесь.',
          insightsEmptyState:
            'Записывай боль и интенсивность кровотечения последовательно, чтобы Floriva могла описывать более тяжёлые периоды симптомов по истории устройства.',
        },
      },
    },
  },
} as const;
