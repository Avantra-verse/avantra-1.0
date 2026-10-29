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

// The Ember look of supabase/templates/*.html around the queued plain text (kept as the text part).
// Text is escaped: the contact form puts visitors' words in it.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const FONT = "Mukta,'Segoe UI',Helvetica,Arial,sans-serif";
function html(m: Mail) {
  const [, label, title] = m.subject.match(/^(AVANTRA[^:]*):\s*(.+)$/) ?? [null, "AVANTRA 2026", m.subject];
  const body = m.text.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#b9ab9a;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  // Students' emails (AVANTRA 2026: …) point to their dashboard; the contact form goes to admins.
  const button = label === "AVANTRA 2026"
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr><td style="background:#b3121e;border-radius:10px;">
        <a href="https://avantra.arithi.in/dashboard" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:16px;font-weight:700;color:#f4ead9;text-decoration:none;">Open your dashboard</a></td></tr></table>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(m.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#120e0c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#120e0c;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td align="center" style="padding:0 0 24px;"><img src="https://avantra.arithi.in/brand/avantra-logo-500w.png" width="180" alt="AVANTRA 2026" style="display:block;width:180px;max-width:60%;height:auto;border:0;font-family:${FONT};font-size:30px;font-weight:700;letter-spacing:3px;color:#ff5560;"></td></tr>
<tr><td style="background:#1b1613;border:2px solid #b3121e;border-radius:16px;padding:32px 28px;font-family:${FONT};color:#f4ead9;">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9fd4ff;font-weight:700;">${esc(label)}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#f4ead9;">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</h1>
${body}${button}</td></tr>
<tr><td align="center" style="padding:24px 8px 0;font-family:${FONT};font-size:13px;line-height:1.7;color:#b9ab9a;">
<b style="color:#f4ead9;">AVANTRA 2026</b> &middot; SSRVM IEMS, Sector 20<br>
<a href="https://avantra.arithi.in" style="color:#9fd4ff;text-decoration:none;">avantra.arithi.in</a> &middot;
<a href="https://instagram.com/avantra.verse" style="color:#9fd4ff;text-decoration:none;">@avantra.verse</a> &middot;
<a href="mailto:contact@arithi.in" style="color:#9fd4ff;text-decoration:none;">contact@arithi.in</a></td></tr>
</table></td></tr></table></body></html>`;
}

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
      await smtp.sendMail({ from: Deno.env.get("MAIL_FROM") ?? user, to: m.to, replyTo: m.replyTo ?? undefined, subject: m.subject, text: m.text, html: html(m) });
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
