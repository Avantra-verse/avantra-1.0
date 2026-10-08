"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginRequest } from "@avantra/shared";
import { api, ApiError, apiReady, type Me } from "@/lib/api";
import { AccountShell, Chips, Field, FooterLink, FormError, OpensSoon, ROLE_OPTIONS, styles } from "@/components/account/Account";

type Role = (typeof ROLE_OPTIONS)[number]["value"];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" })); // fixing a field clears its message
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = LoginRequest.safeParse({ role, ...form });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    setBusy(true);
    try {
      const me = await api<Me>("/auth/login", parsed.data);
      // ?next=/wall?code=… brings a student back to the chit they scanned. Same-site paths only.
      const next = new URLSearchParams(window.location.search).get("next");
      const safe = next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
      router.push(me.profileComplete ? safe : "/profile");
    } catch (err) {
      // The API gives the same message for a wrong password, unknown email or the wrong tab, on purpose.
      setErrors({ form: (err as ApiError).message });
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="Welcome back, traveller. Your universe is waiting.">
      {!apiReady ? (
        <OpensSoon what="Log in" />
      ) : (
        <>
          <h1 className={styles.heading}>Log in</h1>
          <p className={styles.subtext}>Pick the account type you signed up with.</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Chips name="role" legend="I am a" value={role} onChange={setRole} options={ROLE_OPTIONS} />
            <Field name="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set} error={errors.email} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
          <FooterLink text="Forgot your password?" href="/forgot-password" link="Reset it" />
          <FooterLink text="New to Avantra?" href="/registration" link="Create an account" />
        </>
      )}
    </AccountShell>
  );
}
