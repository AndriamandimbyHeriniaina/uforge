# Fonctionnalité — Runtime

L’appli Uforge installée (`services/web` : PWA + APK Capacitor). Elle contient l’atelier, exécute l’appli générée et garde tout sur l’appareil.

## Modes

| Mode | Quand | Écran |
| --- | --- | --- |
| Vierge | Aucune appli installée | Accueil : « Créer mon compte » · « Me connecter » · « Importer un .happ » |
| Atelier | Session admin ouverte | Aperçu du brouillon + conversation ([builder.md](builder.md)) |
| Appli | Une appli validée, pas de session admin | Appli en plein écran + bulle |

Avant le premier Builder, sans session admin, l’écran de connexion s’affiche et le brouillon chiffré attend.

## Bulle

Bouton flottant, semi-transparent, déplaçable (position mémorisée). Menu :
- **Atelier** : demande le mot de passe admin. Absent si l’appli est figée.
- **Importer une appli** : sans mot de passe. Voir [export-import.md](export-import.md).
- **À propos** : nom, auteur (email), version, capacités, « appli figée » le cas échéant.

V2 : une option admin « masquer la bulle », remplacée par un geste caché (appui long de 3 s dans un coin).

## Affichage de l’appli

1. Le Runtime prend le document HTML du compiler : le build validé en mode appli, le build `preview` en atelier.
2. Il injecte en tête du `<head>`, avant tout script de l’appli :
   - la **CSP** calculée selon les capacités ;
   - le **bootstrap** `window.runtime` (client `postMessage`), avec un shim `localStorage` préchargé pour les librairies tierces ;
   - en aperçu seulement, le **collecteur d’erreurs** (`error`, `unhandledrejection`, `console.error` → hôte).
3. Il affiche le tout dans une `iframe srcdoc` avec `sandbox="allow-scripts allow-forms allow-modals"`.

Pas de `allow-same-origin`, pas de `allow-popups`, pas de `allow-top-navigation`. L’origine est opaque : l’appli ne voit ni le stockage, ni les cookies, ni le DOM de l’hôte.

### CSP

Sans la capacité `network`, l’appli est hors ligne et ne peut rien envoyer :

```text
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:;
style-src 'unsafe-inline' blob: data:; img-src blob: data:; font-src data:;
media-src blob: data:; worker-src blob:; connect-src blob: data:
```

Avec `network`, on ajoute `https: wss:` à `connect-src`, `img-src`, `media-src` et `font-src`. On autorise aussi `https:` dans `script-src` et `style-src` pour les SDK qui l’exigent (cartes, paiement), mais les skills demandent d’embarquer les dépendances.

Dans tous les cas : `form-action 'none'` (un formulaire non intercepté ne recharge pas l’appli) et `base-uri 'none'`. Code : `services/web/src/runtime/guest.ts`.

## Pont hôte

Le pont reçoit les messages de l’iframe et vérifie trois choses : la source est bien cette iframe, la méthode est connue, la capacité est déclarée. Il route ensuite vers un plugin web ou Capacitor. Aucune méthode ne peut ouvrir l’atelier ni lire le bloc admin. API : [device-bridge.md](device-bridge.md).

## Stockage sur l’appareil

Tout est dans IndexedDB `uforge`, sur le web comme dans la WebView Android (V2 : fichiers Capacitor pour les gros blocs).

| Clé | Contenu | Protection |
| --- | --- | --- |
| `device.key` | `K_device` (CryptoKey AES-GCM non extractible) | non exportable |
| `happ.header` | En-tête de l’appli installée ([happ.md](happ.md)) | en clair |
| `happ.app` | Build validé + manifest | `K_device` |
| `happ.data` | Base SQLite live (avec `runtime.storage`) | `K_device` |
| `happ.admin` | Workspace (images jointes comprises), versions, conversation | `K_admin` |
| `happ.preview` | Base d’aperçu | `K_admin` |

- Seule la position de la bulle va dans `localStorage` (simple préférence d’affichage). **Rien de l’appli n’y est stocké** (limite d’environ 5 Mo), et **aucun mot de passe nulle part**, même pas en `sessionStorage`.
- Code : `services/web/src/core/device.ts` (blocs), `lib/crypto.ts` (clés), `lib/idb.ts` (transactions).
- Un remplacement (Builder, import) est **atomique** : on écrit les nouveaux blocs, puis on bascule l’en-tête, puis on efface les anciens.

## Hors ligne

- L’appli validée tourne sans réseau, sauf si elle utilise `network`.
- Sur le web, un service worker doit mettre le Runtime en cache (PWA installable) : **pas encore fait**.
- L’atelier a besoin du réseau pour prompter et builder (gateway et compiler).

## Cibles

Web/PWA et Android (Capacitor). iOS plus tard. Code dans `services/web` ; `npx cap open android` pour le module natif.
