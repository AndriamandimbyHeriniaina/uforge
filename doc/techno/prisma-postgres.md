# Techno — Prisma et PostgreSQL

Source du schéma : `services/gateway/prisma/schema.prisma`. Migrations versionnées dans `prisma/migrations/`. Sous Compose, `prisma migrate deploy` tourne au démarrage du gateway.

## Ce que Postgres contient

Comptes Uforge, quotas, traces de génération. **Pas** de code d’appli, **pas** de `.happ`, **pas** de base d’appli.

| Entité | Rôle |
| --- | --- |
| `User`, `PlanQuota` | Compte et quotas. `maxContextChars` vaut 400 000 par défaut (workspace complet à chaque tour) |
| `Generation` | Trace d’un tour : message, skills, modèle, tokens, statut, `changedPaths`. `appId` en simple texte. Jamais le contenu des fichiers |
| `UsageRecord`, `AuditLog` | Consommation et audit |

`App`, `Draft`, `AppVersion`, `UploadedFile` (+ enums `AppStatus`, `FilePurpose`) ont été supprimées par la migration `20261018120000_stateless_gateway` : le workspace et les versions vivent sur l’appareil.

Après une modification du schéma : nouvelle migration, jamais de modification silencieuse en prod.
