---
name: capabilities
priority: 30
enabled: true
---

# Device capabilities

Declare capabilities in the spec `capabilities` array. Do not assume access.

Examples: `storage`, `database`, `camera`, `files`, `share`, `bluetooth`.

Wi-Fi scan/control is usually blocked by the OS; do not promise it.

If the user wants a game, implement THAT game as HTML5 canvas JS in `game.source`.
Not a native engine. Not the generic click-the-dot toy unless they asked for it.
Scores may use SQLite (`runtime.db`).
