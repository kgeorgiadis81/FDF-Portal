'use strict';

/**
 * Write version.json into the production browser bundle.
 * The deploy smoke check requires this commit and one hashed JavaScript file.
 * The file contains only the app name, the commit SHA, and that filename.
 *
 * Env:
 *   RELEASE_COMMIT or GITHUB_SHA — 40-char lowercase hex commit (required)
 *   RELEASE_DIST — bundle directory (default dist/fdf-portal/browser)
 */

const fs = require('fs');
const path = require('path');

const dist = process.env.RELEASE_DIST
  ? path.resolve(process.env.RELEASE_DIST)
  : path.join(__dirname, '..', 'dist', 'fdf-portal', 'browser');

const commit = String(process.env.RELEASE_COMMIT || process.env.GITHUB_SHA || '').trim();
if (!/^[0-9a-f]{40}$/.test(commit)) {
  console.error('RELEASE_COMMIT or GITHUB_SHA must be a 40-character lowercase hex commit.');
  process.exit(1);
}

const indexPath = path.join(dist, 'index.html');
let index;
try {
  index = fs.readFileSync(indexPath, 'utf8');
} catch {
  console.error(`Cannot read ${indexPath}. Run the production build first.`);
  process.exit(1);
}

const srcs = [];
const re = /\bsrc="([^"]+\.js)"/g;
let match;
while ((match = re.exec(index)) !== null) {
  srcs.push(match[1]);
}

function isSafeHashedAsset(src) {
  return /^[A-Za-z0-9._-]+$/.test(src) && src.includes('-') && src.endsWith('.js');
}

const safe = srcs.filter(isSafeHashedAsset);
const asset = safe.find((src) => src.startsWith('main-')) || safe[0];
if (!asset) {
  console.error('Production index.html has no hashed JavaScript bundle to use as a smoke asset.');
  process.exit(1);
}

const body = `${JSON.stringify({ app: 'fdf-portal', commit, asset })}\n`;
fs.writeFileSync(path.join(dist, 'version.json'), body, { mode: 0o644 });
console.log(`Wrote version.json for ${commit} (${asset}).`);
