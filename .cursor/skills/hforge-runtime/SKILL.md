---
name: hforge-runtime
description: Uforge Runtime in services/web — modes (blank / workshop / app), floating bubble, sandboxed iframe, CSP, runtime.* host bridge, SQLite data and migrations, on-device storage, Capacitor plugins. Use when editing services/web runtime code, Capacitor, or runtime APIs.
---

# Runtime

Read [doc/features/runtime.md](../../../doc/features/runtime.md), [doc/features/device-bridge.md](../../../doc/features/device-bridge.md), [doc/features/data.md](../../../doc/features/data.md), [doc/techno/sqlite.md](../../../doc/techno/sqlite.md) and [doc/techno/capacitor.md](../../../doc/techno/capacitor.md).

- Iframe `srcdoc` with `sandbox="allow-scripts allow-forms allow-modals"`: never `allow-same-origin`. Inject the CSP (from capabilities), the `runtime.*` bootstrap and, in preview only, the error collector, all before the app's scripts.
- The host bridge checks the message source, the method and the declared capability. Expose no `openBuilder()` and no access to the admin block.
- The `runtime.*` API must match `doc/features/device-bridge.md` and `skills/prompt/30-runtime-api.md`. Change all three together.
- Storage: IndexedDB `uforge`. Build and live database encrypted with `K_device`, admin block with `K_admin`. No app data in localStorage, never a password anywhere.
- The app opens without a password; only the workshop asks for one.
