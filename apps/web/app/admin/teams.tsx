"use client";

// Teams tab: every team in every event, with each member's class, school and fee status. Read-only;
// places are set in Events.
import React, { useState } from "react";
import { Field, FormError } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import x from "./people.module.css";
import s from "./teams.module.css";
import { joined, when } from "./people";
import { useLoad } from "./ui";

type Member = { name: string; avantraId: string; grade: number; section: string | null; school: string; isLeader: boolean; paid: boolean };
type Team = {
  id: string;
  name: string;
  eventId: string;
  event: string;
  projectTitle: string | null;
  topic: string | null;
  rank: number | null;
  createdAt: string;
  members: Member[];
};

const PLACE: Record<number, string> = { 1: "1st place", 2: "2nd place", 3: "3rd place" };

const SHOW: Record<string, [string, (x: Team) => boolean]> = {
  all: ["All", () => true],
  unpaid: ["Someone not paid", (x) => x.members.some((p) => !p.paid)],
  placed: ["Placed", (x) => !!x.rank],
};

export function Teams() {
  const list = useLoad<Team[]>("/admin/teams");
  const [eventId, setEventId] = useState("");
  const [show, setShow] = useState("all");
  const [q, setQ] = useState("");

  const all = list.data ?? [];
  const events = [...new Map(all.map((x) => [x.eventId, x.event])).entries()];
  const needle = q.trim().toLowerCase();
  // Chip counts follow the other filters, so they match what a tap shows.
  const searched = all.filter(
    (x) => !needle || [x.name, x.projectTitle, x.topic, ...x.members.flatMap((p) => [p.name, p.avantraId, p.school])].some((v) => v?.toLowerCase().includes(needle)),
  );
  const inEvent = searched.filter((x) => !eventId || x.eventId === eventId);
  const rows = inEvent.filter(SHOW[show][1]);
  const students = rows.reduce((n, x) => n + x.members.length, 0);

  return (
    <section className={t.panel} aria-labelledby="teams">
      <div className={t.panelHead}>
        <h2 id="teams">All teams</h2>
        <button type="button" className={t.ghost} onClick={list.reload}>Refresh</button>
      </div>
      <Field name="teamSearch" label="Search team, project, member, AVANTRA ID or school" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      {events.length > 1 && (
        <div className={x.chips} role="group" aria-label="Event">
          {[["", "All events"], ...events].map(([id, name]) => (
            <button key={id} type="button" className={x.chip} aria-pressed={eventId === id} onClick={() => setEventId(id)}>
              {name} <span className={x.count}>{searched.filter((x) => !id || x.eventId === id).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className={x.chips} role="group" aria-label="Show">
        {Object.entries(SHOW).map(([k, [label, test]]) => (
          <button key={k} type="button" className={x.chip} aria-pressed={show === k} onClick={() => setShow(k)}>
            {label} <span className={x.count}>{inEvent.filter(test).length}</span>
          </button>
        ))}
      </div>
      <FormError message={list.error} />
      {!list.data ? (
        !list.error && <p className={t.mute} role="status">Loading teams…</p>
      ) : rows.length === 0 ? (
        <div className={x.empty}>
          <strong>{all.length ? "Nothing here" : "No teams yet"}</strong>
          {all.length ? "Try another event, filter or search." : "Teams show up here once students create them."}
        </div>
      ) : (
        <>
          <p className={t.mute}>
            {rows.length} {rows.length === 1 ? "team" : "teams"} · {students} {students === 1 ? "student" : "students"}
          </p>
          <ul className={s.grid}>
            {rows.map((team) => (
              <li key={team.id} className={s.card}>
                <div className={s.head}>
                  <div className={s.title}>
                    <h3>{team.name}</h3>
                    <p>
                      {team.event}
                      {team.topic && ` · ${team.topic}`}
                    </p>
                  </div>
                  {team.rank && <span className={s.place}>{PLACE[team.rank]}</span>}
                </div>
                {team.projectTitle && <p className={s.project}>{team.projectTitle}</p>}
                <ol className={s.members}>
                  {team.members.map((p) => (
                    <li key={p.avantraId} className={s.member}>
                      <span className={s.who}>
                        <span className={s.name}>
                          {p.name}
                          {p.isLeader && <span className={s.lead}>Leader</span>}
                        </span>
                        <span className={s.meta}>
                          {p.avantraId} · Class {p.grade}
                          {p.section && ` ${p.section}`} · {p.school}
                        </span>
                      </span>
                      <span className={t.status} data-tone={p.paid ? "ok" : "warn"}>{p.paid ? "Paid" : "Not paid"}</span>
                    </li>
                  ))}
                </ol>
                <p className={s.foot}>
                  {team.members.length} {team.members.length === 1 ? "member" : "members"} ·{" "}
                  <span title={when(team.createdAt)}>made {joined(team.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
