"use client";

// Students edit their own name and details. Checks run in update_student_profile (same rules as sign-up);
// email, AVANTRA ID and fee status are not editable.
import React, { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Field, FormError, SelectField, styles } from "@/components/account/Account";
import t from "../../staff/tools.module.css";
import { useDashboard } from "../data";

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const digits = (v: string) => v.replace(/\D/g, "").slice(-10);

export default function SettingsPage() {
  const { me, student: s, failed, reload } = useDashboard();
  const [f, setF] = useState({ name: "", phone: "", grade: "", section: "", schoolName: "", guardianPhone: "", guardianEmail: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fill the form once the shared data arrives (and again after a save reloads it).
  useEffect(() => {
    if (!me || !s) return;
    setF({
      name: me.name,
      phone: me.phone ?? "",
      grade: String(s.grade),
      section: s.section ?? "",
      schoolName: s.schoolName,
      guardianPhone: s.guardianPhone ?? "",
      guardianEmail: s.guardianEmail ?? "",
    });
  }, [me, s]);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((v) => ({ ...v, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" }));
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/profile/student",
        {
          ...f,
          phone: digits(f.phone),
          grade: Number(f.grade),
          guardianPhone: f.guardianPhone.trim() ? digits(f.guardianPhone) : "",
        },
        "PUT",
      );
      await reload();
      setSaved(true);
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.narrow} ${t.appPage}`}>
        <section className={t.panel} aria-labelledby="settings">
          <h2 id="settings">Settings</h2>
          {!me || !s ? (
            failed ? <FormError message={failed} /> : <p className={t.mute} role="status">Loading…</p>
          ) : (
            <form className={styles.form} onSubmit={save} noValidate>
              <p className={t.mute} style={{ margin: 0 }}>
                {me.email} · <span className={t.mono}>{s.avantraId}</span>
                <br />
                Your email and AVANTRA ID can&apos;t be changed.
              </p>
              <Field name="name" label="Full name" autoComplete="name" value={f.name} onChange={set} error={errors.name} />
              <div className={styles.twoColRow}>
                <SelectField name="grade" label="Class" value={f.grade} onChange={set} error={errors.grade}>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </SelectField>
                <Field name="section" label="Section (optional)" maxLength={10} value={f.section} onChange={set} error={errors.section} />
              </div>
              <Field name="schoolName" label="School name" value={f.schoolName} onChange={set} error={errors.schoolName} />
              <Field name="phone" label="Your phone" type="tel" inputMode="numeric" autoComplete="tel" value={f.phone} onChange={set} error={errors.phone} />
              <div className={styles.twoColRow}>
                <Field name="guardianPhone" label="Parent's phone (optional)" type="tel" inputMode="numeric" value={f.guardianPhone} onChange={set} error={errors.guardianPhone} />
                <Field name="guardianEmail" label="Parent's email (optional)" type="email" value={f.guardianEmail} onChange={set} error={errors.guardianEmail} />
              </div>
              <FormError message={errors.form} />
              {saved && (
                <div className={`${t.result} ${t.ok}`} role="status" style={{ marginTop: 0 }}>
                  <strong>Saved.</strong>
                </div>
              )}
              <button type="submit" className={styles.submitBtn} disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
