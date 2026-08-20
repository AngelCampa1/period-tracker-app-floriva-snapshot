#!/usr/bin/env node
/**
 * Assemble the public portfolio snapshot.
 *
 *   node scripts/portfolio/build-snapshot.js --out <dir> [--dry-run] [--commit]
 *
 * Copy source is `git archive HEAD`, so only tracked files can ever be emitted.
 * See scripts/portfolio/sanitize.js for the three-layer control design.
 *
 * Exits non-zero if the content scan finds anything, so this is safe to wire
 * into a pre-publish check.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  applyRewrites,
  buildRewriteTable,
  buildSecretScanRules,
  isBinaryBuffer,
  isProbablyBinaryPath,
  missingRewriteSources,
  scanContent,
  shouldInclude,
  SCAN_RULES,
} = require('./sanitize.js');

const appRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.dirname(appRoot);

function parseArgs(argv) {
  const args = { out: null, dryRun: false, commit: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') { args.out = argv[i + 1]; i += 1; }
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--commit') args.commit = true;
  }
  return args;
}

/**
 * List files beneath `dir`.
 *
 * Symlinks are collected rather than followed. `readdirSync(withFileTypes)`
 * reports a symlink-to-file as "not a directory", so the previous version fell
 * through to `readFileSync`, which dereferences — a link under the overlay
 * pointing outside the repo had its target's contents copied into the snapshot.
 * The caller rejects them; they are returned so the rejection is explicit
 * rather than a silent omission.
 */
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) out.push(path.relative(base, full));
    else if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

function isSymlink(fullPath) {
  return fs.lstatSync(fullPath).isSymbolicLink();
}

function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    console.error('usage: build-snapshot.js --out <dir> [--dry-run] [--commit]');
    process.exit(2);
  }
  // `--out --dry-run` would otherwise resolve outRoot to "--dry-run" with
  // dryRun still false, and the rmSync below would delete it.
  if (args.out.startsWith('--')) {
    console.error(`--out expects a directory, got the flag ${args.out}`);
    process.exit(2);
  }
  const outRoot = path.resolve(args.out);
  if (repoRoot === outRoot || repoRoot.startsWith(`${outRoot}${path.sep}`)) {
    console.error(`--out ${outRoot} contains the repository; refusing to delete it`);
    process.exit(2);
  }

  // ---- 1. git archive: only tracked files can enter the pipeline ----------
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-snapshot-'));
  // `sh -c` reports only the LAST command's status, and macOS tar exits 0 on
  // empty stdin — so without pipefail a failed `git archive` produced an empty
  // staging tree, zero findings, and a confident "content scan clean".
  execFileSync(
    'sh',
    ['-c', `set -o pipefail; git archive HEAD floriva-app | tar -x -C '${staging}'`],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const stagedApp = path.join(staging, 'floriva-app');
  const staged = walk(stagedApp);
  if (staged.length === 0) {
    console.error('git archive produced no files — refusing to emit an empty snapshot');
    fs.rmSync(staging, { recursive: true, force: true });
    process.exit(1);
  }

  // ---- 2 & 3. allowlist + denylist ---------------------------------------
  const included = staged.filter(shouldInclude);
  const excluded = staged.length - included.length;

  // ---- 4. rewrites --------------------------------------------------------
  // Derived from the ARCHIVED tree, not the working tree. Those differ whenever
  // anything is uncommitted, and a table built from bytes other than the ones
  // being copied rewrites values that are not there while missing the ones that
  // are.
  const missingSources = missingRewriteSources(stagedApp);
  if (missingSources.length > 0) {
    console.error('cannot derive the rewrite table; these sources are missing from HEAD:');
    for (const rel of missingSources) console.error(`  ${rel}`);
    fs.rmSync(staging, { recursive: true, force: true });
    process.exit(1);
  }
  const rewriteTable = buildRewriteTable(stagedApp);
  const scanRules = [...SCAN_RULES, ...buildSecretScanRules(rewriteTable)];
  let rewrittenFiles = 0;

  if (!args.dryRun) {
    fs.rmSync(outRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(outRoot, 'floriva-app'), { recursive: true });
  }

  const findings = [];
  const images = [];
  let bytes = 0;

  /**
   * Read, rewrite, scan and write one file.
   *
   * One function for both the app copy and the overlay, deliberately. They used
   * to be two near-identical blocks, and they had silently drifted: the overlay
   * skipped `shouldInclude`, skipped the rewrite counter, and read from the
   * working tree instead of the archive. Two of the three controls did not
   * apply to 5% of the emitted files.
   */
  function emit({ srcRoot, relPath, destRoot }) {
    const src = path.join(srcRoot, relPath);

    if (isSymlink(src)) {
      findings.push({
        id: 'G-19',
        description: 'symlink in the copy set (its target would be dereferenced)',
        relPath,
        evidence: 'sym***',
      });
      return;
    }

    // Read the bytes first, then decide. An extension list alone shipped eight
    // plain-text .strings files with no rewrite and no scan.
    const buffer = fs.readFileSync(src);
    const binary = isProbablyBinaryPath(relPath) || isBinaryBuffer(buffer);

    let text = '';
    if (binary) {
      images.push({ relPath, bytes: buffer.length });
    } else {
      const original = buffer.toString('utf8');
      text = applyRewrites(original, rewriteTable);
      if (text !== original) rewrittenFiles += 1;
    }

    findings.push(...scanContent({ relPath, text, rules: scanRules, binary }));
    bytes += binary ? buffer.length : Buffer.byteLength(text);

    if (!args.dryRun) {
      const dest = path.join(destRoot, relPath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, binary ? buffer : text);
    }
  }

  for (const relPath of included) {
    emit({ srcRoot: stagedApp, relPath, destRoot: path.join(outRoot, 'floriva-app') });
  }

  // ---- 4b. public overlay -------------------------------------------------
  // README, LICENSE, the curated docs and the curated screenshots live at the
  // snapshot ROOT, above floriva-app/. They are authored in the private repo
  // under docs/portfolio/public/, which is denylisted from the app copy above
  // so nothing is emitted twice.
  //
  // The overlay cannot come from `git archive`, because it is edited right up
  // to the build. So the tracked-only guarantee is restored explicitly: every
  // overlay file must be tracked, or the build fails. Otherwise a stray
  // untracked file in that directory ships, having passed no allowlist at all.
  const overlayRoot = path.join(appRoot, 'docs/portfolio/public');
  let overlayFiles = 0;

  if (fs.existsSync(overlayRoot)) {
    const trackedOverlay = new Set(
      execFileSync('git', ['ls-files', '-z', '--', 'docs/portfolio/public'], {
        cwd: appRoot,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean)
        .map((rel) => path.relative('docs/portfolio/public', rel)),
    );

    for (const relPath of walk(overlayRoot)) {
      if (!trackedOverlay.has(relPath)) {
        findings.push({
          id: 'G-20',
          description: 'untracked file in the public overlay',
          relPath,
          evidence: 'unt***',
        });
        continue;
      }
      emit({ srcRoot: overlayRoot, relPath, destRoot: outRoot });
      overlayFiles += 1;
    }
  }

  // ---- 5. report ----------------------------------------------------------
  console.log(`staged (tracked)   ${staged.length}`);
  console.log(`excluded           ${excluded}`);
  console.log(`included           ${included.length}`);
  console.log(`overlay (root)     ${overlayFiles}`);
  console.log(`rewritten          ${rewrittenFiles}`);
  console.log(`binary assets      ${images.length}`);
  console.log(`payload            ${humanBytes(bytes)}`);
  console.log(`rewrite rules      ${rewriteTable.length}`);

  if (findings.length === 0 && !args.dryRun) {
    // Manifest of every binary that survived, for the human/agent review gate.
    // Text scanning is structurally blind to PII rendered into pixels.
    //
    // Written only after the scan passes. Previously it was written first, so a
    // failed run left behind a full output tree and a manifest that looked
    // exactly like a successful one.
    fs.mkdirSync(path.join(outRoot, '.snapshot'), { recursive: true });
    fs.writeFileSync(
      path.join(outRoot, '.snapshot', 'image-manifest.json'),
      `${JSON.stringify({ generatedFrom: 'git archive HEAD', count: images.length, images }, null, 2)}\n`,
    );
  }

  if (findings.length > 0) {
    console.error(`\nCONTENT SCAN FAILED — ${findings.length} finding(s):`);
    const byRule = new Map();
    for (const f of findings) {
      if (!byRule.has(f.id)) byRule.set(f.id, []);
      byRule.get(f.id).push(f);
    }
    for (const [id, group] of byRule) {
      console.error(`\n  ${id} — ${group[0].description} (${group.length})`);
      for (const f of group.slice(0, 15)) {
        console.error(`    ${f.relPath}  ${f.evidence}`);
      }
      if (group.length > 15) console.error(`    … ${group.length - 15} more`);
    }
    fs.rmSync(staging, { recursive: true, force: true });
    // Remove the partial output too. An operator who reruns, sees the failure,
    // fixes something unrelated and then publishes the directory that is still
    // sitting there would ship exactly the leak this gate just caught.
    if (!args.dryRun) {
      fs.rmSync(outRoot, { recursive: true, force: true });
      console.error(`\nremoved the failed output tree at ${outRoot}`);
    }
    process.exit(1);
  }

  console.log('\ncontent scan       clean');
  fs.rmSync(staging, { recursive: true, force: true });

  if (args.commit && !args.dryRun) {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: outRoot });
    execFileSync('git', ['add', '.'], { cwd: outRoot });
    execFileSync(
      'git',
      ['commit', '-q', '-m', 'Floriva — privacy-first on-device period tracker (portfolio snapshot)'],
      { cwd: outRoot },
    );
    console.log(`committed          ${outRoot} (no remote configured)`);
  }
}

if (require.main === module) main();

module.exports = { parseArgs, humanBytes };
