#!/usr/bin/env node
// Generates the placeholder icons used by the test fixtures. Idempotent --
// safe to run repeatedly. Run via:
//
//   node .github/scripts/make-fixture-icons.js
//
// We commit the resulting PNGs (so CI doesn't have to regenerate them) but
// keep this script in the repo as the source of truth: if a fixture icon
// gets corrupted, you can rebuild from here.

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'apps', '_test-fixtures');

async function makeValidIcon(targetPath) {
  // 256x256, single-colour PNG. Tiny on disk (~few hundred bytes).
  await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 36, g: 184, b: 200, alpha: 1 }, // cyan-ish
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(targetPath);
}

async function makeOversizedIcon(targetPath) {
  // 256x256 PNG that exceeds 100 KB. We force size by embedding random
  // pixel noise -- random data is incompressible.
  const bytes = Buffer.alloc(256 * 256 * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  await sharp(bytes, { raw: { width: 256, height: 256, channels: 4 } })
    .png({ compressionLevel: 0 })
    .toFile(targetPath);
}

async function main() {
  // Fixtures that need a normal valid icon.
  const validIconFolders = [
    'valid-vite',
    'bad-docker',
    'bad-shell',
    'bad-branch-ref',
    'bad-slug-mismatch',
    'valid-docker-v2',
    'bad-docker-v2-no-image',
  ];
  for (const folder of validIconFolders) {
    const target = path.join(FIXTURES_DIR, folder, 'icon.png');
    await makeValidIcon(target);
    const stat = fs.statSync(target);
    console.log(`valid icon: ${folder}/icon.png  (${stat.size} bytes)`);
  }

  // The bad-image-too-big fixture needs an oversized icon.
  const oversized = path.join(FIXTURES_DIR, 'bad-image-too-big', 'icon.png');
  await makeOversizedIcon(oversized);
  const stat = fs.statSync(oversized);
  console.log(`oversized icon: bad-image-too-big/icon.png  (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
