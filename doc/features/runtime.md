# Fonctionnalité — Runtime

Moteur installé une fois. Il exécute les `.happ`, expose le pont device, isole le sandbox, et contient le Builder (accès protégé).

## Fournit

Rendu WebView, navigation, SQLite overlay, fichiers sandbox, pont APIs, vérification signature `.happ`, permissions par manifest, Builder.

## Ne fournit pas dans le `.happ`

Vue, Vite, plugins natifs, le Builder. Ce sont des **externals**.

## Isolation

L’app cliente tourne dans une iframe / WebView à origine nulle et n’appelle le natif que via `postMessage` → pont. Pas d’`openBuilder()`.

## Cibles

Web/PWA d’abord, Android (Capacitor) ensuite. iOS plus tard. Code : `services/web` (PWA) ; couche native hors Compose.
