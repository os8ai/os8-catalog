#!/usr/bin/env node
// For every Verified-channel manifest changed in this PR, confirm the
// upstream repo has a recognized lockfile at the pinned commit SHA.
// Verified channel requires reproducible builds; without a lockfile the
// Phase 1 install adapter can't pin transitive deps.
//
// Skipped for Community / Developer-Import manifests (not populated in
// Phase 0 anyway).
//
// Recognized lockfiles, by package manager:
//   npm     package-lock.json
//   pnpm    pnpm-lock.yaml
//   yarn    yarn.lock
//   bun     bun.lockb         (PRESENCE-only check; format mutates between
//                             bun minor versions per plan section 10 Q6)
//   uv      uv.lock
//   poetry  poetry.lock
//   pip     requirements.txt  (only counted when package_manager == 'pip')
//
// If runtime.package_manager is explicit (not 'auto'), the matching lockfile
// must be present. If 'auto', any of the above counts.
//
// Exits non-zero with a descriptive error on failure.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { parseGithubUrl, resolveRef, listRepoRoot } = require('./lib/github');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const LOCKFILES_BY_MANAGER = {
  npm:    ['package-lock.json'],
  pnpm:   ['pnpm-lock.yaml'],
  yarn:   ['yarn.lock'],
  bun:    ['bun.lockb'],
  uv:     ['uv.lock'],
  poetry: ['poetry.lock'],
  pip:    ['requirements.txt'],
};

// Auto mode: any lockfile satisfies the gate. requirements.txt is a strong
// "this is a Python pip project" signal, so we accept it in auto mode too --
// but for explicit non-pip managers we only accept their own lockfile.
const ALL_LOCKFILES = Object.values(LOCKFILES_BY_MANAGER).flat();

// Skip any path under a folder whose name starts with `_` (e.g.
// apps/_test-fixtures/bad-docker/manifest.yaml).
function isFixturePath(p) {
  return p.split(path.sep).some((seg) => seg.startsWith('_'));
}

function changedManifestPaths() {
  const baseSha = process.env.PR_BASE_SHA;
  const headSha = process.env.PR_HEAD_SHA;
  if (!baseSha || !headSha) {
    const all = spawnSync('git', ['ls-files', 'apps/*/manifest.yaml'], {
      cwd: REPO_ROOT, encoding: 'utf8',
    });
    return all.stdout.split('\n').filter(Boolean).filter((p) => !isFixturePath(p));
  }
  const diff = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${baseSha}..${headSha}`, '--', 'apps/*/manifest.yaml'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (diff.status !== 0) throw new Error(`git diff failed: ${diff.stderr}`);
  return diff.stdout.split('\n').filter(Boolean).filter((p) => !isFixturePath(p));
}

async function gateOne(relPath) {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    return { slug: path.basename(path.dirname(relPath)), skipped: 'manifest deleted' };
  }
  const slug = path.basename(path.dirname(relPath));
  const manifest = yaml.load(fs.readFileSync(absPath, 'utf8'));

  const channel = manifest && manifest.review && manifest.review.channel;
  if (channel !== 'verified') {
    return { slug, skipped: `channel=${channel}` };
  }

  // PR 2.5: docker manifests pin via runtime.image_digest, not a lockfile.
  // PR 2.3: static manifests have no package manager — pinning is by
  // upstream commit SHA only.
  const runtimeKind = manifest && manifest.runtime && manifest.runtime.kind;
  if (runtimeKind === 'docker' || runtimeKind === 'static') {
    return { slug, skipped: `runtime.kind=${runtimeKind}` };
  }

  const upstream = manifest.upstream || {};
  const { owner, repo } = parseGithubUrl(upstream.git);
  const { sha: resolvedSha } = await resolveRef({ owner, repo, ref: upstream.ref });

  const entries = await listRepoRoot({ owner, repo, ref: resolvedSha });
  const presentLockfiles = entries
    .filter((e) => e.type === 'file')
    .map((e) => e.name)
    .filter((name) => ALL_LOCKFILES.includes(name));

  const declaredManager =
    (manifest.runtime && manifest.runtime.package_manager) || 'auto';

  if (declaredManager === 'auto') {
    if (presentLockfiles.length === 0) {
      return {
        slug,
        ok: false,
        message:
          `${slug}: review.channel=verified requires a lockfile in upstream ` +
          `${owner}/${repo}@${resolvedSha.slice(0, 8)}; none of {${ALL_LOCKFILES.join(', ')}} found.`,
      };
    }
    return {
      slug,
      ok: true,
      message:
        `${slug}: ✅ lockfile(s) ${presentLockfiles.join(', ')} present in ` +
        `${owner}/${repo}@${resolvedSha.slice(0, 8)} (auto-detect mode).`,
    };
  }

  // Explicit package manager: require a matching lockfile.
  const expected = LOCKFILES_BY_MANAGER[declaredManager];
  if (!expected) {
    return {
      slug,
      ok: false,
      message:
        `${slug}: runtime.package_manager=${declaredManager} is not a recognized value.`,
    };
  }
  const matched = expected.filter((name) => presentLockfiles.includes(name));
  if (matched.length === 0) {
    return {
      slug,
      ok: false,
      message:
        `${slug}: runtime.package_manager=${declaredManager} requires one of ` +
        `{${expected.join(', ')}} in upstream ${owner}/${repo}@${resolvedSha.slice(0, 8)}; ` +
        `present lockfiles: {${presentLockfiles.join(', ') || 'none'}}.`,
    };
  }
  return {
    slug,
    ok: true,
    message:
      `${slug}: ✅ ${matched.join(', ')} present in ${owner}/${repo}@${resolvedSha.slice(0, 8)}.`,
  };
}

async function main() {
  const changed = changedManifestPaths();
  if (changed.length === 0) {
    console.log('No manifest files changed.');
    return;
  }

  let hadFailure = false;
  for (const relPath of changed) {
    try {
      const r = await gateOne(relPath);
      if (r.skipped) {
        console.log(`SKIP  ${r.slug}  (${r.skipped})`);
        continue;
      }
      console.log(r.message);
      if (!r.ok) hadFailure = true;
    } catch (err) {
      const slug = path.basename(path.dirname(relPath));
      console.error(`FAIL  ${slug}: ${err.message}`);
      hadFailure = true;
    }
  }

  if (hadFailure) {
    console.error('\nLockfile gate failed. See messages above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal lockfile-gate error:', err);
  process.exit(2);
});
