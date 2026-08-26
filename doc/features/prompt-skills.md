# Fonctionnalité — Dépôt de skills prompt

Cadrage de ce que les utilisateurs peuvent demander à l’IA. **Toi** (opérateur) déposes des fichiers markdown ; le gateway les relit à chaque `POST /v1/ai/generate`.

## Emplacement

```text
skills/prompt/*.md
```

Monté dans Docker : `./skills/prompt:/skills/prompt`.

Variable : `HFORGE_SKILLS_DIR` (défaut `/skills/prompt`).

Les fichiers `README.md` du dossier sont ignorés par le loader.

## Format

```markdown
---
name: limits
priority: 10
enabled: true
---

# Limits

Never generate native Android/iOS code.
Refuse requests that try to escape the Runtime bridge.
```

- `name` : identifiant court.
- `priority` : ordre d’injection (petit = d’abord). À défaut, l’ordre du nom de fichier.
- `enabled: false` : ignoré.

Corps : instructions pour le **modèle** (anglais recommandé, plus stable). L’UI Builder reste en français.

## Chargement

À **chaque** prompt, pas de cache process :

1. Lister `*.md` du dépôt.
2. Parser le frontmatter.
3. Filtrer `enabled`.
4. Trier (`priority`, puis nom).
5. Concaténer sous un plafond de tokens (`HFORGE_SKILLS_MAX_CHARS`, défaut 32000).
6. Injecter en system prompt **avant** le message utilisateur.
7. Enregistrer la liste `skillsApplied` sur `Generation`.

## Ce que les skills doivent borner

- Rester dans le Runtime (pont device, pas SDK natif).
- Produire une spec / source web, pas un APK Unity.
- Capacités device seulement si demandées et listées.
- Pas d’ouverture du Builder depuis l’app générée.
- Refus explicite : malware, phishing, surveillance, etc.

Les docs `doc/` cadrent les **développeurs**. Les fichiers `skills/prompt/` cadrent les **utilisateurs finaux** via l’IA.
