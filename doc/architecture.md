# Architecture de développement Uforge

Lire d’abord [vision.md](vision.md). Cette page décrit **comment** on réalise la vision.

## Vue d’ensemble

```text
Runtime  (services/web : PWA + APK Capacitor)
 ├─ Atelier (Vue 3) ──── POST /v1/ai/generate (SSE) ──► Gateway (NestJS) ──► provider IA
 │     │                                                  skills/prompt/*.md relues à chaque tour
 │     └──────────────── POST /v1/build ───────────────► Compiler (esbuild, sans état)
 ├─ Iframe sandbox ◄─── document HTML buildé + bootstrap runtime.* + CSP
 │     └─ runtime.* (postMessage) ──► pont hôte ──► plugins web / Capacitor
 └─ Stockage local chiffré : workspace (bloc admin), build validé, base SQLite
```

L’IA **écrit des fichiers** (HTML, CSS, JS/TS, JSON, SVG). Le compiler en fait un document autonome. Le Runtime l’affiche dans une iframe isolée et lui donne l’appareil via `runtime.*`.

## Décisions figées

| Sujet | Choix |
| --- | --- |
| Produit | Une appli vide qui devient l’appli de l’admin. Une seule appli par installation. |
| Génération | L’IA produit du **code** (fichiers du workspace), par opérations `uf-*` en streaming. Jamais de spec à types de pages. |
| Cadrage IA | Fichiers markdown `skills/prompt/`, relus à **chaque** tour. Le protocole de réponse y vit aussi. |
| IA | Jamais d’appel provider depuis l’appareil : tout passe par le gateway. |
| Source de vérité de l’appli | **L’appareil.** Le workspace vit chiffré dans le bloc admin. Le gateway est sans état vis-à-vis des applis. |
| Gateway | Comptes, quotas, skills, appel IA, application des opérations, traces. Ne stocke ni code, ni build, ni `.happ`, ni données. |
| Compiler | esbuild, sans état. Deux modes : `preview` et `production`. Dépendances npm embarquées, donc l’appli marche hors ligne. |
| Exécution | iframe `srcdoc`, `sandbox="allow-scripts allow-forms allow-modals"`, origine opaque, CSP selon les capacités. |
| Accès appareil | Uniquement `runtime.*`, avec des capacités déclarées dans `uforge.json`. Plugins Capacitor dans le Runtime. |
| Données | Une base SQLite par appli, avec schéma par migrations (`runtime.db.migrate`). Chiffrée au repos. |
| Chiffrement | `K_admin` (bloc admin) enveloppée par le mot de passe ; `K_device` (build et base sur l’appareil) ; `K_share` (export). Voir [encryption.md](features/encryption.md). |
| Accès atelier | Bulle → mot de passe admin, qui déchiffre le bloc admin et ouvre une session JWT au gateway. |
| Partage | Fichier `.happ` exporté et importé à la main. Options « sans mes données » et « appli figée ». |
| Shell natif | Capacitor (WebView). Pas de React Native, pas de code natif généré. |

## Monorepo

```text
uforge/
├── docker-compose.yml
├── doc/                    # vision, architecture, features, technos (FR)
├── skills/prompt/          # skills de l’IA de génération (volume Docker, relues à chaque tour)
├── services/
│   ├── gateway/            # NestJS : comptes, quotas, IA, protocole uf-*
│   ├── compiler/           # esbuild : workspace → document HTML autonome
│   └── web/                # Runtime : atelier + iframe + pont + stockage (Vue 3 / Vite / Capacitor)
└── .cursor/                # règles et skills des agents de développement → doc/
```

## Services Docker

| Service | Rôle | Port hôte |
| --- | --- | --- |
| `postgres` | Comptes, quotas, traces de génération | 5433 → 5432 |
| `redis` | Rate limit, compteurs de quota | interne 6379 |
| `gateway` | API HTTP, auth, IA, skills | 3000 |
| `compiler` | Build `preview` et `production`, cache npm | 3001 |
| `web` | Runtime (Vite dev server) | 5173 |

MinIO a été retiré (voir [minio.md](techno/minio.md)).

L’APK Android n’est pas un conteneur : il appelle `gateway` et `compiler` via l’hôte.

## Flux

### Premier lancement

```text
Runtime vierge → accueil : « Créer mon compte » · « Me connecter » · « Importer un .happ »
  → register/login (gateway, en ligne)
  → K_admin générée, enveloppée par la KEK (mot de passe) → bloc admin vide + gabarit de projet
  → mode atelier
```

### Un tour de conversation

```text
Atelier
  1. Contexte : arborescence + fichiers texte, liste des assets, pièces jointes,
     erreurs d’aperçu ou de build, derniers échanges, message de l’admin
  2. POST /v1/ai/generate (JWT)  ─────────────────────────────►  Gateway
                                                                  3. auth, quota, taille
                                                                  4. relit skills/prompt/*.md
                                                                  5. appelle le provider (stream)
     ◄── SSE token (texte) / op (pastilles fichiers) ──────────   6. parse : texte → token ; uf-* → op
                                                                  7. applique les opérations aux fichiers reçus,
                                                                     valide les uf-edit (1 relance si échec)
     ◄── SSE done { changes: fichiers complets } ───────────────  8. trace Generation (sans le code)
  9. Nouvelle version du workspace (chiffrée K_admin)
 10. POST /v1/build { mode: preview } → iframe
 11. Erreurs d’exécution ou de build → bouton « Corriger » (nouveau tour)
```

### Builder (valider)

```text
Atelier « Builder »
  → POST /v1/build { mode: production }
  → build chiffré par K_device → happ.app ; en-tête mis à jour (version, nom, capacités)
  → la base live est conservée ; le nouveau code applique ses migrations au démarrage
  → session admin fermée (JWT, mot de passe, K_admin effacés de la RAM)
  → mode appli : plein écran + bulle
```

### Revenir à l’atelier

```text
Bulle → mot de passe → KEK → déchiffre K_admin → bloc admin  (preuve locale)
                     → login gateway → JWT                    (pour prompter)
```

Hors ligne, seule la preuve locale passe : l’atelier s’ouvre sans prompt (versions, export).

### Export et import

Voir [export-import.md](features/export-import.md) et le format dans [happ.md](features/happ.md).

## Stockage sur l’appareil

Le détail est dans [runtime.md](features/runtime.md#stockage-sur-lappareil). En résumé :

```text
IndexedDB « uforge »
  device.key    K_device (CryptoKey non extractible)
  happ.header   en-tête de l’appli installée                    en clair
  happ.app      build validé                                     K_device
  happ.data     base live (SQLite) + runtime.storage             K_device
  happ.admin    workspace, versions, conversation                K_admin
  happ.preview  base d’aperçu                                    K_admin
localStorage    position de la bulle (préférence d’affichage)   en clair
```

## Ce que le gateway stocke

| Stocke | Ne stocke jamais |
| --- | --- |
| `User`, `PlanQuota`, `Generation` (métadonnées, tokens, statut, chemins modifiés), `UsageRecord`, `AuditLog` | Code source, build, `.happ`, base de l’appli, pièces jointes, mot de passe en clair |

## État du code (octobre 2026)

La reconstruction du 2026-10-18 suit cette page. Ce qui est en place et testé :

| Brique | Code | Tests |
| --- | --- | --- |
| Gateway : contrat `generate`, protocole `uf-*`, application atomique des opérations, une relance, SSE `meta`/`token`/`op`/`done`, adaptateurs Anthropic (SDK officiel), OpenAI, stub | `services/gateway/src/ai/` | `npm test` (protocole, workspace, stub) |
| Prisma sans état : `App`, `Draft`, `AppVersion`, `UploadedFile` supprimées | migration `20261018120000_stateless_gateway` | appliquée sous Compose |
| Compiler : `POST /v1/build`, npm via esm.sh embarqué, assets inlinés, `preview` / `production` | `services/compiler/src/` | `npm test` (dont un build Preact + JSX réel) |
| Runtime : modes, bulle, atelier (conversation, pastilles, aperçu, erreurs + « Corriger », versions, pièces jointes), Builder, `runtime.*` V1, CSP, chiffrement, export/import | `services/web/src/` | `vue-tsc`, parcours navigateur complet (création → tour → Builder → export → import figé/complet) |
| Android : plugins App et Browser, ouverture des `.happ` | `services/web/android/` | `cap sync` ; pas encore testé sur appareil |

## Reste à faire

1. **Valider les skills avec un vrai modèle** : les tests utilisent le stub. Il faut quelques tours réels (jeu, gestion, vitrine) pour ajuster `skills/prompt/`.
2. **Web hors ligne** : service worker (PWA installable).
3. **Android sur appareil** : build APK, caméra, partage, ouverture d’un `.happ` reçu.
4. **Pièces jointes** : conversion Excel → CSV (aujourd’hui l’atelier demande un CSV), PDF.
5. **Quotas** : `dailyTokens` / `monthlyTokens` ne sont pas encore appliqués.

V2 : signature des exports, code de partage, changement de mot de passe, Android Keystore, boucle agent à outils, `runtime.geo` / `notify` / `haptics`, aperçu hors ligne (esbuild-wasm), magasin de médias.
