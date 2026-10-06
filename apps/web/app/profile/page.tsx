"use client";

// First step after sign-up (Me.profileComplete = false). Students: class, school, parent contact.
// Coordinators: their school, which then waits for admin approval.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SchoolProfile, StudentProfile } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { AccountShell, Field, FormError, OpensSoon, SelectField, styles } from "@/components/account/Account";

const OTHERS = "__others";
const GRADES = [6, 7, 8, 9, 10, 11, 12];

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    getMe()
      .then((m) => {
        if (!m) router.replace("/login");
        else if (m.profileComplete) router.replace("/dashboard");
        else setMe(m);
      })
      .catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  return (
    <AccountShell tagline="One last step before you step through.">
      {!apiReady ? (
        <OpensSoon what="Your profile" />
      ) : failed ? (
        <FormError message={failed} />
      ) : !me ? (
        <p className={styles.subtext} role="status">Loading…</p>
      ) : me.role === "SCHOOL_COORDINATOR" ? (
        <SchoolForm onDone={() => router.push("/dashboard")} />
      ) : (
        <StudentForm name={me.name} onDone={() => router.push("/dashboard")} />
      )}
    </AccountShell>
  );
}

function issues(err: { issues: { path: PropertyKey[]; message: string }[] }) {
  const found: Record<string, string> = {};
  for (const i of err.issues) found[String(i.path[0])] ??= i.message;
  return found;
}

function StudentForm({ name, onDone }: { name: string; onDone: () => void }) {
  const [schools, setSchools] = useState<{ id: string; name: string; city: string }[]>([]);
  const [f, setF] = useState({ phone: "", grade: "", section: "", school: "", otherSchoolName: "", guardianPhone: "", guardianEmail: "", consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<typeof schools>("/schools").then(setSchools).catch(() => setSchools([]));
  }, []);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((v) => ({ ...v, [e.target.name]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" })); // fixing a field clears its message
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const others = f.school === OTHERS;
    const parsed = StudentProfile.safeParse({
      phone: f.phone.replace(/\D/g, "").slice(-10),
      grade: Number(f.grade) || undefined,
      section: f.section.trim() || undefined,
      schoolId: !others && f.school ? f.school : undefined,
      otherSchoolName: others ? f.otherSchoolName : undefined,
      guardianPhone: f.guardianPhone.trim() ? f.guardianPhone.replace(/\D/g, "").slice(-10) : undefined,
      guardianEmail: f.guardianEmail.trim() || undefined,
      guardianConsent: f.consent || undefined,
    });
    if (!parsed.success) {
      const found = issues(parsed.error);
      if (found.schoolId) found.school = found.schoolId;
      if (found.guardianConsent) found.consent = "A parent or guardian must agree before you can take part.";
      if (!f.grade) found.grade = "Pick your class.";
      return setErrors(found);
    }
    setBusy(true);
    try {
      await api("/profile/student", parsed.data);
      onDone();
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.message });
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className={styles.heading}>Your details</h1>
      <p className={styles.subtext}>Hi {name.split(" ")[0]}. This gives you your AVANTRA ID and entry QR.</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.twoColRow}>
          <SelectField name="grade" label="Class" value={f.grade} onChange={set} error={errors.grade}>
            <option value="">Select</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </SelectField>
          <Field name="section" label="Section (optional)" placeholder="e.g. B" maxLength={10} value={f.section} onChange={set} error={errors.section} />
        </div>
        <SelectField name="school" label="School" value={f.school} onChange={set} error={errors.school}>
          <option value="">Select your school</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.city}
            </option>
          ))}
          <option value={OTHERS}>Others (not listed)</option>
        </SelectField>
        {f.school === OTHERS && (
          <Field name="otherSchoolName" label="School name" value={f.otherSchoolName} onChange={set} error={errors.otherSchoolName} />
        )}
        <Field name="phone" label="Your phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" value={f.phone} onChange={set} error={errors.phone} />
        <div className={styles.twoColRow}>
          <Field name="guardianPhone" label="Parent's phone (optional)" type="tel" inputMode="numeric" placeholder="10-digit mobile" value={f.guardianPhone} onChange={set} error={errors.guardianPhone} />
          <Field name="guardianEmail" label="Parent's email (optional)" type="email" value={f.guardianEmail} onChange={set} error={errors.guardianEmail} />
        </div>
        <div className={styles.checkboxGroup}>
          <label htmlFor="consent" className={styles.checkboxLabel}>
            <input id="consent" name="consent" type="checkbox" checked={f.consent} onChange={set} className={styles.checkboxInput} aria-invalid={!!errors.consent} />
            <span>My parent or guardian agrees to me taking part in AVANTRA 2026 and to these details being used for it.</span>
          </label>
          {errors.consent && <span className={styles.errorText}>{errors.consent}</span>}
        </div>
        <FormError message={errors.form} />
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? "Saving…" : "Get my AVANTRA ID"}
        </button>
      </form>
    </>
  );
}

function SchoolForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ schoolName: "", city: "", address: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((v) => ({ ...v, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" })); // fixing a field clears its message
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SchoolProfile.safeParse({ ...f, phone: f.phone.replace(/\D/g, "").slice(-10) });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setBusy(true);
    try {
      await api("/profile/school", parsed.data);
      onDone();
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.message });
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className={styles.heading}>Your school</h1>
      <p className={styles.subtext}>Once the AVANTRA team approves it, your students can pick it when they sign up.</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field name="schoolName" label="School name" value={f.schoolName} onChange={set} error={errors.schoolName} />
        <div className={styles.twoColRow}>
          <Field name="city" label="City" autoComplete="address-level2" value={f.city} onChange={set} error={errors.city} />
          <Field name="phone" label="Your phone" type="tel" inputMode="numeric" placeholder="10-digit mobile" value={f.phone} onChange={set} error={errors.phone} />
        </div>
        <Field name="address" label="Address" autoComplete="street-address" value={f.address} onChange={set} error={errors.address} />
        <FormError message={errors.form} />
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? "Saving…" : "Register school"}
        </button>
      </form>
    </>
  );
}
