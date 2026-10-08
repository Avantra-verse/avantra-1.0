"use client";

// Event day, phone-first. Volunteers check students in at the gate or an event desk; judges only score teams.
// Badges are scanned with the phone camera (or the AVANTRA ID is typed). If the venue Wi-Fi drops, check-ins are
// saved on the phone and sent with their scan time when the connection is back.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { AvantraId, MAX_POINTS } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, styles as account } from "@/components/account/Account";
import t from "./tools.module.css";
import { useAction, useLoad, useTabs } from "../admin/ui";

type Card = { name: string; avantraId: string; grade: number; school: string | null; feePaid: boolean };
type Ref = { qrToken: string } | { avantraId: string };
type EventRow = { id: string; name: string };

export default function StaffPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    getMe()
      .then((m) => (m ? setMe(m) : router.replace("/staff/login")))
      .catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.replace("/staff/login");
  }

  const staff = me && ["VOLUNTEER", "JUDGE", "ADMIN"].includes(me.role);
  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.narrow}`}>
        {!apiReady ? (
          <div className={t.panel}>
            <OpensSoon what="Staff tools" />
          </div>
        ) : !me ? (
          failed ? <FormError message={failed} /> : <p className={t.mute} role="status">Loading…</p>
        ) : !staff ? (
          <div className={t.panel}>
            <h1 className={account.heading}>Staff only</h1>
            <p className={t.mute}>This page is for AVANTRA volunteers and judges.</p>
            <button type="button" className={t.btn} onClick={logout}>Log out</button>
          </div>
        ) : (
          <>
            <div className={t.head}>
              <h1 className={account.heading} style={{ fontSize: "2rem", margin: 0 }}>Event day</h1>
              <span className={t.mute}>
                {me.name} · {me.role.toLowerCase()} ·{" "}
                <button type="button" className={account.link} onClick={logout}>Log out</button>
              </span>
            </div>
            {me.role === "JUDGE" ? <Judging /> : <Tools />}
          </>
        )}
      </div>
    </div>
  );
}

const VOLUNTEER_TABS = { checkin: "Check-in", scans: "My scans", find: "Find student" } as const;

function Tools() {
  const { tab, bar } = useTabs(VOLUNTEER_TABS, "checkin");
  return (
    <>
      {bar}
      {tab === "checkin" && <CheckIn />}
      {tab === "scans" && <MyScans />}
      {tab === "find" && <FindStudent />}
    </>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function MyScans() {
  const { data, error, reload } = useLoad<{ total: number; recent: { at: string; place: string; student: Card }[] }>("/staff/my-scans");
  return (
    <section className={t.panel} aria-labelledby="my-scans">
      <div className={t.head}>
        <h2 id="my-scans">My scans</h2>
        <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
      </div>
      <FormError message={error} />
      {data && (
        <>
          <p style={{ margin: "0 0 4px" }}>
            <strong style={{ fontSize: "1.6rem", color: "var(--sky)" }}>{data.total}</strong> check-ins in the last 12 hours
          </p>
          <p className={t.mute}>Scans still waiting to send (no internet) show up here once they&apos;re sent.</p>
          {data.recent.length > 0 && (
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Time</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.at + r.student.avantraId}>
                    <td>
                      {r.student.name} <span className={`${t.mute} ${t.mono}`}>{r.student.avantraId}</span>
                    </td>
                    <td>{time(r.at)}</td>
                    <td className={t.mute}>{r.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

type Found = Card & { checkedInAt: string | null };

function FindStudent() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const act = useAction();

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return act.setError("Type at least 2 letters.");
    const r = await act.run(() => api<Found[]>(`/staff/students?q=${encodeURIComponent(q.trim())}`));
    if (r) setFound(r);
  }

  return (
    <section className={t.panel} aria-labelledby="find">
      <h2 id="find">Find a student</h2>
      <p className={t.mute}>Look someone up without checking them in.</p>
      <form className={t.inline} onSubmit={search} noValidate>
        <Field name="q" label="Name or AVANTRA ID" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginBottom: 4 }}>Search</button>
      </form>
      <FormError message={act.error} />
      {found && found.length === 0 && <p className={t.mute}>No one found.</p>}
      {found && found.length > 0 && (
        <table className={`${t.table} ${t.stack}`} style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Student</th>
              <th>AVANTRA ID</th>
              <th>Fee</th>
              <th>Gate today</th>
            </tr>
          </thead>
          <tbody>
            {found.map((f) => (
              <tr key={f.avantraId}>
                <td>
                  {f.name}
                  <div className={t.mute}>Class {f.grade}{f.school ? ` · ${f.school}` : ""}</div>
                </td>
                <td className={t.mono}>{f.avantraId}</td>
                <td>
                  <span className={`${t.pill} ${f.feePaid ? t.on : t.off}`}>{f.feePaid ? "paid" : "not paid"}</span>
                </td>
                <td>{f.checkedInAt ? `checked in ${time(f.checkedInAt)}` : <span className={t.mute}>not checked in</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// "K7M2Q" or "av26-k7m2q" -> "AV26-K7M2Q"
function toAvantraId(raw: string) {
  const s = raw.trim().toUpperCase();
  return AvantraId.safeParse(/^[A-Z0-9]{5}$/.test(s) ? `AV26-${s}` : s);
}

// Reads a badge: camera when the phone has one, typed AVANTRA ID always.
function BadgeInput({ onRef, busy, label }: { onRef: (r: Ref) => void; busy: boolean; label: string }) {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const canScan = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  function typed(e: React.FormEvent) {
    e.preventDefault();
    const parsed = toAvantraId(id);
    if (!parsed.success) return setError("AVANTRA IDs look like AV26-K7M2Q.");
    setError("");
    onRef({ avantraId: parsed.data });
    setId("");
  }

  return (
    <>
      {canScan &&
        (scanning ? (
          <Camera
            onCode={(qrToken) => {
              setScanning(false);
              onRef({ qrToken });
            }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <button type="button" className={account.submitBtn} onClick={() => setScanning(true)} disabled={busy} style={{ marginBottom: 16 }}>
            Scan badge
          </button>
        ))}
      <form className={t.inline} onSubmit={typed} noValidate>
        <Field name="avantraId" label={label} placeholder="AV26-K7M2Q" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={id} onChange={(e) => { setId(e.target.value); setError(""); }} error={error} />
        <button type="submit" className={t.btn} disabled={busy} style={{ marginBottom: error ? 30 : 4 }}>
          Check
        </button>
      </form>
      {!canScan && <p className={t.mute}>No camera available here; type the ID printed under the QR.</p>}
    </>
  );
}

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };

function Camera({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const done = useRef(onCode);
  done.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    // Chrome on Android reads QR codes natively; elsewhere (iPhone Safari, desktop) jsQR reads a downscaled frame.
    const w = window as unknown as { BarcodeDetector?: new (o: object) => Detector };
    const native = w.BarcodeDetector ? new w.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const read = async (v: HTMLVideoElement): Promise<string | null> => {
      if (native) return (await native.detect(v).catch(() => []))[0]?.rawValue ?? null;
      if (!v.videoWidth) return null;
      const scale = Math.min(1, 640 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data || null;
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        video.current!.srcObject = s;
        await video.current!.play();
        const tick = async () => {
          if (stopped) return;
          const text = await read(video.current!);
          if (text) done.current(text);
          else timer = window.setTimeout(tick, 250);
        };
        tick();
      })
      .catch(() => setError("Couldn't open the camera. Allow camera access, or type the AVANTRA ID."));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div style={{ marginBottom: 16 }}>
      {error ? <FormError message={error} /> : <video ref={video} className={t.video} muted playsInline aria-label="Camera view: point it at the badge QR" />}
      <button type="button" className={t.ghost} onClick={onClose}>
        Stop camera
      </button>
    </div>
  );
}

// Offline check-ins, kept on this phone until they reach the API (it accepts scans up to 48 h old).
type Queued = { id: string; qrToken?: string; avantraId?: string; eventId?: string; scannedAt: string; where: string };
const QUEUE_KEY = "avantra.checkinQueue";
function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // storage full or blocked: nothing more we can do on this phone
  }
}
// Still offline, logged out, or the server is struggling: keep the scan and try later.
const retryLater = (status: number) => status === 0 || status === 401 || status === 429 || status >= 500;

function CheckIn() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "bad"; title: string; card?: Card; note?: string } | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      for (const item of readQueue()) {
        const { id, where, ...body } = item;
        try {
          await api("/staff/checkin", body);
        } catch (e) {
          const err = e as ApiError;
          if (retryLater(err.status)) break;
          const who = (err.body?.student as Card | undefined)?.name ?? item.avantraId ?? "A scanned badge";
          setProblems((p) => [...p, `${who} (${where}): ${err.status === 404 ? "unknown badge" : err.message}`]);
        }
        writeQueue(readQueue().filter((q) => q.id !== id));
      }
    } finally {
      syncing.current = false;
      setWaiting(readQueue().length);
    }
  }, []);

  useEffect(() => {
    api<EventRow[]>("/events").then(setEvents).catch(() => {});
    sync();
    const timer = setInterval(sync, 20_000);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  async function check(ref: Ref) {
    setBusy(true);
    try {
      const r = await api<{ student: Card; checkedInAt: string; alreadyCheckedIn: boolean }>("/staff/checkin", { ...ref, eventId: eventId || undefined });
      const at = new Date(r.checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
      setResult(r.alreadyCheckedIn ? { tone: "warn", title: "Already checked in", card: r.student, note: `First scan today at ${at}.` } : { tone: "ok", title: "Checked in ✓", card: r.student });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 0) {
        const where = events.find((x) => x.id === eventId)?.name ?? "Main gate";
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        writeQueue([...readQueue(), { id, ...ref, eventId: eventId || undefined, scannedAt: new Date().toISOString(), where }]);
        setWaiting(readQueue().length);
        return setResult({
          tone: "warn",
          title: "Saved offline",
          note: "No connection. The scan is kept on this phone and sent automatically when the connection is back. Their registration can't be checked until then.",
        });
      }
      setResult({
        tone: "bad",
        title: err.status === 404 ? "Unknown badge" : err.message,
        card: err.body?.student as Card | undefined,
        note: err.status === 403 ? "Send them to the registration desk." : err.status === 404 ? "Check the ID, or send them to the registration desk." : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={t.panel} aria-labelledby="checkin">
      <h2 id="checkin">Check-in</h2>
      <label className={account.label} htmlFor="where">Where are you?</label>
      <select id="where" className={t.select} value={eventId} onChange={(e) => { setEventId(e.target.value); setResult(null); }} style={{ width: "100%", marginBottom: 18 }}>
        <option value="">Main gate</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <BadgeInput onRef={check} busy={busy} label="Or type the AVANTRA ID" />
      {result && (
        <div className={`${t.result} ${t[result.tone]}`} role="status" aria-live="polite">
          <strong>{result.title}</strong>
          {result.card && <CardLine card={result.card} />}
          {result.note && <p style={{ margin: "6px 0 0" }}>{result.note}</p>}
        </div>
      )}
      {waiting > 0 && (
        <p className={t.mute} role="status" style={{ marginTop: 14 }}>
          {waiting} {waiting === 1 ? "scan" : "scans"} saved on this phone, waiting for a connection.{" "}
          <button type="button" className={account.link} onClick={sync}>Send now</button>
        </p>
      )}
      {problems.length > 0 && (
        <div className={`${t.result} ${t.bad}`} role="alert">
          <strong>Offline scans that didn&apos;t go through</strong>
          <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <button type="button" className={account.link} onClick={() => setProblems([])}>Clear</button>
        </div>
      )}
    </section>
  );
}

function CardLine({ card }: { card: Card }) {
  return (
    <p style={{ margin: "6px 0 0" }}>
      {card.name} · Class {card.grade} · <span className={t.mono}>{card.avantraId}</span>
      <br />
      {card.school ?? "School not set"} · {card.feePaid ? "Exhibition fee paid" : "Fee not paid"}
    </p>
  );
}

// ---- judging ----

type QueueTeam = { id: string; name: string; projectTitle: string | null; topic: string | null; members: number; scored: boolean };
type JudgeTeam = {
  id: string;
  name: string;
  projectTitle: string | null;
  topic: string | null;
  members: { name: string; avantraId: string }[];
  criteria: string[];
  maxPoints: number;
  myScores: Record<string, number>;
};

function Judging() {
  const [queue, setQueue] = useState<{ event: { name: string }; teams: QueueTeam[] } | null>(null);
  const [team, setTeam] = useState<JudgeTeam | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(() => api<typeof queue>("/staff/judge/teams").then(setQueue).catch((e: ApiError) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function open(get: () => Promise<JudgeTeam>) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      setTeam(await get());
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (team)
    return (
      <ScoreTeam
        team={team}
        onDone={(didSave) => {
          if (didSave) setSaved(`Saved scores for ${team.name}.`);
          setTeam(null);
          load();
        }}
      />
    );
  return (
    <>
      <section className={t.panel} aria-labelledby="find">
        <h2 id="find">{queue ? queue.event.name : "Judging"}</h2>
        <p className={t.mute}>Scan any team member&apos;s badge to open their team.</p>
        <BadgeInput onRef={(ref) => open(() => api<JudgeTeam>("/staff/judge/lookup", ref))} busy={busy} label="Or type a member's AVANTRA ID" />
        <FormError message={error} />
        {saved && <p role="status" className={`${t.result} ${t.ok}`} style={{ marginBottom: 0 }}>{saved}</p>}
      </section>
      {queue && (
        <section className={t.panel} aria-labelledby="queue">
          <h2 id="queue">
            Teams ({queue.teams.filter((x) => x.scored).length}/{queue.teams.length} scored)
          </h2>
          {queue.teams.length === 0 ? (
            <p className={t.mute}>No teams in this event yet.</p>
          ) : (
            <table className={`${t.table} ${t.stack}`}>
              <tbody>
                {queue.teams.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name}
                      {x.projectTitle && <div className={t.mute}>{x.projectTitle}</div>}
                    </td>
                    <td>{x.scored ? <span className={`${t.pill} ${t.on}`}>Scored</span> : <span className={`${t.pill} ${t.off}`}>To do</span>}</td>
                    <td className={t.num}>
                      <button type="button" className={t.ghost} disabled={busy} onClick={() => open(() => api<JudgeTeam>(`/staff/judge/teams/${x.id}`))}>
                        {x.scored ? "Edit" : "Score"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}

function ScoreTeam({ team, onDone }: { team: JudgeTeam; onDone: (saved: boolean) => void }) {
  const [scores, setScores] = useState<Record<string, number | undefined>>(() => Object.fromEntries(team.criteria.map((c) => [c, team.myScores[c]])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const max = team.maxPoints ?? MAX_POINTS;
  const done = team.criteria.filter((c) => scores[c] !== undefined).length;
  const total = team.criteria.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
  const editing = team.criteria.some((c) => team.myScores[c] !== undefined);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = team.criteria.find((c) => scores[c] === undefined);
    if (missing) {
      setError(`Give a score for ${missing}.`);
      document.getElementById(`crit-${team.criteria.indexOf(missing)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      await api("/staff/judge/scores", { teamId: team.id, scores: team.criteria.map((criterion) => ({ criterion, points: scores[criterion] })) });
      onDone(true);
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <section className={t.panel} aria-labelledby="team">
      <button type="button" className={account.link} onClick={() => onDone(false)} style={{ marginBottom: 10 }}>
        &larr; All teams
      </button>
      <h2 id="team">{team.name}</h2>
      {team.projectTitle && <p style={{ margin: "0 0 4px", fontWeight: 700 }}>{team.projectTitle}</p>}
      {team.topic && <p className={t.mute} style={{ margin: 0 }}>{team.topic}</p>}
      <p className={t.mute}>{team.members.map((m) => m.name).join(", ")}</p>
      <form onSubmit={save} noValidate>
        <div className={t.criteria}>
          {team.criteria.map((c, i) => (
            <div key={c} id={`crit-${i}`} className={t.criterion}>
              <div className={t.criterionHead}>
                <span id={`crit-${i}-name`}>{c}</span>
                <strong>
                  {scores[c] ?? "–"}
                  <span className={t.mute}> / {max}</span>
                </strong>
              </div>
              <div className={t.points} role="radiogroup" aria-labelledby={`crit-${i}-name`}>
                {Array.from({ length: max + 1 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={scores[c] === n}
                    className={t.point}
                    onClick={() => {
                      setScores((s) => ({ ...s, [c]: n }));
                      setError("");
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FormError message={error} />
        <div className={t.saveBar}>
          <span>
            <strong style={{ fontSize: "1.3rem", color: "var(--sky)" }}>{total}</strong>
            <span className={t.mute}> / {team.criteria.length * max}</span>
            <span className={t.mute} style={{ display: "block" }}>
              {done} of {team.criteria.length} scored
            </span>
          </span>
          <button type="submit" className={t.btn} disabled={busy}>
            {busy ? "Saving…" : editing ? "Update scores" : "Save scores"}
          </button>
        </div>
      </form>
    </section>
  );
}
