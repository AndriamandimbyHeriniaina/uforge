# Fonctionnalité — Dépôt de skills prompt

Les skills cadrent **l’IA de génération**, celle qui écrit les applis des admins. L’opérateur dépose des fichiers markdown ; le gateway les relit à chaque `POST /v1/ai/generate`, sans rebuild.

## Emplacement

`skills/prompt/*.md`, monté dans Docker : `./skills/prompt:/skills/prompt`. Variable `HFORGE_SKILLS_DIR` (défaut `/skills/prompt`). Les `README.md` sont ignorés.

## Format

```markdown
---
name: workflow
priority: 60
enabled: true
---

# How you work
…
```

- `name` : identifiant court, enregistré dans `Generation.skillsApplied`.
- `priority` : ordre d’injection (petit = d’abord), puis le nom de fichier.
- `enabled: false` : skill ignorée.
- Corps en **anglais** (plus stable pour le modèle). L’IA répond dans la langue de l’admin (français par défaut).

## Chargement (à chaque tour, sans cache)

1. Lister les `*.md`, parser le frontmatter, filtrer `enabled`.
2. Trier par `priority`, puis par nom.
3. Concaténer `## Skill: <name>` + corps, sous le plafond `HFORGE_SKILLS_MAX_CHARS` (défaut 32 000).
4. Injecter en system prompt, avant le contexte du workspace.

**Attention au budget :** le loader s’arrête à la première skill qui dépasse le plafond, et **toutes les suivantes sont ignorées sans erreur**. Garder le total sous ~28 000 caractères, les skills critiques en tête, et vérifier `skillsApplied` dans `Generation`.

## Skills livrées

| Fichier | Priorité | Rôle |
| --- | --- | --- |
| `05-safety.md` | 5 | Refus (malware, phishing, fraude…) |
| `00-platform.md` | 10 | Identité, mission, contexte reçu à chaque tour |
| `10-output-protocol.md` | 20 | Balises `uf-*`. **Indispensable** : sans elle, rien ne s’applique |
| `15-touch-first.md` | 25 | Téléphone et tactile d’abord : tout doit marcher au pouce, jeux compris (contrôles à l’écran, multi-touch) |
| `20-environment.md` | 30 | L’iframe sandbox : ce qui marche, ce qui ne marche pas |
| `30-runtime-api.md` | 40 | API `runtime.*` |
| `40-project.md` | 50 | Structure, `uforge.json`, dépendances, assets, réseau |
| `50-workflow.md` | 60 | Façon de travailler (Claude Code / Lovable) |
| `60-data.md` | 70 | SQLite, migrations, login dans l’appli |
| `70-design.md` | 80 | Qualité UI mobile |
| `80-games.md` | 90 | Jeux |

## Principes

- Les skills décrivent un **environnement** et un **niveau d’exigence**, pas un catalogue. Ne jamais réintroduire une liste fermée de types d’applis ou de pages.
- `30-runtime-api.md` doit rester **identique** à [device-bridge.md](device-bridge.md) : n’y ajouter une API que lorsqu’elle figure dans cette page. Une API pas encore implémentée fait échouer l’aperçu, et l’IA corrigera dans le vide.
- Le protocole `10-output-protocol.md` et le parseur du gateway forment un contrat : si l’un change, l’autre change aussi. Voir [gateway.md](gateway.md#protocole-uf-).
- La sécurité reste en tête (priorité 5) et ne doit jamais être désactivée.

Les docs `doc/` cadrent les **développeurs** ; les fichiers `skills/prompt/` cadrent l’**IA de génération**.
