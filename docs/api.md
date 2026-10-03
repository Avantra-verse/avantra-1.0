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

`Me` = `{ id, email, name, role, profileComplete }`. If `profileComplete` is false, send the user to the profile step before the dashboard (profile endpoints come in build step 2).

## Local dev

1. `pnpm db:up` (Docker: Postgres + Redis)
2. `cp apps/api/.env.example apps/api/.env`, set `CODE_SECRET`
3. `pnpm --filter @avantra/api db:deploy`, then `pnpm dev:api`
4. Sign-up codes are printed in the API console (no real email in dev).
