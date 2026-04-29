#!/usr/bin/env node
// Network-touching smoke test for lib/github.js. Exercises:
//   - tag resolution (annotated tag) against koala73/worldmonitor v2.5.23
//   - already-pinned 40-char SHA passthrough
//   - URL parsing for both with-.git and without-.git URLs
//
// Skipped when running without network access. CI always runs this; if you
// run it locally and don't want to hit GitHub, set SKIP_NETWORK=1.

const { resolveRef, parseGithubUrl } = require('./lib/github');

const KNOWN = {
  url: 'https://github.com/koala73/worldmonitor.git',
  ref: 'v2.5.23',
  expectedSha: 'e51058e1765ef2f0c83ccb1d08d984bc59d23f10',
};

async function main() {
  let allOk = true;

  // URL parsing: with .git
  {
    const { owner, repo } = parseGithubUrl('https://github.com/koala73/worldmonitor.git');
    const ok = owner === 'koala73' && repo === 'worldmonitor';
    console.log(`${ok ? 'PASS' : 'FAIL'}  parseGithubUrl(.git suffix) -> ${owner}/${repo}`);
    if (!ok) allOk = false;
  }

  // URL parsing: without .git
  {
    const { owner, repo } = parseGithubUrl('https://github.com/withastro/blog-tutorial-demo');
    const ok = owner === 'withastro' && repo === 'blog-tutorial-demo';
    console.log(`${ok ? 'PASS' : 'FAIL'}  parseGithubUrl(no .git)     -> ${owner}/${repo}`);
    if (!ok) allOk = false;
  }

  // URL parsing: rejects non-github URL
  {
    let threw = false;
    try {
      parseGithubUrl('https://gitlab.com/foo/bar.git');
    } catch (_) {
      threw = true;
    }
    console.log(`${threw ? 'PASS' : 'FAIL'}  parseGithubUrl rejects non-github URL`);
    if (!threw) allOk = false;
  }

  // Already-pinned SHA passthrough -- no network call needed.
  {
    const { owner, repo } = parseGithubUrl(KNOWN.url);
    const r = await resolveRef({ owner, repo, ref: KNOWN.expectedSha });
    const ok = r.sha === KNOWN.expectedSha && r.alreadyPinned === true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  resolveRef(SHA) passthrough  -> ${r.sha} (alreadyPinned=${r.alreadyPinned})`);
    if (!ok) allOk = false;
  }

  if (process.env.SKIP_NETWORK) {
    console.log('SKIP  network tag resolution (SKIP_NETWORK=1)');
  } else {
    // Tag resolution against the real GitHub API.
    try {
      const { owner, repo } = parseGithubUrl(KNOWN.url);
      const r = await resolveRef({ owner, repo, ref: KNOWN.ref });
      const ok = r.sha === KNOWN.expectedSha && r.alreadyPinned === false;
      console.log(`${ok ? 'PASS' : 'FAIL'}  resolveRef(${KNOWN.ref})           -> ${r.sha} (alreadyPinned=${r.alreadyPinned})`);
      if (!ok) {
        allOk = false;
        if (r.sha !== KNOWN.expectedSha) {
          console.log(`        expected ${KNOWN.expectedSha}`);
          console.log(`        got      ${r.sha}`);
          console.log(`        Either the tag was rewritten upstream, or the audit value is stale.`);
        }
      }
    } catch (err) {
      console.log(`FAIL  resolveRef(${KNOWN.ref}): ${err.message}`);
      allOk = false;
    }

    // Nonexistent tag -- should throw.
    try {
      const { owner, repo } = parseGithubUrl(KNOWN.url);
      await resolveRef({ owner, repo, ref: 'v999.999.999' });
      console.log('FAIL  resolveRef(v999.999.999) did not throw');
      allOk = false;
    } catch (err) {
      const expectedSubstring = 'Ref not found';
      const ok = err.message.includes(expectedSubstring);
      console.log(`${ok ? 'PASS' : 'FAIL'}  resolveRef(v999.999.999) throws "${err.message}"`);
      if (!ok) allOk = false;
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
