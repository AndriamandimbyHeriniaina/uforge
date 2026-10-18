# Techno — esbuild (compiler)

Moteur du service `compiler`. Il transforme le workspace d’une appli en un document HTML autonome. Contrat : [compiler.md](../features/compiler.md).

## Pourquoi esbuild

Il est rapide (aperçu en moins d’une seconde) et gère nativement JS, TS, JSX, TSX, CSS et JSON. Il fonctionne en API Node sans fichier de configuration, et il existe en WASM pour un futur aperçu hors ligne.

## Mise en œuvre

- **Système de fichiers virtuel** : un plugin `onResolve` / `onLoad` sert les fichiers reçus dans la requête. Rien n’est écrit sur disque, à part le cache npm.
- **Entrée HTML** : on parse `index.html`, on bundle chaque `<script type="module" src>` et chaque `<link rel="stylesheet">`, puis on réinjecte le JS et le CSS inline. Les `<script>` inline restent en place.
- **npm** : les imports nus sont résolus d’après `uforge.json` → `dependencies`. On télécharge les modules ESM depuis esm.sh (`ESM_CDN`), en version exacte et avec les autres dépendances passées en `deps` pour éviter les doublons. Un cache disque (`COMPILER_CACHE_DIR`, volume Compose) évite de retélécharger. Un import absent de `dependencies` provoque une erreur de build explicite.
- **JSX** : `uforge.json` → `"jsx": "preact"` ou `"react"` donne `jsx: 'automatic'` et le `jsxImportSource` correspondant. Le paquet doit figurer dans `dependencies`.
- **Assets** : le loader `dataurl` gère images, sons et polices. Les `url()` du CSS et les `src` du HTML relatifs à `assets/` sont réécrits.
- **Modes** : `preview` (`minify: false` ; les commentaires `// ws:chemin` que pose esbuild en tête de chaque module servent à localiser les erreurs) ; `production` (`minify: true`, `target: 'es2020'`).
- **Erreurs** : les `messages` d’esbuild sont convertis en `{ file, line, message }` pour le bouton « Corriger ».

## Sécurité

Le compiler exécute esbuild, jamais le code de l’appli. Il n’accepte que les chemins relatifs du workspace et n’autorise aucun accès disque hors du cache.
