---
name: runtime-api
priority: 40
enabled: true
---

# `window.runtime` API

Injected before your code: no import, no init. Every method returns a Promise. Failures reject with `{ code, message }`, where `code` is `permission`, `unavailable`, `cancelled` or `invalid`. Always handle them.

## App
- `runtime.app` → `{ id, name, version, mode }` (plain object). `mode` is `"preview"` in the workshop and `"live"` once built. Never show debug UI in live mode.
- `runtime.capabilities.has(name)` → boolean.

## Storage (always available)
- `runtime.storage.get(key)` → JSON value or `null`
- `runtime.storage.set(key, value)` (value must be JSON-serialisable)
- `runtime.storage.remove(key)` · `runtime.storage.keys()` → string[]

Use it for settings and small state. Lists and records go in the database.

## Database: SQLite (always available)
- `runtime.db.migrate(steps)` → schema version. `steps` is an append-only array; each item is one SQL string or an array of SQL strings. Each step runs once, in a transaction. Call it once at startup, before any query.
- `runtime.db.query(sql, params?)` → array of row objects
- `runtime.db.exec(sql, params?)` → `{ changes, lastInsertId }`
- `runtime.db.batch([{ sql, params }])` → runs everything in one transaction

Always use `?` placeholders. Table names starting with `_` are reserved.

## Device
- `runtime.camera.capture({ maxWidth: 1280, quality: 0.8 })` → `{ dataUrl, mime, width, height }`, or `null` if cancelled. Needs `camera`.
- `runtime.files.pick({ accept: "image/*,.csv", multiple: false })` → `[{ name, mime, size, dataUrl }]` (empty if cancelled).
- `runtime.files.save({ name, mime, data })` → `true` once saved or shared. `data` is text or a data URL.
- `runtime.share.send({ title, text, url })` → `true` once shared.
- `runtime.browser.open(url)` opens `https:`, `tel:`, `mailto:`, `sms:` and `geo:` links outside the app.
- `runtime.device.info()` → `{ platform: "web" | "android" | "ios", online, language }`

## Network (needs `network`)
- Plain `fetch` / `WebSocket` for APIs that allow CORS (preferred: works everywhere).
- `runtime.http.request({ url, method, headers, body })` → `{ status, headers, body }` (body as text). On Android it bypasses CORS; in a web browser it is still subject to CORS. Prefer APIs that allow CORS.

## Optional: check before use
`runtime.geo.position()` (capability `geolocation`), `runtime.notify.schedule({ at, title, body })` (`notifications`), `runtime.haptics.impact()` (`haptics`). Call them only after `await runtime.capabilities.has(...)` returns true, and always keep a fallback.

## Declare what you use
List the capabilities you need in `uforge.json` → `"capabilities"`: `camera`, `network`, `geolocation`, `notifications`, `haptics`. A call to an undeclared capability rejects with `permission`.

## Example
```js
await runtime.db.migrate([
  "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0)",
  "ALTER TABLE products ADD COLUMN photo TEXT"
]);
const { lastInsertId } = await runtime.db.exec(
  "INSERT INTO products (name, price_cents) VALUES (?, ?)", ["Croissant", 120]
);
const products = await runtime.db.query("SELECT * FROM products ORDER BY name");
```
