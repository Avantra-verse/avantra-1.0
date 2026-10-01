# AVANTRA 2026 — Tech Plan

Event: 19–20 Dec 2026, SSRVM IEMS Sec-20. ~3000 visitors, ~450–550 exhibitors.
ARITHI owns: website, registration, participant DB, QR check-in, scoring, digital certificates, dashboards.

## Repo layout

```
avantra-1.0/
├─ apps/
│  ├─ web/      Next.js — public site, sign-up/login, student + coordinator + judge + admin
│  │            dashboards, volunteer QR scanner (/scan)
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
| Frontend | Next.js (static export) on Vercel | already built; dashboards are client-rendered and call the API |
| API | NestJS 11 + Prisma 6 | typed, modular, fits auth + jobs + webhooks |
| DB | Managed Postgres, Mumbai region (Neon / Railway) | relational data, constraints enforce rules |
| Queue / cache | Redis + BullMQ | emails, certificate PDFs, rate limiting |
| Payments | Razorpay — **school's own account** | brochure: ₹199 goes directly to SSRVM IEMS |
| Email | Resend | OTP, confirmations, badges |
| Files | S3-compatible (R2) | certificate PDFs |

Domains: `avantra.<tld>` (web) and `api.avantra.<tld>` (api) so auth cookies work on the shared parent domain.

## Roles and who sees what

| Role | Can do |
|---|---|
| SCHOOL_COORDINATOR | registers their school; sees **only students of their school** |
| STUDENT | self-registers, picks school from dropdown (APPROVED schools only), registers for events, pays, gets QR badge |
| VOLUNTEER | scans QR at gate / event desks |
| JUDGE | scores assigned registrations |
| ADMIN (ARITHI) | approves schools, manages events, sees everything, exports |

Coordinator scoping is enforced in the API query (`where: { schoolId: me.school.id }`), never in the UI.

## Core flows

1. **School sign-up** → School `PENDING` → ARITHI admin approves → appears in student dropdown.
2. **Student sign-up** → email OTP → picks school → gets `avantraId` (AV26-00123) + random `qrToken`.
3. **Event registration** → Registration `PENDING_PAYMENT` (or `CONFIRMED` if free).
4. **Payment** → API creates Razorpay order → Checkout → client callback (signature verified, optimistic) → **webhook `payment.captured` is source of truth** → Payment `PAID`, Registration `CONFIRMED`. Unique `razorpayPaymentId` makes webhook retries harmless.
5. **Check-in** → QR encodes only the opaque `qrToken` (no personal data) → volunteer scans in `/scan` → API records CheckIn.
6. **Scoring** → judge opens assigned registration → scores per criterion → leaderboard computed by query.
7. **Certificates** → after event, BullMQ job renders PDFs for CONFIRMED + checked-in students, each with a public verify URL.

## Non-negotiables (real users, real money, minors)

- **Minors' data (DPDP Act 2023):** students are under 18 → parent/guardian consent checkbox + parent phone at sign-up; collect only what we need.
- Passwords hashed with argon2; JWT access (15 min) + refresh token in httpOnly cookie, hashed in `Session`.
- Razorpay webhook signature verified; amounts computed server-side from `Event.feePaise`, never from the client.
- Rate-limit auth + OTP endpoints (Redis).
- Daily DB backups + point-in-time restore on managed Postgres.
- **School Wi-Fi is a risk:** scanner must work on mobile data; queue scans offline (IndexedDB) and sync. Printed CSV fallback list per desk.

## Timeline (today: 2 Oct 2026, event: 19 Dec)

| By | Ship |
|---|---|
| 16 Oct | Auth, school sign-up + admin approval, student sign-up, coordinator view |
| 30 Oct | Events, registration, Razorpay (test mode) → **open registrations ~1 Nov** |
| 27 Nov | QR badges, scanner + check-in, judge scoring |
| 10 Dec | Admin dashboards, exports, certificates, load test, dry run with Student Council |
| 19–20 Dec | Event — on-call during event hours |

## Deployment

- **web** → Vercel project `avantra`, root directory **`apps/web`** (change this in Vercel settings).
- **api** → Railway (Docker), `prisma migrate deploy` on release, health check `/health`.
- Envs: `dev` (local docker), `staging` (Razorpay test keys), `prod` (live keys).

## Open questions

1. School's Razorpay account + KYC — start now, KYC can take days.
2. Are ARITHI events (Drone, Robotics, …) paid or free? Separate fee?
3. Do visitors need a free entry pass / QR, or only participants?
4. Final domain name.
