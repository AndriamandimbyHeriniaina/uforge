# Fonctionnalité — Fichiers contexte Builder

`POST /v1/files` (multipart `file`) envoie un Excel/PDF/image vers MinIO (`hforge-context`). Métadonnées dans `UploadedFile`.

Ces fichiers servent de contexte à la génération. Ils n’entrent dans le `.happ` que s’ils deviennent des assets compilés.

Limite : `PlanQuota.maxFileBytes` (à brancher sur Multer). Aujourd’hui plafond dur 10 Mo dans `FilesController`.
