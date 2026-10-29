# Supabase (branch `supabase`)

Replaces the NestJS API, Render and Redis. Project `avantra` (`pkafbdhwldimkdsqsiqy`, Mumbai).

- `migrations/`: schema, RLS, and every write as a `SECURITY DEFINER` function that checks the caller's role.
- `functions/send-mail/`: sends the emails the database queues in `private.mail_outbox` (fee confirmed, UPI not found, walk-in, contact form).
- `templates/`: Auth email templates (sign-up and reset codes), pasted into the dashboard.

## One-time setup per project

1. Apply `migrations/` in order (MCP `apply_migration` or `supabase db push`).
2. Deploy `functions/send-mail` with JWT verification off (`supabase functions deploy send-mail --no-verify-jwt`).
3. Edge Function secrets: `SMTP_USER`, `SMTP_PASS` (Google Workspace app password), `MAIL_FROM` (e.g. `AVANTRA 2026 <contact@arithi.in>`).
   Until they're set, emails wait in the outbox and go out once they are.
4. Vault secret `send_mail_url` = `https://<project-ref>.supabase.co/functions/v1/send-mail` (SQL: `select vault.create_secret('<url>', 'send_mail_url');`).
5. Optional `Setting` row `contactTo` (comma-separated emails) for the contact form; without it, messages go to every active admin.
6. Vercel (server only, never `NEXT_PUBLIC_`): `SUPABASE_SECRET_KEY` (Settings → API keys → secret key). Needed to make staff and walk-in accounts.

## Checking email

```sql
select id, "to", subject, attempts, "sentAt", "lastError" from private.mail_outbox order by id desc limit 20;
```

Failed sends retry 2, 6, 18 and 54 minutes later, then stop with `lastError` set. To send one again: `update private.mail_outbox set attempts = 0, "nextTryAt" = now() where id = …;`
