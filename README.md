# AVANTRA 2026

Website, registration, payments, QR check-in, judging, the Engagement Wall and certificates for AVANTRA 2026,
a two-day school science fest (19–20 Dec 2026, SSRVM IEMS Sec-20). Built and run by ARITHI.

Runs on two services only: **Vercel** (the Next.js site) and **Supabase** (Postgres, Auth, Edge Functions).

## Docs

| File | Read it for |
|---|---|
| [supabase/README.md](supabase/README.md) | one-time project setup: migrations, mail function, secrets, checking email |
| [supabase/migrations/](supabase/migrations) | the data model, RLS, and every write as a database function (source of truth) |
| [apps/web/DESIGN.md](apps/web/DESIGN.md) | the "Ember" design system (colours, type, components) |
| [docs/architecture.md](docs/architecture.md) | the original plan and event-day checklist. Written for the old NestJS API: flows still hold, the stack doesn't |

## Repo layout

pnpm monorepo (`pnpm@12.8.1`).

```
apps/web/             Next.js 16 (Tailwind v4, framer-motion), deployed on Vercel
  app/                routes (see below); app/admin/**/route.ts = admin downloads/uploads, staff and walk-in accounts
  components/         site sections; account/ = login, registration, UPI fee; multiverse/ = home scroll animation
  content/site.ts     event copy, dates, UPI details, gallery
  lib/api.ts          every data call: Supabase Auth, reads under RLS, writes through database functions
  lib/server/         server-only helpers for the admin route handlers (uses SUPABASE_SECRET_KEY)
  scripts/            access.e2e.mjs (attacker checks), flows.e2e.mjs (every role end to end)
supabase/
  migrations/         schema, RLS, SECURITY DEFINER functions that check the caller's role
  functions/send-mail emails queued in private.mail_outbox, sent over SMTP 465, retried by pg_cron
  templates/          Auth email templates (sign-up and reset codes)
packages/shared/      zod schemas the web forms validate with (the database functions enforce the same rules)
brand/                logos and brand assets
.github/workflows/    backup.yml: nightly pg_dump to Cloudflare R2
```

### Web routes (`apps/web/app`)

| Route | What |
|---|---|
| `/`, `/about`, `/events`, `/venue`, `/contact` | public site |
| `/registration`, `/login`, `/forgot-password`, `/profile`, `/dashboard` | student account: sign-up, profile, events, teams, fee, QR badge |
| `/ambassador` | Google Form for school ambassadors; `/card/[code]` and `/ambassador-card/[code].png` = their share card |
| `/wall`, `/wall/leaderboard` | Engagement Wall: type a chit code, answer, climb the boards |
| `/staff`, `/staff/login` | phone scanner for volunteers (check-in) and judges (scoring); queues scans offline |
| `/admin`, `/admin/login` | admin dashboard (unlinked; password only) |
| `/verify/[code]`, `/certificates/[code]/pdf` | public certificate check and PDF |
| `_sponsors/` | hidden; rename to `sponsors/` to re-enable |

## Run locally

Needs Node ≥ 24.7 and pnpm. Uses the Supabase project directly (no local database).

```bash
pnpm install
pnpm --filter @avantra/shared build     # required: without it /about and /contact return 500
cd apps/web && pnpm dev                 # http://localhost:3000
```

`apps/web/.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (server only, for making staff and walk-in accounts), `NEXT_PUBLIC_STUDENT_SIGNUP`.

| Command (from `apps/web`) | Does |
|---|---|
| `node scripts/access.e2e.mjs` | attacker-style checks with the publishable key (env vars at the top of the file) |
| `node scripts/flows.e2e.mjs` | every role's happy path with throwaway accounts, cleaned up after |
| `pnpm build` | production build |

## Roles

| Role | Created by | Logs in at | Can do |
|---|---|---|---|
| STUDENT | themselves | `/login` | register for events, pay, join teams, play the Wall |
| VOLUNTEER | admin | `/staff` | scan QR badges for check-in |
| JUDGE | admin, for one event | `/staff` | scan a student and score their entry |
| ADMIN | Supabase dashboard + `update "User" set role = 'ADMIN'` | `/admin` | everything |

Roles live in the `"User"` table, never in user-editable metadata. Students read only their own rows (RLS);
every write is a database function that checks the caller's role first. Nobody can write tables directly.

## Feature flags

| Variable | Where | Effect |
|---|---|---|
| `NEXT_PUBLIC_STUDENT_SIGNUP=open` | Vercel | shows the sign-up and login forms; otherwise "opens soon" |
| Auth → "Allow new users to sign up" | Supabase dashboard | the server-side gate for student sign-up |

Open sign-up by turning both on.

## Deployment

| Piece | Where |
|---|---|
| Web | Vercel, root `apps/web`. Env: the four `.env.local` variables above |
| Database, Auth, email | Supabase project `avantra` (Mumbai). Setup steps in [supabase/README.md](supabase/README.md) |

New migrations: add a file to `supabase/migrations/` and apply it (`supabase db push` or the MCP `apply_migration`).

## Current state

- This branch (`supabase`) replaces the old NestJS API, Render and Redis. `main` still runs the old stack
  until Vercel is switched to this branch; then shut down the Render services.
- Ambassadors have no accounts: they apply on the Google Form and get a code; students enter it on their
  profile (`Student.referralCode`).
- The fee is paid by UPI: the student submits the UTR, admin exports an .xlsx, the school marks Paid / Not paid,
  admin uploads it back.
- Still to do:
  GitHub secrets for `backup.yml`, delete the e2e test accounts, event-week dry run.

## Gotchas

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.
- ESLint fails locally: typescript-eslint doesn't support TypeScript 7 yet.
- Students are minors (DPDP Act 2023): collect only the data we need.
- Never commit `.env` files; secrets live in the Vercel and Supabase dashboards.
