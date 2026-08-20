# Localization

Floriva ships in eight languages. There is no translation service, no
`i18next`, no runtime catalog fetch, and no extraction step. There is nothing
to fetch a catalog *from*. The precise version of that claim lives in
[privacy-and-security.md](privacy-and-security.md): there are **no network
calls in application code**: zero `fetch`, `XMLHttpRequest`, `WebSocket` or
`axios` call sites, but the app is not hermetic. Store billing goes out through
`expo-iap`, and seven `Linking.openURL` sites hand a URL to the system browser.
What is true is that no code path can pull a string down at runtime, so every
string has to be in the bundle.

The whole system is 614 lines of infrastructure over 13,853 lines of message
data, and its main design goal is that a missing translation is a **compile or
test failure**, never a key rendered on screen. That goal holds for every string
that goes through `t()`; a handful of literals bypass `t()` entirely and are
therefore outside the guarantee rather than in violation of it: see
[the hardcoded English that bypasses all of this](#the-hardcoded-english-that-bypasses-all-of-this).

---

## The eight locales

```ts
// floriva-app/src/localization/config.ts:5-13
export const supportedLocales = [
  'en',
  'es',
  'de',
  'fr',
  'ja',
  'zh-Hans',
  'pt',
  'ru',
] as const satisfies readonly SupportedLocale[];
```

The same list is declared to the platform, so iOS store metadata and the system
language picker agree with the app:

```ts
// floriva-app/app.config.ts:3-5
const iosInfoPlist = {
  ITSAppUsesNonExemptEncryption: false,
  CFBundleLocalizations: ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'],
```

and again in the store-screenshot harness, which maps each app locale to the
regional device locale the captures should be taken in
(`floriva-app/e2e/store-screenshot-config.js:15-27`): `es → es_MX`,
`pt → pt_BR`, `zh-Hans → zh_CN`, and so on. Three independent lists that have to
match; two of them are asserted against the first by tests.

`localeDisplayLabels` names each language in that language (`Deutsch`,
`日本語`, `Русский`) rather than in English, because a user looking for their
own language in a list is not helped by seeing "German".

Measured by importing the composed catalogs and counting string leaves:

| | |
| --- | --- |
| Locales | 8 |
| String leaves per locale | 1,107 |
| Total translated strings | 8,856 |
| Keys present in `en` but missing in any other locale | **0** |
| Keys present in another locale but not in `en` | **0** |
| Leaves whose type differs between locales | **0** |

---

## Sixteen message modules

`floriva-app/src/localization/messages/` holds sixteen files. Each exports a
single object keyed by locale, and each owns **exactly one** top-level namespace
matching its filename:

```ts
// floriva-app/src/localization/messages/navigation.ts:1-19
export const navigationMessages = {
  en: {
    navigation: {
      tabs: {
        today: 'Today',
        calendar: 'Calendar',
        insights: 'Insights',
        settings: 'Settings',
      },
      modal: {
        backAction: 'Back',
        eyebrow: 'Good to know',
        title: 'More on this',
        defaultBody:
          'There’s nothing more to show here right now. Tap Done to go back to where you were.',
        doneLabel: 'Done',
      },
    },
  },
  es: {
    navigation: { … },
```

The split is by product surface, not by size, and it is uneven on purpose:

| Module | Namespace | `en` strings | Lines |
| --- | --- | --- | --- |
| `settings.ts` | `settings` | 233 | 2,922 |
| `calendar.ts` | `calendar` | 141 | 1,344 |
| `onboarding.ts` | `onboarding` | 126 | 1,958 |
| `logging.ts` | `logging` | 97 | 1,272 |
| `import.ts` | `import` | 84 | 997 |
| `insights.ts` | `insights` | 70 | 792 |
| `tracker.ts` | `tracker` | 65 | 718 |
| `backup.ts` | `backup` | 58 | 705 |
| `billing.ts` | `billing` | 57 | 773 |
| `privacy.ts` | `privacy` | 40 | 603 |
| `predictions.ts` | `predictions` | 39 | 636 |
| `birthControl.ts` | `birthControl` | 36 | 418 |
| `ttc.ts` | `ttc` | 25 | 282 |
| `common.ts` | `common` | 19 | 117 |
| `navigation.ts` | `navigation` | 9 | 145 |
| `notifications.ts` | `notifications` | 8 | 171 |
| **Total** | | **1,107** | **13,853** |

Three reasons the split is what it is.

**Eight locales inline means every file is ~8× its English size.** A single
catalog would be a 14,000-line file. Sixteen files with one namespace each means
a change to reminder copy touches `settings.ts` and nothing else, and a diff on
`calendar.ts` is reviewable.

**Each locale of a namespace sits next to the others.** Because the locale keys
are the *outer* level within one file, the German and Japanese versions of a
string are in the same file as the English, a few hundred lines apart, rather
than in eight parallel files that drift. Adding a string means adding it eight
times in one place (annoying, and exactly why drift is caught during authoring
rather than at runtime).

**One namespace per file makes collisions impossible to miss.** The composition
is done by spreading, and spread order silently wins:

```ts
// floriva-app/src/localization/translations.ts:20-38
export const translations = {
  en: {
    ...commonMessages.en,
    ...settingsMessages.en,
    ...importMessages.en,
    …
  },
```

If two modules both defined a `settings` namespace, the later spread would
silently delete the earlier one's strings. That does not happen here: the sum of
the sixteen modules' English leaves (1,107) equals the leaf count of the composed
`translations.en` (1,107), so nothing is being overwritten.

---

## Type safety

`translations` is declared `as const`, and the key type is derived from the
English catalog by recursive template-literal types:

```ts
// floriva-app/src/localization/translations.ts:167-179
type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>;
};

type TranslationTree = TranslationShape<(typeof translations)['en']>;

type NestedTranslationKey<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : `${Key}.${NestedTranslationKey<T[Key]>}`;
}[keyof T & string];

export type TranslationKey = NestedTranslationKey<TranslationTree> | (string & {});
```

`TranslationKey` is the union of every dotted path that resolves to a string in
English (`'settings.hub.eyebrow'`, `'calendar.timeline.loading'`), so `t()`
autocompletes and a typo is a `tsc` error. `TranslationShape` is what makes the
other seven locales structurally checked against English rather than typed as
`any`.

The `| (string & {})` escape hatch is a real weakening and worth naming: it
preserves the literal union for autocomplete while permitting a computed key.
It is what lets the test suite assert on a deliberately invalid key
(`translate('en', 'common.actions.missing' as never)`), and it also means a
dynamically constructed key is not caught at compile time. Those fall through to
the runtime resolver, which throws rather than returning the key:

```ts
// floriva-app/src/localization/translations.ts:230-249
function getTranslationValue(
  translationTree: Record<string, unknown>,
  translationKey: string,
): string {
  const resolvedValue = translationKey
    .split('.')
    .reduce<unknown>((currentValue, pathSegment) => {
      if (!currentValue || typeof currentValue !== 'object') {
        return undefined;
      }

      return (currentValue as Record<string, unknown>)[pathSegment];
    }, translationTree);

  if (typeof resolvedValue !== 'string') {
    throw new Error(`Missing translation for key "${translationKey}"`);
  }

  return resolvedValue;
}
```

Throwing is the right call for an app with no server-side error reporting: a
missing key becomes a loud failure in a test or a dev build, not a screen reading
`settings.hub.eyebrow` in production. Interpolation is deliberately primitive:
`{name}`-style placeholders replaced with `replaceAll`, no ICU MessageFormat, no
plural rules engine. Plural forms are handled by writing separate keys where they
matter.

---

## Zero key drift, and how it is held

The property is enforced in the suite, not by convention. `translations.ts`
exports a reporter that flattens both catalogs to full dotted key paths and
diffs them:

```ts
// floriva-app/src/localization/translations.ts:196-219
export function buildMissingTranslationKeyReport(
  catalogs: Record<SupportedLocale, TranslationTree>,
) {
  const requiredKeys = new Set(flattenTranslationKeys(catalogs.en));
  const report: Partial<Record<SupportedLocale, string[]>> = {};

  for (const [locale, catalog] of Object.entries(catalogs) as […]) {
    if (locale === 'en') {
      continue;
    }

    const localeKeys = new Set(flattenTranslationKeys(catalog));
    const missingKeys = [...requiredKeys].filter((key) => !localeKeys.has(key));

    if (missingKeys.length > 0) {
      report[locale] = missingKeys;
    }
  }

  return report;
}
```

and the gate is one line:

```ts
// floriva-app/tests/localization/translations.test.ts:9-11
  it('keeps every non-English locale aligned with the English source catalog', () => {
    expect(buildMissingTranslationKeyReport(translations)).toEqual({});
  });
```

`flattenTranslationKeys` recurses to full paths, so a key missing three levels
down (`settings.reminders.title`) is caught, not just a missing top-level
namespace. The next test in the file proves the reporter actually reports, by
substituting a stub French catalog containing one key and asserting a specific
path shows up as missing: a drift detector that silently returns `{}` for the
wrong reason would otherwise be indistinguishable from a passing one.

**What this gate does not check.** It is one-directional: it finds keys present
in English and absent elsewhere. An *extra* key in a non-English catalog, or a
key that is a string in English and an array elsewhere, would pass. An
out-of-band audit ran the bidirectional diff (importing all sixteen modules
individually and comparing full dotted key paths including array indices) and
found 0 missing, 0 extra and 0 type mismatches across all seven non-English
locales. That is a stronger result than the in-repo gate proves, and it is
reported as an audit finding rather than as something the suite guarantees.

Beyond structure, 23 of the localization suite's 52 test blocks iterate all
eight locales and assert on content: that timeline copy uses
a real ellipsis character rather than three periods in every locale, that the
trial-active paywall copy differs from the expired and needs-purchase copy in
every locale, and that specific production labels render correctly in each
(`'28日中'`, `'共28天'`, `'из 28'`). All 52 blocks are plain `it()` declarations:
there is no `.each` in this directory, so 52 blocks is also 52 cases at runtime.

---

## The hardcoded English that bypasses all of this

Everything above describes strings that go through `t()`. Some do not, and the
type system cannot catch a string that never asks for a key.

**Four `HelpTooltip` bodies are English literals passed inline**, one in
`src/features/insights/screens/InsightsScreen.tsx:389` and three in
`src/features/settings/screens/SettingsTrackingSetupScreen.tsx` (`:203`, `:223`,
`:254`). Three of the four are the non-medical disclaimers: "These are planning
estimates only. They are not medical advice or contraception guidance.", "not
medical advice, a diagnosis, contraception guidance, or a guarantee", "This is
not a diagnosis or medical assessment." A Japanese or Russian user reading the
Insights phase chart gets those sentences in English or not at all. The
equivalent tooltips on Today and the Calendar month grid *are* localized, through
`common.help.fertileWindow.body`, so the pattern was established and then not
followed.

**Five `SectionCard` titles in `src/features/settings/screens/SettingsScreen.tsx`
are English literals**: `'Tracking'` (`:569`), `'Cycle setup'` (`:578`),
`'What to track'` (`:587`), `'Privacy & data'` (`:612`) and `'Account'` (`:655`).
Every *row* inside those sections is translated; only the headings are not.

None of this violates the guarantee stated at the top of this document, and that
is exactly the problem with how that guarantee is usually phrased. "A missing
translation is a compile or test failure" is true of every key that is looked
up. It says nothing about a developer who types the sentence directly into the
JSX, which is the failure mode that actually occurred. The drift check diffs
catalogs against each other; it cannot see a string that is in no catalog.
`tests/sanity/user-facing-copy-versioning.test.ts` walks screens for `/\bv1\b/i`,
so the crawl infrastructure exists: a lint rule banning bare string literals in
`title`/`body` props was never written.

One more, listed here because it is the same class of bug: the `'Account'`
section title names something the product does not have. Floriva has no account
system: no login, no user identifier, no server to hold an account on, as
[privacy-and-security.md](privacy-and-security.md) states at length. The section
holds subscription, language, feedback and sound settings. It is a stray
convention from ordinary app design, in the one product whose whole pitch is
that it has no account, and it shipped that way.

---

## Runtime resolution

Four small modules, split by what they need.

**`config.ts`**: the locale list, fallback, lookup set, and display labels. No
imports beyond a type, so anything can depend on it.

**`locale.ts`**: resolution. `resolveSupportedLocale` normalizes a BCP-47 tag
(trim, `_` → `-`, lowercase) and then tries, in order: an exact supported match,
then the base language subtag, then the device's language code:

```ts
// floriva-app/src/localization/locale.ts:21-52
export function resolveSupportedLocale(languageTag?: string | null, languageCode?: string | null) {
  const normalizedLanguageTag = normalizeLocaleTag(languageTag);

  if (normalizedLanguageTag) {
    if (normalizedLanguageTag.startsWith('zh')) {
      return normalizeChineseLanguageTag(normalizedLanguageTag);
    }

    if (supportedLocaleSet.has(normalizedLanguageTag as SupportedLocale)) {
      return normalizedLanguageTag as SupportedLocale;
    }

    const baseLanguageCode = normalizedLanguageTag.split('-')[0];
    if (supportedLocaleSet.has(baseLanguageCode as SupportedLocale)) {
      return baseLanguageCode as SupportedLocale;
    }
  }
  …
  return fallbackLocale;
}
```

So `de-AT` and `pt-PT` resolve to `de` and `pt`. Chinese is special-cased,
because only Simplified is shipped and falling back on the base subtag would give
a Traditional-Chinese user Simplified text:

```ts
// floriva-app/src/localization/locale.ts:11-19
function normalizeChineseLanguageTag(languageTag?: string | null) {
  const loweredTag = normalizeLocaleTag(languageTag);

  if (loweredTag.includes('hant')) {
    return fallbackLocale;
  }

  return 'zh-Hans' as const;
}
```

A `zh-Hant` user gets English: a deliberate choice that a wrong script is worse
than a foreign language.

`locale.ts` also exports `readPersistedLocalePreference` and
`resolveCurrentLocale`, the non-React path. Notification categories and reminder
scheduling run outside the component tree and still need the user's language;
sharing this function is what stops a scheduled reminder arriving in a different
language from the app that scheduled it.

**`localizationNative.ts`**: the only place `expo-localization` is touched,
behind `requireOptionalNativeModule` with a `try`/`catch` and a cached result,
returning `[]` when the native module is absent. This module is excluded from
coverage collection in `jest.config.js` precisely because it exists to be
un-testable native glue; keeping it to 34 lines is what makes that exclusion
honest.

**`localePreferenceSync.ts`**: sixteen lines, a listener set with a subscribe
function and a notify function. Its whole reason for existing is a cycle: the
language picker screen writes the preference through the repository, and the
provider that owns the resolved locale needs to know. Rather than have the
provider poll or the screen reach into provider internals, the write notifies and
the provider re-hydrates.

**`LocalizationProvider.tsx` / `localizationContext.ts`**: the context type is
in its own module so components can import `useLocalization` without importing
the provider, which keeps test render trees small. The provider does three
things: hydrate the persisted preference on mount (with an `isCancelled` guard so
an unmount mid-read cannot set state), subscribe to change notifications, and
expose a `setLocalePreference` that persists first and updates state second:

```tsx
// floriva-app/src/localization/LocalizationProvider.tsx:60-79
  const setLocalePreference = useCallback(
    async (nextPreference: LocalePreference) => {
      const preferences = await repositories.appPreferences.getPreferences();

      await repositories.appPreferences.savePreferences({
        ...preferences,
        localePreference: nextPreference,
      });

      setLocalePreferenceState(nextPreference);
      setIsHydrated(true);
      notifyLocalePreferenceChanged();
    },
    [repositories.appPreferences],
  );

  const resolvedLocale = useMemo(
    () => resolveLocalePreference(localePreference) ?? fallbackLocale,
    [localePreference],
  );
```

Persist-then-set means the UI never shows a language the database does not
already agree with.

The stored value is a `LocalePreference`, which is a supported locale **or** the
literal `'system'`. Keeping `'system'` as a distinct stored value rather than
resolving it at write time is what makes "follow the phone" actually follow the
phone: a user who picks it and later changes their device language gets the new
one. `isHydrated` is exposed so a screen can avoid rendering English for one
frame before the persisted preference arrives.

---

## Formatting

`floriva-app/src/localization/formatters.ts` is deliberately thin: 72 lines
wrapping `Intl`, not reimplementing it.

```ts
// floriva-app/src/localization/formatters.ts:26-33
export function formatLocalizedMonthDay(isoDate: string, locale: SupportedLocale) {
  const date = createMiddayDate(isoDate);

  return new Intl.DateTimeFormat(locale, {
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
  }).format(date);
}
```

Two decisions in that function are worth calling out.

**Midday, not midnight.** `createMiddayDate` parses `2026-04-30` as
`2026-04-30T12:00:00` local. Parsing a bare ISO date gives UTC midnight, which in
any negative-offset timezone renders as the previous day. For an app whose
central object is "which day was this logged on", that off-by-one is a
correctness bug, not a formatting nit.

**`month: 'short'` only for English.** Abbreviated month names are idiomatic in
English and awkward-to-wrong in Japanese, Chinese and Russian, so everything else
gets the full form.

Range separators cannot come from `Intl` and are a translation, not punctuation:

```ts
// floriva-app/src/localization/formatters.ts:7-16
const localizedRangeSeparators = {
  en: ' to ',
  es: ' a ',
  de: ' bis ',
  fr: ' au ',
  ja: '〜',
  'zh-Hans': '至',
  pt: ' a ',
  ru: ' — ',
} satisfies Record<SupportedLocale, string>;
```

The `satisfies Record<SupportedLocale, string>` is doing real work: adding a
ninth locale to `config.ts` makes this object a type error, so a new language
cannot ship with a hardcoded English " to " in every predicted date range. The
same pattern appears in `localeDisplayLabels` and in the per-locale copy guards.

`formatLocalizedReminderTime` goes through `Intl` for hour/minute so 12-hour and
24-hour conventions follow the locale rather than a hardcoded format string, and
`formatLocalizedDate` returns `null` for an unparseable timestamp instead of
rendering `Invalid Date`.

---

## Copy guards

Two test-side guards apply across all eight locales at once, which is the only
scale at which they are useful.

**`tests/helpers/bannedMedicalTerms.ts`**: a per-locale regex of
diagnosis/treatment/guarantee vocabulary, applied to prediction, anomaly and
paywall copy in every locale. The lists are narrower than "anything medical" on
purpose, and the file says so: the app is *allowed* to say "not a medical
measurement", and does, in every locale, so bare `medical` / `médica` / `医学`
is not banned, only diagnosis, treatment, guarantee and risk-of language:

```ts
// floriva-app/tests/helpers/bannedMedicalTerms.ts:23-28
  en: /diagnos|medical advice|guarantee|\bcure\b|\btreat(?:ment)?\b|abnormal|disorder|disease|risk of/iu,
  es: /diagn[oó]s|consejo médico|garant[ií]|tratamiento|\bcurar?\b|anormal|trastorno|enfermedad|riesgo de/iu,
  …
  ja: /診断|医療アドバイス|医学的助言|保証|治療|異常|障害|疾患|病気|リスク/u,
  'zh-Hans': /诊断|医疗建议|保证|治疗|异常|失调|疾病|风险/u,
```

Writing those seven non-English patterns is the part a monolingual maintainer
cannot fake by proofreading, and it is why the guard is a regex list rather than
a review step.

**`tests/sanity/user-facing-copy-versioning.test.ts`**: walks every file under
`src/localization/messages/` (plus screens and `copy.ts` files) and fails on
`/\bv1\b/i`. Internal release labels leaking into shipped strings is a small,
recurring, entirely preventable embarrassment.

---

## The honest part: some of this was machine-translated

English is the source language and the only one written by a native speaker. The
other seven catalogs were produced with machine assistance. Most of the app's
copy was reviewed carefully for meaning against the English, and the guards above
apply to all eight locales, but **no native speaker reviewed any non-English
string**, and at least two batches were shipped explicitly unreviewed.

The 1.4.0 release commit records one of them in its own message
(`git show 163477ce`):

> The seven non-English blocks in both release-note files and the
> `settings.subscription.current.retired` key are unreviewed machine
> translations.

That key is the retirement notice shown in Settings on the final release: one
of the more consequential strings in the app, since it explains to a paying user
that the product is now free and their subscription will not renew. It shipped in
seven languages nobody checked.

The internal wind-down record lists native review of the machine translations as
outstanding work, with the same assessment: accurate in meaning, no native
speaker sign-off. A separate product audit flagged the localized store listings
the same way: the linguistic QA checklist exists and is entirely unchecked,
which is an assurance gap rather than evidence of bad translations.

"1,107 strings translated into 8 locales with zero key drift" is a true and
verifiable statement about **structure**. It is not a statement about quality,
and the two should not be confused. The structural property is machine-checked
on every CI run; the quality property was never established, and the honest thing
to do with an unestablished property is say so.
