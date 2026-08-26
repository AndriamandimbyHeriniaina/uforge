# Fonctionnalité — Compiler

Transforme le workspace en `.happ` exécutable.

## Pipeline

Source → bundler (Vite) → minify / tree-shake → **externals** (vue, `runtime.*`) → empaqueter seed + manifest → compresser → signer → MinIO.

Preview = même pipeline, artefact temporaire. Compile = version publiée.

## Où ça tourne

- Preview légère : possible dans `services/web`.
- Publication / gros assets : service `compiler` (conteneur), appelé par le gateway.

MVP : `services/compiler` accepte un payload source et renvoie un artefact factice signé (stub), pour coller le flux Docker avant le vrai bundling.
