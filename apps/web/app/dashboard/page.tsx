"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, apiReady, LOGIN_HREF, type Me } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import mv from "./events/events.module.css";
import { Tile } from "../admin/ui";
import { getTimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";
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
  const steps = [
    {
      title: "Register and pick a theme",
      sub: exhibition ? `Theme: ${exhibition.topic ?? "chosen"}` : "Choose one of the Science Exhibition themes.",
      done: !!exhibition,
      href: "/dashboard/events?event=exhibition&step=theme",
      action: "Register",
    },
    {
      title: "Pay the ₹299 fee",
      sub: s.feePaidAt ? "Paid. The school confirmed it." : reviewing ? "Sent. The school is checking your UTR." : "Pay by UPI to the school, then send the UTR.",
      done: !!s.feePaidAt,
      waiting: reviewing,
      href: "/dashboard/pay",
      action: reviewing ? "View" : "Pay now",
    },
    {
      title: `Team of ${max}`,
      sub: team ? `${team.name} · ${team.members.length} of ${max}${team.members.length < max ? ", share your code to fill it" : ", all set"}` : "Start a team or join a friend's.",
      done: !!team && team.members.length >= max,
      href: "/dashboard/teams",
      action: team ? "Open team" : "Find a team",
    },
  ];
  // A payment under review stays the next step ("View"): teams can't open until the school confirms it.
  const next = steps.findIndex((x) => !x.done);
  return (
    <ol className={t.checklist}>
      {steps.map((x, i) => (
        <li key={x.title} data-state={x.done ? "done" : x.waiting ? "waiting" : i === next ? "next" : undefined}>
          <span className={t.checkMark} aria-hidden>
            {x.done ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            ) : (
              i + 1
            )}
          </span>
          <span className={t.checkText}>
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
        <header className={`${t.pageHead} ${t.homeHead}`}>
          <div>
            <h1>
              {now ? greeting() : "Hello"}, {me.name.split(" ")[0]}!
            </h1>
            <p>
              Class {s.grade}
              {s.section ? `-${s.section}` : ""} · {s.schoolName}
            </p>
            <p className={t.tagline}>Every universe has a doorway. Yours opens on 19 December.</p>
          </div>
          {left && !left.isPast && (
            <div className={`${mv.portalWrap} ${t.homePortal}`} role="img" aria-label={`${left.days} days until AVANTRA 2026`}>
              <span className={mv.portal} />
              <span className={mv.portalLabel}>
                <strong>{left.days}</strong>
                days to go
              </span>
            </div>
          )}
        </header>

        <div className={t.stats}>
          <Tile value={s.feePaidAt ? "Paid" : reviewing ? "Checking" : "₹299"} label={s.feePaidAt ? "Exhibition fee" : reviewing ? "Fee, under review" : "Exhibition fee due"} />
          <Tile value={team ? `${team.members.length} / ${exhibition!.event.teamMax}` : "None"} label={team ? team.name : "Team"} />
          <Tile value={s.grade >= 9 ? "Senior" : "Junior"} label={s.grade >= 9 ? "Exhibition category, classes 9–12" : "Exhibition category, classes 6–8"} />
          <Tile value={<span className={t.mono}>{s.avantraId}</span>} label="Your AVANTRA ID" />
        </div>

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
                  {team && team.members.length >= exhibition!.event.teamMax ? "Ready" : s.feePaidAt ? "Fee paid" : reviewing ? "Under review" : exhibition ? "Registered" : "Not registered"}
                </span>
              </div>
              <p className={t.mute} style={{ margin: "0 0 14px" }}>
                Build a project in a team of 3 and present it to the judges. Entry to the fest is free; the exhibition is ₹299 per student.
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
                    {siteConfig.venue.name}, Rourkela · <a className={styles.link} href="/venue">Directions</a>
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
            <section className={`${t.panel} ${t.badgeCard}`} aria-labelledby="badge">
              <h2 id="badge">Entry badge</h2>
              {qr ? <img src={qr} alt={`Entry QR for ${s.avantraId}`} width={200} height={200} className={t.badgeQr} /> : <div className={t.badgeQr} aria-hidden />}
              <p className={styles.label} style={{ margin: "10px 0 2px", fontSize: "1.35rem", letterSpacing: "0.06em" }}>
                {s.avantraId}
              </p>
              <p className={t.mute} style={{ margin: "0 0 12px" }}>Show this at the gate. If it won&apos;t scan, give your AVANTRA ID.</p>
              {qr && (
                <a className={t.ghost} href={qr} download={`avantra-badge-${s.avantraId}.png`}>
                  Save to phone
                </a>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
