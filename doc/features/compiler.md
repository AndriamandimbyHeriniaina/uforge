# Fonctionnalité — Compiler

Transforme le workspace en `.happ` exécutable **sur le device**.

## Pipeline

Source → bundler (Vite) → minify / tree-shake → **externals** (vue, `runtime.*`) → empaqueter seed + manifest (email Uforge) → compresser → signer → **store local du Runtime**.

Preview = même pipeline, artefact temporaire. Compile = version publiée **sur l’appareil**.

## Où ça tourne

- Publication : le Runtime (`services/web`, plus tard Capacitor) assemble et conserve le `.happ`.
- Service `compiler` (conteneur) : bundler optionnel. Il **renvoie** l’artefact au Runtime. Il ne persiste rien. Le gateway n’enregistre pas le binaire.

MVP : le Runtime sérialise spec + manifeste (dont l’email) en local. Le gateway n’accuse que le fait d’un compile (quota / statut), sans recevoir le `.happ`.
