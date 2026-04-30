# OS8 Catalog

The official catalog of apps installable through [OS8](https://os8.ai). Live storefront: [os8.ai/apps](https://os8.ai/apps).

Currently 5 apps in the verified channel; community channel coming in Phase 3.

## Adding an app

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md).
2. Open a PR adding `apps/<your-slug>/manifest.yaml` and assets.
3. CI runs:
   - **validate** — schema conformance, slug uniqueness, image dimensions/sizes.
   - **resolve-refs** — resolves `upstream.ref` (semver tag) to its immutable commit SHA and posts the resolved SHA as a PR comment.
   - **lockfile-gate** (Verified channel only) — confirms a recognized lockfile exists in the upstream repo at the resolved SHA.
4. A curator reviews against the resolved SHA, not the tag string. On merge, a webhook syncs your manifest to https://os8.ai within ~30 seconds.

## Repo layout

```
schema/appspec-v1.json     The AppSpec v1 JSON Schema. Contract for every manifest.
apps/<slug>/
  manifest.yaml            The manifest (YAML, validated against appspec-v1.json).
  icon.png                 256x256 PNG, <=100 KB.
  screenshots/*.png        Up to 5 screenshots, <=500 KB each.
  README.md                Editorial copy rendered on the os8.ai detail page.
.github/CODEOWNERS         Per-app review assignment.
.github/workflows/*.yml    CI workflows.
```

## Schema

The AppSpec v1 schema lives at [`schema/appspec-v1.json`](./schema/appspec-v1.json).
Editor support: VS Code's YAML extension auto-loads the schema via the
`# yaml-language-server: $schema=` comment at the top of each manifest.

Key invariants (v1):

- `runtime.kind` is one of `node`, `python`, `static` — `docker` is reserved for v2.
- `surface.kind` is `web`.
- `permissions.filesystem` is `app-private`.
- `upstream.ref` is a 40-char commit SHA or a semver tag (`vX.Y.Z`) — branch names are rejected.
- Verified-channel manifests pin `runtime.dependency_strategy: frozen` and require an upstream lockfile.

## Channels

- **verified** — curator-reviewed, lockfile-gated, frozen install. The only channel populated in v1.
- **community** — Phase 3 (planned).
- **developer-import** — desktop-side only, never lands in this catalog.

## License

The catalog itself is MIT-licensed (see [LICENSE](./LICENSE)). Each app declares its own upstream license in `legal.license`.
