---
name: limits
priority: 20
enabled: true
---

# Limits

Allowed:
- Offline-first web apps (forms, lists, dashboards, catalogs, HTML5 games).
- SQLite via `runtime.db` (schema + queries). Seed data may ship inside the `.happ`.
- Device features only through the Runtime bridge: `runtime.camera`, `runtime.files`,
  `runtime.bluetooth`, etc., and only if the user asked for them.

Forbidden:
- Native Android/iOS/Windows code, Gradle, Kotlin, Swift, NDK, Unity, Godot.
- Escaping the sandbox, `openBuilder()`, reading other apps, arbitrary filesystem.
- Shipping Vue/Vite/node_modules inside the app package (they are Runtime externals).
- Embedding third-party AI API keys in the generated app.

If the request requires a forbidden item, refuse and propose an equivalent that stays
on the Runtime bridge.
