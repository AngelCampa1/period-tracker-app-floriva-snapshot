const importEnglishMessages = {
  import: {
    screen: {
      eyebrow: 'Import',
      title: 'Import history',
      description: 'Choose a source, preview what Floriva can keep, and save only what it can read.',
      backLabel: 'Back to data controls',
      skipLabel: 'Skip for now',
      chooseTitlePrefix: 'Bring your history ',
      chooseTitleAccent: 'with you',
      chooseTitleSuffix: '.',
      sourceTitle: 'Choose an import source',
      sourcePickerDescription: 'Pick one source to preview before Floriva imports anything.',
      sourceCardTitle: 'Available sources',
      sourceStepLabel: 'Step 1',
      previewStepLabel: 'Step 2',
      confirmStepLabel: 'Step 3',
      attentionDescription: 'Floriva only imports rows it can read.',
      previewDescription: 'Check the counts, date range, and skipped rows before you import.',
      duplicateOnlyDescription:
        'These dates are already in Floriva, so there are no new rows to import from this file.',
      manualFallbackDescription:
        'If anything important is missing from this file, you can add period starts manually instead.',
      reviewEyebrow: 'Import · Review',
      reviewTitlePrefix: 'Review before ',
      reviewTitleAccent: 'confirming',
      reviewTitleSuffix: '.',
      previewCardTitle: 'Review details',
      resultDescription: 'Floriva only brought in the rows you reviewed.',
      previewSummaryTitle: 'Preview summary',
      resultTitle: 'Import complete',
      completionCardTitle: 'Import summary',
    },
    sources: {
      clue: {
        title: 'Clue JSON',
        description:
          'Choose a Clue export file from this device and preview what Floriva can keep.',
      },
      flo: {
        title: 'Flo JSON',
        description:
          'Use the JSON export you requested from Flo, then review any skipped or unsupported rows before import.',
      },
      manual: {
        title: 'Manual history',
        description:
          'Add period starts for the last 12 months when you have no export file.',
      },
    },
    actions: {
      chooseFile: 'Choose file',
      preview: 'Preview import',
      commit: 'Import reviewed rows',
      goToToday: 'Go to Today',
      goToCalendar: 'Go to Calendar',
      useManualHistory: 'Use manual history instead',
      excludeReviewedRow: 'Exclude this row',
    },
    status: {
      previewTitle: 'Ready to import',
      resultTitle: 'Logs imported',
      resultSubtitle: 'Duplicates or rows skipped',
      attentionTitle: 'Import needs attention',
    },
    confidence: {
      high: 'High confidence',
      medium: 'Medium confidence',
      low: 'Low confidence',
    },
    confidenceReasons: {
      'reviewed-days-ready': 'Ready to import: {count}',
      'no-reviewed-days-ready': 'Ready to import: 0',
      'duplicate-dates-skipped': 'Duplicate dates skipped: {count}',
      'rows-skipped': 'Rows skipped: {count}',
    },
    errors: {
      unsupportedMedia:
        'That looks like an image or media file. Choose a Clue or Flo export file to preview in Floriva.',
      jsonParse:
        'Floriva could not read that file as a JSON export. Choose a .json or .cluedata export file.',
      noValidHistory: "Floriva couldn't find any valid history to review in that import.",
      readFile: 'Unable to read that import file.',
      commit: "Floriva couldn't finish that import. Try again.",
      unsupportedShape:
        'This Flo file is not in a supported format. Floriva expected a top-level array or a "data"/"values" array.',
    },
    labels: {
      selectedFilePrefix: 'Selected file:',
      dateRangeNone: 'No valid dates found',
      localDuplicatesSkipped: 'Local duplicates skipped',
      rowsSkipped: 'Rows skipped',
      logsImported: 'Logs imported',
      selectedExportFile: 'Selected export file',
      manualDateInput: 'Period start dates',
      manualDateHelper:
        'Add one period start date per line. Floriva only uses the last 12 months in this quick-entry mode.',
      manualDateDisabledHelper:
        'Enter at least one period start date to review before importing.',
      noFileSelected: 'No file selected yet.',
      dateRangeTitle: 'Date range',
      sourceTitle: 'Source',
      confidenceTitle: 'Import confidence',
      duplicateDatesTitle: 'Duplicate dates Floriva will skip',
      duplicateCountSummary: 'Dates already in Floriva and skipped: {count}',
      adjustmentsTitle: 'What Floriva adjusted',
      adjustmentSummary: 'Floriva adjusted some rows in this import before review.',
      skippedRowsTitle: 'Skipped rows',
      skippedSummaryTitle: 'Skipped or unsupported rows',
      unsupportedRows: 'Unsupported',
      invalidRows: 'Invalid',
      editedCount: 'Edited after review',
      editablePreviewTitle: 'Reviewed rows',
      editablePreviewDescription:
        'Floriva will import only the reviewed rows shown here. Exclude any row you do not want to keep before importing.',
      previewEntrySummary: 'Bleeding: {bleeding}. Symptoms: {symptomCount}.',
    },
    skippedRows: {
      invalid: 'Row {rowNumber} has a date or value Floriva could not read.',
      unsupported: 'Row {rowNumber} uses data Floriva does not import yet.',
    },
  },
} as const;

export const importMessages = {
  en: importEnglishMessages,
  es: {
    import: {
      screen: {
        eyebrow: 'Importar',
        title: 'Importar historial',
        description: 'Elige una fuente, revisa lo que Floriva puede conservar y guarda solo lo que puede leer.',
        backLabel: 'Volver a controles de datos',
        skipLabel: 'Omitir por ahora',
        chooseTitlePrefix: 'Trae tu historial ',
        chooseTitleAccent: 'contigo',
        chooseTitleSuffix: '.',
        sourceTitle: 'Elige una fuente de importación',
        sourcePickerDescription:
          'Elige una fuente para revisar la vista previa antes de que Floriva importe nada.',
        sourceCardTitle: 'Fuentes disponibles',
        sourceStepLabel: 'Paso 1',
        previewStepLabel: 'Paso 2',
        confirmStepLabel: 'Paso 3',
        attentionDescription: 'Floriva solo importa las filas que puede leer.',
        previewDescription: 'Revisa los conteos, el rango de fechas y las filas omitidas antes de importar.',
        duplicateOnlyDescription:
          'Estas fechas ya están en Floriva, así que no hay filas nuevas para importar desde este archivo.',
        manualFallbackDescription:
          'Si falta algo importante en este archivo, puedes añadir inicios de periodo manualmente.',
        reviewEyebrow: 'Importar · Revisar',
        reviewTitlePrefix: 'Revisa antes de ',
        reviewTitleAccent: 'confirmar',
        reviewTitleSuffix: '.',
        previewCardTitle: 'Detalles de revisión',
        resultDescription: 'Floriva solo importó las filas que revisaste.',
        previewSummaryTitle: 'Resumen de la vista previa',
        resultTitle: 'Importación completada',
        completionCardTitle: 'Resumen de la importación',
      },
      sources: {
        clue: {
          title: 'JSON de Clue',
          description:
            'Elige un archivo exportado de Clue desde este dispositivo y revisa lo que Floriva puede conservar.',
        },
        flo: {
          title: 'JSON de Flo',
          description:
            'Usa la exportación JSON que pediste a Flo y luego revisa cualquier fila omitida o no admitida antes de importar.',
        },
        manual: {
          title: 'Historial manual',
          description:
            'Añade los inicios de periodo de los últimos 12 meses cuando no tengas un archivo exportado.',
        },
      },
      actions: {
        chooseFile: 'Elegir archivo',
        preview: 'Previsualizar importación',
        commit: 'Importar filas revisadas',
        goToToday: 'Ir a Hoy',
        goToCalendar: 'Ir al Calendario',
        useManualHistory: 'Usar historial manual',
        excludeReviewedRow: 'Excluir esta fila',
      },
      status: {
        previewTitle: 'Listo para importar',
        resultTitle: 'Registros importados',
        resultSubtitle: 'Duplicados o filas omitidas',
        attentionTitle: 'La importación necesita atención',
      },
      confidence: {
        high: 'Confianza alta',
        medium: 'Confianza media',
        low: 'Confianza baja',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'Listo para importar: {count}',
        'no-reviewed-days-ready': 'Listo para importar: 0',
        'duplicate-dates-skipped': 'Fechas duplicadas omitidas: {count}',
        'rows-skipped': 'Filas omitidas: {count}',
      },
      errors: {
        unsupportedMedia:
          'Eso parece un archivo de imagen o multimedia. Elige un archivo de exportación de Clue o Flo para previsualizarlo en Floriva.',
        jsonParse:
          'Floriva no pudo leer ese archivo como una exportación JSON. Elige un archivo .json o .cluedata.',
        noValidHistory: 'Floriva no encontró historial válido para revisar en esa importación.',
        readFile: 'No se pudo leer ese archivo de importación.',
        commit: 'Floriva no pudo completar esa importación. Inténtalo de nuevo.',
        unsupportedShape:
          'Formato no admitido en el archivo de importación de Flo: se esperaba un arreglo de nivel superior o un arreglo "data"/"values".',
      },
      labels: {
        selectedFilePrefix: 'Archivo seleccionado:',
        dateRangeNone: 'No se encontraron fechas válidas',
        localDuplicatesSkipped: 'Duplicados locales omitidos',
        rowsSkipped: 'Filas omitidas',
        logsImported: 'Registros importados',
        selectedExportFile: 'Archivo exportado seleccionado',
        manualDateInput: 'Fechas de inicio del periodo',
        manualDateHelper:
          'Añade una fecha local de inicio del periodo por línea. Floriva solo usa los últimos 12 meses en esta entrada rápida.',
        manualDateDisabledHelper:
          'Escribe al menos una fecha de inicio del periodo antes de importar.',
        noFileSelected: 'Todavía no se ha seleccionado ningún archivo.',
        dateRangeTitle: 'Rango de fechas',
        sourceTitle: 'Fuente',
        confidenceTitle: 'Confianza de importación',
        duplicateDatesTitle: 'Fechas duplicadas que Floriva omitirá',
        duplicateCountSummary: 'Fechas que ya están en Floriva y se omitieron: {count}',
        adjustmentsTitle: 'Qué ajustó Floriva',
        adjustmentSummary: 'Floriva ajustó algunas filas de esta importación antes de revisarla.',
        skippedRowsTitle: 'Filas omitidas',
        skippedSummaryTitle: 'Filas omitidas o no admitidas',
        unsupportedRows: 'No admitidas',
        invalidRows: 'No válidas',
        editedCount: 'Editado después de revisar',
        editablePreviewTitle: 'Filas revisadas',
        editablePreviewDescription:
          'Floriva solo importará las filas revisadas que se muestran aquí. Excluye cualquier fila que no quieras conservar antes de importar.',
        previewEntrySummary: 'Sangrado: {bleeding}. Síntomas: {symptomCount}.',
      },
      skippedRows: {
        invalid: 'La fila {rowNumber} tiene una fecha o valor que Floriva no pudo leer.',
        unsupported: 'La fila {rowNumber} usa datos que Floriva aún no importa.',
      },
    },
  },
  de: {
    import: {
      screen: {
        eyebrow: 'Importieren',
        title: 'Verlauf importieren',
        description: 'Wähle eine Quelle, prüfe, was Floriva behalten kann, und übernimm nur das, was es lesen kann.',
        backLabel: 'Zurück zu den Datenkontrollen',
        skipLabel: 'Vorerst überspringen',
        chooseTitlePrefix: 'Nimm deinen Verlauf ',
        chooseTitleAccent: 'mit',
        chooseTitleSuffix: '.',
        sourceTitle: 'Importquelle wählen',
        sourcePickerDescription:
          'Wähle zuerst eine Quelle aus, um die Vorschau zu prüfen, bevor Floriva etwas importiert.',
        sourceCardTitle: 'Verfügbare Quellen',
        sourceStepLabel: 'Schritt 1',
        previewStepLabel: 'Schritt 2',
        confirmStepLabel: 'Schritt 3',
        attentionDescription: 'Floriva importiert nur Zeilen, die es lesen kann.',
        previewDescription:
          'Prüfe Anzahl, Datumsbereich und übersprungene Zeilen, bevor du importierst.',
        duplicateOnlyDescription:
          'Diese Daten sind bereits in Floriva, daher gibt es in dieser Datei keine neuen Zeilen zum Importieren.',
        manualFallbackDescription:
          'Wenn in dieser Datei etwas Wichtiges fehlt, kannst du Periodenstarts stattdessen manuell hinzufügen.',
        reviewEyebrow: 'Importieren · Prüfen',
        reviewTitlePrefix: 'Vor dem ',
        reviewTitleAccent: 'Bestätigen prüfen',
        reviewTitleSuffix: '.',
        previewCardTitle: 'Prüfdetails',
        resultDescription: 'Floriva hat nur die Zeilen übernommen, die du geprüft hast.',
        previewSummaryTitle: 'Vorschau',
        resultTitle: 'Import abgeschlossen',
        completionCardTitle: 'Importübersicht',
      },
      sources: {
        clue: {
          title: 'Clue JSON',
          description:
            'Wähle eine Clue-Exportdatei von diesem Gerät aus und prüfe, was Floriva behalten kann.',
        },
        flo: {
          title: 'Flo JSON',
          description:
            'Verwende die JSON-Exportdatei, die du bei Flo angefordert hast, und prüfe vor dem Import übersprungene oder nicht unterstützte Zeilen.',
        },
        manual: {
          title: 'Manueller Verlauf',
          description:
            'Trage Periodenstarts für die letzten 12 Monate ein, wenn du keine Exportdatei hast.',
        },
      },
      actions: {
        chooseFile: 'Datei wählen',
        preview: 'Importvorschau',
        commit: 'Geprüfte Zeilen importieren',
        goToToday: 'Zu Heute',
        goToCalendar: 'Zum Kalender',
        useManualHistory: 'Manuellen Verlauf verwenden',
        excludeReviewedRow: 'Diese Zeile ausschließen',
      },
      status: {
        previewTitle: 'Bereit zum Importieren',
        resultTitle: 'Einträge importiert',
        resultSubtitle: 'Duplikate oder übersprungene Zeilen',
        attentionTitle: 'Import braucht Aufmerksamkeit',
      },
      confidence: {
        high: 'Hohe Sicherheit',
        medium: 'Mittlere Sicherheit',
        low: 'Niedrige Sicherheit',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'Bereit zum Importieren: {count}',
        'no-reviewed-days-ready': 'Bereit zum Importieren: 0',
        'duplicate-dates-skipped': 'Doppelte Daten übersprungen: {count}',
        'rows-skipped': 'Zeilen übersprungen: {count}',
      },
      errors: {
        unsupportedMedia:
          'Das sieht nach einer Bild- oder Mediendatei aus. Wähle eine Clue- oder Flo-Exportdatei, um sie in Floriva anzuzeigen.',
        jsonParse:
          'Floriva konnte diese Datei nicht als JSON-Export lesen. Wähle eine .json- oder .cluedata-Exportdatei.',
        noValidHistory: 'Floriva konnte in diesem Import keinen gültigen Verlauf zum Prüfen finden.',
        readFile: 'Diese Importdatei konnte nicht gelesen werden.',
        commit: 'Floriva konnte diesen Import nicht abschließen. Versuche es erneut.',
        unsupportedShape:
          'Nicht unterstützte Flo-Importdatei: erwartet wurde ein oberstes Array oder ein "data"/"values"-Array.',
      },
      labels: {
        selectedFilePrefix: 'Ausgewählte Datei:',
        dateRangeNone: 'Keine gültigen Daten gefunden',
        localDuplicatesSkipped: 'Lokale Duplikate übersprungen',
        rowsSkipped: 'Zeilen übersprungen',
        logsImported: 'Einträge importiert',
        selectedExportFile: 'Ausgewählte Exportdatei',
        manualDateInput: 'Startdaten der Periode',
        manualDateHelper:
          'Füge pro Zeile ein lokales Startdatum der Periode hinzu. Floriva verwendet in diesem Schnellpfad nur die letzten 12 Monate.',
        manualDateDisabledHelper:
          'Gib mindestens ein Startdatum der Periode ein, bevor du importierst.',
        noFileSelected: 'Noch keine Datei ausgewählt.',
        dateRangeTitle: 'Datumsbereich',
        sourceTitle: 'Quelle',
        confidenceTitle: 'Importsicherheit',
        duplicateDatesTitle: 'Doppelte Daten, die Floriva überspringt',
        duplicateCountSummary: 'Daten, die bereits in Floriva sind und übersprungen werden: {count}',
        adjustmentsTitle: 'Was Floriva angepasst hat',
        adjustmentSummary: 'Floriva hat einige Zeilen dieses Imports vor der Prüfung angepasst.',
        skippedRowsTitle: 'Übersprungene Zeilen',
        skippedSummaryTitle: 'Übersprungene oder nicht unterstützte Zeilen',
        unsupportedRows: 'Nicht unterstützt',
        invalidRows: 'Ungültig',
        editedCount: 'Nach der Prüfung bearbeitet',
        editablePreviewTitle: 'Geprüfte Zeilen',
        editablePreviewDescription:
          'Floriva importiert nur die hier gezeigten geprüften Zeilen. Schließe jede Zeile aus, die du vor dem Import nicht behalten möchtest.',
        previewEntrySummary: 'Blutung: {bleeding}. Symptome: {symptomCount}.',
      },
      skippedRows: {
        invalid: 'Zeile {rowNumber} enthält ein Datum oder einen Wert, den Floriva nicht lesen konnte.',
        unsupported: 'Zeile {rowNumber} enthält Daten, die Floriva noch nicht importiert.',
      },
    },
  },
  fr: {
    import: {
      screen: {
        eyebrow: 'Import',
        title: "Importer l’historique",
        description: "Choisis une source, vérifie ce que Floriva peut conserver, puis n’enregistre que ce qu’il peut lire.",
        backLabel: 'Retour aux contrôles des données',
        skipLabel: 'Passer pour le moment',
        chooseTitlePrefix: 'Emporte ton historique ',
        chooseTitleAccent: 'avec toi',
        chooseTitleSuffix: '.',
        sourceTitle: "Choisir une source d’import",
        sourcePickerDescription:
          "Choisis d’abord une source pour vérifier l’aperçu avant que Floriva n’importe quoi que ce soit.",
        sourceCardTitle: 'Sources disponibles',
        sourceStepLabel: 'Étape 1',
        previewStepLabel: 'Étape 2',
        confirmStepLabel: 'Étape 3',
        attentionDescription: "Floriva n’importe que les lignes qu’elle peut lire.",
        previewDescription:
          "Vérifie les totaux, la plage de dates et les lignes ignorées avant d’importer.",
        duplicateOnlyDescription:
          "Ces dates existent déjà dans Floriva, il n’y a donc aucune nouvelle ligne à importer depuis ce fichier.",
        manualFallbackDescription:
          "Si quelque chose d’important manque dans ce fichier, tu peux ajouter les débuts de règles manuellement.",
        reviewEyebrow: 'Import · Vérification',
        reviewTitlePrefix: 'Vérifier avant de ',
        reviewTitleAccent: 'confirmer',
        reviewTitleSuffix: '.',
        previewCardTitle: 'Détails de vérification',
        resultDescription: "Floriva n’a importé que les lignes que tu as vérifiées.",
        previewSummaryTitle: "Résumé de l’aperçu",
        resultTitle: 'Import terminé',
        completionCardTitle: "Récapitulatif de l’import",
      },
      sources: {
        clue: {
          title: 'JSON Clue',
          description:
            "Choisis un fichier d’export Clue depuis cet appareil et vérifie ce que Floriva peut conserver.",
        },
        flo: {
          title: 'JSON Flo',
          description:
            "Utilise l’export JSON demandé à Flo, puis vérifie les lignes ignorées ou non prises en charge avant l’import.",
        },
        manual: {
          title: 'Historique manuel',
          description:
            "Ajoute les débuts de règles des 12 derniers mois quand tu n’as pas de fichier d’export.",
        },
      },
      actions: {
        chooseFile: 'Choisir un fichier',
        preview: "Prévisualiser l’import",
        commit: 'Importer les lignes vérifiées',
        goToToday: "Aller à Aujourd’hui",
        goToCalendar: 'Aller au calendrier',
        useManualHistory: "Utiliser l’historique manuel",
        excludeReviewedRow: 'Exclure cette ligne',
      },
      status: {
        previewTitle: 'Prêt à importer',
        resultTitle: 'Journaux importés',
        resultSubtitle: 'Doublons ou lignes ignorées',
        attentionTitle: "L’import nécessite une attention",
      },
      confidence: {
        high: 'Confiance élevée',
        medium: 'Confiance moyenne',
        low: 'Confiance faible',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'Prêt à importer : {count}',
        'no-reviewed-days-ready': 'Prêt à importer : 0',
        'duplicate-dates-skipped': 'Dates en doublon ignorées : {count}',
        'rows-skipped': 'Lignes ignorées : {count}',
      },
      errors: {
        unsupportedMedia:
          "Cela ressemble à un fichier image ou média. Choisis un fichier d’export Clue ou Flo pour l’aperçu dans Floriva.",
        jsonParse:
          "Floriva n’a pas pu lire ce fichier comme un export JSON. Choisis un fichier .json ou .cluedata.",
        noValidHistory: "Floriva n’a trouvé aucun historique valide à examiner dans cet import.",
        readFile: "Impossible de lire ce fichier d’import.",
        commit: "Floriva n’a pas pu terminer cet import. Réessaie.",
        unsupportedShape:
          "Structure de fichier d’import Flo non prise en charge : tableau racine ou tableau \"data\"/\"values\" attendu.",
      },
      labels: {
        selectedFilePrefix: 'Fichier sélectionné :',
        dateRangeNone: 'Aucune date valide trouvée',
        localDuplicatesSkipped: 'Doublons locaux ignorés',
        rowsSkipped: 'Lignes ignorées',
        logsImported: 'Journaux importés',
        selectedExportFile: "Fichier d’export sélectionné",
        manualDateInput: 'Dates de début des règles',
        manualDateHelper:
          "Ajoute une date locale de début des règles par ligne. Floriva n’utilise que les 12 derniers mois dans cette saisie rapide.",
        manualDateDisabledHelper:
          "Saisis au moins une date de début des règles avant d’importer.",
        noFileSelected: 'Aucun fichier sélectionné pour le moment.',
        dateRangeTitle: 'Plage de dates',
        sourceTitle: 'Source',
        confidenceTitle: "Confiance de l’import",
        duplicateDatesTitle: 'Dates en doublon que Floriva ignorera',
        duplicateCountSummary: 'Dates déjà présentes dans Floriva et ignorées : {count}',
        adjustmentsTitle: 'Ce que Floriva a ajusté',
        adjustmentSummary: 'Floriva a ajusté certaines lignes de cet import avant vérification.',
        skippedRowsTitle: 'Lignes ignorées',
        skippedSummaryTitle: 'Lignes ignorées ou non prises en charge',
        unsupportedRows: 'Non prises en charge',
        invalidRows: 'Non valides',
        editedCount: 'Modifié après vérification',
        editablePreviewTitle: 'Lignes vérifiées',
        editablePreviewDescription:
          "Floriva importera uniquement les lignes vérifiées affichées ici. Excluez les lignes que vous ne voulez pas conserver avant l’import.",
        previewEntrySummary: 'Saignement : {bleeding}. Symptômes : {symptomCount}.',
      },
      skippedRows: {
        invalid: "La ligne {rowNumber} contient une date ou une valeur que Floriva n’a pas pu lire.",
        unsupported: "La ligne {rowNumber} utilise des données que Floriva n’importe pas encore.",
      },
    },
  },
  ja: {
    import: {
      screen: {
        eyebrow: 'インポート',
        title: '履歴をインポート',
        description: 'ソースを選び、Floriva が保持できる内容を確認して、読み取れるものだけを保存します。',
        backLabel: 'データ管理に戻る',
        skipLabel: '今はスキップ',
        chooseTitlePrefix: '履歴を',
        chooseTitleAccent: '一緒に持っていく',
        chooseTitleSuffix: '。',
        sourceTitle: 'インポート元を選択',
        sourcePickerDescription:
          'Floriva が何かを取り込む前に、まず元データを 1 つ選んでプレビューを確認します。',
        sourceCardTitle: '利用できるソース',
        sourceStepLabel: 'ステップ 1',
        previewStepLabel: 'ステップ 2',
        confirmStepLabel: 'ステップ 3',
        attentionDescription: 'Floriva は読み取れる行だけを取り込みます。',
        previewDescription: '件数、日付範囲、スキップされた行を確認してからインポートしてください。',
        duplicateOnlyDescription:
          'これらの日付はすでに Floriva にあるため、このファイルから新しく取り込む行はありません。',
        manualFallbackDescription:
          'このファイルに大切な内容が足りない場合は、生理開始日を手動で追加できます。',
        reviewEyebrow: 'インポート・確認',
        reviewTitlePrefix: '',
        reviewTitleAccent: '確定前に確認',
        reviewTitleSuffix: '。',
        previewCardTitle: '確認内容',
        resultDescription: 'Floriva は確認した行だけを取り込みました。',
        previewSummaryTitle: 'プレビュー概要',
        resultTitle: 'インポート完了',
        completionCardTitle: 'インポートの概要',
      },
      sources: {
        clue: {
          title: 'Clue JSON',
          description:
            'このデバイスから Clue のエクスポートファイルを選び、Floriva が保持できる内容を確認してください。',
        },
        flo: {
          title: 'Flo JSON',
          description:
            'Flo に依頼した JSON エクスポートを使用し、インポート前にスキップされた行や未対応の行を確認してください。',
        },
        manual: {
          title: '手動履歴',
          description:
            'エクスポートファイルがない場合は、過去 12 か月の生理開始日を手動で追加できます。',
        },
      },
      actions: {
        chooseFile: 'ファイルを選択',
        preview: 'インポートをプレビュー',
        commit: '確認した行をインポート',
        goToToday: '今日へ移動',
        goToCalendar: 'カレンダーへ移動',
        useManualHistory: '手動履歴を使う',
        excludeReviewedRow: 'この行を除外',
      },
      status: {
        previewTitle: 'インポート準備完了',
        resultTitle: '記録をインポートしました',
        resultSubtitle: '重複またはスキップされた行',
        attentionTitle: 'インポートに確認が必要です',
      },
      confidence: {
        high: '信頼度 高',
        medium: '信頼度 中',
        low: '信頼度 低',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'インポート準備完了: {count}',
        'no-reviewed-days-ready': 'インポート準備完了: 0',
        'duplicate-dates-skipped': 'スキップする重複日付: {count}',
        'rows-skipped': 'スキップされた行: {count}',
      },
      errors: {
        unsupportedMedia:
          '画像またはメディアファイルのようです。Floriva でプレビューするには、Clue または Flo のエクスポートファイルを選んでください。',
        jsonParse:
          'このファイルを JSON エクスポートとして読み取れませんでした。.json または .cluedata のエクスポートファイルを選んでください。',
        noValidHistory: 'そのインポートには確認できる有効な履歴が見つかりませんでした。',
        readFile: 'そのインポートファイルを読み取れませんでした。',
        commit: 'そのインポートを完了できませんでした。もう一度お試しください。',
        unsupportedShape:
          '未対応の Flo インポートファイル形式です。最上位の配列、または "data"/"values" 配列を想定しています。',
      },
      labels: {
        selectedFilePrefix: '選択されたファイル:',
        dateRangeNone: '有効な日付が見つかりませんでした',
        localDuplicatesSkipped: 'ローカルの重複をスキップしました',
        rowsSkipped: '行をスキップしました',
        logsImported: '記録をインポートしました',
        selectedExportFile: '選択されたエクスポートファイル',
        manualDateInput: '生理開始日',
        manualDateHelper:
          '各行にこの端末での生理開始日を 1 件ずつ入力してください。この簡易入力では直近 12 か月だけを使います。',
        manualDateDisabledHelper:
          'インポート前に、生理開始日を少なくとも 1 件入力してください。',
        noFileSelected: 'まだファイルが選択されていません。',
        dateRangeTitle: '日付範囲',
        sourceTitle: 'ソース',
        confidenceTitle: 'インポートの信頼度',
        duplicateDatesTitle: 'Floriva がスキップする重複日付',
        duplicateCountSummary: 'すでに Floriva にありスキップされた日付: {count}',
        adjustmentsTitle: 'Floriva が調整した内容',
        adjustmentSummary: 'Floriva は確認前にこのインポートの一部の行を調整しました。',
        skippedRowsTitle: 'スキップされた行',
        skippedSummaryTitle: 'スキップまたは未対応の行',
        unsupportedRows: '未対応',
        invalidRows: '無効',
        editedCount: '確認後に編集',
        editablePreviewTitle: '確認済みの行',
        editablePreviewDescription:
          'Floriva はここに表示された確認済みの行だけをインポートします。保存したくない行はインポート前に除外してください。',
        previewEntrySummary: '出血: {bleeding}。症状: {symptomCount}。',
      },
      skippedRows: {
        invalid: '行 {rowNumber} には Floriva が読めない日付または値があります。',
        unsupported: '行 {rowNumber} には Floriva がまだインポートしないデータがあります。',
      },
    },
  },
  'zh-Hans': {
    import: {
      screen: {
        eyebrow: '导入',
        title: '导入历史记录',
        description: '选择一个来源，预览 Floriva 能保留的内容，只保存它能读取的部分。',
        backLabel: '返回数据控制',
        skipLabel: '暂时跳过',
        chooseTitlePrefix: '带上你的历史',
        chooseTitleAccent: '一起使用',
        chooseTitleSuffix: '。',
        sourceTitle: '选择导入来源',
        sourcePickerDescription: '先选择一个来源预览，Floriva 在你确认前不会导入任何内容。',
        sourceCardTitle: '可用来源',
        sourceStepLabel: '第 1 步',
        previewStepLabel: '第 2 步',
        confirmStepLabel: '第 3 步',
        attentionDescription: 'Floriva 只会导入它能读取的行。',
        previewDescription: '导入前请先检查数量、日期范围和被跳过的行。',
        duplicateOnlyDescription:
          '这些日期已存在于 Floriva，因此此文件没有新的行可导入。',
        manualFallbackDescription:
          '如果此文件缺少重要内容，你也可以手动添加月经开始日期。',
        reviewEyebrow: '导入 · 审阅',
        reviewTitlePrefix: '确认前',
        reviewTitleAccent: '先审阅',
        reviewTitleSuffix: '。',
        previewCardTitle: '审阅详情',
        resultDescription: 'Floriva 只导入了你确认过的行。',
        previewSummaryTitle: '预览摘要',
        resultTitle: '导入完成',
        completionCardTitle: '导入摘要',
      },
      sources: {
        clue: {
          title: 'Clue JSON',
          description:
            '从此设备选择一个 Clue 导出文件，并预览 Floriva 能保留的内容。',
        },
        flo: {
          title: 'Flo JSON',
          description:
            '使用你从 Flo 请求的 JSON 导出文件，然后在导入前查看被跳过或不支持的行。',
        },
        manual: {
          title: '手动历史',
          description:
            '没有导出文件时，可以手动添加过去 12 个月的月经开始日期。',
        },
      },
      actions: {
        chooseFile: '选择文件',
        preview: '预览导入',
        commit: '导入已审阅的行',
        goToToday: '前往今天',
        goToCalendar: '前往日历',
        useManualHistory: '改用手动历史',
        excludeReviewedRow: '排除此行',
      },
      status: {
        previewTitle: '可导入',
        resultTitle: '记录已导入',
        resultSubtitle: '重复项或已跳过的行',
        attentionTitle: '导入需要注意',
      },
      confidence: {
        high: '高可信度',
        medium: '中等可信度',
        low: '低可信度',
      },
      confidenceReasons: {
        'reviewed-days-ready': '可导入：{count}',
        'no-reviewed-days-ready': '可导入：0',
        'duplicate-dates-skipped': '已跳过重复日期：{count}',
        'rows-skipped': '已跳过的行：{count}',
      },
      errors: {
        unsupportedMedia:
          '这看起来像图片或媒体文件。请选择 Clue 或 Flo 导出文件，以便在 Floriva 中预览。',
        jsonParse:
          'Floriva 无法将该文件读取为 JSON 导出文件。请选择 .json 或 .cluedata 导出文件。',
        noValidHistory: 'Floriva 在该导入中找不到可供审阅的有效历史记录。',
        readFile: '无法读取该导入文件。',
        commit: 'Floriva 无法完成该导入。请重试。',
        unsupportedShape:
          '不支持的 Flo 导入文件结构：期望顶层为数组，或者存在 "data"/"values" 数组。',
      },
      labels: {
        selectedFilePrefix: '已选择文件：',
        dateRangeNone: '未找到有效日期',
        localDuplicatesSkipped: '已跳过本地重复项',
        rowsSkipped: '已跳过的行',
        logsImported: '记录已导入',
        selectedExportFile: '已选择的导出文件',
        manualDateInput: '月经开始日期',
        manualDateHelper:
          '每行添加一个本地月经开始日期。这个快速录入路径只会使用最近 12 个月的数据。',
        manualDateDisabledHelper: '请至少输入一个月经开始日期后再导入。',
        noFileSelected: '尚未选择文件。',
        dateRangeTitle: '日期范围',
        sourceTitle: '来源',
        confidenceTitle: '导入可信度',
        duplicateDatesTitle: 'Floriva 将跳过的重复日期',
        duplicateCountSummary: '已存在于 Floriva 并被跳过的日期：{count}',
        adjustmentsTitle: 'Floriva 做了哪些调整',
        adjustmentSummary: 'Floriva 在审阅前调整了此导入中的部分行。',
        skippedRowsTitle: '被跳过的行',
        skippedSummaryTitle: '已跳过或不支持的行',
        unsupportedRows: '不支持',
        invalidRows: '无效',
        editedCount: '审阅后已编辑',
        editablePreviewTitle: '已审阅的行',
        editablePreviewDescription:
          'Floriva 只会导入这里显示的已审阅行。导入前可排除任何不想保留的行。',
        previewEntrySummary: '出血：{bleeding}。症状：{symptomCount}。',
      },
      skippedRows: {
        invalid: '第 {rowNumber} 行包含 Floriva 无法读取的日期或值。',
        unsupported: '第 {rowNumber} 行使用了 Floriva 尚不导入的数据。',
      },
    },
  },
  pt: {
    import: {
      screen: {
        eyebrow: 'Importar',
        title: 'Importar histórico',
        description: 'Escolhe uma origem, vê o que o Floriva consegue guardar e guarda apenas o que consegue ler.',
        backLabel: 'Voltar aos controlos de dados',
        skipLabel: 'Saltar por agora',
        chooseTitlePrefix: 'Traz o teu histórico ',
        chooseTitleAccent: 'contigo',
        chooseTitleSuffix: '.',
        sourceTitle: 'Escolher origem da importação',
        sourcePickerDescription:
          'Escolhe primeiro uma origem para rever a pré-visualização antes de o Floriva importar qualquer coisa.',
        sourceCardTitle: 'Origens disponíveis',
        sourceStepLabel: 'Passo 1',
        previewStepLabel: 'Passo 2',
        confirmStepLabel: 'Passo 3',
        attentionDescription: 'O Floriva só importa as linhas que consegue ler.',
        previewDescription:
          'Revê as contagens, o intervalo de datas e as linhas ignoradas antes de importar.',
        duplicateOnlyDescription:
          'Estas datas já existem no Floriva, por isso não há novas linhas para importar deste ficheiro.',
        manualFallbackDescription:
          'Se faltar algo importante neste ficheiro, podes adicionar inícios de período manualmente.',
        reviewEyebrow: 'Importar · Rever',
        reviewTitlePrefix: 'Revê antes de ',
        reviewTitleAccent: 'confirmar',
        reviewTitleSuffix: '.',
        previewCardTitle: 'Detalhes da revisão',
        resultDescription: 'O Floriva só trouxe as linhas que reviste.',
        previewSummaryTitle: 'Resumo da pré-visualização',
        resultTitle: 'Importação concluída',
        completionCardTitle: 'Resumo da importação',
      },
      sources: {
        clue: {
          title: 'JSON do Clue',
          description:
            'Escolhe um ficheiro exportado do Clue neste dispositivo e vê o que o Floriva consegue guardar.',
        },
        flo: {
          title: 'JSON do Flo',
          description:
            'Usa a exportação JSON que pediste ao Flo e revê as linhas ignoradas ou não suportadas antes de importar.',
        },
        manual: {
          title: 'Histórico manual',
          description:
            'Adiciona os inícios de período dos últimos 12 meses quando não tens um ficheiro exportado.',
        },
      },
      actions: {
        chooseFile: 'Escolher ficheiro',
        preview: 'Pré-visualizar importação',
        commit: 'Importar linhas revistas',
        goToToday: 'Ir para Hoje',
        goToCalendar: 'Ir para o Calendário',
        useManualHistory: 'Usar histórico manual',
        excludeReviewedRow: 'Excluir esta linha',
      },
      status: {
        previewTitle: 'Pronto para importar',
        resultTitle: 'Registos importados',
        resultSubtitle: 'Duplicados ou linhas ignoradas',
        attentionTitle: 'A importação precisa de atenção',
      },
      confidence: {
        high: 'Confiança alta',
        medium: 'Confiança média',
        low: 'Confiança baixa',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'Pronto para importar: {count}',
        'no-reviewed-days-ready': 'Pronto para importar: 0',
        'duplicate-dates-skipped': 'Datas duplicadas ignoradas: {count}',
        'rows-skipped': 'Linhas ignoradas: {count}',
      },
      errors: {
        unsupportedMedia:
          'Isto parece um ficheiro de imagem ou multimédia. Escolhe um ficheiro de exportação do Clue ou do Flo para pré-visualizar no Floriva.',
        jsonParse:
          'O Floriva não conseguiu ler esse ficheiro como uma exportação JSON. Escolhe um ficheiro .json ou .cluedata.',
        noValidHistory: 'O Floriva não encontrou histórico válido para rever nessa importação.',
        readFile: 'Não foi possível ler esse ficheiro de importação.',
        commit: 'O Floriva não conseguiu concluir essa importação. Tenta novamente.',
        unsupportedShape:
          'Formato de ficheiro de importação do Flo não suportado: esperava-se um array no nível superior ou um array "data"/"values".',
      },
      labels: {
        selectedFilePrefix: 'Ficheiro selecionado:',
        dateRangeNone: 'Não foram encontradas datas válidas',
        localDuplicatesSkipped: 'Duplicados locais ignorados',
        rowsSkipped: 'Linhas ignoradas',
        logsImported: 'Registos importados',
        selectedExportFile: 'Ficheiro de exportação selecionado',
        manualDateInput: 'Datas de início do período',
        manualDateHelper:
          'Adiciona uma data local de início do período por linha. O Floriva só usa os últimos 12 meses neste atalho.',
        manualDateDisabledHelper:
          'Introduz pelo menos uma data de início do período antes de importar.',
        noFileSelected: 'Ainda não foi selecionado nenhum ficheiro.',
        dateRangeTitle: 'Intervalo de datas',
        sourceTitle: 'Origem',
        confidenceTitle: 'Confiança da importação',
        duplicateDatesTitle: 'Datas duplicadas que o Floriva vai ignorar',
        duplicateCountSummary: 'Datas que já existem no Floriva e foram ignoradas: {count}',
        adjustmentsTitle: 'O que o Floriva ajustou',
        adjustmentSummary: 'O Floriva ajustou algumas linhas desta importação antes da revisão.',
        skippedRowsTitle: 'Linhas ignoradas',
        skippedSummaryTitle: 'Linhas ignoradas ou não suportadas',
        unsupportedRows: 'Não suportadas',
        invalidRows: 'Inválidas',
        editedCount: 'Editado após revisão',
        editablePreviewTitle: 'Linhas revistas',
        editablePreviewDescription:
          'O Floriva só vai importar as linhas revistas mostradas aqui. Exclua qualquer linha que não queira manter antes de importar.',
        previewEntrySummary: 'Sangramento: {bleeding}. Sintomas: {symptomCount}.',
      },
      skippedRows: {
        invalid: 'A linha {rowNumber} tem uma data ou valor que o Floriva não conseguiu ler.',
        unsupported: 'A linha {rowNumber} usa dados que o Floriva ainda não importa.',
      },
    },
  },
  ru: {
    import: {
      screen: {
        eyebrow: 'Импорт',
        title: 'Импорт истории',
        description: 'Выберите источник, посмотрите, что Floriva может сохранить, и добавьте только то, что она может прочитать.',
        backLabel: 'Назад к управлению данными',
        skipLabel: 'Пропустить пока',
        chooseTitlePrefix: 'Возьмите историю ',
        chooseTitleAccent: 'с собой',
        chooseTitleSuffix: '.',
        sourceTitle: 'Выберите источник импорта',
        sourcePickerDescription:
          'Сначала выберите один источник и проверьте предварительный просмотр, прежде чем Floriva что-либо импортирует.',
        sourceCardTitle: 'Доступные источники',
        sourceStepLabel: 'Шаг 1',
        previewStepLabel: 'Шаг 2',
        confirmStepLabel: 'Шаг 3',
        attentionDescription: 'Floriva импортирует только те строки, которые может прочитать.',
        previewDescription:
          'Перед импортом проверьте количество записей, диапазон дат и пропущенные строки.',
        duplicateOnlyDescription:
          'Эти даты уже есть в Floriva, поэтому в этом файле нет новых строк для импорта.',
        manualFallbackDescription:
          'Если в этом файле не хватает важных данных, можно добавить даты начала менструации вручную.',
        reviewEyebrow: 'Импорт · Проверка',
        reviewTitlePrefix: 'Проверьте перед ',
        reviewTitleAccent: 'подтверждением',
        reviewTitleSuffix: '.',
        previewCardTitle: 'Детали проверки',
        resultDescription: 'Floriva импортировала только те строки, которые вы просмотрели.',
        previewSummaryTitle: 'Сводка предпросмотра',
        resultTitle: 'Импорт завершён',
        completionCardTitle: 'Сводка импорта',
      },
      sources: {
        clue: {
          title: 'JSON из Clue',
          description:
            'Выберите файл экспорта Clue с этого устройства и посмотрите, что Floriva может сохранить.',
        },
        flo: {
          title: 'JSON из Flo',
          description:
            'Используйте JSON-экспорт, который вы запросили у Flo, а затем проверьте пропущенные или неподдерживаемые строки перед импортом.',
        },
        manual: {
          title: 'Ручная история',
          description:
            'Добавьте даты начала менструации за последние 12 месяцев, если файла экспорта нет.',
        },
      },
      actions: {
        chooseFile: 'Выбрать файл',
        preview: 'Предпросмотр импорта',
        commit: 'Импортировать проверенные строки',
        goToToday: 'Перейти к Сегодня',
        goToCalendar: 'Перейти к Календарю',
        useManualHistory: 'Использовать ручную историю',
        excludeReviewedRow: 'Исключить эту строку',
      },
      status: {
        previewTitle: 'Готово к импорту',
        resultTitle: 'Записи импортированы',
        resultSubtitle: 'Дубликаты или пропущенные строки',
        attentionTitle: 'Импорт требует внимания',
      },
      confidence: {
        high: 'Высокая уверенность',
        medium: 'Средняя уверенность',
        low: 'Низкая уверенность',
      },
      confidenceReasons: {
        'reviewed-days-ready': 'Готово к импорту: {count}',
        'no-reviewed-days-ready': 'Готово к импорту: 0',
        'duplicate-dates-skipped': 'Даты-дубликаты пропущены: {count}',
        'rows-skipped': 'Строки пропущены: {count}',
      },
      errors: {
        unsupportedMedia:
          'Похоже на файл изображения или мультимедиа. Выберите файл экспорта Clue или Flo, чтобы просмотреть его в Floriva.',
        jsonParse:
          'Floriva не смогла прочитать этот файл как JSON-экспорт. Выберите файл экспорта .json или .cluedata.',
        noValidHistory: 'Floriva не нашла в этом импорте ни одной валидной записи для проверки.',
        readFile: 'Не удалось прочитать этот файл импорта.',
        commit: 'Floriva не смогла завершить этот импорт. Попробуйте ещё раз.',
        unsupportedShape:
          'Неподдерживаемая структура файла импорта Flo: ожидался верхнеуровневый массив или массив "data"/"values".',
      },
      labels: {
        selectedFilePrefix: 'Выбранный файл:',
        dateRangeNone: 'Не найдено допустимых дат',
        localDuplicatesSkipped: 'Локальные дубликаты пропущены',
        rowsSkipped: 'Строки пропущены',
        logsImported: 'Записи импортированы',
        selectedExportFile: 'Выбранный файл экспорта',
        manualDateInput: 'Даты начала менструации',
        manualDateHelper:
          'Добавьте по одной локальной дате начала менструации в каждой строке. В этом быстром режиме Floriva использует только последние 12 месяцев.',
        manualDateDisabledHelper:
          'Введите хотя бы одну дату начала менструации перед импортом.',
        noFileSelected: 'Файл ещё не выбран.',
        dateRangeTitle: 'Диапазон дат',
        sourceTitle: 'Источник',
        confidenceTitle: 'Уверенность импорта',
        duplicateDatesTitle: 'Даты-дубликаты, которые Floriva пропустит',
        duplicateCountSummary: 'Даты уже есть в Floriva и будут пропущены: {count}',
        adjustmentsTitle: 'Что скорректировала Floriva',
        adjustmentSummary: 'Floriva скорректировала часть строк этого импорта перед проверкой.',
        skippedRowsTitle: 'Пропущенные строки',
        skippedSummaryTitle: 'Пропущенные или неподдерживаемые строки',
        unsupportedRows: 'Неподдерживаемые',
        invalidRows: 'Недопустимые',
        editedCount: 'Изменено после проверки',
        editablePreviewTitle: 'Проверенные строки',
        editablePreviewDescription:
          'Floriva импортирует только проверенные строки, показанные здесь. Исключите любую строку, которую не хотите сохранять, до импорта.',
        previewEntrySummary: 'Кровотечение: {bleeding}. Симптомы: {symptomCount}.',
      },
      skippedRows: {
        invalid: 'В строке {rowNumber} есть дата или значение, которое Floriva не смогла прочитать.',
        unsupported: 'Строка {rowNumber} содержит данные, которые Floriva пока не импортирует.',
      },
    },
  },
} as const;
