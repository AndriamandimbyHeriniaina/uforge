# Fonctionnalité — Package `.happ`

Artefact **exécutable**, pas le chantier Builder.

## Contenu publié

Manifest (id, version, runtime min, capacités), bundle JS/CSS minifié, assets référencés, **seed** SQLite et/ou JSON, checksum, signature.

## Absents du `.happ`

Source `.vue`/`.ts`, Vite, `node_modules`, source maps prod, Builder, overlay live.

## Seed vs live

Le seed voyage dans le paquet (vitrine pré-remplie, niveaux). L’overlay vit dans `data/<appId>/` sur le device. Un partage « avec mes données » recongèle l’overlay dans un nouveau seed au compile.

## Partage

Par défaut : code + seed d’origine. Option compile : inclure les données live (avertissement privacy).
