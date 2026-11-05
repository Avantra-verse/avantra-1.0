"use client";

import { useState } from "react";
import { ContactRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { Field, FormError, styles } from "@/components/account/Account";

const empty = { name: "", school: "", email: "", message: "", website: "" };

// "Write to the team": POST /contact emails the team, with reply-to set to the sender.
export default function ContactForm() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" }));
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ContactRequest.safeParse({ ...form, school: form.school || undefined, website: form.website || undefined });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      setErrors(found);
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setState("sending");
    try {
      await api("/contact", parsed.data);
      setState("sent");
      setForm(empty);
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.status === 429 ? "Too many messages. Wait a minute and try again." : ae.message });
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <div className={styles.successBox} role="status">
        <h2 className={styles.successHeading}>Message sent</h2>
        <p className={styles.successText}>Thanks, your message is with the team. We&apos;ll reply to your email shortly.</p>
        <button type="button" className={styles.submitBtn} onClick={() => setState("idle")}>
          Send another message
        </button>
      </div>
    );

  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-4">
      <Field name="name" label="Your name" autoComplete="name" value={form.name} onChange={set} error={errors.name} />
      <Field name="school" label="School (optional)" autoComplete="organization" value={form.school} onChange={set} error={errors.school} />
      <Field name="email" label="Email address" type="email" autoComplete="email" value={form.email} onChange={set} error={errors.email} />
      <div className={styles.fieldGroup}>
        <label htmlFor="message" className={styles.label}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Ask us anything about registrations, exhibitions, or events..."
          value={form.message}
          onChange={set}
          className={`${styles.input} ${errors.message ? styles.inputError : ""}`}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message && (
          <span id="message-error" className={styles.errorText}>
            {errors.message}
          </span>
        )}
      </div>
      {/* Trap for bots: hidden from people and screen readers. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set} className="hidden" />
      <FormError message={errors.form} />
      {!apiReady && <p className={styles.successText}>Messages open soon.</p>}
      <button type="submit" className={styles.submitBtn} disabled={state === "sending" || !apiReady}>
        {state === "sending" ? "Sending…" : "Send message →"}
      </button>
    </form>
  );
}
