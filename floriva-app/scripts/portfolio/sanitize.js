/**
 * Sanitization primitives for the public portfolio snapshot.
 *
 * Design note — three independent controls, in order:
 *   1. `git archive HEAD` is the copy source, so only *tracked* files can ever
 *      be emitted. The live Play upload key, `credentials.json` and `.env.local`
 *      are untracked and are therefore excluded by construction, not by anyone
 *      remembering to list them.
 *   2. DENYLIST removes tracked-but-unsafe paths (PII-bearing docs, screenshots
 *      with an Apple ID burned into the pixels, build output, this audit's own
 *      ledgers).
 *   3. SCAN_RULES run over whatever survives and hard-fail the build.
 *
 * Rewrites (`buildRewriteTable`) are derived from the archived tree at runtime,
 * and the value-specific scan rules are derived from that same table. No real
 * identifier or address is written in this file, because this file ships in the
 * public snapshot.
 *
 * That was previously a claim rather than a fact: store identifiers, the Apple
 * team ID and two live offer codes were hardcoded, and the file relied on the
 * sanitizer rewriting its own source on the way out. A factored alternation
 * defeated that, and three real identifiers shipped. The rule now is simply
 * that a secret never appears here in any spelling.
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Glob matching (no dependency — the repo's privacy rules discourage adding
// packages, and the pattern subset needed here is small).
// ---------------------------------------------------------------------------

function globToRegExp(pattern) {
  // A trailing slash means "this directory and everything beneath it".
  const directoryScoped = pattern.endsWith('/');
  const normalized = directoryScoped ? pattern.slice(0, -1) : pattern;

  let out = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (char === '*') {
      if (normalized[i + 1] === '*') {
        // `**/` consumes any number of leading segments (including none).
        if (normalized[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        // A single `*` stays inside one path segment.
        out += '[^/]*';
      }
      continue;
    }

    out += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }

  // Case-insensitive, because the denylist is a *security* control and macOS
  // filesystems are case-insensitive. `upload.jks` was denied while `upload.JKS`
  // sailed through the allowlist under `android/`, was read as UTF-8, matched no
  // content rule (a keystore has no PEM header and no email in it), and shipped.
  return new RegExp(`^${out}${directoryScoped ? '(?:/.*)?' : ''}$`, 'i');
}

const globCache = new Map();

function compileGlob(pattern) {
  let compiled = globCache.get(pattern);
  if (!compiled) {
    compiled = globToRegExp(pattern);
    globCache.set(pattern, compiled);
  }
  return compiled;
}

function matchesAnyPattern(relPath, patterns) {
  return patterns.some((pattern) => compileGlob(pattern).test(relPath));
}

// ---------------------------------------------------------------------------
// Denylist. Every entry traces to a confirmed finding in the D1 / C1 leak
// sweeps (see docs/portfolio/ledgers/, which is itself denylisted below).
// ---------------------------------------------------------------------------

const DENYLIST = [
  // Tier 1 — hard secrets. All untracked today, so `git archive` already drops
  // them; listed anyway so the guarantee does not depend on that alone.
  'credentials.json',
  '.env.local',
  '**/.env.local',
  '**/*.jks',
  '**/*.keystore',
  '**/*.p12',
  '**/*.p8',
  '**/*.pem',
  '**/*.key',
  '**/*.mobileprovision',
  '**/*.pfx',
  '**/*.cer',
  '**/*.certSigningRequest',
  'android/local.properties',
  '.local/',
  '.expo/',

  // Tier 2 — build output. Large, and carries provisioning profiles and
  // compiled configuration.
  'build/',
  'ios/build/',
  'ios/build-storekit/',
  'ios/Pods/',
  'android/build/',
  'android/.gradle/',
  'android/app/build/',
  'dist/',
  'coverage/',
  'artifacts/',
  '.asset-venv/',
  'node_modules/',
  '**/node_modules/',
  'web-build/',
  '**/*.xcarchive/',
  '**/*.dSYM/',

  // Tier 3 — docs carrying PII, store-account identifiers, or customer counts.
  'docs/phase-4-launch-collateral/',
  'docs/release/',

  // Tier 4 — binary assets with PII burned into the pixels. No text scan can
  // read these; the filename rule and a human review pass are the only defence.
  'manual-onboarding-screenshots/',
  'manual-onboarding-screenshots-sandbox/',
  'manual-onboarding-screenshots-e2e-fixes/',
  'manual-onboarding-screenshots-clean-main/',
  '**/*sandbox-login*',
  '**/*-login-filled.*',
  '**/*apple-account*',
  '**/*credential*',
  '**/*signin*',
  '**/*sign-in*',

  // Tier 5 — raw device and CI logs. Noisy, and never reviewed by eye.
  'docs/qa/**/detox-artifacts/',
  'docs/qa/**/logs/',
  'docs/qa/**/*logcat*',
  'docs/qa/**/*.log',
  'docs/qa/**/detox.trace.json',
  '**/*-API_*.log',

  // Tier 5b — QA capture media. The 47 markdown QA reports are kept: they are
  // strong evidence of process. Their 1,939 accompanying screenshots and videos
  // are 866 MB, span many superseded designs, and are replaced in the public
  // repo by a freshly captured, curated set under `screenshots/`.
  'docs/qa/**/*.png',
  'docs/qa/**/*.jpg',
  'docs/qa/**/*.jpeg',
  'docs/qa/**/*.gif',
  'docs/qa/**/*.mp4',
  'docs/qa/**/*.mov',

  // Tier 6 — hygiene.
  '**/.DS_Store',
  '.DS_Store',
  '**/*.tsbuildinfo',
  'package-lock.json',

  // Tier 6b — release-operations guard tests. These assert on the *contents* of
  // the Tier 3 docs above (e.g. that the setup guide contains a given support
  // address). With their subject documents excluded they cannot pass, so they
  // leave with them. This costs 2 of 287 test files and is disclosed in the
  // published docs/testing-and-quality.md rather than quietly absorbed.
  'tests/sanity/phase4-launch-collateral.test.ts',
  'tests/sanity/release-config.test.ts',

  // The sanitizer's own test file, which cannot survive its own pipeline. Its
  // fixtures are by construction the exact strings the rewrite pass replaces,
  // so the emitted copy asserts that `~/Code/floriva` trips the developer-home
  // rule — it does not, because `~` is what that rule rewrites *to*. The rest
  // of it derives fixtures from the rewrite table, which is built from
  // documents Tier 3 correctly excludes.
  //
  // Deleting it is honest; shipping a copy that fails, or one quietly rewritten
  // into passing vacuously, is not. sanitize.js itself still ships and is the
  // thing worth reading. Disclosed in docs/testing-and-quality.md.
  'tests/scripts/portfolio/sanitize.test.ts',

  // Tier 6c — compiled artifacts of the brand-asset generator. Build output
  // that no other tier named; the .pyc embeds the sibling private repo's name.
  '**/__pycache__/',
  '**/*.pyc',

  // Tier 6d — raw capture samples. `.txt`, so the Tier 5 `*.log` rule missed
  // them, and 1.2 MB between them. Both were read in full and are clean, but a
  // megabyte of unreviewed machine output is not worth the residual risk.
  'docs/qa/**/*sample.txt',
  'docs/qa/**/*-log.txt',

  // Tier 7 — the audit apparatus itself. These ledgers enumerate every
  // identifier and file:line that was sanitized; publishing them would hand a
  // reader the map of exactly what was removed.
  'docs/portfolio/',
];

// ---------------------------------------------------------------------------
// Allowlist. The third control: nothing ships unless it sits under a path we
// deliberately chose to publish. A directory added to the private repo later
// cannot ride along just because nobody thought to write a denylist rule.
// ---------------------------------------------------------------------------

const ALLOWLIST = [
  'src/',
  'app/',
  'components/',
  'constants/',
  'tests/',
  'e2e/',
  'scripts/',
  'drizzle/',
  'assets/',
  'patches/',
  'ios/',
  'android/',
  'docs/',
  '.github/',
  '.vscode/',
  // Individual root files.
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'app.config.ts',
  'babel.config.js',
  'metro.config.js',
  'jest.config.js',
  'eslint.config.js',
  'detox.config.js',
  'drizzle.config.ts',
  'tsconfig.json',
  'sql.d.ts',
  'expo-env.d.ts',
  '.gitignore',
  '.env.production.example',
  '.env.preview.example',
  'eas.json',
  'README.md',
  'LICENSE',
];

function shouldInclude(relPath) {
  if (matchesAnyPattern(relPath, DENYLIST)) return false;
  return ALLOWLIST.some((entry) =>
    entry.endsWith('/') ? relPath.startsWith(entry) : relPath === entry,
  );
}

// ---------------------------------------------------------------------------
// Rewrites
// ---------------------------------------------------------------------------

/**
 * Apply the substitution table.
 *
 * Literal (`find`) entries run first, longest first, so that a specific string
 * cannot be shadowed by a shorter prefix of itself. Pattern (`pattern`) entries
 * run afterwards and exist for values that vary between capture sessions — a
 * macOS per-user temp handle differs per account, so the historical ones in the
 * QA logs cannot be derived from the machine running the build.
 */
/** Escape a string the way it would be written inside a regex literal. */
function regexEscaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Expand each literal rewrite to also cover its regex-escaped spelling.
 *
 * A plain `split`/`join` misses a secret written as a regex literal: a value
 * whose dots are backslash-escaped is simply a different string from the one
 * the table looks for. That is not hypothetical — a real address survived into
 * the assembled snapshot twice, in
 * `tests/features/settings/SettingsScreen.test.tsx`, purely because the test
 * asserted on it with `screen.getByText(/…/)`.
 *
 * The escaped form is longer than the plain one, so length-descending order
 * applies it first and the plain rule cannot corrupt a partial match inside it.
 */
function expandLiteralRewrites(literals) {
  const expanded = [];
  for (const entry of literals) {
    const escapedFind = regexEscaped(entry.find);
    if (escapedFind !== entry.find) {
      expanded.push({ find: escapedFind, replace: regexEscaped(entry.replace) });
    }
    expanded.push(entry);
  }
  return expanded.sort((a, b) => b.find.length - a.find.length);
}

function applyRewrites(text, table) {
  const literals = expandLiteralRewrites(
    table.filter((entry) => typeof entry.find === 'string'),
  );
  const patterns = table.filter((entry) => entry.pattern instanceof RegExp);

  let out = text;
  for (const { find, replace } of literals) {
    out = out.split(find).join(replace);
  }
  for (const { pattern, replace } of patterns) {
    out = out.replace(pattern, replace);
  }
  return out;
}

function readIfPresent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Derive the substitution table from the private working tree.
 *
 * `appRoot` is the floriva-app directory. Values are extracted by pattern from
 * their source of truth rather than hardcoded, so this file stays publishable
 * and the table cannot drift out of sync with the code.
 */
/** Addresses that are already public and must survive rewriting unchanged. */
const PUBLIC_EMAIL = /@(?:floriva\.app|example\.com|example\.org)$/i;

/**
 * Files `buildRewriteTable` derives its replacements from.
 *
 * Every secret is read from one of these at runtime. If one is missing the
 * table comes back short, and a short table means real values pass through
 * unrewritten — so the build must fail rather than emit a snapshot it only
 * appears to have sanitized. `build-snapshot.js` checks this before copying.
 */
const REWRITE_SOURCES = [
  'ios/ExportOptionsAppStore.plist',
  'app.config.ts',
  'docs/phase-4-launch-collateral/store-submission-runbook.md',
  'docs/phase-4-launch-collateral/support-help.md',
  'docs/release/2026-08-11-floriva-wind-down.md',
  'tests/sanity/release-config.test.ts',
];

function missingRewriteSources(appRoot) {
  return REWRITE_SOURCES.filter((rel) => !fs.existsSync(path.join(appRoot, rel)));
}

function buildRewriteTable(appRoot) {
  const table = [];
  const push = (find, replace) => {
    if (find && !table.some((entry) => entry.find === find)) {
      table.push({ find, replace });
    }
  };

  // Apple team ID — load-bearing in the Xcode project and the preflight script,
  // so it must be rewritten rather than dropped. Ten characters in, ten out, to
  // keep `application-identifier` string arithmetic intact.
  const exportOptions = readIfPresent(path.join(appRoot, 'ios/ExportOptionsAppStore.plist'));
  const teamId = exportOptions.match(/<key>teamID<\/key>\s*<string>([A-Z0-9]{10})<\/string>/);
  if (teamId) push(teamId[1], 'TEAMID1234');

  const appConfig = readIfPresent(path.join(appRoot, 'app.config.ts'));

  // Founder address -> the already-public support address. The self-audit says
  // this is what should have been there in the first place.
  //
  // Keyed on `supportEmail:` rather than on the employer domain. Naming the
  // domain here would disclose it, since this file ships.
  const founderEmail = appConfig.match(/supportEmail:[^']*'([^']+@[^']+)'/);
  if (founderEmail) push(founderEmail[1], 'support@floriva.app');

  // EAS project UUID.
  const easProjectId = appConfig.match(
    /projectId:\s*'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/,
  );
  if (easProjectId) push(easProjectId[1], '00000000-0000-0000-0000-000000000000');

  // Redeemable save-offer codes. Monthly and annual are told apart by the env
  // var each falls back from, not by the code's own prefix — spelling the
  // prefix here would publish half of a live redeemable code.
  for (const match of appConfig.matchAll(
    /iosOfferCode:\s*process\.env\.(\w+)\s*\?\?\s*'([A-Z0-9]+)'/g,
  )) {
    push(match[2], /MONTHLY/.test(match[1]) ? 'SAVEMONTHLY' : 'SAVEANNUAL');
  }

  // Personal and third-party addresses. Read from the release runbook, which is
  // denylisted — this is defence in depth in case that exclusion is ever undone.
  const runbook = readIfPresent(
    path.join(appRoot, 'docs/phase-4-launch-collateral/store-submission-runbook.md'),
  );
  //
  // Every address in that runbook is rewritten except the already-public
  // floriva.app ones. Enumerating the private domains here — a webmail list, a
  // vendor domain — would itself disclose them, and would silently miss any
  // address at a domain nobody thought to list.
  let personalIndex = 0;
  for (const match of runbook.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    if (PUBLIC_EMAIL.test(match[0])) continue;
    push(match[0], `personal-${personalIndex}@example.com`);
    personalIndex += 1;
  }

  // Addresses asserted on in tests/sanity/release-config.test.ts.
  const releaseConfigTest = readIfPresent(
    path.join(appRoot, 'tests/sanity/release-config.test.ts'),
  );
  for (const match of releaseConfigTest.matchAll(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  )) {
    if (PUBLIC_EMAIL.test(match[0])) continue;
    push(match[0], 'former-contact@example.com');
  }

  // Real phone number, from the support doc. 555-01xx is the reserved
  // fictional range.
  const supportHelp = readIfPresent(
    path.join(appRoot, 'docs/phase-4-launch-collateral/support-help.md'),
  );
  const phone = supportHelp.match(/(?:phone|tel|call)[^\n]{0,40}?(\+?1?[ .-]?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})/i);
  if (phone) push(phone[1], '555-555-0100');

  // Store-internal identifiers, read from the wind-down record rather than
  // written here. The public App Store ID is deliberately not rewritten — it is
  // already in the store URL, eas.json and the .env examples.
  //
  // These were previously hardcoded. That was wrong twice over: the sanitizer
  // then rewrote its own source on the way out, mangling the calls into
  // `push('10000000', '10000000')`, and any value the literal rewrite could not
  // match shipped in the clear. Three real product IDs did exactly that,
  // because they were written as a regex alternation over a shared prefix and
  // a factored spelling never equals the string it denotes.
  const windDown = readIfPresent(
    path.join(appRoot, 'docs/release/2026-08-11-floriva-wind-down.md'),
  );
  const productSlots = { monthly: '6760000001', annual: '6760000002', lifetime: '6760000003' };
  for (const match of windDown.matchAll(
    /`floriva\.plus\.(monthly|annual|lifetime)`\s*\|\s*`(\d{6,})`/g,
  )) {
    push(match[2], productSlots[match[1]]);
  }

  const subscriptionGroup = windDown.match(/[Ss]ubscription group[^`]*`(\d{6,})`/);
  if (subscriptionGroup) push(subscriptionGroup[1], '10000000');

  const playIds = windDown.match(/Play developer `(\d{6,})`[^`]*`(\d{6,})`/);
  if (playIds) {
    push(playIds[1], '1000000000000000000');
    push(playIds[2], '2000000000000000000');
  }

  // App Store Connect team UUID. Only ever appeared in denylisted documents, so
  // this is defence in depth against that exclusion being undone.
  const ascTeam = windDown.match(
    /team `([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`/,
  );
  if (ascTeam) push(ascTeam[1], '00000000-0000-0000-0000-000000000000');

  // Developer home paths, derived from where this checkout actually lives.
  const repoRoot = path.dirname(appRoot);
  push(repoRoot, '<repo>');
  const homeDir = process.env.HOME;
  if (homeDir) push(homeDir, '~');

  const sorted = table.sort((a, b) => b.find.length - a.find.length);

  // Pattern entries, for values that differ between capture sessions and so
  // cannot be derived from the machine running the build.
  sorted.push(
    // macOS per-user temp handle, e.g. /var/folders/ab/cdef…0000gn
    { pattern: /\/var\/folders\/[a-z0-9]{2}\/[a-z0-9]{20,}/g, replace: '<tmp>' },
    // CoreSimulator device UUIDs in captured crash samples.
    {
      pattern: /\/Devices\/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g,
      replace: '/Devices/<device>',
    },
  );

  return sorted;
}

// ---------------------------------------------------------------------------
// Content scanning
// ---------------------------------------------------------------------------

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.icns', '.ico',
  '.mp4', '.mov', '.m4a', '.wav', '.aac', '.caf',
  '.ttf', '.otf', '.woff', '.woff2',
  '.zip', '.aab', '.apk', '.ipa', '.jar', '.so', '.dylib', '.a',
  '.pdf', '.sqlite', '.db', '.bin', '.car',
  // NOT `.strings` or `.nib`: both are commonly plain text. Listing `.strings`
  // here meant eight shipped iOS localization files were never rewritten and
  // never scanned. When in doubt, treat a file as text — a text file wrongly
  // called binary escapes every content control, while a binary file wrongly
  // called text merely produces noise.
]);

function isProbablyBinaryPath(relPath) {
  return BINARY_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

// Files whose contents are structurally full of high-entropy strings that look
// like credentials but are not.
const CONTENT_SCAN_SKIP = [
  'pnpm-lock.yaml',
  '**/*.lock',
  '**/*.map',
  'ios/Podfile.lock',
  // This scanner's own test file necessarily contains planted fake secrets —
  // a PEM header, vendor-key shapes, a JWT — as negative fixtures. Scoped to
  // the single exact path, never a directory, so nothing else can hide behind
  // it. Its fixtures are synthetic; see the test file itself.
  'tests/scripts/portfolio/sanitize.test.js',
  'tests/scripts/portfolio/sanitize.test.ts',
];

// Addresses that are intentionally public or are placeholders.
const EMAIL_ALLOWLIST = [
  /^support@floriva\.app$/i,
  /^privacy@floriva\.app$/i,
  /@example\.(com|org|net)$/i,
  /^git@github\.com$/i,
  // Anchored. Unanchored, this allowed any address whose local part merely
  // ended in "noreply" — a real person's address with that suffix was allowed
  // through at any domain.
  /^no-?reply@/i,
  /@users\.noreply\.github\.com$/i,
];

// Restricted to plausible TLDs so that asset filenames (`AppIcon60x60@2x.png`),
// Android package strings (`android.hardware.audio@7.1-impl.ranchu`) and
// per-user package ids (`0@app.floriva`) do not read as addresses.
const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(?:com|org|net|io|app|dev|co|edu|gov|me|ai|uk|de|fr|jp|cn|br|ru|es|it|nl|se|no|info|biz)\b/g;

const SCAN_RULES = [
  {
    id: 'G-01',
    description: 'email address',
    test(text) {
      const hits = [];
      for (const match of text.matchAll(EMAIL_PATTERN)) {
        if (!EMAIL_ALLOWLIST.some((allowed) => allowed.test(match[0]))) hits.push(match[0]);
      }
      return hits;
    },
  },
  {
    id: 'G-05',
    description: 'PEM private key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'G-06',
    description: 'vendor API key',
    // Deliberately requires a full vendor prefix. A bare `sk`/`pk` rule fires on
    // ordinary identifiers such as `skipNextTextInputDidChangeSelection`.
    pattern:
      /\b(?:sk-ant-|sk-|pk_(?:live|test)_|rk_(?:live|test)_|ghp_|gho_|ghs_|github_pat_|xox[baprs]-|AKIA|ASIA|AIza)[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    id: 'G-07',
    description: 'RevenueCat-style test key',
    pattern: /\btest_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: 'G-08',
    description: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    id: 'G-09',
    description: 'developer home path',
    test(text) {
      // `/Users/USER` is the conventional anonymized form and already appears
      // that way in some captured crash samples. Accept it.
      return [...text.matchAll(/\/Users\/[A-Za-z0-9._-]+/g)]
        .map((match) => match[0])
        .filter((hit) => hit !== '/Users/USER');
    },
  },
  {
    id: 'G-10',
    description: 'macOS per-user temp handle',
    pattern: /\/var\/folders\/[a-z0-9]{2}\/[a-z0-9]{20,}/g,
  },
  {
    id: 'G-13',
    description: 'customer-count disclosure',
    pattern:
      /\b\d{1,4}\s+(?:paying|active|free[- ]trial|trial)\s+(?:app store |play )?(?:customer|subscriber|user|install)s?\b/gi,
  },
  {
    // G-14 (save-offer codes), G-15 (store-internal identifiers) and G-16 (the
    // Apple team ID) used to be literal patterns here. `buildSecretScanRules`
    // now derives them from the runtime rewrite table instead.
    //
    // Spelling a secret out in this file was never safe, because this file
    // ships. It only *appeared* safe: the sanitizer rewrote its own source on
    // the way out. That works for a value the literal rewrite can match and
    // fails silently for one it cannot — a factored alternation never equals
    // the string it denotes, so three real identifiers written that way shipped
    // in the clear. The same self-rewrite also mangled the surviving calls into
    // no-ops of the form `push('10000000', '10000000')`.
    //
    // Deriving these from the rewrite table leaves nothing here to leak,
    // nothing to keep in sync, and scans for any new secret automatically.
    id: 'G-11',
    description: 'phone number near a contact word',
    appliesTo: (relPath) => relPath.endsWith('.md'),
    test(text) {
      const hits = [];
      for (const line of text.split('\n')) {
        if (!/(phone|tel|mobile|contact)/i.test(line)) continue;
        for (const match of line.matchAll(
          /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g,
        )) {
          if (match[0].replace(/\D/g, '') !== '5555550100') hits.push(match[0]);
        }
      }
      return hits;
    },
  },
  {
    id: 'G-17',
    description: 'filename suggests credentials captured in pixels',
    isPathRule: true,
    test(_text, relPath) {
      return /(credential|sandbox.?login|login-filled|apple.?account|sign-?in|secret|passwd)/i.test(
        relPath,
      )
        ? [relPath]
        : [];
    },
  },
];

/**
 * Scan rules for the exact values the rewrite table knows about.
 *
 * This is the backstop for a rewrite that did not fire. It matters because a
 * rewrite can miss for reasons the generic rules do not cover: the value is
 * spelled as an escaped regex, or split across a concatenation, or the working
 * tree it was derived from has drifted from the commit being archived.
 *
 * Each value is searched for twice — as written, and in a copy of the file with
 * backslashes stripped. The second pass catches any backslash-based spelling
 * (`angel\.campa@…`) without needing to anticipate the escaping scheme.
 *
 * Short values are skipped: a 4-character secret would match everywhere and the
 * resulting noise would train an operator to ignore this rule.
 */
function buildSecretScanRules(table) {
  const secrets = table.filter(
    (entry) => typeof entry.find === 'string' && entry.find.length >= 6,
  );

  const rules = secrets.map((entry) => ({
    id: 'G-18',
    description: 'sensitive value that survived the rewrite pass',
    test(text) {
      const hits = [];
      if (text.includes(entry.find)) hits.push(entry.find);
      else if (text.replace(/\\/g, '').includes(entry.find)) hits.push(entry.find);
      return hits;
    },
  }));

  // G-21 exists because writing *about* a secret leaked one. A comment here
  // explaining the factored-alternation bug spelled the alternation out, which
  // reconstructed all three identifiers it was warning about — and G-18 could
  // not see it, for exactly the reason the comment was describing.
  //
  // So these scripts may not contain any long fragment of a known secret, in
  // any spelling. The rule is scoped to them because they are the only files
  // with a reason to discuss secrets, and because a bare prefix would be noisy
  // anywhere else.
  const FRAGMENT = 6;
  // Only opaque identifiers — store IDs, the team ID, offer codes, the local
  // part of an address. Filesystem paths are excluded: they are secrets only
  // because of the username in them, and their other fragments ("floriva",
  // "snapshot") are ordinary words that appear everywhere for good reasons.
  const opaque = secrets
    .filter(({ find }) => !find.includes('/'))
    .map(({ find, replace }) => ({ find: find.split('@')[0], replace }))
    .filter(({ find }) => find.length >= FRAGMENT && /\d|[A-Z]{4}/.test(find));

  rules.push({
    id: 'G-21',
    description: 'sanitizer source names a fragment of a known secret',
    appliesTo: (relPath) => relPath.startsWith('scripts/portfolio/'),
    test(text) {
      // Backslashes only — stripping whitespace too would join words across
      // line breaks and invent fragments that were never written.
      const flat = text.replace(/\\/g, '');
      const hits = [];
      for (const { find, replace } of opaque) {
        for (let i = 0; i + FRAGMENT <= find.length; i += 1) {
          const fragment = find.slice(i, i + FRAGMENT);
          // The fragment itself must be distinctive. An address whose local
          // part contains an ordinary word yields fragments like "shadow",
          // which collide with English prose for no security benefit.
          if (!/\d/.test(fragment) && !/^[A-Z]{4,}/.test(fragment)) continue;
          // A fragment shared with the placeholder is not a leak: the
          // placeholders deliberately mimic the shape of the real value.
          if (replace.includes(fragment)) continue;
          if (flat.includes(fragment)) {
            hits.push(fragment);
            break;
          }
        }
      }
      return hits;
    },
  });

  return rules;
}

/**
 * Binary by content, not by extension.
 *
 * The extension list alone shipped eight `InfoPlist.strings` files unrewritten
 * and unscanned: `.strings` is plain text, but it was listed as binary, so the
 * pipeline read it as a Buffer and handed `scanContent` an empty string. A NUL
 * byte in the first 8 KB is the actual signal, and anything undecidable is
 * treated as text so that it gets scanned.
 */
function isBinaryBuffer(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

function scanContent({ relPath, text, rules = SCAN_RULES, binary }) {
  const findings = [];
  // `binary` is passed by the build, which has the bytes and can tell for real.
  // The path heuristic is only the fallback for callers that have not read the
  // file yet.
  const isBinary = binary ?? isProbablyBinaryPath(relPath);
  const skipContent = matchesAnyPattern(relPath, CONTENT_SCAN_SKIP) || isBinary;

  for (const rule of rules) {
    if (!rule.isPathRule && skipContent) continue;
    if (rule.appliesTo && !rule.appliesTo(relPath)) continue;

    const hits = rule.test
      ? rule.test(text, relPath)
      : (text.match(rule.pattern) ?? []);

    for (const hit of hits) {
      findings.push({
        id: rule.id,
        description: rule.description,
        relPath,
        // Masked so the scan report itself never becomes the leak.
        evidence: `${String(hit).slice(0, 3)}***`,
      });
    }
  }

  return findings;
}

module.exports = {
  globToRegExp,
  matchesAnyPattern,
  applyRewrites,
  regexEscaped,
  buildRewriteTable,
  buildSecretScanRules,
  missingRewriteSources,
  scanContent,
  isProbablyBinaryPath,
  isBinaryBuffer,
  shouldInclude,
  ALLOWLIST,
  DENYLIST,
  REWRITE_SOURCES,
  SCAN_RULES,
  CONTENT_SCAN_SKIP,
};
