#!/usr/bin/env node
// For every manifest changed in a PR, resolve `upstream.ref` to its 40-char
// commit SHA via the GitHub API. Curators review against the resolved SHA
// (the bot comment makes it visible), not the raw tag string -- annotated
// tags can be moved between fetches; commit SHAs cannot.
//
// Outputs a markdown table on stdout AND writes it to $GITHUB_OUTPUT under
// the key `comment` so the workflow can post (or update) a single PR comment
// with a stable sentinel marker.
//
// Resolution model: we DO NOT persist the resolved SHA back into the manifest
// file. Durable cross-PR comparison happens server-side at sync time -- see
// app-store-spec section on tag-mutation alarm. PR 0.3's job is curator
// visibility; PR 0.8's sync compares the resolved SHA against the prior
// upstreamResolvedCommit for the same (slug, manifestSha) and fires an alarm
// if the tag was rewritten.
//
// Exits non-zero if any manifest fails to resolve.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { parseGithubUrl, resolveRef } = require('./lib/github');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Skip any path under a folder whose name starts with `_` (e.g.
// apps/_test-fixtures/bad-docker/manifest.yaml). Folders prefixed with `_`
// hold CI fixtures and must not be processed by production scripts.
function isFixturePath(p) {
  return p.split(path.sep).some((seg) => seg.startsWith('_'));
}

function changedManifestPaths() {
  const baseSha = process.env.PR_BASE_SHA;
  const headSha = process.env.PR_HEAD_SHA;
  if (!baseSha || !headSha) {
    // Local invocation -- scan all manifests instead of diffing.
    const all = spawnSync('git', ['ls-files', 'apps/*/manifest.yaml'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return all.stdout.split('\n').filter(Boolean).filter((p) => !isFixturePath(p));
  }
  const diff = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${baseSha}..${headSha}`, '--', 'apps/*/manifest.yaml'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (diff.status !== 0) {
    throw new Error(`git diff failed: ${diff.stderr}`);
  }
  return diff.stdout.split('\n').filter(Boolean).filter((p) => !isFixturePath(p));
}

function commitUrl({ owner, repo, sha }) {
  return `https://github.com/${owner}/${repo}/commit/${sha}`;
}

function shortSha(sha) {
  return sha.slice(0, 8);
}

async function main() {
  const changed = changedManifestPaths();
  if (changed.length === 0) {
    console.log('No manifest files changed.');
    writeOutputs({ comment: '' });
    return;
  }

  const rows = [];
  let hadFailure = false;

  for (const relPath of changed) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      // Manifest deleted in this PR -- skip.
      continue;
    }
    const slug = path.basename(path.dirname(relPath));
    let manifest;
    try {
      manifest = yaml.load(fs.readFileSync(absPath, 'utf8'));
    } catch (err) {
      rows.push({ slug, ref: '?', resolvedHtml: `❌ YAML parse error: ${err.message}`, ok: false });
      hadFailure = true;
      continue;
    }

    const upstream = manifest && manifest.upstream;
    if (!upstream || typeof upstream.git !== 'string' || typeof upstream.ref !== 'string') {
      rows.push({ slug, ref: '?', resolvedHtml: '❌ Missing upstream.git or upstream.ref', ok: false });
      hadFailure = true;
      continue;
    }

    let owner, repo;
    try {
      ({ owner, repo } = parseGithubUrl(upstream.git));
    } catch (err) {
      rows.push({ slug, ref: upstream.ref, resolvedHtml: `❌ ${err.message}`, ok: false });
      hadFailure = true;
      continue;
    }

    try {
      const { sha, alreadyPinned } = await resolveRef({ owner, repo, ref: upstream.ref });
      const tag = alreadyPinned ? `\`${shortSha(sha)}\` (already pinned)` : `\`${upstream.ref}\``;
      const link = `[\`${shortSha(sha)}\`](${commitUrl({ owner, repo, sha })})`;
      rows.push({
        slug,
        ref: tag,
        resolvedHtml: link,
        sha,
        ok: true,
      });
    } catch (err) {
      rows.push({ slug, ref: upstream.ref, resolvedHtml: `❌ ${err.message}`, ok: false });
      hadFailure = true;
    }
  }

  const lines = [];
  lines.push('<!-- resolve-refs-bot -->');
  lines.push('## Resolved upstream refs');
  lines.push('');
  lines.push('| Slug | Ref | Resolved SHA |');
  lines.push('|---|---|---|');
  for (const r of rows) {
    lines.push(`| \`${r.slug}\` | ${r.ref} | ${r.resolvedHtml} |`);
  }
  lines.push('');
  lines.push('_Curators: review the linked commit, not the tag string. Tags can mutate between syncs; the commit SHA is immutable. See the tag-mutation alarm in app-store-spec._');

  const comment = lines.join('\n');
  console.log(comment);
  writeOutputs({ comment });

  if (hadFailure) {
    console.error('\nOne or more refs failed to resolve.');
    process.exit(1);
  }
}

function writeOutputs(outputs) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (!ghOutput) return;
  for (const [key, value] of Object.entries(outputs)) {
    // Multi-line outputs use the heredoc form documented in
    // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#multiline-strings
    const delim = `EOF_${Math.random().toString(36).slice(2)}`;
    fs.appendFileSync(ghOutput, `${key}<<${delim}\n${value}\n${delim}\n`);
  }
}

main().catch((err) => {
  console.error('Fatal resolve-refs error:', err);
  process.exit(2);
});
