"use client";

// Building blocks for the account pages (registration, login, password reset, profile, dashboard).
// Markup and classes are Meena's Registration page, so every account page looks the same.
import React from "react";
import Link from "next/link";
import styles from "@/app/registration/registration.module.css";

export { styles };

// Page frame: glow, stars, the portal with the logo on the left, the card on the right.
export function AccountShell({ tagline, children }: { tagline: string; children: React.ReactNode }) {
  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={styles.wrapper}>
        <div className={styles.grid}>
          <div className={styles.leftColumn}>
            <div className={styles.portalWrapper}>
              <div className={`${styles.ring} ${styles.ring1}`}>
                <div className={styles.orb} />
              </div>
              <div className={`${styles.ring} ${styles.ring2}`}>
                <div className={styles.orb} />
              </div>
              <div className={`${styles.ring} ${styles.ring3}`} />
              <img src="/brand/avantra-logo.png" alt="Avantra Logo" className={styles.portalLogo} />
            </div>
            <p className={styles.heroSubtext}>{tagline}</p>
          </div>
          <div className={styles.card}>{children}</div>
        </div>
      </div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; error?: string };

export function Field({ name, label, error, ...input }: FieldProps) {
  const [shown, setShown] = React.useState(false);
  const password = input.type === "password";
  const box = (
    <input
      id={name}
      name={name}
      {...input}
      type={password && shown ? "text" : input.type}
      className={`${styles.input} ${password ? styles.inputPw : ""} ${error ? styles.inputError : ""}`}
      aria-invalid={!!error}
      aria-describedby={error ? `${name}-error` : undefined}
    />
  );
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      {password ? (
        <div className={styles.pwWrap}>
          {box}
          {!!input.value && <button type="button" className={styles.pwToggle} onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-controls={name}>
            {shown ? "Hide" : "Show"}
          </button>}
        </div>
      ) : (
        box
      )}
      {error && (
        <span id={`${name}-error`} className={styles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
}

// Same look as Field, for dropdowns.
export function SelectField({ name, label, error, children, ...select }: React.SelectHTMLAttributes<HTMLSelectElement> & { name: string; label: string; error?: string }) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        {...select}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {children}
      </select>
      {error && (
        <span id={`${name}-error`} className={styles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
}

// Shown on account pages while the site isn't connected to the API (NEXT_PUBLIC_SUPABASE_* unset).
export function OpensSoon({ what }: { what: string }) {
  return (
    <div className={styles.successBox} role="status">
      <h1 className={styles.successHeading}>Coming soon</h1>
      <p className={styles.successText}>{what} opens soon. Check back closer to AVANTRA 2026.</p>
      <div className={styles.soonActions}>
        <Link href="/contact" className={styles.submitBtn}>
          Ask the team
        </Link>
        <Link href="/" className={styles.link}>
          Back to AVANTRA
        </Link>
      </div>
    </div>
  );
}

// Form-level message (wrong code, server down) above the submit button.
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.errorText} role="alert">
      {message}
    </p>
  );
}

export function FooterLink({ text, href, link }: { text: string; href: string; link: string }) {
  return (
    <div className={styles.footerLine}>
      {text}{" "}
      <Link href={href} className={styles.link}>
        {link}
      </Link>
    </div>
  );
}
