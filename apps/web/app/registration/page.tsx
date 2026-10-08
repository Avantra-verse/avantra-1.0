"use client";

// Sign-up: pick Student or School (?as=…, so Back works) -> details -> 6-digit code emailed -> account created and logged in -> profile step.
// The account only exists once the code is verified (POST /auth/register, then /auth/register/verify).
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RegisterRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { AccountShell, Field, FooterLink, FormError, OpensSoon, ROLE_OPTIONS, styles } from "@/components/account/Account";

type Role = (typeof ROLE_OPTIONS)[number]["value"];
const AS: Record<string, Role> = { student: "STUDENT", coordinator: "SCHOOL_COORDINATOR" };
const BLURB: Record<Role, string> = {
  STUDENT: "Get your entry badge and pay the exhibition fee.",
  SCHOOL_COORDINATOR: "Register your school and follow your students.",
};

export default function RegistrationPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", terms: false });
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"details" | "code">("details");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const read = () => setRole(AS[new URLSearchParams(window.location.search).get("as") ?? ""] ?? null);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function pick(r: Role | null) {
    const as = Object.keys(AS).find((k) => AS[k] === r);
    window.history.pushState(null, "", as ? `?as=${as}` : window.location.pathname);
    setRole(r);
    setErrors({});
  }

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" })); // fixing a field clears its message
  };

  // Same rules as the API (shared schema), plus the two that only exist on this form.
  function check() {
    const found: Record<string, string> = {};
    const parsed = RegisterRequest.safeParse({ role, name: form.name, email: form.email, password: form.password });
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    if (form.confirmPassword !== form.password) found.confirmPassword = "Passwords don't match.";
    if (!form.terms) found.terms = "Accept the terms to continue.";
    setErrors(found);
    if (Object.keys(found).length) document.getElementById(Object.keys(found)[0])?.focus();
    return parsed.success && Object.keys(found).length === 0 ? parsed.data : null;
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = check();
    if (!body) return;
    setBusy(true);
    try {
      await api("/auth/register", body);
      setStep("code");
      setNotice(`We sent a 6-digit code to ${body.email}.`);
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.message });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const body = RegisterRequest.parse({ role, name: form.name, email: form.email, password: form.password });
    if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code from the email." });
    setBusy(true);
    try {
      await api("/auth/register/verify", { ...body, code });
      router.push("/profile");
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ code: ae.status === 400 ? "That code is wrong or has expired." : ae.message });
      setBusy(false);
    }
  }

  return (
    <AccountShell tagline="Every universe has a doorway. Create your account and step through.">
      {!apiReady ? (
        <OpensSoon what="Registration" />
      ) : step === "code" ? (
        <>
          <h1 className={styles.heading}>Check your email</h1>
          <p className={styles.subtext} role="status">
            {notice} It expires in 10 minutes.
          </p>
          <form className={styles.form} onSubmit={verify} noValidate>
            <Field
              name="code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setErrors({});
              }}
              error={errors.code}
              autoFocus
            />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Checking…" : "Create account"}
            </button>
          </form>
          <div className={styles.footerLine}>
            No email? Check spam, or{" "}
            <button type="button" className={styles.link} onClick={() => send()} disabled={busy}>
              send a new code
            </button>{" "}
            ·{" "}
            <button type="button" className={styles.link} onClick={() => setStep("details")}>
              change email
            </button>
          </div>
        </>
      ) : !role ? (
        <>
          <h1 className={styles.heading}>Join Avantra</h1>
          <p className={styles.subtext}>Who&apos;s signing up?</p>
          <div className={styles.roleGrid}>
            {ROLE_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={styles.roleCard} onClick={() => pick(o.value)}>
                <span className={styles.chipTitle}>{o.title}</span>
                <span className={styles.roleSub}>{o.sub}</span>
                <span className={styles.chipSubtext}>{BLURB[o.value]}</span>
              </button>
            ))}
          </div>
          <FooterLink text="Already have an account?" href="/login" link="Log in" />
        </>
      ) : (
        <>
          <h1 className={styles.heading}>{role === "STUDENT" ? "Join as a student" : "Register your school"}</h1>
          <p className={styles.subtext}>
            {role === "STUDENT" ? "Create your account for AVANTRA 2026." : "Create your coordinator account first. You add the school details next."}{" "}
            <button type="button" className={styles.link} onClick={() => pick(null)}>
              Not you? Go back
            </button>
          </p>
          <form className={styles.form} onSubmit={send} noValidate>
            <Field name="name" label="Full name" autoComplete="name" value={form.name} onChange={set} error={errors.name} />
            <Field name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set} error={errors.email} />
            <div className={styles.twoColRow}>
              <Field name="password" label="Password" type="password" autoComplete="new-password" placeholder="8+ characters" value={form.password} onChange={set} error={errors.password} />
              <Field name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat password" value={form.confirmPassword} onChange={set} error={errors.confirmPassword} />
            </div>
            <div className={styles.checkboxGroup}>
              <label htmlFor="terms" className={styles.checkboxLabel}>
                <input id="terms" name="terms" type="checkbox" checked={form.terms} onChange={set} className={styles.checkboxInput} aria-invalid={!!errors.terms} />
                <span>I agree to the Terms and Privacy Policy.</span>
              </label>
              {errors.terms && <span className={styles.errorText}>{errors.terms}</span>}
            </div>
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Sending code…" : "Create account"}
            </button>
          </form>
          <FooterLink text="Already have an account?" href="/login" link="Log in" />
        </>
      )}
    </AccountShell>
  );
}
