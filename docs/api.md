# AVANTRA API — for the frontend

Base URL: `http://localhost:4000` (dev), `https://api.avantra.arithi.in` (prod).

Request bodies and their validation rules are the zod schemas in `packages/shared/src/index.ts`. Import them in the web app to validate forms with the same rules the API uses.

## Calling the API

```ts
fetch(`${API}/auth/login`, {
  method: 'POST',
  credentials: 'include',            // required: the session is an httpOnly cookie
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
```

- Always send `credentials: 'include'`. The browser stores and sends the session cookie itself; JS never sees it.
- Logged in? Call `GET /auth/me`. 200 = logged in, 401 = not.
- Errors are JSON `{ message, ... }`. Validation errors (400) also have `issues: [{ path, message }]` for showing under each field.
- 429 = too many attempts; show "Try again in a minute".

## Auth endpoints

| Method + path | Body (shared schema) | Success | Notes |
|---|---|---|---|
| `POST /auth/register` | `RegisterRequest` `{ role, name, email, password }` | 202 | Emails a 6-digit code. Same response even if the email is taken. Then show the code screen. |
| `POST /auth/register/verify` | `VerifyEmailRequest` = register fields + `code` | 200 `Me` + cookie | Creates the account and logs in. Keep the form values in memory and resend them with the code. 400 = wrong/expired code. |
| `POST /auth/login` | `LoginRequest` `{ role, email, password }` | 200 `Me` + cookie | 401 "Invalid email or password" for every failure, including the wrong tab. |
| `POST /auth/google` | `GoogleLoginRequest` `{ role, credential }` | 200 `Me` + cookie | `credential` = ID token from the Google Identity Services button. 503 until `GOOGLE_CLIENT_ID` is set. |
| `POST /auth/password/forgot` | `ForgotPasswordRequest` `{ email }` | 202 | Always 202. Then show the code + new password screen. |
| `POST /auth/password/reset` | `ResetPasswordRequest` `{ email, code, password }` | 200 | Logs out all devices; send the user to login. |
| `POST /auth/logout` | none | 204 | |
| `GET /auth/me` | none | 200 `Me` | 401 if not logged in. |

`role` is the login tab: `STUDENT` or `SCHOOL_COORDINATOR`.

`Me` = `{ id, email, name, role, profileComplete }`. If `profileComplete` is false, send the user to the profile step before the dashboard (see Profiles below).

## Local dev

1. `pnpm db:up` (Docker: Postgres + Redis)
2. `cp apps/api/.env.example apps/api/.env`, set `CODE_SECRET`
3. `pnpm --filter @avantra/api db:deploy`, then `pnpm dev:api`
4. Sign-up codes are printed in the API console (no real email in dev).

## Profiles (after sign-up, when `profileComplete` is false)

| Method + path | Who | Body | Success | Notes |
|---|---|---|---|---|
| `GET /schools` | anyone | none | 200 `[{ id, name, city }]` | Approved schools only, for the dropdown. Add an "Others" option yourself. |
| `POST /profile/student` | STUDENT | `StudentProfile` | 201 student | Send `schoolId` **or** `otherSchoolName`, not both. `guardianConsent` must be `true`. Returns `avantraId` (e.g. `AV26-7K3QX`) and `qrToken`. 403 = school not approved. 409 = already done. |
| `POST /profile/school` | SCHOOL_COORDINATOR | `SchoolProfile` | 201 school | Starts `PENDING` until an admin approves. 409 = school name+city taken, or coordinator already has one. |
| `GET /profile` | any logged-in | none | 200 `{ student, school }` | Student: avantraId, qrToken (for the QR badge), school. Coordinator: school with `status`. |
| `GET /coordinator/students` | SCHOOL_COORDINATOR | none | 200 `[{ avantraId, grade, feePaidAt, user: { name, createdAt } }]` | Only their own school. Empty until the school is approved. |

## Staff and admin login

| Method + path | Body | Success | Notes |
|---|---|---|---|
| `POST /auth/staff/login` | `PasswordLoginRequest` `{ email, password }` | 200 `Me` + cookie | Volunteers and judges only. Sessions last 12 h. |
| `POST /auth/admin/login` | `PasswordLoginRequest` | 202 | Right password → emails a code. Show the code screen. |
| `POST /auth/admin/login/verify` | `AdminVerifyRequest` `{ email, code }` | 200 `Me` + cookie | Sessions last 12 h. |

Admin accounts are created only with `pnpm --filter @avantra/api create-admin <email> "<name>"` (prints a one-time password).

## Admin (role ADMIN only, otherwise 403)

| Method + path | Body | Notes |
|---|---|---|
| `GET /admin/schools?status=PENDING` | none | `status` optional. Includes coordinator contact and student count. |
| `POST /admin/schools/:id/approve` / `reject` | none | Emails the coordinator. |
| `GET /admin/students/unlinked` | none | Students who picked "Others". |
| `POST /admin/students/:userId/link` | `LinkStudentRequest` `{ schoolId }` | School must be approved. |
| `GET /admin/staff` | none | Volunteers and judges. |
| `POST /admin/staff` | `CreateStaffRequest` `{ role, name, email, password, expiresAt?, eventId? }` | Judges need `eventId` (the event they score). `expiresAt` defaults to 21 Dec 2026. 409 = email taken. |
| `POST /admin/staff/:id/assign` | `AssignJudgeRequest` `{ eventId }` | Move a judge to another event. |
| `GET /admin/events/:id/leaderboard` | none | Teams ranked by the average of each judge's total. `score` null = not judged yet. |
| `POST /admin/users/:id/disable` / `enable` | none | Disable logs the user out everywhere. Admins can't be disabled here. |

## Events

| Method + path | Who | Body | Notes |
|---|---|---|---|
| `GET /events` | anyone | none | All events + `spotsLeft` (null = unlimited). |
| `POST /admin/events` | ADMIN | `CreateEventRequest` | 409 = slug taken. |
| `PATCH /admin/events/:id` | ADMIN | `UpdateEventRequest` (any fields) | e.g. `{ registrationOpen: false }` to close, or `judgingCriteria: [...]` (each 0–10; default: Innovation, Scientific understanding, Presentation, Practical impact). |

Dev data: `pnpm --filter @avantra/api seed-events` creates the brochure's 9 events (team sizes are placeholders).

## AVANTRA fee and event registration (students)

The ₹199 fee (`AVANTRA_FEE_PAISE` in shared) is paid **once per student** and makes them an AVANTRA participant. Without it they can't register for any event or join a team. Event registrations are then free. Show fee status from `GET /profile` → `student.feePaidAt` (null = unpaid).

| Method + path | Body | Success | Notes |
|---|---|---|---|
| `POST /payments/fee` | none | 201 `{ keyId, orderId, amount, currency, description }` | Opens Razorpay Checkout (below). Call again to retry a failed payment. 403 = no profile yet, 409 = already paid, 503 until Razorpay keys are set. |
| `POST /payments/verify` | `VerifyPaymentRequest` (Razorpay's 3 fields) | 200 | Call from Checkout's success handler, then re-fetch `/profile`. |
| `POST /registrations` | `CreateRegistrationRequest` `{ eventId }` | 201 | 403 = fee not paid, 400 = closed, 409 = full or already registered. |
| `GET /registrations/mine` | none | 200 list | With event and `teamMember.team` (null = no team yet). |
| `DELETE /registrations/:id` | none | 204 | Withdraw from an event. 409 = leave your team first. The fee is not refunded. |

`capacity` counts participants.

## Teams (one team per student per event)

Only students registered for that event can create or join its team. Solo events (`teamMax` 1) get a team of one automatically — no team UI needed for them.

| Method + path | Who | Body | Notes |
|---|---|---|---|
| `POST /teams` | registered for the event | `CreateTeamRequest` `{ eventId, name, projectTitle?, topic? }` | Caller becomes leader. Exhibition needs `projectTitle` + `topic`. Returns team with `inviteCode`. 409 = already in a team. |
| `POST /teams/join` | registered for the event | `JoinTeamRequest` `{ inviteCode }` | Case-insensitive. 403 = not registered for that event, 404 = bad code, 409 = full or already in another team. |
| `GET /teams/:id` | members | none | 404 for non-members (the invite code is never shown to them). |
| `PATCH /teams/:id` | leader | `UpdateTeamRequest` | name / projectTitle / topic |
| `POST /teams/:id/invite-code` | leader | none | New code; old one stops working. |
| `DELETE /teams/:id/members/:registrationId` | leader | none | Removed member stays registered for the event, just no team. |
| `POST /teams/:id/leave` | member | none | If the leader leaves, the earliest-joined member becomes leader. Last member out deletes the team. |

Team view: `{ id, name, inviteCode, projectTitle, topic, event, members: [{ registrationId, name, avantraId, isLeader, joinedAt }], complete, full }`. `complete` = at least `teamMin` members. Members are locked once judging starts (409).

### Razorpay Checkout on the page

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```
```ts
const o = await api.post('/payments/fee');
new Razorpay({
  key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
  name: 'AVANTRA 2026', description: o.description,
  handler: (r) => api.post('/payments/verify', r).then(refreshProfile),
}).open();
```

Even if the browser closes before `handler` runs, Razorpay's webhook (`POST /payments/webhook`, server-to-server) marks the student paid and emails them. Show status from `GET /profile`, not from the handler alone.

## Event day (`/staff` pages, phone-first)

**QR badge:** render `GET /profile` → `student.qrToken` as a QR code, with the `avantraId` printed below it. The token is random and carries no personal data. If a QR won't scan, staff type the AVANTRA ID instead (send `avantraId` instead of `qrToken`).

| Method + path | Who | Body | Success | Notes |
|---|---|---|---|---|
| `POST /staff/checkin` | VOLUNTEER, JUDGE, ADMIN | `CheckInRequest` `{ qrToken \| avantraId, eventId?, scannedAt? }` | 200 `{ student: { name, avantraId, grade, school, feePaid }, checkedInAt, alreadyCheckedIn }` | No `eventId` = main gate. 403 + `student` = fee unpaid or not registered for that event (show the name, send them to the desk). 404 = unknown badge. Offline: queue scans and send them later with `scannedAt` (max 48 h old). |
| `GET /staff/judge/teams` | JUDGE | none | 200 `{ event, teams: [{ id, name, projectTitle, topic, members, scored }] }` | The judge's queue for their assigned event. |
| `POST /staff/judge/lookup` | JUDGE | `JudgeLookupRequest` `{ qrToken \| avantraId }` | 200 team | Scan any member's badge → their team in the judge's event. 404 = not registered / no team. |
| `GET /staff/judge/teams/:id` | JUDGE | none | 200 team | Same shape as lookup. |
| `POST /staff/judge/scores` | JUDGE | `SubmitScoresRequest` `{ teamId, scores: [{ criterion, points }] }` | 200 team | Points 0–`MAX_POINTS` (10). Re-sending corrects the judge's own scores. Once a team has a score, its members are locked. |

Team (judge view): `{ id, name, projectTitle, topic, members: [{ name, avantraId }], criteria, maxPoints, myScores: { [criterion]: points } }`.

## Admin desk, dashboard and exports (ADMIN)

| Method + path | Body | Notes |
|---|---|---|
| `GET /admin/stats` | none | Dashboard numbers: `students { total, paid, unpaid, unlinkedSchool }`, `schools { PENDING, APPROVED, REJECTED }`, `fees { onlinePaise, onlineCount, cashPaise, cashCount }`, `gate.checkedInToday`, `events[]` with `registrations`, `teams`, `deskScans`. |
| `POST /admin/students/:avantraId/mark-paid` | `MarkPaidRequest` `{ note? }` | Cash fee for an online sign-up. Records which admin took it. 409 = already paid. |
| `POST /admin/walk-in` | `WalkInRequest` = student profile + `{ name, email, note? }` | Walk-in: account + profile + cash fee in one step. Returns `{ avantraId, qrToken, name }` (print the badge). Email can be the parent's; they set a password via "Forgot password". 409 = email exists (use mark-paid). |
| `POST /admin/teams/:id/rank` | `SetRankRequest` `{ rank: 1 \| 2 \| 3 \| null }` | Winners, after judging. Shows on certificates. |
| `GET /admin/export/students.csv` | none | Download. Opens in Excel. |
| `GET /admin/export/registrations.csv?eventId=` | none | `eventId` optional. Teams, ranks, certificate IDs. |
| `GET /admin/export/payments.csv` | none | Reconcile with Razorpay settlements and the cash box (`cashTakenBy`). |

CSV downloads need the session cookie: open them with `fetch(..., { credentials: 'include' })` and save the blob, or a plain link on the same site.

## Certificates

| Method + path | Who | Notes |
|---|---|---|
| `POST /admin/events/:id/certificates` | ADMIN | After the event (set ranks first): issues a certificate to every registrant who checked in at least once. Re-run is safe. Returns `{ issuedNow, issued, notCheckedIn }`. |
| `GET /certificates/:code` | anyone | Verify page data: `{ valid, name, school, event, rank, issuedAt, verifyUrl }`. 404 = invalid. |
| `GET /certificates/:code/pdf` | anyone | The PDF (A4 landscape). |

Students find their codes in `GET /registrations/mine` → `certificateCode` (null = not issued). The frontend needs a public page at **`/verify/[code]`**; that URL is printed on every certificate.
