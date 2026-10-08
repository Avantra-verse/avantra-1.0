"use client";

// Public leaderboard for the big screen at the venue (and anyone's phone). Refreshes every 10 s.
import React, { useEffect, useState } from "react";
import { api, ApiError, apiReady } from "@/lib/api";
import { FormError, OpensSoon, styles as account } from "@/components/account/Account";
import styles from "../wall.module.css";

type Board = {
  open: boolean;
  frozenAt: string | null;
  players: { rank: number; name: string; grade: number; school: string | null; points: number; solved: number }[];
  schools: { rank: number; name: string; points: number; solved: number; players: number }[];
};

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    const load = () =>
      api<Board>("/wall/leaderboard")
        .then((b) => {
          setBoard(b);
          setError("");
        })
        .catch((e: ApiError) => setError(e.message)); // keep showing the last board if one refresh fails
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <div className={styles.board}>
        <div className={styles.boardHead}>
          <div>
            <h1 className={account.heading}>Engagement Wall</h1>
            <p className={styles.sub} style={{ margin: 0 }}>
              ARITHI × AVANTRA 2026 · Scan a chit, solve it, climb the board.
            </p>
          </div>
          {board?.frozenAt && <span className={styles.frozen}>Leaderboard frozen · final results at the ceremony</span>}
        </div>

        {!apiReady ? (
          <div className={account.card}>
            <OpensSoon what="The leaderboard" />
          </div>
        ) : !board ? (
          error ? <FormError message={error} /> : <p className={styles.sub} role="status">Loading…</p>
        ) : (
          <div className={styles.columns}>
            <section className={account.card} aria-labelledby="players">
              <h2 id="players" className={account.successHeading} style={{ fontSize: "1.6rem" }}>
                Top players
              </h2>
              {board.players.length === 0 ? (
                <p className={styles.sub}>{board.open ? "No one has solved a chit yet. Be the first!" : "The Wall opens on event day."}</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th className={styles.hideSmall}>School</th>
                      <th className={styles.num}>Solved</th>
                      <th className={styles.num}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.players.map((p) => (
                      <tr key={p.rank}>
                        <td>{p.rank}</td>
                        <td>
                          {p.name} <span className={styles.sub} style={{ whiteSpace: "nowrap" }}>· Class {p.grade}</span>
                        </td>
                        <td className={`${styles.sub} ${styles.hideSmall}`}>{p.school}</td>
                        <td className={styles.num}>{p.solved}</td>
                        <td className={styles.num}>
                          <strong>{p.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={account.card} aria-labelledby="schools">
              <h2 id="schools" className={account.successHeading} style={{ fontSize: "1.6rem" }}>
                Schools
              </h2>
              {board.schools.length === 0 ? (
                <p className={styles.sub}>No school has scored yet.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>School</th>
                      <th className={styles.num}>Players</th>
                      <th className={styles.num}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.schools.map((s) => (
                      <tr key={s.rank}>
                        <td>{s.rank}</td>
                        <td>{s.name}</td>
                        <td className={styles.num}>{s.players}</td>
                        <td className={styles.num}>
                          <strong>{s.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
        {board && error && <p className={styles.sub}>Couldn&apos;t refresh just now; retrying.</p>}
      </div>
    </div>
  );
}
