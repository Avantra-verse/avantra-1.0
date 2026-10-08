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
              <img src="/assets/avantra-logo.png" alt="Avantra Logo" className={styles.portalLogo} />
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
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...input}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
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

// Radio choices drawn as chips (Meena's "Choose your universe" control).
export function Chips<T extends string>({ name, legend, value, onChange, options }: {
  name: string;
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; sub: string }[];
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.fieldsetLegend}>{legend}</legend>
      <div className={styles.chipsGrid}>
        {options.map((o) => (
          <div key={o.value} className={styles.chipWrapper}>
            <input
              type="radio"
              id={`${name}-${o.value}`}
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className={styles.radioInput}
            />
            <label htmlFor={`${name}-${o.value}`} className={styles.chipLabel}>
              <span className={styles.chipTitle}>{o.title}</span>
              <span className={styles.chipSubtext}>{o.sub}</span>
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export const ROLE_OPTIONS = [
  { value: "STUDENT" as const, title: "Student", sub: "Classes 6–12" },
  { value: "SCHOOL_COORDINATOR" as const, title: "School", sub: "Teacher coordinator" },
];

// Shown on account pages while the site isn't connected to the API (NEXT_PUBLIC_API_URL unset).
export function OpensSoon({ what }: { what: string }) {
  return (
    <div className={styles.successBox} role="status">
      <h1 className={styles.successHeading}>Opening soon</h1>
      <p className={styles.successText}>{what} opens soon. Check back closer to AVANTRA 2026.</p>
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
