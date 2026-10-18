# Techno — Docker Compose

Un fichier `docker-compose.yml` à la racine lance tout le socle local.

```bash
cp .env.example .env
docker compose up --build
```

- Réseau interne `hforge`.
- Volumes nommés : `pgdata`, `redisdata`, `compiler_cache` (paquets npm téléchargés par le compiler), `web_node_modules`.
- Bind mount `./skills/prompt` → lecture live des skills.
- Bind mount du code gateway, compiler et web pour le hot reload.
- Le compiler a besoin d’un **accès réseau sortant** (esm.sh) pour les applis qui déclarent des dépendances npm.
- Après un changement de dépendances du web, recréer le volume : `docker compose down && docker volume rm uforge_web_node_modules && docker compose up --build`.

Ne pas exposer Postgres ni Redis sur `0.0.0.0` en production. En local, Postgres est publié sur le port hôte **5433** (5432 est souvent déjà pris). Redis reste interne au réseau Compose.

Healthchecks : `postgres`, `redis`, `gateway` (`GET /health`). Compiler : `GET http://localhost:3001/health`.

Le navigateur parle au compiler via `VITE_COMPILER_URL=http://localhost:3001`, pas via `http://compiler:3001`.
