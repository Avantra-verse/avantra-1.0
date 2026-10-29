"use client";

// Every event, open to anyone. Students with a profile register here, pay the ₹299 exhibition
// fee, and create or join teams: by 6-letter invite code, by scanning the team's QR, or by asking a team
// that has room and waiting for its leader. Solo events need no team.
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { EXHIBITION_TOPICS, InviteCode } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, SelectField, styles as account } from "@/components/account/Account";
import styles from "./events.module.css";

type Category = "EXHIBITION" | "TECHNOLOGY" | "EXPERIENCE" | "WORKSHOP";
type Event = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: Category;
  registrationOpen: boolean;
  teamMin: number;
  teamMax: number;
  spotsLeft: number | null;
};
type Team = {
  id: string;
  name: string;
  inviteCode: string;
  projectTitle: string | null;
  topic: string | null;
  members: { registrationId: string; isLeader: boolean; registration: { student: { avantraId: string; user: { name: string } } } }[];
  joinRequests: { registrationId: string; registration: { student: { avantraId: string; user: { name: string } } } }[];
};
type OpenTeam = { id: string; name: string; projectTitle: string | null; members: number; leaderName: string | null; school: string | null; requested: boolean };
type Reg = { id: string; eventId: string; teamMember: { isLeader: boolean; team: Team } | null };

const CATEGORIES: [Category, string][] = [
  ["EXHIBITION", "Science Exhibition"],
  ["TECHNOLOGY", "Technology"],
  ["EXPERIENCE", "Experiences"],
  ["WORKSHOP", "Workshops"],
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [feePaid, setFeePaid] = useState(false);
  const [failed, setFailed] = useState("");
  const [joinNote, setJoinNote] = useState("");

  const load = useCallback(async () => {
    const [ev, m] = await Promise.all([api<Event[]>("/events"), getMe()]);
    // A scanned team QR opens /events?join=CODE. Logged out: log in first, then come back here.
    const code = InviteCode.safeParse(new URLSearchParams(window.location.search).get("join"));
    if (code.success) {
      if (!m) return window.location.replace(`/login?next=${encodeURIComponent(`/events?join=${code.data}`)}`);
      window.history.replaceState(null, "", "/events");
      if (m.role === "STUDENT" && m.profileComplete) {
        await api("/teams/join", { inviteCode: code.data }).then(
          () => setJoinNote("You joined the team."),
          (e: ApiError) => setJoinNote(e.message),
        );
      }
    }
    if (m?.role === "STUDENT" && m.profileComplete) {
      const [p, r] = await Promise.all([api<{ student: { feePaidAt: string | null } | null }>("/profile"), api<Reg[]>("/registrations/mine")]);
      setFeePaid(!!p.student?.feePaidAt);
      setRegs(r);
    }
    setMe(m);
    setEvents(ev);
  }, []);

  useEffect(() => {
    if (apiReady) load().catch((e: ApiError) => setFailed(e.message));
  }, [load]);

  const student = me?.role === "STUDENT" && me.profileComplete ? me : null;

  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <main className={account.wrapper}>
        <div className={styles.page}>
          <div className={account.card}>
            <h1 className={account.heading}>Events</h1>
            <p className={account.subtext}>Entry and every event are free. Only the Science Exhibition has a ₹299 fee, paid once.</p>
            {!apiReady ? (
              <OpensSoon what="Event registration" />
            ) : failed ? (
              <FormError message={failed} />
            ) : !events ? (
              <p className={account.subtext} role="status">Loading…</p>
            ) : (
              <>
                {student ? (
                  <FeeBox paid={feePaid} />
                ) : (
                  <p className={styles.fee}>
                    {!me ? (
                      <span>
                        <Link href="/login" className={account.link}>Log in</Link> or{" "}
                        <Link href="/registration" className={account.link}>sign up</Link> to register for events.
                      </span>
                    ) : me.role === "STUDENT" ? (
                      <span>
                        <Link href="/profile" className={account.link}>Finish your profile</Link> to register for events.
                      </span>
                    ) : (
                      <span>Students register for events from their own account.</span>
                    )}
                  </p>
                )}
                {joinNote && (
                  <p className={styles.fee} role="status">
                    {joinNote}
                  </p>
                )}
                {events.length === 0 && <p className={account.subtext}>Events will be announced soon.</p>}
                {CATEGORIES.map(([cat, title]) => {
                  const list = events.filter((e) => e.category === cat);
                  if (!list.length) return null;
                  return (
                    <section key={cat}>
                      <h2 className={styles.category}>{title}</h2>
                      <ul className={styles.list}>
                        {list.map((e) => (
                          <EventCard key={e.id} event={e} reg={regs.find((r) => r.eventId === e.id)} student={!!student} feePaid={feePaid} onChange={load} />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FeeBox({ paid }: { paid: boolean }) {
  return (
    <div className={styles.fee}>
      <span>
        Science Exhibition fee: <strong>{paid ? "Paid ✓" : "₹299, not paid yet"}</strong>
      </span>
      {!paid && (
        <Link className={styles.btn} href="/dashboard">
          Pay ₹299 on your dashboard
        </Link>
      )}
    </div>
  );
}

function teamSize(e: Event) {
  if (e.teamMax === 1) return "Solo";
  return e.teamMin === e.teamMax ? `Teams of ${e.teamMax}` : `Teams of ${e.teamMin}–${e.teamMax}`;
}

function EventCard({ event: e, reg, student, feePaid, onChange }: { event: Event; reg?: Reg; student: boolean; feePaid: boolean; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Every action: call the API, then reload the page's data so all cards stay in step.
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onChange();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const team = reg?.teamMember?.team;
  const withdraw = () => {
    if (confirm(`Withdraw from ${e.name}?`)) run(() => api(`/registrations/${reg!.id}`, undefined, "DELETE"));
  };

  return (
    <li className={styles.event} data-registered={!!reg}>
      <div className={styles.eventHead}>
        <h3 className={styles.eventName}>{e.name}</h3>
        <span className={styles.meta}>
          {teamSize(e)}
          {e.spotsLeft !== null && ` · ${e.spotsLeft} spots left`}
          {!e.registrationOpen && " · Registration closed"}
        </span>
      </div>
      {e.description && <p className={styles.description}>{e.description}</p>}

      {student && (
        <div className={styles.actions}>
          {reg ? (
            <>
              <span className={styles.done}>Registered ✓</span>
              {(!team || e.teamMax === 1) && (
                <button type="button" className={account.link} onClick={withdraw} disabled={busy}>
                  Withdraw
                </button>
              )}
            </>
          ) : !e.registrationOpen || e.spotsLeft === 0 ? null : e.category === "EXHIBITION" && !feePaid ? (
            <span className={styles.meta}>Pay the ₹299 fee above, then register here.</span>
          ) : (
            <button type="button" className={styles.btn} onClick={() => run(() => api("/registrations", { eventId: e.id }))} disabled={busy}>
              {busy ? "Registering…" : "Register"}
            </button>
          )}
        </div>
      )}

      {reg && e.teamMax > 1 && (
        <div className={styles.team}>
          {team ? <TeamView event={e} team={team} leader={reg.teamMember!.isLeader} busy={busy} run={run} /> : <TeamForms event={e} regId={reg.id} busy={busy} run={run} />}
        </div>
      )}
      <FormError message={error} />
    </li>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;

function TeamView({ event: e, team, leader, busy, run }: { event: Event; team: Team; leader: boolean; busy: boolean; run: Run }) {
  const n = team.members.length;
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/events?join=${team.inviteCode}`, { width: 320, margin: 2 }).then(setQr);
  }, [team.inviteCode]);
  return (
    <>
      <p style={{ margin: 0 }}>
        Team <strong>{team.name}</strong>
        {team.projectTitle && ` · ${team.projectTitle}`}
        {team.topic && <span className={styles.meta}> ({team.topic})</span>}
      </p>
      <p className={styles.meta} style={{ margin: "4px 0 0" }}>
        {n < e.teamMin ? `Needs at least ${e.teamMin} members (${n} so far).` : `${n} of ${e.teamMax} members.`}
        {n < e.teamMax && " Share the invite code or the QR so friends can join."}
      </p>
      {n < e.teamMax && (
        <p style={{ margin: "8px 0 0" }}>
          Invite code: <span className={styles.code}>{team.inviteCode}</span>
          {leader && (
            <>
              {" · "}
              <button type="button" className={account.link} disabled={busy} onClick={() => run(() => api(`/teams/${team.id}/invite-code`, {}))}>
                New code
              </button>
            </>
          )}
        </p>
      )}
      {n < e.teamMax && qr && (
        <img src={qr} alt={`QR code to join team ${team.name}`} width={160} height={160} style={{ display: "block", marginTop: 10, borderRadius: 10 }} />
      )}
      {leader && n < e.teamMax && team.joinRequests.length > 0 && (
        <>
          <p className={styles.meta} style={{ margin: "14px 0 0" }}>
            Asking to join
          </p>
          <ul className={styles.members}>
            {team.joinRequests.map((r) => (
              <li key={r.registrationId}>
                <span>
                  {r.registration.student.user.name}
                  <span className={styles.meta}> · {r.registration.student.avantraId}</span>
                </span>
                <span className={styles.actions} style={{ margin: 0 }}>
                  <button type="button" className={account.link} disabled={busy} onClick={() => run(() => api(`/teams/${team.id}/requests/${r.registrationId}/accept`, {}))}>
                    Accept
                  </button>
                  <button type="button" className={account.link} disabled={busy} onClick={() => run(() => api(`/teams/${team.id}/requests/${r.registrationId}`, undefined, "DELETE"))}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <ul className={styles.members}>
        {team.members.map((m) => (
          <li key={m.registrationId}>
            <span>
              {m.registration.student.user.name}
              {m.isLeader && <span className={styles.meta}> · Leader</span>}
            </span>
            {leader && !m.isLeader ? (
              <button
                type="button"
                className={account.link}
                disabled={busy}
                onClick={() => confirm(`Remove ${m.registration.student.user.name} from the team?`) && run(() => api(`/teams/${team.id}/members/${m.registrationId}`, undefined, "DELETE"))}
              >
                Remove
              </button>
            ) : (
              <span className={styles.meta}>{m.registration.student.avantraId}</span>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" className={account.link} disabled={busy} onClick={() => confirm("Leave this team?") && run(() => api(`/teams/${team.id}/leave`, {}))}>
          Leave team
        </button>
      </div>
    </>
  );
}

function TeamForms({ event: e, regId, busy, run }: { event: Event; regId: string; busy: boolean; run: Run }) {
  const exhibition = e.category === "EXHIBITION";
  const [f, setF] = useState({ name: "", projectTitle: "", topic: "", code: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const id = (field: string) => `${e.slug}-${field}`; // several cards can show these forms at once
  const set = (field: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((v) => ({ ...v, [field]: ev.target.value }));
    setErrors((x) => ({ ...x, [field]: "" }));
  };

  function create(ev: React.FormEvent) {
    ev.preventDefault();
    const found: Record<string, string> = {};
    const name = f.name.trim();
    const projectTitle = f.projectTitle.trim();
    if (name.length < 2 || name.length > 60) found.name = "2 to 60 characters.";
    if (exhibition && (projectTitle.length < 3 || projectTitle.length > 150)) found.projectTitle = "3 to 150 characters.";
    if (exhibition && !f.topic) found.topic = "Pick a topic.";
    setErrors(found);
    if (Object.keys(found).length) return;
    run(() => api("/teams", { eventId: e.id, name, ...(exhibition && { projectTitle, topic: f.topic }) }));
  }

  function join(ev: React.FormEvent) {
    ev.preventDefault();
    const code = InviteCode.safeParse(f.code);
    if (!code.success) return setErrors({ code: "Invite codes are 6 letters or digits." });
    run(() => api("/teams/join", { inviteCode: code.data }));
  }

  return (
    <>
      <p className={styles.meta} style={{ margin: 0 }}>
        You&apos;re not in a team yet. Start one and share its code, join a friend&apos;s team with theirs, or ask a team below.
      </p>
      <div className={styles.forms}>
        <form className={account.form} onSubmit={create} noValidate>
          <Field name={id("name")} label="Team name" maxLength={60} value={f.name} onChange={set("name")} error={errors.name} />
          {exhibition && (
            <>
              <Field name={id("projectTitle")} label="Project title" maxLength={150} value={f.projectTitle} onChange={set("projectTitle")} error={errors.projectTitle} />
              <SelectField name={id("topic")} label="Topic" value={f.topic} onChange={set("topic")} error={errors.topic}>
                <option value="">Select a topic</option>
                {EXHIBITION_TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectField>
            </>
          )}
          <button type="submit" className={styles.btn} disabled={busy}>
            Start a team
          </button>
        </form>
        <form className={account.form} onSubmit={join} noValidate>
          <Field name={id("code")} label="Invite code" placeholder="e.g. K7Q2XM" maxLength={6} autoCapitalize="characters" value={f.code} onChange={set("code")} error={errors.code} />
          <button type="submit" className={styles.btn} disabled={busy}>
            Join team
          </button>
        </form>
      </div>
      <OpenTeams event={e} regId={regId} busy={busy} run={run} />
    </>
  );
}

// Teams with room. Asking sends a request; the team's leader accepts or declines it.
function OpenTeams({ event: e, regId, busy, run }: { event: Event; regId: string; busy: boolean; run: Run }) {
  const [teams, setTeams] = useState<OpenTeam[]>([]);
  const [q, setQ] = useState("");
  const reload = useCallback(() => api<OpenTeam[]>(`/teams?eventId=${e.id}`).then(setTeams, () => setTeams([])), [e.id]);
  useEffect(() => {
    reload();
  }, [reload]);
  if (!teams.length) return null;

  const SHOWN = 8;
  const found = teams.filter((t) => `${t.name} ${t.leaderName} ${t.school}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <p className={styles.meta} style={{ margin: "18px 0 0" }}>
        Or ask to join a team that has room. Its leader decides.
      </p>
      {teams.length > SHOWN && <Field name={`${e.slug}-find`} label="Find a team" placeholder="Team, leader or school" value={q} onChange={(ev) => setQ(ev.target.value)} />}
      <ul className={styles.members}>
        {found.slice(0, SHOWN).map((t) => (
          <li key={t.id}>
            <span>
              {t.name}
              <span className={styles.meta}>
                {" "}
                · {[t.leaderName, t.school].filter(Boolean).join(", ")} · {t.members} of {e.teamMax}
              </span>
            </span>
            <button
              type="button"
              className={account.link}
              disabled={busy}
              onClick={() => run(() => (t.requested ? api(`/teams/${t.id}/requests/${regId}`, undefined, "DELETE") : api(`/teams/${t.id}/requests`, {})).then(reload))}
            >
              {t.requested ? "Cancel request" : "Ask to join"}
            </button>
          </li>
        ))}
      </ul>
      {found.length > SHOWN && (
        <p className={styles.meta} style={{ margin: "6px 0 0" }}>
          {found.length - SHOWN} more. Type a team, leader or school name to find them.
        </p>
      )}
    </>
  );
}
