# Fonctionnalité — AI Gateway

Backend propriétaire. Le Runtime et le Builder ne parlent **jamais** à OpenAI, Anthropic, etc.

## Responsabilités

- Authentifier l’utilisateur Uforge (pas le mot de passe de l’app générée).
- Appliquer quotas et rate limit.
- Lire le dépôt `skills/prompt/` à **chaque** prompt.
- Assembler le contexte (spec, fichiers, skills).
- Router vers un provider via adaptateur.
- Tracer tokens / coût (`UsageRecord`).
- Stocker drafts Builder et traces de génération.
- **Ne jamais stocker le `.happ`** : il reste sur le device.

## API minimale

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `POST` | `/v1/auth/register` | Création compte |
| `POST` | `/v1/auth/login` | JWT |
| `GET` | `/v1/me` | Profil + quota restant |
| `GET` | `/v1/apps` | Apps de l’utilisateur |
| `GET` | `/v1/apps/current` | App unique de ce Runtime |
| `POST` | `/v1/apps/current/compile` | Accusé de compile (pas de binaire `.happ`) |
| `POST` | `/v1/apps` | Créer une app (draft vide) |
| `POST` | `/v1/ai/generate` | Génération cadrée par les skills |
| `GET` | `/v1/skills` | Liste des skills déposées (admin) |
| `POST` | `/v1/files` | Upload contexte Builder → MinIO |
| `GET` | `/health` | Liveness |

## Generate — contrat

Entrée : `prompt`, `appId?`, `draftId?`, `fileIds[]`.

Sortie : `requestId`, `status`, `skillsApplied[]`, `spec` (JSON), `refusal?`.

Les clés providers restent dans les variables d’environnement du service `gateway`. Jamais dans le `.happ` ni le frontend.

## Développement

Code : `services/gateway`. Schéma : Prisma. Au changement d’entité : `npx prisma migrate dev` dans le conteneur ou en local contre Postgres Compose.
