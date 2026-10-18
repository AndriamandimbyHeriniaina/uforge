---
name: hforge-builder
description: Uforge workshop (admin interface) in services/web — conversation with file chips, live preview, error collector and "Corriger", versions, attachments, Builder action, reset. Use when editing the workshop UI or its flows.
---

# Workshop (atelier)

Read [doc/features/builder.md](../../../doc/features/builder.md), [doc/features/attachments.md](../../../doc/features/attachments.md), [doc/features/reset-app.md](../../../doc/features/reset-app.md) and [doc/features/auth.md](../../../doc/features/auth.md).

- Each turn sends the whole workspace to `POST /v1/ai/generate`, renders `token` events as the chat bubble and `op` events as file chips, then applies `done.changes` as a new version.
- The preview runs on a preview database, never on the live one.
- The workspace, versions, conversation and attachments live in the admin block (encrypted with `K_admin`) and survive reloads.
- Builder = production build → live app; then close the admin session (clear the password, KEK, `K_admin` and JWT from RAM).
- Never show generated code in the chat bubble. Never persist the password.
