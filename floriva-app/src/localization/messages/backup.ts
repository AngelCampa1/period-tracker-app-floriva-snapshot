const backupEnglishMessages = {
  backup: {
    screen: {
      eyebrow: 'Backup',
      title: 'Backup and restore',
      description:
        'Create an encrypted backup file, or restore one you already have.',
      backLabel: 'Back to data controls',
      backToWelcome: 'Back to welcome',
      statusCardTitle: 'Backup ready',
      errorCardTitle: 'Backup needs attention',
    },
    export: {
      title: 'Export backup',
      description:
        "Set a passphrase and create the backup file. Then move it off this device.",
      status: 'Encrypted backup file created on this device.',
      mismatchError: 'Enter the same passphrase twice before creating the file.',
      passphraseLengthError:
        'Use at least 12 characters for your backup passphrase.',
      genericError: 'Backup export could not finish.',
      unavailableError:
        'This backup needs a newer version of Floriva on this device.',
      storageUnavailableError:
        'Floriva could not access local storage on this device.',
      passphraseLabel: 'Backup passphrase',
      confirmPassphraseLabel: 'Confirm passphrase',
      exportButton: 'Create backup file',
      localOnlyNote: 'Floriva encrypts the file before you move it off this device.',
      passphraseSafetyNote:
        'Floriva cannot recover this passphrase. Store it somewhere safe.',
    },
    restore: {
      title: 'Restore backup',
      description:
        'Choose a Floriva backup file, enter its passphrase, and preview the restore before you confirm.',
      passphraseLabel: 'Restore passphrase',
      selectedFilePrefix: 'Selected backup file:',
      chooseFileButton: 'Choose backup file',
      previewButton: 'Preview restore',
      confirmButton: 'Restore this backup',
      continueButton: 'Continue',
      missingFileError: 'Choose a Floriva backup file before previewing the restore.',
      missingPassphraseError: 'Choose a backup file and enter its passphrase before previewing the restore.',
      fileOpenError: 'Floriva could not open that file.',
      genericPreviewError: 'Floriva could not preview that restore.',
      wrongPassphraseError: 'That passphrase did not unlock this backup.',
      unsupportedFormatError:
        'This backup needs a newer version of Floriva before it can be restored here.',
      invalidFileError:
        'Floriva could not read that backup. Choose a .floriva file exported from Floriva.',
      status: 'Backup restored on this device.',
      statusWithFollowUp:
        'Backup restored on this device. Turn biometric lock back on if you use it. Restore purchases if needed.',
      reloadError:
        'Backup data was restored, but Floriva needs to reload before you continue. Close and reopen the app.',
      commitError:
        'Floriva could not finish restoring this backup. Your current data was not replaced.',
      selectedFileDefault: 'Selected Floriva backup',
      noFileSelected: 'No backup file selected yet.',
      previewTitle: 'Restore preview',
      previewDescription:
        'This will replace all current Floriva data on this device with the backup contents.',
      logsToRestore: 'Logs to restore',
      importSessions: 'Import sessions',
      trackedPeriodDays: 'Tracked period days',
      exportedOn: 'Exported on',
      logDateRange: 'Log date range',
      noLogsInBackup: 'No logs',
      reminders: 'Reminders',
      cycleProfile: 'Cycle setup',
      cycleProfileReady: 'Included',
      cycleProfileMissing: 'Not included',
      replaceDataNote:
        'Review this carefully. Confirming will replace the current data on this device.',
      acknowledgeReplaceButton: 'I understand this replaces current data',
      chooseDifferentFileButton: 'Choose a different file',
      biometricsNote:
        'Turn biometric lock back on after the restore if you use it on this device.',
      billingNote: 'Restore purchases after the restore if your billing state changed.',
    },
  },
} as const;

export const backupMessages = {
  en: backupEnglishMessages,
  es: {
    backup: {
      screen: {
        eyebrow: 'Copia de seguridad',
        title: 'Copia de seguridad y restauración',
        description:
          'Crea una copia cifrada o restaura una que ya tengas.',
        backLabel: 'Volver a controles de datos',
        backToWelcome: 'Volver a la bienvenida',
        statusCardTitle: 'Copia lista',
        errorCardTitle: 'La copia necesita atención',
      },
      export: {
        title: 'Exportar copia',
        description:
          'Elige una frase de acceso, crea el archivo de copia y muévelo fuera de este dispositivo cuando quieras.',
        status: 'La copia cifrada se creó en este dispositivo.',
        mismatchError: 'Escribe la misma frase de acceso dos veces antes de crear el archivo.',
        passphraseLengthError:
          'Usa al menos 12 caracteres para esta frase de acceso.',
        genericError: 'No se pudo completar la exportación de la copia.',
        unavailableError:
          'La copia necesita una versión más reciente de Floriva en este dispositivo para terminar aquí.',
        storageUnavailableError:
          'Floriva no pudo acceder al almacenamiento local de documentos en este dispositivo.',
        passphraseLabel: 'Frase de acceso de la copia',
        confirmPassphraseLabel: 'Confirmar frase de acceso',
        exportButton: 'Crear archivo de copia',
        localOnlyNote: 'Floriva cifra el archivo antes de que lo saques de este dispositivo.',
        passphraseSafetyNote:
          'Floriva no puede recuperar esta frase de acceso. Guárdala en un lugar seguro.',
      },
      restore: {
        title: 'Restaurar copia',
        description:
          'Elige un archivo de copia de Floriva, introduce su frase de acceso y revisa la restauración antes de confirmarla.',
        passphraseLabel: 'Frase de acceso para restaurar',
        selectedFilePrefix: 'Archivo de copia seleccionado:',
        chooseFileButton: 'Elegir archivo de copia',
        previewButton: 'Vista previa de la restauración',
        confirmButton: 'Restaurar esta copia',
        continueButton: 'Continuar',
        missingFileError: 'Elige un archivo de copia de Floriva antes de revisar la restauración.',
        missingPassphraseError:
          'Elige un archivo de copia e introduce su frase de acceso antes de revisar la restauración.',
        fileOpenError: 'Floriva no pudo abrir ese archivo.',
        genericPreviewError: 'Floriva no pudo revisar esa restauración.',
        wrongPassphraseError: 'Esa frase de acceso no desbloqueó esta copia.',
        unsupportedFormatError:
          'Esta copia necesita una versión más reciente de Floriva antes de restaurarse aquí.',
        invalidFileError:
          'Floriva no pudo leer esa copia. Elige un archivo .floriva exportado desde Floriva.',
        status: 'La copia se restauró en este dispositivo.',
        statusWithFollowUp:
          'La copia se restauró en este dispositivo. Vuelve a activar el bloqueo biométrico y restaura las compras si hace falta.',
        reloadError:
          'Los datos de la copia se restauraron localmente, pero Floriva debe recargarlos antes de que continúes. Cierra y vuelve a abrir la app.',
        commitError:
          'Floriva no pudo terminar de restaurar esta copia. Tus datos actuales no se sustituyeron.',
        selectedFileDefault: 'Copia de Floriva seleccionada',
        noFileSelected: 'Todavía no se ha seleccionado ningún archivo de copia.',
        previewTitle: 'Vista previa de la restauración',
        previewDescription:
          'Restaurar sustituye todos los datos actuales de Floriva en este dispositivo por el contenido de la copia.',
        logsToRestore: 'Registros para restaurar',
        importSessions: 'Sesiones de importación',
        trackedPeriodDays: 'Días de periodo registrados',
        exportedOn: 'Exportada el',
        logDateRange: 'Rango de fechas',
        noLogsInBackup: 'Sin registros',
        reminders: 'Recordatorios',
        cycleProfile: 'Configuración del ciclo',
        cycleProfileReady: 'Incluida',
        cycleProfileMissing: 'No incluida',
        replaceDataNote:
          'Revísalo con cuidado. Al confirmar, se sustituirán los datos locales actuales de este dispositivo.',
        acknowledgeReplaceButton:
          'Entiendo que esto sustituye los datos actuales',
        chooseDifferentFileButton: 'Elegir otro archivo',
        biometricsNote:
          'Vuelve a activar el bloqueo biométrico después de restaurar si quieres usarlo en este dispositivo.',
        billingNote:
          'Restaura tus compras después de restaurar la copia si tu estado de facturación cambió.',
      },
    },
  },
  de: {
    backup: {
      screen: {
        eyebrow: 'Backup',
        title: 'Backup und Wiederherstellung',
        description:
          'Erstelle ein verschlüsseltes Backup oder stelle eine Floriva-Datei wieder her, die du bereits hast.',
        backLabel: 'Zurück zu den Datenkontrollen',
        backToWelcome: 'Zurück zur Begrüßung',
        statusCardTitle: 'Backup bereit',
        errorCardTitle: 'Backup braucht Aufmerksamkeit',
      },
      export: {
        title: 'Backup exportieren',
        description:
          'Wähle eine Passphrase, erstelle die Backup-Datei und verschiebe sie von diesem Gerät, wenn du bereit bist.',
        status: 'Die verschlüsselte Backup-Datei wurde auf diesem Gerät erstellt.',
        mismatchError: 'Gib dieselbe Passphrase zweimal ein, bevor du die Datei erstellst.',
        passphraseLengthError:
          'Verwende mindestens 12 Zeichen für diese Backup-Passphrase.',
        genericError: 'Der Backup-Export konnte nicht abgeschlossen werden.',
        unavailableError:
          'Das Backup benötigt auf diesem Gerät einen neueren Floriva-Build, bevor es hier abgeschlossen werden kann.',
        storageUnavailableError:
          'Floriva konnte auf diesem Gerät nicht auf den lokalen Dokumentenspeicher zugreifen.',
        passphraseLabel: 'Backup-Passphrase',
        confirmPassphraseLabel: 'Passphrase bestätigen',
        exportButton: 'Backup-Datei erstellen',
        localOnlyNote:
          'Floriva verschlüsselt die Datei lokal, bevor du sie an einen anderen Ort verschiebst.',
        passphraseSafetyNote:
          'Floriva kann diese Passphrase nicht wiederherstellen. Bewahre sie sicher auf.',
      },
      restore: {
        title: 'Backup wiederherstellen',
        description:
          'Wähle eine Floriva-Backup-Datei, gib ihre Passphrase ein und prüfe die Wiederherstellung vor dem Bestätigen.',
        passphraseLabel: 'Wiederherstellungs-Passphrase',
        selectedFilePrefix: 'Ausgewählte Backup-Datei:',
        chooseFileButton: 'Backup-Datei wählen',
        previewButton: 'Wiederherstellung prüfen',
        confirmButton: 'Dieses Backup wiederherstellen',
        continueButton: 'Weiter',
        missingFileError:
          'Wähle eine Floriva-Backup-Datei, bevor du die Wiederherstellung prüfst.',
        missingPassphraseError:
          'Wähle eine Backup-Datei und gib ihre Passphrase ein, bevor du die Wiederherstellung prüfst.',
        fileOpenError: 'Floriva konnte diese Datei nicht öffnen.',
        genericPreviewError: 'Floriva konnte diese Wiederherstellung nicht prüfen.',
        wrongPassphraseError: 'Diese Passphrase hat dieses Backup nicht entsperrt.',
        unsupportedFormatError:
          'Dieses Backup benötigt einen neueren Floriva-Build, bevor es hier wiederhergestellt werden kann.',
        invalidFileError:
          'Floriva konnte dieses Backup nicht lesen. Wähle eine aus Floriva exportierte .floriva-Datei.',
        status: 'Das Backup wurde auf diesem Gerät wiederhergestellt.',
        statusWithFollowUp:
          'Das Backup wurde auf diesem Gerät wiederhergestellt. Aktiviere bei Bedarf die biometrische Sperre erneut und stelle Käufe wieder her.',
        reloadError:
          'Die Backup-Daten wurden lokal wiederhergestellt, aber Floriva muss sie neu laden, bevor du fortfahren kannst. Schließe die App und öffne sie erneut.',
        commitError:
          'Floriva konnte dieses Backup nicht vollständig wiederherstellen. Deine aktuellen Daten wurden nicht ersetzt.',
        selectedFileDefault: 'Ausgewähltes Floriva-Backup',
        noFileSelected: 'Noch keine Backup-Datei ausgewählt.',
        previewTitle: 'Vorschau der Wiederherstellung',
        previewDescription:
          'Beim Wiederherstellen werden alle aktuellen Floriva-Daten auf diesem Gerät durch den Inhalt des Backups ersetzt.',
        logsToRestore: 'Wiederherzustellende Einträge',
        importSessions: 'Importsitzungen',
        trackedPeriodDays: 'Erfasste Periodentage',
        exportedOn: 'Exportiert am',
        logDateRange: 'Datumsbereich',
        noLogsInBackup: 'Keine Einträge',
        reminders: 'Erinnerungen',
        cycleProfile: 'Zykluseinrichtung',
        cycleProfileReady: 'Enthalten',
        cycleProfileMissing: 'Nicht enthalten',
        replaceDataNote:
          'Prüfe das sorgfältig. Mit der Bestätigung werden die aktuellen lokalen Daten auf diesem Gerät ersetzt.',
        acknowledgeReplaceButton:
          'Ich verstehe, dass aktuelle Daten ersetzt werden',
        chooseDifferentFileButton: 'Andere Datei wählen',
        biometricsNote:
          'Die biometrische Sperre bleibt aus, bis du sie auf diesem Gerät wieder aktivierst.',
        billingNote:
          'Stelle Käufe nach der Wiederherstellung des Backups wieder her, wenn sich dein Abrechnungsstatus geändert hat.',
      },
    },
  },
  fr: {
    backup: {
      screen: {
        eyebrow: 'Sauvegarde',
        title: 'Sauvegarde et restauration',
        description:
          'Crée une sauvegarde chiffrée ou restaure un fichier Floriva que tu as déjà.',
        backLabel: 'Retour aux contrôles des données',
        backToWelcome: "Retour à l’accueil",
        statusCardTitle: 'Sauvegarde prête',
        errorCardTitle: 'La sauvegarde nécessite une attention',
      },
      export: {
        title: 'Exporter la sauvegarde',
        description:
          'Choisis une phrase secrète, crée le fichier de sauvegarde, puis déplace-le hors de cet appareil quand tu veux.',
        status: 'Le fichier de sauvegarde chiffré a été créé sur cet appareil.',
        mismatchError:
          'Saisis la même phrase secrète deux fois avant de créer le fichier.',
        passphraseLengthError:
          'Utilise au moins 12 caractères pour cette phrase secrète.',
        genericError: "L'export de la sauvegarde n'a pas pu se terminer.",
        unavailableError:
          "La sauvegarde a besoin d’une version plus récente de Floriva sur cet appareil pour se terminer ici.",
        storageUnavailableError:
          "Floriva n’a pas pu accéder au stockage local des documents sur cet appareil.",
        passphraseLabel: 'Phrase secrète de sauvegarde',
        confirmPassphraseLabel: 'Confirmer la phrase secrète',
        exportButton: 'Créer le fichier de sauvegarde',
        localOnlyNote:
          'Floriva chiffre le fichier localement avant que tu le déplaces ailleurs.',
        passphraseSafetyNote:
          'Floriva ne peut pas récupérer cette phrase secrète. Garde-la dans un endroit sûr.',
      },
      restore: {
        title: 'Restaurer la sauvegarde',
        description:
          'Choisis un fichier de sauvegarde Floriva, saisis sa phrase secrète, puis prévisualise la restauration avant de la valider.',
        passphraseLabel: 'Phrase secrète de restauration',
        selectedFilePrefix: 'Fichier de sauvegarde sélectionné :',
        chooseFileButton: 'Choisir un fichier de sauvegarde',
        previewButton: 'Prévisualiser la restauration',
        confirmButton: 'Restaurer cette sauvegarde',
        continueButton: 'Continuer',
        missingFileError:
          'Choisis un fichier de sauvegarde Floriva avant de prévisualiser la restauration.',
        missingPassphraseError:
          'Choisis un fichier de sauvegarde et saisis sa phrase secrète avant de prévisualiser la restauration.',
        fileOpenError: "Floriva n’a pas pu ouvrir ce fichier.",
        genericPreviewError: "Floriva n’a pas pu prévisualiser cette restauration.",
        wrongPassphraseError:
          "Cette phrase secrète n’a pas déverrouillé cette sauvegarde.",
        unsupportedFormatError:
          'Cette sauvegarde nécessite une version plus récente de Floriva avant de pouvoir être restaurée ici.',
        invalidFileError:
          "Floriva n’a pas pu lire cette sauvegarde. Choisis un fichier .floriva exporté depuis Floriva.",
        status: 'La sauvegarde a été restaurée sur cet appareil.',
        statusWithFollowUp:
          'La sauvegarde a été restaurée sur cet appareil. Réactive le verrouillage biométrique et restaure les achats si nécessaire.',
        reloadError:
          "Les données de la sauvegarde ont été restaurées localement, mais Floriva doit les recharger avant que tu continues. Ferme puis rouvre l’app.",
        commitError:
          "Floriva n’a pas pu terminer la restauration de cette sauvegarde. Tes données actuelles n’ont pas été remplacées.",
        selectedFileDefault: 'Sauvegarde Floriva sélectionnée',
        noFileSelected: 'Aucun fichier de sauvegarde sélectionné pour le moment.',
        previewTitle: 'Aperçu de la restauration',
        previewDescription:
          'La restauration remplace toutes les données Floriva actuelles sur cet appareil par le contenu de la sauvegarde.',
        logsToRestore: 'Journaux à restaurer',
        importSessions: "Sessions d’import",
        trackedPeriodDays: 'Jours de règles suivis',
        exportedOn: 'Exportée le',
        logDateRange: 'Plage de dates',
        noLogsInBackup: 'Aucun journal',
        reminders: 'Rappels',
        cycleProfile: 'Configuration du cycle',
        cycleProfileReady: 'Incluse',
        cycleProfileMissing: 'Non incluse',
        replaceDataNote:
          'Vérifie attentivement. En confirmant, tu remplaceras les données locales actuelles sur cet appareil.',
        acknowledgeReplaceButton:
          'Je comprends que cela remplace les données actuelles',
        chooseDifferentFileButton: 'Choisir un autre fichier',
        biometricsNote:
          "Réactive le verrouillage biométrique après la restauration si tu veux l’utiliser sur cet appareil.",
        billingNote:
          'Restaure les achats après la restauration de la sauvegarde si ton statut de facturation a changé.',
      },
    },
  },
  ja: {
    backup: {
      screen: {
        eyebrow: 'バックアップ',
        title: 'バックアップと復元',
        description:
          '暗号化されたバックアップを作成するか、手元にある Floriva ファイルを復元します。',
        backLabel: 'データ管理に戻る',
        backToWelcome: 'ようこそ画面に戻る',
        statusCardTitle: 'バックアップの準備ができました',
        errorCardTitle: 'バックアップに確認が必要です',
      },
      export: {
        title: 'バックアップを書き出す',
        description:
          'パスフレーズを選び、バックアップファイルを作成し、準備ができたらこの端末の外へ移動します。',
        status: '暗号化されたバックアップファイルをこの端末上に作成しました。',
        mismatchError:
          'ファイルを作成する前に、同じパスフレーズを 2 回入力してください。',
        passphraseLengthError:
          'このバックアップのパスフレーズは 12 文字以上にしてください。',
        genericError: 'バックアップの書き出しを完了できませんでした。',
        unavailableError:
          'ここで完了するには、この端末でより新しい Floriva ビルドが必要です。',
        storageUnavailableError:
          'Floriva はこの端末のローカル書類ストレージにアクセスできませんでした。',
        passphraseLabel: 'バックアップのパスフレーズ',
        confirmPassphraseLabel: 'パスフレーズを確認',
        exportButton: 'バックアップファイルを作成',
        localOnlyNote:
          'Floriva は、ファイルを別の場所へ移す前に端末上でローカルに暗号化します。',
        passphraseSafetyNote:
          'Floriva はこのパスフレーズを復元できません。安全な場所に保管してください。',
      },
      restore: {
        title: 'バックアップを復元',
        description:
          'Floriva のバックアップファイルを選び、パスフレーズを入力して、確定前に復元内容を確認します。',
        passphraseLabel: '復元用パスフレーズ',
        selectedFilePrefix: '選択したバックアップファイル:',
        chooseFileButton: 'バックアップファイルを選ぶ',
        previewButton: '復元を確認',
        confirmButton: 'このバックアップを復元',
        continueButton: '続ける',
        missingFileError:
          '復元を確認する前に Floriva のバックアップファイルを選んでください。',
        missingPassphraseError:
          '復元を確認する前にバックアップファイルを選び、パスフレーズを入力してください。',
        fileOpenError: 'Floriva はそのファイルを開けませんでした。',
        genericPreviewError: 'Floriva はその復元内容を確認できませんでした。',
        wrongPassphraseError:
          'そのパスフレーズではこのバックアップを解除できませんでした。',
        unsupportedFormatError:
          'このバックアップをここで復元するには、より新しい Floriva ビルドが必要です。',
        invalidFileError:
          'Floriva はそのバックアップを読み取れませんでした。Floriva から書き出した .floriva ファイルを選んでください。',
        status: 'この端末でバックアップが復元されました。',
        statusWithFollowUp:
          'この端末でバックアップが復元されました。必要に応じて生体認証ロックを再度有効にし、購入を復元してください。',
        reloadError:
          'バックアップデータはこの端末に復元されましたが、続行する前に Floriva で再読み込みする必要があります。アプリを閉じてからもう一度開いてください。',
        commitError:
          'Floriva はこのバックアップの復元を完了できませんでした。現在のデータは置き換えられていません。',
        selectedFileDefault: '選択した Floriva バックアップ',
        noFileSelected: 'まだバックアップファイルが選択されていません。',
        previewTitle: '復元プレビュー',
        previewDescription:
          '復元すると、この端末上の現在の Floriva データはバックアップの内容に置き換わります。',
        logsToRestore: '復元する記録',
        importSessions: 'インポートセッション',
        trackedPeriodDays: '記録された生理日数',
        exportedOn: '書き出し日',
        logDateRange: '記録の日付範囲',
        noLogsInBackup: '記録なし',
        reminders: 'リマインダー',
        cycleProfile: '周期設定',
        cycleProfileReady: '含まれています',
        cycleProfileMissing: '含まれていません',
        replaceDataNote:
          '内容をよく確認してください。確定すると、この端末上の現在のローカルデータが置き換わります。',
        acknowledgeReplaceButton:
          '現在のデータが置き換わることを理解しました',
        chooseDifferentFileButton: '別のファイルを選ぶ',
        biometricsNote:
          '生体認証ロックは、この端末で再度有効にするまでオフのままです。',
        billingNote:
          '請求状態が変わった場合は、バックアップ復元後に購入を復元してください。',
      },
    },
  },
  'zh-Hans': {
    backup: {
      screen: {
        eyebrow: '备份',
        title: '备份与恢复',
        description:
          '创建加密备份，或恢复你已有的 Floriva 文件。',
        backLabel: '返回数据控制',
        backToWelcome: '返回欢迎页',
        statusCardTitle: '备份已就绪',
        errorCardTitle: '备份需要你处理',
      },
      export: {
        title: '导出备份',
        description:
          '选择一个口令，创建备份文件，并在准备好后将它移出这台设备。',
        status: '加密备份文件已在这台设备上创建。',
        mismatchError: '创建文件前，请输入两次相同的口令。',
        genericError: '无法完成备份导出。',
        unavailableError:
          '要在这台设备上完成此操作，备份功能需要更新版本的 Floriva。',
        storageUnavailableError:
          'Floriva 无法访问这台设备上的本地文档存储。',
        passphraseLabel: '备份口令',
        confirmPassphraseLabel: '确认口令',
        exportButton: '创建备份文件',
        passphraseLengthError: '这个备份口令至少需要 12 个字符。',
        localOnlyNote: 'Floriva 会先在本地加密文件，然后你再决定把它移到别处。',
        passphraseSafetyNote:
          'Floriva 无法找回这个口令。请把它保存在安全的地方。',
      },
      restore: {
        title: '恢复备份',
        description:
          '选择一个 Floriva 备份文件，输入它的口令，并在确认前预览恢复内容。',
        passphraseLabel: '恢复口令',
        selectedFilePrefix: '已选择的备份文件：',
        chooseFileButton: '选择备份文件',
        previewButton: '预览恢复',
        confirmButton: '恢复此备份',
        continueButton: '继续',
        missingFileError: '预览恢复前，请先选择一个 Floriva 备份文件。',
        missingPassphraseError:
          '预览恢复前，请先选择备份文件并输入它的口令。',
        fileOpenError: 'Floriva 无法打开该文件。',
        genericPreviewError: 'Floriva 无法预览这次恢复。',
        wrongPassphraseError: '该口令无法解锁这个备份。',
        unsupportedFormatError:
          '这个备份需要更新版本的 Floriva 才能在这里恢复。',
        invalidFileError:
          'Floriva 无法读取这个备份。请选择从 Floriva 导出的 .floriva 文件。',
        status: '备份已在这台设备上恢复。',
        statusWithFollowUp:
          '备份已在这台设备上恢复。如有需要，请重新启用生物识别锁并恢复购买。',
        reloadError:
          '备份数据已在本地恢复，但你继续之前 Floriva 需要重新加载这些数据。请关闭应用并重新打开。',
        commitError:
          'Floriva 无法完成此备份恢复。你当前的数据没有被替换。',
        selectedFileDefault: '已选择的 Floriva 备份',
        noFileSelected: '尚未选择备份文件。',
        previewTitle: '恢复预览',
        previewDescription:
          '恢复会用备份内容替换这台设备上当前所有 Floriva 数据。',
        logsToRestore: '要恢复的记录',
        importSessions: '导入会话',
        trackedPeriodDays: '已记录的经期天数',
        exportedOn: '导出日期',
        logDateRange: '记录日期范围',
        noLogsInBackup: '没有记录',
        reminders: '提醒',
        cycleProfile: '周期设置',
        cycleProfileReady: '已包含',
        cycleProfileMissing: '未包含',
        replaceDataNote:
          '请仔细检查。确认后，这台设备上当前的本地数据会被替换。',
        acknowledgeReplaceButton: '我明白这会替换当前数据',
        chooseDifferentFileButton: '选择其他文件',
        biometricsNote:
          '生物识别锁会保持关闭，直到你在这台设备上重新启用它。',
        billingNote:
          '如果你的计费状态发生变化，请在恢复备份后恢复购买。',
      },
    },
  },
  pt: {
    backup: {
      screen: {
        eyebrow: 'Cópia de segurança',
        title: 'Cópia de segurança e restauro',
        description:
          'Cria uma cópia encriptada ou restaura um ficheiro Floriva que já tens.',
        backLabel: 'Voltar aos controlos de dados',
        backToWelcome: 'Voltar às boas-vindas',
        statusCardTitle: 'Cópia pronta',
        errorCardTitle: 'A cópia precisa de atenção',
      },
      export: {
        title: 'Exportar cópia',
        description:
          'Escolhe uma frase-passe, cria o ficheiro de cópia e move-o deste dispositivo quando estiveres pronta.',
        status: 'O ficheiro de cópia encriptado foi criado neste dispositivo.',
        mismatchError:
          'Introduz a mesma frase-passe duas vezes antes de criar o ficheiro.',
        passphraseLengthError:
          'Usa pelo menos 12 caracteres para esta frase-passe.',
        genericError: 'Não foi possível concluir a exportação da cópia.',
        unavailableError:
          'A cópia precisa de uma versão mais recente do Floriva neste dispositivo para terminar aqui.',
        storageUnavailableError:
          'O Floriva não conseguiu aceder ao armazenamento local de documentos neste dispositivo.',
        passphraseLabel: 'Frase-passe da cópia',
        confirmPassphraseLabel: 'Confirmar frase-passe',
        exportButton: 'Criar ficheiro de cópia',
        localOnlyNote:
          'O Floriva encripta o ficheiro antes de o tirares deste dispositivo.',
        passphraseSafetyNote:
          'O Floriva não consegue recuperar esta frase-passe. Guarda-a num sítio seguro.',
      },
      restore: {
        title: 'Restaurar cópia',
        description:
          'Escolhe um ficheiro de cópia do Floriva, introduz a frase-passe e pré-visualiza o restauro antes de confirmares.',
        passphraseLabel: 'Frase-passe de restauro',
        selectedFilePrefix: 'Ficheiro de cópia selecionado:',
        chooseFileButton: 'Escolher ficheiro de cópia',
        previewButton: 'Pré-visualizar restauro',
        confirmButton: 'Restaurar esta cópia',
        continueButton: 'Continuar',
        missingFileError:
          'Escolhe um ficheiro de cópia do Floriva antes de pré-visualizares o restauro.',
        missingPassphraseError:
          'Escolhe um ficheiro de cópia e introduz a frase-passe antes de pré-visualizares o restauro.',
        fileOpenError: 'O Floriva não conseguiu abrir esse ficheiro.',
        genericPreviewError: 'O Floriva não conseguiu pré-visualizar esse restauro.',
        wrongPassphraseError:
          'Essa frase-passe não desbloqueou esta cópia.',
        unsupportedFormatError:
          'Esta cópia precisa de uma versão mais recente do Floriva antes de ser restaurada aqui.',
        invalidFileError:
          'O Floriva não conseguiu ler essa cópia. Escolhe um ficheiro .floriva exportado pelo Floriva.',
        status: 'A cópia foi restaurada neste dispositivo.',
        statusWithFollowUp:
          'A cópia foi restaurada neste dispositivo. Reativa o bloqueio biométrico e restaura as compras, se necessário.',
        reloadError:
          'Os dados da cópia foram restaurados localmente, mas o Floriva precisa de os recarregar antes de continuares. Fecha e volta a abrir a app.',
        commitError:
          'O Floriva não conseguiu terminar o restauro desta cópia. Os teus dados atuais não foram substituídos.',
        selectedFileDefault: 'Cópia do Floriva selecionada',
        noFileSelected: 'Ainda não foi selecionado nenhum ficheiro de cópia.',
        previewTitle: 'Pré-visualização do restauro',
        previewDescription:
          'Restaurar substitui todos os dados atuais do Floriva neste dispositivo pelo conteúdo da cópia.',
        logsToRestore: 'Registos a restaurar',
        importSessions: 'Sessões de importação',
        trackedPeriodDays: 'Dias de período registados',
        exportedOn: 'Exportada em',
        logDateRange: 'Intervalo de datas',
        noLogsInBackup: 'Sem registos',
        reminders: 'Lembretes',
        cycleProfile: 'Configuração do ciclo',
        cycleProfileReady: 'Incluída',
        cycleProfileMissing: 'Não incluída',
        replaceDataNote:
          'Revê isto com cuidado. Ao confirmares, os dados locais atuais deste dispositivo serão substituídos.',
        acknowledgeReplaceButton:
          'Compreendo que isto substitui os dados atuais',
        chooseDifferentFileButton: 'Escolher outro ficheiro',
        biometricsNote:
          'O bloqueio biométrico vai continuar desligado até o voltares a ativar neste dispositivo.',
        billingNote:
          'Restaura as compras depois de restaurar a cópia se o teu estado de cobrança tiver mudado.',
      },
    },
  },
  ru: {
    backup: {
      screen: {
        eyebrow: 'Резервная копия',
        title: 'Резервная копия и восстановление',
        description:
          'Создайте зашифрованную копию или восстановите файл Floriva, который у вас уже есть.',
        backLabel: 'Назад к управлению данными',
        backToWelcome: 'Назад к приветствию',
        statusCardTitle: 'Резервная копия готова',
        errorCardTitle: 'Резервной копии нужно внимание',
      },
      export: {
        title: 'Экспорт копии',
        description:
          'Выберите парольную фразу, создайте файл копии и перенесите его с этого устройства, когда будете готовы.',
        status: 'Зашифрованный файл резервной копии создан на этом устройстве.',
        mismatchError:
          'Введите одну и ту же парольную фразу дважды перед созданием файла.',
        passphraseLengthError:
          'Используйте не менее 12 символов для этой парольной фразы.',
        genericError: 'Не удалось завершить экспорт резервной копии.',
        unavailableError:
          'Чтобы завершить это здесь, резервной копии нужна более новая сборка Floriva на этом устройстве.',
        storageUnavailableError:
          'Floriva не удалось получить доступ к локальному хранилищу документов на этом устройстве.',
        passphraseLabel: 'Парольная фраза копии',
        confirmPassphraseLabel: 'Подтвердить парольную фразу',
        exportButton: 'Создать файл копии',
        localOnlyNote:
          'Floriva шифрует файл локально, прежде чем вы перенесёте его в другое место.',
        passphraseSafetyNote:
          'Floriva не может восстановить эту парольную фразу. Храните её в безопасном месте.',
      },
      restore: {
        title: 'Восстановить копию',
        description:
          'Выберите файл резервной копии Floriva, введите его парольную фразу и просмотрите восстановление перед подтверждением.',
        passphraseLabel: 'Парольная фраза для восстановления',
        selectedFilePrefix: 'Выбранный файл копии:',
        chooseFileButton: 'Выбрать файл копии',
        previewButton: 'Предпросмотр восстановления',
        confirmButton: 'Восстановить эту копию',
        continueButton: 'Продолжить',
        missingFileError:
          'Выберите файл резервной копии Floriva перед предпросмотром восстановления.',
        missingPassphraseError:
          'Выберите файл копии и введите его парольную фразу перед предпросмотром восстановления.',
        fileOpenError: 'Floriva не удалось открыть этот файл.',
        genericPreviewError: 'Floriva не удалось просмотреть это восстановление.',
        wrongPassphraseError:
          'Эта парольная фраза не разблокировала резервную копию.',
        unsupportedFormatError:
          'Для восстановления этой копии здесь нужна более новая сборка Floriva.',
        invalidFileError:
          'Floriva не удалось прочитать эту копию. Выберите файл .floriva, экспортированный из Floriva.',
        status: 'Резервная копия восстановлена на этом устройстве.',
        statusWithFollowUp:
          'Резервная копия восстановлена на этом устройстве. При необходимости снова включите биометрическую блокировку и восстановите покупки.',
        reloadError:
          'Данные резервной копии восстановлены локально, но Floriva нужно заново загрузить их, прежде чем вы продолжите. Закройте приложение и откройте его снова.',
        commitError:
          'Floriva не удалось завершить восстановление этой копии. Текущие данные не были заменены.',
        selectedFileDefault: 'Выбранная копия Floriva',
        noFileSelected: 'Файл резервной копии ещё не выбран.',
        previewTitle: 'Предпросмотр восстановления',
        previewDescription:
          'Восстановление заменит все текущие данные Floriva на этом устройстве содержимым резервной копии.',
        logsToRestore: 'Записи для восстановления',
        importSessions: 'Сеансы импорта',
        trackedPeriodDays: 'Отмеченные дни менструации',
        exportedOn: 'Дата экспорта',
        logDateRange: 'Диапазон дат записей',
        noLogsInBackup: 'Нет записей',
        reminders: 'Напоминания',
        cycleProfile: 'Настройка цикла',
        cycleProfileReady: 'Включена',
        cycleProfileMissing: 'Не включена',
        replaceDataNote:
          'Проверьте внимательно. Подтверждение заменит текущие локальные данные на этом устройстве.',
        acknowledgeReplaceButton:
          'Я понимаю, что это заменит текущие данные',
        chooseDifferentFileButton: 'Выбрать другой файл',
        biometricsNote:
          'Биометрическая блокировка останется выключенной, пока вы снова не включите её на этом устройстве.',
        billingNote:
          'После восстановления копии восстановите покупки, если ваш статус оплаты изменился.',
      },
    },
  },
} as const;
