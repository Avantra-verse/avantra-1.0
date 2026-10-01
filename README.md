# AVANTRA 2026

Website, registration, payments, QR check-in and scoring for AVANTRA 2026 (19–20 Dec, SSRVM IEMS Sec-20).
Plan and architecture: [docs/architecture.md](docs/architecture.md).

## Run locally

```bash
pnpm install
pnpm db:up                                  # Postgres + Redis in Docker
cp apps/api/.env.example apps/api/.env
pnpm --filter @avantra/api db:migrate       # create tables
pnpm --filter @avantra/shared build
pnpm dev:api                                # http://localhost:4000/health
pnpm dev:web                                # http://localhost:3000
```

| Path | What |
|---|---|
| `apps/web` | Next.js frontend |
| `apps/api` | NestJS API + Prisma (`prisma/schema.prisma` = data model) |
| `packages/shared` | zod schemas shared by web and api |
| `infra` | local docker-compose |
