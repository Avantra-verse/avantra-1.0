"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";

type School = { id: string; name: string; city: string; address?: string; status?: "PENDING" | "APPROVED" | "REJECTED" };
type Student = {
  avantraId: string;
  qrToken: string;
  grade: number;
  section: string | null;
  otherSchoolName: string | null;
  feePaidAt: string | null;
  school: School | null;
};
type Profile = { student: Student | null; school: School | null };
type MyStudent = { avantraId: string; grade: number; feePaidAt: string | null; user: { name: string } };

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    (async () => {
      const m = await getMe();
      if (!m) return router.replace("/login");
      if (!m.profileComplete) return router.replace("/profile");
      setMe(m);
      setProfile(await api<Profile>("/profile"));
    })().catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push("/login");
  }

  return (
    <AccountShell tagline={me ? `Welcome, ${me.name.split(" ")[0]}.` : "Your universe, at a glance."}>
      {!apiReady ? (
        <OpensSoon what="Your dashboard" />
      ) : failed ? (
        <FormError message={failed} />
      ) : !me || !profile ? (
        <p className={styles.subtext} role="status">Loading…</p>
      ) : (
        <>
          {profile.student ? <StudentCard name={me.name} s={profile.student} /> : profile.school && <SchoolCard school={profile.school} />}
          <div className={styles.footerLine}>
            Signed in as {me.email} ·{" "}
            <button type="button" className={styles.link} onClick={logout}>
              Log out
            </button>
          </div>
        </>
      )}
    </AccountShell>
  );
}

function StudentCard({ name, s }: { name: string; s: Student }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    // Dark on cream so gate scanners read it easily, even off a dim phone screen.
    QRCode.toDataURL(s.qrToken, { width: 480, margin: 2, color: { dark: "#120e0c", light: "#f4ead9" } }).then(setQr);
  }, [s.qrToken]);

  return (
    <>
      <h1 className={styles.heading}>{name}</h1>
      <p className={styles.subtext}>
        Class {s.grade}
        {s.section ? `-${s.section}` : ""} · {s.school?.name ?? s.otherSchoolName}
      </p>
      <div style={{ display: "grid", justifyItems: "center", gap: 10, margin: "8px 0 18px" }}>
        {qr && <img src={qr} alt={`Entry QR for ${s.avantraId}`} width={220} height={220} style={{ borderRadius: 14 }} />}
        <p className={styles.label} style={{ margin: 0, fontSize: "1.6rem", letterSpacing: "0.06em" }}>
          {s.avantraId}
        </p>
        <p className={styles.subtext} style={{ margin: 0, textAlign: "center" }}>
          Show this QR at the gate. If it won't scan, give your AVANTRA ID.
        </p>
      </div>
      <p className={styles.subtext} style={{ marginBottom: 0 }}>
        Science Exhibition fee: <strong>{s.feePaidAt ? "Paid ✓" : "Not paid (₹199)"}</strong>
        <br />
        Entry and all other events are free.
      </p>
      <Link href="/events" className={styles.submitBtn} style={{ display: "block", textAlign: "center", marginTop: 18, textDecoration: "none" }}>
        Events &amp; teams
      </Link>
    </>
  );
}

const STATUS = {
  PENDING: "Waiting for approval by the AVANTRA team.",
  APPROVED: "Approved. Students can now pick your school when they sign up.",
  REJECTED: "Not approved. Contact the AVANTRA team.",
};

function SchoolCard({ school }: { school: School }) {
  const [students, setStudents] = useState<MyStudent[] | null>(null);
  useEffect(() => {
    api<MyStudent[]>("/coordinator/students").then(setStudents).catch(() => setStudents([]));
  }, []);

  return (
    <>
      <h1 className={styles.heading}>{school.name}</h1>
      <p className={styles.subtext}>
        {school.city} · {STATUS[school.status ?? "PENDING"]}
      </p>
      <h2 className={styles.label}>Your students ({students?.length ?? "…"})</h2>
      {students?.length === 0 && <p className={styles.subtext}>No students yet.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {students?.map((st) => (
          <li key={st.avantraId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid rgba(244,234,217,.16)" }}>
            <span>
              {st.user.name} <span className={styles.chipSubtext}>· Class {st.grade}</span>
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{st.avantraId}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
