"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, apiReady, LOGIN_HREF, type Me } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { Tile, useTabs } from "../admin/ui";
import { useDashboard, type Student, type WallMe } from "./data";

export default function DashboardPage() {
  const router = useRouter();
  const { me, student, wall, loaded, failed } = useDashboard();

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push(LOGIN_HREF);
  }

  if (me && student) return <StudentDashboard me={me} s={student} w={wall} />;

  return (
    <AccountShell tagline={me ? `Welcome, ${me.name.split(" ")[0]}.` : "Your universe, at a glance."}>
      {!apiReady ? (
        <OpensSoon what="Your dashboard" />
      ) : failed ? (
        <FormError message={failed} />
      ) : !loaded || !me ? (
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

const STUDENT_TABS = { overview: "Overview", badge: "Entry badge" } as const;
const EVENT_DAY_TABS = { ...STUDENT_TABS, wall: "Wall" } as const;

function StudentDashboard({ me, s, w }: { me: Me; s: Student; w: WallMe | null }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    // Dark on cream so gate scanners read it easily, even off a dim phone screen.
    // Locked until the fee is paid: draw a stand-in code so the real one never shows under the blur.
    QRCode.toDataURL(s.feePaidAt ? s.qrToken : "AVANTRA-LOCKED", { width: 480, margin: 2, color: { dark: "#120e0c", light: "#f4ead9" } }).then(setQr);
  }, [s.qrToken, s.feePaidAt]);

  const days = s._count.checkIns;
  const live = !!w?.open; // the admin's "Open the Wall" is the event-day switch; until then the Wall and check-ins stay hidden
  // The Wall tab only exists on event day (the cast is safe: without it, "wall" is never a tab).
  const { tab, bar } = useTabs((live ? EVENT_DAY_TABS : STUDENT_TABS) as typeof EVENT_DAY_TABS, "overview");
  const reviewing = s.payments[0]?.method === "UPI" && s.payments[0].status === "CREATED";

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.appPage}`}>
        <header className={t.hero}>
          <div>
            <h1>{me.name}</h1>
            <span className={t.mute}>
              Class {s.grade}
              {s.section ? `-${s.section}` : ""} · {s.schoolName}
            </span>
            <div className={t.mute} style={{ marginTop: 4, overflowWrap: "anywhere" }}>{me.email}</div>
          </div>
          <span className={t.chip} aria-label={`AVANTRA ID ${s.avantraId}`}>{s.avantraId}</span>
        </header>

        {bar}
        {tab === "overview" && (
          <>
            <section className={t.panel} aria-labelledby="glance">
              <h2 id="glance">At a glance</h2>
              <div className={t.tiles}>
                <Tile value={s.feePaidAt ? "Paid" : reviewing ? "Checking" : "₹299"} label={s.feePaidAt ? "exhibition fee" : reviewing ? "exhibition fee, payment under review" : "exhibition fee, not paid yet"} />
                {live && (
                  <>
                    <Tile value={days === 0 ? "Not yet" : days === 1 ? "1 day" : `${days} days`} label="checked in at the fest" />
                    <Tile value={w.points} label={`Wall points · ${w.solved} solved`} />
                    <Tile value={w.rank ? `#${w.rank}` : "–"} label={w.rank ? `Wall rank of ${w.players}` : "Wall rank, after your first answer"} />
                  </>
                )}
              </div>
              <p className={t.mute}>
                Entry to the fest and its events is free. Taking part in the Science Exhibition costs ₹299 per student.
              </p>
              {s.feePaidAt ? (
                <a className={t.cta} href="/dashboard/teams">
                  <span>
                    <strong>Form your exhibition team</strong>
                    <br />
                    <span className={t.mute}>Start a team of 3 and share its code, or join a friend&apos;s team with theirs.</span>
                  </span>
                  <span className={t.btn}>Create team</span>
                </a>
              ) : (
                <a className={t.cta} href={reviewing ? "/dashboard/pay" : "/dashboard/events?event=exhibition&step=theme"}>
                  <span>
                    <strong>{reviewing ? "Payment under review" : "Register for the Science Exhibition"}</strong>
                    <br />
                    <span className={t.mute}>{reviewing ? "Check the status or change your UTR." : "Pick your theme, pay ₹299 by UPI, then form a team of 3."}</span>
                  </span>
                  <span className={t.btn}>{reviewing ? "View" : "Register"}</span>
                </a>
              )}
            </section>
            <section className={t.panel} aria-labelledby="fest">
              <h2 id="fest">AVANTRA 2026</h2>
              <p className={t.mute} style={{ marginBottom: 0 }}>
                19–20 December 2026. <a className={styles.link} href="/venue">How to reach the venue</a>
              </p>
            </section>
          </>
        )}
        {tab === "badge" && (
          <section className={t.panel} aria-labelledby="badge" style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
            <h2 id="badge">Your entry badge</h2>
            {s.feePaidAt ? (
              <>
                {qr && <img src={qr} alt={`Entry QR for ${s.avantraId}`} width={240} height={240} className={t.badgeQr} />}
                <p className={styles.label} style={{ margin: "10px 0 4px", fontSize: "1.6rem", letterSpacing: "0.06em" }}>
                  {s.avantraId}
                </p>
                <p className={t.mute}>Show this QR at the gate. If it won&apos;t scan, give your AVANTRA ID.</p>
                {qr && (
                  <a className={t.ghost} href={qr} download={`avantra-badge-${s.avantraId}.png`}>
                    Save badge to phone
                  </a>
                )}
              </>
            ) : (
              <>
                <div className={t.locked}>
                  {qr && <img src={qr} alt="" width={240} height={240} className={t.badgeQr} />}
                  <span className={t.lock} aria-hidden="true">🔒</span>
                </div>
                <p style={{ margin: "14px 0 4px", fontWeight: 700 }}>Locked</p>
                <p className={t.mute}>
                  {reviewing
                    ? "Your badge unlocks as soon as the school confirms your payment."
                    : "Your entry badge unlocks once you pay the ₹299 Science Exhibition fee."}
                </p>
                <a className={t.btn} href="/dashboard/pay">{reviewing ? "View payment" : "Pay now"}</a>
              </>
            )}
          </section>
        )}
        {tab === "wall" && live && (
          <section className={t.panel} aria-labelledby="wall">
            <h2 id="wall">Engagement Wall</h2>
            {live ? (
              <>
                <p className={t.mute}>Find challenge chits around the venue, scan one and answer to win points for you and your school.</p>
                <div className={t.inline}>
                  <a className={t.btn} href="/wall" style={{ textDecoration: "none" }}>Play the Wall</a>
                  <a className={t.ghost} href="/wall/leaderboard" style={{ textDecoration: "none" }}>Leaderboard</a>
                </div>
              </>
            ) : (
              <p className={t.mute} style={{ marginBottom: 0 }}>Revealed on event day.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

