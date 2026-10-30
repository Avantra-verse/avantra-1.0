"use client";

// Admin dashboard: numbers and exports, school approvals, the registration desk, staff accounts,
// event results and the Engagement Wall. Laptop-first, still usable on a phone at the desk.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav, ADMIN_LINKS } from "@/components/Nav";
import QRCode from "qrcode";
import { CreateStaffRequest, WalkInRequest } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, SelectField, styles as account } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, rupees, Tile, useAction, useHashTab, useLoad } from "./ui";
import { Events } from "./events";
import { UpiPayments } from "./payments";
import { Wall } from "./wall";

const TABS = { overview: "Overview", referrals: "Referral codes", payments: "UPI payments", desk: "Desk", staff: "Staff", events: "Results", wall: "Wall" } as const;
type Tab = keyof typeof TABS;

// One line under each tab's title.
const INTRO: Record<Tab, string> = {
  overview: "Sign-ups, fees and the gate at a glance, plus the CSV downloads.",
  referrals: "How many students each ambassador code brought in.",
  payments: "UPI payments for the school to check, and their answers coming back.",
  desk: "Cash fees and walk-in registrations at the registration desk.",
  staff: "Volunteer and judge accounts, and which event each judge scores.",
  events: "Open or close events and see the judges' results.",
  wall: "The Engagement Wall: switch it on for event day, add and print challenges.",
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");
  const tab = useHashTab(TABS, "overview");

  useEffect(() => {
    if (!apiReady) return;
    getMe()
      .then((m) => (m?.role === "ADMIN" ? setMe(m) : router.replace("/admin/login")))
      .catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  return (
    <>
      <AppNav links={ADMIN_LINKS} badge="ADMIN" loginHref="/admin/login" portal />
      {/* md+: no top bar (the sidebar replaces it), so take back <main>'s top padding and clear the sidebar. */}
      <div className={`${account.registrationPage} md:-mt-16 md:pl-60`}>
        <div className={account.starfieldLayer} aria-hidden="true" />
        <div className={`${t.page} ${t.appPage}`}>
          {!apiReady ? (
            <div className={t.panel}>
              <OpensSoon what="Admin" />
            </div>
          ) : !me ? (
            failed ? <FormError message={failed} /> : <p className={t.mute} role="status">Loading…</p>
          ) : (
            <>
              <header className={t.pageHead}>
                <h1>{TABS[tab]}</h1>
                <p>{INTRO[tab]}</p>
              </header>
              {tab === "overview" && <Overview name={me.name} />}
              {tab === "referrals" && <Referrals />}
              {tab === "payments" && <UpiPayments />}
              {tab === "desk" && <Desk />}
              {tab === "staff" && <Staff />}
              {tab === "events" && <Events />}
              {tab === "wall" && <Wall />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---- overview ----

type Stats = {
  students: { total: number; paid: number; unpaid: number };
  referralCodes: number;
  fees: { onlinePaise: number; onlineCount: number; cashPaise: number; cashCount: number };
  gate: { checkedInToday: number };
  events: { id: string; name: string; capacity: number | null; registrations: number; teams: number; deskScans: number }[];
};

function Overview({ name }: { name: string }) {
  const { data: s, error, reload } = useLoad<Stats>("/admin/stats");
  if (!s) return error ? <FormError message={error} /> : <p className={t.mute}>Loading…</p>;
  return (
    <>
      <div className={t.panelHead}>
        <span className={t.mute}>Signed in as {name}</span>
        <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
      </div>
      <div className={`${t.stats} ${t.stats3}`}>
        <Tile value={s.students.total} label="students" />
        <Tile value={s.students.paid} label="fee paid" />
        <Tile value={s.gate.checkedInToday} label="through the gate today" />
        <Tile value={s.referralCodes} label="referral codes used" />
        <Tile value={rupees(s.fees.onlinePaise)} label={`online (${s.fees.onlineCount})`} />
        <Tile value={rupees(s.fees.cashPaise)} label={`cash at desk (${s.fees.cashCount})`} />
      </div>
      <section className={t.panel} aria-labelledby="by-event">
        <h2 id="by-event">Events</h2>
        <div className={t.scroll}>
          <table className={`${t.table} ${t.stack}`}>
            <thead>
              <tr>
                <th>Event</th>
                <th className={t.num}>Registered</th>
                <th className={t.num}>Teams</th>
                <th className={t.num}>Desk scans</th>
              </tr>
            </thead>
            <tbody>
              {s.events.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className={t.num} data-label="Registered">
                    {e.registrations}
                    {e.capacity !== null && <span className={t.mute}> / {e.capacity}</span>}
                  </td>
                  <td className={t.num} data-label="Teams">{e.teams}</td>
                  <td className={t.num} data-label="Desk scans">{e.deskScans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={t.panel} aria-labelledby="exports">
        <h2 id="exports">Downloads</h2>
        <p className={t.mute}>CSV files open in Excel. They hold students&apos; personal data: keep them off shared drives.</p>
        <div className={t.inline}>
          <a className={t.ghost} href={fileUrl("/admin/export/students.csv")}>Students</a>
          <a className={t.ghost} href={fileUrl("/admin/export/registrations.csv")}>Registrations &amp; teams</a>
          <a className={t.ghost} href={fileUrl("/admin/export/payments.csv")}>Payments</a>
          <a className={t.ghost} href={fileUrl("/admin/export/wall.csv")}>Wall standings</a>
        </div>
      </section>
    </>
  );
}

// ---- referral codes ----

type ReferralRow = { code: string; signups: number; paid: number };

// Codes are given to ambassadors by hand (Google Form, then email), so this is just a count per code.
function Referrals() {
  const { data, error, reload } = useLoad<ReferralRow[]>("/admin/referrals");
  return (
    <section className={t.panel} aria-labelledby="referrals">
      <div className={t.panelHead}>
        <h2 id="referrals">Codes</h2>
        <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
      </div>
      <p className={t.mute}>Most sign-ups first. Students enter a code on their profile step; any code they typed shows here, so check for typos.</p>
      <FormError message={error} />
      {!data ? null : data.length === 0 ? (
        <p className={t.mute}>No student has used a code yet.</p>
      ) : (
        <div className={t.scroll}>
          <table className={`${t.table} ${t.stack}`}>
            <thead>
              <tr>
                <th>Code</th>
                <th className={t.num}>Sign-ups</th>
                <th className={t.num}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.code}>
                  <td className={t.mono} data-label="Code">{r.code}</td>
                  <td className={t.num} data-label="Sign-ups">{r.signups}</td>
                  <td className={t.num} data-label="Paid">{r.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- registration desk ----

function Desk() {
  return (
    <div className={t.dashGrid}>
      <WalkIn />
      <MarkPaid />
    </div>
  );
}

function MarkPaid() {
  const [id, setId] = useState("");
  const [note, setNote] = useState("");
  const act = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim()) return act.setError("Type the AVANTRA ID.");
    const ok = await act.run(
      () => api<{ avantraId: string; name: string }>(`/admin/students/${encodeURIComponent(id.trim())}/mark-paid`, { note: note.trim() || undefined }),
      (r) => `${r.name} (${r.avantraId}): ₹299 cash recorded. A receipt email is on its way.`,
    );
    if (ok) {
      setId("");
      setNote("");
    }
  }

  return (
    <section className={t.panel} aria-labelledby="cash">
      <h2 id="cash">Cash fee (signed up online)</h2>
      <form className={t.inline} onSubmit={submit} noValidate>
        <Field name="payId" label="AVANTRA ID" placeholder="AV26-K7M2Q" autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} />
        <Field name="payNote" label="Receipt no. (optional)" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginBottom: 4 }}>Mark ₹299 paid</button>
      </form>
      <FormError message={act.error} />
      {act.note && <p role="status">{act.note}</p>}
    </section>
  );
}

const emptyWalkIn = { name: "", email: "", phone: "", grade: "", section: "", schoolName: "", guardianEmail: "", guardianPhone: "", note: "" };

function WalkIn() {
  const [form, setForm] = useState(emptyWalkIn);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [badge, setBadge] = useState<{ avantraId: string; name: string; qr: string } | null>(null);
  const act = useAction();

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const blank = (v: string) => v.trim() || undefined;
    const parsed = WalkInRequest.safeParse({
      name: form.name,
      email: form.email,
      phone: form.phone,
      grade: form.grade ? Number(form.grade) : undefined,
      section: blank(form.section),
      schoolName: form.schoolName,
      guardianEmail: blank(form.guardianEmail),
      guardianPhone: blank(form.guardianPhone),
      guardianConsent: consent || undefined,
      note: blank(form.note),
    });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      if (!form.grade) found.grade = "Pick a class.";
      return setErrors(found);
    }
    const r = await act.run(() => api<{ avantraId: string; qrToken: string; name: string }>("/admin/walk-in", parsed.data));
    if (r) {
      setBadge({ avantraId: r.avantraId, name: r.name, qr: await QRCode.toDataURL(r.qrToken, { width: 320, margin: 2 }) });
      setForm(emptyWalkIn);
      setConsent(false);
    }
  }

  return (
    <section className={t.panel} aria-labelledby="walkin">
      <h2 id="walkin">Walk-in (new student, pays cash)</h2>
      <p className={t.mute}>Creates the account, profile and ₹299 payment in one go. They set a password later with &ldquo;Forgot password&rdquo;.</p>
      {badge && (
        <div className={`${t.result} ${t.ok}`} role="status" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badge.qr} alt={`Badge QR for ${badge.name}`} width={160} height={160} style={{ borderRadius: 10 }} />
          <div>
            <strong>{badge.name}</strong>
            <span className={t.mono} style={{ fontSize: "1.3rem" }}>{badge.avantraId}</span>
            <p style={{ margin: "6px 0 0" }}>Registered and paid. Write the ID on their badge or print this screen.</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className={t.formGrid}>
          <Field name="name" label="Student's name" value={form.name} onChange={set} error={errors.name} />
          <Field name="email" label="Email (theirs or a parent's)" type="email" value={form.email} onChange={set} error={errors.email} />
          <Field name="phone" label="Phone" type="tel" inputMode="tel" value={form.phone} onChange={set} error={errors.phone} />
          <SelectField name="grade" label="Class" value={form.grade} onChange={set} error={errors.grade}>
            <option value="">Pick…</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>
          <Field name="section" label="Section (optional)" value={form.section} onChange={set} error={errors.section} />
          <Field name="schoolName" label="School name" value={form.schoolName} onChange={set} error={errors.schoolName} />
          <Field name="guardianEmail" label="Parent's email (optional)" type="email" value={form.guardianEmail} onChange={set} error={errors.guardianEmail} />
          <Field name="guardianPhone" label="Parent's phone (optional)" type="tel" value={form.guardianPhone} onChange={set} error={errors.guardianPhone} />
          <Field name="note" label="Receipt no. (optional)" value={form.note} onChange={set} error={errors.note} />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "16px 0 4px" }}>
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, guardianConsent: "" })); }} style={{ marginTop: 5 }} />
          <span>A parent or guardian agreed to the student taking part and to AVANTRA keeping these details.</span>
        </label>
        {errors.guardianConsent && <span className={account.errorText}>Needed before registering.</span>}
        <FormError message={act.error} />
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginTop: 12 }}>
          {act.busy ? "Registering…" : "Register and record ₹299 cash"}
        </button>
      </form>
    </section>
  );
}

// ---- staff ----

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: "VOLUNTEER" | "JUDGE";
  expiresAt: string | null;
  disabledAt: string | null;
  assignedEvent: { id: string; name: string } | null;
};

function Staff() {
  const list = useLoad<StaffRow[]>("/admin/staff");
  const events = useLoad<{ id: string; name: string }[]>("/events");
  const act = useAction();
  const [form, setForm] = useState({ role: "VOLUNTEER", name: "", email: "", password: "", eventId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  // 12 readable characters, no look-alikes, so it can be read out loud or written on a card.
  function generate() {
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setForm((f) => ({ ...f, password: Array.from(bytes, (b) => abc[b % abc.length]).join("") }));
    setErrors((x) => ({ ...x, password: "" }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateStaffRequest.safeParse({ ...form, eventId: form.role === "JUDGE" ? form.eventId || undefined : undefined });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    const r = await act.run(
      () => api<StaffRow>("/admin/staff", parsed.data),
      (s) => `${s.name} can log in at /staff/login with ${s.email} and the password ${form.password}. Share it with them now; it isn't shown again.`,
    );
    if (r) {
      setForm({ role: form.role, name: "", email: "", password: "", eventId: form.eventId });
      list.reload();
    }
  }

  const toggle = (s: StaffRow) =>
    act.run(() => api(`/admin/users/${s.id}/${s.disabledAt ? "enable" : "disable"}`, {}), () => `${s.name} ${s.disabledAt ? "enabled" : "disabled and logged out"}.`).then(list.reload);
  const assign = (s: StaffRow, eventId: string) =>
    act.run(() => api(`/admin/staff/${s.id}/assign`, { eventId }), () => `${s.name} now judges ${events.data?.find((e) => e.id === eventId)?.name}.`).then(list.reload);

  return (
    <>
      <section className={t.panel} aria-labelledby="new-staff">
        <h2 id="new-staff">Add a volunteer or judge</h2>
        <form onSubmit={create} noValidate>
          <div className={t.formGrid}>
            <SelectField name="role" label="Role" value={form.role} onChange={set}>
              <option value="VOLUNTEER">Volunteer</option>
              <option value="JUDGE">Judge</option>
            </SelectField>
            <Field name="name" label="Name" value={form.name} onChange={set} error={errors.name} />
            <Field name="email" label="Email" type="email" autoComplete="off" value={form.email} onChange={set} error={errors.email} />
            <div>
              <Field name="password" label="Password" autoComplete="new-password" value={form.password} onChange={set} error={errors.password} />
              <button type="button" className={account.link} onClick={generate}>Make one up</button>
            </div>
            {form.role === "JUDGE" && (
              <SelectField name="eventId" label="Judges" value={form.eventId} onChange={set} error={errors.eventId}>
                <option value="">Pick an event…</option>
                {events.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </SelectField>
            )}
          </div>
          <button type="submit" className={t.btn} disabled={act.busy} style={{ marginTop: 14 }}>Create account</button>
        </form>
        <FormError message={act.error} />
        {act.note && <p role="status">{act.note}</p>}
      </section>

      <section className={t.panel} aria-labelledby="staff-list">
        <h2 id="staff-list">Volunteers and judges</h2>
        <FormError message={list.error} />
        {!list.data ? null : list.data.length === 0 ? (
          <p className={t.mute}>No one yet.</p>
        ) : (
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Event</th>
                  <th className={t.hideSmall}>Access until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <div className={t.mute}>{s.email}</div>
                    </td>
                    <td>{s.role === "JUDGE" ? "Judge" : "Volunteer"}</td>
                    <td>
                      {s.role === "JUDGE" ? (
                        <select className={t.select} value={s.assignedEvent?.id ?? ""} disabled={act.busy} onChange={(e) => assign(s, e.target.value)} aria-label={`Event for ${s.name}`}>
                          {!s.assignedEvent && <option value="">Not assigned</option>}
                          {events.data?.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={t.mute}>All</span>
                      )}
                    </td>
                    <td className={`${t.mute} ${t.hideSmall}`}>{s.expiresAt && new Date(s.expiresAt).toLocaleDateString("en-IN")}</td>
                    <td className={t.num}>
                      <button type="button" className={t.ghost} disabled={act.busy} onClick={() => (s.disabledAt || confirm(`Disable ${s.name}? They are logged out at once.`)) && toggle(s)}>
                        {s.disabledAt ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
