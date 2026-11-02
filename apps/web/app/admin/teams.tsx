"use client";

// Teams tab: every team in every event, with each member's class, school and fee status. Read-only;
// places are set in Results.
import React, { useState } from "react";
import { Field, FormError, SelectField } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import x from "./people.module.css";
import m from "./messages.module.css";
import { Avatar, joined, when } from "./people";
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

export function Teams() {
  const list = useLoad<Team[]>("/admin/teams");
  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");

  const all = list.data ?? [];
  const events = [...new Map(all.map((x) => [x.eventId, x.event])).entries()];
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (x) =>
      (!eventId || x.eventId === eventId) &&
      (!needle ||
        [x.name, x.projectTitle, x.topic, ...x.members.flatMap((p) => [p.name, p.avantraId, p.school])].some((s) => s?.toLowerCase().includes(needle))),
  );

  return (
    <section className={t.panel} aria-labelledby="teams">
      <div className={t.panelHead}>
        <h2 id="teams">All teams</h2>
        <button type="button" className={t.ghost} onClick={list.reload}>Refresh</button>
      </div>
      <div className={x.filters}>
        <SelectField name="teamEvent" label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">All events</option>
          {events.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </SelectField>
        <Field name="teamSearch" label="Search team, project, member, AVANTRA ID or school" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <FormError message={list.error} />
      {!list.data ? (
        !list.error && <p className={t.mute} role="status">Loading teams…</p>
      ) : rows.length === 0 ? (
        <div className={x.empty}>
          <strong>{all.length ? "Nothing here" : "No teams yet"}</strong>
          {all.length ? "Try another event or search." : "Teams show up here once students create them."}
        </div>
      ) : (
        <>
          <p className={t.mute}>{rows.length} {rows.length === 1 ? "team" : "teams"}, {rows.reduce((n, x) => n + x.members.length, 0)} students</p>
          <ul className={x.roster}>
            {rows.map((team) => (
              <li key={team.id} className={m.item}>
                <div className={m.top}>
                  <Avatar name={team.name} tone={team.rank ? "gold" : "green"} />
                  <span className={x.who}>
                    <span className={x.name}>{team.name}</span>
                    <span className={x.sub}>
                      {team.event}
                      {team.topic && ` · ${team.topic}`}
                      {team.projectTitle && ` · ${team.projectTitle}`}
                    </span>
                  </span>
                  <span className={x.end}>
                    {team.rank && <span className={t.status} data-tone="ok">{PLACE[team.rank]}</span>}
                    <span className={x.when} title={when(team.createdAt)}>{joined(team.createdAt)}</span>
                  </span>
                </div>
                <ul className={m.body} style={{ listStyle: "none" }}>
                  {team.members.map((p) => (
                    <li key={p.avantraId}>
                      <strong>{p.name}</strong>
                      {p.isLeader && " (leader)"} · {p.avantraId} · Class {p.grade}
                      {p.section && ` ${p.section}`} · {p.school} ·{" "}
                      <span className={t.status} data-tone={p.paid ? "ok" : "warn"}>{p.paid ? "Paid" : "Not paid"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
