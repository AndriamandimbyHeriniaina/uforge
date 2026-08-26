# Fonctionnalité — Compiler

Transforme le workspace en `.happ` exécutable **sur le device**.

## Pipeline

Source (spec + player Runtime) → esbuild minify → empaqueter seed SQL + manifest → **renvoyer** au Runtime → chiffrement local.

Preview = lecteur de spec non minifié. Compile = bundle minifié **sur l’appareil**.

## Où ça tourne

- Service `compiler` (conteneur, port 3001) : `POST /v1/compile` `{ spec, playerSource, appId, appName }` → `{ manifest, bundleJs, seedSql }`. **Aucune persistance.**
- Publication : le Runtime (`services/web`, Capacitor) chiffre et conserve le `.happ`. Le navigateur appelle `VITE_COMPILER_URL` (`http://localhost:3001`), pas le hostname Docker `compiler`.
- Si le compiler est injoignable, le Runtime assemble quand même seed + manifest en local.

Le gateway n’accuse que le fait d’un compile (quota / statut), sans recevoir le `.happ`.
