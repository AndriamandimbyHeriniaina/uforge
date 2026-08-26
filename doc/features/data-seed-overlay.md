# Fonctionnalité — Seed et overlay SQLite

## Pourquoi SQLite

Fichier unique, requêtes réelles, portable dans le `.happ` comme **graine**, adapté au partage d’un catalogue ou de niveaux.

## Règle

Ne jamais écrire l’overlay **dans** le `.happ` à chaque save (signature, I/O, mises à jour destructrices).

| Couche | Lieu | Exemple |
| --- | --- | --- |
| Seed | Dans le `.happ` (`seedSql`) | Produits vitrine, maps du jeu |
| Overlay | `data/<appId>/overlay.sqlite` (natif) ou IndexedDB (web) | Ventes, scores, photos |
| Runtime mère | Store séparé | Auth Builder, `.happ` chiffré |

JSON pour le statique ; SQLite pour le requêtable. Les deux peuvent être dans le seed.

Le compiler émet le SQL de graine. Le Runtime ouvre l’overlay, crée `records` / `kv`, applique le seed **seulement** si la base est vide, puis migre un éventuel overlay JSON historique.

Le gateway ne mixe pas ces bases avec Postgres (comptes Uforge uniquement).
