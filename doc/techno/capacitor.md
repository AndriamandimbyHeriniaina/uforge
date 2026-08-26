# Techno — Capacitor

Cible Android (puis iOS). Un APK = Runtime + `.happ` embarqué (export) **ou** Runtime générique qui charge un `.happ`.

Les plugins (Camera, Filesystem, BLE) sont compilés **dans** le Runtime. Le package utilisateur n’ajoute pas de plugin natif.

Compose ne build pas l’APK. Doc native à ajouter quand le shell Capacitor existera sous `services/web` / `android/`.
