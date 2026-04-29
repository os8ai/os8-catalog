# World Monitor

A real-time global intelligence dashboard built with Vite + React. Aggregates news, AIS shipping data, threat feeds, and infrastructure status onto an interactive 3D globe.

## What it does

- News, market, and geopolitical aggregation from public feeds.
- Live AIS-style shipping and aviation overlays on a deck.gl globe.
- Per-region drill-down panels and configurable saved views.

## Notes for OS8 users

- First launch fetches a few hundred KB of map tiles into the app's private data directory.
- Default behaviour is read-only — no API keys required. Some optional feeds will gracefully no-op if their key is absent.
- Outbound network is required (news + tile providers + telemetry). No inbound listeners.

## Source

[github.com/koala73/worldmonitor](https://github.com/koala73/worldmonitor) · License: **AGPL-3.0-only** · Commercial redistribution requires AGPL-3.0 compliance.
