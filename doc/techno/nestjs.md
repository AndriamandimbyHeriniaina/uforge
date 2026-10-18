# Techno — NestJS (gateway)

API HTTP du gateway : modules, injection de dépendances, `ValidationPipe`, JWT.

- Modules : Config, Prisma, Redis, Auth, Ai, Skills, Health (`Apps` et `Storage` ont été retirés).
- DTO `class-validator`. Le DTO de `generate` valide `files[].path` (relatif, sans `..`) et les tailles.
- Préfixe global `/v1`, sauf `/health`.
- JSDoc en anglais, avec un `@example`.
- IA : `AiService` → `ProviderRouter` → adaptateurs (`anthropic` via `@anthropic-ai/sdk`, `openai`, `stub`). Les adaptateurs ne font que streamer du texte ; `ai/protocol/` parse le protocole et applique les opérations. Les clés ne sont que dans l’environnement.
- `POST /v1/ai/generate` streame en SSE (`meta`, `token`, `op`, `done`, `error`). Le parseur du protocole `uf-*` et l’application des opérations vivent dans le module Ai, indépendamment du provider. Voir [gateway.md](../features/gateway.md#protocole-uf-).
- Quotas : `effectiveDailyGenerations` (30 par jour en dev, valeur de `PlanQuota` en prod).

Ne pas appeler les providers IA depuis un controller : passer par `AiService` et `ProviderRouter`.
