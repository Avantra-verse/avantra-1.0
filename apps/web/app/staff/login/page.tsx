"use client";

// Volunteers and judges. Accounts are made by the admin, who hands over the password.
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordLoginRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { AccountShell, Field, FooterLink, FormError, OpensSoon, styles } from "@/components/account/Account";

export default function StaffLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = PasswordLoginRequest.safeParse(form);
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    setBusy(true);
    try {
      await api("/auth/staff/login", parsed.data);
      router.push("/staff");
    } catch (err) {
      setErrors({ form: (err as ApiError).message });
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="Volunteers and judges: thank you for making AVANTRA happen.">
      {!apiReady ? (
        <OpensSoon what="Staff log in" />
      ) : (
        <>
          <h1 className={styles.heading}>Staff log in</h1>
          <p className={styles.subtext}>Use the email and password the AVANTRA team gave you.</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field name="email" label="Email" type="email" autoComplete="username" value={form.email} onChange={set} error={errors.email} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
          <FooterLink text="Forgot your password?" href="/forgot-password" link="Reset it" />
        </>
      )}
    </AccountShell>
  );
}
