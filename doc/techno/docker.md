# Techno — Docker Compose

Un fichier `docker-compose.yml` à la racine lance tout le socle cloud local.

```bash
cp .env.example .env
docker compose up --build
```

- Réseau interne `hforge`.
- Volumes nommés pour Postgres, Redis, MinIO.
- Bind mount `./skills/prompt` → lecture live des skills.
- Bind mount du code gateway en cible `development` pour le hot reload.

Ne pas exposer Postgres/Redis sur `0.0.0.0` en production. En local, Postgres est publié sur le port hôte **5433** (5432 est souvent déjà occupé). Redis reste interne au réseau Compose.

Healthchecks : `postgres`, `redis`, `gateway` (`GET /health`). Compiler : `GET http://localhost:3001/health`.

Le navigateur parle au compiler via `VITE_COMPILER_URL=http://localhost:3001` (pas `http://compiler:3001`).
