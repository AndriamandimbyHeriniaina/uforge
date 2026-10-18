# Fonctionnalité — Pont `runtime.*`

L’appli générée n’a ni l’OS ni la page hôte. Elle a `window.runtime`, injecté par le Runtime avant son code. Tous les appels sont asynchrones : `postMessage` → hôte → plugin web ou Capacitor.

> **Contrat avec l’IA.** `skills/prompt/30-runtime-api.md` décrit cette API au modèle. Les deux pages doivent rester identiques. Les méthodes V2 sont présentées au modèle comme « à vérifier avec `has()` » : elles rejettent avec `unavailable` tant qu’elles ne sont pas implémentées.

## Capacités

Elles sont déclarées dans `uforge.json` → `capabilities`.
- Un appel à une capacité non déclarée est rejeté avec `{ code: "permission" }`.
- Une capacité indisponible sur la plateforme donne `runtime.capabilities.has(x) === false`.
- Sans déclaration, l’appli a accès à `storage`, `db`, `files`, `share`, `browser` et `device`.

| Capacité | Rôle | Statut |
| --- | --- | --- |
| `camera` | Photo | ✅ |
| `network` | Internet (`fetch`, WebSocket, `runtime.http`). Sans elle, la CSP bloque tout réseau | ✅ |
| `geolocation` | Position | V2 (`has()` renvoie `false`) |
| `notifications` | Notifications locales | V2 |
| `haptics` | Vibration | V2 |
| `bluetooth` | BLE | V2 (pas dans les skills) |

## API

Les erreurs rejettent avec un `Error` qui porte `code` et `message`, où `code` vaut `permission`, `unavailable`, `cancelled` ou `invalid`.

| Appel | Retour | Statut |
| --- | --- | --- |
| `runtime.app` | `{ id, name, version, mode: "preview" \| "live" }` (synchrone) | ✅ |
| `runtime.capabilities.has(name)` | `boolean` | ✅ |
| `runtime.storage.get(key)` / `set(key, value)` / `remove(key)` / `keys()` | valeur JSON / — / — / `string[]` | ✅ |
| `runtime.db.migrate(steps)` | version du schéma | ✅ |
| `runtime.db.query(sql, params?)` | lignes (objets) | ✅ |
| `runtime.db.exec(sql, params?)` | `{ changes, lastInsertId }` | ✅ |
| `runtime.db.batch([{ sql, params }])` | une transaction | ✅ |
| `runtime.camera.capture({ maxWidth?, quality? })` | `{ dataUrl, mime, width, height }` ou `null` | ✅ (JPEG redimensionné) |
| `runtime.files.pick({ accept?, multiple? })` | `[{ name, mime, size, dataUrl }]` (20 Mo max par fichier) | ✅ |
| `runtime.files.save({ name, mime, data })` | `boolean` | ✅ (web : téléchargement ; Android : fichier + feuille de partage) |
| `runtime.share.send({ title?, text?, url? })` | `boolean` | ✅ (web sans Web Share : copie dans le presse-papiers) |
| `runtime.browser.open(url)` | — | ✅ `https`, `tel:`, `mailto:`, `sms:`, `geo:`, `whatsapp:` |
| `runtime.device.info()` | `{ platform, online, language }` | ✅ |
| `runtime.http.request({ url, method?, headers?, body? })` | `{ status, headers, body }` | ✅ exige `network`. Android : HTTP natif, **sans** contrainte CORS. Web : passe par la page hôte, donc **soumis au CORS** |
| `runtime.geo.position()` | `{ lat, lng, accuracy }` | V2 |
| `runtime.notify.schedule({ at, title, body })` | `id` | V2 |
| `runtime.haptics.impact()` | — | V2 |

### `runtime.db.migrate(steps)`

- `steps` : tableau **append-only** de chaînes SQL, ou de tableaux de chaînes pour une étape à plusieurs requêtes.
- Le Runtime lit `PRAGMA user_version`, applique les étapes d’index ≥ version, chacune dans une transaction, puis met à jour `user_version`.
- Il est idempotent : il peut être appelé à chaque démarrage.
- Les noms de table commençant par `_` sont réservés au Runtime (`_kv`…) et refusés avec `invalid`.

### Shim `localStorage`

Le bootstrap précharge `runtime.storage` (préfixe `ls:`) et expose un objet `localStorage` synchrone, dont les écritures sont propagées en asynchrone. Il sert aux **librairies tierces** qui l’utilisent. Les skills demandent quand même au code généré d’utiliser `runtime.storage`.

## Implémentation

| Plateforme | Moyens |
| --- | --- |
| Web | `input type=file` côté hôte (caméra, fichiers), Web Share, téléchargement par lien, `fetch` côté hôte |
| Android | Capacitor : Camera, Filesystem, Share, Browser, App, CapacitorHttp (pas encore testé sur appareil) |

Le `.happ` ne contient jamais de Kotlin ni de Swift. Les plugins sont compilés **dans** le Runtime.

Le scan ou le contrôle du Wi-Fi est bridé par Android et iOS : ne pas le promettre.

## Code

`services/web/src/runtime/` : `guest.ts` (bootstrap injecté, CSP, localisation des erreurs), `bridge.ts` (routage et contrôle des capacités), `database.ts` (SQLite), `native.ts` (fonctions de l’appareil). Le pont vérifie la source du message (l’iframe), un canal aléatoire par chargement, la méthode et la capacité déclarée.
