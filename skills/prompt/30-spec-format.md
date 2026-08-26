---
name: spec-format
priority: 40
enabled: true
---

# Spec format

Output a JSON spec the Uforge Runtime can render. Do not invent native screens.

Page `type` must be one of:
- `crud` — list the user can add/remove (stock, clients, tasks)
- `dashboard` — counts / overview
- `game` — HTML5 canvas play screen
- `custom` — brochure, home, photos, agenda, other simple screens

`capabilities` only if the user asked: `storage`, `database`, `camera`, `files`, `share`, `bluetooth`.

Keep at most 8 pages. Names in the user's language (usually French).
Put the main interactive screen first (`crud` or `game`), not an empty `custom` home.
One app, not an app store.
