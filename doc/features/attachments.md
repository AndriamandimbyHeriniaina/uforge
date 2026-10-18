# Fonctionnalité — Pièces jointes de l’atelier

L’admin joint des fichiers à un message, pour guider l’IA ou pour les intégrer à l’appli.

| Type | Traitement sur l’appareil | Envoyé à l’IA |
| --- | --- | --- |
| Image (jpg, png, webp, gif) | Redimensionnée (≤ 1 600 px, PNG gardé en PNG, le reste en JPEG qualité 0,85) | Oui, en entrée image |
| SVG, CSV, TXT, JSON, MD | Gardé tel quel (400 Ko max) | Oui, en texte |
| Excel (xlsx) | **Pas encore** : l’atelier demande d’enregistrer la feuille en CSV | — |
| PDF | V2 (extraction de texte) | — |

Six pièces jointes au maximum par message.

## Utiliser dans l’appli

- Chaque image jointe est proposée avec une case « Utiliser dans l’appli », cochée par défaut. Cochée, l’image est ajoutée au workspace dans `assets/` et l’IA la référence par son chemin. Décochée, l’image est seulement montrée à l’IA (par exemple une capture d’une appli qui inspire).
- Les fichiers de données (CSV, Excel) servent à l’IA, par exemple pour générer les données initiales d’un catalogue. Ils n’entrent pas dans l’appli tels quels.
- L’IA ne peut pas écrire de binaire : elle n’utilise que les assets présents ou ce qu’elle dessine (SVG, CSS, canvas).

## Stockage

Les images « à utiliser dans l’appli » deviennent des assets du workspace, donc vivent dans le bloc admin (chiffré par `K_admin`). Les pièces jointes « pour référence » partent seulement dans le tour (`POST /v1/ai/generate` → `attachments`) et ne sont pas conservées. **Rien ne passe par MinIO.** Si le tour échoue, les pièces jointes reviennent dans la zone de saisie.

## Limites

10 Mo par fichier avant traitement, dans la limite du budget de contexte du plan (`maxContextChars`, `maxFileBytes`).

## Remplace

L’ancien `POST /v1/files` (upload vers MinIO avec `fileIds`), que la génération n’utilisait d’ailleurs jamais.
