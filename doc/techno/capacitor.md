# Techno — Capacitor

Cible Android (puis iOS). L’APK est le **Runtime générique** : atelier, iframe, pont et stockage. Il porte **une** appli à la fois. Les plugins natifs sont compilés **dans** le Runtime ; une appli générée n’apporte jamais de Kotlin ni de Swift.

## Projet

- Config : `services/web/capacitor.config.ts` (`appId: app.uforge.runtime`, `webDir: dist`)
- Plateforme : `services/web/android/`
- Pont natif : `services/web/src/runtime/native.ts`

## Plugins

| Plugin | Usage | Statut |
| --- | --- | --- |
| `@capacitor/camera` | `runtime.camera.capture` | présent |
| `@capacitor/share` | `runtime.share.send`, partage du `.happ` exporté | présent |
| `@capacitor/filesystem` | `runtime.files.save`, écriture du `.happ` exporté | présent |
| `@capacitor/browser` | `runtime.browser.open` | présent |
| `CapacitorHttp` (core) | `runtime.http.request` (pas de contrainte CORS) | utilisé |
| `@capacitor/app` | `appStateChange` (écriture de la base avant l’arrière-plan), `appUrlOpen` (ouverture d’un `.happ`) | présent |
| Geolocation, LocalNotifications, Haptics | Capacités V2 | plus tard |

## Ouvrir un `.happ` depuis Android

`AndroidManifest.xml` déclare des `intent-filter` `VIEW` pour `application/vnd.uforge.happ`, `application/octet-stream`, `application/zip` et l’extension `.happ`. L’URI reçue via `@capacitor/app` (`appUrlOpen`) est lue avec Filesystem et lance le flux d’import ([export-import.md](../features/export-import.md#importer)). **Pas encore testé sur appareil.**

## Build local

```bash
cd services/web
npm install
npm run cap:sync
npx cap open android
```

Android Studio ouvre le module. Au premier lancement, il faut le SDK et un émulateur ou un téléphone.

Pour le live reload vers le Vite de l’hôte, ajouter temporairement dans `capacitor.config.ts` :

```ts
server: {
  url: 'http://10.0.2.2:5173',
  cleartext: true,
}
```

(`10.0.2.2` est le localhost de l’hôte vu depuis l’émulateur Android.)

Pour un APK qui parle au gateway et au compiler locaux (émulateur) :

```bash
VITE_GATEWAY_URL=http://10.0.2.2:3000 VITE_COMPILER_URL=http://10.0.2.2:3001 npm run cap:sync
```

Le gateway et le compiler doivent autoriser l’origine Capacitor (`https://localhost`), via `WEB_ORIGIN` ou la liste CORS. Voir `services/gateway/src/main.ts`.

## Stockage

IndexedDB de la WebView, comme sur le web ([runtime.md](../features/runtime.md#stockage-sur-lappareil)). V2 : `K_device` dans l’Android Keystore, et les gros blocs dans le Filesystem.

L’appli générée tourne dans une iframe `sandbox="allow-scripts allow-forms allow-modals"`. Le pont `runtime.*` utilise les plugins natifs quand `Capacitor.isNativePlatform()` est vrai.
