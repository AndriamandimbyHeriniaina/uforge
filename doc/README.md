# Documentation Uforge

Ce dossier est la **source de vérité** de l’architecture de développement.

- `architecture.md` — vue d’ensemble, services, flux, décisions figées.
- `features/` — une page par fonctionnalité produit.
- `techno/` — une page par technologie du socle.

Les mêmes contenus servent de **skills Cursor** (`.cursor/skills/`) : l’agent doit ouvrir la page `doc/` correspondante avant de modifier le code.

Les skills injectées dans les prompts utilisateurs (cadrage IA) ne sont **pas** ici. Elles vivent dans `skills/prompt/` et sont lues par le gateway à chaque génération. Voir [features/prompt-skills.md](features/prompt-skills.md).
