#!/usr/bin/env node
// PR 2.4 placeholder icons. The catalog seed lands without final branding;
// this script generates a 256x256 single-color PNG per app so validate-
// manifests.js's icon checks pass. Real branded icons come in a follow-up
// PR after the upstream owners approve their use.
//
// Run via:
//   node .github/scripts/make-pr-2.4-icons.js

const path = require('node:path');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APPS_DIR = path.join(REPO_ROOT, 'apps');

const SEEDS = [
  { slug: 'streamlit-hello', rgb: [255, 75,  75]  }, // streamlit red
  { slug: 'gradio-hello',    rgb: [255, 122, 56]  }, // gradio orange
  { slug: 'comfyui',         rgb: [69,  103, 196] }, // comfyui blue
  { slug: 'openwebui',       rgb: [102, 70,  168] }, // open-webui purple
  { slug: 'hello-static',    rgb: [108, 117, 125] }, // neutral gray
];

async function makeIcon(target, [r, g, b]) {
  await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r, g, b, alpha: 1 },
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(target);
}

async function main() {
  const fs = require('node:fs');
  for (const { slug, rgb } of SEEDS) {
    const dir = path.join(APPS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'icon.png');
    await makeIcon(target, rgb);
    console.log(`icon: apps/${slug}/icon.png`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
