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
| `GET /coordinator/students` | SCHOOL_COORDINATOR | none | 200 `[{ avantraId, grade, user: { name, createdAt } }]` | Only their own school. Empty until the school is approved. |

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
| `POST /admin/staff` | `CreateStaffRequest` `{ role, name, email, password, expiresAt? }` | `expiresAt` defaults to 21 Dec 2026. 409 = email taken. |
| `POST /admin/users/:id/disable` / `enable` | none | Disable logs the user out everywhere. Admins can't be disabled here. |

## Events

| Method + path | Who | Body | Notes |
|---|---|---|---|
| `GET /events` | anyone | none | All events + `spotsLeft` (null = unlimited). `feePaise` is **per student** (19900 = ₹199). |
| `POST /admin/events` | ADMIN | `CreateEventRequest` | 409 = slug taken. |
| `PATCH /admin/events/:id` | ADMIN | `UpdateEventRequest` (any fields) | e.g. `{ registrationOpen: false }` to close. |

Dev data: `pnpm --filter @avantra/api seed-events` creates the brochure's 9 events (team sizes and ARITHI-event fees are placeholders).

## Registration and payment (students)

| Method + path | Body | Success | Notes |
|---|---|---|---|
| `POST /registrations` | `CreateRegistrationRequest` `{ eventId, memberAvantraIds?, teamName?, projectTitle?, topic? }` | 201 registration | Caller = team leader; list only the **other** members' AVANTRA IDs. Exhibition needs `projectTitle` + `topic` (`EXHIBITION_TOPICS`). Free event → `CONFIRMED` now; paid → `PENDING_PAYMENT`. 400 = team size / unknown ID / closed. 409 = full, or someone already registered for this event. |
| `GET /registrations/mine` | none | 200 list | Every registration I'm in, with event, members, latest payment. |
| `DELETE /registrations/:id` | none | 204 | Leader only, unpaid only. |
| `POST /registrations/:id/pay` | none | 201 `{ keyId, orderId, amount, currency, description }` | Leader only. Call again to retry a failed payment. 503 until Razorpay keys are set. |
| `POST /payments/verify` | `VerifyPaymentRequest` (Razorpay's 3 fields) | 200 | Call from Checkout's success handler. |

An unpaid registration holds its spot for 30 minutes. Capacity counts teams.

### Razorpay Checkout on the page

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```
```ts
const o = await api.post(`/registrations/${id}/pay`);
new Razorpay({
  key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
  name: 'AVANTRA 2026', description: o.description,
  handler: (r) => api.post('/payments/verify', r).then(refreshRegistrations),
}).open();
```

Even if the browser closes before `handler` runs, Razorpay's webhook (`POST /payments/webhook`, server-to-server) confirms the registration. Show status from `GET /registrations/mine`, not from the handler alone.
