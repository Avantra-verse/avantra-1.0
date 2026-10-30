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
import t from "../../staff/tools.module.css";
import { feeReviewing, useDashboard } from "../data";
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
  const { reload: refreshDashboard, student: dash } = useDashboard(); // Home shows registration and team status
  const reviewing = feeReviewing(dash);
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
      <div className={`${t.page} ${t.appPage}`}>
        <header className={t.pageHead}>
          <h1>Teams</h1>
          <p>The Science Exhibition is for teams of 3. Start a team and share its code, or join a friend&apos;s team.</p>
        </header>
        <div className={t.dashGrid}>
        <div>
        {!apiReady ? (
          <OpensSoon what="Teams" />
        ) : failed ? (
          <FormError message={failed} />
        ) : me && (me.role !== "STUDENT" || !me.profileComplete) ? (
          <section className={t.panel}>
            <p className={t.mute} style={{ margin: 0 }}>
              {me.role === "STUDENT" ? (
                <>
                  <Link href="/profile" className={account.link}>Finish your profile</Link> first.
                </>
              ) : (
                "Students form teams from their own account."
              )}
            </p>
          </section>
        ) : !items ? (
          <p className={t.mute} role="status">Loading…</p>
        ) : !feePaid ? (
          <section className={t.panel} aria-labelledby="locked">
            <div className={t.panelHead}>
              <h2 id="locked">Teams open after payment</h2>
              <span className={t.status} data-tone={reviewing ? "warn" : undefined}>{reviewing ? "Under review" : "Locked"}</span>
            </div>
            <p className={t.mute} style={{ margin: "0 0 16px" }}>
              {items.length && reviewing
                ? "Your payment is under review. Teams open as soon as the school confirms it."
                : items.length
                ? "You're registered. Pay the ₹299 fee and you can start or join a team right away."
                : "Register for the Science Exhibition and pay the ₹299 fee, then start or join a team."}
            </p>
            <Link href={items.length ? "/dashboard/pay" : "/dashboard/events?event=exhibition&step=theme"} className={t.btn}>
              {items.length ? (reviewing ? "View payment" : "Pay now") : "Register"}
            </Link>
          </section>
        ) : !items.length ? (
          <section className={t.panel}>
            <p className={t.mute} style={{ margin: 0 }}>
              You haven&apos;t registered for a team event yet. <Link href="/dashboard/events" className={account.link}>See events</Link>
            </p>
          </section>
        ) : (
          <>
            {joinNote && (
              <p className={styles.fee} role="status">
                {joinNote}
              </p>
            )}
            <ul className={styles.list}>
              {items.map(({ event, reg }) => (
                <TeamCard key={reg.id} event={event} reg={reg} onChange={() => Promise.all([load(), refreshDashboard()]).then(() => {})} />
              ))}
            </ul>
          </>
        )}
        </div>
        <aside>
          <section className={t.panel} aria-labelledby="how">
            <h2 id="how">How teams work</h2>
            <ul className={t.mute} style={{ margin: 0, paddingLeft: "1.2em", listStyle: "disc", display: "grid", gap: 8 }}>
              <li>Every team has exactly 3 students. Anyone who has paid can start one and becomes its leader.</li>
              <li>Friends join with your 6-letter code, your invite link or the team&apos;s QR.</li>
              <li>You can also ask up to 5 open teams to let you in. The leader accepts or declines, and once one accepts, your other requests are cancelled.</li>
              <li>If the leader leaves, the longest-standing member takes over. A team can&apos;t change once the judges have scored it.</li>
            </ul>
          </section>
        </aside>
        </div>
      </div>
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
    <li className={t.panel}>
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
  const full = n >= e.teamMax;
  return (
    <>
      <div className={styles.teamTop}>
        <h4 className={styles.teamName}>{team.name}</h4>
        <span className={t.status} data-tone={full ? "ok" : "warn"}>
          {full ? "Team complete" : `Needs ${e.teamMax - n} more`}
        </span>
      </div>
      <dl className={t.facts} style={{ margin: "12px 0 0" }}>
        {team.projectTitle && (
          <div>
            <dt>Project</dt>
            <dd>{team.projectTitle}</dd>
          </div>
        )}
        {team.topic && (
          <div>
            <dt>Theme</dt>
            <dd>{team.topic}</dd>
          </div>
        )}
        <div>
          <dt>You</dt>
          <dd>{leader ? "Team leader" : "Member"}</dd>
        </div>
      </dl>

      {full && (
        <div className={`${t.result} ${t.ok}`} style={{ marginTop: 16 }}>
          <strong>You&apos;re all set.</strong> Build your project together and bring it to AVANTRA on 19–20 December. The judging
          criteria are shared on event day.
        </div>
      )}

      <h5 className={styles.sub}>
        Members · {n} of {e.teamMax}
      </h5>
      <ul className={styles.openList}>
        {team.members.map((m) => (
          <li key={m.registrationId} className={styles.openRow}>
            <span className={styles.openAvatar} aria-hidden>
              {m.registration.student.user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className={styles.openText}>
              <strong>
                {m.registration.student.user.name}
                {m.isLeader && <span className={styles.leaderTag}>Leader</span>}
              </strong>
              <span className={styles.meta}>{m.registration.student.avantraId}</span>
            </span>
            {leader && !m.isLeader && (
              <button
                type="button"
                className={account.link}
                disabled={busy}
                onClick={() => confirm(`Remove ${m.registration.student.user.name} from the team?`) && run(() => api(`/teams/${team.id}/members/${m.registrationId}`, undefined, "DELETE"))}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: e.teamMax - n }, (_, i) => (
          <li key={`empty-${i}`} className={`${styles.openRow} ${styles.emptySeat}`}>
            <span className={styles.openAvatar} aria-hidden>
              +
            </span>
            <span className={styles.meta}>Open spot. Invite a friend below.</span>
          </li>
        ))}
      </ul>

      {leader && !full && team.joinRequests.length > 0 && (
        <>
          <h5 className={styles.sub}>Asking to join · {team.joinRequests.length}</h5>
          <ul className={styles.openList}>
            {team.joinRequests.map((r) => (
              <li key={r.registrationId} className={styles.openRow} data-requested>
                <span className={styles.openAvatar} aria-hidden>
                  {r.registration.student.user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className={styles.openText}>
                  <strong>{r.registration.student.user.name}</strong>
                  <span className={styles.meta}>{r.registration.student.avantraId}</span>
                </span>
                <span className={styles.actions} style={{ margin: 0 }}>
                  <button type="button" className={styles.btn} disabled={busy} onClick={() => run(() => api(`/teams/${team.id}/requests/${r.registrationId}/accept`, {}))}>
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

      {!full && (
        <div className={styles.invite}>
          <div>
            <h5 className={styles.sub} style={{ marginTop: 0 }}>
              Invite friends
            </h5>
            <p className={styles.meta} style={{ margin: "0 0 10px" }}>
              Friends who have paid can join with this code, the link or the QR.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              <span className={styles.code}>{team.inviteCode}</span>
              {leader && (
                <>
                  {" · "}
                  <button type="button" className={account.link} disabled={busy} onClick={() => run(() => api(`/teams/${team.id}/invite-code`, {}))}>
                    New code
                  </button>
                </>
              )}
            </p>
            <button type="button" className={styles.btn} onClick={share}>
              Share invite link
            </button>
            {shared && (
              <span className={styles.meta} role="status" style={{ display: "block", marginTop: 6, overflowWrap: "anywhere" }}>
                {shared}
              </span>
            )}
          </div>
          {qr && <img src={qr} alt={`QR code to join team ${team.name}`} width={150} height={150} className={styles.inviteQr} />}
        </div>
      )}

      <div className={styles.actions} style={{ marginTop: 18 }}>
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
          <form className={styles.codeRow} onSubmit={join} noValidate>
            <Field name={id("code")} label="Have an invite code?" placeholder="e.g. K7Q2XM" maxLength={6} autoCapitalize="characters" value={f.code} onChange={set("code")} error={errors.code} />
            <button type="submit" className={styles.btn} disabled={busy}>
              Join
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
    <section className={styles.openTeams} aria-labelledby={`${e.slug}-open`}>
      <div className={styles.openHead}>
        <h4 id={`${e.slug}-open`} className={styles.sub}>
          Teams with room
        </h4>
        {teams.length > 0 && <span className={styles.meta}>{teams.length} open</span>}
      </div>
      <p className={styles.meta} style={{ margin: "0 0 10px" }}>
        {teams.length ? "Ask to join one. Its leader accepts or declines." : "No teams with room yet. Check back soon, or start your own."}
      </p>
      {teams.length > SHOWN && <Field name={`${e.slug}-find`} label="Find a team" placeholder="Team, leader or school" value={q} onChange={(ev) => setQ(ev.target.value)} />}
      <ul className={styles.openList}>
        {found.slice(0, SHOWN).map((t) => (
          <li key={t.id} className={styles.openRow} data-requested={t.requested || undefined}>
            <span className={styles.openAvatar} aria-hidden>
              {t.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className={styles.openText}>
              <strong>{t.name}</strong>
              <span className={styles.meta}>{[t.leaderName && `Led by ${t.leaderName}`, t.school].filter(Boolean).join(" · ")}</span>
              {t.requested && <span className={styles.waiting}>Request sent. Waiting for the leader.</span>}
            </span>
            <span className={styles.seats} aria-label={`${t.members} of ${e.teamMax} members`}>
              {Array.from({ length: e.teamMax }, (_, i) => (
                <span key={i} data-on={i < t.members || undefined} />
              ))}
            </span>
            <button
              type="button"
              className={t.requested ? styles.ghostBtn : styles.btn}
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
    </section>
  );
}
