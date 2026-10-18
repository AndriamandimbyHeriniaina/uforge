---
name: hforge-gateway
description: NestJS AI Gateway — auth, quotas, provider adapters, prompt assembly from skills/prompt, uf-* protocol parsing and validation, SSE events, Prisma entities. Use when editing services/gateway, the generate endpoint, auth, or the database schema.
---

# Gateway

Read [doc/features/gateway.md](../../../doc/features/gateway.md), [doc/techno/nestjs.md](../../../doc/techno/nestjs.md) and [doc/techno/prisma-postgres.md](../../../doc/techno/prisma-postgres.md).

- Stateless about apps: never store source, builds, `.happ` files, attachments or app data. `Generation` keeps metadata and `changedPaths` only.
- `POST /v1/ai/generate` loads `skills/prompt` on **every** request via `SkillsService`. Never hard-code output-format instructions in `prompt.ts`: the protocol lives in `skills/prompt/10-output-protocol.md`.
- Parse the stream: text outside tags → `token`; `uf-*` tags → `op`. Apply the operations to the received files, validate paths and `uf-edit` matches (one automatic retry), keep turns atomic, then send `done.changes` with the full file contents.
- Auth, quota and size errors are JSON returned before the SSE stream opens.
- Provider keys stay in the gateway environment only (`AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
