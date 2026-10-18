# Fonctionnalité — AI Gateway

Backend NestJS (`services/gateway`). Le Runtime ne parle **jamais** directement à OpenAI, Anthropic, etc. Le gateway est **sans état vis-à-vis des applis** : il ne stocke ni code, ni build, ni `.happ`, ni données.

## Responsabilités

- Comptes Uforge (email + mot de passe, JWT).
- Quotas et rate limit.
- Relire `skills/prompt/` à **chaque** tour.
- Construire le prompt : les skills (qui contiennent le protocole de réponse), puis le contexte envoyé par l’atelier.
- Streamer la réponse du provider, parser les opérations `uf-*`, les appliquer aux fichiers reçus et les valider.
- Tracer chaque tour (métadonnées, tokens, coût), mais **pas** le code.

## API

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `POST` | `/v1/auth/register` | Création du compte admin |
| `POST` | `/v1/auth/login` | JWT |
| `GET` | `/v1/me` | Profil + quota restant |
| `POST` | `/v1/ai/generate` | Un tour de conversation (SSE) |
| `GET` | `/v1/skills` | Skills chargées (rôle `ADMIN` plateforme) |
| `GET` | `/health` | Liveness |

`/v1/apps*` et `/v1/files` ont été retirés : le workspace vit sur l’appareil et les pièces jointes partent dans le tour.

## `POST /v1/ai/generate`

### Entrée

```json
{
  "appId": "uuid de l’appli (traces uniquement)",
  "message": "Ajoute un panier avec le total",
  "files": [{ "path": "src/main.js", "content": "…" }],
  "assets": [{ "path": "assets/logo.png", "mime": "image/png", "size": 48213 }],
  "attachments": [
    { "name": "vitrine.jpg", "kind": "image", "mime": "image/jpeg", "dataBase64": "…" },
    { "name": "stock.csv", "kind": "text", "mime": "text/csv", "content": "…" }
  ],
  "errors": [{ "source": "runtime", "message": "x is not a function", "stack": "…", "file": "src/cart.js", "line": 12 }],
  "conversation": [{ "role": "user", "text": "…" }, { "role": "assistant", "text": "…" }]
}
```

- `files` : tous les fichiers texte du workspace. Au-delà du budget du plan, l’atelier envoie l’arborescence complète et les fichiers les plus récemment modifiés.
- `assets` : les binaires sont **listés** et jamais envoyés (l’IA peut les référencer, pas les lire).
- `conversation` : les 20 derniers échanges au maximum.

### Sortie : `text/event-stream`

| Événement | Données |
| --- | --- |
| `meta` | `{ requestId, skills }` |
| `token` | `{ text }` : message pour l’admin (le texte hors balises) |
| `op` | `{ op: "write" \| "edit" \| "delete" \| "rename", path, phase: "start" \| "end" }` : pastilles |
| `done` | `{ requestId, status: "SUCCEEDED" \| "REFUSED" \| "FAILED", reply, changes, usage }` |
| `error` | `{ message }` |

`changes` : `[{ op: "write", path, content }, { op: "delete", path }]`. C’est le diff final du tour : chaque fichier écrit, édité ou renommé est renvoyé avec son **contenu complet** (un renommage devient une suppression plus une écriture). Le Runtime n’a rien à rejouer.

Les erreurs d’auth, de quota ou de taille sont du JSON HTTP, envoyé avant l’ouverture du flux. Pendant les longues phases de réflexion du modèle, le gateway envoie un commentaire SSE `: ping` toutes les 15 s pour que les proxys ne coupent pas la connexion.

## Protocole `uf-*`

Défini pour le modèle dans `skills/prompt/10-output-protocol.md`. Résumé de ce que le gateway doit parser :

| Balise | Effet |
| --- | --- |
| texte hors balise | événement `token` |
| `<uf-write path="…">contenu</uf-write>` | crée ou remplace le fichier |
| `<uf-edit path="…"><uf-search>…</uf-search><uf-replace>…</uf-replace>…</uf-edit>` | chaque `uf-search` doit apparaître **exactement une fois** dans le fichier courant ; les paires s’appliquent dans l’ordre |
| `<uf-delete path="…"/>` | supprime |
| `<uf-rename from="…" to="…"/>` | renomme |
| `<uf-refusal>…</uf-refusal>` | statut `REFUSED`, aucune opération |

Validation :
- Chemins relatifs, séparateur `/`, pas de `..`, pas de chemin absolu. Extensions texte autorisées : `html css js mjs ts tsx jsx json svg md txt csv`.
- Échec d’un `uf-edit` : **une** relance automatique dans la même requête (« ce bloc ne correspond pas, réécris le fichier complet avec uf-write »). Si elle échoue aussi, statut `FAILED` et aucune modification (le tour est atomique).
- `uforge.json` doit rester du JSON valide ; sinon, même traitement qu’un `uf-edit` en échec.

## Construction du prompt

1. **System** : le bloc des skills, dans l’ordre des priorités. **Aucune consigne de format codée en dur** dans `prompt.ts` : tout est dans les skills, pour que l’opérateur puisse ajuster sans rebuild.
2. **User** : arborescence, fichiers (chemin + contenu), liste des assets, pièces jointes (les images en entrée multimodale), erreurs, conversation, puis le message.

Le bloc stable (les skills) passe en premier, pour profiter du cache de prompt des providers.

## Providers

`AI_PROVIDER` = `anthropic` | `openai` | `stub`.

- Générer du code librement exige un **modèle fort en code**. Recommandé : `claude-sonnet-5-5`, ou `claude-opus-5-5` pour les gros projets. `gpt-4o-mini` ne suffit pas.
- Anthropic passe par le SDK officiel `@anthropic-ai/sdk`, en streaming. Variables :
  - `ANTHROPIC_MODEL` (défaut `claude-opus-5-5`) ;
  - `ANTHROPIC_MAX_TOKENS` (défaut 64 000 : l’IA écrit des fichiers complets) ;
  - `ANTHROPIC_EFFORT` (défaut `high`, vide pour ne pas l’envoyer) ;
  - `ANTHROPIC_FALLBACKS` (`default` : repli côté serveur en cas de refus ; `off` pour le désactiver).
- OpenAI (ou proxy compatible) : `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_MAX_TOKENS` facultatif.
- `stub` (sans clé) : renvoie un **petit projet réel** (un carnet de notes qui utilise `runtime.db`) au protocole `uf-*`. Il sert de test de bout en bout sans IA.

Les clés restent dans l’environnement du gateway : jamais dans un `.happ`, jamais dans le front.

## Quotas (`PlanQuota`)

- `dailyGenerations`, `dailyTokens`, `monthlyTokens`.
- `maxPromptChars` : le message de l’admin.
- `maxContextChars` : workspace + pièces jointes. À relever (≥ 400 000), car le workspace complet part à chaque tour.
- `maxFileBytes` : une pièce jointe.

Hors production, le quota est de 30 tours par jour (`effectiveDailyGenerations`).

## Traces (`Generation`)

`requestId`, `userId`, `appId` (sans clé étrangère), message de l’admin, `skillsApplied`, `skillsHash`, provider, modèle, tokens, coût, durée, statut, `changedPaths`. **Pas** le contenu des fichiers.

## V2

Boucle agent à outils (lire, chercher, écrire) au lieu des balises, pour les projets qui dépassent le budget de contexte.

## Développement

Code dans `services/gateway`, schéma Prisma. À chaque changement d’entité : `npx prisma migrate dev`. Tests du protocole : `npm test`. Taille maximale d’une requête : `GATEWAY_BODY_LIMIT` (défaut `40mb`).
