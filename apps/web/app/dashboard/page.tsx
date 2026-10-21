"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, ApiError, apiReady, getMe, LOGIN_HREF, payExhibitionFee, studentSignupOpen, type Me } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { Tile, useLoad, useTabs } from "../admin/ui";

type Student = {
  avantraId: string;
  qrToken: string;
  grade: number;
  section: string | null;
  schoolName: string;
  feePaidAt: string | null;
  _count: { checkIns: number };
};
type WallMe = { open: boolean; points: number; solved: number; rank: number | null; players: number };
type Profile = { student: Student | null; ambassador: Ambassador | null };

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    (async () => {
      const m = await getMe();
      if (!m) return router.replace(LOGIN_HREF);
      if (!m.profileComplete) return router.replace("/profile");
      setMe(m);
      setProfile(await api<Profile>("/profile"));
    })().catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push(LOGIN_HREF);
  }

  if (me && profile?.student) return <StudentDashboard me={me} s={profile.student} logout={logout} onPaid={async () => setProfile(await api<Profile>("/profile"))} />;
  if (me && profile?.ambassador) return <AmbassadorDashboard me={me} a={profile.ambassador} logout={logout} />;

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
              {s.section ? `-${s.section}` : ""} · {s.schoolName}
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

type Ambassador = { code: string; schoolName: string; schoolCity: string; grade: number };
type Referral = { grade: number; schoolName: string; feePaidAt: string | null; user: { name: string; createdAt: string } };

function AmbassadorDashboard({ me, a, logout }: { me: Me; a: Ambassador; logout: () => void }) {
  const { data: friends, error, reload } = useLoad<Referral[]>("/ambassador/referrals");
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/registration?ref=${a.code}`;
  const all = friends ?? [];
  const paid = all.filter((f) => f.feePaidAt).length;

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
  }

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={t.page}>
        <div className={t.head}>
          <div>
            <h1 className={styles.heading} style={{ fontSize: "2rem", margin: 0 }}>{me.name}</h1>
            <span className={t.mute}>Class {a.grade} · {a.schoolName}, {a.schoolCity} · AVANTRA ambassador</span>
          </div>
          <span className={t.mute}>
            {me.email} · <button type="button" className={styles.link} onClick={logout}>Log out</button>
          </span>
        </div>

        <section className={t.panel} aria-labelledby="code">
          <h2 id="code">Your code</h2>
          <p className={t.mono} style={{ fontSize: "2.5rem", letterSpacing: "0.15em", margin: "0 0 8px" }}>{a.code}</p>
          <p className={t.mute}>Friends type this code when they fill in their details, or sign up from your link:</p>
          <div className={t.inline}>
            <span className={t.mono} style={{ wordBreak: "break-all" }}>{link}</span>
            <button type="button" className={t.ghost} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
          {!studentSignupOpen && <p className={t.mute} style={{ marginBottom: 0 }}>Student registration opens soon. Your code and link start counting from then.</p>}
        </section>

        <section className={t.panel} aria-labelledby="friends">
          <div className={t.head}>
            <h2 id="friends">Friends who joined</h2>
            <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
          </div>
          {error && <FormError message={error} />}
          <div className={t.tiles}>
            <Tile value={friends ? all.length : "…"} label="signed up with your code" />
            <Tile value={friends ? paid : "…"} label="paid the exhibition fee" />
          </div>
          {friends && all.length === 0 ? (
            <p className={t.mute}>No one yet. Share your link to get started.</p>
          ) : (
            friends && (
              <div className={t.scroll}>
                <table className={`${t.table} ${t.stack}`}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Class</th>
                      <th>School</th>
                      <th>Exhibition fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {all.map((f) => (
                      <tr key={f.user.createdAt + f.user.name}>
                        <td>{f.user.name}</td>
                        <td data-label="Class">{f.grade}</td>
                        <td data-label="School">{f.schoolName}</td>
                        <td>
                          <span className={`${t.pill} ${f.feePaidAt ? t.on : t.off}`}>{f.feePaidAt ? "paid" : "not paid"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
