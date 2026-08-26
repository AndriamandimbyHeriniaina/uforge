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
| `POST` | `/v1/apps/current/reset` | Vide le draft Builder (compte intact) |
| `POST` | `/v1/apps` | Créer une app (draft vide) |
| `POST` | `/v1/ai/generate` | Génération cadrée par les skills (**SSE** : `token` puis `done`) |
| `GET` | `/v1/skills` | Liste des skills déposées (admin) |
| `POST` | `/v1/files` | Upload contexte Builder → MinIO |
| `GET` | `/health` | Liveness |

## Generate — contrat

Entrée : `prompt`, `appId?`, `draftId?`, `fileIds[]`.

Sortie : flux SSE `text/event-stream` — événements `meta`, `token` (texte utilisateur), `done` (`requestId`, `status`, `spec`, `reply`). Erreurs quota/auth restent du JSON HTTP avant le flux.

Le premier champ JSON du modèle doit être `reply`, pour que la bulle s’affiche pendant que la spec arrive.

La spec peut porter `pages[].fields`, `actions`, `items`, `game.source` (JS canvas jouable), et `seed`. Le gateway les normalise ; le Runtime les rend. Un type `game`/`canvas` n’est plus recalé sur le jouet « tape le point », sauf si `kind` vaut explicitement `catch` ou `tap`.

Les clés providers restent dans les variables d’environnement du service `gateway`. Jamais dans le `.happ` ni le frontend.

## Providers

`AI_PROVIDER` = `openai` | `anthropic` | `stub`.

- `OPENAI_API_KEY`, optionnel `OPENAI_BASE_URL` (proxy compatible), `OPENAI_MODEL` (défaut `gpt-4o-mini`).
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
- Sans clé, le gateway retombe sur le stub (mots-clés), pour que `docker compose` tourne quand même.


## Développement

Code : `services/gateway`. Schéma : Prisma. Au changement d’entité : `npx prisma migrate dev` dans le conteneur ou en local contre Postgres Compose.

Hors production (`NODE_ENV` ≠ `production`, Compose inclus), le quota journalier de génération est porté à **30** (le plan FREE reste à 5 en prod). Le compteur Redis du jour n’est pas réinitialisé.
