# Techno — Prisma et PostgreSQL

Source de schéma : `services/gateway/prisma/schema.prisma`.

Migrations versionnées dans `prisma/migrations/`. En Compose, `prisma migrate deploy` au démarrage du gateway.

Postgres = comptes Uforge, apps, drafts, générations, quotas, clés objet MinIO. **Pas** la base métier SQLite des apps clientes.

Après modification du schéma : nouvelle migration, jamais un edit silencieux en prod.
