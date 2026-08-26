# Techno — SQLite (apps clientes)

Moteur des données **générées**, pas du gateway.

- Web / PWA : `sql.js` (WASM) + IndexedDB (`uforge-sqlite`).
- Android : même moteur WASM dans la WebView, plus une copie fichier `data/<appId>/overlay.sqlite` via `@capacitor/filesystem`.

API unique `runtime.db.*` / `runtime.storage.*`. Seed SQL dans le `.happ` ; overlay **hors** paquet. Voir [data-seed-overlay.md](../features/data-seed-overlay.md).

Tables overlay : `records(collection, id, json)` et `kv(key, json)`. Le seed n’est appliqué que si l’overlay est vide. Les anciens overlays JSON `uforge-overlay:<appId>` sont migrés une fois.
