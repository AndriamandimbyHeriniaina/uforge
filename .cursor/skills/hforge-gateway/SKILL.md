---
name: hforge-gateway
description: NestJS AI Gateway, Prisma entities, quotas, provider adapters, MinIO. Use when editing services/gateway, generate endpoint, auth, or database schema.
---

# Gateway

Read [doc/features/gateway.md](../../../doc/features/gateway.md), [doc/techno/nestjs.md](../../../doc/techno/nestjs.md), [doc/techno/prisma-postgres.md](../../../doc/techno/prisma-postgres.md).

- Entities live in `services/gateway/prisma/schema.prisma`.
- `POST /v1/ai/generate` must load `skills/prompt` on **every** request via `SkillsService`.
- Provider API keys stay in gateway env only.
