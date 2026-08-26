---
name: spec-format
priority: 40
enabled: true
---

# Spec format

Output a JSON spec the Uforge Runtime can render. Do not invent native screens.

Page `type` must be one of:
- `crud` — list the user can add/remove. Always set `fields` (key, label, kind).
- `dashboard` — counts of crud collections
- `game` — HTML5 canvas. Put the real game in `game.source` (JS).
- `custom` — brochure, home, photos, agenda. Use `description`, `items`, `actions`

## Games

`game.source` is required for a playable game. It is the body of:

`function (canvas, ctx, runtime, page, spec, resize)`

Call `resize()` so the canvas matches the screen, then run the game the user asked for
(snake, pong, flappy, platformer, memory, etc.). Use pointer/touch on `canvas`.
Scores: `runtime.db.upsert('scores', { id: 'best', score: n })`.

Do **not** output `kind: catch` or `kind: tap` unless the user explicitly wants that
tiny “tap the dot” toy. Never substitute it for a different game.

Field `kind`: `text`, `number`, `note`, `photo` (camera).
Action `run`: `camera`, `files`, `share`, `goto` (with `page` = another page name).

`seed` is optional starter rows for a collection (shown until the user edits).

`capabilities` only if needed: `storage`, `database`, `camera`, `files`, `share`, `bluetooth`.
The gateway adds camera/files/share when fields or actions need them.

Keep at most 8 pages. Names in the user's language (usually French).
Put the main interactive screen first (`crud` or `game`), not an empty `custom` home.
One app, not an app store.
