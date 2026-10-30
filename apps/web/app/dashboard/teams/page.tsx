"use client";

// The student's teams, one per team event they registered for. Opens once the ₹299 fee is paid.
// Create a team, or join one by 6-letter invite code, by scanning the team's QR, or by asking a team
// that has room and waiting for its leader.
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { EXHIBITION_TOPICS, InviteCode } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, SelectField, styles as account } from "@/components/account/Account";
import styles from "../events/events.module.css";
import { useTabs } from "../../admin/ui";

type Event = { id: string; slug: string; name: string; category: string; teamMin: number; teamMax: number };
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
type Reg = { id: string; eventId: string; topic: string | null; teamMember: { isLeader: boolean; team: Team } | null };

export default function TeamsPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [items, setItems] = useState<{ event: Event; reg: Reg }[] | null>(null);
  const [feePaid, setFeePaid] = useState(false);
  const [failed, setFailed] = useState("");
  const [joinNote, setJoinNote] = useState("");

  const load = useCallback(async () => {
    const m = await getMe();
    setMe(m);
    if (m?.role !== "STUDENT" || !m.profileComplete) return;
    const [ev, p, r] = await Promise.all([
      api<Event[]>("/events"),
      api<{ student: { feePaidAt: string | null } | null }>("/profile"),
      api<Reg[]>("/registrations/mine"),
    ]);
    const paid = !!p.student?.feePaidAt;
    // A scanned team QR opens /dashboard/teams?join=CODE; joining waits until the fee is paid.
    const code = InviteCode.safeParse(new URLSearchParams(window.location.search).get("join"));
    if (code.success && paid) {
      window.history.replaceState(null, "", "/dashboard/teams");
      await api("/teams/join", { inviteCode: code.data }).then(
        () => setJoinNote("You joined the team."),
        (e: ApiError) => setJoinNote(e.message),
      );
      return load();
    }
    setFeePaid(paid);
    setItems(r.flatMap((reg) => ev.filter((e) => e.id === reg.eventId && e.teamMax > 1).map((event) => ({ event, reg }))));
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    load().catch((e: ApiError) => setFailed(e.message));
  }, [load]);

  // Logged out (e.g. after scanning a team QR): log in first, then come back here with the code.
  useEffect(() => {
    if (me === null) window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [me]);

  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <main className={account.wrapper}>
        <div className={styles.page}>
          <div className={account.card}>
            <h1 className={account.heading}>Teams</h1>
            {!apiReady ? (
              <OpensSoon what="Teams" />
            ) : failed ? (
              <FormError message={failed} />
            ) : me && (me.role !== "STUDENT" || !me.profileComplete) ? (
              <p className={account.subtext}>
                {me.role === "STUDENT" ? (
                  <>
                    <Link href="/profile" className={account.link}>Finish your profile</Link> first.
                  </>
                ) : (
                  "Students form teams from their own account."
                )}
              </p>
            ) : !items ? (
              <p className={account.subtext} role="status">Loading…</p>
            ) : !feePaid ? (
              <p className={account.subtext}>
                Teams open once your ₹299 fee is paid.{" "}
                <Link href={items.length ? "/dashboard/pay" : "/dashboard/events?event=exhibition&step=theme"} className={account.link}>
                  {items.length ? "Pay now" : "Register for the Science Exhibition"}
                </Link>
              </p>
            ) : !items.length ? (
              <p className={account.subtext}>
                You haven&apos;t registered for a team event yet. <Link href="/dashboard/events" className={account.link}>See events</Link>
              </p>
            ) : (
              <>
                {joinNote && (
                  <p className={styles.fee} role="status">
                    {joinNote}
                  </p>
                )}
                <ul className={styles.list}>
                  {items.map(({ event, reg }) => (
                    <TeamCard key={reg.id} event={event} reg={reg} onChange={load} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TeamCard({ event: e, reg, onChange }: { event: Event; reg: Reg; onChange: () => Promise<void> }) {
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
  const team = reg.teamMember?.team;
  return (
    <li className={styles.event} data-registered>
      <div className={styles.eventHead}>
        <h3 className={styles.eventName}>{e.name}</h3>
        <span className={styles.meta}>{e.teamMin === e.teamMax ? `Teams of ${e.teamMax}` : `Teams of ${e.teamMin}–${e.teamMax}`}</span>
      </div>
      <div className={styles.team}>
        {team ? <TeamView event={e} team={team} leader={reg.teamMember!.isLeader} busy={busy} run={run} /> : <TeamForms event={e} regId={reg.id} topic={reg.topic} busy={busy} run={run} />}
      </div>
      <FormError message={error} />
    </li>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;
const TEAM_TABS = { create: "Create team", join: "Join team" } as const;

function TeamView({ event: e, team, leader, busy, run }: { event: Event; team: Team; leader: boolean; busy: boolean; run: Run }) {
  const n = team.members.length;
  const [qr, setQr] = useState("");
  const [shared, setShared] = useState("");
  const link = () => `${window.location.origin}/dashboard/teams?join=${team.inviteCode}`; // logged-out friends log in, then come back here
  useEffect(() => {
    QRCode.toDataURL(link(), { width: 320, margin: 2 }).then(setQr);
  }, [team.inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phones open the share sheet (WhatsApp etc.); elsewhere the link is copied.
  async function share() {
    const text = `Join my team "${team.name}" for the ${e.name} at AVANTRA 2026. Invite code: ${team.inviteCode}`;
    if (navigator.share) {
      try {
        return await navigator.share({ title: "Join my AVANTRA team", text, url: link() });
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // they closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link()}`);
      setShared("Link copied. Paste it to your friends.");
    } catch {
      setShared(`Copy this link: ${link()}`);
    }
  }
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
      {n < e.teamMax && (
        <p style={{ margin: "10px 0 0" }}>
          <button type="button" className={styles.btn} onClick={share}>
            Share invite link
          </button>
          {shared && <span className={styles.meta} role="status" style={{ display: "block", marginTop: 6, overflowWrap: "anywhere" }}>{shared}</span>}
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

function TeamForms({ event: e, regId, topic, busy, run }: { event: Event; regId: string; topic: string | null; busy: boolean; run: Run }) {
  const exhibition = e.category === "EXHIBITION";
  const [f, setF] = useState({ name: "", projectTitle: "", topic: topic ?? "", code: "" }); // exhibition: the leader's theme
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

  const { tab, bar } = useTabs(TEAM_TABS, "create");
  return (
    <>
      <p className={styles.meta} style={{ margin: "0 0 12px" }}>
        You&apos;re not in a team yet. Start one and share its code, or join a friend&apos;s team.
      </p>
      {bar}
      {tab === "create" && (
        <form className={`${account.form} ${styles.teamForm}`} onSubmit={create} noValidate>
          <Field name={id("name")} label="Team name" maxLength={60} value={f.name} onChange={set("name")} error={errors.name} />
          {exhibition && (
            <>
              <Field name={id("projectTitle")} label="Project title" maxLength={150} value={f.projectTitle} onChange={set("projectTitle")} error={errors.projectTitle} />
              {!topic && <SelectField name={id("topic")} label="Topic" value={f.topic} onChange={set("topic")} error={errors.topic}>
                <option value="">Select a topic</option>
                {EXHIBITION_TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectField>}
            </>
          )}
          <button type="submit" className={styles.btn} disabled={busy}>
            Start a team
          </button>
        </form>
      )}
      {tab === "join" && (
        <>
          <form className={`${account.form} ${styles.teamForm}`} onSubmit={join} noValidate>
            <Field name={id("code")} label="Have an invite code?" placeholder="e.g. K7Q2XM" maxLength={6} autoCapitalize="characters" value={f.code} onChange={set("code")} error={errors.code} />
            <button type="submit" className={styles.btn} disabled={busy}>
              Join with code
            </button>
          </form>
          <OpenTeams event={e} regId={regId} busy={busy} run={run} />
        </>
      )}
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
  const SHOWN = 8;
  const found = teams.filter((t) => `${t.name} ${t.leaderName} ${t.school}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <h4 className={styles.sub}>Teams with room</h4>
      <p className={styles.meta} style={{ margin: 0 }}>
        {teams.length ? "Ask to join one. Its leader accepts or declines." : "No teams with room yet. Check back soon, or start your own."}
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
              style={{ whiteSpace: "nowrap", alignSelf: "flex-start" }}
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
