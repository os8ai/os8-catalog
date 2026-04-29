# Excalidraw

Open-source virtual whiteboard for sketching hand-drawn-style diagrams.

## What it does

- Infinite canvas with hand-drawn shape rendering.
- Library of reusable shapes (flowcharts, AWS, system diagrams, etc.).
- Export to PNG, SVG, JSON, or a shareable encrypted link.
- Real-time multi-user collaboration (when configured with a Convex / Excalidraw+ backend).

## Notes for OS8 users

- Excalidraw is a Yarn workspace monorepo. The catalog manifest invokes the `@excalidraw/excalidraw-app` workspace's `start` script, which runs Vite against the React app under `excalidraw-app/`.
- Outbound network is required only for collaboration features and emoji fonts; the editor runs fully offline otherwise.
- No secrets required for the local-only experience.

## Source

[github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) · License: **MIT**
