"use client";

// Event day, phone-first. Volunteers check students in at the gate or an event desk; judges also score teams.
// Badges are scanned with the phone camera (or the AVANTRA ID is typed). If the venue Wi-Fi drops, check-ins are
// saved on the phone and sent with their scan time when the connection is back.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { AvantraId, MAX_POINTS } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, styles as account } from "@/components/account/Account";
import t from "./tools.module.css";

type Card = { name: string; avantraId: string; grade: number; school: string | null; feePaid: boolean };
type Ref = { qrToken: string } | { avantraId: string };
type EventRow = { id: string; name: string };

export default function StaffPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");
  const [tab, setTab] = useState<"checkin" | "judge">("checkin");

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
            {me.role === "JUDGE" && (
              <div className={t.tabs} role="tablist">
                {(["checkin", "judge"] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} className={t.tab} onClick={() => setTab(k)}>
                    {k === "checkin" ? "Check-in" : "Judging"}
                  </button>
                ))}
              </div>
            )}
            {tab === "judge" && me.role === "JUDGE" ? <Judging /> : <CheckIn />}
          </>
        )}
      </div>
    </div>
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

  const load = useCallback(() => api<typeof queue>("/staff/judge/teams").then(setQueue).catch((e: ApiError) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function open(get: () => Promise<JudgeTeam>) {
    setBusy(true);
    setError("");
    try {
      setTeam(await get());
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (team) return <ScoreTeam team={team} onDone={() => { setTeam(null); load(); }} />;
  return (
    <>
      <section className={t.panel} aria-labelledby="find">
        <h2 id="find">{queue ? queue.event.name : "Judging"}</h2>
        <p className={t.mute}>Scan any team member&apos;s badge to open their team.</p>
        <BadgeInput onRef={(ref) => open(() => api<JudgeTeam>("/staff/judge/lookup", ref))} busy={busy} label="Or type a member's AVANTRA ID" />
        <FormError message={error} />
      </section>
      {queue && (
        <section className={t.panel} aria-labelledby="queue">
          <h2 id="queue">
            Teams ({queue.teams.filter((x) => x.scored).length}/{queue.teams.length} scored)
          </h2>
          {queue.teams.length === 0 ? (
            <p className={t.mute}>No teams in this event yet.</p>
          ) : (
            <table className={t.table}>
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

function ScoreTeam({ team, onDone }: { team: JudgeTeam; onDone: () => void }) {
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(team.criteria.map((c) => [c, team.myScores[c]?.toString() ?? ""])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const max = team.maxPoints ?? MAX_POINTS;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const list = team.criteria.map((criterion) => ({ criterion, points: Number(scores[criterion]) }));
    if (list.some((s) => scores[s.criterion] === "" || !Number.isInteger(s.points) || s.points < 0 || s.points > max)) {
      return setError(`Give every criterion a whole number from 0 to ${max}.`);
    }
    setBusy(true);
    try {
      await api("/staff/judge/scores", { teamId: team.id, scores: list });
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  const total = team.criteria.reduce((sum, c) => sum + (Number(scores[c]) || 0), 0);
  return (
    <section className={t.panel} aria-labelledby="team">
      <h2 id="team">{team.name}</h2>
      {team.projectTitle && <p style={{ margin: "0 0 4px" }}>{team.projectTitle}</p>}
      {team.topic && <p className={t.mute} style={{ margin: 0 }}>{team.topic}</p>}
      <p className={t.mute}>{team.members.map((m) => m.name).join(", ")}</p>
      <form onSubmit={save} noValidate>
        <div className={t.criteria}>
          {team.criteria.map((c) => (
            <label key={c}>
              <span>{c}</span>
              <input
                className={t.small}
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                value={scores[c]}
                onChange={(e) => { setScores((s) => ({ ...s, [c]: e.target.value })); setError(""); }}
                aria-label={`${c}, out of ${max}`}
              />
            </label>
          ))}
        </div>
        <p className={t.mute}>
          Total {total} / {team.criteria.length * max}
        </p>
        <FormError message={error} />
        <div className={t.inline}>
          <button type="submit" className={t.btn} disabled={busy}>
            {busy ? "Saving…" : "Save scores"}
          </button>
          <button type="button" className={t.ghost} onClick={onDone}>
            Back
          </button>
        </div>
      </form>
    </section>
  );
}
