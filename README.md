# Uforge

**You Forge** — une appli vide qui devient l’appli que tu décris.

Tu installes Uforge (web ou Android), tu crées ton compte admin, puis tu décris ton appli à l’IA et tu l’ajustes en conversation, comme avec Claude Code ou Lovable : jeu, gestion, vitrine… tout ce que le JavaScript permet. Quand elle te plaît, tu cliques **Builder** : elle devient ton appli, et l’atelier se cache derrière une bulle protégée par ton mot de passe. Tu peux l’**exporter** en `.happ` pour que d’autres l’installent.

- Vision produit : [`doc/vision.md`](doc/vision.md), à lire en premier.
- Architecture : [`doc/architecture.md`](doc/architecture.md).

> Le code a été reconstruit sur cette vision le 2026-10-18. Ce qui est fait, testé et reste à faire : [`doc/architecture.md`](doc/architecture.md#état-du-code-octobre-2026).

## Démarrer

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Runtime web | http://localhost:5173 |
| Gateway API | http://localhost:3000/health |
| Compiler | http://localhost:3001/health |
| Postgres (debug) | localhost:5433 |

Compte opérateur de la plateforme (rôle `ADMIN`) : email `BOOTSTRAP_ADMIN_EMAIL` (défaut `admin@hforge.local`), mot de passe d’au moins 8 caractères à l’inscription.

IA : dans `.env`, `AI_PROVIDER=anthropic` (ou `openai`), la clé et `ANTHROPIC_MODEL`. Il faut un modèle fort en code pour générer des applis libres (voir [`doc/features/gateway.md`](doc/features/gateway.md#providers)). Avec `AI_PROVIDER=stub`, le gateway répond sans IA par un petit carnet de notes : pratique pour tester tout le parcours gratuitement.

## Tests

```bash
cd services/gateway && npm test     # protocole uf-*, application des opérations, stub
cd services/compiler && npm test    # builds (dont Preact + JSX via esm.sh ; OFFLINE=1 pour le sauter)
cd services/web && npm run build    # vue-tsc + vite build
```

## Android (Capacitor)

Le Runtime natif n’est pas un conteneur. Après `docker compose up` pour le gateway :

```bash
cd services/web
npm install
npm run cap:sync
npx cap open android
```

Détail : [`doc/techno/capacitor.md`](doc/techno/capacitor.md).

## Skills de l’IA de génération

Les markdown de [`skills/prompt/`](skills/prompt/) cadrent l’IA qui écrit les applis. Ils sont relus **à chaque** tour, sans rebuild. Voir [`doc/features/prompt-skills.md`](doc/features/prompt-skills.md).

## Docs = skills des agents de développement

- Vision et architecture : `doc/vision.md`, `doc/architecture.md`
- Fonctionnalités : `doc/features/`
- Technos : `doc/techno/`
- Règles et skills Cursor : `.cursor/rules/`, `.cursor/skills/`
