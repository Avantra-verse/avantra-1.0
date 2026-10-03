# AVANTRA 2026 — Tech Plan

Event: 19–20 Dec 2026, SSRVM IEMS Sec-20. ~3000 visitors, ~450–550 exhibitors.
ARITHI owns: website, registration, participant DB, QR check-in, scoring, digital certificates, dashboards.

## Repo layout

```
avantra-1.0/
├─ apps/
│  ├─ web/      Next.js — public site, sign-up/login, student + coordinator + judge + admin
│  │            dashboards, /staff scanner (volunteers + judges), /admin
│  └─ api/      NestJS + Prisma — the only thing that touches the database
│     └─ prisma/schema.prisma   data model (source of truth)
├─ packages/
│  └─ shared/   zod schemas + enums used by both web and api
├─ infra/       docker-compose for local Postgres + Redis
└─ docs/        this file, runbooks
```

Planned API modules (add each as a folder in `apps/api/src/` when built):
`auth`, `schools`, `students`, `events`, `registrations`, `payments`, `checkin`, `scoring`, `certificates`, `admin`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (static export) on Vercel Hobby | already built; dashboards are client-rendered and call the API |
| API | NestJS 12 + Prisma 6 | typed, modular, fits auth + jobs + webhooks |
| DB | Supabase Postgres (free), **Singapore** | same region as API; use pooler URL + `directUrl` for migrations |
| Queue / cache | Redis + BullMQ | emails, announcements, certificate PDFs, rate limiting |
| Payments | Razorpay — **school's own account** | brochure: ₹199 goes directly to SSRVM IEMS |
| Email | Google Workspace `noreply@arithi.in` via SMTP (`nodemailer`) | 2,000/day; provider swap = `.env` change only (Brevo / SES as fallback) |
| Files | Cloudflare R2 (free) | certificate PDFs, DB backups |
| Auth libs | `google-auth-library`, Node `crypto.argon2` (argon2id, 19 MiB, 2 passes) | OWASP first choice, built into Node ≥24.7, no native build |
| Monitoring | Sentry free + UptimeRobot free | errors + `/health` uptime |

Domains: **`avantra.arithi.in`** (web) and **`api.avantra.arithi.in`** (api). Auth cookie is host-only on the API (`HttpOnly; Secure; SameSite=Lax`, no `Domain`), so other `*.arithi.in` sites never receive it. CORS allows only `https://avantra.arithi.in`. Workspace mail needs SPF + DKIM + DMARC on `arithi.in`.

## Roles and who sees what

| Role | Created by | Logs in at | Can do |
|---|---|---|---|
| STUDENT | self (Google or email+password) | `/login` → Student tab | registers for events, pays, gets QR badge |
| SCHOOL_COORDINATOR | self, then admin approval | `/login` → Coordinator tab | sees **only students of their school** |
| VOLUNTEER | admin | `/staff` (mobile) | scans QR for attendance — nothing else |
| JUDGE | admin, assigned to one event | `/staff` (mobile) | scans QR → scores that student's entry in their event |
| ADMIN (ARITHI) | seed script only | `/admin` (unlinked) | approves schools, manages all data, offline registration |

## Auth decisions

- Public login/register: two tabs (Student / School Coordinator). Tab sets role at sign-up. Google sign-in or email+password on both.
- Google sign-in gives name + email only → "complete profile" step for the rest; dashboard locked until done.
- Email+password sign-up verified with 6-digit email code.
- **No account enumeration:** every failure says "Invalid email or password". Forgot-password always says "If that email is registered, we sent a code". Wrong-tab login gets the same generic error.
- Student gives own email/phone + parent email/phone ("same as mine" tick copies them).
- School dropdown shows APPROVED schools + "Others" (typed name, `schoolId` null). Admin links them later.
- `/staff` and `/admin` share auth code but are separate pages. Admin requires a second step (emailed code).
- Staff (volunteer/judge) accounts expire 21 Dec 2026; admin can disable any account.
- **Every API route checks role server-side.** Hidden buttons are not security. Coordinator scoping is in the query (`where: { schoolId: me.school.id }`).
- Offline registration by admin; payment marked `OFFLINE` so school money reconciles.

## Core flows

1. **School sign-up** → School `PENDING` → ARITHI admin approves → appears in student dropdown.
2. **Student sign-up** → email OTP → picks school → gets `avantraId` (AV26-00123) + random `qrToken`.
3. **Event registration** → Registration `PENDING_PAYMENT` (or `CONFIRMED` if free).
4. **Payment** → API creates Razorpay order → Checkout → client callback (signature verified, optimistic) → **webhook `payment.captured` is source of truth** → Payment `PAID`, Registration `CONFIRMED`. Unique `razorpayPaymentId` makes webhook retries harmless.
5. **Check-in** → QR encodes only the opaque `qrToken` (no personal data) → volunteer scans in `/staff` → API records CheckIn.
6. **Scoring** → judge scans student QR in `/staff` → opens that student's registration in the judge's event → scores per criterion → leaderboard computed by query.
7. **Certificates** → after event, BullMQ job renders PDFs for CONFIRMED + checked-in students, each with a public verify URL.

## Non-negotiables (real users, real money, minors)

- **Minors' data (DPDP Act 2023):** students are under 18 → parent/guardian consent checkbox + parent phone at sign-up; collect only what we need.
- Passwords hashed with argon2id (`node:crypto`). Sessions: random token in an httpOnly cookie (30 days), only its SHA-256 stored in `Session`; logout or password reset deletes it instantly (no JWTs). Unsafe requests from any origin other than the web app are rejected (CSRF).
- Razorpay webhook signature verified; amounts computed server-side from `Event.feePaise`, never from the client.
- Rate-limit auth + OTP endpoints (Redis).
- Nightly `pg_dump` to R2 via GitHub Action (Supabase free has no backups). Test a restore once before 1 Nov.
- **School Wi-Fi is a risk:** scanner must work on mobile data; queue scans offline (IndexedDB) and sync. Printed CSV fallback list per desk.

## Build order

No dates. Build in this order and ship each piece as it finishes.

1. DB changes, email+password + email code, sessions, Google sign-in
2. School sign-up + admin approval, student sign-up + profile, coordinator view, `/admin` two-step login
3. Events, registration, Razorpay test mode + webhook
4. QR badges, `/staff` scanner + check-in, judge scoring
5. Admin dashboard, exports, offline registration, certificates
6. Deploy (Render + Supabase + DNS), end-to-end test
7. Before the event (19–20 Dec): load test, Student Council dry run, venue Wi-Fi check

## Deployment

| Piece | Oct (dev) | From 1 Nov (registrations open) |
|---|---|---|
| web | Vercel Hobby, root dir `apps/web` | same |
| api | Render free, Singapore (sleeps after 15 min idle) | **Railway Hobby $5, Singapore** |
| Redis | Render Key Value free | Railway Redis |
| DB | Supabase free, Singapore | same + nightly backup |

- `prisma migrate deploy` on release; health check `/health`.
- Envs: `dev` (local docker), `staging` (Razorpay test keys), `prod` (live keys).

## Costs (Oct–Dec 2026, ~₹88/$)

| Item | Cost |
|---|---|
| `arithi.in` domain | already owned |
| Google Workspace noreply mailbox | ~₹150 (₹49.5/mo intro) |
| Railway Nov–Dec | ~₹900–1,800 |
| Vercel, Render, Supabase, R2, Sentry, UptimeRobot | ₹0 |
| **Total** | **~₹1,050–1,950** |

Optional: Supabase Pro ~₹2,200/mo. Razorpay fee ~2% + GST ≈ ₹4.70 per ₹199 payment, deducted from the school's settlement — agree with SSRVM who bears it.

## Open questions

1. School's Razorpay account + KYC — start now, KYC can take days.
2. Are ARITHI events (Drone, Robotics, …) paid or free? Separate fee?
3. Do visitors need a free entry pass / QR, or only participants?
4. Who bears the Razorpay fee: school, or a convenience fee to students?
