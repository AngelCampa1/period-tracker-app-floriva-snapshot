/**
 * One-off maintenance tool: reconstruct the missing Drizzle meta snapshots.
 *
 * Background: `drizzle/meta/` only ever had 0000/0001 snapshots committed;
 * 0002–0016 were never generated and 0017 was missing entirely. Runtime is
 * unaffected (it reads the SQL files + `_journal.json` via `migrations.js`,
 * never the snapshots), but `drizzle-kit generate` diffs against the stale
 * 0001 snapshot and emits a corrupted catch-up migration. This backfills the
 * gap so `drizzle-kit generate` / `check` work again.
 *
 * Method: for each migration idx 2..17 recover the historical `src/db/schema.ts`
 * from the commit that introduced that migration's SQL, run `drizzle-kit
 * generate` against it in an isolated temp dir to obtain a canonical v6
 * snapshot of the cumulative schema at that step, then re-chain the `prevId`
 * links into a single linear history rooted at the existing committed 0001
 * snapshot. HEAD (0017) is generated from the *current* schema so it is
 * byte-exact against `schema.ts` (the property `generate` relies on).
 *
 * Guardrails: only writes `drizzle/meta/000N_snapshot.json` files. Never
 * touches the SQL files or `_journal.json` (those govern what installed apps
 * apply). schema.ts is self-contained (imports only drizzle-orm), so historical
 * versions compile standalone without a worktree checkout.
 *
 * Usage: `node scripts/reconstruct-drizzle-snapshots.mjs`
 * Reusable for the next time snapshots drift (e.g. a future asset/schema swap).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_DIR, '..');
const META_DIR = path.join(APP_DIR, 'drizzle', 'meta');
const SCHEMA_REL = 'floriva-app/src/db/schema.ts';

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Oldest commit on the current history that touched a migration's SQL file. */
function schemaCommitForTag(tag) {
  const rel = `floriva-app/drizzle/${tag}.sql`;
  const out = git(['log', '--format=%H', '--', rel]).trim().split('\n').filter(Boolean);
  const commit = out[out.length - 1];
  if (!commit) throw new Error(`No commit found introducing ${rel}`);
  return commit;
}

/** Run drizzle-kit generate for a schema source string; return the raw snapshot text. */
function snapshotForSchemaSource(source, label) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `drz-${label}-`));
  // Both the config AND the schema file must live inside APP_DIR so
  // `drizzle-kit` (and the schema's own `import 'drizzle-orm'`) resolve from
  // the repo's node_modules. `out` may be anywhere.
  const schemaFile = path.join(APP_DIR, `.reconstruct-schema.${label}.tmp.ts`);
  const cfgFile = path.join(APP_DIR, `.drizzle.config.reconstruct.mjs`);
  fs.writeFileSync(schemaFile, source);
  fs.writeFileSync(
    cfgFile,
    `import { defineConfig } from 'drizzle-kit';\n` +
      `export default defineConfig({ schema: ${JSON.stringify(schemaFile)}, out: ${JSON.stringify(outDir)}, dialect: 'sqlite', driver: 'expo' });\n`,
  );
  try {
    execFileSync('npx', ['drizzle-kit', 'generate', `--config=${cfgFile}`], {
      cwd: APP_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const snapPath = path.join(outDir, 'meta', '0000_snapshot.json');
    return fs.readFileSync(snapPath, 'utf8');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(cfgFile, { force: true });
    fs.rmSync(schemaFile, { force: true });
  }
}

/** Replace the prevId value in a raw drizzle snapshot, preserving byte formatting. */
function withPrevId(rawSnapshot, prevId) {
  const replaced = rawSnapshot.replace(
    /("prevId":\s*")[0-9a-fA-F-]{36}(")/,
    `$1${prevId}$2`,
  );
  if (replaced === rawSnapshot) throw new Error('Failed to rewrite prevId');
  return replaced;
}

const journal = JSON.parse(fs.readFileSync(path.join(META_DIR, '_journal.json'), 'utf8'));
const kept0001 = JSON.parse(fs.readFileSync(path.join(META_DIR, '0001_snapshot.json'), 'utf8'));
const currentSchema = fs.readFileSync(path.join(APP_DIR, 'src/db/schema.ts'), 'utf8');

let prevId = kept0001.id;
const summary = [];
for (let idx = 2; idx <= 17; idx++) {
  const entry = journal.entries.find((e) => e.idx === idx);
  const tag = entry.tag;
  let raw;
  if (idx === 17) {
    raw = snapshotForSchemaSource(currentSchema, 'head');
  } else {
    const commit = schemaCommitForTag(tag);
    const src = git(['show', `${commit}:${SCHEMA_REL}`]);
    raw = snapshotForSchemaSource(src, `i${idx}`);
  }
  raw = withPrevId(raw, prevId);
  const outFile = path.join(META_DIR, `${String(idx).padStart(4, '0')}_snapshot.json`);
  fs.writeFileSync(outFile, raw);
  const parsed = JSON.parse(raw);
  summary.push({ idx, tag, id: parsed.id, prevId: parsed.prevId, tables: Object.keys(parsed.tables).length });
  prevId = parsed.id;
}

console.log('Reconstructed snapshots:');
for (const s of summary) {
  console.log(`  ${String(s.idx).padStart(2, '0')} ${s.tag.padEnd(38)} tables=${s.tables} id=${s.id.slice(0, 8)} prev=${s.prevId.slice(0, 8)}`);
}
console.log('\nDone. Verify with: pnpm db:generate  (expect "No schema changes") and: npx drizzle-kit check');
