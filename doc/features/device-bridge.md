# Fonctionnalité — Pont device

L’app JS n’a pas l’OS. Elle a `runtime.*`.

## Contrat

```text
runtime.capabilities.has("camera")
runtime.camera.capture()
runtime.files.pick()
runtime.db.query()
runtime.bluetooth.scan()  // si manifest + plugin Runtime
```

Toute capacité absente du manifest → erreur permission. Toute API non implémentée sur la plateforme → `has() === false`.

## Implémentation

Plugins **dans le Runtime** (Capacitor). Le `.happ` ne shippe pas de Kotlin/Swift.

V1 : storage, files, camera, share. Bluetooth et le reste : pont typé, plugin plus tard.

Wifi scan / association forcée : borné par iOS/Android, pas par Uforge. Ne pas promettre un contrôle réseau total.
