# Fonctionnalité — Données de l’appli

## Deux API, une base

| API | Pour | Stockage |
| --- | --- | --- |
| `runtime.db` | Données structurées : listes, fiches, ventes, rendez-vous, scores | Tables SQLite de l’appli |
| `runtime.storage` | Réglages, petit état (clé → JSON) | Table interne `_kv` de la même base |

Il y a **une seule base par appli** (`db.sqlite`), moteur sql.js côté hôte. L’appli n’accède jamais au fichier, seulement à `runtime.*`. Voir [sqlite.md](../techno/sqlite.md).

## Schéma et migrations

- L’appli déclare son schéma par `runtime.db.migrate([...])`, une liste **append-only** d’étapes. Le Runtime applique celles au-delà de `PRAGMA user_version`, en transaction ([device-bridge.md](device-bridge.md#runtimedbmigratesteps)).
- Les skills interdisent de modifier une étape passée et de supprimer des données sans demande explicite de l’admin.
- C’est ce qui permet de **modifier l’appli après Builder sans perdre les données** des utilisateurs.

## Données initiales

- C’est le **code de l’appli** qui les écrit, dans une étape de migration ou par un « si vide, insérer ». Il n’y a plus de fichier seed séparé.
- Le contenu que seul l’admin change par prompt (textes d’une vitrine, niveaux d’un jeu) vit dans le code ou dans des modules JSON, pas en base.
- Un export « sans mes données » part d’une base vide : l’appli recrée son schéma et ses données initiales au premier lancement.

## Base live et base d’aperçu

| Base | Utilisée par | Contenu | Stockage |
| --- | --- | --- | --- |
| Live | L’appli validée | Les vraies données | `happ.data` (`K_device`) |
| Aperçu | L’atelier | Selon le choix de l’admin (voir ci-dessous) | `happ.preview` (`K_admin`) |

- **« Vraies données »** (par défaut) : à chaque ouverture de l’atelier, l’aperçu repart d’une **copie fraîche** de la base live. Avant le premier Builder (pas encore de base live), l’aperçu garde sa propre base d’un passage à l’autre.
- **« Base vide »** : l’aperçu part d’une base vide, conservée d’un passage à l’autre.
- Builder **ne copie pas** la base d’aperçu dans la live. Au premier démarrage du nouveau build, la live reçoit seulement les migrations.
- La base d’aperçu n’est jamais exportée.

## Écriture et chiffrement

sql.js tourne en mémoire. Après une modification, la base est exportée en binaire, chiffrée en AES-GCM, puis écrite dans IndexedDB. L’écriture est **différée** (environ 500 ms après la dernière modification) et **forcée** au passage en arrière-plan (`visibilitychange`, Capacitor `appStateChange`).

## Photos et fichiers

- V1 : data URL compressée dans une colonne `TEXT` (`runtime.camera.capture({ maxWidth: 1280 })`), avec des vignettes pour les listes.
- V2 : un magasin de médias (`runtime.media`), pour éviter de gonfler la base.

## Limites

- Pas de synchronisation entre appareils : chaque installation a sa base.
- Une appli qui veut des données partagées en ligne passe par un service externe que l’admin fournit (capacité `network`).

## Export

« Avec mes données » : la base live (et `runtime.storage`) part dans `data.bin` du `.happ`. Voir [export-import.md](export-import.md).

## Remplace

L’ancien modèle (« seed SQL dans le `.happ` » + overlay `records(collection, id, json)` / `kv`). Aucune migration des overlays existants n’est prévue : c’étaient des données de prototype.
