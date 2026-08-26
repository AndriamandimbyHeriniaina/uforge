---
name: hforge-runtime
description: Generic Runtime, WebView sandbox, device bridge, .happ loading, Builder reset. Use when editing services/web, Capacitor, SQLite seed/overlay, or runtime APIs.
---

# Runtime

Read [doc/features/runtime.md](../../../doc/features/runtime.md), [doc/features/device-bridge.md](../../../doc/features/device-bridge.md), [doc/features/happ.md](../../../doc/features/happ.md), [doc/features/data-seed-overlay.md](../../../doc/features/data-seed-overlay.md), [doc/features/reset-app.md](../../../doc/features/reset-app.md).

The on-device `.happ` is encrypted (AES-GCM). Only the owner email stays in the clear envelope. Never send the artefact or the derived key to the gateway.
