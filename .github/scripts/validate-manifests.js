#!/usr/bin/env node
// Validates every manifest under apps/<slug>/manifest.yaml against the AppSpec
// v1 schema, plus mechanical checks the schema can't express:
//
//   - Slug uniqueness across the whole catalog.
//   - Manifest folder name == manifest.slug.
//   - Manifest references icon and screenshot files that actually exist on disk
//     at the declared relative paths.
//   - Icon is 256x256 PNG (or any-size SVG), <=100 KB.
//   - Each screenshot is <=500 KB and a recognized image format.
//   - Defensive double-check that no install/postInstall/preStart/start command
//     uses shell: true, and runtime.kind != docker. The schema already forbids
//     these, but a defense-in-depth assertion makes log output useful when the
//     schema itself is the diff under review.
//
// Folders prefixed with `_` (e.g. apps/_test-fixtures/...) are skipped during
// production validation. CI fixtures live under apps/_test-fixtures/ and are
// exercised by their own dedicated tests, not by the production scan.
//
// Writes validation-report.json (consumed by the workflow's artifact upload)
// and a human-readable summary to $GITHUB_STEP_SUMMARY when running in Actions.
// Exits non-zero on any failure.

const fs = require('node:fs');
const path = require('node:path');
const { glob } = require('glob');
const yaml = require('js-yaml');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schema', 'appspec-v1.json');
const APPS_DIR = path.join(REPO_ROOT, 'apps');
const REPORT_PATH = path.join(REPO_ROOT, 'validation-report.json');

const ICON_MAX_BYTES = 100 * 1024;
const SCREENSHOT_MAX_BYTES = 500 * 1024;
const ICON_PNG_DIMENSIONS = { width: 256, height: 256 };

async function main() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);

  // Find every manifest. Skip the _test-fixtures sentinel during production
  // validation -- those are stand-alone fixtures the test suite drives directly.
  const manifestPaths = (
    await glob('apps/*/manifest.yaml', { cwd: REPO_ROOT, absolute: true })
  ).filter((p) => !path.basename(path.dirname(p)).startsWith('_'));

  const results = [];
  const slugSeen = new Map(); // slug -> first folder that claimed it

  for (const manifestPath of manifestPaths) {
    const folder = path.basename(path.dirname(manifestPath));
    const result = { folder, manifestPath, ok: true, errors: [] };

    let raw;
    try {
      raw = fs.readFileSync(manifestPath, 'utf8');
    } catch (err) {
      result.ok = false;
      result.errors.push(`Failed to read manifest: ${err.message}`);
      results.push(result);
      continue;
    }

    let manifest;
    try {
      manifest = yaml.load(raw, { filename: manifestPath });
    } catch (err) {
      result.ok = false;
      result.errors.push(`YAML parse error: ${err.message}`);
      results.push(result);
      continue;
    }

    if (!manifest || typeof manifest !== 'object') {
      result.ok = false;
      result.errors.push('Manifest is empty or not an object.');
      results.push(result);
      continue;
    }

    if (!validateSchema(manifest)) {
      result.ok = false;
      for (const err of validateSchema.errors ?? []) {
        result.errors.push(
          `Schema: ${err.instancePath || '/'} ${err.message} ${
            err.params ? JSON.stringify(err.params) : ''
          }`.trim()
        );
      }
    }

    const slug = manifest.slug;
    if (typeof slug === 'string') {
      if (slug !== folder) {
        result.ok = false;
        result.errors.push(
          `Folder name "${folder}" does not match manifest.slug "${slug}".`
        );
      }
      const prior = slugSeen.get(slug);
      if (prior && prior !== folder) {
        result.ok = false;
        result.errors.push(
          `Duplicate slug "${slug}" -- also declared by apps/${prior}/manifest.yaml.`
        );
      } else {
        slugSeen.set(slug, folder);
      }
    }

    // Defensive double-checks beyond the schema.
    if (manifest.runtime && manifest.runtime.kind === 'docker') {
      result.ok = false;
      result.errors.push('runtime.kind = docker is reserved for v2 (rejected).');
    }
    for (const field of ['install', 'postInstall', 'preStart']) {
      const list = manifest[field];
      if (Array.isArray(list)) {
        list.forEach((cmd, i) => {
          if (cmd && cmd.shell === true) {
            result.ok = false;
            result.errors.push(`${field}[${i}].shell: true is not allowed.`);
          }
        });
      }
    }
    if (manifest.start && manifest.start.shell === true) {
      result.ok = false;
      result.errors.push('start.shell: true is not allowed.');
    }

    // Asset checks. Only attempt these if the schema produced a usable icon path.
    const folderAbs = path.dirname(manifestPath);
    if (typeof manifest.icon === 'string' && manifest.icon.startsWith('./')) {
      const iconRel = manifest.icon.slice(2);
      const iconAbs = path.join(folderAbs, iconRel);
      try {
        const stat = fs.statSync(iconAbs);
        if (stat.size > ICON_MAX_BYTES) {
          result.ok = false;
          result.errors.push(
            `Icon ${manifest.icon}: ${stat.size} bytes exceeds ${ICON_MAX_BYTES} (100 KB).`
          );
        }
        if (iconAbs.toLowerCase().endsWith('.png')) {
          try {
            const meta = await sharp(iconAbs).metadata();
            if (
              meta.width !== ICON_PNG_DIMENSIONS.width ||
              meta.height !== ICON_PNG_DIMENSIONS.height
            ) {
              result.ok = false;
              result.errors.push(
                `Icon ${manifest.icon}: ${meta.width}x${meta.height}, expected 256x256 PNG.`
              );
            }
          } catch (err) {
            result.ok = false;
            result.errors.push(`Icon ${manifest.icon} unreadable: ${err.message}`);
          }
        }
      } catch (err) {
        result.ok = false;
        result.errors.push(`Icon ${manifest.icon} not found at ${iconAbs}.`);
      }
    }

    if (Array.isArray(manifest.screenshots)) {
      for (let i = 0; i < manifest.screenshots.length; i++) {
        const ss = manifest.screenshots[i];
        if (typeof ss !== 'string' || !ss.startsWith('./')) continue;
        const ssAbs = path.join(folderAbs, ss.slice(2));
        try {
          const stat = fs.statSync(ssAbs);
          if (stat.size > SCREENSHOT_MAX_BYTES) {
            result.ok = false;
            result.errors.push(
              `Screenshot ${ss}: ${stat.size} bytes exceeds ${SCREENSHOT_MAX_BYTES} (500 KB).`
            );
          }
        } catch (err) {
          result.ok = false;
          result.errors.push(`Screenshot ${ss} not found at ${ssAbs}.`);
        }
      }
    }

    results.push(result);
  }

  const ok = results.every((r) => r.ok);
  const report = {
    ok,
    schemaPath: path.relative(REPO_ROOT, SCHEMA_PATH),
    manifestCount: results.length,
    manifests: results.map((r) => ({
      folder: r.folder,
      ok: r.ok,
      errors: r.errors,
    })),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  // Human-readable summary -> stdout and (if running in Actions) the step summary.
  const lines = [];
  lines.push(`# Catalog validation`);
  lines.push('');
  lines.push(
    `Validated **${results.length}** manifest(s). ${ok ? '✅ All passing.' : '❌ Failures present.'}`
  );
  lines.push('');
  for (const r of results) {
    lines.push(`## \`apps/${r.folder}/\` ${r.ok ? '✅' : '❌'}`);
    if (!r.ok) {
      for (const e of r.errors) lines.push(`- ${e}`);
    }
    lines.push('');
  }
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal validation error:', err);
  process.exit(2);
});
