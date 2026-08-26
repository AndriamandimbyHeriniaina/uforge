---
name: hforge-architecture
description: Uforge (You Forge) platform architecture (Runtime, .happ, gateway, compiler, seed/overlay). Use when changing docker-compose, service boundaries, package format, or development architecture.
---

# Uforge architecture

1. Read [doc/architecture.md](../../../doc/architecture.md).
2. Open the matching page under `doc/features/` or `doc/techno/`.
3. Keep decisions in the architecture table (WebView + bridge, seed in `.happ`, overlay outside, skills re-read every prompt).

Do not introduce React Native as the guest UI. Do not put live SQLite writes inside the published `.happ`.
