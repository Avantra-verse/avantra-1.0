// Sends the emails queued in private.mail_outbox (supabase/migrations/*_mail_staff_walkin_contact.sql).
// Woken by the database (pg_net) after each queued email and once a minute while one is due; it takes no input.
// shortcut: no auth (deployed with verify_jwt off); a caller can only make it send what's already queued. Add a shared key if it's abused.
// Secrets: SMTP_USER, SMTP_PASS (Google Workspace app password), MAIL_FROM (e.g. "AVANTRA 2026 <contact@arithi.in>"), optional SMTP_HOST.
// Port 465: Supabase blocks 25 and 587.
import postgres from "npm:postgres@3.4.5";
import nodemailer from "npm:nodemailer@6.9.16";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const user = Deno.env.get("SMTP_USER");
const smtp = user
  ? nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: Deno.env.get("SMTP_PASS") } })
  : null;

type Mail = { id: number; to: string; subject: string; text: string; replyTo: string | null };

Deno.serve(async () => {
  if (!smtp) {
    console.error("SMTP_USER is not set: emails stay queued");
    return Response.json({ message: "SMTP not configured" }, { status: 503 });
  }
  // Claim up to 15 due emails. Moving nextTryAt ahead stops another run sending them too; ~3 s each fits the 2-minute lease.
  // Failed ones are tried again 2, 6, 18 and 54 minutes later, then left with lastError.
  const due = await sql<Mail[]>`
    UPDATE private.mail_outbox SET "attempts" = "attempts" + 1, "nextTryAt" = now() + interval '2 minutes' * power(3, "attempts")
    WHERE "id" IN (SELECT "id" FROM private.mail_outbox WHERE "sentAt" IS NULL AND "attempts" < 5 AND "nextTryAt" <= now()
      ORDER BY "id" LIMIT 15 FOR UPDATE SKIP LOCKED)
    RETURNING "id", "to", "subject", "text", "replyTo"`;
  let sent = 0;
  for (const m of due) {
    try {
      await smtp.sendMail({ from: Deno.env.get("MAIL_FROM") ?? user, to: m.to, replyTo: m.replyTo ?? undefined, subject: m.subject, text: m.text });
      await sql`UPDATE private.mail_outbox SET "sentAt" = now(), "lastError" = NULL WHERE "id" = ${m.id}`;
      sent++;
    } catch (e) {
      // The only trace of a bad SMTP password or a rejected address.
      console.error(`Email ${m.id} to ${m.to} failed: ${e}`);
      await sql`UPDATE private.mail_outbox SET "lastError" = ${String(e).slice(0, 500)} WHERE "id" = ${m.id}`;
    }
  }
  return Response.json({ sent, failed: due.length - sent });
});
