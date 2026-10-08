"use client";

// ARITHI Engagement Wall: type the code from a chit (or scan its QR, which opens /wall?code=…),
// answer, collect points. Any student with a profile can play; no fee.
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChitCode } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { AccountShell, Field, FormError, OpensSoon, styles as account } from "@/components/account/Account";
import { shareScoreCard } from "./shareCard";
import styles from "./wall.module.css";

export type WallMe = {
  open: boolean;
  points: number;
  solved: number;
  rank: number | null;
  players: number;
  school: { name: string; rank: number; points: number } | null;
  frozenAt: string | null;
};
type Challenge = {
  number: number;
  category: string;
  difficulty: number;
  points: number;
  question: string;
  options: string[];
  status: "OPEN" | "SOLVED" | "LOCKED";
  attemptsLeft: number;
};
type Answer = { correct: boolean; pointsEarned: number; status: Challenge["status"]; attemptsLeft: number; me: Omit<WallMe, "open"> };

export default function WallPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading, null = logged out
  const [wall, setWall] = useState<WallMe | null>(null);
  const [failed, setFailed] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [won, setWon] = useState<Answer | null>(null);

  const openCode = useCallback(async (raw: string) => {
    const parsed = ChitCode.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, "Codes are 6 letters or digits, as printed on the chit.");
    const c = await api<Challenge>(`/wall/challenges/${parsed.data}`);
    setCode(parsed.data);
    setWon(null);
    setChallenge(c);
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    (async () => {
      const m = await getMe();
      setMe(m);
      if (m?.role !== "STUDENT" || !m.profileComplete) return;
      setWall(await api<WallMe>("/wall/me"));
      const fromQr = new URLSearchParams(window.location.search).get("code");
      if (fromQr) await openCode(fromQr).catch((e: ApiError) => setFailed(e.message));
    })().catch((e: ApiError) => setFailed(e.message));
  }, [openCode]);

  const back = () => {
    setChallenge(null);
    setWon(null);
    setFailed("");
    window.history.replaceState(null, "", "/wall"); // a refresh shouldn't reopen the last chit
  };

  return (
    <AccountShell tagline="Find a chit. Crack it. Climb the wall.">
      {!apiReady ? (
        <OpensSoon what="The Engagement Wall" />
      ) : me === undefined ? (
        failed ? <FormError message={failed} /> : <p className={account.subtext} role="status">Loading…</p>
      ) : !me ? (
        <LoggedOut />
      ) : me.role !== "STUDENT" ? (
        <Notice title="Students only" text="The Engagement Wall is played from a student account." />
      ) : !me.profileComplete ? (
        <Notice title="One step first" text="Finish your profile to play." link={{ href: "/profile", label: "Finish profile" }} />
      ) : !wall ? (
        failed ? <FormError message={failed} /> : <p className={account.subtext} role="status">Loading…</p>
      ) : won ? (
        <Won me={me} result={won} onNext={back} />
      ) : challenge ? (
        <Play code={code} challenge={challenge} onBack={back} onAnswer={(r) => {
          setWall((w) => ({ ...w!, ...r.me }));
          if (r.correct) setWon(r);
          else setChallenge((c) => ({ ...c!, status: r.status, attemptsLeft: r.attemptsLeft }));
        }} />
      ) : (
        <Home wall={wall} failed={failed} onOpen={(c) => openCode(c).then(() => setFailed(""))} />
      )}
    </AccountShell>
  );
}

function LoggedOut() {
  const next = typeof window === "undefined" ? "/wall" : window.location.pathname + window.location.search;
  return (
    <>
      <h1 className={account.heading}>Engagement Wall</h1>
      <p className={account.subtext}>Chits are hidden around AVANTRA. Each has a code and a challenge. Solve it to score for you and your school.</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={account.submitBtn} style={linkBtn}>
        Log in to play
      </Link>
      <div className={account.footerLine}>
        New here? <Link href="/registration" className={account.link}>Create an account</Link>, then scan the chit again.
      </div>
      <div className={account.footerLine}>
        <Link href="/wall/leaderboard" className={account.link}>See the leaderboard</Link>
      </div>
    </>
  );
}

function Notice({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  return (
    <div className={account.successBox} role="status">
      <h1 className={account.successHeading}>{title}</h1>
      <p className={account.successText}>{text}</p>
      {link && (
        <Link href={link.href} className={account.submitBtn} style={linkBtn}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = { display: "block", textAlign: "center", textDecoration: "none" };

function Score({ wall }: { wall: Omit<WallMe, "open"> }) {
  return (
    <div className={styles.score}>
      <div className={styles.stat}>
        <span className={styles.statValue}>{wall.points}</span>
        <span className={styles.statLabel}>points</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{wall.rank ? `#${wall.rank}` : "–"}</span>
        <span className={styles.statLabel}>{wall.rank ? `of ${wall.players}` : "rank"}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{wall.solved}</span>
        <span className={styles.statLabel}>solved</span>
      </div>
    </div>
  );
}

function Home({ wall, failed, onOpen }: { wall: WallMe; failed: string; onOpen: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onOpen(code);
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className={account.heading}>Engagement Wall</h1>
      <p className={account.subtext}>
        {wall.school ? `${wall.school.name}: #${wall.school.rank} school, ${wall.school.points} points.` : "Find a chit, type its code, solve the challenge."}
        {wall.frozenAt && " Leaderboard frozen: final results at the ceremony."}
      </p>
      <Score wall={wall} />
      {!wall.open ? (
        <p className={account.successText} role="status">The Wall is closed right now. It opens on event day.</p>
      ) : (
        <form className={account.form} onSubmit={submit} noValidate>
          <Field
            name="code"
            label="Chit code"
            placeholder="e.g. K7M2QX"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            error={error || failed}
          />
          <button type="submit" className={account.submitBtn} disabled={busy}>
            {busy ? "Opening…" : "Open challenge"}
          </button>
        </form>
      )}
      <div className={account.footerLine}>
        <Link href="/wall/leaderboard" className={account.link}>Leaderboard</Link>
      </div>
    </>
  );
}

function Play({ code, challenge: c, onBack, onAnswer }: { code: string; challenge: Challenge; onBack: () => void; onAnswer: (r: Answer) => void }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [wrong, setWrong] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    if (!text.trim()) return setError("Type your answer.");
    setBusy(true);
    setError("");
    try {
      const r = await api<Answer>(`/wall/challenges/${code}/answer`, { answer: text });
      if (!r.correct) {
        setWrong(r.attemptsLeft ? `Not quite. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? "try" : "tries"} left.` : "Not quite, and that was your last try on this one.");
        setAnswer("");
      }
      onAnswer(r);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const closed = c.status !== "OPEN";
  return (
    <>
      <p className={styles.meta}>
        Challenge {c.number} · {c.category} · Level {c.difficulty} · {c.points} points
      </p>
      <p className={styles.question}>{c.question}</p>

      {c.status === "SOLVED" ? (
        <p className={account.successText} role="status">You&apos;ve already solved this one. Find another chit!</p>
      ) : c.status === "LOCKED" ? (
        <p className={account.errorText} role="status">{wrong || "No tries left on this challenge."} Find another chit!</p>
      ) : c.options.length ? (
        <>
          <p className={styles.meta}>Pick one. You get one try.</p>
          <div className={styles.options}>
            {c.options.map((o) => (
              <button key={o} type="button" className={styles.option} disabled={busy} onClick={() => send(o)}>
                {o}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          className={account.form}
          onSubmit={(e) => {
            e.preventDefault();
            send(answer);
          }}
          noValidate
        >
          <Field
            name="answer"
            label="Your answer"
            autoComplete="off"
            maxLength={200}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError("");
            }}
            error={error}
            autoFocus
          />
          {wrong && (
            <p className={account.errorText} role="alert">
              {wrong}
            </p>
          )}
          {!wrong && <p className={styles.meta}>{c.attemptsLeft} {c.attemptsLeft === 1 ? "try" : "tries"} left.</p>}
          <button type="submit" className={account.submitBtn} disabled={busy}>
            {busy ? "Checking…" : "Submit answer"}
          </button>
        </form>
      )}
      {c.options.length > 0 && !closed && <FormError message={error} />}
      <div className={account.footerLine}>
        <button type="button" className={account.link} onClick={onBack}>
          {closed ? "Enter another code" : "Back"}
        </button>
      </div>
    </>
  );
}

function Won({ me, result, onNext }: { me: Me; result: Answer; onNext: () => void }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const s = result.me;

  async function share() {
    setSharing(true);
    setError("");
    try {
      await shareScoreCard(me.name, s);
    } catch {
      setError("Couldn't make the card. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={styles.win} role="status">
      <h1 className={account.successHeading}>Correct!</h1>
      <p className={styles.winPoints}>+{result.pointsEarned}</p>
      <p className={account.subtext} style={{ marginBottom: 18 }}>
        {s.frozenAt ? "Leaderboard frozen: final results at the ceremony." : s.rank ? `You're #${s.rank} of ${s.players}.` : ""}
        {s.school && !s.frozenAt && ` ${s.school.name} is #${s.school.rank}.`}
      </p>
      <Score wall={s} />
      <button type="button" className={account.submitBtn} onClick={share} disabled={sharing}>
        {sharing ? "Making your card…" : "Share my score"}
      </button>
      <FormError message={error} />
      <div className={styles.row}>
        <button type="button" className={account.link} onClick={onNext}>
          Next chit
        </button>
        <Link href="/wall/leaderboard" className={account.link}>
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
