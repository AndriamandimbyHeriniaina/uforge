---
name: hforge-compiler
description: Uforge compiler (esbuild) that turns a workspace into one self-contained HTML document, in preview or production mode, embedding npm dependencies and assets. Use when editing services/compiler.
---

# Compiler

Read [doc/features/compiler.md](../../../doc/features/compiler.md) and [doc/techno/esbuild.md](../../../doc/techno/esbuild.md).

- Contract: `POST /v1/build { mode, files, assets }` → `{ status, html, manifest, size, warnings }` or `{ status: "error", errors: [{ file, line, message }] }`.
- Stateless: never persist workspaces or outputs. The only disk state allowed is the npm package cache.
- Dependencies come only from `uforge.json` → `dependencies` (exact versions) and are embedded, so the output works offline.
- Do not inject the `runtime.*` bootstrap, the CSP or the error collector: the Runtime adds them at display time.
- Never execute the app's code.
