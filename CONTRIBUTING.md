# Contributing to the OS8 Catalog

Thanks for proposing an app for the OS8 catalog. This document is the practical companion to [`schema/appspec-v1.json`](./schema/appspec-v1.json).

---

## 1. Before you open a PR

- **Pick a slug.** Lowercase letters, digits, hyphens; 2–40 chars; must start with a letter. The slug becomes the URL on os8.ai (`/apps/<slug>`) and is immutable after publish. Reserved prefix `os8-` is for first-party apps.
- **Check upstream eligibility.**
  - Public GitHub repository.
  - Verified channel (the only Phase 0 channel) requires a recognized lockfile in the repo root: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `uv.lock`, `poetry.lock`, or `requirements.txt` (Python projects only).
  - License is permissively or restrictively redistributable. Document any commercial-use restriction in `legal.notes`.
- **Pin a tag or SHA.** `upstream.ref` must be a semver tag (`vX.Y.Z`) or a 40-char commit SHA. Branches (`main`, `master`, `dev`) are rejected by the schema.
- **Prepare assets.**
  - `icon.png` — 256×256 PNG, ≤100 KB. (SVG also accepted; size limit still applies.)
  - `screenshots/*.png` — up to 5 PNG / JPG / WebP screenshots, ≤500 KB each.
  - `README.md` — editorial copy rendered on the os8.ai detail page. Markdown, GFM, sanitized server-side. No HTML escapes needed.

## 2. Manifest fields

The schema is the source of truth. The fields most reviewers ask about:

| Field | Notes |
|---|---|
| `slug` | See above. |
| `name`, `description` | Plain text. `description` ≤280 chars (single-line card copy). |
| `category` | One of: `productivity`, `intelligence`, `media`, `dev-tools`, `data`, `ai-experiments`, `utilities`. |
| `framework` | One of: `vite`, `nextjs`, `sveltekit`, `astro`, `streamlit`, `gradio`, `hugo`, `jekyll`, `none`. Optional but strongly preferred — drives badge display and Phase 1 adapter selection. |
| `runtime.kind` | `node`, `python`, or `static`. |
| `runtime.version` | The major (or major.minor) version your app needs. |
| `runtime.package_manager` | `auto` lets the Phase 1 adapter detect from the lockfile. Set explicitly only if the upstream uses something non-canonical. |
| `runtime.dependency_strategy` | Verified channel must be `frozen` (enforced by schema). |
| `install` / `postInstall` / `preStart` / `start` | Each entry is `{argv: [...], shell: false}`. Shell strings are not allowed. |
| `start.argv` | The launcher dictates `{{APP_PATH}}` and `{{PORT}}` substitutions. See the worldmonitor manifest for the canonical Vite invocation. |
| `permissions.network` | Set both `outbound` and `inbound` explicitly. |
| `permissions.os8_capabilities` | Fine-grained list. See the schema regex for the allowed grammar. |
| `permissions.secrets` | Declare each secret your app needs at runtime. The Phase 1 install UI prompts the user. |
| `legal.license` | SPDX expression (`MIT`, `Apache-2.0`, `AGPL-3.0-only`, etc.). |
| `review.channel` | `verified` for catalog PRs. |
| `review.reviewed_at` | ISO date string (quoted in YAML so the parser keeps it as a string). |

## 3. Asset requirements

| Asset | Format | Dimensions | Max size |
|---|---|---|---|
| `icon.png` | PNG (or SVG) | 256×256 | 100 KB |
| `screenshots/*` | PNG, JPG, WebP | any (recommend ≥1280px wide) | 500 KB each |

The validate workflow uses `sharp` to read PNG metadata. Optimize PNGs with `pngquant` or `oxipng` if you're near the limit.

## 4. CI checks

Three workflows run on every PR touching `apps/`:

| Workflow | Purpose | Common failure |
|---|---|---|
| `validate` | ajv schema + slug uniqueness + image checks | Branch ref instead of tag/SHA; oversized icon; missing screenshot file. |
| `resolve-refs` | Posts a PR comment with `upstream.ref` resolved to a 40-char commit SHA. | Tag does not exist in upstream; tag is annotated and resolution failed (we use `GET /commits/{ref}` which auto-dereferences — file an issue if you hit this). |
| `lockfile-gate` | Asserts a recognized lockfile exists in the upstream repo at the resolved SHA. | Upstream uses unsupported package manager; lockfile is in a subdirectory (Verified channel requires it at the repo root). |

Re-run a failed workflow with `gh workflow run` or by pushing a new commit.

## 5. Review process

A curator from `@os8ai/curators` reviews each PR. We look at:

- **Provenance.** Is the upstream legit? Active maintenance, real users, plausible publisher.
- **Permissions vs. behavior.** Does the manifest declare every network endpoint, capability, and secret the app actually uses? Over-permissioning gets a push-back.
- **Manifest hygiene.** Sensible defaults, accurate description, screenshots that show real functionality.
- **Resolved SHA.** We approve against the SHA in the bot comment, not the tag string. Tag mutations after merge fire a supply-chain alarm and soft-delete the app.

Average turnaround: 2–3 business days for routine submissions.

## 6. Updating an app

- **Bump `upstream.ref`** — open a PR, the resolve-refs bot posts the new SHA, curator re-reviews the diff against the prior SHA.
- **Refresh icon or screenshots** — same PR or a separate cosmetic PR. No additional review unless the change conveys substantively different behavior.
- **Withdraw an app** — open a PR removing the `apps/<slug>/` directory. The sync soft-deletes the row on os8.ai (it's never hard-deleted).

## 7. Channels

- **verified** — what this catalog tracks today. Curator-reviewed, lockfile-gated.
- **community** (Phase 3) — open submissions, automated review, separate channel filter on os8.ai. Not yet open.
- **developer-import** (desktop-side) — power-user feature for installing arbitrary GitHub repos without going through this catalog. Never lands here.
