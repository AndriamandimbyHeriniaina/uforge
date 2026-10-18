# Documentation Uforge

Ce dossier est la **source de vérité** du produit et de l’architecture de développement.

1. [`vision.md`](vision.md) : le produit, le parcours, les décisions. **À lire en premier.** Elle gagne en cas de conflit.
2. [`architecture.md`](architecture.md) : services, flux, stockage, état du code et ordre de chantier.
3. `features/` : une page par fonctionnalité.
4. `techno/` : une page par technologie du socle.

## Fonctionnalités

| Page | Sujet |
| --- | --- |
| [auth.md](features/auth.md) | Compte admin, ouverture de l’atelier, destinataire |
| [builder.md](features/builder.md) | Atelier : conversation, aperçu, erreurs, versions, Builder |
| [attachments.md](features/attachments.md) | Pièces jointes de l’atelier |
| [gateway.md](features/gateway.md) | AI Gateway, contrat `generate`, protocole `uf-*` |
| [prompt-skills.md](features/prompt-skills.md) | Dépôt des skills de l’IA de génération |
| [compiler.md](features/compiler.md) | Build `preview` / `production` |
| [runtime.md](features/runtime.md) | Modes, bulle, iframe, CSP, stockage local |
| [device-bridge.md](features/device-bridge.md) | API `runtime.*` et statut d’implémentation |
| [data.md](features/data.md) | Base SQLite de l’appli, migrations, base d’aperçu |
| [encryption.md](features/encryption.md) | Clés et chiffrement |
| [happ.md](features/happ.md) | Format du fichier `.happ` |
| [export-import.md](features/export-import.md) | Exporter, importer, appli figée |
| [reset-app.md](features/reset-app.md) | Réinitialiser |

## Docs et skills

- Les pages `doc/` cadrent les **développeurs**. Les mêmes contenus servent de skills Cursor (`.cursor/skills/`) : l’agent ouvre la page correspondante avant de modifier le code.
- Les skills de l’**IA de génération** (celle qui écrit les applis des admins) ne sont pas ici. Elles vivent dans `skills/prompt/` et sont relues par le gateway à chaque tour. Voir [features/prompt-skills.md](features/prompt-skills.md).
