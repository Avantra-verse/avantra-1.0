"use client";

// Email -> 6-digit code + new password -> back to login. The API answers the same whether or not
// the email has an account, so this page never reveals who is registered.
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ForgotPasswordRequest, ResetPasswordRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { AccountShell, Field, FooterLink, FormError, OpensSoon, styles } from "@/components/account/Account";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [form, setForm] = useState({ email: "", code: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" })); // fixing a field clears its message
  };
  const fail = (err: unknown) => {
    const ae = err as ApiError;
    setErrors({ ...ae.fields, form: ae.status === 400 ? "That code is wrong or has expired." : ae.message });
  };

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ForgotPasswordRequest.safeParse({ email: form.email });
    if (!parsed.success) return setErrors({ email: parsed.error.issues[0].message });
    setBusy(true);
    try {
      await api("/auth/password/forgot", parsed.data);
      setErrors({});
      setStep("reset");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ResetPasswordRequest.safeParse({ email: form.email, code: form.code, password: form.password });
    const found: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    if (form.confirmPassword !== form.password) found.confirmPassword = "Passwords don't match.";
    setErrors(found);
    if (!parsed.success || Object.keys(found).length) return;
    setBusy(true);
    try {
      await api("/auth/password/reset", parsed.data);
      setStep("done");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="Lost the key to your universe? Let's make you a new one.">
      {!apiReady ? (
        <OpensSoon what="Password reset" />
      ) : step === "done" ? (
        <div className={styles.successBox} role="status">
          <h1 className={styles.successHeading}>Password changed</h1>
          <p className={styles.successText}>You're logged out on all devices. Log in with your new password.</p>
          <button type="button" className={styles.submitBtn} onClick={() => router.push("/login")}>
            Go to log in
          </button>
        </div>
      ) : step === "email" ? (
        <>
          <h1 className={styles.heading}>Reset password</h1>
          <p className={styles.subtext}>Enter your account email and we'll send you a code.</p>
          <form className={styles.form} onSubmit={requestCode} noValidate>
            <Field name="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set} error={errors.email} />
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
          <FooterLink text="Remembered it?" href="/login" link="Log in" />
        </>
      ) : (
        <>
          <h1 className={styles.heading}>New password</h1>
          <p className={styles.subtext} role="status">
            If {form.email} has an account, a 6-digit code is on its way. It expires in 10 minutes.
          </p>
          <form className={styles.form} onSubmit={reset} noValidate>
            <Field name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.code} onChange={set} error={errors.code} autoFocus />
            <div className={styles.twoColRow}>
              <Field name="password" label="New password" type="password" autoComplete="new-password" placeholder="8+ characters" value={form.password} onChange={set} error={errors.password} />
              <Field name="confirmPassword" label="Confirm" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set} error={errors.confirmPassword} />
            </div>
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
        </>
      )}
    </AccountShell>
  );
}
