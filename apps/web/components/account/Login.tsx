"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginRequest } from "@avantra/shared";
import { accountsOpen, api, ApiError, getMe, studentSignupOpen, type Me, type Role } from "@/lib/api";
import { AccountShell, Field, FooterLink, FormError, OpensSoon, styles } from "./Account";
import { getInitials } from "@/components/Nav";

// Student log in (/login). Ambassador sign-up is Google Forms at /ambassador.
export function Login({ role }: { role: Extract<Role, "STUDENT"> }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loggedInMe, setLoggedInMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!accountsOpen) return;
    getMe().then(setLoggedInMe).catch(() => null);
  }, []);

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
      // The API gives the same message for a wrong password, unknown email or the wrong tab, on purpose;
      // so the sign-up hint goes to everyone and never says whether the email exists.
      const e = err as ApiError;
      setErrors({ form: e.status === 401 ? "Wrong email or password. Haven't signed up yet? Create an account first." : e.message, ...(e.status === 401 && { signup: "1" }) });
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="Welcome back, traveller. Your universe is waiting.">
      {loggedInMe ? (
        <div style={{ textAlign: "center", padding: "1.2rem 0" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              margin: "0 auto 1.25rem",
              background: "var(--red, #b3121e)",
              border: "3px solid var(--sky, #9fd4ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#ffffff",
              boxShadow: "0 0 24px rgba(159,212,255,0.35)",
              letterSpacing: "0.05em",
            }}
          >
            {getInitials(loggedInMe.name)}
          </div>
          <h1 className={styles.heading} style={{ marginBottom: "0.35rem" }}>
            Already Logged In
          </h1>
          <p style={{ color: "var(--color-secondary, #b9ab9a)", fontSize: "1.05rem", marginBottom: "1.8rem" }}>
            Signed in as <strong style={{ color: "var(--color-starlight, #f4ead9)" }}>{loggedInMe.name}</strong> ({loggedInMe.email})
          </p>

          <Link
            href="/dashboard"
            className={styles.submitBtn}
            style={{ display: "block", textDecoration: "none", textAlign: "center", width: "100%", boxSizing: "border-box" }}
          >
            Go to Dashboard →
          </Link>

          <button
            type="button"
            onClick={async () => {
              await api("/auth/logout", {}).catch(() => {});
              setLoggedInMe(null);
            }}
            style={{
              marginTop: "1.2rem",
              background: "transparent",
              border: "none",
              color: "rgba(244,234,217,0.5)",
              cursor: "pointer",
              fontSize: "0.9rem",
              textDecoration: "underline",
            }}
          >
            Log in with a different account
          </button>
        </div>
      ) : !accountsOpen ? (
        <OpensSoon what="Log in" />
      ) : !studentSignupOpen ? (
        <>
          <OpensSoon what="Student log in" />
          <FooterLink text="Want to be an ambassador?" href="/ambassador" link="Apply here" />
        </>
      ) : (
        <>
          <h1 className={styles.heading}>Log in</h1>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field name="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set} error={errors.email} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
            <FormError message={errors.form} />
            {errors.form && errors.signup && (
              <Link href="/registration" className={styles.submitBtn} style={{ textAlign: "center", background: "transparent" }}>
                Create an account
              </Link>
            )}
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
          <FooterLink text="Forgot your password?" href="/forgot-password" link="Reset it" />
          <FooterLink text="New to Avantra?" href="/registration" link="Create an account" />
          <FooterLink text="Want to be an ambassador?" href="/ambassador" link="Apply here" />
          <FooterLink text="Volunteer or judge?" href="/staff/login" link="Staff log in" />
        </>
      )}
    </AccountShell>
  );
}
