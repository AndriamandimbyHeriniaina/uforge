---
name: data
priority: 70
enabled: true
---

# Data

- Persist everything users create or change, unless it is obviously temporary, and restore it at startup.
- Structured data (lists, records, history, scores) goes in `runtime.db` (SQLite). Settings and small state go in `runtime.storage`.

## Schema
- Declare the schema with `runtime.db.migrate(steps)` in `src/db.js`, called first in `main.js`.
- Steps are append-only. Never edit, reorder or remove an existing step: add a new one (`ALTER TABLE … ADD COLUMN`, a new table, a backfill `UPDATE`).
- Never DROP tables or columns, or DELETE user rows, in a migration unless the admin explicitly asks.
- Ids: `INTEGER PRIMARY KEY`. Dates: ISO 8601 text. Money: integer cents. Booleans: 0/1.
- Always use `?` parameters. Add indexes on columns you filter or sort by in large tables.

## Initial data
- Content the end user edits (products, contacts, tasks): insert a few realistic starter rows in a migration step.
- Content only the admin changes through you (brochure texts, game levels, menus): keep it in code or JSON modules, not in the database.
- An exported app may start with an empty database, so the app must create its schema and starter data by itself.

## Photos and files
- Use `runtime.camera.capture({ maxWidth: 1280 })` and store the data URL in a TEXT column. Keep small thumbnails (about 200 px) for lists.
- In business apps, offer export and import of the app's data (CSV or JSON) through `runtime.files.save` and `runtime.files.pick`.

## Users and passwords inside the app
Only when the admin asks (staff accounts, customer accounts, PIN lock):
- A `users` table with a random salt per user and a PBKDF2-SHA-256 hash (`crypto.subtle`, at least 100 000 iterations). Never store plain passwords.
- Keep the session in memory, or in `runtime.storage` if "stay logged in" is wanted. Add roles if asked.
- Explain once that this lock protects the app on this device; it is not an online account.

## Sharing between devices
Each install has its own database; Uforge has no server for app data. If the admin wants shared or online data, explain that it needs an online service they own (with `network` declared), then build the integration once they provide the details.
