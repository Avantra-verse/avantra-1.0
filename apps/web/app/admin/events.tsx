"use client";

// Events: open/close registration, judging results, winners and certificates.
import React, { useState } from "react";
import { api } from "@/lib/api";
import { FormError } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, useAction, useLoad } from "./ui";

type EventRow = { id: string; name: string; category: string; registrationOpen: boolean; capacity: number | null; spotsLeft: number | null; teamMax: number };
type Board = {
  event: { id: string; name: string; judgingCriteria: string[]; maxScore: number };
  teams: { teamId: string; name: string; projectTitle: string | null; members: { name: string; avantraId: string }[]; judges: number; rank: number | null; score: number | null }[];
};

const PLACE = ["", "1st", "2nd", "3rd"];

export function Events() {
  const events = useLoad<EventRow[]>("/events");
  const [eventId, setEventId] = useState("");
  const act = useAction();

  const toggle = (e: EventRow) =>
    act.run(() => api(`/admin/events/${e.id}`, { registrationOpen: !e.registrationOpen }, "PATCH"), () => `${e.name}: registration ${e.registrationOpen ? "closed" : "open"}.`).then(events.reload);

  return (
    <>
      <section className={t.panel} aria-labelledby="event-list">
        <h2 id="event-list">Events</h2>
        <FormError message={act.error || events.error} />
        {act.note && <p role="status">{act.note}</p>}
        <div className={t.scroll}>
          <table className={t.table}>
            <thead>
              <tr>
                <th>Event</th>
                <th>Registration</th>
                <th className={t.num}>Spots left</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.data?.map((e) => (
                <tr key={e.id} data-id={e.id}>
                  <td>
                    {e.name}
                    <div className={t.mute}>{e.category.toLowerCase()}</div>
                  </td>
                  <td>
                    <span className={`${t.pill} ${e.registrationOpen ? t.on : t.off}`}>{e.registrationOpen ? "open" : "closed"}</span>
                  </td>
                  <td className={t.num}>{e.spotsLeft ?? "no limit"}</td>
                  <td className={t.num}>
                    <div className={t.inline} style={{ justifyContent: "flex-end" }}>
                      <button type="button" className={t.ghost} disabled={act.busy} onClick={() => toggle(e)}>
                        {e.registrationOpen ? "Close registration" : "Open registration"}
                      </button>
                      <button type="button" className={t.btn} onClick={() => setEventId(e.id)} aria-pressed={eventId === e.id}>
                        Results
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {eventId && <Results key={eventId} eventId={eventId} />}
    </>
  );
}

function Results({ eventId }: { eventId: string }) {
  const board = useLoad<Board>(`/admin/events/${eventId}/leaderboard`);
  const act = useAction();
  const b = board.data;

  const setRank = (teamId: string, rank: number | null) => act.run(() => api(`/admin/teams/${teamId}/rank`, { rank })).then(board.reload);
  const issue = () =>
    act.run(
      () => api<{ issuedNow: number; issued: number; notCheckedIn: number }>(`/admin/events/${eventId}/certificates`, {}),
      (r) => `${r.issuedNow} new certificates (${r.issued} in all). ${r.notCheckedIn} registered students never checked in and get none.`,
    );

  if (!b) return <FormError message={board.error} />;
  return (
    <section className={t.panel} aria-labelledby="results">
      <div className={t.head}>
        <h2 id="results">{b.event.name}: results</h2>
        <div className={t.inline}>
          <button type="button" className={t.ghost} onClick={board.reload}>Refresh</button>
          <a className={t.ghost} href={fileUrl(`/admin/export/registrations.csv?eventId=${eventId}`)}>CSV</a>
          <button type="button" className={t.btn} disabled={act.busy} onClick={() => confirm("Issue certificates to everyone in this event who checked in? Set the winners first.") && issue()}>
            Issue certificates
          </button>
        </div>
      </div>
      <p className={t.mute}>
        Score = the average of each judge&apos;s total, out of {b.event.maxScore} ({b.event.judgingCriteria.join(", ")}).
      </p>
      <FormError message={act.error} />
      {act.note && <p role="status">{act.note}</p>}
      {b.teams.length === 0 ? (
        <p className={t.mute}>No teams yet.</p>
      ) : (
        <div className={t.scroll}>
          <table className={t.table}>
            <thead>
              <tr>
                <th>Team</th>
                <th className={t.num}>Judges</th>
                <th className={t.num}>Score</th>
                <th>Place</th>
              </tr>
            </thead>
            <tbody>
              {b.teams.map((x) => (
                <tr key={x.teamId}>
                  <td>
                    {x.name}
                    {x.projectTitle && <div>{x.projectTitle}</div>}
                    <div className={t.mute}>{x.members.map((m) => m.name).join(", ")}</div>
                  </td>
                  <td className={t.num}>{x.judges}</td>
                  <td className={t.num}>{x.score ?? <span className={t.mute}>not judged</span>}</td>
                  <td>
                    <select className={t.select} value={x.rank ?? ""} disabled={act.busy} onChange={(e) => setRank(x.teamId, e.target.value ? Number(e.target.value) : null)} aria-label={`Place for ${x.name}`}>
                      <option value="">–</option>
                      {[1, 2, 3].map((r) => (
                        <option key={r} value={r}>{PLACE[r]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
