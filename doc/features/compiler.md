# Fonctionnalité — Compiler

Service `compiler` (`services/compiler`, esbuild, port 3001). **Sans état** : il reçoit des fichiers, renvoie un document et ne persiste rien, à part un cache des paquets npm.

## Entrée

`POST /v1/build`

```json
{
  "mode": "preview",
  "files": [{ "path": "index.html", "content": "…" }, { "path": "uforge.json", "content": "…" }],
  "assets": [{ "path": "assets/logo.png", "mime": "image/png", "dataBase64": "…" }]
}
```

Le manifest est le fichier `uforge.json` du workspace (format dans `skills/prompt/40-project.md`).

## Étapes

1. Lire `uforge.json` : `entry` (défaut `index.html`), `dependencies`, `jsx`, `capabilities`.
2. Bundler depuis l’entrée HTML : scripts `type="module"`, CSS, imports JS / TS / JSX / TSX / JSON. Voir [esbuild.md](../techno/esbuild.md).
3. **Dépendances npm** : les imports nus sont résolus d’après `dependencies` (versions exactes), téléchargés au build depuis esm.sh (`ESM_CDN`), puis mis en cache sur un volume (`COMPILER_CACHE_DIR`). Le résultat embarque tout, donc **l’appli tourne hors ligne**.
4. **Assets** : images, sons et polices sont inlinés (data URL). Les SVG importés restent du texte.
5. Mode :
   - `preview` : pas de minification, priorité à la vitesse (< 1 s visé). Chaque module garde son marqueur `// ws:src/fichier.js`, ce qui permet au Runtime de rattacher une erreur d’exécution au bon fichier ;
   - `production` : minification, tree-shaking, `target: es2020`, pas de sourcemap.
6. Produire **un seul document HTML autonome** et un rapport.

## Sortie

```json
{
  "status": "ok",
  "html": "<!doctype html>…",
  "manifest": { "name": "Ma boutique", "icon": "data:image/svg+xml;base64,…", "capabilities": ["camera"], "orientation": "any" },
  "size": 412345,
  "warnings": []
}
```

En cas d’échec : `{ "status": "error", "errors": [{ "file": "src/cart.js", "line": 12, "message": "…" }] }`. Ces erreurs remontent à l’atelier comme les erreurs d’exécution, avec le bouton « Corriger ».

## Ce que le compiler n’injecte pas

Le Runtime ajoute lui-même, au moment d’afficher, ce qui dépend de l’appareil et du mode : le bootstrap `runtime.*`, la CSP et le collecteur d’erreurs (en aperçu). Voir [runtime.md](runtime.md#affichage-de-lappli).

## Contraintes

- Taille maximale du document produit : 15 Mo. Avertissement au-delà de 5 Mo.
- Pas de fichier `.vue` ni `.svelte`, ni de fichier de configuration de bundler dans le workspace.
- Le compiler voit le code source le temps d’un build, comme le gateway. Il n’en garde rien.

## Réseau

L’atelier a besoin du compiler, comme du gateway. En V2, esbuild-wasm dans le Runtime permettra un aperçu sans réseau.

## Code et tests

`services/compiler/src/build.mjs` (build), `npm.mjs` (résolution et cache npm), `server.mjs` (HTTP). `npm test` couvre un projet complet, les erreurs localisées, les dépendances non déclarées et un vrai build Preact + JSX téléchargé depuis esm.sh (`OFFLINE=1` pour sauter ce dernier).
