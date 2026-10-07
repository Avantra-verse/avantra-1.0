"use client";

// Every event, open to anyone. Students with a profile register here, pay the ₹199 exhibition
// fee, and create or join teams (share a 6-letter invite code). Solo events need no team.
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EXHIBITION_TOPICS, InviteCode } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, payExhibitionFee, type Me } from "@/lib/api";
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
};
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

  const load = useCallback(async () => {
    const [ev, m] = await Promise.all([api<Event[]>("/events"), getMe()]);
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
            <p className={account.subtext}>Entry and every event are free. Only the Science Exhibition has a ₹199 fee, paid once.</p>
            {!apiReady ? (
              <OpensSoon what="Event registration" />
            ) : failed ? (
              <FormError message={failed} />
            ) : !events ? (
              <p className={account.subtext} role="status">Loading…</p>
            ) : (
              <>
                {student ? (
                  <FeeBox me={student} paid={feePaid} onPaid={load} />
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

function FeeBox({ me, paid, onPaid }: { me: Me; paid: boolean; onPaid: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      if (await payExhibitionFee(me)) await onPaid();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.fee}>
      <span>
        Science Exhibition fee: <strong>{paid ? "Paid ✓" : "₹199, not paid yet"}</strong>
      </span>
      {!paid && (
        <button type="button" className={styles.btn} onClick={pay} disabled={busy}>
          {busy ? "Opening…" : "Pay ₹199"}
        </button>
      )}
      <FormError message={error} />
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
            <span className={styles.meta}>Pay the ₹199 fee above, then register here.</span>
          ) : (
            <button type="button" className={styles.btn} onClick={() => run(() => api("/registrations", { eventId: e.id }))} disabled={busy}>
              {busy ? "Registering…" : "Register"}
            </button>
          )}
        </div>
      )}

      {reg && e.teamMax > 1 && (
        <div className={styles.team}>
          {team ? <TeamView event={e} team={team} leader={reg.teamMember!.isLeader} busy={busy} run={run} /> : <TeamForms event={e} busy={busy} run={run} />}
        </div>
      )}
      <FormError message={error} />
    </li>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;

function TeamView({ event: e, team, leader, busy, run }: { event: Event; team: Team; leader: boolean; busy: boolean; run: Run }) {
  const n = team.members.length;
  return (
    <>
      <p style={{ margin: 0 }}>
        Team <strong>{team.name}</strong>
        {team.projectTitle && ` · ${team.projectTitle}`}
        {team.topic && <span className={styles.meta}> ({team.topic})</span>}
      </p>
      <p className={styles.meta} style={{ margin: "4px 0 0" }}>
        {n < e.teamMin ? `Needs at least ${e.teamMin} members (${n} so far).` : `${n} of ${e.teamMax} members.`}
        {n < e.teamMax && " Share the invite code so friends can join."}
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

function TeamForms({ event: e, busy, run }: { event: Event; busy: boolean; run: Run }) {
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
        You&apos;re not in a team yet. Start one and share its code, or join a friend&apos;s team with theirs.
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
    </>
  );
}
