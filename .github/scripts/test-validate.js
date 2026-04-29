#!/usr/bin/env node
// Drives validate-manifests.js against each test fixture in isolation and
// asserts the expected pass/fail result + that error messages mention the
// expected substring. Run via:
//
//   node .github/scripts/test-validate.js
//
// Why a custom harness instead of jest/vitest: validate-manifests.js scans
// the entire `apps/` tree on each run, and we want to verify each fixture's
// behaviour individually. The cheapest way is to copy one fixture at a time
// into a sandbox `apps/` dir, point the validator at it via TMPDIR, and
// assert. Avoiding a test framework keeps PR 0.2 dependency-light.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'apps', '_test-fixtures');
const VALIDATOR = path.join(REPO_ROOT, '.github', 'scripts', 'validate-manifests.js');
const SCHEMA_DIR = path.join(REPO_ROOT, 'schema');

const cases = [
  {
    fixture: 'valid-vite',
    expectOk: true,
    expectErrorIncludes: [],
  },
  {
    fixture: 'bad-docker',
    expectOk: false,
    expectErrorIncludes: ['runtime'],
  },
  {
    fixture: 'bad-shell',
    expectOk: false,
    expectErrorIncludes: ['shell'],
  },
  {
    fixture: 'bad-branch-ref',
    expectOk: false,
    expectErrorIncludes: ['ref'],
  },
  {
    fixture: 'bad-slug-mismatch',
    expectOk: false,
    expectErrorIncludes: ['Folder name'],
  },
  {
    fixture: 'bad-image-too-big',
    expectOk: false,
    expectErrorIncludes: ['exceeds'],
  },
];

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function runOneCase(c) {
  // Build a sandbox repo with just one fixture under apps/<slug>/, sharing
  // the real schema/ via a copy.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'os8-catalog-test-'));
  try {
    fs.mkdirSync(path.join(sandbox, 'schema'), { recursive: true });
    fs.copyFileSync(
      path.join(SCHEMA_DIR, 'appspec-v1.json'),
      path.join(sandbox, 'schema', 'appspec-v1.json')
    );
    fs.mkdirSync(path.join(sandbox, '.github', 'scripts'), { recursive: true });
    fs.copyFileSync(VALIDATOR, path.join(sandbox, '.github', 'scripts', 'validate-manifests.js'));

    fs.mkdirSync(path.join(sandbox, 'apps'), { recursive: true });
    // Strip the leading underscore so the validator picks up this folder
    // (it skips folders prefixed with `_` during production validation).
    const fixtureSrc = path.join(FIXTURES_DIR, c.fixture);
    const fixtureDst = path.join(sandbox, 'apps', c.fixture);
    copyDirSync(fixtureSrc, fixtureDst);

    const result = spawnSync(
      process.execPath,
      [path.join(sandbox, '.github', 'scripts', 'validate-manifests.js')],
      {
        cwd: sandbox,
        encoding: 'utf8',
        env: { ...process.env, NODE_PATH: path.join(REPO_ROOT, 'node_modules') },
      }
    );

    const ok = result.status === 0;
    const okMatches = ok === c.expectOk;
    const errorsBlob = (result.stdout ?? '') + (result.stderr ?? '');
    const missing = c.expectErrorIncludes.filter((s) => !errorsBlob.includes(s));

    if (!okMatches || missing.length > 0) {
      console.log(`FAIL  ${c.fixture}`);
      console.log(`  expected ok=${c.expectOk}, got ok=${ok} (exit ${result.status})`);
      if (missing.length > 0) {
        console.log(`  expected error to include: ${JSON.stringify(missing)}`);
      }
      console.log('  --- stdout ---');
      console.log(result.stdout?.split('\n').map((l) => `  ${l}`).join('\n'));
      if (result.stderr) {
        console.log('  --- stderr ---');
        console.log(result.stderr.split('\n').map((l) => `  ${l}`).join('\n'));
      }
      return false;
    }
    console.log(`PASS  ${c.fixture}  (ok=${ok})`);
    return true;
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

let allPass = true;
for (const c of cases) {
  if (!runOneCase(c)) allPass = false;
}
console.log('');
console.log(allPass ? 'ALL FIXTURE CASES PASSED' : 'FIXTURE CASES FAILED');
process.exit(allPass ? 0 : 1);
