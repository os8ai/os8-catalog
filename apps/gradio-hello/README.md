# Gradio Hello

A minimal `gr.Interface` demo that proves OS8's Phase 2 Python runtime
adapter and the Gradio framework path. The script reads `os.environ['PORT']`
and binds at `127.0.0.1` per the framework convention.

## Why it's in the catalog

Companion to streamlit-hello — same proof, different framework. Gradio
uses chokidar-based restart on file change (`dev.hmr: watcher`) rather than
its own auto-reload because Gradio's `--reload` CLI doesn't accept
`--server-port`.

## Upstream

The upstream repo `os8ai/gradio-hello` ships:
- `app.py` — `gr.Interface(fn=greet, inputs="text", outputs="text").launch(...)`
- `requirements.txt` — `gradio==4.44.0`
- `uv.lock` — committed; generated via `uv lock`

## License

MIT. Commercial use unrestricted.
