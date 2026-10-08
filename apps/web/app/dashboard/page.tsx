"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, ApiError, apiReady, getMe, payExhibitionFee, type Me } from "@/lib/api";
import { AccountShell, Field, FormError, OpensSoon, styles } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { Tile, useLoad, useTabs } from "../admin/ui";

type School = { id: string; name: string; city: string; address?: string; status?: "PENDING" | "APPROVED" | "REJECTED" };
type Student = {
  avantraId: string;
  qrToken: string;
  grade: number;
  section: string | null;
  otherSchoolName: string | null;
  feePaidAt: string | null;
  school: School | null;
  _count: { checkIns: number };
};
type WallMe = { open: boolean; points: number; solved: number; rank: number | null; players: number };
type Profile = { student: Student | null; school: School | null };
type MyStudent = { avantraId: string; grade: number; section: string | null; feePaidAt: string | null; user: { name: string }; _count: { checkIns: number } };

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

  // An approved school gets a full-width dashboard; everything else fits the small account card.
  if (me && profile?.student) return <StudentDashboard me={me} s={profile.student} logout={logout} onPaid={async () => setProfile(await api<Profile>("/profile"))} />;
  if (me && profile?.school?.status === "APPROVED") return <SchoolDashboard email={me.email} school={profile.school} logout={logout} />;

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
          {profile.school && <SchoolCard school={profile.school} />}
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

const STUDENT_TABS = { overview: "Overview", badge: "Entry badge", wall: "Wall" } as const;

function StudentDashboard({ me, s, logout, onPaid }: { me: Me; s: Student; logout: () => void; onPaid: () => Promise<void> }) {
  const { tab, bar } = useTabs(STUDENT_TABS, "overview");
  const [qr, setQr] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function pay() {
    setPaying(true);
    setPayError("");
    try {
      if (await payExhibitionFee(me)) await onPaid();
    } catch (e) {
      setPayError((e as ApiError).message);
    } finally {
      setPaying(false);
    }
  }
  const wall = useLoad<WallMe>("/wall/me");
  useEffect(() => {
    // Dark on cream so gate scanners read it easily, even off a dim phone screen.
    QRCode.toDataURL(s.qrToken, { width: 480, margin: 2, color: { dark: "#120e0c", light: "#f4ead9" } }).then(setQr);
  }, [s.qrToken]);

  const days = s._count.checkIns;
  const w = wall.data;

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={t.page}>
        <div className={t.head}>
          <div>
            <h1 className={styles.heading} style={{ fontSize: "2rem", margin: 0 }}>{me.name}</h1>
            <span className={t.mute}>
              Class {s.grade}
              {s.section ? `-${s.section}` : ""} · {s.school?.name ?? s.otherSchoolName}
            </span>
          </div>
          <span className={t.mute}>
            {me.email} · <button type="button" className={styles.link} onClick={logout}>Log out</button>
          </span>
        </div>

        {bar}
        {tab === "overview" && (
          <>
            <section className={t.panel} aria-labelledby="glance">
              <h2 id="glance">At a glance</h2>
              <div className={t.tiles}>
                <Tile value={s.feePaidAt ? "Paid" : "₹199"} label={s.feePaidAt ? "exhibition fee" : "exhibition fee, not paid yet"} />
                <Tile value={days === 0 ? "Not yet" : days === 1 ? "1 day" : `${days} days`} label="checked in at the fest" />
                <Tile value={w ? w.points : "…"} label={w ? `Wall points · ${w.solved} solved` : "Wall points"} />
                <Tile value={w?.rank ? `#${w.rank}` : "–"} label={w?.rank ? `Wall rank of ${w.players}` : "Wall rank, after your first answer"} />
              </div>
              <p className={t.mute} style={{ marginBottom: s.feePaidAt ? 0 : undefined }}>
                Entry and all other events are free. The ₹199 fee is only for the Science Exhibition.
              </p>
              {!s.feePaidAt && (
                <>
                  <button type="button" className={t.btn} onClick={pay} disabled={paying}>
                    {paying ? "Opening…" : "Pay ₹199 online"}
                  </button>
                  <FormError message={payError} />
                </>
              )}
            </section>
            <section className={t.panel} aria-labelledby="fest">
              <h2 id="fest">AVANTRA 2026</h2>
              <p className={t.mute} style={{ marginBottom: 0 }}>
                December 2026, dates soon. <a className={styles.link} href="/venue">How to reach the venue</a>
              </p>
            </section>
          </>
        )}
        {tab === "badge" && (
          <section className={t.panel} aria-labelledby="badge" style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
            <h2 id="badge">Your entry badge</h2>
            {qr && <img src={qr} alt={`Entry QR for ${s.avantraId}`} width={240} height={240} style={{ display: "block", margin: "0 auto", borderRadius: 14, maxWidth: "100%", height: "auto" }} />}
            <p className={styles.label} style={{ margin: "10px 0 4px", fontSize: "1.6rem", letterSpacing: "0.06em" }}>
              {s.avantraId}
            </p>
            <p className={t.mute}>Show this QR at the gate. If it won&apos;t scan, give your AVANTRA ID.</p>
            {qr && (
              <a className={t.ghost} href={qr} download={`avantra-badge-${s.avantraId}.png`} style={{ display: "inline-block", textDecoration: "none" }}>
                Save badge to phone
              </a>
            )}
          </section>
        )}
        {tab === "wall" && (
          <section className={t.panel} aria-labelledby="wall">
            <h2 id="wall">Engagement Wall</h2>
            <p className={t.mute}>
              Find challenge chits around the venue, scan one and answer to win points for you and your school.
              {w && !w.open && " The Wall opens on event day."}
            </p>
            <div className={t.inline}>
              <a className={t.btn} href="/wall" style={{ textDecoration: "none" }}>Play the Wall</a>
              <a className={t.ghost} href="/wall/leaderboard" style={{ textDecoration: "none" }}>Leaderboard</a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const STATUS = {
  PENDING: "Waiting for approval by the AVANTRA team. We'll email you when it's approved, so you can close this page.",
  REJECTED: "Not approved. Contact the AVANTRA team.",
};

function SchoolCard({ school }: { school: School }) {
  return (
    <>
      <h1 className={styles.heading}>{school.name}</h1>
      <p className={styles.subtext}>
        {school.city} · {STATUS[school.status === "REJECTED" ? "REJECTED" : "PENDING"]}
      </p>
    </>
  );
}

const SCHOOL_TABS = { overview: "Overview", students: "Students" } as const;

function SchoolDashboard({ email, school, logout }: { email: string; school: School; logout: () => void }) {
  const { data: students, error, reload } = useLoad<MyStudent[]>("/coordinator/students");
  const { tab, bar } = useTabs(SCHOOL_TABS, "overview");
  const [query, setQuery] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  const all = students ?? [];
  const paid = all.filter((st) => st.feePaidAt).length;
  const needle = query.trim().toLowerCase();
  const shown = all.filter(
    (st) => (!unpaidOnly || !st.feePaidAt) && (!needle || st.user.name.toLowerCase().includes(needle) || st.avantraId.toLowerCase().includes(needle)),
  );

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={t.page}>
        <div className={t.head}>
          <div>
            <h1 className={styles.heading} style={{ fontSize: "2rem", margin: 0 }}>{school.name}</h1>
            <span className={t.mute}>{school.city} · School coordinator</span>
          </div>
          <span className={t.mute}>
            {email} · <button type="button" className={styles.link} onClick={logout}>Log out</button>
          </span>
        </div>

        {bar}
        {tab === "overview" && (
          <section className={t.panel} aria-labelledby="numbers">
            <div className={t.head}>
              <h2 id="numbers">Your school at AVANTRA</h2>
              <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
            </div>
            {error && <FormError message={error} />}
            <div className={t.tiles}>
              <Tile value={students ? all.length : "…"} label="students signed up" />
              <Tile value={students ? paid : "…"} label="exhibition fee paid" />
              <Tile value={students ? all.length - paid : "…"} label="fee not paid yet" />
              <Tile value={students ? all.filter((st) => st._count.checkIns > 0).length : "…"} label="checked in at the fest" />
            </div>
            <p className={t.mute} style={{ marginBottom: 0 }}>
              Ask your students to sign up on the AVANTRA website and pick <strong>{school.name}</strong> as their school. They show up here as soon as they finish.
            </p>
          </section>
        )}
        {tab === "students" && (
          <section className={t.panel} aria-labelledby="students">
            <h2 id="students">Students</h2>
            <div className={t.inline}>
              <Field name="find" label="Find by name or AVANTRA ID" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} />
                <span>Fee not paid only</span>
              </label>
            </div>
            {!students ? (
              !error && <p className={t.mute} role="status">Loading…</p>
            ) : all.length === 0 ? (
              <p className={t.mute}>No students yet.</p>
            ) : shown.length === 0 ? (
              <p className={t.mute}>No students match.</p>
            ) : (
              <div className={t.scroll}>
                <table className={`${t.table} ${t.stack}`}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Class</th>
                      <th>AVANTRA ID</th>
                      <th>Exhibition fee</th>
                      <th>At the fest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((st) => (
                      <tr key={st.avantraId}>
                        <td>{st.user.name}</td>
                        <td data-label="Class">
                          {st.grade}
                          {st.section ? `-${st.section}` : ""}
                        </td>
                        <td className={t.mono}>{st.avantraId}</td>
                        <td>
                          <span className={`${t.pill} ${st.feePaidAt ? t.on : t.off}`}>{st.feePaidAt ? "paid" : "not paid"}</span>
                        </td>
                        <td data-label="At the fest">{st._count.checkIns === 0 ? <span className={t.mute}>not yet</span> : st._count.checkIns === 1 ? "1 day" : `${st._count.checkIns} days`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
