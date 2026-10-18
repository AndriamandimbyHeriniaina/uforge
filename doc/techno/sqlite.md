# Techno — SQLite (applis générées)

C’est le moteur des données **des applis générées**, pas du gateway. Le fonctionnel est décrit dans [data.md](../features/data.md).

- Moteur : `sql.js` (WASM), chargé **côté hôte**, jamais dans l’iframe. Le même moteur sert sur le web et dans la WebView Android.
- Une base par appli. `runtime.storage` vit dans la table interne `_kv(key TEXT PRIMARY KEY, json TEXT)`. Les tables préfixées `_` sont réservées au Runtime et refusées par `runtime.db`.
- API exposée : `runtime.db.query`, `exec`, `batch`, `migrate` ([device-bridge.md](../features/device-bridge.md)). Requêtes paramétrées seulement.
- Migrations : `PRAGMA user_version`, chaque étape dans une transaction.
- Persistance : export binaire → AES-GCM (`K_device` pour la live, `K_admin` pour la base d’aperçu) → IndexedDB. L’écriture est différée (environ 500 ms) et forcée au passage en arrière-plan.
- Limites : la base est entièrement en mémoire, viser moins de 50 Mo. Au-delà (beaucoup de photos), V2 : magasin de médias séparé.

## Remplace

Les tables `records(collection, id, json)` et `kv` de l’ancien overlay, le seed SQL dans le `.happ`, et la copie `data/<appId>/overlay.sqlite`.
