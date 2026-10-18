---
name: hforge-architecture
description: Uforge (You Forge) product vision and architecture (Runtime, workshop, gateway, compiler, .happ, encryption). Use when changing docker-compose, service boundaries, data flow, storage, or anything that touches the product journey.
---

# Uforge architecture

1. Read [doc/vision.md](../../../doc/vision.md): the product and its decisions. It wins over everything else.
2. Read [doc/architecture.md](../../../doc/architecture.md): flows, storage, the "État du code" table and the work order.
3. Open the matching page under `doc/features/` or `doc/techno/`.

Keep the frozen decisions:
- The AI writes code files; the compiler (esbuild) builds them; an iframe sandbox runs them.
- One app per install; the device is the source of truth; the gateway is stateless about apps.
- Keys: `K_admin` (wrapped by a password-derived KEK), `K_device`, `K_share`.

Do not reintroduce: a spec/page-type format, a multi-app manager, server-side storage of apps, or passwords persisted on the device.
