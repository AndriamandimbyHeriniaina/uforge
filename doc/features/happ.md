# Fonctionnalité — Package `.happ`

Artefact **exécutable**, pas le chantier Builder. Il vit **uniquement sur le device**, **chiffré**. Le gateway ne le reçoit jamais et ne le stocke jamais.

## Contenu publié (en clair dans l’enveloppe)

Email du compte Uforge (pour demander le mot de passe et dériver la clé). Rien du JS, de la spec ni du seed.

## Contenu publié (chiffré)

Manifest (id, version, runtime min, capacités), bundle JS/CSS minifié, assets, **seed**, spec Builder.

## Clé

1. Le mot de passe est enveloppé avec l’email : `HMAC-SHA-256(clé = email, message = mot de passe)`.
2. La clé AES-256-GCM est `PBKDF2-SHA-256` de cet enveloppe, sel = email, 210 000 itérations.

Le mot de passe n’est **pas** écrit sur le disque. Il reste en RAM le temps de la session Builder.

## Absents du `.happ`

Source `.vue`/`.ts`, Vite, `node_modules`, source maps prod, Builder, overlay live.

## Seed vs live

Le seed voyage dans le paquet (vitrine pré-remplie, niveaux). L’overlay vit dans `data/<appId>/` sur le device. Un partage « avec mes données » recongèle l’overlay dans un nouveau seed au compile.

## Partage

Par défaut : code + seed d’origine. Option compile : inclure les données live (avertissement privacy).
