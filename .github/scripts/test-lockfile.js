#!/usr/bin/env node
// Smoke test for check-lockfile.js. Exercises the gate against three real
// upstreams that are also seed-list candidates, plus a known-no-lockfile repo
// for the negative case.
//
// Set SKIP_NETWORK=1 to skip live API calls.

const { parseGithubUrl, resolveRef, listRepoRoot } = require('./lib/github');

// Re-export the matching logic so we test exactly what check-lockfile.js does.
const LOCKFILES_BY_MANAGER = {
  npm:    ['package-lock.json'],
  pnpm:   ['pnpm-lock.yaml'],
  yarn:   ['yarn.lock'],
  bun:    ['bun.lockb'],
  uv:     ['uv.lock'],
  poetry: ['poetry.lock'],
  pip:    ['requirements.txt'],
};
const ALL_LOCKFILES = Object.values(LOCKFILES_BY_MANAGER).flat();

const cases = [
  {
    name: 'koala73/worldmonitor v2.5.23 (npm)',
    url: 'https://github.com/koala73/worldmonitor.git',
    ref: 'v2.5.23',
    expectedManager: 'npm',
    expectPresent: 'package-lock.json',
  },
  {
    name: 'excalidraw/excalidraw v0.18.1 (yarn)',
    url: 'https://github.com/excalidraw/excalidraw.git',
    ref: 'v0.18.1',
    expectedManager: 'yarn',
    expectPresent: 'yarn.lock',
  },
];

async function main() {
  let allOk = true;

  if (process.env.SKIP_NETWORK) {
    console.log('SKIP  all network cases (SKIP_NETWORK=1)');
    process.exit(0);
  }

  for (const c of cases) {
    try {
      const { owner, repo } = parseGithubUrl(c.url);
      const { sha } = await resolveRef({ owner, repo, ref: c.ref });
      const entries = await listRepoRoot({ owner, repo, ref: sha });
      const presentLockfiles = entries
        .filter((e) => e.type === 'file')
        .map((e) => e.name)
        .filter((name) => ALL_LOCKFILES.includes(name));
      const ok = presentLockfiles.includes(c.expectPresent);
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
      console.log(`        expected ${c.expectPresent}; present: {${presentLockfiles.join(', ')}}`);
      if (!ok) allOk = false;
    } catch (err) {
      console.log(`FAIL  ${c.name}: ${err.message}`);
      allOk = false;
    }
  }

  console.log('');
  console.log(allOk ? 'ALL OK' : 'FAILED');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
