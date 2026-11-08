"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, apiReady, LOGIN_HREF, type Me } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import mv from "./events/events.module.css";
import d from "./dashboard.module.css";
import { Cosmos } from "./cosmos";
import { Tile } from "../admin/ui";
import { getTimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";
import { feeTotal } from "@/components/account/StayOption";
import { Community } from "@/components/Community";
import { feeReviewing, useDashboard, type MyReg, type Student, type WallMe } from "./data";

export default function DashboardPage() {
  const router = useRouter();
  const { me, student, wall, regs, loaded, failed } = useDashboard();

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push(LOGIN_HREF);
  }

  if (me && student) return <StudentDashboard me={me} s={student} w={wall} regs={regs} />;

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
          {/* Only staff land here: students without a profile are sent to /profile by useDashboard. */}
          <p className={styles.subtext}>
            The student dashboard is for students. You&apos;re signed in with {me.role === "ADMIN" ? "an admin" : "a staff"} account.
          </p>
          <a className={t.btn} href={me.role === "ADMIN" ? "/admin" : "/staff"}>
            {me.role === "ADMIN" ? "Open the admin panel" : "Open the staff panel"}
          </a>
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

// Sign-up to show day: each step done or not, from what the dashboard already loaded.
function Checklist({ s, exhibition, reviewing }: { s: Student; exhibition: MyReg | undefined; reviewing: boolean }) {
  const team = exhibition?.teamMember?.team;
  const max = exhibition?.event.teamMax ?? 3;
  const min = exhibition?.event.teamMin ?? 1;
  const steps = [
    {
      title: "Register and pick a theme",
      sub: exhibition ? `Theme: ${exhibition.topic ?? "chosen"}` : "Choose one of the Science Exhibition themes.",
      done: !!exhibition,
      href: "/dashboard/events?event=exhibition&step=theme",
      action: "Register",
    },
    {
      title: `Pay the ₹${feeTotal(s.accommodation)} fee`,
      sub: s.feePaidAt ? "Paid. The school confirmed it." : reviewing ? "Sent. The school is checking your UTR." : "Pay by UPI to the school, then send the UTR.",
      done: !!s.feePaidAt,
      waiting: reviewing,
      href: "/dashboard/pay",
      action: reviewing ? "View" : "Pay now",
    },
    {
      title: `Team of ${min === max ? max : `${min} to ${max}`}`,
      sub: team ? `${team.name} · ${team.members.length} of ${max}${team.members.length < min ? ", share your code to fill it" : team.members.length < max ? ", all set (friends can still join)" : ", all set"}` : "Start a team (on your own is fine) or join a friend's.",
      done: !!team && team.members.length >= min,
      href: "/dashboard/teams",
      action: team ? "Open team" : "Find a team",
    },
  ];
  // A payment under review stays the next step ("View"): teams can't open until the school confirms it.
  const next = steps.findIndex((x) => !x.done);
  return (
    <ol className={d.doors}>
      {steps.map((x, i) => (
        <li key={x.title} data-state={x.done ? "done" : x.waiting ? "waiting" : i === next ? "next" : undefined}>
          <span className={d.door} aria-hidden>
            {x.done ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            ) : (
              i + 1
            )}
          </span>
          <span className={d.doorText}>
            <strong>
              {x.title}
              <span className="sr-only">{x.done ? " (done)" : x.waiting ? " (waiting)" : ""}</span>
            </strong>
            <span className={t.mute}>{x.sub}</span>
          </span>
          {i === next && (
            <a className={t.btn} href={x.href}>
              {x.action}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function StudentDashboard({ me, s, w, regs }: { me: Me; s: Student; w: WallMe | null; regs: MyReg[] }) {
  const [qr, setQr] = useState("");
  const [now, setNow] = useState<Date | null>(null); // set after mount so the server and browser agree
  useEffect(() => {
    // Dark on cream so gate scanners read it easily, even off a dim phone screen.
    QRCode.toDataURL(s.qrToken, { width: 480, margin: 2, color: { dark: "#120e0c", light: "#f4ead9" } }).then(setQr);
  }, [s.qrToken]);
  useEffect(() => setNow(new Date()), []);

  const days = s._count.checkIns;
  const live = !!w?.open; // the admin's "Open the Wall" is the event-day switch; until then the Wall and check-ins stay hidden
  const reviewing = feeReviewing(s);
  const exhibition = regs.find((r) => r.event.slug === "exhibition");
  const team = exhibition?.teamMember?.team;
  const left = now && getTimeRemaining(siteConfig.eventDateISO, now);

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.appPage}`}>
        <header className={d.hero}>
          <span className={d.meteor} aria-hidden="true" />
          <div>
            <h1 className={d.hello}>
              {now ? greeting() : "Hello"}, {me.name.split(" ")[0]}
            </h1>
            <p className={d.heroSub}>
              Class {s.grade}
              {s.section ? `-${s.section}` : ""} · {s.schoolName}
            </p>
            <p className={d.heroLine}>Every universe has a doorway. Yours opens on 19 December.</p>
          </div>
          <Cosmos chosen={exhibition?.topic}>
            {left && !left.isPast && (
              <div className={`${mv.portalWrap} ${d.heroPortal}`} role="img" aria-label={`${left.days} days until AVANTRA 2026`}>
                <span className={mv.portal} />
                <span className={mv.portalLabel}>
                  <strong>{left.days}</strong>
                  days to go
                </span>
              </div>
            )}
          </Cosmos>
        </header>

        <div className={t.dashGrid}>
          <div>
            {live && (
              <section className={t.panel} aria-labelledby="today">
                <div className={t.panelHead}>
                  <h2 id="today">Event day</h2>
                  <a className={t.btn} href="/wall">Play the Wall</a>
                </div>
                <div className={t.tiles}>
                  <Tile value={days === 0 ? "Not yet" : days === 1 ? "1 day" : `${days} days`} label="checked in at the fest" />
                  <Tile value={w.points} label={`Wall points · ${w.solved} solved`} />
                  <Tile value={w.rank ? `#${w.rank}` : "–"} label={w.rank ? `Wall rank of ${w.players}` : "Wall rank, after your first answer"} />
                </div>
                <p className={t.mute} style={{ marginBottom: 0 }}>
                  <a className={styles.link} href="/wall/leaderboard">See the leaderboard</a>
                </p>
              </section>
            )}
            <section className={t.panel} aria-labelledby="exhibition">
              <div className={t.panelHead}>
                <h2 id="exhibition">Science Exhibition</h2>
                <span className={t.status} data-tone={s.feePaidAt ? "ok" : reviewing ? "warn" : undefined}>
                  {team && team.members.length >= exhibition!.event.teamMin ? "Ready" : s.feePaidAt ? "Fee paid" : reviewing ? "Under review" : exhibition ? "Registered" : "Not registered"}
                </span>
              </div>
              <p className={t.mute} style={{ margin: "0 0 14px" }}>
                Build a project on your own or in a team of 2 or 3 from the same class and present it to the judges. Entry to the fest is free; the exhibition is ₹299 per student.
              </p>
              <Checklist s={s} exhibition={exhibition} reviewing={reviewing} />
            </section>
            <section className={t.panel} aria-labelledby="fest">
              <h2 id="fest">AVANTRA 2026</h2>
              <dl className={t.facts}>
                <div>
                  <dt>When</dt>
                  <dd>19–20 December 2026</dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <dd>
                    {siteConfig.venue.name}, Rourkela · <a className={styles.link} href="/about#venue">Directions</a>
                  </dd>
                </div>
                <div>
                  <dt>Help</dt>
                  <dd>
                    <a className={styles.link} href="/contact">Contact the organisers</a>
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <aside>
            <section className={d.pass} aria-labelledby="badge">
              <div className={d.passInner}>
                <div className={d.passTop}>
                  <h2 id="badge">Multiverse pass</h2>
                  <span className={d.passYear}>AVANTRA 2026</span>
                </div>
                <p className={d.passName}>{me.name}</p>
                <div className={d.passBody}>
                  <dl className={d.passFacts}>
                    <div>
                      <dt>AVANTRA ID</dt>
                      <dd className={d.passId}>{s.avantraId}</dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>
                        {s.grade}
                        {s.section ? `-${s.section}` : ""} · {s.grade >= 9 ? "Senior" : "Junior"}
                      </dd>
                    </div>
                    <div>
                      <dt>Universe</dt>
                      <dd>{exhibition?.topic ?? "Pick one when you register"}</dd>
                    </div>
                  </dl>
                  {qr ? <img src={qr} alt={`Entry QR for ${s.avantraId}`} width={220} height={220} className={d.passQr} /> : <div className={d.passQr} aria-hidden />}
                </div>
                <div className={d.passFoot}>
                  <p>Show this at the gate. If it won&apos;t scan, give your AVANTRA ID.</p>
                  {qr && (
                    <a className={t.ghost} href={qr} download={`avantra-badge-${s.avantraId}.png`}>
                      Save to phone
                    </a>
                  )}
                </div>
              </div>
            </section>
            <Community compact />
          </aside>
        </div>
      </div>
    </div>
  );
}
