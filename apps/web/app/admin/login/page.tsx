"use client";

// Admin login. Not linked from anywhere; password only, like every other account.
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordLoginRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { AccountShell, Field, FormError, OpensSoon, styles } from "@/components/account/Account";

export default function AdminLoginPage() {
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
      await api("/auth/admin/login", parsed.data);
      router.push("/admin");
    } catch (err) {
      setErrors({ form: (err as ApiError).message });
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="AVANTRA control room.">
      {!apiReady ? (
        <OpensSoon what="Admin log in" />
      ) : (
        <>
          <h1 className={styles.heading}>Admin</h1>
          <p className={styles.subtext}>Log in with your admin email and password.</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field name="email" label="Email" type="email" autoComplete="username" value={form.email} onChange={set} error={errors.email} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
        </>
      )}
    </AccountShell>
  );
}
