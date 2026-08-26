# Fonctionnalité — Runtime

Moteur installé une fois. Il exécute les `.happ`, expose le pont device, isole le sandbox, et contient le Builder (accès protégé).

## Fournit

Rendu WebView, navigation, SQLite overlay (MVP : JSON overlay hors paquet), fichiers sandbox, pont APIs, vérification signature `.happ`, permissions par manifest, Builder.

## Ne fournit pas dans le `.happ`

Vue, Vite, plugins natifs, le Builder. Ce sont des **externals**. Tant que le compiler n’émet pas de JS, le Runtime fournit aussi le **lecteur de spec** (CRUD, vitrine, canvas).

## Isolation

L’app cliente tourne dans une iframe `sandbox="allow-scripts"` (origine opaque, pas de `allow-same-origin`) et n’appelle le natif que via `postMessage` → `runtime.*`. Pas d’`openBuilder()`.

Le `.happ` déchiffré n’est injecté que comme JSON (spec). Les écritures live vont dans l’overlay `uforge-overlay:<appId>`, jamais dans le paquet chiffré.

## Cibles

Web/PWA d’abord, Android (Capacitor) ensuite. iOS plus tard. Code : `services/web` (PWA) ; couche native hors Compose.
