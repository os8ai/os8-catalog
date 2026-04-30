# ComfyUI

A graph/nodes UI for diffusion models. Workflows for Stable Diffusion,
SDXL, FLUX, and the broader ecosystem of open-weights image and video
models. Pinned to upstream `v0.20.1` (SHA `64b8457f`).

## Output redirection

OS8 routes generated artifacts and uploads into per-app blob storage
(`~/os8/blob/<id>/`) via ComfyUI's documented CLI flags:

- `--output-directory {{BLOB_DIR}}`
- `--input-directory {{BLOB_DIR}}/inputs`
- `--user-directory {{BLOB_DIR}}/user`

This keeps source and data separate (the v1 convention shared by all
external apps) and works cleanly with OS8's tiered uninstall + dev-mode
auto-commit.

## Coexistence with launcher-managed ComfyUI

OS8 already ships an `imagegen` capability that talks to a launcher-managed
ComfyUI instance on `localhost:8188`. The catalog ComfyUI is a separate
installation at a registry-allocated port (in the `[40000, 49999]` range)
on `comfyui.localhost:8888`. The two coexist:

- The launcher-managed instance is the OS8 image-gen backend (used by
  agents calling `window.os8.imagegen.*` under the hood).
- The catalog ComfyUI is a user-visible app for hands-on workflow editing,
  with its own per-app blob storage scope.

## License

GPL-3.0-only. Personal use is unrestricted; commercial distribution
requires GPL compliance (release modifications under GPL).
