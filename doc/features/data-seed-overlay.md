# Fonctionnalité — Seed et overlay SQLite

## Pourquoi SQLite

Fichier unique, requêtes réelles, portable dans le `.happ` comme **graine**, adapté au partage d’un catalogue ou de niveaux.

## Règle

Ne jamais écrire l’overlay **dans** le `.happ` à chaque save (signature, I/O, mises à jour destructrices).

| Couche | Lieu | Exemple |
| --- | --- | --- |
| Seed | Dans le `.happ` | Produits vitrine, maps du jeu |
| Overlay | `data/<appId>/` hors paquet | Ventes, scores, photos |
| Runtime mère | Store séparé | Liste d’apps, auth Builder |

JSON pour le statique ; SQLite pour le requêtable. Les deux peuvent être dans le seed.

Le gateway ne mixe pas ces bases avec Postgres (comptes Uforge uniquement).
