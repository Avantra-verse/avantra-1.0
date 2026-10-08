"use client";

// Engagement Wall: open/close and freeze, add challenges from the spreadsheet, print chits, fix problems.
import React, { useState } from "react";
import { AvantraId } from "@avantra/shared";
import { api, ApiError } from "@/lib/api";
import { FormError } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, useAction, useLoad } from "./ui";

type Challenge = {
  id: string;
  code: string;
  number: number;
  category: string;
  difficulty: number;
  points: number;
  question: string;
  options: string[];
  answers: string[];
  active: boolean;
  _count: { solves: number; attempts: number };
};
type WallAdmin = { open: boolean; frozenAt: string | null; challenges: Challenge[] };

export function Wall() {
  const wall = useLoad<WallAdmin>("/admin/wall");
  const act = useAction();
  const w = wall.data;

  const state = (body: { open?: boolean; frozen?: boolean }, msg: string) => act.run(() => api("/admin/wall/state", body, "PUT"), () => msg).then(wall.reload);

  if (!w) return <FormError message={wall.error} />;
  return (
    <>
      <section className={t.panel} aria-labelledby="wall-state">
        <h2 id="wall-state">Wall status</h2>
        <p>
          <span className={`${t.pill} ${w.open ? t.on : t.off}`}>{w.open ? "open: students can play" : "closed"}</span>{" "}
          {w.frozenAt && (
            <span className={`${t.pill} ${t.off}`}>
              board frozen since {new Date(w.frozenAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </p>
        <div className={t.inline}>
          <button type="button" className={t.btn} disabled={act.busy} onClick={() => state({ open: !w.open }, w.open ? "Wall closed." : "Wall open.")}>
            {w.open ? "Close the Wall" : "Open the Wall"}
          </button>
          {w.frozenAt ? (
            <button type="button" className={t.ghost} disabled={act.busy} onClick={() => confirm("Unfreeze and reveal the final standings on the public board?") && state({ frozen: false }, "Board unfrozen: final standings are showing.")}>
              Unfreeze (reveal results)
            </button>
          ) : (
            <button type="button" className={t.ghost} disabled={act.busy} onClick={() => confirm("Freeze the public board now? Play and points go on, but ranks stop moving until you unfreeze.") && state({ frozen: true }, "Board frozen.")}>
              Freeze the board
            </button>
          )}
          <a className={t.ghost} href="/wall/leaderboard" target="_blank" rel="noreferrer">Big-screen board ↗</a>
        </div>
        <FormError message={act.error} />
        {act.note && <p role="status">{act.note}</p>}
      </section>

      <Import onDone={wall.reload} />

      <section className={t.panel} aria-labelledby="chits">
        <h2 id="chits">Challenges ({w.challenges.length})</h2>
        <Print />
        {w.challenges.length === 0 ? (
          <p className={t.mute}>None yet. Fill in the spreadsheet above and upload it.</p>
        ) : (
          <div className={t.scroll}>
            <table className={t.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Challenge</th>
                  <th>Answers</th>
                  <th className={t.num}>Solved</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {w.challenges.map((c) => (
                  <Row key={c.id} c={c} onChange={wall.reload} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Import({ onDone }: { onDone: () => void }) {
  const act = useAction();
  const [rows, setRows] = useState<string[]>([]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again after fixing it
    if (!file) return;
    setRows([]);
    const made = await act.run(
      () =>
        file.text().then((csv) =>
          api<unknown[]>("/admin/wall/import", { csv }).catch((err: ApiError) => {
            const errors = err.body?.errors;
            if (Array.isArray(errors)) setRows(errors as string[]);
            throw err;
          }),
        ),
      (m) => `${m.length} challenges added. Print their chits below.`,
    );
    if (made) onDone();
  }

  return (
    <section className={t.panel} aria-labelledby="import">
      <h2 id="import">Add challenges</h2>
      <p className={t.mute}>
        Fill in the spreadsheet (one row per chit), save it as CSV and upload it. If any row has a problem nothing is added, and every problem is listed by row.
      </p>
      <div className={t.inline}>
        <a className={t.ghost} href={fileUrl("/admin/wall/template.csv")}>Download the spreadsheet</a>
        <label className={t.btn}>
          Upload filled CSV
          <input type="file" accept=".csv,text/csv" onChange={upload} hidden />
        </label>
      </div>
      <FormError message={act.error} />
      {rows.length > 0 && (
        <ul className={t.mute}>
          {rows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {act.note && <p role="status">{act.note}</p>}
    </section>
  );
}

function Print() {
  const [numbers, setNumbers] = useState("");
  const only = numbers.split(/[\s,]+/).filter((n) => /^\d+$/.test(n)).join(",");
  return (
    <div className={t.inline} style={{ marginBottom: 16 }}>
      <a className={t.btn} href={fileUrl("/admin/wall/chits.pdf")}>Print all chits (PDF)</a>
      <input className={t.small} placeholder="e.g. 4, 9, 12" value={numbers} onChange={(e) => setNumbers(e.target.value)} aria-label="Challenge numbers to reprint" />
      <a className={t.ghost} href={only ? fileUrl(`/admin/wall/chits.pdf?numbers=${only}`) : undefined} aria-disabled={!only}>
        Reprint these
      </a>
      <a className={t.ghost} href={fileUrl("/admin/export/wall-chits.csv")}>Chits as CSV</a>
    </div>
  );
}

function Row({ c, onChange }: { c: Challenge; onChange: () => void }) {
  const act = useAction();

  const editAnswers = () => {
    const next = prompt("Accepted answers, separated by |", c.answers.join(" | "));
    if (next === null) return;
    const answers = next.split("|").map((a) => a.trim()).filter(Boolean);
    act.run(
      () => api<{ regraded: number }>(`/admin/wall/challenges/${c.id}`, { answers }, "PATCH"),
      (r) => (r.regraded ? `Saved. ${r.regraded} earlier tries now count as correct.` : "Saved."),
    ).then(onChange);
  };
  const withdraw = () =>
    (c.active || confirm(`Put chit #${c.number} back in play?`)) &&
    (!c.active || confirm(`Withdraw chit #${c.number}? Its code stops working; points already earned stay.`)) &&
    act.run(() => api(`/admin/wall/challenges/${c.id}`, { active: !c.active }, "PATCH")).then(onChange);
  const newCode = () =>
    confirm(`New code for #${c.number}? The printed chit stops working; reprint it.`) &&
    act.run(() => api<{ code: string }>(`/admin/wall/challenges/${c.id}/new-code`, {}), (r) => `New code ${r.code}. Reprint #${c.number}.`).then(onChange);
  const reset = () => {
    const raw = prompt(`Reset one student's tries and points on #${c.number}. Their AVANTRA ID:`);
    if (!raw) return;
    const id = AvantraId.safeParse(raw);
    if (!id.success) return act.setError("That isn't an AVANTRA ID.");
    act.run(() => api(`/admin/wall/challenges/${c.id}/students/${id.data}`, undefined, "DELETE"), () => `${id.data} can try #${c.number} again.`).then(onChange);
  };

  return (
    <tr style={c.active ? undefined : { opacity: 0.55 }}>
      <td>{c.number}</td>
      <td className={t.mono}>{c.code}</td>
      <td>
        {c.question}
        <div className={t.mute}>
          {c.category} · level {c.difficulty} · {c.points} pts{c.options.length ? ` · choices: ${c.options.join(" / ")}` : ""}
          {!c.active && " · withdrawn"}
        </div>
        <FormError message={act.error} />
        {act.note && <div className={t.mute} role="status">{act.note}</div>}
      </td>
      <td>{c.answers.join(" | ")}</td>
      <td className={t.num}>
        {c._count.solves}
        <div className={t.mute}>{c._count.attempts} tries</div>
      </td>
      <td>
        <div className={t.inline} style={{ justifyContent: "flex-end", minWidth: 230 }}>
          <button type="button" className={t.ghost} disabled={act.busy} onClick={editAnswers}>Answers</button>
          <button type="button" className={t.ghost} disabled={act.busy} onClick={newCode}>New code</button>
          <button type="button" className={t.ghost} disabled={act.busy} onClick={reset}>Reset a student</button>
          <button type="button" className={t.ghost} disabled={act.busy} onClick={withdraw}>{c.active ? "Withdraw" : "Restore"}</button>
        </div>
      </td>
    </tr>
  );
}
