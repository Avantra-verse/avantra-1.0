# AVANTRA web

The Next.js site, student dashboard, staff scanner and admin dashboard. Everything about running, deploying and
the data model is in the [root README](../../README.md); the look is in [DESIGN.md](DESIGN.md).

```bash
pnpm --filter @avantra/shared build   # once, from the repo root
pnpm dev                              # http://localhost:3000
```

Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code (see AGENTS.md).
