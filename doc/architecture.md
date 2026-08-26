# Architecture de développement Uforge

## Intention

Uforge (*You Forge*) n’est pas un générateur de code livré tel quel, ni un gestionnaire de plusieurs applis. C’est **une app vide qui devient l’app de l’utilisateur** :

```text
Compte → Prompt → Aperçu → « Utiliser mon appli » (.happ)
  → l’écran Uforge disparaît, son appli s’affiche
  → 5 appuis dans le coin : modifier à nouveau
```

```text
Prompt utilisateur
  → AI Gateway (skills dépôt + quotas + providers)
  → source (workspace Builder)
  → Compiler (artefact minifié, externals Runtime)
  → .happ (bundle + seed + manifest signé)
  → Runtime (WebView + pont device + SQLite overlay)
```

L’utilisateur cible est non développeur. Les apps générées peuvent être du CRUD, une vitrine, un jeu HTML5, ou un hybride. Elles parlent au téléphone **uniquement** via le pont Runtime (`runtime.camera()`, `runtime.bluetooth()`, …).

## Décisions figées

| Sujet | Choix |
| --- | --- |
| Shell natif | Capacitor / WebView, pas React Native comme UI cliente |
| App cliente | JS léger (Vue 3 dans le Runtime, bundle dans le `.happ`) |
| Device APIs | Plugins **dans le Runtime**, déclarées dans le manifest `.happ` |
| Données | SQLite : **seed dans le `.happ`**, **overlay live hors paquet** |
| Compiler | Build de production ; le `.happ` ne contient pas Vite/TS/source |
| IA | Jamais d’appel direct provider depuis le device ; seulement le gateway |
| Skills utilisateur | Fichiers markdown dans `skills/prompt/`, relus **à chaque prompt** |
| Une app par Runtime | Pas de gestionnaire. Une `.happ`. L’UI Uforge disparaît après compile |
| Où vit le `.happ` | **Uniquement sur le device**. Le gateway ne le stocke jamais |
| Chiffrement `.happ` | AES-256-GCM. Clé = hash(email + mot de passe) : HMAC du mot de passe avec l’email, puis PBKDF2 (sel = email) |

## Monorepo

```text
uforge/
├── docker-compose.yml
├── doc/                    # docs + skills agent
├── skills/prompt/          # dépôt skills gateway (volume Docker)
├── services/
│   ├── gateway/            # backend NestJS (cœur métier + IA)
│   ├── compiler/           # build .happ
│   └── web/                # Runtime + Builder (Vue 3 / Vite)
└── .cursor/skills/         # skills Cursor pointant vers doc/
```

## Services Docker

Tous les services utiles au développement local sont dans **un seul** `docker-compose.yml`.

| Service | Rôle | Port hôte |
| --- | --- | --- |
| `postgres` | Entités gateway (users, apps, générations, quotas) | 5433 → 5432 |
| `redis` | Rate limit, cache session Builder | interne 6379 |
| `minio` | Fichiers contexte Builder (Excel, PDF, images) | 9000 / 9001 |
| `gateway` | API HTTP, auth, AI Gateway, lecture skills | 3000 |
| `compiler` | Bundler optionnel : renvoie un `.happ` au Runtime, **sans le persister** | 3001 |
| `web` | Builder + Runtime PWA (Vite) | 5173 |

Le Runtime mobile (Capacitor / APK) n’est pas un conteneur : il consomme `gateway` via l’hôte. Le `.happ` reste sur l’appareil.

## Flux génération

```text
Builder (web)
  POST /v1/ai/generate  { prompt, appId, draftId, fileIds }
        │
        ▼
Gateway
  1. Auth JWT + quota Redis/Postgres
  2. Lire TOUS les fichiers skills/prompt/*.md (à chaque requête)
  3. Charger spec courante + extraits fichiers MinIO
  4. Router le modèle (adapter provider)
  5. Persister Generation + UsageRecord
  6. Renvoyer spec (le draft reste au gateway ; pas le `.happ`)
        │
        ▼
Runtime (device)
  « Utiliser mon appli » → assembler et chiffrer le `.happ` (clé dérivée email + mot de passe)
  → stocker uniquement en local
        │
        ▼
Gateway (optionnel)
  Accuser réception d’un compile (quota / statut). **Aucun binaire `.happ`.**
```

## Entités (gateway)

Voir le schéma Prisma `services/gateway/prisma/schema.prisma` et [features/gateway.md](features/gateway.md).

Cœur : `User`, `PlanQuota`, `App`, `Draft`, `AppVersion`, `Generation`, `UsageRecord`, `UploadedFile`, `AuditLog`.

Les skills prompt **ne sont pas** une table obligatoire : le dépôt fichier est la source. Le gateway peut indexer checksum/nom pour l’audit.

## Isolation données Runtime (hors gateway)

Sur le device (et en PWA via IndexedDB/SQLite WASM) :

```text
Runtime (mère)     → petit store : auth Builder, **le .happ chiffré de cet appareil**
.app.happ          → enveloppe (email en clair) + AES-GCM(bundle, seed, spec)
data/<appId>/      → overlay.sqlite + fichiers utilisateur
```

Le gateway ne contient pas la base métier de l’app cliente, **ni le `.happ`**. Il contient le compte Uforge, les drafts Builder, les générations.

## Ordre de prototype

1. `docker compose up` : postgres, redis, minio, gateway, compiler stub, web stub.
2. Auth + `POST /v1/ai/generate` avec injection skills.
3. Runtime web : iframe sandbox + `runtime.*` + lecteur de spec.
4. Pont device (camera/files) derrière le manifest.
5. Compiler réel + seed/overlay.
6. Capacitor Android.
