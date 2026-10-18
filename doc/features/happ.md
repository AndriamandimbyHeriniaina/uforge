# Fonctionnalité — Format `.happ`

Un fichier `.happ` contient **une appli complète**, prête à installer. C’est une archive ZIP : les blocs déjà chiffrés y sont stockés sans compression.

## Contenu

```text
ma-boutique.happ
├── header.json   en clair
├── app.bin       AES-GCM(K_share) : build production (document HTML autonome) + manifest
├── data.bin      AES-GCM(K_share) : base SQLite (avec runtime.storage)   — absent si « sans mes données »
└── admin.bin     AES-GCM(K_admin) : workspace                              — absent si « appli figée »
```

## `header.json`

```json
{
  "format": 1,
  "runtimeMin": "1.0.0",
  "appId": "7b0c…",
  "name": "Ma boutique",
  "icon": "data:image/svg+xml;base64,…",
  "owner": "admin@exemple.fr",
  "version": 12,
  "exportedAt": "2026-10-18T10:00:00Z",
  "options": { "frozen": false, "withData": true },
  "capabilities": ["camera", "network"],
  "crypto": {
    "shareKey": "base64",
    "admin": { "kdf": "PBKDF2-SHA-256", "iterations": 600000, "salt": "base64", "iv": "base64", "keyWrap": "base64" }
  },
  "blocks": {
    "app": { "iv": "base64", "sha256": "hex", "size": 412345 },
    "data": { "iv": "base64", "sha256": "hex", "size": 98304 },
    "admin": { "iv": "base64", "sha256": "hex", "size": 1203344 }
  }
}
```

- `version` est le numéro de la version validée (Builder) exportée.
- `icon` fait 64 Ko au maximum.
- `crypto.admin` et `blocks.admin` sont absents si l’appli est figée ; `blocks.data` est absent si l’export est « sans mes données ».

## Bloc admin

- Workspace : fichiers texte et assets binaires (les images jointes « à utiliser dans l’appli » y sont).
- Versions : instantanés dédupliqués par hash (50 au maximum).
- Conversation (200 derniers échanges).
- Réglages de l’atelier.

La base d’aperçu (`happ.preview`) et les pièces jointes « pour référence » ne sont pas exportées.

## Sur l’appareil

Le découpage est le même (`happ.header`, `happ.app`, `happ.data`, `happ.admin`, plus `happ.preview`), mais le build et la base sont chiffrés par `K_device` au lieu de `K_share`. Code : `services/web/src/core/happFile.ts`. Voir [runtime.md](runtime.md#stockage-sur-lappareil).

## Jamais dans un `.happ`

Mot de passe, KEK, `K_admin` en clair, JWT, clés des providers IA, `node_modules`, sourcemaps de production.

## Le gateway

Il ne reçoit, ne stocke et ne relaie **jamais** un `.happ`. Le fichier circule de personne à personne.

Voir aussi [encryption.md](encryption.md) et [export-import.md](export-import.md).
