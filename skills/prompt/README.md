# Dépôt de skills prompt (gateway)

Ces fichiers cadrent l’IA qui écrit les applis des admins. Ils sont montés dans Docker (`/skills/prompt`) et **relus à chaque** `POST /v1/ai/generate`, sans rebuild. Ce `README.md` est ignoré par le loader.

| Fichier | Priorité | Rôle |
| --- | --- | --- |
| `05-safety.md` | 5 | Refus |
| `00-platform.md` | 10 | Identité, mission, contexte reçu |
| `10-output-protocol.md` | 20 | Balises `uf-*` (contrat avec le parseur du gateway) |
| `15-touch-first.md` | 25 | Téléphone et tactile d’abord (obligatoire) |
| `20-environment.md` | 30 | Ce que l’iframe sandbox permet ou non |
| `30-runtime-api.md` | 40 | API `runtime.*` (identique à `doc/features/device-bridge.md`) |
| `40-project.md` | 50 | Structure, `uforge.json`, dépendances |
| `50-workflow.md` | 60 | Façon de travailler (Claude Code / Lovable) |
| `60-data.md` | 70 | SQLite, migrations, login dans l’appli |
| `70-design.md` | 80 | Qualité UI |
| `80-games.md` | 90 | Jeux |

Budget : `HFORGE_SKILLS_MAX_CHARS` (défaut 32 000). Au-delà, les skills suivantes sont **ignorées sans erreur**. Format et règles : `doc/features/prompt-skills.md`.
