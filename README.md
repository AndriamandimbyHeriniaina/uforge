# Uforge

**You Forge** — plateforme Runtime + Builder IA + gateway.

L’application (Builder) est le service Compose `web` : code dans [`services/web`](services/web), URL **http://localhost:5173**.

Documentation : [`doc/`](doc/architecture.md).

## Démarrer

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Builder web | http://localhost:5173 |
| Gateway API | http://localhost:3000/health |
| Compiler | http://localhost:3001/health |
| MinIO console | http://localhost:9001 |
| Postgres (debug) | localhost:5433 |

Compte admin bootstrap : email `BOOTSTRAP_ADMIN_EMAIL` (défaut `admin@hforge.local`), mot de passe au moins 8 caractères à l’inscription.

IA : dans `.env`, `AI_PROVIDER=openai` (ou `anthropic`) et la clé. Sans clé, `stub`.

## Android (Capacitor)

Le Runtime natif n’est pas un conteneur. Après `docker compose up` pour le gateway :

```bash
cd services/web
npm install
npm run cap:sync
npx cap open android
```

Détail : [`doc/techno/capacitor.md`](doc/techno/capacitor.md).

## Skills prompt (cadrage utilisateurs)

Dépose des markdown dans [`skills/prompt/`](skills/prompt/). Relus **à chaque** génération, sans rebuild. Voir [`doc/features/prompt-skills.md`](doc/features/prompt-skills.md).

## Docs = skills agent

- Fonctionnalités : `doc/features/`
- Technos : `doc/techno/`
- Skills Cursor : `.cursor/skills/`
