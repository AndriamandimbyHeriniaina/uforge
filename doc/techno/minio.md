# Techno — MinIO

**Retiré** le 2026-10-18 (service Compose, `StorageModule`, `POST /v1/files`, table `UploadedFile`, variables `MINIO_*`).

Le gateway est sans état vis-à-vis des applis ([architecture.md](../architecture.md)). Les pièces jointes partent dans le tour de conversation et vivent dans le bloc admin, sur l’appareil ([attachments.md](../features/attachments.md)). Le `.happ` n’est jamais stocké côté serveur.

L’ancien volume Docker `uforge_miniodata` peut être supprimé : `docker volume rm uforge_miniodata`.
