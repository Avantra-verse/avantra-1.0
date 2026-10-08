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
| Frontend | Next.js 16 on Vercel Hobby | pages are client-rendered and call the API; `/verify/[code]` is the only dynamic route |
| API | NestJS 12 + Prisma 6 | typed, modular, fits auth + jobs + webhooks |
| DB | Supabase Postgres (free), **Singapore** | same region as API; use pooler URL + `directUrl` for migrations |
| Queue / cache | Redis + BullMQ | email queue (retries 5×). Rate limits and the Wall board cache are in API memory |
| Payments | Razorpay — **school's own account** | brochure: ₹199 goes directly to SSRVM IEMS |
| Email | Google Workspace `noreply@arithi.in` via SMTP (`nodemailer`) | 2,000/day; provider swap = `.env` change only (Brevo / SES as fallback) |
| Files | Cloudflare R2 (free) | certificate PDFs, DB backups |
| Auth libs | `google-auth-library`, Node `crypto.argon2` (argon2id, 19 MiB, 2 passes) | OWASP first choice, built into Node ≥24.7, no native build |
| Monitoring | Sentry free (`SENTRY_DSN`, API only) + UptimeRobot free | unexpected errors + `/health` uptime |

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
3. **Science Exhibition fee (₹199, once per student; everything else is free)** → API creates Razorpay order → Checkout → client callback (signature verified, optimistic) → **webhook `payment.captured` is source of truth** → Payment `PAID`, `Student.feePaidAt` set. Unique `razorpayPaymentId` makes webhook retries harmless. Unpaid = can't register for the exhibition; entry, other events and the Engagement Wall are free.
4. **Event registration** (free, paid students only) → **teams** form per event via 6-char invite codes; solo events get a team of one.
5. **Check-in** → QR encodes only the opaque `qrToken` (no personal data) → volunteer scans in `/staff` → API records CheckIn.
6. **Scoring** → judge scans student QR in `/staff` → opens that student's registration in the judge's event → scores per criterion → leaderboard computed by query.
7. **Certificates** → after the event, PDFs for every checked-in registrant, each with a public verify URL.
8. **ARITHI Engagement Wall** → student types a chit code → challenge → answer auto-checked (3 tries typed, 1 multiple choice) → points once per challenge → individual + school leaderboards (public, cached 5 s). Admin opens/closes the Wall, freezes the board for the final hour, adds challenges in bulk, reprints lost chits, re-grades.

## Non-negotiables (real users, real money, minors)

- **Minors' data (DPDP Act 2023):** students are under 18 → parent/guardian consent checkbox + parent phone at sign-up; collect only what we need.
- Passwords hashed with argon2id (`node:crypto`). Sessions: random token in an httpOnly cookie (30 days), only its SHA-256 stored in `Session`; logout or password reset deletes it instantly (no JWTs). Unsafe requests from any origin other than the web app are rejected (CSRF).
- Razorpay webhook signature verified; the fee amount is a server constant (`AVANTRA_FEE_PAISE`), never taken from the client.
- Rate limits count per person (session, or the email in a login/sign-up form), not per IP: a venue on one Wi-Fi IP must not get blocked. Login/sign-up/reset also cap at 300/min per IP.
- Nightly `pg_dump` to R2: `.github/workflows/backup.yml` (Supabase free has no backups). Test a restore once before registrations open.
- **School Wi-Fi is a risk:** `/staff` works on mobile data, and when offline keeps scans on the phone (localStorage) and sends them with their scan time later. Printed CSV fallback list per desk.

## Build order

No dates. Build in this order and ship each piece as it finishes.

1. DB changes, email+password + email code, sessions, Google sign-in
2. School sign-up + admin approval, student sign-up + profile, coordinator view, `/admin` login (password only, unlisted)
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

## Event-day readiness

**Load test** (production build, one API process, local Postgres, 3,000 seeded students, 50 volunteers):

| Scenario | Requests | Errors | p95 / p99 |
|---|---|---|---|
| 1,500 students each opening and answering a chit every 5–15 s, 200 leaderboard screens polling every 10 s, 50 volunteers scanning every 3 s, 300 password logins in the first minute | 70,000 in 3 min (360/s) | 0 | ≤ 67 ms / ≤ 98 ms on every endpoint |
| Same, with the DB pool cut to 5 connections (a small cloud server's default) | 47,500 in 2 min | 0 | ≤ 79 ms / ≤ 139 ms |
| All 3,000 students active at once (620/s; far above a real event day) | 83,500 in 2 min | 0 | slows to 1–4 s: one Node process is the limit |

A real event day is well under the first row. If more headroom is wanted, give the API 2 vCPUs or run a second instance (rate limits and the 5 s board cache are per instance, which is fine).

**Before registrations open**
- [ ] Email through a transactional provider (Brevo / Amazon SES / Resend) or Workspace with a fallback ready: sign-up codes, receipts and resets for ~3,000 students. SPF, DKIM, DMARC on `arithi.in`.
- [ ] API on an always-on plan (Railway Hobby), not a sleeping free tier. `DATABASE_URL` = Supabase pooler with `?pgbouncer=true&connection_limit=10`.
- [ ] Razorpay live keys and the webhook URL `https://api.avantra.arithi.in/payments/webhook` with its secret.
- [ ] `SENTRY_DSN` set; UptimeRobot on `/health`.
- [ ] Backup secrets in GitHub (see `backup.yml`); run it once by hand and restore it into a scratch database.
- [ ] `create-admin` with a real mailbox; long password in a password manager.

**Event week**
- [ ] Dry run with the Student Council: sign-up, check-in on Android and iPhone, judging, Wall, certificates.
- [ ] Check the venue Wi-Fi and mobile signal at the gate and desks; volunteers log in to `/staff` before doors open.
- [ ] Print the students CSV per desk as a fallback; chits printed from Admin → Wall.
- [ ] Wall: open it on the day, freeze in the final hour, unfreeze at the ceremony.

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
2. ~~Are ARITHI events paid?~~ Resolved: only the Science Exhibition is paid (₹199 once); all else free.
3. Do visitors need a free entry pass / QR, or only participants?
4. Who bears the Razorpay fee: school, or a convenience fee to students?
