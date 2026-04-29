# SvelteKit Realworld

The official SvelteKit implementation of the [Realworld example app](https://github.com/gothinkster/realworld) — a Medium-style blogging platform. Useful as a reference implementation for SvelteKit + OS8.

## What it does

- Standard Realworld feature set: articles, comments, profiles, follows, favorites.
- Talks to the public Realworld API (`https://node-express-conduit.appspot.com/api`).
- No local database — backend state lives at the Realworld API.

## Notes for OS8 users

- Pinned to a specific commit because the upstream uses `master` as a rolling ref with no formal release tags. If you want a newer cut, open a PR bumping `upstream.ref` to a fresher SHA.
- Outbound network required (talks to the public Realworld API).
- Demonstrates SvelteKit's dev mode under the OS8 base-path proxy (`--base /{{APP_PATH}}/`).

## Source

[github.com/sveltejs/realworld](https://github.com/sveltejs/realworld) · License: **MIT**
