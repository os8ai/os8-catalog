# Hello Static

A trivial static-HTML page that proves OS8's static runtime adapter (PR
2.3) and the per-app `express.static` middleware on a subdomain.

## How it works

The manifest's `start.argv` is `["os8:static", "--dir", "."]`. `os8:static`
is a sentinel argv[0] — the static adapter recognizes it, skips the spawn
path entirely, and returns `{ _kind: 'static', _staticDir: <appDir> }`.
OS8's reverse proxy then registers `express.static(appDir)` for the app's
subdomain (`hello-static.localhost:8888`).

Trust-boundary parity is preserved: every external app gets its own
browser origin, including static apps. The "bypass" is that OS8 serves
the bytes itself rather than proxying to a separate dev server.

## Upstream

The upstream repo `os8ai/hello-static` ships:
- `index.html` — `<h1>Hello, OS8</h1>`

## License

MIT. Commercial use unrestricted.
