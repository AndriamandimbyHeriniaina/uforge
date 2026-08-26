# Fonctionnalité — AI Builder

Interface protégée **dans le Runtime**, jamais fournie par le `.happ`.

## Flux utilisateur

Prompt → preview (même Runtime) → modifier → compiler (publier une version) → utiliser offline.

Le workspace source reste sur le device (ou snapshot MinIO plus tard). Compiler ne détruit pas le chantier.

## Accès

Geste / combinaison = révélation UX seulement. Auth robuste (compte Uforge / secret Builder) ensuite.

## Nettoyer l’app

Bouton à côté du prompt, confirmation :

1. Réinitialiser les données : supprime l’overlay, recopie le seed.
2. Nettoyer l’app : overlay + `.happ` installé, Runtime vide, Builder intact.
3. Tout le chantier : option séparée (source/drafts).

Voir [reset-app.md](reset-app.md).
