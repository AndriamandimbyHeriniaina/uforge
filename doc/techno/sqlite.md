# Techno — SQLite (apps clientes)

Moteur des données **générées**, pas du gateway.

- Web : WASM (wa-sqlite) ou équivalent.
- Android : SQLite natif via le Runtime.

API unique `runtime.db.*`. Seed fichier dans le `.happ` ; overlay fichier hors paquet. Voir [data-seed-overlay.md](../features/data-seed-overlay.md).
