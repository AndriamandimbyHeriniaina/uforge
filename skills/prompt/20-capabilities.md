---
name: capabilities
priority: 30
enabled: true
---

# Device capabilities

Declare capabilities in the spec `capabilities` array. Do not assume access.

Examples: `storage`, `database`, `camera`, `files`, `share`, `bluetooth`.

Wi-Fi scan/control is usually blocked by the OS; do not promise it.

If the user wants a "dummy Android game", implement an HTML5 canvas/WebGL game
inside the Runtime, with optional SQLite for scores. Not a native game engine.
