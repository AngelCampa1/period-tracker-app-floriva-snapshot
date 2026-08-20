import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const preflightScript = path.resolve(__dirname, '../../scripts/check-release-env.js');
type RuntimeOverrides = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  execFileSync?: (...args: unknown[]) => never;
  fs?: typeof fs;
};
type Logger = {
  error: jest.Mock;
  log: jest.Mock;
};
const preflightModule = jest.requireActual(preflightScript) as {
  main: (overrides?: RuntimeOverrides, logger?: Logger) => number;
  runReleasePreflight: (overrides?: RuntimeOverrides) => string[];
  validateReleaseNoteDocument: (
    markdown: string,
    platform: {
      name: string;
      heading: (version: string) => string;
      maxCharacters: number;
      forbiddenTerms: [string, RegExp][];
    },
    version: string,
  ) => string[];
  validateReleaseNoteFiles: (overrides: RuntimeOverrides) => string[];
};

const publicEnv = {
  APP_ENV: 'production',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://floriva.app/privacy',
  EXPO_PUBLIC_SUPPORT_URL: 'https://floriva.app/support',
  EXPO_PUBLIC_IOS_APP_STORE_ID: '6762630858',
  EXPO_PUBLIC_IOS_MONTHLY_PRODUCT_ID: 'floriva.plus.monthly',
  EXPO_PUBLIC_IOS_ANNUAL_PRODUCT_ID: 'floriva.plus.annual',
  EXPO_PUBLIC_IOS_LIFETIME_PRODUCT_ID: 'floriva.plus.lifetime',
  EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID: 'floriva.plus.monthly',
  EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID: 'floriva.plus.annual',
  EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID: 'floriva.plus.lifetime',
  FLORIVA_UPLOAD_STORE_PASSWORD: 'fixture-store-password',
  FLORIVA_UPLOAD_KEY_ALIAS: 'fixture-key',
  FLORIVA_UPLOAD_KEY_PASSWORD: 'fixture-key-password',
};

function writeExecutable(directory: string, name: string, source: string): void {
  const executablePath = path.join(directory, name);
  fs.writeFileSync(executablePath, `#!/usr/bin/env node\n${source}`);
  fs.chmodSync(executablePath, 0o755);
}

const appStoreReleaseNotes = `# App Store What's New — 1.4.0

## en

A calmer, clearer Floriva with a redesigned cycle calendar.

## es

Una Floriva más serena y clara, con un calendario de ciclo rediseñado.

## de

Ein ruhigeres Floriva mit einem neu gestalteten Zykluskalender.

## fr

Une Floriva plus sereine avec un calendrier de cycle repensé.

## ja

新しくデザインされた周期カレンダーで、より見やすくなりました。

## zh-Hans

重新设计了周期日历，Floriva 现在更加清晰易用。

## pt

Uma Floriva mais serena, com um calendário de ciclo redesenhado.

## ru

Floriva стала понятнее благодаря обновлённому календарю цикла.
`;

const googlePlayReleaseNotes = appStoreReleaseNotes.replace(
  "# App Store What's New",
  '# Google Play Release Notes',
);

function prepareFixture(
  versionCode: '21' | '22',
  releaseNotes: {
    appStore?: string;
    googlePlay?: string;
  } = {},
): {
  cwd: string;
  env: NodeJS.ProcessEnv;
} {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-release-preflight-test-'));
  const binDirectory = path.join(cwd, 'bin');
  const exportDirectory = path.join(cwd, 'build/release/AppStoreExport');
  const bundleDirectory = path.join(cwd, 'android/app/build/outputs/bundle/release');
  const releaseNotesDirectory = path.join(
    cwd,
    'docs/phase-4-launch-collateral/generated',
  );
  const storeFile = path.join(cwd, 'upload.keystore');

  fs.mkdirSync(binDirectory, { recursive: true });
  fs.mkdirSync(exportDirectory, { recursive: true });
  fs.mkdirSync(bundleDirectory, { recursive: true });
  fs.mkdirSync(releaseNotesDirectory, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ version: '1.4.0' }));
  fs.writeFileSync(
    path.join(releaseNotesDirectory, 'app-store-whats-new-1.4.0.md'),
    releaseNotes.appStore ?? appStoreReleaseNotes,
  );
  fs.writeFileSync(
    path.join(releaseNotesDirectory, 'google-play-release-notes-1.4.0.md'),
    releaseNotes.googlePlay ?? googlePlayReleaseNotes,
  );
  fs.writeFileSync(path.join(exportDirectory, 'DistributionSummary.plist'), 'fixture');
  fs.writeFileSync(path.join(exportDirectory, 'Floriva.ipa'), 'fixture');
  fs.writeFileSync(path.join(bundleDirectory, 'app-release.aab'), 'fixture');
  fs.writeFileSync(storeFile, 'fixture');

  writeExecutable(
    binDirectory,
    'keytool',
    "const fs = require('node:fs'); const index = process.argv.indexOf('-file'); if (index >= 0) fs.writeFileSync(process.argv[index + 1], 'csr');",
  );
  writeExecutable(
    binDirectory,
    'unzip',
    "process.stdout.write(JSON.stringify({CFBundleIdentifier:'app.floriva',CFBundleShortVersionString:'1.4.0',CFBundleVersion:'22',CFBundleExecutable:'Floriva'}));",
  );
  writeExecutable(
    binDirectory,
    'plutil',
    `const summary = {'Floriva.ipa':[{
      certificate:{type:'Apple Distribution'},
      profile:{name:'Fixture Profile',dateExpires:'2030-01-01'},
      team:{id:'TEAMID1234'},
      buildNumber:'22',
      versionNumber:'1.4.0',
      entitlements:{'application-identifier':'TEAMID1234.app.floriva','get-task-allow':false}
    }]};
    if (process.argv.at(-1) === '-') process.stdin.pipe(process.stdout);
    else if (process.env.FIXTURE_EMPTY_SUMMARY === '1') process.stdout.write('{}');
    else process.stdout.write(JSON.stringify(summary));`,
  );
  writeExecutable(
    binDirectory,
    'bundletool',
    `process.stdout.write('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="app.floriva" android:versionName="1.4.0" android:versionCode="' + process.env.FIXTURE_AAB_VERSION_CODE + '"></manifest>');`,
  );

  return {
    cwd,
    env: {
      ...process.env,
      ...publicEnv,
      PATH: `${binDirectory}:${process.env.PATH}`,
      FLORIVA_UPLOAD_STORE_FILE: storeFile,
      FIXTURE_AAB_VERSION_CODE: versionCode,
    },
  };
}

function runPreflight(versionCode: '21' | '22') {
  const fixture = prepareFixture(versionCode);

  try {
    return spawnSync(process.execPath, [preflightScript], {
      cwd: fixture.cwd,
      env: fixture.env,
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(fixture.cwd, { force: true, recursive: true });
  }
}

describe('release preflight CLI', () => {
  it('rejects an otherwise valid build-21 Android App Bundle', () => {
    const result = runPreflight('21');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Android App Bundle');
    expect(result.stderr).toContain('versionCode 22');
  });

  it('accepts matching build-22 iOS and Android release artifacts', () => {
    const result = runPreflight('22');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Floriva release preflight passed.');
    expect(result.stderr).toBe('');
  });
});

describe('release preflight decisions', () => {
  function createLogger(): Logger {
    return {
      error: jest.fn(),
      log: jest.fn(),
    };
  }

  it('uses the process runtime and console when invoked without overrides', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      expect(preflightModule.main()).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith('Floriva release preflight failed:');
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('returns success for matching build-22 fixtures', () => {
    const fixture = prepareFixture('22');
    const logger = createLogger();

    try {
      expect(preflightModule.main(fixture, logger)).toBe(0);
      expect(logger.log).toHaveBeenCalledWith('Floriva release preflight passed.');
      expect(logger.error).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('returns a build-22 AAB requirement for build-21 fixtures', () => {
    const fixture = prepareFixture('21');

    try {
      expect(preflightModule.runReleasePreflight(fixture)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'package app.floriva, versionName 1.4.0, and versionCode 22',
          ),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects App Store release notes that mention another platform', () => {
    const fixture = prepareFixture('22', {
      appStore: appStoreReleaseNotes.replace(
        'A calmer, clearer Floriva with a redesigned cycle calendar.',
        'A calmer Floriva on iPhone, with matching improvements on Google Play and Android.',
      ),
    });

    try {
      expect(preflightModule.runReleasePreflight(fixture)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'App Store release notes locale en mention forbidden platform term "Google Play"',
          ),
          expect.stringContaining(
            'App Store release notes locale en mention forbidden platform term "Android"',
          ),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects Google Play release notes that mention Apple platforms', () => {
    const fixture = prepareFixture('22', {
      googlePlay: googlePlayReleaseNotes.replace(
        'A calmer, clearer Floriva with a redesigned cycle calendar.',
        'A calmer Floriva, now matching the iPhone and App Store experience.',
      ),
    });

    try {
      expect(preflightModule.runReleasePreflight(fixture)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Google Play release notes locale en mention forbidden platform term "iPhone"',
          ),
          expect.stringContaining(
            'Google Play release notes locale en mention forbidden platform term "App Store"',
          ),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('normalizes and rejects separator-obscured platform names in localized notes', () => {
    const fixture = prepareFixture('22', {
      appStore: appStoreReleaseNotes.replace(
        'Una Floriva más serena y clara, con un calendario de ciclo rediseñado.',
        'Incluye las mismas mejoras de Google＿Play y Play-Store.',
      ),
    });

    try {
      expect(preflightModule.runReleasePreflight(fixture)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'App Store release notes locale es mention forbidden platform term "Google Play"',
          ),
          expect.stringContaining(
            'App Store release notes locale es mention forbidden platform term "Play Store"',
          ),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('requires a separate release-note handoff for each store', () => {
    const fixture = prepareFixture('22');
    fs.rmSync(
      path.join(
        fixture.cwd,
        'docs/phase-4-launch-collateral/generated/app-store-whats-new-1.4.0.md',
      ),
    );

    try {
      expect(preflightModule.runReleasePreflight(fixture)).toContainEqual(
        expect.stringContaining('Missing App Store release notes'),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects malformed, incomplete, duplicate, empty, oversized, and unexpected locale blocks', () => {
    const malformedReleaseNotes = `# Wrong heading

## en

${'x'.repeat(21)}

## en

duplicate

## es


## unexpected

copy
`;

    expect(
      preflightModule.validateReleaseNoteDocument(
        malformedReleaseNotes,
        {
          name: 'Fixture Store',
          heading: (version) => `# Fixture Store — ${version}`,
          maxCharacters: 20,
          forbiddenTerms: [],
        },
        '1.4.0',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('must start with "# Fixture Store — 1.4.0"'),
        expect.stringContaining('exactly one ## en block'),
        expect.stringContaining('locale es is empty'),
        expect.stringContaining('exactly one ## de block'),
        expect.stringContaining('unsupported locale block ## unexpected'),
      ]),
    );

    const oversizedReleaseNotes = appStoreReleaseNotes.replace(
      'A calmer, clearer Floriva with a redesigned cycle calendar.',
      'x'.repeat(21),
    );

    expect(
      preflightModule.validateReleaseNoteDocument(
        oversizedReleaseNotes,
        {
          name: 'Fixture Store',
          heading: () => "# App Store What's New — 1.4.0",
          maxCharacters: 20,
          forbiddenTerms: [],
        },
        '1.4.0',
      ),
    ).toContainEqual(expect.stringContaining('locale en exceeds 20 characters'));
  });

  it('rejects a package without a release version', () => {
    const fixture = prepareFixture('22');
    fs.writeFileSync(path.join(fixture.cwd, 'package.json'), '{}');

    try {
      expect(preflightModule.validateReleaseNoteFiles({ ...fixture, fs })).toContainEqual(
        expect.stringContaining('must declare a version'),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('reports an unreadable platform handoff', () => {
    const fixture = prepareFixture('22');
    const releaseNotesName = 'app-store-whats-new-1.4.0.md';
    const runtimeFs = new Proxy(fs, {
      get(target, property, receiver) {
        if (property !== 'readFileSync') {
          return Reflect.get(target, property, receiver);
        }

        return (filePath: fs.PathOrFileDescriptor, options?: unknown) => {
          if (String(filePath).endsWith(releaseNotesName)) {
            throw new Error('fixture read failure');
          }

          return fs.readFileSync(filePath, options as never);
        };
      },
    });

    try {
      expect(
        preflightModule.validateReleaseNoteFiles({ ...fixture, fs: runtimeFs }),
      ).toContainEqual(expect.stringContaining('Could not read App Store release notes'));
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('accepts relative signing and custom iOS summary paths', () => {
    const fixture = prepareFixture('22');

    try {
      expect(
        preflightModule.runReleasePreflight({
          ...fixture,
          env: {
            ...fixture.env,
            FLORIVA_UPLOAD_STORE_FILE: 'upload.keystore',
            FLORIVA_IOS_DISTRIBUTION_SUMMARY:
              'build/release/AppStoreExport/DistributionSummary.plist',
          },
        }),
      ).toEqual([]);
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects an iOS export whose distribution summary has no IPA entry', () => {
    const fixture = prepareFixture('22');

    try {
      const failures = preflightModule.runReleasePreflight({
        ...fixture,
        env: {
          ...fixture.env,
          FIXTURE_EMPTY_SUMMARY: '1',
        },
      });

      expect(failures).toEqual([
        expect.stringContaining('Missing validated App Store IPA export'),
      ]);
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('reports missing environment and artifacts through the CLI result', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-empty-preflight-test-'));
    const logger = createLogger();

    try {
      expect(
        preflightModule.main(
          {
            cwd,
            env: { NODE_ENV: 'test', PATH: process.env.PATH },
          },
          logger,
        ),
      ).toBe(1);
      expect(logger.error).toHaveBeenCalledWith('Floriva release preflight failed:');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing public release env keys'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing validated Android App Bundle'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing validated App Store IPA export'),
      );
    } finally {
      fs.rmSync(cwd, { force: true, recursive: true });
    }
  });

  it('turns unreadable signing and artifact metadata into validation failures', () => {
    const fixture = prepareFixture('22');

    try {
      const failures = preflightModule.runReleasePreflight({
        ...fixture,
        execFileSync: () => {
          throw new Error('fixture command failure');
        },
      });

      expect(failures).toEqual(
        expect.arrayContaining([
          expect.stringContaining('readable Android keystore'),
          expect.stringContaining('must unlock the configured Android upload key'),
          expect.stringContaining('Missing validated Android App Bundle'),
          expect.stringContaining('Missing validated App Store IPA export'),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects an existing store file when signing fields are missing', () => {
    const fixture = prepareFixture('22');
    const env = { ...fixture.env };
    delete env.FLORIVA_UPLOAD_STORE_PASSWORD;
    delete env.FLORIVA_UPLOAD_KEY_ALIAS;
    delete env.FLORIVA_UPLOAD_KEY_PASSWORD;

    try {
      const failures = preflightModule.runReleasePreflight({ ...fixture, env });

      expect(failures).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Missing Android signing env keys'),
          expect.stringContaining('readable Android keystore'),
          expect.stringContaining('must unlock the configured Android upload key'),
        ]),
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });

  it('rejects a configured store file path that does not exist', () => {
    const fixture = prepareFixture('22');
    const missingStoreFile = path.join(fixture.cwd, 'missing-upload.keystore');

    try {
      const failures = preflightModule.runReleasePreflight({
        ...fixture,
        env: {
          ...fixture.env,
          FLORIVA_UPLOAD_STORE_FILE: missingStoreFile,
        },
      });

      expect(failures).toContain(
        'FLORIVA_UPLOAD_STORE_FILE points to a file that does not exist.',
      );
    } finally {
      fs.rmSync(fixture.cwd, { force: true, recursive: true });
    }
  });
});
