const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const requiredPublicEnv = [
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_IOS_APP_STORE_ID',
  'EXPO_PUBLIC_IOS_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_IOS_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_IOS_LIFETIME_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID',
];

const requiredAndroidSigningEnv = [
  'FLORIVA_UPLOAD_STORE_FILE',
  'FLORIVA_UPLOAD_STORE_PASSWORD',
  'FLORIVA_UPLOAD_KEY_ALIAS',
  'FLORIVA_UPLOAD_KEY_PASSWORD',
];

const releaseNoteLocales = ['en', 'es', 'de', 'fr', 'ja', 'zh-Hans', 'pt', 'ru'];

const releaseNotePlatforms = [
  {
    name: 'App Store',
    fileName: (version) => `app-store-whats-new-${version}.md`,
    heading: (version) => `# App Store What's New — ${version}`,
    maxCharacters: 4000,
    forbiddenTerms: [
      ['Google Play', /\bgoogle[\s_-]*play\b/i],
      ['Play Store', /\bplay[\s_-]*store\b/i],
      ['Google', /\bgoogle\b/i],
      ['Android', /\bandroid\b/i],
      ['Material Design', /\bmaterial\s+(?:design|3)\b/i],
    ],
  },
  {
    name: 'Google Play',
    fileName: (version) => `google-play-release-notes-${version}.md`,
    heading: (version) => `# Google Play Release Notes — ${version}`,
    maxCharacters: 500,
    forbiddenTerms: [
      ['App Store', /\bapp\s+store\b/i],
      ['Apple', /\bapple\b/i],
      ['iOS', /\bios\b/i],
      ['iPhone', /\biphone\b/i],
      ['iPad', /\bipad\b/i],
      ['TestFlight', /\btestflight\b/i],
      ['Liquid Glass', /\bliquid\s+glass\b/i],
    ],
  },
];

function createRuntime(overrides = {}) {
  return {
    cwd: overrides.cwd ?? process.cwd(),
    env: overrides.env ?? process.env,
    execFileSync: overrides.execFileSync ?? execFileSync,
    fs: overrides.fs ?? fs,
  };
}

function runCommand(runtime, command, args, options = {}) {
  return runtime.execFileSync(command, args, {
    ...options,
    env: runtime.env,
  });
}

function missingEnv(keys, runtime) {
  return keys.filter((key) => !runtime.env[key]?.trim());
}

function parseLocalizedReleaseNotes(markdown) {
  const headings = [...markdown.matchAll(/^## ([^\r\n]+)\r?$/gm)];

  return headings.map((heading, index) => {
    const bodyStart = (heading.index ?? 0) + heading[0].length;
    const bodyEnd = headings[index + 1]?.index ?? markdown.length;

    return {
      locale: heading[1].trim(),
      note: markdown.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function validateReleaseNoteDocument(markdown, platform, version) {
  const failures = [];
  const entries = parseLocalizedReleaseNotes(markdown);

  if (!markdown.startsWith(platform.heading(version))) {
    failures.push(
      `${platform.name} release notes must start with "${platform.heading(version)}".`,
    );
  }

  for (const locale of releaseNoteLocales) {
    const localeEntries = entries.filter((entry) => entry.locale === locale);

    if (localeEntries.length !== 1) {
      failures.push(
        `${platform.name} release notes must contain exactly one ## ${locale} block.`,
      );
      continue;
    }

    const [{ note }] = localeEntries;

    if (!note) {
      failures.push(`${platform.name} release notes locale ${locale} is empty.`);
      continue;
    }

    if (Array.from(note).length > platform.maxCharacters) {
      failures.push(
        `${platform.name} release notes locale ${locale} exceeds ${platform.maxCharacters} characters.`,
      );
    }

    const normalizedNote = note.normalize('NFKC');

    for (const [label, pattern] of platform.forbiddenTerms) {
      if (pattern.test(normalizedNote)) {
        failures.push(
          `${platform.name} release notes locale ${locale} mention forbidden platform term "${label}".`,
        );
      }
    }
  }

  const unexpectedLocales = entries
    .map((entry) => entry.locale)
    .filter((locale) => !releaseNoteLocales.includes(locale));

  for (const locale of unexpectedLocales) {
    failures.push(
      `${platform.name} release notes contain unsupported locale block ## ${locale}.`,
    );
  }

  return failures;
}

function validateReleaseNoteFiles(runtime) {
  const failures = [];
  const packagePath = path.resolve(runtime.cwd, 'package.json');
  let version;

  try {
    version = JSON.parse(runtime.fs.readFileSync(packagePath, 'utf8')).version;
  } catch {
    failures.push(`Could not read release version from ${packagePath}.`);
    return failures;
  }

  if (typeof version !== 'string' || !version.trim()) {
    failures.push(`Release package at ${packagePath} must declare a version.`);
    return failures;
  }

  const releaseNotesDirectory = path.resolve(
    runtime.cwd,
    'docs/phase-4-launch-collateral/generated',
  );

  for (const platform of releaseNotePlatforms) {
    const releaseNotesPath = path.join(
      releaseNotesDirectory,
      platform.fileName(version),
    );

    if (!runtime.fs.existsSync(releaseNotesPath)) {
      failures.push(
        `Missing ${platform.name} release notes at ${releaseNotesPath}. Store releases require separate platform-specific handoffs.`,
      );
      continue;
    }

    let markdown;

    try {
      markdown = runtime.fs.readFileSync(releaseNotesPath, 'utf8');
    } catch {
      failures.push(`Could not read ${platform.name} release notes at ${releaseNotesPath}.`);
      continue;
    }

    failures.push(...validateReleaseNoteDocument(markdown, platform, version));
  }

  return failures;
}

function resolveStoreFile(runtime) {
  const value = runtime.env.FLORIVA_UPLOAD_STORE_FILE;

  if (!value) {
    return null;
  }

  return path.isAbsolute(value) ? value : path.resolve(runtime.cwd, value);
}

function hasValidAndroidKeystore(storeFile, runtime) {
  if (
    !storeFile ||
    !runtime.env.FLORIVA_UPLOAD_STORE_PASSWORD ||
    !runtime.env.FLORIVA_UPLOAD_KEY_ALIAS
  ) {
    return false;
  }

  try {
    runCommand(runtime, 'keytool', [
      '-list',
      '-keystore',
      storeFile,
      '-storepass',
      runtime.env.FLORIVA_UPLOAD_STORE_PASSWORD,
      '-alias',
      runtime.env.FLORIVA_UPLOAD_KEY_ALIAS,
    ], {
      stdio: 'ignore',
    });

    return true;
  } catch {
    return false;
  }
}

function hasValidAndroidKeyPassword(storeFile, runtime) {
  if (
    !storeFile ||
    !runtime.env.FLORIVA_UPLOAD_STORE_PASSWORD ||
    !runtime.env.FLORIVA_UPLOAD_KEY_ALIAS ||
    !runtime.env.FLORIVA_UPLOAD_KEY_PASSWORD
  ) {
    return false;
  }

  const tempDir = runtime.fs.mkdtempSync(
    path.join(os.tmpdir(), 'floriva-release-preflight-'),
  );
  const csrPath = path.join(tempDir, 'upload-key.csr');

  try {
    runCommand(runtime, 'keytool', [
      '-certreq',
      '-keystore',
      storeFile,
      '-storepass',
      runtime.env.FLORIVA_UPLOAD_STORE_PASSWORD,
      '-alias',
      runtime.env.FLORIVA_UPLOAD_KEY_ALIAS,
      '-keypass',
      runtime.env.FLORIVA_UPLOAD_KEY_PASSWORD,
      '-file',
      csrPath,
    ], {
      stdio: 'ignore',
    });

    return runtime.fs.existsSync(csrPath) && runtime.fs.statSync(csrPath).size > 0;
  } catch {
    return false;
  } finally {
    runtime.fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function hasIosDistributionCertificate(runtime) {
  try {
    const identities = runCommand(
      runtime,
      'security',
      ['find-identity', '-v', '-p', 'codesigning'],
      { encoding: 'utf8' },
    );

    return /"Apple Distribution:|"iOS Distribution:/.test(identities);
  } catch {
    return false;
  }
}

function readPlistJson(plistPath, runtime) {
  try {
    return JSON.parse(
      runCommand(runtime, 'plutil', ['-convert', 'json', '-o', '-', plistPath], {
        encoding: 'utf8',
      }),
    );
  } catch {
    return null;
  }
}

function readZippedPlistJson(zipPath, plistPath, runtime) {
  try {
    const plist = runCommand(runtime, 'unzip', ['-p', zipPath, plistPath]);

    return JSON.parse(
      runCommand(runtime, 'plutil', ['-convert', 'json', '-o', '-', '-'], {
        input: plist,
        encoding: 'utf8',
      }),
    );
  } catch {
    return null;
  }
}

function getAppStoreExportPaths(runtime) {
  const summaryPath = runtime.env.FLORIVA_IOS_DISTRIBUTION_SUMMARY
    ? path.resolve(runtime.cwd, runtime.env.FLORIVA_IOS_DISTRIBUTION_SUMMARY)
    : path.resolve(runtime.cwd, 'build/release/AppStoreExport/DistributionSummary.plist');

  return {
    summaryPath,
    ipaPath: path.resolve(path.dirname(summaryPath), 'Floriva.ipa'),
  };
}

function getAndroidBundlePath(runtime) {
  return path.resolve(
    runtime.cwd,
    'android/app/build/outputs/bundle/release/app-release.aab',
  );
}

function readAndroidBundleMetadata(bundlePath, runtime) {
  try {
    const manifest = runCommand(
      runtime,
      'bundletool',
      ['dump', 'manifest', `--bundle=${bundlePath}`, '--module=base'],
      { encoding: 'utf8' },
    );

    return {
      packageName: manifest.match(/\bpackage="([^"]+)"/)?.[1],
      versionName: manifest.match(/\b(?:android:)?versionName="([^"]+)"/)?.[1],
      versionCode: manifest.match(/\b(?:android:)?versionCode="([^"]+)"/)?.[1],
    };
  } catch {
    return null;
  }
}

function hasSubmitReadyAndroidBundle(runtime) {
  const bundlePath = getAndroidBundlePath(runtime);

  if (!runtime.fs.existsSync(bundlePath) || runtime.fs.statSync(bundlePath).size <= 0) {
    return false;
  }

  const metadata = readAndroidBundleMetadata(bundlePath, runtime);

  return (
    metadata?.packageName === 'app.floriva' &&
    metadata?.versionName === '1.4.0' &&
    metadata?.versionCode === '22'
  );
}

function hasSubmitReadyAppStoreExport(runtime) {
  const { summaryPath, ipaPath } = getAppStoreExportPaths(runtime);

  if (!runtime.fs.existsSync(summaryPath) || !runtime.fs.existsSync(ipaPath)) {
    return false;
  }

  const summaryStat = runtime.fs.statSync(summaryPath);
  const ipaStat = runtime.fs.statSync(ipaPath);

  if (ipaStat.size <= 0 || ipaStat.mtimeMs + 1000 < summaryStat.mtimeMs) {
    return false;
  }

  const ipaInfo = readZippedPlistJson(
    ipaPath,
    'Payload/Floriva.app/Info.plist',
    runtime,
  );

  if (
    ipaInfo?.CFBundleIdentifier !== 'app.floriva' ||
      ipaInfo?.CFBundleShortVersionString !== '1.4.0' ||
      ipaInfo?.CFBundleVersion !== '22' ||
    ipaInfo?.CFBundleExecutable !== 'Floriva'
  ) {
    return false;
  }

  const summary = readPlistJson(summaryPath, runtime);
  const entries = summary?.['Floriva.ipa'];

  if (!Array.isArray(entries) || entries.length === 0) {
    return false;
  }

  return entries.some((entry) => {
    const certificateType = entry?.certificate?.type;
    const profileName = entry?.profile?.name;
    const profileExpiration = entry?.profile?.dateExpires;
    const entitlements = entry?.entitlements;

    return (
      typeof certificateType === 'string' &&
      certificateType.includes('Apple Distribution') &&
      typeof profileName === 'string' &&
      profileName.length > 0 &&
      typeof profileExpiration === 'string' &&
      entry?.team?.id === 'TEAMID1234' &&
      entry?.buildNumber === '22' &&
      entry?.versionNumber === '1.4.0' &&
      entitlements?.['application-identifier'] === 'TEAMID1234.app.floriva' &&
      entitlements?.['get-task-allow'] === false
    );
  });
}

function runReleasePreflight(overrides = {}) {
  const runtime = createRuntime(overrides);
  const missingPublicEnvironment = missingEnv(requiredPublicEnv, runtime);
  const missingSigningEnvironment = missingEnv(requiredAndroidSigningEnv, runtime);
  const storeFile = resolveStoreFile(runtime);
  const failures = [];
  const hasSubmitReadyIosExport = hasSubmitReadyAppStoreExport(runtime);
  const hasSubmitReadyAndroidExport = hasSubmitReadyAndroidBundle(runtime);

  failures.push(...validateReleaseNoteFiles(runtime));

  if (runtime.env.APP_ENV !== 'production') {
    failures.push('APP_ENV must be production for a store release build.');
  }

  if (missingPublicEnvironment.length > 0) {
    failures.push(
      `Missing public release env keys: ${missingPublicEnvironment.join(', ')}`,
    );
  }

  if (missingSigningEnvironment.length > 0) {
    failures.push(
      `Missing Android signing env keys: ${missingSigningEnvironment.join(', ')}`,
    );
  }

  if (storeFile && !runtime.fs.existsSync(storeFile)) {
    failures.push('FLORIVA_UPLOAD_STORE_FILE points to a file that does not exist.');
  }

  if (
    storeFile &&
    runtime.fs.existsSync(storeFile) &&
    !hasValidAndroidKeystore(storeFile, runtime)
  ) {
    failures.push(
      'FLORIVA_UPLOAD_STORE_FILE must be a readable Android keystore containing FLORIVA_UPLOAD_KEY_ALIAS.',
    );
  }

  if (
    storeFile &&
    runtime.fs.existsSync(storeFile) &&
    !hasValidAndroidKeyPassword(storeFile, runtime)
  ) {
    failures.push('FLORIVA_UPLOAD_KEY_PASSWORD must unlock the configured Android upload key.');
  }

  if (!hasSubmitReadyAndroidExport) {
    failures.push(
      `Missing validated Android App Bundle at ${getAndroidBundlePath(runtime)} with package app.floriva, versionName 1.4.0, and versionCode 22.`,
    );
  }

  if (!hasSubmitReadyIosExport) {
    const { summaryPath, ipaPath } = getAppStoreExportPaths(runtime);
    const exportHint = hasIosDistributionCertificate(runtime)
      ? 'A local distribution signing identity is available, but the final App Store export must still be generated and validated.'
      : 'Xcode managed signing can satisfy this check after a successful App Store export.';

    failures.push(
      `Missing validated App Store IPA export at ${ipaPath} with distribution summary ${summaryPath}. ${exportHint}`,
    );
  }

  return failures;
}

function main(overrides = {}, logger = console) {
  const failures = runReleasePreflight(overrides);

  if (failures.length > 0) {
    logger.error('Floriva release preflight failed:');
    failures.forEach((failure) => {
      logger.error(`- ${failure}`);
    });
    return 1;
  }

  logger.log('Floriva release preflight passed.');
  return 0;
}

module.exports = {
  main,
  parseLocalizedReleaseNotes,
  runReleasePreflight,
  validateReleaseNoteDocument,
  validateReleaseNoteFiles,
};

if (require.main === module) {
  process.exitCode = main();
}
