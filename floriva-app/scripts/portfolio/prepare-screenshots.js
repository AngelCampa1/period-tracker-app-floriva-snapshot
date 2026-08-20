#!/usr/bin/env node
/**
 * Curate and downscale sweep captures for the public snapshot.
 *
 *   node scripts/portfolio/prepare-screenshots.js \
 *     --captures docs/portfolio/captures/1.4.0 \
 *     --out docs/portfolio/public/screenshots
 *
 * The sweep produces ~90 native-resolution PNGs per platform across 11 seed
 * presets. That is the right amount of evidence to keep privately and far too
 * much to publish, so this selects a readable subset and downscales it with
 * `sips` (macOS built-in — no image dependency is added to the project).
 *
 * The CURATION list is explicit rather than glob-driven: every published image
 * is a deliberate choice, and anything not named here does not ship.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// [preset, capture name, published name]
const CURATION = [
  // --- onboarding (iOS only: the Android walk needs pixel taps) -------------
  ['fresh-install', 'onb-01-welcome', '01-welcome'],
  ['fresh-install', 'onb-02-start-path', '02-start-path'],
  ['fresh-install', 'onb-03-last-period-start', '03-last-period-start'],
  ['fresh-install', 'onb-04-cycle-length', '04-cycle-length'],
  ['fresh-install', 'onb-06-symptom-logging', '05-symptom-logging'],
  ['fresh-install', 'onb-08-notifications', '06-notifications'],
  ['fresh-install', 'onb-09-completion', '07-completion'],
  ['fresh-install', 'today-empty', '08-today-empty'],

  // --- core surfaces --------------------------------------------------------
  ['qa-rich-history', 'today', '10-today'],
  ['qa-rich-history', 'calendar', '11-calendar'],
  ['qa-rich-history', 'insights', '12-insights'],
  ['qa-rich-history', 'settings', '13-settings'],

  // --- calendar depth -------------------------------------------------------
  ['seeded-tracker', 'calendar-day-today', '20-day-detail'],
  ['qa-rich-history', 'calendar-history', '21-cycle-history'],
  ['qa-rich-history', 'timeline', '22-timeline'],
  ['qa-rich-history', 'calendar-about-estimates', '23-about-estimates'],

  // --- insights depth -------------------------------------------------------
  ['qa-rich-history', 'insights-cycle-pattern', '30-cycle-pattern'],
  ['qa-rich-history', 'insights-monthly-briefing', '31-monthly-briefing'],
  ['qa-rich-history', 'insights-ttc', '32-ttc-insights'],
  ['tenure-12mo-regular', 'insights-cycle-pattern', '33-cycle-pattern-12mo-regular'],
  ['tenure-12mo-irregular', 'insights-cycle-pattern', '34-cycle-pattern-12mo-irregular'],

  // --- import ---------------------------------------------------------------
  ['import-ready', 'import', '40-import-review'],
  ['import-ready', 'import-source-clue', '41-import-clue'],
  ['import-ready', 'import-source-flo', '42-import-flo'],

  // --- backup ---------------------------------------------------------------
  ['backup-ready', 'backup-export', '50-backup-export'],
  ['backup-ready', 'backup-restore', '51-backup-restore'],

  // --- privacy --------------------------------------------------------------
  ['seeded-tracker', 'privacy-explainer', '60-privacy-explainer'],
  ['seeded-tracker', 'settings-privacy-lock', '61-privacy-lock'],
  ['locked-app', 'lock', '62-lock-screen'],
  ['seeded-tracker', 'settings-data', '63-data-controls'],
  ['seeded-tracker', 'settings-delete-data', '64-delete-data'],

  // --- settings depth -------------------------------------------------------
  ['seeded-tracker', 'settings-reminders', '70-reminders'],
  ['seeded-tracker', 'settings-birth-control', '71-birth-control'],
  ['seeded-tracker', 'settings-cycle-setup', '72-cycle-setup'],
  ['seeded-tracker', 'settings-language', '73-language'],
  ['seeded-tracker', 'settings-ttc-setup', '74-ttc-setup'],

  // --- retired billing surfaces, published as historical --------------------
  ['billing-fallback', 'paywall', '80-paywall-retired'],
];

// Larger, for the README strip.
const HERO = [
  ['qa-rich-history', 'today', 'today'],
  ['qa-rich-history', 'calendar', 'calendar'],
  ['qa-rich-history', 'insights', 'insights'],
];

const GALLERY_WIDTH = 640;
const HERO_WIDTH = 900;

function parseArgs(argv) {
  const args = { captures: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--captures') { args.captures = argv[i + 1]; i += 1; }
    else if (argv[i] === '--out') { args.out = argv[i + 1]; i += 1; }
  }
  return args;
}

function resize(src, dest, width) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('sips', ['--resampleWidth', String(width), src, '--out', dest], {
    stdio: 'pipe',
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.captures || !args.out) {
    console.error('usage: prepare-screenshots.js --captures <dir> --out <dir>');
    process.exit(2);
  }

  const capturesRoot = path.resolve(args.captures);
  const outRoot = path.resolve(args.out);
  fs.rmSync(outRoot, { recursive: true, force: true });

  const report = { hero: 0, ios: 0, android: 0, missing: [] };

  for (const [preset, name, published] of HERO) {
    const src = path.join(capturesRoot, preset, 'ios', `${name}.png`);
    if (!fs.existsSync(src)) { report.missing.push(`hero ios ${preset}/${name}`); continue; }
    resize(src, path.join(outRoot, 'hero', `${published}.png`), HERO_WIDTH);
    report.hero += 1;
  }

  for (const platform of ['ios', 'android']) {
    for (const [preset, name, published] of CURATION) {
      const src = path.join(capturesRoot, preset, platform, `${name}.png`);
      if (!fs.existsSync(src)) {
        // Onboarding is iOS-only by design; note anything else.
        if (!(platform === 'android' && preset === 'fresh-install')) {
          report.missing.push(`${platform} ${preset}/${name}`);
        }
        continue;
      }
      resize(src, path.join(outRoot, platform, `${published}.png`), GALLERY_WIDTH);
      report[platform] += 1;
    }
  }

  const bytes = fs
    .readdirSync(outRoot, { recursive: true })
    .map((rel) => path.join(outRoot, rel))
    .filter((full) => fs.statSync(full).isFile())
    .reduce((sum, full) => sum + fs.statSync(full).size, 0);

  console.log(`hero    ${report.hero}`);
  console.log(`ios     ${report.ios}`);
  console.log(`android ${report.android}`);
  console.log(`size    ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (report.missing.length > 0) {
    console.log(`\nmissing (${report.missing.length}) — not published, not silently skipped:`);
    for (const entry of report.missing) console.log(`  ${entry}`);
  }
}

if (require.main === module) main();

module.exports = { CURATION, HERO, parseArgs };
