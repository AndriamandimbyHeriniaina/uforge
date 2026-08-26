# Techno — NestJS (gateway)

API HTTP du gateway : modules, DI, ValidationPipe, JWT.

- `AppModule` importe Config, Prisma, Auth, Apps, Ai, Storage, Health.
- DTOs `class-validator`.
- Préfixe global `/v1` sauf `/health`.
- JSDoc en anglais, exemples dans les commentaires de service.
- Providers IA : `AiService` → `ProviderRouter` → adaptateurs (`openai`, `anthropic`, `stub`). Clés uniquement en env.
- Quotas : `effectiveDailyGenerations` (30/jour en dev, valeur `PlanQuota` en prod).

Ne pas appeler les providers IA depuis un controller : passer par `AiService` + `ProviderRouter`.
