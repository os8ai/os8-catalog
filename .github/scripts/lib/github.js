// Thin wrappers over the GitHub REST API used by the catalog's CI scripts.
// Shared between resolve-refs.js (PR 0.3) and check-lockfile.js (PR 0.4) so
// both go through one rate-limit-aware code path.

const HEADERS_BASE = { 'Accept': 'application/vnd.github+json' };

function authHeader() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ghFetch(url, { retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { ...HEADERS_BASE, ...authHeader() },
    });

    // Rate-limited: wait until X-RateLimit-Reset and retry once.
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const now = Math.floor(Date.now() / 1000);
      const waitSec = Math.max(1, reset - now + 1);
      if (attempt < retries) {
        console.error(`GitHub rate-limited; sleeping ${waitSec}s before retry...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
    }

    // Server errors: retry with exponential backoff.
    if (res.status >= 500 && attempt < retries) {
      const wait = 500 * Math.pow(4, attempt);
      console.error(`GitHub ${res.status}; retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    return res;
  }
}

// Parse "https://github.com/<owner>/<repo>(.git)?" -> { owner, repo }.
function parseGithubUrl(url) {
  const m = url.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Not a github.com URL: ${url}`);
  return { owner: m[1], repo: m[2] };
}

// Resolve a tag or short SHA to a 40-char commit SHA.
//
// We deliberately use GET /repos/{owner}/{repo}/commits/{ref} -- it
// auto-dereferences both lightweight and annotated tags, returning the commit
// they point to. The alternative (git/refs/tags/{tag} -> git/tags/{sha}) is a
// two-step that returns the tag object SHA for annotated tags, which is NOT
// the same as the commit SHA. Verified against koala73/worldmonitor v2.5.23
// (annotated tag).
async function resolveRef({ owner, repo, ref }) {
  // Already a 40-char SHA -- nothing to resolve.
  if (/^[0-9a-f]{40}$/.test(ref)) {
    return { sha: ref, alreadyPinned: true };
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const res = await ghFetch(url);
  // The commits endpoint returns 404 for repos that don't exist and 422
  // ("No commit found for SHA") for refs that don't exist within a real repo.
  // Treat both as "ref not found" for catalog purposes.
  if (res.status === 404 || res.status === 422) {
    throw new Error(`Ref not found: ${owner}/${repo}@${ref}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} resolving ${owner}/${repo}@${ref}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.sha || !/^[0-9a-f]{40}$/.test(json.sha)) {
    throw new Error(`Resolved SHA looks malformed: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { sha: json.sha, alreadyPinned: false };
}

// List the names of root-level entries in a repo at a given ref. Used by the
// lockfile gate (PR 0.4). Returns an array of { name, type } where type is
// 'file' or 'dir'.
async function listRepoRoot({ owner, repo, ref }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(ref)}`;
  const res = await ghFetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} listing ${owner}/${repo}@${ref}: ${body.slice(0, 300)}`);
  }
  const arr = await res.json();
  if (!Array.isArray(arr)) {
    throw new Error(`Expected an array from contents endpoint, got: ${typeof arr}`);
  }
  return arr.map((e) => ({ name: e.name, type: e.type }));
}

module.exports = { ghFetch, parseGithubUrl, resolveRef, listRepoRoot };
