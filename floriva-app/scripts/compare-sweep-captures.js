#!/usr/bin/env node
// Pixel-compares two sweep capture trees (same <preset>/<platform>/<surface>.png
// layout) and reports per-file diff ratios. Used as the Phase 0 zero-visual-diff
// gate for the UI lift: baseline vs worktree re-capture.
//
// Usage: node scripts/compare-sweep-captures.js <dirA> <dirB> [--threshold 0.02]
//
// A pixel counts as different when any channel differs by more than FUZZ (out
// of 255) — absorbs simulator antialiasing jitter. A file passes when the
// fraction of differing pixels is <= threshold. Missing counterparts are
// reported separately, never silently skipped.

const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const FUZZ = 8;

const [dirA, dirB] = process.argv.slice(2, 4);
const thresholdArgIndex = process.argv.indexOf('--threshold');
const threshold =
  thresholdArgIndex === -1 ? 0.02 : Number.parseFloat(process.argv[thresholdArgIndex + 1]);

if (!dirA || !dirB) {
  console.error('Usage: node scripts/compare-sweep-captures.js <dirA> <dirB> [--threshold 0.02]');
  process.exit(2);
}

function listPngs(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.png')) {
        out.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  return out.sort();
}

function diffRatio(fileA, fileB) {
  const a = PNG.sync.read(readFileSync(fileA));
  const b = PNG.sync.read(readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, note: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > FUZZ ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > FUZZ ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > FUZZ
    ) {
      diff += 1;
    }
  }
  return { ratio: diff / total };
}

const pngsA = listPngs(dirA);
const pngsB = new Set(listPngs(dirB));

const failures = [];
const missing = [];
let passed = 0;

for (const rel of pngsA) {
  if (!pngsB.has(rel)) {
    missing.push(`only in A: ${rel}`);
    continue;
  }
  pngsB.delete(rel);
  const { ratio, note } = diffRatio(path.join(dirA, rel), path.join(dirB, rel));
  if (ratio > threshold) {
    failures.push(`${rel}: ${(ratio * 100).toFixed(2)}% differs${note ? ` (${note})` : ''}`);
  } else {
    passed += 1;
  }
}
for (const rel of pngsB) {
  missing.push(`only in B: ${rel}`);
}

console.log(`Compared vs threshold ${(threshold * 100).toFixed(1)}%: ${passed} pass, ${failures.length} fail, ${missing.length} unmatched`);
for (const line of failures) console.log(`DIFF  ${line}`);
for (const line of missing) console.log(`MISS  ${line}`);
process.exit(failures.length ? 1 : 0);
