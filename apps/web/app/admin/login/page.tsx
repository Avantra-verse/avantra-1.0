"use client";

// Admin login: password, then a code sent to the admin's email.
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminVerifyRequest, PasswordLoginRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import { AccountShell, Field, FormError, OpensSoon, styles } from "@/components/account/Account";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", code: "" });
  const [step, setStep] = useState<"password" | "code">("password");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed =
      step === "password"
        ? PasswordLoginRequest.safeParse({ email: form.email, password: form.password })
        : AdminVerifyRequest.safeParse({ email: form.email, code: form.code });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    setBusy(true);
    try {
      if (step === "password") {
        await api("/auth/admin/login", parsed.data);
        setStep("code");
        setBusy(false);
      } else {
        await api("/auth/admin/login/verify", parsed.data);
        router.push("/admin");
      }
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
          <p className={styles.subtext}>{step === "password" ? "Log in with your admin email and password." : `We emailed a 6-digit code to ${form.email}.`}</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            {step === "password" ? (
              <>
                <Field name="email" label="Email" type="email" autoComplete="username" value={form.email} onChange={set} error={errors.email} />
                <Field name="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set} error={errors.password} />
              </>
            ) : (
              <Field name="code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.code} onChange={set} error={errors.code} autoFocus />
            )}
            <FormError message={errors.form} />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy ? "Checking…" : step === "password" ? "Continue" : "Log in"}
            </button>
          </form>
        </>
      )}
    </AccountShell>
  );
}
