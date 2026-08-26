# Techno — MinIO

S3 compatible. Buckets :

- `hforge-context` — fichiers fournis au Builder (Excel, PDF, images).
- `hforge-artifacts` — `.happ` compilés.
- `hforge-seeds` — copies de seed si extraites du paquet.

Le gateway stocke `storageKey`, mime, taille dans `UploadedFile` / `AppVersion`. Jamais le binaire dans Postgres.
