# Techno — Capacitor

Cible Android (puis iOS). Un APK = Runtime générique qui charge **un** `.happ` chiffré sur l’appareil. Les plugins (Camera, Filesystem, Share) sont compilés **dans** le Runtime. Le package utilisateur n’ajoute pas de Kotlin/Swift.

## Projet

- Config : `services/web/capacitor.config.ts` (`appId: app.uforge.runtime`, `webDir: dist`)
- Plateforme : `services/web/android/`
- Pont : `services/web/src/runtime/native.ts` (caméra, partage, overlay `data/<appId>/overlay.sqlite`)

Compose ne build **pas** l’APK.

## Build local

```bash
cd services/web
npm install
npm run cap:sync
npx cap open android
```

Android Studio ouvre le module. Premier run : SDK + un émulateur ou un téléphone.

Pour le live reload vers le Vite hôte, ajouter temporairement dans `capacitor.config.ts` :

```ts
server: {
  url: 'http://10.0.2.2:5173',
  cleartext: true,
}
```

(`10.0.2.2` = localhost de l’hôte depuis l’émulateur Android.)

Pour un APK qui parle au gateway local (émulateur) :

```bash
VITE_GATEWAY_URL=http://10.0.2.2:3000 VITE_COMPILER_URL=http://10.0.2.2:3001 npm run cap:sync
```

Le gateway doit autoriser l’origine Capacitor (`https://localhost`) via `WEB_ORIGIN` ou une liste CORS. Voir `services/gateway/src/main.ts`.

Le guest reste une iframe `sandbox="allow-scripts"` ; le pont `runtime.*` utilise les plugins natifs quand `Capacitor.isNativePlatform()` est vrai.
