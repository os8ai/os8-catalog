# Open WebUI

User-friendly AI Interface that supports Ollama, OpenAI API, and a number
of other providers. FastAPI backend + SvelteKit frontend, packaged
upstream as a multi-arch Docker image (`ghcr.io/open-webui/open-webui`).

## Why docker?

Open WebUI's official install path is the published container image. A
hybrid Python+SvelteKit build path exists but is less reliable across
host environments. Phase 2's `runtime.kind: docker` is the right shape:
small install surface, high reliability, supply-chain pinned to a
specific image digest.

## Image digest

The `image_digest` field above is resolved by catalog sync at PR-merge
time. Until sync runs, the placeholder digest will fail the desktop's
Verified-channel check (`docker manifest must pin image by digest`).
That's working as intended — manifests aren't installable until sync
fixes them up.

## Auth

OS8 disables Open WebUI's login UI (`WEBUI_AUTH=false`) since the OS8
shell already provides per-app authentication via subdomain mode (the
container is reachable only at `openwebui.localhost:8888` via the OS8
proxy).

## License

BSD-3-Clause-Clear. Commercial use unrestricted.
