/**
 * Localized copy for prediction confidence: per-reason-code explanations
 * (rendered by `ConfidenceImprovementList`), per-limitation-code copy (see
 * `predictions.limitations.*`, resolved by
 * `src/lib/predictions/presentation.ts`'s `formatPredictionLimitation`), and
 * the confidence info-modal content built by
 * `src/lib/predictions/buildConfidenceInfoModalContent.ts`.
 *
 * Whether a reason is actionable is decided solely by
 * `selectImprovementCodes` in `src/lib/predictions/confidenceImprovements.ts`
 * — this module carries no per-code CTA copy on purpose.
 *
 * Reason codes come from `ConfidenceReasonCode` in `src/types/domain.ts` and
 * are emitted natively by the engine (see `resolveConfidence` in
 * `src/lib/predictions/confidence.ts` for the base set, and
 * `buildPredictionResult.ts` for the three ovulation-derived codes:
 * `hormonal-birth-control`, `signals-disagree`,
 * `ovulation-signal-confirmed`). Limitation codes come from `LimitationCode`
 * in the same file and are emitted by `resolveLimitations` /
 * `buildPredictionResult.ts`'s `projected-forward` append. This catalog is
 * the sole source of truth for anything shown to users — there is no
 * English-string fallback anywhere in the engine or presentation layer;
 * every code is guaranteed a catalog entry in every locale (enforced by
 * `tests/localization/predictionsMessages.test.ts`).
 *
 * `predictions.confidence.modal.reasons.*` carries the two descriptive (not
 * imperative) reason codes that get an extra modal paragraph:
 * `hormonal-birth-control` and `signals-disagree`. They are mutually
 * exclusive by construction (see `buildConfidenceInfoModalContent.ts`), so
 * at most one extra paragraph is ever added.
 *
 * `predictions.anomalies.*` (B4) is copy for the (currently unwired)
 * `AnomalyNudge` scaffold component -- see
 * `src/components/primitives/AnomalyNudge.tsx`. Each anomaly kind has a
 * `title` and `body`; `body` is deliberately just the observation +
 * normalcy-framing sentence. The shared, non-diagnostic clinician note
 * ("if this keeps happening and you're concerned, a clinician can help you
 * look into it") lives once at `predictions.anomalies.common.clinicianNote`
 * and is composed onto the body at render time by `AnomalyNudge` (two
 * separate `t()` calls joined with the locale's
 * `common.sentenceJoiner` -- a space for Latin/Cyrillic locales, an empty
 * string for ja/zh-Hans, which do not put spaces between sentences) rather
 * than duplicated into every kind x locale body string -- this catalog only
 * supports flat strings with `{param}` interpolation, not cross-key
 * composition, so composing in the component is the natural fit.
 * `common.dismissLabel` is the dismiss-button copy ("Got it").
 */

const predictionsEnglishMessages = {
  predictions: {
    confidence: {
      reasons: {
        'onboarding-seed': 'Log your next period to replace onboarding estimates',
        'limited-bleeding-history': 'Log today to sharpen this estimate',
        'one-observed-interval': 'Log today to confirm your rhythm sooner',
        'irregular-cycle-support-enabled': 'Irregular-cycle support keeps the estimate broader',
        'consistent-recent-bleeding-history': 'Recent local history shows a steady rhythm',
        'stale-history': 'Log your latest period to refresh this estimate — it’s been a while',
        // NOTE: the three ovulation-derived entries below (here and in every
        // locale block) are currently UNREACHABLE at runtime -- these codes are
        // never actionable (never appear as ConfidenceImprovementList rows, the
        // only consumer of `reasons.*`), and the confidence modal renders them
        // from `modal.reasons.*` instead. They exist solely to satisfy the
        // exhaustiveness invariant (every ConfidenceReasonCode has `reasons.*`
        // copy in every locale -- see tests/localization/predictionsMessages
        // .test.ts), which is what lets ConfidenceImprovementList call t()
        // without a fallback. B5+: do not assume this copy is live/user-tested.
        'hormonal-birth-control': 'Hormonal birth control limits the cycle signals used for ovulation timing',
        'signals-disagree': 'Your logged signals didn’t fully agree this cycle, so this estimate stays cautious',
        'ovulation-signal-confirmed': 'A logged fertility signal helped confirm ovulation timing this cycle',
      },
      modal: {
        eyebrow: 'How confidence works',
        title: {
          low: 'Why confidence is low',
          medium: 'Why confidence is medium',
          high: 'Why confidence is high',
        },
        intro: {
          low: 'Confidence is low because there isn’t much local cycle history to compare yet.',
          medium: 'Confidence is medium — Floriva has some local cycle history, but timing may still shift.',
          high: 'Confidence is high because recent local cycle history has been consistent.',
        },
        general: 'Confidence reflects how much on-device cycle history backs an estimate. It is not a medical measurement — it only describes how much the estimate might still move.',
        reasons: {
          'hormonal-birth-control': 'Your birth-control method limits the cycle signals Floriva can use to refine ovulation timing, so this estimate relies on calendar history instead.',
          'signals-disagree': 'Your logged signals pointed in slightly different directions this cycle, so Floriva kept this estimate cautious rather than picking one signal over another.',
        },
      },
    },
    limitations: {
      'on-device': 'Predictions stay on this device and adapt as more entries are logged.',
      'not-medical-certainty': 'Floriva shows estimates, not medical certainty.',
      'onboarding-seed-active': 'Predictions are using your onboarding seed until more bleeding history is logged.',
      'limited-history-shift': 'Limited bleeding history means period timing may shift as more entries are logged.',
      'irregular-cycle-broader': 'Irregular-cycle support keeps predictions broader when your timing varies.',
      'projected-forward': 'These dates are projected forward from your last logged period start.',
    },
    anomalies: {
      'short-cycle': {
        title: 'A shorter cycle than usual',
        body: 'This cycle came sooner than your usual range. Cycle length can shift for lots of everyday reasons — stress, travel, sleep, and more.',
      },
      'long-cycle': {
        title: 'A longer cycle than usual',
        body: 'This cycle ran longer than your usual range. Cycles vary for many everyday reasons.',
      },
      'prolonged-bleeding': {
        title: 'Bleeding lasted longer than usual',
        body: "You've logged bleeding for more days in a row than usual. Bleeding length can vary from cycle to cycle.",
      },
      'missed-expected-period': {
        title: 'Your period hasn’t started yet',
        body: "Your period hasn't started yet, even though it was expected by now. Timing can shift for lots of reasons, especially if your cycles have been irregular lately.",
      },
      common: {
        clinicianNote: 'If this keeps happening and you’re concerned, a clinician can help you look into it.',
        dismissLabel: 'Got it',
        sentenceJoiner: ' ',
      },
    },
    // LT-24: when the prediction is stale (same `stale-history` signal as
    // LT-04/LT-09/LT-27), Today must not assert an active fertile window or
    // a trustworthy cycle-day count built on a rolled synthetic anchor. This
    // replaces the fertile-window headline/caption with a neutral, calm
    // acknowledgment instead -- the missed-period anomaly nudge (rendered
    // separately, unaffected by this key) already carries the actionable
    // detail.
    today: {
      staleHeadline: 'Your local estimate needs a refresh',
      staleCaption: 'Log your latest period to see today’s cycle phase again.',
      staleHeroLabel: 'Awaiting an update',
    },
  },
} as const;

export const predictionsMessages = {
  en: predictionsEnglishMessages,
  es: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': 'Registra tu próximo periodo para reemplazar las estimaciones iniciales',
          'limited-bleeding-history': 'Registra hoy para afinar esta estimación',
          'one-observed-interval': 'Registra hoy para confirmar tu ritmo antes',
          'irregular-cycle-support-enabled': 'El soporte para ciclos irregulares mantiene la estimación más amplia',
          'consistent-recent-bleeding-history': 'El historial reciente local muestra un ritmo constante',
          'stale-history': 'Registra tu último periodo para actualizar esta estimación — ha pasado un tiempo',
          'hormonal-birth-control': 'El anticonceptivo hormonal limita las señales de ciclo usadas para calcular la ovulación',
          'signals-disagree': 'Tus señales registradas no coincidieron del todo este ciclo, así que esta estimación se mantiene cautelosa',
          'ovulation-signal-confirmed': 'Una señal de fertilidad registrada ayudó a confirmar el momento de la ovulación este ciclo',
        },
        modal: {
          eyebrow: 'Cómo funciona la confianza',
          title: {
            low: 'Por qué la confianza es baja',
            medium: 'Por qué la confianza es media',
            high: 'Por qué la confianza es alta',
          },
          intro: {
            low: 'La confianza es baja porque todavía no hay mucho historial local del ciclo para comparar.',
            medium: 'La confianza es media: Floriva tiene algo de historial local del ciclo, pero el momento aún puede cambiar.',
            high: 'La confianza es alta porque el historial reciente local del ciclo ha sido constante.',
          },
          general: 'La confianza refleja cuánto historial local del ciclo respalda una estimación. No es una medición médica: solo describe cuánto podría moverse todavía la estimación.',
          reasons: {
            'hormonal-birth-control': 'Tu método anticonceptivo limita las señales de ciclo que Floriva puede usar para afinar el momento de la ovulación, así que esta estimación se basa en el historial de calendario.',
            'signals-disagree': 'Tus señales registradas apuntaron en direcciones ligeramente distintas este ciclo, así que Floriva mantuvo esta estimación cautelosa en lugar de priorizar una señal sobre otra.',
          },
        },
      },
      limitations: {
        'on-device': 'Las predicciones se quedan en el dispositivo y se ajustan a medida que registras más entradas.',
        'not-medical-certainty': 'Floriva muestra estimaciones, no certeza médica.',
        'onboarding-seed-active': 'Las predicciones usan tus datos iniciales de bienvenida hasta que se registre más historial de sangrado.',
        'limited-history-shift': 'El historial limitado de sangrado significa que el momento del periodo puede cambiar a medida que se registran más entradas.',
        'irregular-cycle-broader': 'El soporte para ciclos irregulares mantiene predicciones más amplias cuando tu ritmo varía.',
        'projected-forward': 'Estas fechas se proyectan hacia adelante a partir del último inicio de periodo registrado.',
      },
      anomalies: {
        'short-cycle': {
          title: 'Un ciclo más corto de lo habitual',
          body: 'Este ciclo llegó antes de tu rango habitual. La duración del ciclo puede variar por muchos motivos cotidianos: estrés, viajes, sueño y más.',
        },
        'long-cycle': {
          title: 'Un ciclo más largo de lo habitual',
          body: 'Este ciclo duró más que tu rango habitual. Los ciclos varían por muchos motivos cotidianos.',
        },
        'prolonged-bleeding': {
          title: 'El sangrado duró más de lo habitual',
          body: 'Has registrado sangrado durante más días seguidos de lo habitual. La duración del sangrado puede variar de un ciclo a otro.',
        },
        'missed-expected-period': {
          title: 'Tu periodo aún no ha comenzado',
          body: 'Tu periodo todavía no ha comenzado, aunque ya se esperaba. El momento puede variar por muchos motivos, sobre todo si tus ciclos han sido irregulares últimamente.',
        },
        common: {
          clinicianNote: 'Si esto sigue ocurriendo y te preocupa, un profesional de la salud puede ayudarte a revisarlo.',
          dismissLabel: 'Entendido',
          sentenceJoiner: ' ',
        },
      },
      today: {
        staleHeadline: 'Tu estimación local necesita actualizarse',
        staleCaption: 'Registra tu último periodo para volver a ver la fase del ciclo de hoy.',
        staleHeroLabel: 'Esperando una actualización',
      },
    },
  },
  de: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': 'Erfasse deine nächste Periode, um die Onboarding-Schätzungen zu ersetzen',
          'limited-bleeding-history': 'Erfasse heute, um diese Schätzung zu verfeinern',
          'one-observed-interval': 'Erfasse heute, um deinen Rhythmus schneller zu bestätigen',
          'irregular-cycle-support-enabled': 'Unterstützung für unregelmäßige Zyklen hält die Schätzung breiter',
          'consistent-recent-bleeding-history': 'Der aktuelle lokale Verlauf zeigt einen gleichmäßigen Rhythmus',
          'stale-history': 'Erfasse deine letzte Periode, um diese Schätzung zu aktualisieren — es ist eine Weile her',
          'hormonal-birth-control': 'Hormonelle Verhütung schränkt die Zyklussignale ein, die für das Ovulations-Timing genutzt werden',
          'signals-disagree': 'Deine erfassten Signale stimmten diesen Zyklus nicht vollständig überein, daher bleibt diese Schätzung vorsichtig',
          'ovulation-signal-confirmed': 'Ein erfasstes Fruchtbarkeitssignal half, das Ovulations-Timing diesen Zyklus zu bestätigen',
        },
        modal: {
          eyebrow: 'So funktioniert die Zuversicht',
          title: {
            low: 'Warum die Zuversicht niedrig ist',
            medium: 'Warum die Zuversicht mittel ist',
            high: 'Warum die Zuversicht hoch ist',
          },
          intro: {
            low: 'Die Zuversicht ist niedrig, weil es bisher nicht viel lokalen Zyklusverlauf zum Vergleichen gibt.',
            medium: 'Die Zuversicht ist mittel — Floriva hat etwas lokalen Zyklusverlauf, aber das Timing kann sich noch verschieben.',
            high: 'Die Zuversicht ist hoch, weil der aktuelle lokale Zyklusverlauf gleichmäßig war.',
          },
          general: 'Die Zuversicht zeigt, wie viel lokaler Zyklusverlauf eine Schätzung stützt. Es ist keine medizinische Messung — sie beschreibt nur, wie sehr sich die Schätzung noch verschieben könnte.',
          reasons: {
            'hormonal-birth-control': 'Deine Verhütungsmethode schränkt die Zyklussignale ein, die Floriva zur Verfeinerung des Ovulations-Timings nutzen kann, daher stützt sich diese Schätzung stattdessen auf den Kalenderverlauf.',
            'signals-disagree': 'Deine erfassten Signale zeigten diesen Zyklus in leicht unterschiedliche Richtungen, daher hat Floriva diese Schätzung vorsichtig gehalten, statt ein Signal über ein anderes zu stellen.',
          },
        },
      },
      limitations: {
        'on-device': 'Vorhersagen bleiben auf diesem Gerät und passen sich an, wenn mehr Einträge erfasst werden.',
        'not-medical-certainty': 'Floriva zeigt Schätzungen, keine medizinische Gewissheit.',
        'onboarding-seed-active': 'Vorhersagen nutzen zunächst deine Onboarding-Ausgangsdaten, bis mehr Blutungsverlauf erfasst ist.',
        'limited-history-shift': 'Ein begrenzter Blutungsverlauf bedeutet, dass sich das Timing der Periode mit mehr Einträgen verschieben kann.',
        'irregular-cycle-broader': 'Die Unterstützung für unregelmäßige Zyklen hält Vorhersagen breiter, wenn dein Timing schwankt.',
        'projected-forward': 'Diese Termine werden ausgehend von deinem letzten erfassten Periodenstart in die Zukunft projiziert.',
      },
      anomalies: {
        'short-cycle': {
          title: 'Ein kürzerer Zyklus als sonst',
          body: 'Dieser Zyklus kam früher als dein üblicher Bereich. Die Zykluslänge kann sich aus vielen alltäglichen Gründen verschieben — Stress, Reisen, Schlaf und mehr.',
        },
        'long-cycle': {
          title: 'Ein längerer Zyklus als sonst',
          body: 'Dieser Zyklus dauerte länger als dein üblicher Bereich. Zyklen schwanken aus vielen alltäglichen Gründen.',
        },
        'prolonged-bleeding': {
          title: 'Die Blutung hat länger gedauert als sonst',
          body: 'Du hast an mehr aufeinanderfolgenden Tagen Blutung erfasst als sonst. Die Dauer der Blutung kann von Zyklus zu Zyklus variieren.',
        },
        'missed-expected-period': {
          title: 'Deine Periode hat noch nicht begonnen',
          body: 'Deine Periode hat noch nicht begonnen, obwohl sie inzwischen erwartet wurde. Das Timing kann sich aus vielen Gründen verschieben, besonders wenn deine Zyklen zuletzt unregelmäßig waren.',
        },
        common: {
          clinicianNote: 'Wenn das weiterhin vorkommt und du dir Sorgen machst, kann dir eine Ärztin oder ein Arzt helfen, das abzuklären.',
          dismissLabel: 'Verstanden',
          sentenceJoiner: ' ',
        },
      },
      today: {
        staleHeadline: 'Deine lokale Schätzung braucht eine Aktualisierung',
        staleCaption: 'Erfasse deine letzte Periode, um die heutige Zyklusphase wieder zu sehen.',
        staleHeroLabel: 'Wartet auf eine Aktualisierung',
      },
    },
  },
  fr: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': 'Enregistre tes prochaines règles pour remplacer les estimations de départ',
          'limited-bleeding-history': 'Enregistre aujourd’hui pour affiner cette estimation',
          'one-observed-interval': 'Enregistre aujourd’hui pour confirmer ton rythme plus vite',
          'irregular-cycle-support-enabled': 'Le mode cycles irréguliers garde une estimation plus large',
          'consistent-recent-bleeding-history': 'L’historique local récent montre un rythme régulier',
          'stale-history': 'Enregistre tes dernières règles pour actualiser cette estimation — cela fait un moment',
          'hormonal-birth-control': 'La contraception hormonale limite les signaux de cycle utilisés pour estimer l’ovulation',
          'signals-disagree': 'Tes signaux enregistrés ne concordaient pas totalement ce cycle, donc cette estimation reste prudente',
          'ovulation-signal-confirmed': 'Un signal de fertilité enregistré a aidé à confirmer le moment de l’ovulation ce cycle',
        },
        modal: {
          eyebrow: 'Comment fonctionne la confiance',
          title: {
            low: 'Pourquoi la confiance est faible',
            medium: 'Pourquoi la confiance est moyenne',
            high: 'Pourquoi la confiance est élevée',
          },
          intro: {
            low: 'La confiance est faible car il n’y a pas encore beaucoup d’historique local du cycle à comparer.',
            medium: 'La confiance est moyenne : Floriva dispose d’un peu d’historique local du cycle, mais le moment peut encore évoluer.',
            high: 'La confiance est élevée car l’historique local récent du cycle a été régulier.',
          },
          general: 'La confiance reflète la quantité d’historique local du cycle qui appuie une estimation. Ce n’est pas une mesure médicale — elle décrit seulement à quel point l’estimation peut encore bouger.',
          reasons: {
            'hormonal-birth-control': 'Ta méthode contraceptive limite les signaux de cycle que Floriva peut utiliser pour affiner le moment de l’ovulation, donc cette estimation s’appuie plutôt sur l’historique du calendrier.',
            'signals-disagree': 'Tes signaux enregistrés pointaient dans des directions légèrement différentes ce cycle, donc Floriva a gardé cette estimation prudente plutôt que de privilégier un signal.',
          },
        },
      },
      limitations: {
        'on-device': 'Les prévisions restent sur cet appareil et s’adaptent à mesure que d’autres entrées sont enregistrées.',
        'not-medical-certainty': 'Floriva affiche des estimations, pas une certitude médicale.',
        'onboarding-seed-active': 'Les prévisions utilisent les données de départ de l’onboarding jusqu’à ce que davantage d’historique de saignement soit enregistré.',
        'limited-history-shift': 'Un historique de saignement limité signifie que le timing des règles peut évoluer à mesure que d’autres entrées sont ajoutées.',
        'irregular-cycle-broader': 'La prise en charge des cycles irréguliers garde les prévisions plus larges quand ton rythme varie.',
        'projected-forward': 'Ces dates sont projetées à partir du dernier début de règles enregistré.',
      },
      anomalies: {
        'short-cycle': {
          title: 'Un cycle plus court que d’habitude',
          body: 'Ce cycle est arrivé plus tôt que ta fourchette habituelle. La durée du cycle peut varier pour de nombreuses raisons du quotidien — stress, voyages, sommeil, et plus encore.',
        },
        'long-cycle': {
          title: 'Un cycle plus long que d’habitude',
          body: 'Ce cycle a duré plus longtemps que ta fourchette habituelle. Les cycles varient pour de nombreuses raisons du quotidien.',
        },
        'prolonged-bleeding': {
          title: 'Les règles ont duré plus longtemps que d’habitude',
          body: 'Tu as enregistré des saignements pendant plus de jours consécutifs que d’habitude. La durée des saignements peut varier d’un cycle à l’autre.',
        },
        'missed-expected-period': {
          title: 'Tes règles n’ont pas encore commencé',
          body: 'Tes règles n’ont pas encore commencé, alors qu’elles étaient attendues à ce stade. Le moment peut varier pour de nombreuses raisons, surtout si tes cycles ont été irréguliers ces derniers temps.',
        },
        common: {
          clinicianNote: 'Si cela continue de se produire et que tu t’inquiètes, un professionnel de santé peut t’aider à y voir plus clair.',
          dismissLabel: 'Compris',
          sentenceJoiner: ' ',
        },
      },
      today: {
        staleHeadline: 'Ton estimation locale a besoin d’être actualisée',
        staleCaption: 'Enregistre tes dernières règles pour revoir la phase du cycle d’aujourd’hui.',
        staleHeroLabel: 'En attente d’une mise à jour',
      },
    },
  },
  ja: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': '次の生理を記録すると、オンボーディングの推定を置き換えられます',
          'limited-bleeding-history': '今日記録すると、この推定がより正確になります',
          'one-observed-interval': '今日記録すると、リズムを早く確認できます',
          'irregular-cycle-support-enabled': '不規則な周期への対応で、推定範囲を広めに保ちます',
          'consistent-recent-bleeding-history': '最近のローカル履歴に安定したリズムがあります',
          'stale-history': 'しばらく記録がありません。最新の生理を記録すると、この推定を更新できます',
          'hormonal-birth-control': 'ホルモン避妊法により、排卵タイミングの推定に使える周期の信号が限られます',
          'signals-disagree': '今回の周期は記録した信号が完全には一致しなかったため、この推定は慎重なままにしています',
          'ovulation-signal-confirmed': '記録された妊よう性の信号が、今回の周期の排卵タイミングの確認に役立ちました',
        },
        modal: {
          eyebrow: '確信度の仕組み',
          title: {
            low: '確信度が低い理由',
            medium: '確信度が中程度の理由',
            high: '確信度が高い理由',
          },
          intro: {
            low: '比較できるローカルの周期履歴がまだ少ないため、確信度は低くなっています。',
            medium: '確信度は中程度です。ローカルの周期履歴は多少ありますが、タイミングはまだ変わる可能性があります。',
            high: '最近のローカルの周期履歴が安定しているため、確信度は高くなっています。',
          },
          general: '確信度は、端末内の周期履歴がどれだけ推定を裏付けているかを示します。医学的な測定ではなく、推定がどれだけ変わりうるかを説明するものです。',
          reasons: {
            'hormonal-birth-control': '避妊方法により、Floriva が排卵タイミングを精緻化するために使える周期の信号が限られるため、この推定はカレンダー履歴に基づいています。',
            'signals-disagree': '今回の周期は記録した信号がわずかに異なる方向を示したため、Floriva はどれか一つの信号を優先せず、この推定を慎重なままにしました。',
          },
        },
      },
      limitations: {
        'on-device': '予測はこの端末にとどまり、記録が増えるほど調整されます。',
        'not-medical-certainty': 'Floriva は推定値を表示し、医学的な確実性は示しません。',
        'onboarding-seed-active': 'より多くの出血履歴が記録されるまで、予測はオンボーディングの初期データを使います。',
        'limited-history-shift': '出血履歴が少ないため、記録が増えると生理のタイミングが変わることがあります。',
        'irregular-cycle-broader': '周期が変動する場合、不規則な周期のサポートにより予測範囲を広めに保ちます。',
        'projected-forward': 'これらの日付は、最後に記録した生理開始日から前方に投影されています。',
      },
      anomalies: {
        'short-cycle': {
          title: 'いつもより短い周期',
          body: '今回の周期は、いつもの範囲より早く来ました。周期の長さは、ストレスや旅行、睡眠など日常のさまざまな理由で変わることがあります。',
        },
        'long-cycle': {
          title: 'いつもより長い周期',
          body: '今回の周期は、いつもの範囲より長く続きました。周期は日常のさまざまな理由で変動します。',
        },
        'prolonged-bleeding': {
          title: '出血がいつもより長く続いています',
          body: 'いつもより多くの日数、連続して出血を記録しています。出血の長さは周期ごとに変わることがあります。',
        },
        'missed-expected-period': {
          title: '生理がまだ始まっていません',
          body: '予定の時期を過ぎても、まだ生理が始まっていません。特に最近周期が不規則な場合、タイミングはさまざまな理由で変わることがあります。',
        },
        common: {
          clinicianNote: 'これが繰り返し起こり、気になる場合は、医療専門家に相談して詳しく調べてもらうことができます。',
          dismissLabel: '了解',
          sentenceJoiner: '',
        },
      },
      today: {
        staleHeadline: 'ローカルの推定を更新してください',
        staleCaption: '最新の生理を記録すると、今日の周期フェーズが再び表示されます。',
        staleHeroLabel: '更新待ち',
      },
    },
  },
  'zh-Hans': {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': '记录你的下一次月经，以替换初始设置的估算',
          'limited-bleeding-history': '今天记录一下，让这个估算更准确',
          'one-observed-interval': '今天记录一下，能更快确认你的节律',
          'irregular-cycle-support-enabled': '不规律周期支持会让估计范围保持更宽',
          'consistent-recent-bleeding-history': '最近的本地历史显示出稳定节奏',
          'stale-history': '已经有一段时间没有记录了，记录你最近一次月经可以更新这个估算',
          'hormonal-birth-control': '激素避孕会限制用于估算排卵时间的周期信号',
          'signals-disagree': '本周期你记录的信号并未完全一致，因此这个估算保持谨慎',
          'ovulation-signal-confirmed': '本周期记录的生育信号帮助确认了排卵时间',
        },
        modal: {
          eyebrow: '置信度是如何计算的',
          title: {
            low: '为什么置信度较低',
            medium: '为什么置信度为中等',
            high: '为什么置信度较高',
          },
          intro: {
            low: '置信度较低，因为目前可供比较的本地周期历史还不多。',
            medium: '置信度为中等——Floriva 已经有一些本地周期历史，但时间仍可能变化。',
            high: '置信度较高，因为近期的本地周期历史一直很稳定。',
          },
          general: '置信度反映了设备上的周期历史对估算的支持程度。它不是医学测量结果，只是说明估算可能还会变化多少。',
          reasons: {
            'hormonal-birth-control': '你的避孕方式限制了 Floriva 用于细化排卵时间的周期信号，因此这个估算改为依据日历历史。',
            'signals-disagree': '本周期你记录的信号方向略有不同，因此 Floriva 没有优先采用某一个信号，而是让这个估算保持谨慎。',
          },
        },
      },
      limitations: {
        'on-device': '预测会保留在这个设备上，并随着更多记录自动调整。',
        'not-medical-certainty': 'Floriva 显示的是估算，不是医学上的确定结论。',
        'onboarding-seed-active': '在记录更多出血历史之前，预测会使用你的引导初始数据。',
        'limited-history-shift': '出血历史较少意味着，随着记录增多，月经时间可能会变化。',
        'irregular-cycle-broader': '当你的周期时间有变化时，不规则周期支持会让预测范围更宽。',
        'projected-forward': '这些日期是从你最后记录的月经开始日期向前推算的。',
      },
      anomalies: {
        'short-cycle': {
          title: '这次周期比平时短',
          body: '这次周期来得比你平时的范围更早。周期长度会因压力、旅行、睡眠等日常因素而变化。',
        },
        'long-cycle': {
          title: '这次周期比平时长',
          body: '这次周期比你平时的范围更长。周期会因许多日常因素而有所不同。',
        },
        'prolonged-bleeding': {
          title: '出血持续时间比平时长',
          body: '你记录的连续出血天数比平时更多。出血持续时间在不同周期之间可能会有所不同。',
        },
        'missed-expected-period': {
          title: '月经还没有开始',
          body: '尽管已经到了预计的时间，你的月经还没有开始。时间可能会因许多原因而变化，尤其是如果你最近的周期一直不规律。',
        },
        common: {
          clinicianNote: '如果这种情况持续出现，并且你感到担心，医生可以帮助你进一步了解情况。',
          dismissLabel: '知道了',
          sentenceJoiner: '',
        },
      },
      today: {
        staleHeadline: '你的本地估算需要更新',
        staleCaption: '记录你最近一次月经，即可重新看到今天的周期阶段。',
        staleHeroLabel: '等待更新',
      },
    },
  },
  pt: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': 'Registe o seu próximo período para substituir as estimativas iniciais',
          'limited-bleeding-history': 'Registe hoje para tornar esta estimativa mais precisa',
          'one-observed-interval': 'Registe hoje para confirmar o seu ritmo mais depressa',
          'irregular-cycle-support-enabled': 'O suporte a ciclos irregulares mantém a estimativa mais ampla',
          'consistent-recent-bleeding-history': 'O histórico local recente mostra um ritmo consistente',
          'stale-history': 'Registe o seu último período para atualizar esta estimativa — já faz um tempo',
          'hormonal-birth-control': 'O método contracetivo hormonal limita os sinais de ciclo usados para calcular a ovulação',
          'signals-disagree': 'Os seus sinais registados não coincidiram totalmente este ciclo, por isso esta estimativa mantém-se cautelosa',
          'ovulation-signal-confirmed': 'Um sinal de fertilidade registado ajudou a confirmar o momento da ovulação este ciclo',
        },
        modal: {
          eyebrow: 'Como funciona a confiança',
          title: {
            low: 'Porque a confiança é baixa',
            medium: 'Porque a confiança é média',
            high: 'Porque a confiança é alta',
          },
          intro: {
            low: 'A confiança é baixa porque ainda não há muito histórico local do ciclo para comparar.',
            medium: 'A confiança é média — o Floriva já tem algum histórico local do ciclo, mas o momento ainda pode mudar.',
            high: 'A confiança é alta porque o histórico local recente do ciclo tem sido consistente.',
          },
          general: 'A confiança reflete quanto histórico local do ciclo sustenta uma estimativa. Não é uma medição médica — apenas descreve o quanto a estimativa ainda pode mudar.',
          reasons: {
            'hormonal-birth-control': 'O seu método contracetivo limita os sinais de ciclo que o Floriva pode usar para afinar o momento da ovulação, por isso esta estimativa baseia-se antes no histórico do calendário.',
            'signals-disagree': 'Os seus sinais registados apontaram em direções ligeiramente diferentes este ciclo, por isso o Floriva manteve esta estimativa cautelosa em vez de priorizar um sinal sobre outro.',
          },
        },
      },
      limitations: {
        'on-device': 'As previsões ficam neste dispositivo e se ajustam conforme mais registros são adicionados.',
        'not-medical-certainty': 'O Floriva mostra estimativas, não certeza médica.',
        'onboarding-seed-active': 'As previsões usam seus dados iniciais de onboarding até que mais histórico de sangramento seja registrado.',
        'limited-history-shift': 'Pouco histórico de sangramento significa que o timing do período pode mudar conforme mais entradas são registradas.',
        'irregular-cycle-broader': 'O suporte a ciclos irregulares mantém as previsões mais amplas quando o teu ritmo varia.',
        'projected-forward': 'Estas datas são projetadas a partir do último início de período registado.',
      },
      anomalies: {
        'short-cycle': {
          title: 'Um ciclo mais curto do que o habitual',
          body: 'Este ciclo chegou antes do seu intervalo habitual. A duração do ciclo pode variar por muitos motivos do dia a dia — stress, viagens, sono e mais.',
        },
        'long-cycle': {
          title: 'Um ciclo mais longo do que o habitual',
          body: 'Este ciclo durou mais do que o seu intervalo habitual. Os ciclos variam por muitos motivos do dia a dia.',
        },
        'prolonged-bleeding': {
          title: 'A hemorragia durou mais do que o habitual',
          body: 'Registou hemorragia durante mais dias seguidos do que o habitual. A duração da hemorragia pode variar de ciclo para ciclo.',
        },
        'missed-expected-period': {
          title: 'O seu período ainda não começou',
          body: 'O seu período ainda não começou, embora já fosse esperado a esta altura. O momento pode variar por muitos motivos, especialmente se os seus ciclos têm sido irregulares ultimamente.',
        },
        common: {
          clinicianNote: 'Se isto continuar a acontecer e estiver preocupada, um profissional de saúde pode ajudar a investigar.',
          dismissLabel: 'Entendi',
          sentenceJoiner: ' ',
        },
      },
      today: {
        staleHeadline: 'A sua estimativa local precisa de ser atualizada',
        staleCaption: 'Registe o seu último período para voltar a ver a fase do ciclo de hoje.',
        staleHeroLabel: 'A aguardar uma atualização',
      },
    },
  },
  ru: {
    predictions: {
      confidence: {
        reasons: {
          'onboarding-seed': 'Запишите следующие месячные, чтобы заменить стартовые оценки',
          'limited-bleeding-history': 'Запишите сегодня, чтобы уточнить эту оценку',
          'one-observed-interval': 'Запишите сегодня, чтобы быстрее подтвердить свой ритм',
          'irregular-cycle-support-enabled': 'Поддержка нерегулярного цикла делает оценку шире',
          'consistent-recent-bleeding-history': 'Недавняя локальная история показывает устойчивый ритм',
          'stale-history': 'Запишите последние месячные, чтобы обновить эту оценку — прошло уже много времени',
          'hormonal-birth-control': 'Гормональная контрацепция ограничивает сигналы цикла, используемые для расчёта овуляции',
          'signals-disagree': 'Ваши отмеченные сигналы не полностью совпали в этом цикле, поэтому оценка остаётся осторожной',
          'ovulation-signal-confirmed': 'Отмеченный сигнал фертильности помог подтвердить время овуляции в этом цикле',
        },
        modal: {
          eyebrow: 'Как работает уверенность',
          title: {
            low: 'Почему уверенность низкая',
            medium: 'Почему уверенность средняя',
            high: 'Почему уверенность высокая',
          },
          intro: {
            low: 'Уверенность низкая, потому что пока недостаточно локальной истории цикла для сравнения.',
            medium: 'Уверенность средняя — у Floriva есть немного локальной истории цикла, но сроки ещё могут измениться.',
            high: 'Уверенность высокая, потому что недавняя локальная история цикла была стабильной.',
          },
          general: 'Уверенность отражает, сколько локальной истории цикла на устройстве подтверждает оценку. Это не медицинское измерение — она лишь описывает, насколько оценка ещё может измениться.',
          reasons: {
            'hormonal-birth-control': 'Ваш метод контрацепции ограничивает сигналы цикла, которые Floriva может использовать для уточнения времени овуляции, поэтому эта оценка опирается на историю календаря.',
            'signals-disagree': 'Ваши отмеченные сигналы указывали в немного разных направлениях в этом цикле, поэтому Floriva сохранила эту оценку осторожной, а не отдала предпочтение одному сигналу.',
          },
        },
      },
      limitations: {
        'on-device': 'Прогнозы остаются на этом устройстве и корректируются по мере добавления новых записей.',
        'not-medical-certainty': 'Floriva показывает оценки, а не медицинскую точность.',
        'onboarding-seed-active': 'Прогнозы используют стартовые данные онбординга, пока не накопится больше истории кровотечений.',
        'limited-history-shift': 'Ограниченная история кровотечений означает, что время месячных может смещаться по мере добавления записей.',
        'irregular-cycle-broader': 'Поддержка нерегулярного цикла делает прогнозы шире, когда ваши сроки меняются.',
        'projected-forward': 'Эти даты спрогнозированы вперёд от последнего отмеченного начала месячных.',
      },
      anomalies: {
        'short-cycle': {
          title: 'Цикл короче обычного',
          body: 'Этот цикл начался раньше вашего обычного диапазона. Длина цикла может меняться по многим повседневным причинам — из-за стресса, поездок, сна и не только.',
        },
        'long-cycle': {
          title: 'Цикл длиннее обычного',
          body: 'Этот цикл продлился дольше вашего обычного диапазона. Циклы меняются по многим повседневным причинам.',
        },
        'prolonged-bleeding': {
          title: 'Кровотечение длилось дольше обычного',
          body: 'Вы отметили кровотечение больше дней подряд, чем обычно. Длительность кровотечения может меняться от цикла к циклу.',
        },
        'missed-expected-period': {
          title: 'Месячные ещё не начались',
          body: 'Месячные ещё не начались, хотя уже должны были. Сроки могут меняться по многим причинам, особенно если в последнее время циклы были нерегулярными.',
        },
        common: {
          clinicianNote: 'Если это повторяется и вас это беспокоит, врач может помочь разобраться подробнее.',
          dismissLabel: 'Понятно',
          sentenceJoiner: ' ',
        },
      },
      today: {
        staleHeadline: 'Ваша локальная оценка нуждается в обновлении',
        staleCaption: 'Запишите последние месячные, чтобы снова увидеть фазу цикла на сегодня.',
        staleHeroLabel: 'Ожидает обновления',
      },
    },
  },
} as const;
