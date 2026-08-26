# Techno — MinIO

S3 compatible. Bucket :

- `hforge-context` — fichiers fournis au Builder (Excel, PDF, images).

Pas de bucket d’artefacts : le `.happ` n’est **pas** stocké sur MinIO ni sur le gateway.

Le gateway stocke `storageKey`, mime, taille dans `UploadedFile` pour le contexte Builder uniquement. Jamais le binaire dans Postgres.
