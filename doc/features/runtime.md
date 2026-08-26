# Fonctionnalité — Runtime

Moteur installé une fois. Il exécute les `.happ`, expose le pont device, isole le sandbox, et contient le Builder (accès protégé).

## Fournit

Rendu WebView, navigation, SQLite overlay, fichiers sandbox, pont APIs, vérification signature `.happ`, permissions par manifest, Builder.

## Ne fournit pas dans le `.happ`

Vue, Vite, plugins natifs, le Builder. Ce sont des **externals**. Preview Builder : lecteur de spec (pages `crud`, `dashboard`, `game` avec `game.source` canvas, `custom`). `catch`/`tap` uniquement si demandés. Après « Utiliser mon appli », le Runtime injecte le **bundle JS minifié** du compiler, enveloppé du CSS Runtime.

## Isolation

L’app cliente tourne dans une iframe `sandbox="allow-scripts"` (origine opaque, pas de `allow-same-origin`) et n’appelle le natif que via `postMessage` → `runtime.*`. Pas d’`openBuilder()`. Pendant la conversation Builder, aperçu et feuille sont des blocs flex **distincts** (pas de calque au-dessus de l’iframe : les taps mobiles ne passent pas à travers).

Le `.happ` déchiffré injecte spec + bundle. Les écritures live vont dans l’overlay SQLite, jamais dans le paquet chiffré.

## Cibles

Web/PWA et Android (Capacitor). iOS plus tard. Code : `services/web` ; `npx cap open android` pour le module natif. Compose ne construit pas l’APK.
