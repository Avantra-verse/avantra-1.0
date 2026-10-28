# AVANTRA 2026

Website, registration, payments, QR check-in, judging, the Engagement Wall and certificates for AVANTRA 2026,
a two-day school science fest (19–20 Dec 2026, SSRVM IEMS Sec-20). Built and run by ARITHI.

Live: web https://avantra.arithi.in · API https://api.avantra.arithi.in (`/health`)

## Docs

| File | Read it for |
|---|---|
| [docs/architecture.md](docs/architecture.md) | the original plan: stack choices, auth rules, core flows, event-day checklist, load test. Partly out of date: see [Current state](#current-state) |
| [docs/api.md](docs/api.md) | every endpoint, its body and responses, for frontend work |
| [apps/web/DESIGN.md](apps/web/DESIGN.md) | the "Ember" design system (colours, type, components) |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | the data model (source of truth) |
| [apps/api/.env.example](apps/api/.env.example) | every API env var, with comments |

## Repo layout

pnpm monorepo (`pnpm@12.8.1`). The API is the only thing that touches the database.

```
apps/
  web/                Next.js 16 (Tailwind v4, framer-motion), deployed on Vercel
    app/              routes (see below)
    components/       site sections; account/ = login, registration, UPI fee; multiverse/ = home scroll animation
    content/site.ts   event copy, dates, UPI details, gallery
    lib/              api.ts (API_URL, feature flags), countdown, share
  api/                NestJS 12 + Prisma 6 + BullMQ (Redis), deployed on Render
    src/              one controller per area (below); auth/ = sessions, passwords, guards
    prisma/           schema.prisma + migrations/ (0001–0017)
    scripts/          create-admin, seed-events
    test/             end-to-end tests (*.e2e.ts)
packages/shared/      zod schemas + enums used by web and API: forms validate with the server's rules
infra/                docker-compose for local Postgres + Redis
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
| `/admin`, `/admin/login` | admin dashboard (unlinked; needs an emailed code) |
| `/verify/[code]` | public certificate check |
| `_sponsors/` | hidden; rename to `sponsors/` to re-enable |

### API areas (`apps/api/src`)

| File | Handles |
|---|---|
| `auth/` | sign-up with email code, login, Google sign-in, sessions, password reset, role guards |
| `profile`, `events`, `registrations`, `teams` controllers | student profile, event list, registration, teams of 3 (invite code, QR, join requests) |
| `upi-sheet.ts`, `razorpay.ts` | the ₹199 exhibition fee: UPI UTR checked by the school in Excel (default) or Razorpay |
| `staff.controller.ts` | QR check-in and judge scoring |
| `wall.controller.ts`, `wall-sheet.ts`, `chits.ts` | Engagement Wall challenges, attempts, leaderboards, chit printing |
| `certificates.controller.ts`, `certificate.ts` | certificate PDFs and verification |
| `admin.controller.ts`, `reports.controller.ts` | admin dashboard, exports (CSV / xlsx), referral-code counts |
| `contact.controller.ts`, `mail.service.ts` | contact form; all email goes through a BullMQ queue (5 retries) |

## Run locally

Needs Node ≥ 24.7, pnpm and Docker.

```bash
pnpm install
pnpm db:up                                     # Postgres + Redis in Docker
cp apps/api/.env.example apps/api/.env
pnpm --filter @avantra/api db:migrate          # create tables
pnpm --filter @avantra/shared build            # required: without it /about and /contact return 500
pnpm --filter @avantra/api seed-events         # the event list
pnpm --filter @avantra/api create-admin you@example.com "Your Name"   # prints a password once
pnpm dev:api                                   # http://localhost:4000/health
pnpm dev:web                                   # http://localhost:3000
```

Without `SMTP_HOST`, emails (sign-up codes, resets) are printed to the API console instead of sent.

| Command | Does |
|---|---|
| `pnpm test` | unit tests in every package |
| `pnpm --filter @avantra/api test:e2e` | end-to-end tests against the local DB |
| `pnpm --filter @avantra/api db:studio` | browse the database |
| `pnpm build` | build everything |

## Roles

| Role | Created by | Logs in at | Can do |
|---|---|---|---|
| STUDENT | themselves | `/login` | register for events, pay, join teams, play the Wall |
| VOLUNTEER | admin | `/staff` | scan QR badges for check-in |
| JUDGE | admin, for one event | `/staff` | scan a student and score their entry |
| ADMIN | `create-admin` script | `/admin` | everything |

Every API route checks the role on the server. Sessions are a random token in an httpOnly cookie (only its
SHA-256 is stored), passwords are argon2id, and errors never reveal whether an account exists.

## Feature flags

| Variable | Where | Effect |
|---|---|---|
| `STUDENT_SIGNUP=open` | API (Render) | allows student sign-up; otherwise 403 |
| `NEXT_PUBLIC_STUDENT_SIGNUP=open` | web (Vercel) | shows the sign-up and login forms; otherwise "opens soon" |
| `NEXT_PUBLIC_PAYMENTS=razorpay` | web | uses Razorpay checkout instead of the UPI QR |
| `NEXT_PUBLIC_API_URL` | web | API base URL |

Open sign-up by setting both signup flags and redeploying both apps.

## Deployment

| Piece | Host |
|---|---|
| Web | Vercel, root `apps/web`, deploys `main` |
| API | Render web service (Singapore), auto-deploys on commit. Start: `cd apps/api && node dist/main` |
| Database | Supabase Postgres (Mumbai). RLS on every table so the Data API is locked |
| Redis | Render Key Value, `noeviction` (it holds the email queue, not a cache) |

Render build command (Render's `/usr/bin` is read-only, so no `corepack enable`):

```
corepack pnpm install --frozen-lockfile && corepack pnpm --filter @avantra/shared build && corepack pnpm --filter @avantra/api build
```

Migrations: `pnpm --filter @avantra/api db:deploy` with the production `DATABASE_URL` / `DIRECT_URL`.
The API must stay on its own `api.avantra.arithi.in` domain: the session cookie is `SameSite=Lax` and would
not be sent from `onrender.com`.

## Current state

- Live: site, API, 9 events, admin tools. Student sign-up is gated (see flags).
- Ambassadors have no accounts: they apply on the Google Form and get a code; students enter it on their
  profile (`Student.referralCode`).
- The fee is paid by UPI: the student submits the UTR, admin exports an .xlsx, the school marks Paid / Not paid,
  admin uploads it back. Razorpay code is kept for other events.
- Still to do: email sending (Render free blocks SMTP), the school's UPI ID in `apps/web/content/site.ts` and
  QR at `apps/web/public/upi-qr.png`, GitHub secrets for `backup.yml`, event-week dry run.

## Gotchas

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.
- ESLint fails locally: typescript-eslint doesn't support TypeScript 7 yet.
- Students are minors (DPDP Act 2023): collect only the data we need.
- Never commit `.env` files; production secrets live in the Render, Vercel and Supabase dashboards.
