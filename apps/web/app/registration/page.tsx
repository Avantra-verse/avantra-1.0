"use client";

import React, { useState } from "react";
import styles from "./registration.module.css";

// Registration isn't connected to the AVANTRA API yet. Until it is, the form can't be submitted,
// so nobody sees a success message for an account that was never created.
const REGISTRATION_OPEN = false;

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  universe: string;
  terms: boolean;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  universe?: string;
  terms?: string;
}

export default function RegistrationPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    universe: "Ember",
    terms: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Validate a single field
  const validateField = (name: keyof FormData, value: any, currentForm: FormData = formData): string => {
    switch (name) {
      case "fullName":
        if (typeof value !== "string" || value.trim().length < 2) {
          return "Enter your full name.";
        }
        return "";
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== "string" || !emailRegex.test(value.trim())) {
          return "Enter a valid email address.";
        }
        return "";
      case "phone":
        const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
        if (digits.length < 10) {
          return "Enter a valid phone number.";
        }
        return "";
      case "password":
        if (typeof value !== "string" || value.length < 8) {
          return "Use at least 8 characters.";
        }
        return "";
      case "confirmPassword":
        if (typeof value !== "string" || value !== currentForm.password || value.length === 0) {
          return "Passwords don't match.";
        }
        return "";
      case "terms":
        if (!value) {
          return "Accept the terms to continue.";
        }
        return "";
      default:
        return "";
    }
  };

  // Validate all fields
  const validateAll = (data: FormData): FormErrors => {
    const newErrors: FormErrors = {};
    const fields: (keyof FormData)[] = ["fullName", "email", "phone", "password", "confirmPassword", "terms"];
    
    fields.forEach((field) => {
      const err = validateField(field, data[field], data);
      if (err) {
        newErrors[field] = err;
      }
    });

    return newErrors;
  };

  // Handle Input Change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    
    const nextFormData = { ...formData, [name]: val };
    setFormData(nextFormData);

    // Re-validate if error currently exists for this field
    if (errors[name as keyof FormErrors]) {
      const err = validateField(name as keyof FormData, val, nextFormData);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  // Handle Input Blur (validate if not empty or already touched)
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    setTouched((prev) => ({ ...prev, [name]: true }));

    // Custom requirement: validate on blur for fields that aren't empty
    if (type === "checkbox" || (typeof val === "string" && val.trim().length > 0)) {
      const err = validateField(name as keyof FormData, val, formData);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  // Submit Handler Placeholder
  const handleRegister = (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    universe: string;
  }) => {
    // TODO: Connect handleRegister to real backend or auth API
    // Note: Never log or store the password in client storage or console logs.
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!REGISTRATION_OPEN) return;
    const validationErrors = validateAll(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Focus first invalid element
      const firstErrorField = Object.keys(validationErrors)[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.focus();
      }
      return;
    }

    // Call registration logic and show success state
    handleRegister({
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      universe: formData.universe,
    });

    setIsSubmitted(true);
  };

  // Extract first name for confirmation message
  const firstName = formData.fullName.trim().split(" ")[0] || "Traveler";

  return (
    <div className={styles.registrationPage}>


      {/* Starfield Layer */}
      <div className={styles.starfieldLayer} aria-hidden="true" />

      <main className={styles.wrapper}>
        <div className={styles.grid}>
          {/* Left Column (Hero & Portal) */}
          <div className={styles.leftColumn}>
            <div className={styles.portalWrapper}>
              {/* Ring 1 */}
              <div className={`${styles.ring} ${styles.ring1}`}>
                <div className={styles.orb} />
              </div>

              {/* Ring 2 */}
              <div className={`${styles.ring} ${styles.ring2}`}>
                <div className={styles.orb} />
              </div>

              {/* Ring 3 */}
              <div className={`${styles.ring} ${styles.ring3}`} />

              {/* Center Logo */}
              <img
                src="/assets/avantra-logo.png"
                alt="Avantra Logo"
                className={styles.portalLogo}
              />
            </div>

            <p className={styles.heroSubtext}>
              Every universe has a doorway. Create your account and step through.
            </p>
          </div>

          {/* Right Column (Registration Card) */}
          <div className={styles.card}>
            {isSubmitted ? (
              <div className={styles.successBox} role="status" aria-live="polite">
                <h2 className={styles.successHeading}>You're in</h2>
                <p className={styles.successText}>
                  Welcome to Avantra, {firstName}. Your universe is ready.
                </p>
              </div>
            ) : (
              <>
                <h1 className={styles.heading}>Join Avantra</h1>
                <p className={styles.subtext}>
                  Create your account and pick your starting universe.
                </p>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                  {/* Field 1: Full name */}
                  <div className={styles.fieldGroup}>
                    <label htmlFor="fullName" className={styles.label}>
                      Full name
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={formData.fullName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`${styles.input} ${
                        errors.fullName ? styles.inputError : ""
                      }`}
                      aria-invalid={!!errors.fullName}
                      aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    />
                    {errors.fullName && (
                      <span id="fullName-error" className={styles.errorText}>
                        {errors.fullName}
                      </span>
                    )}
                  </div>

                  {/* Field 2: Email and Phone */}
                  <div className={styles.twoColRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="email" className={styles.label}>
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`${styles.input} ${
                          errors.email ? styles.inputError : ""
                        }`}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                      />
                      {errors.email && (
                        <span id="email-error" className={styles.errorText}>
                          {errors.email}
                        </span>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="phone" className={styles.label}>
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`${styles.input} ${
                          errors.phone ? styles.inputError : ""
                        }`}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? "phone-error" : undefined}
                      />
                      {errors.phone && (
                        <span id="phone-error" className={styles.errorText}>
                          {errors.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Field 3: Password and Confirm password */}
                  <div className={styles.twoColRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="password" className={styles.label}>
                        Password
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="8+ characters"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`${styles.input} ${
                          errors.password ? styles.inputError : ""
                        }`}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "password-error" : undefined}
                      />
                      {errors.password && (
                        <span id="password-error" className={styles.errorText}>
                          {errors.password}
                        </span>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="confirmPassword" className={styles.label}>
                        Confirm password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`${styles.input} ${
                          errors.confirmPassword ? styles.inputError : ""
                        }`}
                        aria-invalid={!!errors.confirmPassword}
                        aria-describedby={
                          errors.confirmPassword ? "confirmPassword-error" : undefined
                        }
                      />
                      {errors.confirmPassword && (
                        <span id="confirmPassword-error" className={styles.errorText}>
                          {errors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Field 4: Fieldset "Choose your universe" */}
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.fieldsetLegend}>Choose your universe</legend>
                    <div className={styles.chipsGrid}>
                      {/* Chip 1: Ember */}
                      <div className={styles.chipWrapper}>
                        <input
                          type="radio"
                          id="universe-ember"
                          name="universe"
                          value="Ember"
                          checked={formData.universe === "Ember"}
                          onChange={handleChange}
                          className={styles.radioInput}
                        />
                        <label htmlFor="universe-ember" className={styles.chipLabel}>
                          <span className={styles.chipTitle}>Ember</span>
                          <span className={styles.chipSubtext}>Bold & fiery</span>
                        </label>
                      </div>

                      {/* Chip 2: Azure */}
                      <div className={styles.chipWrapper}>
                        <input
                          type="radio"
                          id="universe-azure"
                          name="universe"
                          value="Azure"
                          checked={formData.universe === "Azure"}
                          onChange={handleChange}
                          className={styles.radioInput}
                        />
                        <label htmlFor="universe-azure" className={styles.chipLabel}>
                          <span className={styles.chipTitle}>Azure</span>
                          <span className={styles.chipSubtext}>Calm & vast</span>
                        </label>
                      </div>

                      {/* Chip 3: Twin */}
                      <div className={styles.chipWrapper}>
                        <input
                          type="radio"
                          id="universe-twin"
                          name="universe"
                          value="Twin"
                          checked={formData.universe === "Twin"}
                          onChange={handleChange}
                          className={styles.radioInput}
                        />
                        <label htmlFor="universe-twin" className={styles.chipLabel}>
                          <span className={styles.chipTitle}>Twin</span>
                          <span className={styles.chipSubtext}>Both at once</span>
                        </label>
                      </div>
                    </div>
                  </fieldset>

                  {/* Field 5: Terms Checkbox */}
                  <div className={styles.checkboxGroup}>
                    <label htmlFor="terms" className={styles.checkboxLabel}>
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={formData.terms}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={styles.checkboxInput}
                        aria-invalid={!!errors.terms}
                      />
                      <span>
                        I agree to the Terms and Privacy Policy.
                      </span>
                    </label>
                    {errors.terms && (
                      <span id="terms-error" className={styles.errorText}>
                        {errors.terms}
                      </span>
                    )}
                  </div>

                  {/* Field 6: Submit Button */}
                  <button type="submit" className={styles.submitBtn} disabled={!REGISTRATION_OPEN}>
                    {REGISTRATION_OPEN ? "Create account" : "Registration opens soon"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
