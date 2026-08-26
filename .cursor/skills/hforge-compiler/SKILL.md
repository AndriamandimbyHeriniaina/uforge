---
name: hforge-compiler
description: Uforge compiler that builds a light .happ artefact from workspace source. Use when editing services/compiler, Vite externals, packaging, or signing.
---

# Compiler

Read [doc/features/compiler.md](../../../doc/features/compiler.md) and [doc/techno/vite.md](../../../doc/techno/vite.md).

The published `.happ` keeps built JS/CSS, assets, seed, manifest (including the Uforge account email). It must not contain Vite, TypeScript sources, or the Builder. The gateway and MinIO must never store a `.happ`; the Runtime keeps it on device.
