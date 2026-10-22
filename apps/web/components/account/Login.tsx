"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginRequest } from "@avantra/shared";
import { accountsOpen, api, ApiError, studentSignupOpen, type Me, type Role } from "@/lib/api";
import { AccountShell, Field, FooterLink, FormError, OpensSoon, styles } from "./Account";

// Log in for one role (students: /login, ambassadors: /ambassador/login).
export function Login({ role }: { role: Extract<Role, "STUDENT" | "AMBASSADOR"> }) {
  const router = useRouter();
  const ambassador = role === "AMBASSADOR";
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
      {!accountsOpen ? (
        <OpensSoon what="Log in" />
      ) : !ambassador && !studentSignupOpen ? (
        <>
          <OpensSoon what="Student log in" />
          <FooterLink text="Ambassador?" href="/ambassador/login" link="Log in here" />
        </>
      ) : (
        <>
          <h1 className={styles.heading}>{ambassador ? "Ambassador log in" : "Log in"}</h1>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field name="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set} error={errors.email} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
          <FooterLink text="Forgot your password?" href="/forgot-password" link="Reset it" />
          <FooterLink text="New to Avantra?" href={ambassador ? "/ambassador/registration" : "/registration"} link="Create an account" />
          {ambassador ? (
            studentSignupOpen && <FooterLink text="Student?" href="/login" link="Student log in" />
          ) : (
            <FooterLink text="Ambassador?" href="/ambassador/login" link="Ambassador log in" />
          )}
          <FooterLink text="Volunteer or judge?" href="/staff/login" link="Staff log in" />
        </>
      )}
    </AccountShell>
  );
}
