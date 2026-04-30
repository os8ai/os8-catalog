# Streamlit Hello

A 3-line Streamlit demo (`st.title` + `st.write`) that proves OS8's Phase 2
Python runtime adapter, the Streamlit framework defaults, and the
Streamlit-through-proxy WebSocket path established by PR 2.2's gate.

## Why it's in the catalog

This is the "hello world" companion to PR 2.4's larger Python catalog seed
(ComfyUI). It validates:

- `runtime.kind: python` install via `uv sync --frozen`
- Streamlit's `--server.enableCORS=false --server.enableXsrfProtection=false`
  flags, which OS8 injects via `framework: streamlit` defaults
- The `/_stcore/stream` WebSocket survives the OS8 reverse proxy under
  subdomain mode

## Upstream

The upstream repo `os8ai/streamlit-hello` ships:
- `app.py` — `st.title("Streamlit Hello"); st.write("Hello from OS8")`
- `requirements.txt` — `streamlit==1.32.2`
- `uv.lock` — committed; generated via `uv lock`

## License

MIT. Commercial use unrestricted.
